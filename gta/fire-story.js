import * as THREE from 'three';
import { label } from './world.js';
import { setDoor, arrive } from './doors.js';
import { inIT } from './it-office.js';
import { FireCinema } from './fire-cinema.js';
import { createBurningLaptop, setLaptopFire } from './fire-sets.js';
import { FIRE_LINES } from './fire-lines.js';
import {
  FIRE_SECONDS,
  FIRE_START,
  FIRE_LAPTOP,
  FIRE_DELIVERY,
  FIRE_ROUTE,
  startFireAttempt,
  tickFireRun,
  finishFireMission,
} from './fire-state.js';

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const runningKeys = ['KeyF', 'KeyG', 'KeyB', 'KeyQ', 'KeyX', 'KeyT', 'Space'];
export class FireStory {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.a = game.arcade;
    this.w.fireStory = this;
    this.film = new FireCinema(this);
    this.enabled = false;
    this.clock = 0;
    this.soundToken = 0;
    this.laptop = createBurningLaptop();
    this.laptop.name = 'Story 02 · brennender Empower-Laptop';
    this.laptop.userData.dynamic = true;
    this.w.scene.add(this.laptop);
    this.palms = [new THREE.Vector3(), new THREE.Vector3()];
    this.routeStep = 0;
    this.lastTimeActive = false;
    this.runLineClock = 0;
    this.runHeard = new Set();
    this.marker = new THREE.Group();
    this.marker.userData.dynamic = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.026, 6, 36),
      new THREE.MeshBasicMaterial({ color: '#f3c674', transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    this.marker.add(ring);
    label(this.marker, 'IT', 0, 1.8, 0, 0.65, 0.32, { bg: '#193f4d', fg: '#ffdf94' });
    this.marker.visible = false;
    this.w.groups.office.add(this.marker);
    const hud = document.createElement('div');
    hud.id = 'fire-run-hud';
    hud.hidden = true;
    hud.innerHTML =
      '<div><span>BBE STORIES · KAPITEL 02</span><b>Ticket in Flammen</b></div><strong id="fire-countdown">01:00</strong><div class="fire-run-track"><i></i></div><p id="fire-run-hint">Zur IT · Benjamin wartet</p>';
    document.getElementById('ui').append(hud);
    this.hud = hud;
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-fire-open]')) this.brief();
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.running && !game.modal && runningKeys.includes(e.code)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    document.addEventListener('visibilitychange', () => {
      this.lastTimeActive = false;
      if (document.hidden) {
        this.stopRunAudio();
        this.checkpoint();
      }
    });
    window.addEventListener('beforeunload', () => this.checkpoint());
  }
  get state() {
    return this.g.sim.s.fireStory;
  }
  get active() {
    return ['intro', 'run', 'rescue', 'success'].includes(this.state.phase);
  }
  get running() {
    return this.enabled && this.state.phase === 'run';
  }
  get cinematic() {
    return !!(this.film.current || this.film.loading);
  }
  get status() {
    const m = this.film.current;
    return {
      phase: this.state.phase,
      enabled: this.enabled,
      remaining: this.state.remaining,
      attempts: this.state.attempts,
      rewardClaimed: this.state.rewardClaimed,
      completed: this.state.completed,
      carrying: this.running,
      laptopVisible: this.laptop.visible,
      cinematic: m?.kind || null,
      elapsed: m?.elapsed || 0,
      duration: m?.duration || 0,
      paused: !!m?.paused,
      routeStep: this.routeStep,
      heard: this.state.log.length,
      inIT: inIT(this.w.player.position),
    };
  }
  remember(key) {
    if (!this.state.log.includes(key)) this.state.log.push(key);
  }
  conflict() {
    return this.g.workshop?.active || this.g.sim.s.courier.active;
  }
  entryCard() {
    return `<button type="button" class="mission-row mission-open" data-fire-open><span class="mission-row-title">Ticket in Flammen.</span><span aria-hidden="true">↗</span></button>`;
  }
  brief() {
    if (this.cinematic) return;
    const history = this.state.log
      .map((key) => FIRE_LINES.find((l) => l.key === key))
      .filter(Boolean);
    this.g.open(
      'Ticket in Flammen',
      `<div class="story-brief fire-brief mission-brief"><p>Laptop zur IT im Westflügel bringen.</p><p class="mission-row-meta">${this.state.phase === 'run' ? Math.ceil(this.state.remaining) : 60} s · ${this.state.rewardClaimed ? 'Wiederholung ohne Honorar' : '90 € · 45 XP · +4 REP'}</p>${this.conflict() ? '<p class="hint-inline">Zuerst den Kofferauftrag abschließen.</p>' : '<button class="primary" id="fire-start">' + (this.active ? 'Fortsetzen' : this.state.phase === 'failed' ? 'Neu versuchen' : this.state.completed ? 'Noch einmal' : 'Zum Laptop') + '</button>'}${history.length ? '<details class="story-journal"><summary>Dialogbuch</summary>' + history.map((l) => '<p><b>' + esc(l.speaker) + '</b><br>' + esc(l.text) + '</p>').join('') + '</details>' : ''}</div>`,
      { pause: true },
    );
    document.getElementById('fire-start')?.addEventListener('click', () => {
      this.g.close();
      if (this.active) {
        this.resume();
        return;
      }
      if (this.w.zone !== 'office') this.g.transition('office');
      if (this.state.phase === 'failed' || this.state.completed) {
        this.start();
        return;
      }
      this.g.toast('Zum brennenden Laptop.', 'Gegenüber deinem Arbeitsplatz.');
      this.focusLaptopUntil = this.clock + 10;
    });
  }
  onStart() {
    if (this.active && !this.conflict()) {
      this.g.toast('Ticket in Flammen · Gespeichert', 'J · Fortsetzen');
    }
  }
  start() {
    if (this.cinematic || this.conflict() || this.a.vehicle || this.g.busy || this.g.modal)
      return false;
    this.enabled = true;
    this.a.immersion.physics.release();
    this.a.immersion.motion.cancel();
    startFireAttempt(this.g.sim);
    this.stopRunAudio();
    this.film.play('intro', () => this.beginRun(false));
    return true;
  }
  resume() {
    if (this.conflict() || this.cinematic) return;
    if (this.w.zone !== 'office') this.g.transition('office');
    this.enabled = true;
    if (this.state.phase === 'run') this.beginRun(true);
    else if (this.state.phase === 'rescue') this.rescue();
    else if (this.state.phase === 'success') this.success({ paid: 0, money: 0, xp: 0, rep: 0 });
    else if (this.state.phase === 'intro') this.film.play('intro', () => this.beginRun(false));
    else this.start();
  }
  beginRun(resume) {
    if (this.w.zone !== 'office') this.g.transition('office');
    this.enabled = true;
    this.state.phase = 'run';
    if (!resume) {
      this.state.remaining = FIRE_SECONDS;
      this.state.elapsed = 0;
      this.state.position = null;
    }
    let [x, z] = resume && this.state.position ? this.state.position : [FIRE_START.x, FIRE_START.z];
    // Malformed/imported checkpoints never place the player in solid furniture.
    if (!this.a.freeSpot(x, z, 0.32)) {
      x = FIRE_START.x;
      z = FIRE_START.z;
    }
    arrive(this.w, { x, z, yaw: FIRE_START.yaw });
    this.routeStep = 0;
    this.runLineClock = 0;
    this.lastTimeActive = false;
    this.runHeard.clear();
    this.g.sim.s.energy = Math.max(this.g.sim.s.energy, 35);
    this.g.sim.save();
    this.g.mouseControls?.resume();
    this.g.toast(
      'Ticket in Flammen',
      (resume ? Math.ceil(this.state.remaining) : 60) + ' s · Zur IT im Westflügel',
      true,
    );
  }
  stopRunAudio() {
    this.soundToken++;
    for (const key of ['bed', 'crackle']) {
      this[key]?.stop(0.15);
      this[key] = null;
      this[key + 'Pending'] = false;
    }
    if (this.g.audio.voices.current?.line?.event === 'fire.story' && !this.cinematic)
      this.g.audio.voices.stop();
  }
  maintainSound(key, id, options) {
    if (this[key] || this[key + 'Pending'] || !this.g.audio.ready || !this.g.audio.enabled) return;
    const token = this.soundToken;
    this[key + 'Pending'] = true;
    this.g.audio
      .sample(id, options)
      .then((h) => {
        if (token !== this.soundToken) {
          h?.stop(0.05);
          return;
        }
        this[key + 'Pending'] = false;
        this[key] = h;
      })
      .catch(() => {
        if (token === this.soundToken) this[key + 'Pending'] = false;
      });
  }
  line(key, force = false) {
    const l = FIRE_LINES.find((x) => x.key === key);
    if (!l) return false;
    if (!force && this.g.audio.voices.current) return false;
    this.remember(key);
    this.g.audio.voices.say(l.actor, 'fire.story', { id: l.id, force, priority: 8 });
    return true;
  }
  update(dt, paused) {
    this.clock += Math.min(dt, 1);
    const g = this.g,
      w = this.w,
      s = this.state;
    const active =
      g.started && !document.hidden && !paused && !g.modal && !g.busy && !this.cinematic;
    if (this.running) {
      if (w.zone !== 'office') {
        this.fail();
        return;
      }
      if (active) {
        const previous = s.remaining;
        if (tickFireRun(s, this.lastTimeActive ? dt : 0)) {
          this.fail();
          return;
        }
        for (const n of [30, 15, 10])
          if (previous > n && s.remaining <= n) this.line('warn_' + n, true);
        this.runLineClock += dt;
        const due = FIRE_LINES.filter((l) => l.key.startsWith('run_') && !this.runHeard.has(l.key));
        if (this.runLineClock > 2.5 && due.length && this.line(due[0].key)) {
          this.runHeard.add(due[0].key);
          this.runLineClock = -due[0].duration;
        }
        if (g.sim.s.music)
          this.maintainSound('bed', 'fire_tension', { bus: 'music', volume: 0.52, loop: true });
        else {
          this.bed?.stop(0.15);
          this.bed = null;
        }
        this.maintainSound('crackle', 'fire_crackle', { bus: 'effects', volume: 0.16, loop: true });
        s.position = [w.player.position.x, w.player.position.z];
        if (inIT(w.player.position) && distance(w.player.position, FIRE_DELIVERY) < 2.1) {
          this.rescue();
          return;
        }
      } else if (this.lastTimeActive) this.stopRunAudio();
      this.lastTimeActive = active;
    } else {
      this.lastTimeActive = false;
      const near = w.zone === 'office' && distance(w.player.position, FIRE_LAPTOP) < 2.4;
      if (active && s.phase === 'available' && near && !this.conflict() && !this.a.vehicle)
        this.start();
      if (this.crackle && !this.cinematic) {
        this.crackle.stop(0.15);
        this.crackle = null;
      }
    }
    this.updateHUD();
  }
  updateWorld(dt, blocked) {
    const w = this.w,
      s = this.state,
      office = w.zone === 'office';
    for (const door of [w.itOffice.entry, w.itOffice.door]) {
      const near = office && distance(w.player.position, door.root.position) < 3.2;
      if (door.opened !== near) setDoor(w, door, near);
    }
    this.laptop.visible = office && !this.cinematic;
    const intensity = this.running ? 0.72 + 0.24 * (1 - s.remaining / 60) : s.completed ? 0 : 0.55;
    setLaptopFire(this.laptop, intensity, w.time);
    if (this.running) {
      const p = w.player,
        r = p.userData.rig;
      for (const side of ['left', 'right']) {
        r[side + 'Arm'].rotation.x = -0.92;
        r[side + 'Arm'].rotation.z = side === 'left' ? 0.08 : -0.08;
        r[side + 'Fore'].rotation.x = -0.44;
      }
      p.updateWorldMatrix(true, true);
      r.leftFore.localToWorld(this.palms[0].set(0, -0.3, 0));
      r.rightFore.localToWorld(this.palms[1].set(0, -0.3, 0));
      this.laptop.position.copy(this.palms[0]).add(this.palms[1]).multiplyScalar(0.5);
      this.laptop.position.y += 0.04;
      this.laptop.quaternion.copy(p.quaternion);
      while (
        this.routeStep < FIRE_ROUTE.length - 1 &&
        distance(p.position, FIRE_ROUTE[this.routeStep]) < 2.4
      )
        this.routeStep++;
      if (p.position.x < -13) this.routeStep = Math.max(3, this.routeStep);
      if (p.position.x < -26) this.routeStep = FIRE_ROUTE.length - 1;
      const q = FIRE_ROUTE[this.routeStep];
      this.marker.position.set(q.x, 0, q.z);
      this.marker.children[1].rotation.y = w.yaw;
    } else {
      this.laptop.position.set(FIRE_LAPTOP.x, FIRE_LAPTOP.y, FIRE_LAPTOP.z);
      this.laptop.rotation.set(0, 0, 0);
      this.marker.position.set(FIRE_START.x, 0, FIRE_START.z);
    }
    this.marker.visible =
      office &&
      !this.cinematic &&
      !this.g.modal &&
      (this.running || this.clock < (this.focusLaptopUntil || 0));
    const benjamin = w.zoneData.office.npcs.find((n) => n.mesh === w.itOffice.actor);
    if (benjamin) {
      benjamin.storyAway = this.enabled && this.active;
      benjamin.mesh.visible = !benjamin.storyAway;
    }
    if (office && !blocked && !this.running && distance(w.player.position, FIRE_LAPTOP) < 2.6)
      w.nearest = {
        kind: 'fire-laptop',
        label: s.completed
          ? 'Laptop · Kapitel erneut ansehen'
          : this.active
            ? 'Laptop-Notfall · Story fortsetzen'
            : 'Brennender Laptop · Ticket in Flammen',
      };
    if (this.running && !blocked)
      w.nearest =
        inIT(w.player.position) && distance(w.player.position, FIRE_DELIVERY) < 2.1
          ? { kind: 'fire-deliver', label: 'Benjamin den Laptop übergeben' }
          : null;
  }
  rescue() {
    if (!['run', 'rescue'].includes(this.state.phase) || this.cinematic) return;
    this.state.phase = 'rescue';
    this.state.position = null;
    this.stopRunAudio();
    this.marker.visible = false;
    this.g.sim.save();
    this.film.play('rescue', () => this.success(finishFireMission(this.g.sim)));
  }
  success(result) {
    this.film.play(
      'success',
      () => {
        this.state.phase = 'complete';
        this.enabled = false;
        this.stopRunAudio();
        arrive(this.w, { x: -30.7, z: 3.6, yaw: 0.25 });
        this.g.sim.save();
        this.g.sim.emit('mission-complete', 'Ticket geschlossen', { token: result });
        this.g.toast(
          'Ticket geschlossen',
          result.paid ? '+90 € · +45 XP · +4 REP' : 'Wiederholung abgeschlossen.',
          true,
        );
      },
      result,
    );
  }
  fail() {
    this.state.phase = 'failed';
    this.enabled = false;
    this.stopRunAudio();
    this.marker.visible = false;
    this.g.sim.save();
    this.film.play('failure', () => {
      if (this.w.zone !== 'office') this.g.transition('office');
      arrive(this.w, FIRE_START);
      this.brief();
    });
  }
  checkpoint() {
    if (this.running) this.state.position = [this.w.player.position.x, this.w.player.position.z];
    this.g.sim.save();
  }
  beforeTransition() {
    if (this.running) {
      this.g.toast('Zuerst zur IT im Westflügel.');
      return false;
    }
    return true;
  }
  interact(n) {
    if (n?.kind === 'fire-laptop') {
      this.brief();
      return true;
    }
    if (n?.kind === 'fire-deliver') {
      if (this.running && distance(this.w.player.position, FIRE_DELIVERY) < 2.1) this.rescue();
      return true;
    }
    if (n?.kind === 'it-benjamin') {
      this.g.open(
        'Benjamin · IT',
        `<div class="story-brief"><span class="tag gold">IMMER DA FÜRS TEAM</span><h2>${this.state.completed ? 'Gelöscht. Gelöst. Geschlossen.' : 'Ein Ticket ist noch keine Katastrophe.'}</h2><p>${this.state.completed ? '„Der Laptop läuft wieder. Empower läuft vorerst unter Beobachtung.“' : '„Für normale Probleme reicht ein Neustart. Für besondere habe ich einen Feuerlöscher.“'}</p><p class="muted">Ticketstatus: ${this.state.completed ? 'gelöst · Ursache thermisch überzeugend' : 'bereit · Eskalationsweg frei'}</p><button data-fire-open>Ticket in Flammen · Story & Dialogbuch</button></div>`,
        { pause: true },
      );
      return true;
    }
    return this.running;
  }
  updateHUD() {
    const show = this.running && !this.g.modal && !document.hidden;
    this.hud.hidden = !show;
    if (this.enabled && this.active) {
      document.getElementById('quest-eyebrow').textContent = 'BBE STORIES · KAPITEL 02';
      document.getElementById('quest-title').textContent = 'Ticket in Flammen.';
      document.getElementById('quest-description').textContent = this.running
        ? 'Laptop zur IT im Westflügel bringen.'
        : 'Benjamin übernimmt.';
      document.getElementById('quest-location').textContent = 'BBE · IT im Westflügel';
      document.getElementById('quest-reward').textContent = this.state.rewardClaimed
        ? 'Wiederholung'
        : '90 € · 45 XP';
    }
    if (show) {
      const n = Math.ceil(this.state.remaining),
        text = String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
      document.getElementById('fire-countdown').textContent = text;
      this.hud.classList.toggle('urgent', n <= 15);
      this.hud.querySelector('.fire-run-track i').style.transform =
        'scaleX(' + this.state.remaining / 60 + ')';
      document.getElementById('fire-run-hint').textContent = inIT(this.w.player.position)
        ? 'Zum Servicetisch'
        : 'Zur IT im Westflügel';
    }
  }
  drawOfficeMap(canvas, mini) {
    const c = canvas.getContext('2d'),
      W = canvas.width,
      H = canvas.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#162f38';
    c.fillRect(0, 0, W, H);
    const scale = Math.min((W - 42) / 56, (H - 60) / 28),
      X = (x) => W / 2 + (x + 13) * scale,
      Z = (z) => H / 2 + z * scale;
    const rect = (x, z, w, d, fill) => {
      c.fillStyle = fill;
      c.fillRect(X(x), Z(z), w * scale, d * scale);
    };
    rect(-13.5, -11, 27, 22, '#355059');
    this.drawMap(c, { X, Z, scale, mini });
    // Furniture and openings make the IT route legible even inside the new wing.
    for (const [x, z] of [
      [-9, -3],
      [-3, -3],
      [4, -3],
      [-9, -8],
      [-3, -8],
      [4, -8],
    ])
      rect(x - 1.2, z - 0.65, 2.4, 1.3, '#a19b83');
    rect(-9, 6, 6, 2, '#668582');
    rect(-36.2, -1.3, 4.4, 1.6, '#809798');
    c.strokeStyle = '#7daba8';
    c.lineWidth = mini ? 1 : 2;
    c.strokeRect(X(-13.5), Z(-11), 27 * scale, 22 * scale);
    c.strokeRect(X(-40), Z(-7), 14 * scale, 16 * scale);
    for (const x of [-26, -13.5]) rect(x - 0.25, 4.8, 0.5, 2.4, '#86d0bb');
    c.fillStyle = '#e9c483';
    c.beginPath();
    c.arc(X(FIRE_LAPTOP.x), Z(FIRE_LAPTOP.z), mini ? 3 : 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d7e4e2';
    c.font = mini ? 'bold 12px Arial' : 'bold 18px Arial';
    c.textAlign = 'left';
    c.fillText('IT', X(-39), Z(-4));
    c.fillText('BBE', X(-12), Z(1));
    if (!mini) {
      c.font = '14px Arial';
      c.fillText('Westflügel', X(-24), Z(3));
      c.fillText('Laptop', X(-3), Z(-5));
      c.fillText('Zur Straße', X(1), Z(10));
    }
    const p = this.w.player.position;
    c.save();
    c.translate(X(p.x), Z(p.z));
    c.rotate(-this.w.player.rotation.y);
    c.fillStyle = '#fff3d4';
    c.shadowBlur = 5;
    c.shadowColor = '#fff8';
    c.beginPath();
    c.moveTo(0, 7);
    c.lineTo(-5, -6);
    c.lineTo(0, -3);
    c.lineTo(5, -6);
    c.closePath();
    c.fill();
    c.restore();
  }
  drawMap(c, { X, Z, scale, mini }) {
    c.fillStyle = '#29474d';
    c.fillRect(X(-40), Z(-7), 14 * scale, 16 * scale);
    c.fillRect(X(-26), Z(4.5), 12.5 * scale, 3 * scale);
    c.strokeStyle = '#e5bc78';
    c.lineWidth = 2;
    c.setLineDash([3, 4]);
    c.beginPath();
    FIRE_ROUTE.forEach((p, i) => (i ? c.lineTo(X(p.x), Z(p.z)) : c.moveTo(X(p.x), Z(p.z))));
    if (this.running) c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#ecc880';
    c.beginPath();
    c.arc(X(FIRE_DELIVERY.x), Z(FIRE_DELIVERY.z), 4, 0, Math.PI * 2);
    c.fill();
    if (!mini) {
      c.fillStyle = '#f0e5c5';
      c.font = 'bold 15px Arial';
      c.fillText('IT · Benjamin', X(-39), Z(-9));
    }
  }
}
