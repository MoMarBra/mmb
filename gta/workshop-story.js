import * as THREE from 'three';
import { label, animateHuman } from './world.js';
import { createStreetProp } from './aaa-props.js';
import { WorkshopCinema } from './workshop-cinema.js';
import { storyActor, animateStoryActor } from './workshop-sets.js';
import { WORKSHOP_LINES } from './workshop-lines.js';
import {
  WORKSHOP_ROUTE,
  WORKSHOP_PARK,
  WORKSHOP_HANDOFF,
  finishWorkshop,
} from './workshop-state.js';

const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ordinaryCar = (car) => car && !['bike', 'helicopter'].includes(car.type);
const MEET = { x: 34, z: 45.5 };
const objectives = {
  intro: 'Mit Lukas sprechen.',
  meet: 'Tobias vor der BBE treffen.',
  car: 'Mit Tobias ins Auto steigen.',
  drive: 'Mit Tobias zum Marienplatz fahren.',
  arrive: 'Koffer an Clara übergeben.',
  handoff: 'Clara prüft den Koffer.',
  workshop: 'Workshop begleiten.',
};

export class WorkshopStory {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.a = game.arcade;
    this.w.workshop = this;
    this.film = new WorkshopCinema(this);
    this.enabled = false;
    this.time = 0;
    this.companion = storyActor('Tobias');
    this.client = storyActor('clara');
    this.case = createStreetProp(THREE, 'suitcase');
    this.case.userData.handle.scale.y = 0.1;
    label(this.case, 'BBE · WORKSHOP', 0, 0.51, 0.182, 0.34, 0.1, { bg: '#e6c782', fg: '#173d4e' });
    this.w.groups.city.add(this.companion, this.client);
    this.w.scene.add(this.case);
    this.companion.position.set(MEET.x, 0, MEET.z);
    this.client.position.set(WORKSHOP_HANDOFF.x, 0, WORKSHOP_HANDOFF.z);
    this.client.rotation.y = 0;
    this.companion.visible = this.client.visible = this.case.visible = false;
    this.original = this.w.zoneData.office.npcs.find((n) => n.name?.startsWith('Tobias'));
    this.queue = [];
    this.line = null;
    this.lineClock = 0;
    this.passengerCar = null;
    this.boarding = null;
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-workshop-open]')) this.brief();
    });
    document.addEventListener('visibilitychange', () => {
      const m = this.film.current;
      if (!m) return;
      if (document.hidden && !m.paused) {
        m.autoPaused = true;
        this.film.pause(true);
      } else if (!document.hidden && m.autoPaused) {
        m.autoPaused = false;
        this.film.pause(false);
      }
    });
  }
  get state() {
    return this.g.sim.s.workshopStory;
  }
  get active() {
    return !['available', 'complete'].includes(this.state.phase);
  }
  get cinematic() {
    return !!this.film.current;
  }
  remember(key) {
    if (!this.state.log.includes(key)) this.state.log.push(key);
  }
  entryCard() {
    return `<button type="button" class="mission-row mission-open" data-workshop-open><span class="mission-row-title">Nur noch kurz zum Marienplatz.</span><span aria-hidden="true">↗</span></button>`;
  }
  brief() {
    if (this.g.fireStory?.active) {
      this.g.toast('Zuerst Ticket in Flammen abschließen.');
      return;
    }
    if (this.cinematic || this.film.loading) return;
    const s = this.state,
      atOffice = this.w.zone === 'office';
    const history = s.log.map((key) => WORKSHOP_LINES.find((l) => l.key === key)).filter(Boolean);
    this.g.open(
      'Nur noch kurz zum Marienplatz.',
      `<div class="story-brief mission-brief"><p>${this.active ? esc(objectives[s.phase] || 'Koffer zu Clara am Marienplatz bringen.') : 'Koffer mit Tobias zu Clara am Marienplatz bringen.'}</p><p class="mission-row-meta">${s.rewardClaimed ? 'Wiederholung · ohne Honorar' : '180 € · 70 XP · +6 REP'}</p>${this.g.sim.s.courier.active ? '<p class="hint-inline">Zuerst den Eilkoffer abgeben.</p>' : `<button id="workshop-start" class="primary">${this.active ? 'Fortsetzen' : !atOffice ? 'BBE markieren' : s.completed ? 'Noch einmal' : 'Starten'}</button>`}${this.active && this.enabled && !s.delivered ? '<button id="workshop-checkpoint">Ab BBE neu starten</button>' : ''}${history.length ? `<details class="story-journal"><summary>Dialogbuch</summary>${history.map((l) => `<p><b>${esc(l.speaker)}</b><br>${esc(l.text)}</p>`).join('')}</details>` : ''}</div>`,
      { pause: true },
    );
    document.getElementById('workshop-checkpoint')?.addEventListener('click', () => {
      this.g.close();
      this.g.transition('office');
      this.beginPlayable();
    });
    document.getElementById('workshop-start')?.addEventListener('click', () => {
      if (this.active && this.enabled) {
        this.g.close();
        this.markObjective();
        return;
      }
      if (this.active) {
        this.resume();
        return;
      }
      if (!atOffice) {
        this.g.close();
        this.g.waypoint = { x: 31, z: 45.2, name: 'BBE · Büro von Lukas Fleischmann' };
        return;
      }
      this.start();
    });
  }
  start() {
    if (
      this.g.fireStory?.active ||
      this.g.sim.s.courier.active ||
      this.cinematic ||
      this.film.loading
    )
      return;
    const s = this.state;
    Object.assign(s, {
      phase: 'intro',
      recruited: false,
      boarded: false,
      delivered: false,
      attempts: s.attempts + 1,
      routeStep: 0,
      driveLine: 0,
      log: [],
    });
    this.enabled = true;
    this.queue = [];
    this.line = null;
    this.lineClock = 0;
    this.g.sim.save();
    this.film.play('intro', () => this.beginPlayable());
  }
  resume() {
    if (this.g.sim.s.courier.active) return;
    this.enabled = true;
    this.g.close();
    if (['handoff', 'workshop'].includes(this.state.phase)) {
      this.continueWorkshop();
      return;
    }
    if (this.state.phase === 'intro') {
      this.film.play('intro', () => this.beginPlayable());
      return;
    }
    // Vehicles are deliberately session-local; a reload resumes the road chapter safely at BBE.
    if (this.w.zone !== 'office') this.g.transition('office');
    this.beginPlayable();
    this.g.toast('Fahrt fortgesetzt.', 'Tobias wartet vor der BBE.');
  }
  beginPlayable() {
    Object.assign(this.state, {
      phase: 'meet',
      recruited: false,
      boarded: false,
      routeStep: 0,
      driveLine: 0,
    });
    this.enabled = true;
    this.detachPassenger();
    this.queue = [];
    this.line = null;
    this.companion.position.set(MEET.x, 0, MEET.z);
    this.companion.rotation.y = -Math.PI / 2;
    this.ensureCar();
    this.markObjective();
    this.g.sim.save();
    this.g.toast('Nur noch kurz zum Marienplatz.', 'Tobias vor der BBE treffen.', true);
  }
  ensureCar() {
    let spot;
    for (const x of [44, 50, 56, 62, 68])
      for (const z of [42.2, 37.8]) {
        if (
          !spot &&
          !this.a.collides(
            { x, z, y: 0, w: 2.1, l: 4.8, angle: Math.PI / 2 },
            this.storyCar || null,
            'city',
          )
        )
          spot = { x, z };
      }
    if (!spot) return null;
    if (this.storyCar) {
      const c = this.storyCar;
      c.mesh.position.set(spot.x, 0, spot.z);
      c.mesh.rotation.set(0, Math.PI / 2, 0);
      c.body.position.set(spot.x, 0.8, spot.z);
      c.body.quaternion.setFromEuler(0, Math.PI / 2, 0);
      c.body.aabbNeedsUpdate = true;
      c.speed = 0;
      c.parked = true;
      return c;
    }
    const mesh = this.w.car(this.w.groups.city, 'car', '#285967');
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = Math.PI / 2;
    const body = this.w.obstacle('city', spot.x, spot.z, 2.1, 4.8, 0.8, 1.6);
    body.quaternion.setFromEuler(0, Math.PI / 2, 0);
    this.storyCar = {
      mesh,
      body,
      type: 'car',
      id: 'car-900',
      health: 100,
      parked: true,
      controlled: false,
      speed: 0,
      max: 0,
    };
    mesh.name = 'BBE · Workshopwagen';
    this.w.cars.push(this.storyCar);
    this.a.immersion.vehicles.detail(this.storyCar);
    // The mission car exposes both seats through individually cloned glass materials.
    for (const pane of this.storyCar.glazing || []) {
      if (pane.userData.suppressed) continue;
      pane.material = pane.material.clone();
      pane.material.transparent = true;
      pane.material.opacity = 0.2;
      pane.material.depthWrite = false;
      pane.material.metalness = 0.12;
      pane.material.roughness = 0.15;
      pane.material.color.set('#9dbac0');
      pane.castShadow = false;
    }
    return this.storyCar;
  }
  markObjective() {
    const phase = this.state.phase;
    if (phase === 'meet') this.g.waypoint = { ...MEET, name: 'Tobias · vor der BBE' };
    else if (phase === 'car') {
      const p = this.storyCar?.mesh.position || MEET;
      this.g.waypoint = { x: p.x, z: p.z, name: 'Workshopwagen · E einsteigen' };
    } else if (phase === 'drive') this.g.waypoint = { ...WORKSHOP_ROUTE[this.state.routeStep] };
    else if (phase === 'arrive')
      this.g.waypoint = { ...WORKSHOP_HANDOFF, name: 'Clara · Workshop-Koffer übergeben' };
  }
  interact(n) {
    if (n?.kind === 'workshop-meet') {
      this.state.recruited = true;
      this.state.phase = 'car';
      this.queue = WORKSHOP_LINES.filter((l) => l.key.startsWith('meet_'));
      this.markObjective();
      this.g.sim.save();
      this.g.toast('Tobias kommt mit.', 'E · Gemeinsam ins Auto.');
      return true;
    }
    if (n?.kind === 'workshop-wait') {
      this.g.toast('Wir liefern gemeinsam.', 'Auf Tobias warten. J · Neustart ab BBE.');
      return true;
    }
    if (n?.kind === 'workshop-deliver') {
      this.deliver();
      return true;
    }
    return false;
  }
  seatPosition(car) {
    const tall = ['van', 'bus'].includes(car.type);
    const seat =
      car.mesh.userData.passengerSeats?.[0]?.clone() ||
      new THREE.Vector3(tall ? 0.53 : 0.4, tall ? 1.08 : 0.8, tall ? 0.65 : -0.13);
    seat.y -= 0.045 + 0.86 * 0.74;
    seat.z += 0.1;
    return seat;
  }
  boardingPath(car, door) {
    const shape = this.a.shape(car),
      start = this.companion.position.clone();
    if (distance(start, door) > 40) return null;
    const nodes = [start, door];
    for (const side of [-1, 1])
      for (const front of [-1, 1])
        nodes.push(
          car.mesh.localToWorld(
            new THREE.Vector3(side * (shape.w / 2 + 0.8), 0, front * (shape.l / 2 + 0.9)),
          ),
        );
    const clear = (a, b) => {
      const steps = Math.ceil(distance(a, b) / 0.4);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (!this.a.freeSpot(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.24)) return false;
      }
      return true;
    };
    const costs = nodes.map(() => Infinity),
      previous = nodes.map(() => -1),
      visited = new Set();
    costs[0] = 0;
    for (let round = 0; round < nodes.length; round++) {
      let i = -1;
      for (let j = 0; j < nodes.length; j++)
        if (!visited.has(j) && (i === -1 || costs[j] < costs[i])) i = j;
      if (i === -1 || !Number.isFinite(costs[i])) break;
      if (i === 1) {
        const path = [];
        for (let at = 1; at !== -1; at = previous[at]) path.unshift(nodes[at]);
        return path;
      }
      visited.add(i);
      for (let j = 0; j < nodes.length; j++)
        if (
          !visited.has(j) &&
          costs[i] + distance(nodes[i], nodes[j]) < costs[j] &&
          clear(nodes[i], nodes[j])
        ) {
          costs[j] = costs[i] + distance(nodes[i], nodes[j]);
          previous[j] = i;
        }
    }
    return null;
  }
  beginBoarding(car) {
    this.a.immersion.vehicles.detail(car);
    const shape = this.a.shape(car);
    car.mesh.updateWorldMatrix(true, false);
    const door = new THREE.Vector3(shape.w / 2 + 0.5, 0, 0).applyMatrix4(car.mesh.matrixWorld);
    const path = this.boardingPath(car, door);
    if (!path) {
      this.nextBoardAttempt = this.time + 2;
      if (this.time > (this.nextBoardNotice || 0)) {
        this.nextBoardNotice = this.time + 12;
        this.g.toast('Beifahrertür freihalten.', 'In Tobias’ Nähe parken.');
      }
      return;
    }
    const lengths = path.slice(1).map((p, i) => distance(path[i], p)),
      length = lengths.reduce((a, b) => a + b, 0);
    // Only the companion uses this independent socket; the existing driver rig stays untouched.
    this.w.groups.city.attach(this.companion);
    this.companion.scale.setScalar(1);
    this.companion.visible = true;
    this.boarding = {
      car,
      time: 0,
      start: this.companion.position.clone(),
      door,
      path,
      lengths,
      walkDuration: Math.max(0.3, length / 2.8),
    };
    this.g.busy = true;
    this.a.speed = 0;
    this.a.immersion.vehicles.openDoor(car, true, door);
  }
  detachPassenger() {
    const car = this.passengerCar || this.boarding?.car;
    if (car) this.a.immersion.vehicles.openDoor(car, false);
    if (this.companion.parent !== this.w.groups.city) this.w.groups.city.attach(this.companion);
    this.companion.scale.setScalar(1);
    this.companion.rotation.x = this.companion.rotation.z = 0;
    this.passengerCar = null;
    if (this.boarding) this.g.busy = false;
    this.boarding = null;
  }
  exitPassenger() {
    const car = this.passengerCar;
    if (!car) return;
    const p = car.mesh.position,
      angle = car.mesh.rotation.y,
      shape = this.a.shape(car);
    let spot = null;
    for (const [side, front] of [
      [1, 0],
      [1, -2.5],
      [-1, -2.5],
      [0, -shape.l / 2 - 1.3],
    ]) {
      const x = p.x + Math.cos(angle) * side * (shape.w / 2 + 0.85) + Math.sin(angle) * front;
      const z = p.z - Math.sin(angle) * side * (shape.w / 2 + 0.85) + Math.cos(angle) * front;
      if (this.a.freeSpot(x, z, 0.32, car) && distance({ x, z }, this.w.player.position) > 0.85) {
        spot = { x, z };
        break;
      }
    }
    if (!spot) return; // Keep the passenger seated until a safe exit is available.
    this.detachPassenger();
    this.companion.position.set(spot.x, 0, spot.z);
    this.companion.rotation.y = angle;
    if (distance(p, WORKSHOP_PARK) < 24) {
      this.state.phase = 'arrive';
      this.queue = [];
      this.line = null;
      this.g.audio.voices.stop();
      this.markObjective();
      this.g.sim.save();
    }
  }
  updatePassenger(dt) {
    if (dt <= 0) return;
    if (this.boarding) {
      const b = this.boarding;
      if (this.a.vehicle !== b.car) {
        this.detachPassenger();
        return;
      }
      b.time += dt;
      const walkDuration = b.walkDuration;
      if (b.time < walkDuration) {
        let remaining = b.time * 2.8,
          index = 0;
        while (index < b.lengths.length - 1 && remaining > b.lengths[index])
          remaining -= b.lengths[index++];
        const from = b.path[index],
          to = b.path[index + 1],
          t = Math.min(1, remaining / Math.max(0.001, b.lengths[index]));
        this.companion.position.lerpVectors(from, to, t);
        this.companion.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        animateHuman(this.companion, this.time, 2.4, 'walk');
      } else {
        if (this.companion.parent !== b.car.mesh) {
          b.car.mesh.attach(this.companion);
          b.localStart = this.companion.position.clone();
        }
        const t = Math.min(1, (b.time - walkDuration) / 0.75),
          ease = t * t * (3 - 2 * t);
        animateStoryActor(this.companion, this.time, false);
        this.companion.scale.setScalar(1 - 0.26 * ease);
        this.companion.rotation.set(0, 0, 0);
        this.companion.position.lerpVectors(b.localStart, this.seatPosition(b.car), ease);
        const r = this.companion.userData.rig;
        r.leftLeg.rotation.x = r.rightLeg.rotation.x = -1.3 * ease;
        r.leftShin.rotation.x = r.rightShin.rotation.x = 1.1 * ease;
        if (t === 1) {
          this.passengerCar = b.car;
          this.boarding = null;
          this.g.busy = false;
          this.a.immersion.vehicles.openDoor(b.car, false);
          this.state.boarded = true;
          this.state.phase = 'drive';
          this.markObjective();
          this.g.sim.save();
        }
      }
      return;
    }
    if (this.passengerCar) {
      if (this.a.vehicle !== this.passengerCar) {
        this.exitPassenger();
        return;
      }
      const c = this.companion;
      animateStoryActor(c, this.time, this.line?.actor === 'Tobias');
      c.scale.setScalar(0.74);
      c.rotation.set(-0.055, 0, 0);
      c.position.copy(this.seatPosition(this.passengerCar));
      const r = c.userData.rig;
      r.leftLeg.rotation.set(-1.3, 0, -0.03);
      r.rightLeg.rotation.set(-1.27, 0, 0.03);
      r.leftShin.rotation.x = 1.1;
      r.rightShin.rotation.x = 1.1;
      r.leftArm.rotation.x = r.rightArm.rotation.x = -0.28;
      r.leftFore.rotation.x = r.rightFore.rotation.x = -1.1;
      c.visible = true;
      return;
    }
    if (
      ordinaryCar(this.a.vehicle) &&
      this.state.recruited &&
      !this.g.modal &&
      this.time >= (this.nextBoardAttempt || 0)
    ) {
      this.beginBoarding(this.a.vehicle);
      return;
    }
    if (this.state.recruited && !this.a.vehicle) {
      const p = this.w.player.position,
        c = this.companion.position,
        d = distance(p, c);
      if (d > 2 && dt > 0) {
        const step = Math.min(d - 1.6, dt * 4.8),
          dx = (p.x - c.x) / d,
          dz = (p.z - c.z) / d;
        const candidates = [
          [dx * step, dz * step],
          [dx * step, 0],
          [0, dz * step],
        ];
        for (const [x, z] of candidates)
          if (this.a.freeSpot(c.x + x, c.z + z, 0.28)) {
            c.x += x;
            c.z += z;
            break;
          }
        this.companion.rotation.y = Math.atan2(dx, dz);
        animateHuman(this.companion, this.time, 3, 'walk');
      } else animateStoryActor(this.companion, this.time, this.line?.actor === 'Tobias');
    } else animateStoryActor(this.companion, this.time, false);
  }
  updateDialogue(dt, blocked) {
    if (blocked) {
      if (this.line) this.lineInterrupted = true;
      return;
    }
    if (this.lineInterrupted && this.line) {
      this.lineClock = 0;
      this.lineInterrupted = false;
      this.say(this.line);
    }
    if (this.line) {
      this.lineClock += dt;
      if (this.lineClock < this.line.duration + 0.65) return;
      this.line = null;
    }
    if (!this.queue.length && this.passengerCar && this.state.driveLine < 11) {
      const i = this.state.driveLine;
      if (i === 10 && distance(this.w.player.position, WORKSHOP_PARK) > 65) return;
      this.queue.push(
        WORKSHOP_LINES.find((l) => l.key === `drive_${String(i + 1).padStart(2, '0')}`),
      );
      this.state.driveLine++;
    }
    if (this.queue.length) {
      this.line = this.queue.shift();
      this.lineClock = 0;
      this.say(this.line);
    }
  }
  say(line) {
    if (!line) return;
    this.remember(line.key);
    this.g.audio.voices.say(line.actor, 'workshop.story', {
      id: line.id,
      force: true,
      priority: 8,
    });
  }
  updateWorld(dt, blocked) {
    const active = this.active && this.enabled;
    if (this.original) {
      if (this.original.storyAway && !active) this.original.mesh.visible = true;
      this.original.storyAway = active;
      const it = this.w.zoneData.office.interactions.find((i) => i.data === this.original.name);
      if (it) it.storyAway = active;
    }
    this.case.visible = this.companion.visible = this.client.visible = false;
    if (!active) {
      if (this.passengerCar || this.boarding) this.detachPassenger();
      return;
    }
    this.time += dt;
    if (this.state.delivered) return;
    const city = this.w.zone === 'city';
    this.client.visible = city && ['drive', 'arrive'].includes(this.state.phase);
    if (this.client.visible) animateStoryActor(this.client, this.time, false);
    if (city) {
      this.companion.visible = true;
      this.updatePassenger(dt);
      if (!this.a.vehicle && !this.boarding) {
        if (
          this.state.phase === 'meet' &&
          distance(this.w.player.position, this.companion.position) < 2.7
        )
          this.w.nearest = { kind: 'workshop-meet', label: 'Mit Tobias zum Workshop fahren' };
        if (
          this.state.boarded &&
          this.w.player.position.y < 1.5 &&
          distance(this.w.player.position, WORKSHOP_HANDOFF) < 3
        ) {
          this.state.phase = 'arrive';
          this.w.nearest = this.canDeliver()
            ? { kind: 'workshop-deliver', label: 'Clara den Workshop-Koffer übergeben' }
            : { kind: 'workshop-wait', label: 'Auf Tobias warten · gemeinsam übergeben' };
        }
      }
      if (this.passengerCar) {
        const s = this.state;
        if (
          distance(this.w.player.position, WORKSHOP_ROUTE[s.routeStep]) < 17 &&
          s.routeStep < WORKSHOP_ROUTE.length - 1
        ) {
          s.routeStep++;
          this.markObjective();
        }
        if (distance(this.w.player.position, WORKSHOP_PARK) < 24 && s.phase === 'drive') {
          s.routeStep = WORKSHOP_ROUTE.length - 1;
          this.markObjective();
        }
      }
    }
    if (!this.state.delivered && !this.a.vehicle) {
      this.case.visible = true;
      const hand = this.w.player.userData.rig.rightFore;
      hand.updateWorldMatrix(true, false);
      const p = hand.localToWorld(new THREE.Vector3(0, -0.3, 0));
      this.case.quaternion.copy(this.w.player.quaternion);
      const grip = new THREE.Vector3(0, 0.724, 0.038).applyQuaternion(this.case.quaternion);
      this.case.position.copy(p).sub(grip);
    } else if (this.passengerCar) {
      this.case.visible = city;
      this.passengerCar.mesh.updateWorldMatrix(true, false);
      this.case.position.copy(
        this.passengerCar.mesh.localToWorld(new THREE.Vector3(0.2, 0.45, -1.2)),
      );
      this.case.quaternion.copy(this.passengerCar.mesh.quaternion);
      this.case.rotation.x += Math.PI / 2;
    }
    this.updateDialogue(dt, dt <= 0 || !!this.g.modal || !city);
  }
  transition() {
    this.detachPassenger();
    this.lineInterrupted = !!this.line;
    if (this.enabled && this.active && !this.state.delivered) {
      this.companion.position.set(MEET.x, 0, MEET.z);
      if (this.state.recruited) {
        this.state.phase = 'car';
        this.state.boarded = false;
        this.markObjective();
      }
    }
  }
  canDeliver() {
    return (
      this.enabled &&
      this.active &&
      this.w.zone === 'city' &&
      !this.state.delivered &&
      this.state.boarded &&
      !this.a.vehicle &&
      !this.passengerCar &&
      !this.boarding &&
      this.w.player.position.y < 1.5 &&
      distance(this.w.player.position, WORKSHOP_HANDOFF) < 3 &&
      distance(this.companion.position, WORKSHOP_HANDOFF) < 5
    );
  }
  deliver() {
    if (!this.canDeliver()) return;
    this.state.delivered = true;
    this.state.phase = 'handoff';
    this.queue = [];
    this.line = null;
    this.g.sim.save();
    this.film.play('handoff', () => this.continueWorkshop());
  }
  continueWorkshop() {
    this.state.phase = 'workshop';
    this.state.delivered = true;
    this.g.sim.save();
    this.film.play('workshop', () => {
      const result = finishWorkshop(this.g.sim);
      this.w.makeWorkstation();
      this.film.play(
        'success',
        () => {
          this.enabled = false;
          this.detachPassenger();
          this.g.waypoint = null;
          this.g.sim.save();
          this.g.toast(
            'Nur noch kurz · Abgeschlossen',
            result.paid ? '+180 € · +70 XP · +6 REP' : 'Wiederholung abgeschlossen.',
            true,
          );
        },
        result,
      );
    });
  }
  handoffSet() {
    if (this.deliverySet) {
      this.deliverySet.suitcase.visible = true;
      return this.deliverySet;
    }
    const group = new THREE.Group();
    group.position.set(WORKSHOP_HANDOFF.x, 0, WORKSHOP_HANDOFF.z);
    this.w.groups.city.add(group);
    const actors = {
      player: storyActor('player'),
      Tobias: storyActor('Tobias'),
      clara: storyActor('clara'),
    };
    actors.player.position.set(-0.8, 0, 1.3);
    actors.player.rotation.y = Math.PI;
    actors.Tobias.position.set(1, 0, 1.8);
    actors.Tobias.rotation.y = -2.7;
    actors.clara.position.set(0, 0, -0.6);
    group.add(...Object.values(actors));
    const suitcase = createStreetProp(THREE, 'suitcase');
    suitcase.userData.handle.scale.y = 0.1;
    group.add(suitcase);
    label(suitcase, 'BBE · WORKSHOP', 0, 0.51, 0.182, 0.34, 0.1, { bg: '#e6c782', fg: '#173d4e' });
    group.visible = false;
    this.deliverySet = { scene: this.w.scene, group, actors, suitcase, kind: 'handoff' };
    return this.deliverySet;
  }
  animateHandoff(t) {
    const { actors, suitcase, group } = this.deliverySet;
    const from = actors.player.userData.rig.rightFore,
      to = actors.clara.userData.rig.rightFore;
    const blend = THREE.MathUtils.smoothstep(t, 12, 17);
    from.updateWorldMatrix(true, false);
    to.updateWorldMatrix(true, false);
    const a = from.localToWorld(new THREE.Vector3(0, -0.3, 0)),
      b = to.localToWorld(new THREE.Vector3(0, -0.3, 0));
    group.worldToLocal(a);
    group.worldToLocal(b);
    suitcase.position.lerpVectors(a, b, blend);
    suitcase.position.y -= 0.724;
    suitcase.rotation.y = Math.PI * (1 - blend);
  }
  updateHUD() {
    if (!this.active) return;
    const set = (id, text) => {
      const e = document.getElementById(id);
      if (e) e.textContent = text;
    };
    set('quest-eyebrow', 'BBE STORIES · KAPITEL 01');
    set('quest-title', 'Nur noch kurz zum Marienplatz.');
    set(
      'quest-description',
      this.enabled
        ? objectives[this.state.phase]
        : 'Gespeicherte Story. J → BBE Stories → Fortsetzen.',
    );
    set('quest-location', this.passengerCar ? 'Beifahrer: Tobias' : 'BBE · Workshop-Auftrag');
    set('quest-reward', this.state.rewardClaimed ? 'Wiederholung' : '180 € · 70 XP');
  }
  get status() {
    return {
      phase: this.state.phase,
      enabled: this.enabled,
      passenger: !!this.passengerCar,
      boarding: !!this.boarding,
      carId: this.passengerCar?.id,
      cinematic: this.film.current?.kind || null,
      elapsed: this.film.current?.elapsed || 0,
      duration: this.film.current?.duration || 0,
      paused: !!this.film.current?.paused,
      routeStep: this.state.routeStep,
      heard: this.state.log.length,
      rewardClaimed: this.state.rewardClaimed,
    };
  }
}
