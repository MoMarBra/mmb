import * as THREE from 'three';
import { IntroStage } from './intro-stage.js';
import { IntroPerformance } from './intro-performance.js';
export const INTRO_DURATION = 60;
export const INTRO_MUSIC = 'intro_theme_1_6_1';
// A sixty-second edit: original camera paths, tighter cuts, and retimed action cues.
export const INTRO_SHOTS = [
  {
    at: 0,
    end: 4.5,
    zone: 'city',
    anchor: [131, 29],
    from: [80, 39, 84],
    to: [113, 24, 51],
    look: [131, 5, 14],
    minutes: 525,
    crowd: 'square',
    title: 'MÜNCHEN',
    sub: 'Große Pläne. Sehr kleine Zeitpuffer.',
  },
  {
    at: 4.5,
    end: 8.5,
    zone: 'city',
    anchor: [31, 45],
    from: [61, 15, 24],
    to: [28, 5, 32],
    look: [40, 7, 56],
    minutes: 590,
    crowd: 'hq',
    title: 'BRIENNER STRASSE 45',
    sub: 'Dein Büro. Dein Business Case.',
  },
  {
    at: 8.5,
    end: 12.5,
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
    at: 12.5,
    end: 17,
    zone: 'city',
    anchor: [0, 27],
    from: [-3, 5, 50],
    to: [4, 3, 8],
    look: [-17, 3, 27],
    minutes: 750,
    crowd: 'augusten',
    title: 'AUGUSTENSTRASSE',
    sub: 'Benchmarks. Burritos. Budgetabweichungen.',
  },
  {
    at: 17,
    end: 23,
    zone: 'city',
    anchor: [8, 88],
    from: [-3, 3, 103],
    to: [3, 2.5, 79],
    look: [17.4, 2.5, 88],
    minutes: 810,
    crowd: 'dogtown',
    title: 'DOGTOWN',
    sub: 'Diese Schärfe steht in keinem Risikoregister.',
    bursts: [
      { at: 1.4, position: [6, 0.2, 92] },
      { at: 3, position: [-2, 0.2, 86] },
      { at: 4.5, position: [3, 0.2, 99] },
    ],
  },
  {
    at: 23,
    end: 26.5,
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
    at: 26.5,
    end: 30,
    zone: 'city',
    anchor: [68, 41],
    from: [77, 1.6, 35],
    to: [99, 2, 35],
    look: [72, 1, 41],
    minutes: 1020,
    crowd: 'chase',
    title: 'DIE DEADLINE IM RÜCKSPIEGEL',
    sub: 'Drei Streifenwagen. Ein offener To-do-Punkt.',
    stage: 'car',
  },
  {
    at: 30,
    end: 33.5,
    zone: 'city',
    anchor: [131, 29],
    from: [111, 24, 58],
    to: [142, 28, 58],
    look: [130, 17, 36],
    minutes: 1090,
    crowd: 'square',
    title: 'BBE AIR',
    sub: 'Für die wirklich übergeordnete Perspektive.',
    stage: 'heli',
  },
  {
    at: 33.5,
    end: 38,
    zone: 'city',
    anchor: [67, 37],
    from: [93, 2, 31],
    to: [61, 2.2, 32],
    look: [77, 1, 37],
    minutes: 1160,
    crowd: 'chase',
    title: 'EXTERNES CONTROLLING',
    sub: 'Die Polizei bittet um eine kurze Abstimmung.',
    stage: 'police',
    bursts: [
      { at: 1.2, position: [99, 0.2, 40] },
      { at: 3, position: [71, 0.2, 40] },
    ],
  },
  {
    at: 38,
    end: 41,
    zone: 'city',
    anchor: [131, 29],
    from: [105, 14, 43],
    to: [140, 12, 48],
    look: [131, 4, 12],
    minutes: 1125,
    crowd: 'square',
    title: 'KÖNIGSPLATZ',
    sub: 'Große Kulisse. Kleine Deadline.',
  },
  {
    at: 41,
    end: 44,
    zone: 'city',
    anchor: [280, 249],
    from: [251, 23, 284],
    to: [294, 32, 286],
    look: [280, 23, 240],
    minutes: 1160,
    crowd: 'church',
    title: 'FRAUENKIRCHE',
    sub: 'Die Türme stehen. Die Deadline auch.',
  },
  {
    at: 44,
    end: 47.5,
    zone: 'city',
    anchor: [368, 290],
    from: [337, 10, 285],
    to: [391, 17, 298],
    look: [367, 12, 318],
    minutes: 1300,
    crowd: 'marien',
    title: 'NACH DER LETZTEN FOLIE',
    sub: 'München schläft. Outlook arbeitet weiter.',
  },
  {
    at: 47.5,
    end: 53.5,
    zone: 'city',
    anchor: [0, 40],
    from: [5, 5, 84],
    to: [5, 3.8, 24],
    look: [-17, 5, 25],
    minutes: 1280,
    rain: true,
    stage: 'rain-chase',
    bursts: [{ at: 3.5, position: [0, 0.2, 51] }],
    crowd: 'augusten',
    title: 'REGEN IM RISIKOSZENARIO',
    sub: 'Nasse Straße. Heiße Eskalation.',
  },
  {
    at: 53.5,
    end: 56.5,
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
    at: 56.5,
    end: INTRO_DURATION,
    zone: 'city',
    anchor: [31, 45],
    from: [49, 9, 26],
    to: [49, 20, 24],
    look: [40, 6, 56],
    minutes: 570,
    crowd: 'hq',
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
        if (e.code === 'Space' && this.skipKeyHeld) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (!this.current) return;
        // Space always skips, even while warming or when a toolbar button has focus.
        if (e.code === 'Space') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.skipKeyHeld = true;
          if (!e.repeat) this.finish();
          return;
        }
        if (e.code === 'Tab' || (e.code === 'Enter' && e.target.closest?.('button'))) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (e.code === 'Escape') this.pause(!this.current.paused);
        if (e.code === 'Enter') this.finish();
      },
      true,
    );
    // A held skip key must never activate the newly focused main-menu button on keyup.
    window.addEventListener(
      'keyup',
      (e) => {
        if (e.code !== 'Space' || !this.skipKeyHeld) return;
        this.skipKeyHeld = false;
        this.w.keys.delete('Space');
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
    window.addEventListener('blur', () => {
      this.skipKeyHeld = false;
      this.w.keys.delete('Space');
    });
    document.addEventListener('visibilitychange', () => {
      if (this.current && document.hidden) this.pause(true);
    });
    // The normal save handler is registered later by Game.bind().
    window.addEventListener('beforeunload', () => {
      if (this.current) this.restoreState();
    });
  }
  makeStage() {
    if (this.action) return;
    this.action = new IntroStage(this.g);
    this.stage = this.action.root;
    this.hero = this.action.hero;
    this.police = this.action.police[0].mesh;
    this.heli = this.action.heli;
  }
  async play({ automatic = false } = {}) {
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
      pixelRatio: w.renderer.getPixelRatio?.() || 1,
      exposure: w.renderer.toneMappingExposure,
      environment: w.scene.environmentIntensity,
      skyLightColor: w.ambient.color.clone(),
      groundLightColor: w.ambient.groundColor.clone(),
      fillColor: w.fill.color.clone(),
      state: structuredClone(g.sim.s),
      save: g.sim.save,
    };
    g.sim.save = () => true;
    const token = ++this.generation;
    this.current = {
      automatic,
      elapsed: 0,
      base: 0,
      startedAt: 0,
      paused: !!document.hidden,
      loading: true,
      shot: -1,
      blasts: new Set(),
    };
    g.audio.introMix = { enabled: true, volume: 0.7 };
    this.soundError = false;
    this.resumeAudio();
    g.audio.applyMix?.();
    g.audio.voices.stop();
    g.audio.cinematicMix = true;
    g.audio.cinematicVoice = false;
    this.makeStage();
    this.action.capture();
    // Native-resolution antialiasing; avoid rendering high-DPI pixels hidden by letterboxing.
    this.performance = new IntroPerformance(w);
    this.performance.begin();
    g.open(
      'Intro',
      `<div class="world-intro-frame"><div class="intro-location"><small id="intro-sub"></small><h1 id="intro-title"></h1></div><div class="intro-toolbar"><span id="intro-state" role="status"></span><button id="intro-sound" aria-label="Intro-Ton ausschalten" aria-pressed="true">Ton an</button><button id="intro-pause">Pause</button><button id="intro-exit" aria-keyshortcuts="Space" aria-label="Intro überspringen und Hauptmenü öffnen">Leertaste · Hauptmenü</button></div><div class="intro-progress"><i id="intro-progress"></i></div><div id="intro-fade" aria-hidden="true"></div></div>`,
      { pause: true, locked: true },
    );
    document.body.classList.add('world-intro', 'intro-loading');
    w.player.visible = false;
    w.playerShadow.visible = false;
    document.getElementById('intro-sound').onclick = () => this.toggleSound();
    document.getElementById('intro-pause').onclick = () => this.pause(!this.current.paused);
    document.getElementById('intro-exit').onclick = () => this.finish();
    this.buffers = new Map();
    this.effects = [];
    const ids = [
      INTRO_MUSIC,
      'v160_explosion_01',
      'v160_explosion_02',
      'v160_explosion_03',
      'aaa_police_siren',
      'engine_loop',
    ];
    const audioReady = Promise.all(
      ids.map(async (id) => {
        try {
          const b = await g.audio.bank?.get(id);
          if (token === this.generation && b) {
            this.buffers.set(id, b);
            // Slow audio must not hold the picture on a loading screen.
            if (id === INTRO_MUSIC && this.current && !this.current.loading && !this.current.paused)
              this.playMusic(this.time());
          }
        } catch {
          /* The film and its controls also work with muted/unavailable audio. */
        }
      }),
    );
    // Warm graphics and decode audio concurrently. Never await autoplay permission.
    this.audioReady = audioReady;
    if (token !== this.generation || !this.current) return;
    try {
      await this.warm(token);
    } catch {}
    if (token !== this.generation || !this.current) return;
    this.current.shot = -1;
    this.current.loading = false;
    this.current.startedAt = performance.now();
    // Set the first city camera before exposing the canvas or starting the score.
    this.render(0);
    document.body.classList.remove('intro-loading');
    document.getElementById('intro-state').textContent = this.current.paused ? 'PAUSE' : '';
    document.getElementById('intro-pause').textContent = this.current.paused ? 'Weiter' : 'Pause';
    if (!this.current.paused) this.playMusic(0);
    this.updateSoundButton();
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
      this.action.warm();
      this.stage.visible = zone === 'city';
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
  resumeAudio() {
    const m = this.current,
      a = this.g.audio;
    // Called synchronously from Intro/Weiter/Ton gestures, before loading or shader awaits.
    a.start();
    const resumed = a.ctx?.resume?.();
    resumed
      ?.then(() => {
        if (this.current === m && m) {
          if (
            a.ctx?.state === 'running' &&
            !m.loading &&
            !m.paused &&
            a.introMix?.enabled &&
            !this.music
          )
            this.playMusic(this.time());
          this.updateSoundButton();
        }
      })
      .catch(() => {
        if (this.current === m) this.updateSoundButton();
      });
  }
  updateSoundButton() {
    const button = document.getElementById('intro-sound');
    if (!this.current || !button) return;
    const a = this.g.audio,
      enabled = !!a.introMix?.enabled;
    const blocked = !!a.ctx?.state && a.ctx.state !== 'running';
    const retry = enabled && (this.soundError || blocked || !a.ready);
    button.textContent = retry ? 'Ton starten' : enabled ? 'Ton an' : 'Ton aus';
    button.setAttribute('aria-pressed', String(enabled && !retry));
    button.setAttribute(
      'aria-label',
      retry
        ? 'Intro-Ton erneut starten'
        : enabled
          ? 'Intro-Ton ausschalten'
          : 'Intro-Ton einschalten',
    );
    button.title = retry
      ? 'Klicken, um die Musik zu laden und den Ton freizugeben.'
      : 'Gilt nur für dieses Intro';
  }
  async toggleSound() {
    const m = this.current,
      a = this.g.audio;
    if (!m) return;
    const blocked = !!a.ctx?.state && a.ctx.state !== 'running';
    const retry = this.soundError || blocked || !a.ready;
    a.introMix.enabled = !a.introMix.enabled || retry;
    this.music?.stop(0.08);
    this.music = null;
    this.stopActionAudio();
    this.stopEffects();
    if (a.introMix.enabled) this.resumeAudio();
    a.applyMix?.();
    this.updateSoundButton();
    if (!a.introMix.enabled || m.loading || m.paused) return;
    if (!this.buffers.get(INTRO_MUSIC)) {
      a.bank?.failures?.delete(INTRO_MUSIC);
      const buffer = await a.bank?.get(INTRO_MUSIC);
      if (this.current !== m) return;
      if (buffer) this.buffers.set(INTRO_MUSIC, buffer);
    }
    if (this.current === m && !m.paused && a.introMix.enabled) this.playMusic(this.time());
  }
  playMusic(offset) {
    const a = this.g.audio,
      b = this.buffers.get(INTRO_MUSIC);
    if (!a.introMix?.enabled) return;
    if (a.ctx?.state && a.ctx.state !== 'running') {
      this.updateSoundButton();
      return;
    }
    if (!a.ready || !b) {
      this.soundError = true;
      this.updateSoundButton();
      return;
    }
    this.music?.stop(0.04);
    this.music = a.emit(b, {
      bus: 'music',
      volume: 0.9,
      fade: 0.025,
      offset: Math.min(offset, b.duration - 0.01),
    });
    this.soundError = !this.music;
    this.startActionAudio();
    this.updateSoundButton();
  }
  stopEffects() {
    for (const handle of this.effects || []) handle?.stop(0.08);
    this.effects = [];
  }
  stopActionAudio() {
    for (const handle of this.actionAudio || []) handle?.stop(0.12);
    this.actionAudio = [];
  }
  startActionAudio() {
    this.stopActionAudio();
    if (!this.current || this.current.paused || !this.g.audio.introMix?.enabled) return;
    const shot = INTRO_SHOTS[this.current.shot];
    if (!shot?.stage) return;
    for (const [id, volume] of [
      ['aaa_police_siren', 0.14],
      ['engine_loop', 0.17],
    ]) {
      const buffer = this.buffers.get(id);
      if (buffer)
        this.actionAudio.push(
          this.g.audio.emit(buffer, { bus: 'music', loop: true, volume, fade: 0.12 }),
        );
    }
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
    this.stopActionAudio();
    this.stopEffects();
    this.music?.stop(0.08);
    this.music = null;
    this.g.audio.cinematicVoice = false;
    if (!paused) this.resumeAudio();
    if (!paused && !m.loading) {
      m.startedAt = performance.now();
      this.playMusic(m.elapsed);
    }
    document.getElementById('intro-pause').textContent = paused ? 'Weiter' : 'Pause';
    document.getElementById('intro-state').textContent = paused ? 'PAUSE' : '';
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    // Shader warm-up owns the scene until it completes. Do not select a shot early.
    if (m.loading) return;
    m.elapsed = this.time();
    const t = m.elapsed;
    // Fade the supplied score into the menu rather than cutting it mid-phrase.
    const volume = 0.7 * THREE.MathUtils.clamp((INTRO_DURATION - t) / 1.5, 0, 1);
    if (this.g.audio.introMix) this.g.audio.introMix.volume = volume;
    const index = INTRO_SHOTS.findIndex((s) => t >= s.at && t < s.end),
      shot = INTRO_SHOTS[index];
    if (shot && index !== m.shot) {
      m.shot = index;
      this.performance.cut();
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
      this.action.configure(shot);
      this.startActionAudio();
    }
    const step = m.paused || m.loading ? 0 : Math.min(dt, 0.08);
    this.action.update(t, step);
    if (shot && !m.paused)
      for (const [i, burst] of (shot.bursts || []).entries()) {
        const key = index + ':' + i;
        if (t >= shot.at + burst.at && !m.blasts.has(key)) {
          m.blasts.add(key);
          this.g.extras.fire.explode(new THREE.Vector3(...burst.position), null, true);
          this.action.burst(burst.position, t);
          const sound = this.buffers.get('v160_explosion_' + String(1 + (i % 3)).padStart(2, '0'));
          if (sound && this.g.audio.introMix?.enabled && this.g.audio.ctx?.state === 'running')
            this.effects.push(this.g.audio.emit(sound, { bus: 'music', volume: 0.48 }));
        }
      }
    const fraction = shot ? (t - shot.at) / (shot.end - shot.at) : 0,
      fade = shot ? Math.max(0, 1 - fraction * 16, (fraction - 0.93) * 14) : 1;
    document.getElementById('intro-fade').style.opacity = String(Math.min(1, fade));
    document.getElementById('intro-progress').style.transform =
      'scaleX(' + Math.min(1, t / INTRO_DURATION) + ')';
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
    if (s.stage) this.w.camera.lookAt(this.action.focus);
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
    this.stopActionAudio();
    this.stopEffects();
    this.music?.stop(0.15);
    this.music = null;
    this.current = null;
    this.action.hide();
    this.g.audio.cinematicMix = this.g.audio.cinematicVoice = false;
    this.g.audio.introMix = null;
    this.g.audio.applyMix?.();
    const r = this.restore,
      w = this.w;
    this.restoreState();
    this.performance.end(r.pixelRatio);
    w.renderer.toneMappingExposure = r.exposure;
    w.scene.environmentIntensity = r.environment;
    w.ambient.color.copy(r.skyLightColor);
    w.ambient.groundColor.copy(r.groundLightColor);
    w.fill.color.copy(r.fillColor);
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
    document.body.classList.remove('world-intro', 'intro-loading');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    w.pose = r.pose;
    document.getElementById('start-intro')?.blur?.();
    document.getElementById('welcome')?.focus();
  }
}
