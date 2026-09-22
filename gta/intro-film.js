import * as THREE from 'three';
import { IntroStage } from './intro-stage.js';
import { TITLE_INTRO_MUSIC } from './title-music.js';
import { IntroPerformance } from './intro-performance.js';
export const INTRO_DURATION = 60;
export const INTRO_MUSIC = TITLE_INTRO_MUSIC;
export const INTRO_DAY_AT = 5;
export const INTRO_BBE_AT = 9;
// Readable night prologue, an optical impact zoom on second five, then a sixty-second montage.
export const INTRO_SHOTS = [
  {
    at: 0,
    end: INTRO_DAY_AT,
    zone: 'city',
    anchor: [131, 29],
    from: [80, 39, 84],
    to: [86, 36.272727, 78],
    look: [131, 5, 14],
    minutes: 1395,
    prologue: true,
    title: '',
  },
  {
    at: INTRO_DAY_AT,
    end: INTRO_BBE_AT,
    zone: 'city',
    anchor: [131, 29],
    from: [86, 36.272727, 78],
    to: [113, 24, 51],
    look: [131, 5, 14],
    minutes: 525,
    crowd: 'square',
    title: 'MÜNCHEN',
  },
  {
    at: INTRO_BBE_AT,
    end: 12.5,
    zone: 'city',
    anchor: [31, 45],
    from: [61, 15, 24],
    to: [28, 5, 32],
    look: [40, 7, 56],
    minutes: 590,
    crowd: 'hq',
    title: 'BRIENNER STRASSE 45',
  },
  {
    at: 12.5,
    end: 15,
    zone: 'office',
    anchor: [-7, 2],
    from: [-1, 2.7, 7],
    to: [-8, 1.9, 5],
    look: [-7.5, 1.1, 1],
    minutes: 497,
    title: 'BBE HANDELSBERATUNG',
  },
  {
    at: 15,
    end: 19,
    zone: 'city',
    anchor: [0, 27],
    from: [-3, 5, 50],
    to: [4, 3, 8],
    look: [-17, 3, 27],
    minutes: 750,
    crowd: 'augusten',
    title: 'AUGUSTENSTRASSE',
  },
  {
    at: 19,
    end: 24,
    zone: 'city',
    anchor: [8, 88],
    from: [-3, 3, 103],
    to: [3, 2.5, 79],
    look: [17.4, 2.5, 88],
    minutes: 810,
    crowd: 'dogtown',
    title: 'DOGTOWN',
  },
  {
    at: 24,
    end: 27.5,
    zone: 'brewery',
    anchor: [0, 5],
    from: [0, 2.2, 7],
    to: [-1, 1.7, -0.2],
    look: [-4, 1.8, -4],
    minutes: 1020,
    title: 'BRIENNER BRÄU',
  },
  {
    at: 27.5,
    end: 31,
    zone: 'city',
    anchor: [68, 41],
    from: [77, 1.6, 35],
    to: [99, 2, 35],
    look: [72, 1, 41],
    minutes: 1020,
    crowd: 'chase',
    title: 'DIE DEADLINE IM RÜCKSPIEGEL',
    stage: 'car',
  },
  {
    at: 31,
    end: 34,
    zone: 'city',
    anchor: [131, 29],
    from: [111, 24, 58],
    to: [142, 28, 58],
    look: [130, 17, 36],
    minutes: 1090,
    crowd: 'square',
    title: 'BBE AIR',
    stage: 'heli',
  },
  {
    at: 34,
    end: 38.5,
    zone: 'city',
    anchor: [67, 37],
    from: [93, 2, 31],
    to: [61, 2.2, 32],
    look: [77, 1, 37],
    minutes: 1160,
    crowd: 'chase',
    title: 'EXTERNES CONTROLLING',
    stage: 'police',
    bursts: [
      { at: 1.2, position: [99, 0.2, 40] },
      { at: 3, position: [71, 0.2, 40] },
    ],
  },
  {
    at: 38.5,
    end: 41,
    zone: 'city',
    anchor: [131, 29],
    from: [105, 14, 43],
    to: [140, 12, 48],
    look: [131, 4, 12],
    minutes: 1125,
    crowd: 'square',
    title: 'KÖNIGSPLATZ',
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
  },
  {
    at: 44,
    end: 47,
    zone: 'city',
    anchor: [368, 290],
    from: [337, 10, 285],
    to: [391, 17, 298],
    look: [367, 12, 318],
    minutes: 1300,
    crowd: 'marien',
    title: 'NACH DER LETZTEN FOLIE',
  },
  {
    at: 47,
    end: 53,
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
  },
  {
    at: 53,
    end: 56,
    zone: 'office',
    anchor: [-7, 2],
    from: [-2, 2.2, 8],
    to: [-7, 1.7, 4.2],
    look: [-8, 1.3, 1.7],
    minutes: 497,
    title: 'DEIN NÄCHSTER ARBEITSTAG.',
  },
  {
    at: 56,
    end: INTRO_DURATION,
    zone: 'city',
    anchor: [31, 45],
    from: [49, 9, 26],
    to: [49, 20, 24],
    look: [40, 6, 56],
    minutes: 570,
    crowd: 'hq',
    title: 'BBE · MUNICH CONSULTING SIMULATOR',
  },
];
// One timeline drives the lens and light leak: pause, replay and low frame rates stay in sync.
export function introTransition(t, reducedMotion = false) {
  if (reducedMotion) return { fov: 53, flash: 0 };
  for (let i = 1; i < INTRO_SHOTS.length; i++) {
    const cut = INTRO_SHOTS[i].at,
      hero = i === 1;
    const before = hero ? 0.65 : 0.38,
      after = hero ? 0.9 : 0.62;
    if (t < cut - before || t >= cut + after) continue;
    const weight =
      t < cut
        ? THREE.MathUtils.smootherstep(t, cut - before, cut)
        : 1 - THREE.MathUtils.smootherstep(t, cut, cut + after);
    const flash =
      THREE.MathUtils.smoothstep(t, cut - 0.07, cut) *
      (1 - THREE.MathUtils.smoothstep(t, cut, cut + (hero ? 0.22 : 0.13)));
    return { fov: 53 - (hero ? 24 : 7) * weight, flash: hero ? flash * 0.12 : 0 };
  }
  return { fov: 53, flash: 0 };
}

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
        if (!e.repeat && e.code !== 'Escape' && e.code !== 'Enter') this.unlockAudio();
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
        this.g.titleMusic?.unlock();
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
    for (const event of ['pointerdown', 'pointerup'])
      window.addEventListener(
        event,
        () => {
          if (this.current) this.unlockAudio();
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
    this.g.titleMusic?.stop();
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
      fov: w.camera.fov,
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
      ambientIntensity: w.ambient.intensity,
      fillIntensity: w.fill.intensity,
      sunIntensity: w.sun.intensity,
      background: w.scene.background.clone(),
      fogColor: w.scene.fog.color.clone(),
      fogDensity: w.scene.fog.density,
      skyTop: g.arcade.atmosphere.sky.material.uniforms.top.value.clone(),
      skyBottom: g.arcade.atmosphere.sky.material.uniforms.bottom.value.clone(),
      state: structuredClone(g.sim.s),
      save: g.sim.save,
    };
    g.sim.save = () => true;
    this.reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
      scoreAttempts: 0,
      nextScoreRetry: 0,
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
      `<div class="world-intro-frame"><div class="intro-location"><h1 id="intro-title"></h1></div><div class="intro-toolbar"><span id="intro-state" role="status"></span><button id="intro-pause">Pause</button><button id="intro-exit" aria-keyshortcuts="Space" aria-label="Intro überspringen und Hauptmenü öffnen">Leertaste · Hauptmenü</button></div><div class="intro-progress"><i id="intro-progress"></i></div><div id="intro-cut-light" aria-hidden="true"></div><div id="intro-fade" aria-hidden="true"></div></div>`,
      { pause: true, locked: true },
    );
    document.body.classList.add('world-intro', 'intro-loading', 'intro-prologue');
    document.body.classList.toggle('intro-paused', this.current.paused);
    w.player.visible = false;
    w.playerShadow.visible = false;
    document.getElementById('intro-pause').onclick = () => this.pause(!this.current.paused);
    document.getElementById('intro-exit').onclick = () => this.finish();
    this.buffers = new Map();
    this.effects = [];
    const ids = [
      'v160_explosion_01',
      'v160_explosion_02',
      'v160_explosion_03',
      'aaa_police_siren',
      'engine_loop',
    ];
    const audioReady = Promise.all([
      this.loadScore(this.current),
      ...ids.map(async (id) => {
        try {
          const b = await g.audio.bank?.get(id);
          if (token === this.generation && b) this.buffers.set(id, b);
        } catch {
          /* The film and its controls also work with muted/unavailable audio. */
        }
      }),
    ]);
    // Warm graphics and decode audio concurrently. Never await autoplay permission.
    this.audioReady = audioReady;
    if (token !== this.generation || !this.current) return;
    try {
      await Promise.all([this.warm(token), w.remasterReady]);
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
    if (!m) return;
    // Attempt autoplay immediately; normal input can unlock a browser-suspended context later.
    // Never await resume: browsers may leave that promise pending until user activation.
    a.start();
    if (a.ctx && this.audioContext !== a.ctx) {
      this.audioContext?.removeEventListener?.('statechange', this.audioStateChange);
      this.audioContext = a.ctx;
      this.audioStateChange = () => {
        if (this.current !== m) return;
        if (a.ctx.state === 'running') this.playMusic(this.time());
        else {
          const position = this.scorePosition();
          if (position !== null && !m.loading) {
            m.elapsed = m.base = Math.min(INTRO_DURATION, position);
            m.startedAt = performance.now();
          }
          this.music?.stop(0.03);
          this.music = null;
          this.stopActionAudio();
          this.stopEffects();
        }
      };
      a.ctx.addEventListener?.('statechange', this.audioStateChange);
    }
    const resumed = a.ctx?.resume?.();
    resumed
      ?.then(() => {
        if (this.current === m) this.playMusic(this.time());
      })
      .catch(() => {});
  }
  unlockAudio() {
    const m = this.current;
    if (!m) return;
    if (this.music && this.g.audio.ctx?.state === 'running') return;
    this.resumeAudio();
    if (!this.buffers?.has(INTRO_MUSIC)) this.loadScore(m, true);
    this.playMusic(this.time());
  }
  loadScore(m, retry = false) {
    if (this.current !== m || !this.g.audio.bank) return Promise.resolve();
    if (m.scoreRequest) return m.scoreRequest;
    if (this.buffers.has(INTRO_MUSIC)) return Promise.resolve();
    if (retry) this.g.audio.bank.failures?.delete(INTRO_MUSIC);
    m.scoreAttempts++;
    m.nextScoreRetry = performance.now() + 4000;
    m.scoreRequest = (async () => {
      try {
        const buffer = await this.g.audio.bank.get(INTRO_MUSIC);
        if (this.current !== m) return;
        this.soundError = !buffer;
        if (buffer) {
          this.buffers.set(INTRO_MUSIC, buffer);
          this.playMusic(this.time());
        }
      } catch {
        if (this.current === m) this.soundError = true;
      } finally {
        m.scoreRequest = null;
      }
    })();
    return m.scoreRequest;
  }
  playMusic(offset) {
    const m = this.current,
      a = this.g.audio,
      b = this.buffers?.get(INTRO_MUSIC);
    if (!m || m.loading || m.paused || offset >= INTRO_DURATION || !a.introMix?.enabled) return;
    if (!a.ready || a.ctx?.state !== 'running' || !b || this.music) return;
    const contextTime = a.ctx.currentTime;
    this.music = a.emit(b, {
      bus: 'music',
      volume: 0.9,
      fade: 0.025,
      offset: Math.min(offset, b.duration - 0.01),
    });
    this.soundError = !this.music;
    if (this.music) {
      this.musicClock = {
        contextTime: this.music.startedAt ?? contextTime,
        offset: Math.min(offset, b.duration - 0.01),
      };
      this.startActionAudio();
    }
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
    if (
      !this.current ||
      this.current.loading ||
      this.current.paused ||
      !this.g.audio.introMix?.enabled ||
      this.g.audio.ctx?.state !== 'running'
    )
      return;
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
  scorePosition() {
    const clock = this.musicClock;
    return this.music && clock
      ? Math.max(0, clock.offset + this.g.audio.ctx.currentTime - clock.contextTime)
      : null;
  }
  time() {
    const m = this.current;
    if (!m) return 0;
    return m.loading || m.paused
      ? m.elapsed
      : Math.min(
          INTRO_DURATION,
          this.scorePosition() ?? m.base + (performance.now() - m.startedAt) / 1000,
        );
  }
  pause(paused) {
    const m = this.current;
    if (!m || m.paused === paused) return;
    m.elapsed = this.time();
    m.base = m.elapsed;
    m.paused = paused;
    if (!paused && !m.loading) m.startedAt = performance.now();
    document.body.classList.toggle('intro-paused', paused);
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
    // A bounded, silent retry recovers a transient media failure without a sound-settings UI.
    if (
      !m.paused &&
      !this.buffers.has(INTRO_MUSIC) &&
      m.scoreAttempts < 3 &&
      performance.now() >= m.nextScoreRetry
    )
      this.loadScore(m, true);
    if (!m.paused && !this.music) this.playMusic(t);
    // Only the picture fades at second 60; the same score source continues into the title screen.
    if (this.g.audio.introMix) this.g.audio.introMix.volume = 0.7;
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
    // A continuous optical zoom hides each cut without blurring or resampling the canvas.
    const fade = shot?.prologue
      ? 1 - THREE.MathUtils.smoothstep(t, 0.45, 1.55)
      : THREE.MathUtils.smoothstep(t, INTRO_DURATION - 1.25, INTRO_DURATION);
    document.getElementById('intro-fade').style.opacity = String(fade);
    document.getElementById('intro-cut-light').style.opacity = String(
      introTransition(t, this.reducedMotion).flash,
    );
    const age = shot ? t - shot.at : 0,
      duration = shot ? shot.end - shot.at : 0;
    const titleOpacity =
      shot?.title && !shot.prologue
        ? THREE.MathUtils.smoothstep(age, 0.35, 0.85) *
          (1 - THREE.MathUtils.smoothstep(age, duration - 0.7, duration - 0.25))
        : 0;
    const title = document.getElementById('intro-title');
    title.style.opacity = String(titleOpacity);
    title.style.transform = 'translateY(' + (1 - titleOpacity) * 8 + 'px)';
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
    const lens = introTransition(m.elapsed, this.reducedMotion);
    if (Math.abs(this.w.camera.fov - lens.fov) > 0.00001) {
      this.w.camera.fov = lens.fov;
      this.w.camera.updateProjectionMatrix();
    }
    const u = THREE.MathUtils.smootherstep(m.elapsed, s.at, s.end);
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
    const tail = {
      handle: this.music,
      buffer: this.buffers?.get(INTRO_MUSIC),
      offset: this.scorePosition() ?? this.time(),
      clock: this.musicClock,
    };
    this.generation++;
    this.stopActionAudio();
    this.stopEffects();
    this.music = null;
    this.musicClock = null;
    this.current = null;
    this.audioContext?.removeEventListener?.('statechange', this.audioStateChange);
    this.audioContext = null;
    this.audioStateChange = null;
    this.action.hide();
    this.g.audio.cinematicMix = this.g.audio.cinematicVoice = false;
    this.g.audio.introMix = null;
    if (this.g.titleMusic) this.g.titleMusic.adopt(tail);
    else tail.handle?.stop(0.15);
    this.buffers?.clear();
    this.g.audio.applyMix?.();
    const r = this.restore,
      w = this.w;
    this.restoreState();
    this.performance.end(r.pixelRatio);
    w.camera.fov = r.fov;
    w.camera.updateProjectionMatrix();
    if (w.ssao) {
      w.ssao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(w.camera.projectionMatrix);
      w.ssao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(
        w.camera.projectionMatrixInverse,
      );
    }
    w.renderer.toneMappingExposure = r.exposure;
    w.scene.environmentIntensity = r.environment;
    w.ambient.color.copy(r.skyLightColor);
    w.ambient.groundColor.copy(r.groundLightColor);
    w.fill.color.copy(r.fillColor);
    w.ambient.intensity = r.ambientIntensity;
    w.fill.intensity = r.fillIntensity;
    w.sun.intensity = r.sunIntensity;
    w.scene.background.copy(r.background);
    w.scene.fog.color.copy(r.fogColor);
    w.scene.fog.density = r.fogDensity;
    this.g.arcade.atmosphere.sky.material.uniforms.top.value.copy(r.skyTop);
    this.g.arcade.atmosphere.sky.material.uniforms.bottom.value.copy(r.skyBottom);
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
    document.body.classList.remove(
      'world-intro',
      'intro-loading',
      'intro-prologue',
      'intro-paused',
    );
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    w.pose = r.pose;
    document.getElementById('start-intro')?.blur?.();
    document.getElementById('welcome')?.focus();
  }
}
