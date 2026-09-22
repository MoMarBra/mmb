import { syncDriver } from './vehicle-detail.js';
import * as THREE from 'three';
import { human, animateHuman } from './world.js';
import { createPoliceCar, createUmbrella } from './aaa-props.js';
import { rayBoxDistance } from './expansion.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const finitePoint = (p) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
export class CityLife {
  constructor(d) {
    this.d = d;
    this.w = d.world;
    this.g = d.game;
    this.a = d.arcade;
    this.reactions = new Map();
    this.reports = [];
    this.level = 0;
    this.phase = 'clear';
    this.lastSeen = V();
    this.search = 0;
    this.capture = 0;
    this.units = [];
    this.memory = [];
    this.nextLine = 0;
    this.rainEpoch = 0;
    this.wasRain = false;
    this.nextAid = 0;
    this.driverReactions = [];
    for (let i = 0; i < 3; i++) {
      const mesh = createPoliceCar(THREE);
      mesh.position.set(i === 2 ? 240 : i ? 3.9 : -3.9, 0, i === 2 ? 40 : i ? -120 : 90);
      mesh.visible = false;
      this.w.groups.city.add(mesh);
      const car = {
        mesh,
        type: 'police',
        width: 1.92,
        length: 4.7,
        height: 1.6,
        speed: 0,
        max: 12,
        controlled: true,
        parked: false,
        health: 100,
        id: 'police-' + i,
      };
      this.w.cars.push(car);
      const officer = human({ jacket: '#233947', pants: '#253744', hair: '#533d32' });
      officer.visible = false;
      this.w.groups.city.add(officer);
      this.units.push({ car, officer, active: false, route: [], step: 0 });
    }
    this.nodes = [
      V(0, 0, -155),
      V(0, 0, -43),
      V(0, 0, 40),
      V(0, 0, 117),
      V(-144, 0, -43),
      V(-144, 0, 40),
      V(-144, 0, 72),
      V(249, 0, 40),
      V(249, 0, 117),
      V(249, 0, 280),
      V(410, 0, 117),
      V(410, 0, 280),
    ];
    this.edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [4, 5],
      [5, 2],
      [5, 6],
      [2, 7],
      [7, 8],
      [8, 9],
      [8, 10],
      [10, 11],
      [11, 9],
    ];
  }
  canSee(from, to, max = 45) {
    if (!finitePoint(from) || !finitePoint(to)) return false;
    if (from.distanceTo(to) > max) return false;
    const a = from.clone().add(V(0, 1.45, 0)),
      b = to.clone().add(V(0, 1.1, 0)),
      dir = b.clone().sub(a).normalize(),
      distance = a.distanceTo(b);
    for (const body of this.w.zoneData.city.physics.bodies) {
      if (body.mass || body.collisionResponse === false) continue;
      if (rayBoxDistance(a, dir, body, distance) < distance - 0.3) return false;
    }
    return true;
  }
  emit(type, position, severity = 1) {
    // One malformed event must never spread invalid positions through the crowd
    // or the police routes: distance comparisons against NaN cannot reject it.
    if (!finitePoint(position)) return;
    if (
      this.lastEvent &&
      this.lastEvent.type === type &&
      this.d.time - this.lastEvent.at < 0.75 &&
      this.lastEvent.p.distanceTo(position) < 8
    )
      return;
    this.lastEvent = { type, p: position.clone(), at: this.d.time };
    if (this.w.zone !== 'city') return;
    const p = position.clone();
    let witnesses = 0;
    this.w.zoneData.city.npcs.forEach((n, i) => {
      if (n.down || !n.mesh.visible || n.mesh.position.distanceTo(p) > 36) return;
      const seen = this.canSee(n.mesh.position, p, 32);
      if (!seen && type !== 'shot') return;
      witnesses += seen ? 1 : 0;
      const mode = i % 5 === 0 && seen ? 'report' : i % 4 === 0 ? 'film' : 'flee';
      this.reactions.set(n, {
        mode,
        until: this.d.time + (mode === 'report' ? 7 : 8),
        from: p.clone(),
        home: n.mesh.position.clone(),
      });
      if (mode === 'report')
        this.reports.push({ at: this.d.time + 4.5, position: p.clone(), severity, witness: n });
    });
    if (witnesses && this.level) this.search = 0;
    if (this.units.some((u) => u.active && this.canSee(u.car.mesh.position, p, 55)))
      this.report(p, severity);
    if (witnesses && !this.reports.length)
      this.reports.push({ at: this.d.time + 5, position: p.clone(), severity });
    if (type === 'crash' || type === 'assault')
      for (const c of this.w.cars
        .filter(
          (c) =>
            c !== this.a.vehicle &&
            !['bike', 'helicopter', 'police'].includes(c.type) &&
            c.mesh.visible &&
            c.mesh.position.distanceTo(p) < 14 &&
            c.speed > 1,
        )
        .slice(0, 1)) {
        if (!c.driverNPC) {
          const mesh = human({ jacket: '#886b4b' });
          this.w.groups.city.add(mesh);
          const n = {
            mesh,
            driverCar: c,
            hp: 3,
            down: 0,
            arcadeId: 'driver-' + c.id,
            name: 'Autofahrer',
            pose: 'phone',
          };
          c.driverNPC = n;
          this.w.zoneData.city.npcs.push(n);
        }
        const n = c.driverNPC;
        c.driverWasControlled = c.controlled;
        c.controlled = true;
        c.speed = 0;
        n.until = this.d.time + 12;
        n.departed = false;
        const q = c.mesh.position
          .clone()
          .add(V(Math.cos(c.mesh.rotation.y) * 1.6, 0, -Math.sin(c.mesh.rotation.y) * 1.6));
        n.mesh.position.copy(q);
        n.x = q.x;
        n.z = q.z;
        n.mesh.visible = true;
        n.mesh.rotation.y = c.mesh.rotation.y;
        this.d.vehicles.openDoor(c, true);
      }
    this.g.sim.s.cityMemory = type;
    this.g.sim.s.incidents++;
    this.a.heat = Math.min(100, this.a.heat + severity * 8);
    if (this.d.time > this.nextLine) {
      this.nextLine = this.d.time + 6;
      this.g.audio.voices?.say('passerby', 'npc.flee', { position: p, priority: 2 });
      this.g.audio.sample('aaa_startled_crowd', { volume: 0.28, position: p });
      this.g.toast(
        type === 'shot' ? 'Passanten suchen Deckung.' : 'Die Straße reagiert.',
        witnesses ? 'Ein Zeuge hat dich gesehen.' : 'Das war im ganzen Viertel zu hören.',
      );
    }
  }
  report(p, severity) {
    if (!finitePoint(p)) return;
    this.level = Math.min(3, Math.max(1, this.level + (severity >= 2 || this.level === 0 ? 1 : 0)));
    this.phase = 'pursuit';
    this.lastSeen.copy(p);
    this.search = 0;
    this.g.sim.s.wanted = this.level;
    this.g.audio.voices?.say('officer', 'police.spotted');
    this.g.toast(
      'Fahndung · ' + this.level + ' Sterne',
      'Streifenwagen sind unterwegs. Sichtkontakt abbrechen und Fahrzeug wechseln oder Deckung suchen.',
    );
    for (let i = 0; i < this.level; i++) {
      const u = this.units[i];
      if (!u.active && !u.car.exploded) {
        u.active = true;
        u.car.mesh.visible = true;
        u.car.mesh.position.copy(this.nodes[[3, 0, 7][i]]);
        u.car.mesh.position.x += i ? 4 : -4;
        u.route = [];
      }
    }
  }
  route(from, to) {
    const nearest = (p) =>
        this.nodes.reduce(
          (a, n, i) => (n.distanceToSquared(p) < this.nodes[a].distanceToSquared(p) ? i : a),
          0,
        ),
      start = nearest(from),
      goal = nearest(to),
      dist = this.nodes.map(() => Infinity),
      prev = [];
    dist[start] = 0;
    const seen = new Set();
    while (seen.size < this.nodes.length) {
      let at = -1;
      dist.forEach((v, i) => {
        if (!seen.has(i) && (at < 0 || v < dist[at])) at = i;
      });
      if (at === goal || !Number.isFinite(dist[at])) break;
      seen.add(at);
      for (const [a, b] of this.edges) {
        const next = a === at ? b : b === at ? a : -1;
        if (next < 0) continue;
        const cost = dist[at] + this.nodes[at].distanceTo(this.nodes[next]);
        if (cost < dist[next]) {
          dist[next] = cost;
          prev[next] = at;
        }
      }
    }
    const out = [goal];
    while (out[0] !== start && prev[out[0]] !== undefined) out.unshift(prev[out[0]]);
    return out.map((i) => this.nodes[i].clone());
  }
  updateNPC(n, dt) {
    let r = this.reactions.get(n);
    if (n.driverCar) {
      if (n.departed) {
        n.mesh.visible = false;
        return true;
      }
      const c = n.driverCar;
      if (this.d.time > n.until && !n.down) {
        n.mesh.visible = false;
        n.departed = true;
        if (this.a.vehicle !== c) c.controlled = c.driverWasControlled;
        this.d.vehicles.openDoor(c, false);
      } else {
        n.mesh.visible = true;
        animateHuman(n.mesh, this.d.time, 0, 'phone');
      }
      return true;
    }
    const rain = this.g.sim.s.weather === 'Regen';
    if (
      rain &&
      !n.cycle &&
      !n.umbrella &&
      this.w.zoneData.city.npcs.indexOf(n) % 3 === 0 &&
      n.mesh.position.distanceTo(this.w.player.position) < 40
    ) {
      n.umbrella = createUmbrella(THREE);
      n.umbrella.scale.setScalar(0.75);
      n.umbrella.position.y = 1.65;
      this.w.groups.city.add(n.umbrella);
    }
    if (n.umbrella) {
      n.umbrella.visible =
        rain &&
        !n.down &&
        n.mesh.visible &&
        n.mesh.position.distanceTo(this.w.player.position) < 40;
      n.umbrella.position.set(n.mesh.position.x, n.mesh.position.y + 1.43, n.mesh.position.z);
      n.umbrella.rotation.z = Math.sin(this.d.time * 3) * 0.04;
    }
    if (
      !r &&
      rain &&
      !n.umbrella &&
      n.rainSafeUntil !== this.rainEpoch &&
      Math.abs(n.mesh.position.x) < 16 &&
      !n.cycle
    ) {
      r = {
        mode: 'shelter',
        until: Infinity,
        from: V(0, 0, n.mesh.position.z),
        home: n.mesh.position.clone(),
      };
      this.reactions.set(n, r);
      n.rainSafeUntil = this.rainEpoch;
    }
    if (!r) return false;
    if (n.down) {
      n.umbrella && (n.umbrella.visible = false);
      return false;
    }
    if (this.d.time > r.until || (r.mode === 'shelter' && !rain)) {
      this.reactions.delete(n);
      n.mesh.rotation.z = 0;
      n.mesh.position.y = 0;
      return false;
    }
    if (r.mode === 'help') {
      const dir = r.patient.mesh.position.clone().sub(n.mesh.position);
      dir.y = 0;
      const distance = dir.length();
      dir.normalize();
      if (distance > 1.3) {
        const actual = this.w.pedestrianNav.move(n, r.patient.mesh.position, 1.6, dt);
        animateHuman(n.mesh, this.d.time, actual, 'walk');
      } else {
        animateHuman(n.mesh, this.d.time, 0, 'phone');
        n.mesh.position.y = -0.3;
        n.mesh.userData.rig.leftLeg.rotation.x = -1.1;
        n.mesh.userData.rig.rightLeg.rotation.x = -0.9;
        n.mesh.userData.rig.rightArm.rotation.x = -1.4;
      }
      n.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      n.x = n.mesh.position.x;
      n.z = n.mesh.position.z;
      return true;
    }
    if (r.mode === 'flee' || r.mode === 'shelter') {
      const delta = n.mesh.position.clone().sub(r.from);
      delta.y = 0;
      if (delta.length() < 0.1) delta.set(1, 0, 0);
      delta.normalize();
      const speed = r.mode === 'shelter' ? 1.5 : 3.2;
      const target = { x: n.mesh.position.x + delta.x * 5, z: n.mesh.position.z + delta.z * 5 };
      const actual = this.w.pedestrianNav.move(n, target, speed, dt);
      animateHuman(n.mesh, this.d.time, actual, 'walk');
    } else {
      n.mesh.rotation.y = Math.atan2(r.from.x - n.mesh.position.x, r.from.z - n.mesh.position.z);
      animateHuman(n.mesh, this.d.time, 0, 'phone');
      n.mesh.userData.rig.rightArm.rotation.x = r.mode === 'film' ? -1.5 : -2.2;
    }
    return true;
  }
  update(dt) {
    if (dt <= 0) return;
    const rain = this.g.sim.s.weather === 'Regen';
    if (rain !== this.wasRain) {
      this.rainEpoch++;
      this.wasRain = rain;
    }
    if (this.w.zone === 'city' && this.d.time > this.nextAid) {
      this.nextAid = this.d.time + 3;
      const npcs = this.w.zoneData.city.npcs,
        patient = npcs.find((n) => n.down > 3);
      if (patient && !Array.from(this.reactions.values()).some((r) => r.mode === 'help')) {
        const helper = npcs.find(
          (n) =>
            !n.down &&
            !n.cycle &&
            !n.driverCar &&
            n.mesh.visible &&
            n.mesh.position.distanceTo(patient.mesh.position) < 8 &&
            n !== patient,
        );
        if (helper) this.reactions.set(helper, { mode: 'help', patient, until: this.d.time + 5 });
      }
    }
    for (const r of [...this.reports])
      if (this.d.time >= r.at) {
        if (!r.witness?.down) this.report(r.position, r.severity);
        this.reports.splice(this.reports.indexOf(r), 1);
      }
    const player = this.w.player.position;
    let seen = false;
    if (
      this.a.vehicle &&
      this.a.vehicle.mesh.position.y < 1 &&
      Math.abs(this.a.speed) > 6 &&
      this.d.time > (this.nearMissAt || 0)
    ) {
      const n = this.w.zoneData.city.npcs.find(
        (n) => !n.down && n.mesh.visible && n.mesh.position.distanceTo(player) < 4,
      );
      if (n) {
        this.nearMissAt = this.d.time + 5;
        this.g.audio.voices?.say('passerby', 'npc.near_miss', { npc: n });
        this.reactions.set(n, { mode: 'flee', from: player.clone(), until: this.d.time + 4 });
      }
    }

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.car.exploded) {
        u.active = false;
        u.car.speed = 0;
        u.officer.visible = false;
        syncDriver(u.car, { occupied: false });
        continue;
      }
      if (!u.active) continue;
      const c = u.car,
        p = c.mesh.position;
      if (this.a.vehicle !== c && c.body?.world) {
        c.body.world.removeBody(c.body);
        c.body = null;
        c.controlled = true;
      }
      if (this.a.vehicle === c) {
        u.officer.visible = false;
        this.level = 3;
        this.lastSeen.copy(player);
        seen = true;
        continue;
      }
      const visible = this.w.zone === 'city' && this.canSee(p, player, 58) && player.y < 15;
      if (visible) {
        seen = true;
        this.lastSeen.copy(player);
      }
      const goalNode = this.nodes.reduce(
        (best, n, j) =>
          n.distanceToSquared(this.lastSeen) < this.nodes[best].distanceToSquared(this.lastSeen)
            ? j
            : best,
        0,
      );
      if (!u.route.length || u.goalNode !== goalNode) {
        u.route = this.route(p, this.lastSeen);
        u.step = 0;
        u.goalNode = goalNode;
      }
      const goal = u.route[u.step] || this.lastSeen,
        delta = goal.clone().sub(p);
      delta.y = 0;
      const near = delta.length() < 2;
      if (near && u.step < u.route.length - 1) u.step++;
      const distance = p.distanceTo(this.lastSeen),
        speed = distance < 13 ? 0 : Math.min(13, delta.length() * 1.4);
      c.speed = THREE.MathUtils.damp(c.speed, speed, 2, dt);
      if (delta.length() > 0.1 && c.speed > 0) {
        delta.normalize();
        const x = p.x + delta.x * c.speed * dt,
          z = p.z + delta.z * c.speed * dt;
        if (!this.a.collides(this.a.shape(c, x, z, Math.atan2(delta.x, delta.z)), c)) {
          p.set(x, 0, z);
          c.mesh.rotation.y = Math.atan2(delta.x, delta.z);
        } else c.speed = 0;
      }
      for (const light of c.mesh.userData.lights || c.mesh.userData.beacons || []) {
        light.visible = Math.sin(this.d.time * 17 + i) > 0;
      }
      if (this.w.zone === 'city' && p.distanceTo(player) < 90)
        this.g.audio.requestLoop?.('siren-' + i, 'aaa_police_siren', 0.22, {
          position: p,
          rate: 1,
          bus: 'ambience',
          lowpass: 3800,
        });
      u.officer.visible =
        this.w.zone === 'city' &&
        (distance < 17 || (u.step === u.route.length - 1 && delta.length() < 3 && distance < 70));
      if (u.officer.visible) {
        if (!u.wasOut) {
          u.officer.position.copy(p).add(V(2, 0, 0));
          this.g.audio.voices?.say('officer', 'police.vehicle_stop');
        }
        const target = visible ? player : this.lastSeen,
          dir = target.clone().sub(u.officer.position);
        dir.y = 0;
        const d = dir.length();
        if (d > 2) {
          dir.normalize();
          const q = u.officer.position.clone().addScaledVector(dir, dt * 2.8);
          if (this.d.motion.freeAt(q.x, 0, q.z, 0.25)) u.officer.position.copy(q);
          u.officer.rotation.y = Math.atan2(dir.x, dir.z);
        }
        animateHuman(u.officer, this.d.time, d > 2 ? 1 : 0, 'walk');
        if (visible && !this.a.vehicle && d < 2.2) this.capture += dt;
      }
      syncDriver(c, {
        occupied: u.active && this.w.zone === 'city' && !u.officer.visible,
        role: 'officer',
        outsideActor: u.officer,
        time: this.d.time,
        speed: c.speed,
      });
      u.wasOut = u.officer.visible;
    }
    if (this.level) {
      if (seen) {
        this.search = 0;
        this.phase = 'pursuit';
      } else {
        if (this.phase !== 'search') this.g.audio.voices?.say('officer', 'police.search');
        this.phase = 'search';
        this.search += dt;
        if (this.search > 28 + this.level * 9) {
          this.clear();
          this.g.sim.s.escapes++;
          this.g.audio.voices?.say('player', 'police.clear');
          this.g.toast(
            'Fahndung beendet.',
            'Der Suchradius ist leer. Zeit für einen unauffälligen Kaffee.',
          );
        }
      }
      if (this.capture > 2.2) {
        const fee = Math.min(this.g.sim.s.money, 15 + this.level * 10);
        this.g.sim.transaction(-fee, 'Verwarnung · Stadtchaos');
        this.clear();
        this.g.transition('office');
        this.g.toast(
          'Zurück im Büro.',
          'Verwarnung bezahlt. Am Empfang liegt bereits ein Rückrufwunsch.',
        );
      }
      this.capture = Math.max(0, this.capture - dt * 0.25);
    }
  }
  clear() {
    this.level = 0;
    this.phase = 'clear';
    this.g.sim.s.wanted = 0;
    this.search = 0;
    this.capture = 0;
    this.reports = [];
    for (const u of this.units) {
      u.active = false;
      u.car.mesh.visible = false;
      u.officer.visible = false;
      u.car.controlled = true;
      if (u.car.body?.world) u.car.body.world.removeBody(u.car.body);
      u.car.body = null;
      u.car.driverVisuals?.forEach((v) => (v.visible = false));
    }
  }
  onReturn() {
    if (this.level)
      this.g.toast(
        'Empfang · Lena',
        '„Zwei Herren möchten kurz deine Verkehrsstrategie besprechen.“',
      );
    else if (this.g.sim.s.cityMemory)
      this.g.toast(
        'Tobias hat etwas mitbekommen.',
        this.g.sim.s.cityMemory === 'shot'
          ? '„Die Wettbewerbsanalyse ist offenbar eskaliert.“'
          : '„Deine Standortbesichtigung hatte auffällig viel Blaulicht.“',
      );
  }
}
