import { INTRO_CUES } from './intro-cues.js';
import * as THREE from 'three';
import { BBE_LOGO } from './branding.js';
import { VOICE_LINES } from './voice-lines.js';
import { createHelicopter } from './expansion-models.js';
import { animateVehicleWheels } from './blender-vehicles.js';
import { box } from './world.js';
export const INTRO_DURATION = 93.2;
// Shot times follow the supplied music edit and recorded dialogue cue sheet.
export const INTRO_SHOTS = [
  {
    at: 15.96,
    end: 22.111,
    zone: 'city',
    anchor: [131, 29],
    from: [80, 39, 84],
    to: [113, 24, 51],
    look: [131, 5, 14],
    minutes: 525,
    title: 'MÜNCHEN',
    sub: 'Große Pläne. Sehr kleine Zeitpuffer.',
  },
  {
    at: 22.111,
    end: 29.691,
    zone: 'city',
    anchor: [31, 45],
    from: [61, 15, 24],
    to: [28, 5, 32],
    look: [40, 7, 56],
    minutes: 590,
    title: 'BRIENNER STRASSE 45',
    sub: 'Dein Büro. Dein Business Case.',
  },
  {
    at: 29.691,
    end: 35.87,
    zone: 'office',
    anchor: [-7, 2],
    from: [-1, 2.7, 7],
    to: [-8, 1.9, 5],
    look: [-7.5, 1.1, 1],
    minutes: 497,
    title: 'BBE HANDELSBERATUNG',
    sub: 'Hier beginnt jede große Eskalation.',
  },
  {
    at: 35.87,
    end: 42.764,
    zone: 'city',
    anchor: [0, 27],
    from: [-3, 5, 50],
    to: [4, 3, 8],
    look: [-17, 3, 27],
    minutes: 750,
    title: 'AUGUSTENSTRASSE',
    sub: 'Benchmarks. Burritos. Budgetabweichungen.',
  },
  {
    at: 42.764,
    end: 50.51,
    zone: 'city',
    anchor: [8, 88],
    from: [-3, 3, 103],
    to: [3, 2.5, 79],
    look: [17.4, 2.5, 88],
    minutes: 810,
    title: 'DOGTOWN',
    sub: 'Diese Schärfe steht in keinem Risikoregister.',
    blast: [9, 0.2, 92],
  },
  {
    at: 50.51,
    end: 56.11,
    zone: 'brewery',
    anchor: [0, 5],
    from: [0, 2.2, 7],
    to: [-1, 1.7, -0.2],
    look: [-4, 1.8, -4],
    minutes: 1020,
    title: 'BRIENNER BRÄU',
    sub: 'Liquidität. Frisch gezapft.',
  },
  {
    at: 56.11,
    end: 59,
    zone: 'city',
    anchor: [68, 41],
    from: [77, 1.6, 35],
    to: [99, 2, 35],
    look: [72, 1, 41],
    minutes: 1020,
    title: 'MOBILITÄT MIT MARGE',
    sub: 'Vier Räder. Keine Folienbegrenzung.',
    stage: 'car',
  },
  {
    at: 59,
    end: 61.823,
    zone: 'city',
    anchor: [131, 29],
    from: [111, 24, 58],
    to: [142, 28, 58],
    look: [130, 17, 36],
    minutes: 1090,
    title: 'BBE AIR',
    sub: 'Für die wirklich übergeordnete Perspektive.',
    stage: 'heli',
  },
  {
    at: 61.823,
    end: 66.429,
    zone: 'city',
    anchor: [67, 37],
    from: [93, 2, 31],
    to: [61, 2.2, 32],
    look: [77, 1, 37],
    minutes: 1160,
    title: 'EXTERNES CONTROLLING',
    sub: 'Blaulicht ist keine PowerPoint-Farbe.',
    stage: 'police',
  },
  {
    at: 66.429,
    end: 69.3,
    zone: 'city',
    anchor: [131, 29],
    from: [105, 14, 43],
    to: [140, 12, 48],
    look: [131, 4, 12],
    minutes: 1125,
    title: 'KÖNIGSPLATZ',
    sub: 'Große Kulisse. Kleine Deadline.',
  },
  {
    at: 69.3,
    end: 72.693,
    zone: 'city',
    anchor: [280, 249],
    from: [251, 23, 284],
    to: [294, 32, 286],
    look: [280, 23, 240],
    minutes: 1160,
    title: 'FRAUENKIRCHE',
    sub: 'Die Türme stehen. Die Deadline auch.',
  },
  {
    at: 72.693,
    end: 77.212,
    zone: 'city',
    anchor: [368, 290],
    from: [337, 10, 285],
    to: [391, 17, 298],
    look: [367, 12, 318],
    minutes: 1300,
    title: 'NACH DER LETZTEN FOLIE',
    sub: 'München schläft. Outlook arbeitet weiter.',
  },
  {
    at: 77.212,
    end: 84.01,
    zone: 'city',
    anchor: [0, 40],
    from: [-3, 2, 67],
    to: [2, 2.3, 27],
    look: [-17, 5, 25],
    minutes: 1280,
    rain: true,
    title: 'REGEN IM RISIKOSZENARIO',
    sub: 'Nur die Storyline bleibt trocken.',
  },
  {
    at: 84.01,
    end: 90.2,
    zone: 'office',
    anchor: [-7, 2],
    from: [-2, 2.2, 8],
    to: [-7, 1.7, 4.2],
    look: [-8, 1.3, 1.7],
    minutes: 497,
    title: 'DEIN NÄCHSTER ARBEITSTAG.',
    sub: 'final_final_vielleicht_final.',
  },
  {
    at: 90.2,
    end: INTRO_DURATION,
    zone: 'city',
    anchor: [31, 45],
    from: [49, 9, 26],
    to: [49, 20, 24],
    look: [40, 6, 56],
    minutes: 570,
    title: 'BBE · MUNICH CONSULTING SIMULATOR',
    sub: 'Aufstehen. Und Geschichte schreiben.',
  },
];
export class IntroFilm {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.current = null;
    this.generation = 0;
    this.end = new THREE.Vector3();
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.current) return;
        if (
          e.code === 'Tab' ||
          (['Enter', 'Space'].includes(e.code) && e.target.closest?.('button'))
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (e.code === 'Escape') this.pause(!this.current.paused);
        if (e.code === 'Enter') this.finish();
      },
      true,
    );
    document.addEventListener('visibilitychange', () => {
      if (this.current && document.hidden) this.pause(true);
    });
    // The normal save handler is registered later by Game.bind().
    window.addEventListener('beforeunload', () => {
      if (this.current) this.restoreState();
    });
  }
  makeStage() {
    if (this.stage) return;
    this.stage = new THREE.Group();
    this.stage.name = 'Intro · isolated film props';
    this.stage.userData.dynamic = true;
    this.w.groups.city.add(this.stage);
    this.hero = this.w.car(this.stage, 'car', '#973e34');
    this.police = this.w.car(this.stage, 'car', '#d8e0dd');
    box(this.police, 0, 1.67, 0, 0.9, 0.1, 0.24, '#263d57');
    this.beacons = [-0.32, 0.32].map((x) =>
      box(this.police, x, 1.77, 0, 0.19, 0.11, 0.19, '#3b81e6', false),
    );
    this.heli = createHelicopter(THREE);
    this.stage.add(this.heli);
    this.stage.visible = false;
  }
  async play() {
    if (this.current || this.g.started) return;
    const g = this.g,
      w = this.w,
      weather = g.arcade.immersion.weather;
    this.restore = {
      zone: w.zone,
      restaurant: w.currentRestaurant,
      position: w.player.position.clone(),
      yaw: w.yaw,
      pitch: w.pitch,
      distance: w.distance,
      minutes: g.sim.s.minutes,
      weather: g.sim.s.weather,
      wetness: g.sim.s.wetness,
      wet: weather.wet,
      cloud: weather.cloud,
      pose: w.pose,
      playerVisible: w.player.visible,
      shadowVisible: w.playerShadow.visible,
      worldTime: w.time,
      state: structuredClone(g.sim.s),
      save: g.sim.save,
    };
    g.sim.save = () => true;
    this.voiceUntil = 0;
    this.activeVoice = null;
    const token = ++this.generation;
    this.current = {
      elapsed: 0,
      base: 0,
      startedAt: 0,
      paused: false,
      loading: true,
      shot: -1,
      heard: new Set(),
      blasts: new Set(),
    };
    g.audio.start();
    g.audio.voices.stop();
    g.audio.cinematicMix = true;
    this.makeStage();
    g.open(
      'Intro',
      `<div class="world-intro-frame"><div class="intro-logo"><img src="${BBE_LOGO}" alt="BBE Handelsberatung"><span>HANDELSBERATUNG</span><small>PRÄSENTIERT</small></div><div class="intro-location"><small id="intro-sub"></small><h1 id="intro-title"></h1></div><div class="intro-subtitle" id="intro-voice"></div><div class="intro-toolbar"><span id="intro-state">Bild und Ton werden vorbereitet …</span><button id="intro-pause">Pause</button><button id="intro-exit">Überspringen ↗</button></div><div class="intro-progress"><i id="intro-progress"></i></div><div id="intro-fade"></div></div>`,
      { pause: true, locked: true },
    );
    document.body.classList.add('world-intro');
    w.player.visible = false;
    w.playerShadow.visible = false;
    document.getElementById('intro-pause').onclick = () => this.pause(!this.current.paused);
    document.getElementById('intro-exit').onclick = () => this.finish();
    this.lines = INTRO_CUES.map((c) => ({ ...c, line: VOICE_LINES.find((l) => l.id === c.id) }));
    this.buffers = new Map();
    const ids = [
      'v160_intro_theme',
      ...this.lines.map((c) => 'voice_' + c.id),
      'v160_explosion_01',
      'v160_explosion_02',
      'v160_explosion_03',
    ];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const b = await g.audio.bank?.get(id);
          if (token === this.generation && b) this.buffers.set(id, b);
        } catch {
          /* Subtitles and controls also work with muted/unavailable audio. */
        }
      }),
    );
    if (token !== this.generation || !this.current) return;
    try {
      await this.warm(token);
    } catch {}
    if (token !== this.generation || !this.current) return;
    this.current.loading = false;
    this.current.startedAt = performance.now();
    document.getElementById('intro-state').textContent = this.current.paused
      ? 'PAUSE'
      : 'BBE · MUNICH CONSULTING SIMULATOR';
    if (!this.current.paused) this.playMusic(0);
  }
  async warm(token) {
    if (!this.w.renderer.compileAsync) return;
    const w = this.w,
      g = this.g,
      r = this.restore;
    for (const [zone, minutes] of [
      ['city', 600],
      ['city', 1300],
      ['brewery', 600],
      ['office', 497],
    ]) {
      if (token !== this.generation) return;
      w.enter(zone);
      this.stage.visible = zone === 'city';
      this.hero.visible = this.police.visible = this.heli.visible = true;
      g.sim.s.minutes = minutes;
      g.sim.s.weather = 'Sonnig';
      g.arcade.atmosphere.update(0);
      w.scene.updateMatrixWorld(true);
      await w.renderer.compileAsync(w.scene, w.camera);
    }
    if (token !== this.generation) return;
    this.stage.visible = false;
    g.sim.s.minutes = r.minutes;
    g.sim.s.weather = r.weather;
    w.enter(r.zone);
    w.currentRestaurant = r.restaurant;
    w.teleport(r.position.x, r.position.z, r.position.y);
    w.player.visible = false;
    w.playerShadow.visible = false;
  }
  playMusic(offset) {
    const a = this.g.audio,
      b = this.buffers.get('v160_intro_theme');
    if (!a.ready || !a.enabled || !this.g.sim.s.music || !b) return;
    this.music = a.emit(b, {
      bus: 'music',
      volume: 0.9,
      offset: Math.min(offset, b.duration - 0.01),
    });
  }
  time() {
    const m = this.current;
    if (!m) return 0;
    return m.loading || m.paused
      ? m.elapsed
      : Math.min(INTRO_DURATION, m.base + (performance.now() - m.startedAt) / 1000);
  }
  pause(paused) {
    const m = this.current;
    if (!m || m.paused === paused) return;
    m.elapsed = this.time();
    m.base = m.elapsed;
    m.paused = paused;
    this.music?.stop(0.08);
    this.voice?.stop(0.06);
    this.music = this.voice = null;
    this.g.audio.cinematicVoice = false;
    if (!paused && !m.loading) {
      m.startedAt = performance.now();
      this.playMusic(m.elapsed);
      m.heard.delete(this.activeVoice);
    }
    document.getElementById('intro-pause').textContent = paused ? 'Weiter' : 'Pause';
    document.getElementById('intro-state').textContent = paused
      ? 'PAUSE'
      : m.loading
        ? 'Bild und Ton werden vorbereitet …'
        : 'BBE · MUNICH CONSULTING SIMULATOR';
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    m.elapsed = this.time();
    const t = m.elapsed;
    const index = INTRO_SHOTS.findIndex((s) => t >= s.at && t < s.end),
      shot = INTRO_SHOTS[index];
    if (shot && index !== m.shot) {
      m.shot = index;
      this.w.enter(shot.zone);
      this.w.teleport(...shot.anchor);
      this.w.player.visible = false;
      this.w.playerShadow.visible = false;
      this.g.sim.s.minutes = shot.minutes;
      this.g.sim.s.weather = shot.rain ? 'Regen' : 'Sonnig';
      const weather = this.g.arcade.immersion.weather;
      weather.cloud = shot.rain ? 1 : 0;
      weather.wet = shot.rain ? 0.85 : 0;
      this.w.shadowZone = null;
      document.getElementById('intro-title').textContent = shot.title;
      document.getElementById('intro-sub').textContent = shot.sub;
    }
    document.querySelector('.intro-logo')?.classList.toggle('gone', t >= 15.96);
    this.stage.visible = !!shot?.stage;
    this.hero.visible = shot?.stage === 'car';
    this.police.visible = shot?.stage === 'police';
    this.heli.visible = shot?.stage === 'heli';
    if (shot?.stage) {
      const animationStep = m.paused || m.loading ? 0 : dt;
      const u = (t - shot.at) / (shot.end - shot.at);
      if (shot.stage === 'car') {
        this.hero.position.set(65 + u * 25, 0, 41.7);
        this.hero.rotation.y = Math.PI / 2;
        animateVehicleWheels({ mesh: this.hero }, 8, animationStep);
      }
      if (shot.stage === 'police') {
        this.police.position.set(91 - u * 27, 0, 38);
        this.police.rotation.y = -Math.PI / 2;
        animateVehicleWheels({ mesh: this.police }, 7, animationStep);
        this.beacons.forEach((b, i) => (b.visible = Math.sin(t * 20 + i * Math.PI) > 0));
      }
      if (shot.stage === 'heli') {
        this.heli.position.set(112 + u * 37, 16 + Math.sin(u * Math.PI) * 2, 38);
        this.heli.rotation.set(0.03, Math.PI / 2, -0.06);
        this.heli.userData.mainRotor.rotation.y = t * 42;
        this.heli.userData.tailRotor.rotation.x = t * 57;
      }
    }
    if (shot?.blast && t > shot.at + 2.6 && !m.blasts.has(index) && !m.paused) {
      m.blasts.add(index);
      this.g.extras.fire.explode(new THREE.Vector3(...shot.blast), null, true);
    }
    if (!m.paused && !m.loading)
      for (const cue of this.lines) {
        if (t >= cue.start && t < cue.end && !m.heard.has(cue.id)) {
          m.heard.add(cue.id);
          this.activeVoice = cue.id;
          this.voice?.stop(0.04);
          const a = this.g.audio;
          if (a.enabled)
            this.voice = a.emit(this.buffers.get('voice_' + cue.id), {
              bus: 'dialogue',
              volume: 1,
              offset: Math.max(0, t - cue.start),
            });
          document.getElementById('intro-voice').textContent =
            this.g.sim.s.audioSubtitles === false ? '' : cue.line.text;
          this.voiceUntil = cue.end;
        }
      }
    this.g.audio.cinematicVoice = !m.paused && t < (this.voiceUntil || 0);
    if (t > (this.voiceUntil || 0)) document.getElementById('intro-voice').textContent = '';
    const fraction = shot ? (t - shot.at) / (shot.end - shot.at) : 0,
      fade = shot ? Math.max(0, 1 - fraction * 16, (fraction - 0.93) * 14) : 1;
    document.getElementById('intro-fade').style.opacity = String(
      t < 15.96 ? 0 : Math.min(0.9, fade),
    );
    document.getElementById('intro-progress').style.transform =
      'scaleX(' + Math.min(1, t / INTRO_DURATION) + ')';
    const step = m.paused || m.loading ? 0 : Math.min(dt, 0.08);
    this.g.extras.fire.update(step, true);
    this.w.update(step, true);
    if (t >= INTRO_DURATION) this.finish();
  }
  camera() {
    const m = this.current,
      s = INTRO_SHOTS[m?.shot];
    if (!s) return;
    const u = THREE.MathUtils.smoothstep(m.elapsed, s.at, s.end);
    this.w.camera.position.fromArray(s.from).lerp(this.end.fromArray(s.to), u);
    if (s.stage === 'car') this.w.camera.lookAt(this.hero.position.x, 1.1, 41.7);
    else if (s.stage === 'police') this.w.camera.lookAt(this.police.position.x, 1.1, 38);
    else if (s.stage === 'heli') this.w.camera.lookAt(this.heli.position);
    else this.w.camera.lookAt(...s.look);
    this.w.camera.updateMatrixWorld();
  }
  restoreState() {
    const r = this.restore;
    if (!r) return;
    Object.assign(this.g.sim.s, structuredClone(r.state));
    this.g.sim.save = r.save;
    const weather = this.g.arcade.immersion.weather;
    weather.wet = r.wet;
    weather.cloud = r.cloud;
  }
  finish() {
    if (!this.current) return;
    this.generation++;
    this.music?.stop(0.15);
    this.voice?.stop(0.1);
    this.music = this.voice = null;
    this.current = null;
    this.stage.visible = false;
    this.g.audio.cinematicMix = this.g.audio.cinematicVoice = false;
    const r = this.restore,
      w = this.w;
    this.restoreState();
    w.enter(r.zone, r.restaurant?.id);
    w.currentRestaurant = r.restaurant;
    w.teleport(r.position.x, r.position.z, r.position.y);
    Object.assign(w, {
      yaw: r.yaw,
      pitch: r.pitch,
      distance: r.distance,
      pose: r.pose,
      time: r.worldTime,
    });
    w.player.visible = r.playerVisible;
    w.playerShadow.visible = r.shadowVisible;
    w.shadowZone = null;
    this.g.extras.fire.particles.length = 0;
    this.g.extras.fire.geometry.setDrawRange(0, 0);
    document.body.classList.remove('world-intro');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    w.pose = r.pose;
    document.getElementById('start-game')?.focus();
  }
}
