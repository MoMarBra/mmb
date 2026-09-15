import { updateGarageAudio } from './garage-audio.js';
import { LOOP_REQUEST_METHODS } from './audio-loop-requests.js';
import { AudioBank } from './audio-bank.js';
import { AUDIO_ASSETS } from './audio-catalog.js';
import { ROOMS, SOURCES, SFX, roomFor } from './audio-profiles.js';
import { DialogueDirector } from './dialogue.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
const set = (param, value, time, fade = 0.12) => param.setTargetAtTime(value, time, fade);
const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y ?? 1, p.z]);
const volumeKeys = {
  effects: 'audioEffects',
  ambience: 'audioAmbience',
  dialogue: 'audioDialogue',
  ui: 'audioUI',
  music: 'musicVolume',
};

export class Soundscape {
  constructor(sim) {
    this.sim = sim;
    this.enabled = sim?.s.audioEnabled !== false;
    this.ready = false;
    this.active = false;
    this.time = 0;
    this.epoch = 0;
    this.sources = new Set();
    this.loops = new Map();
    this.variants = new Map();
    this.walkers = new WeakMap();
    this.voices = new DialogueDirector(this);
    this.nextAmbient = 2;
    this.steps = 0;
    this.engineSpeed = null;
    this.flow = false;
    this.errors = [];
  }
  start() {
    if (this.ready) {
      if (!this.introMix) this.preloadGame();
      this.ctx.resume().catch(() => {});
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
      });
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.8;
      this.compressor = c.createDynamicsCompressor();
      this.compressor.threshold.value = -10;
      this.compressor.knee.value = 9;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.22;
      this.output = c.createGain();
      this.meter = c.createAnalyser();
      this.meter.fftSize = 256;
      this.master
        .connect(this.compressor)
        .connect(this.output)
        .connect(this.meter)
        .connect(c.destination);
      this.sceneGate = c.createGain();
      this.sceneGate.connect(this.master);
      this.buses = {};
      for (const bus of Object.keys(volumeKeys)) {
        const g = c.createGain();
        g.connect(['ambience', 'effects'].includes(bus) ? this.sceneGate : this.master);
        this.buses[bus] = g;
      }
      this.wetSend = c.createGain();
      this.wetSend.gain.value = 0.1;
      this.reverb = c.createConvolver();
      this.reverb.buffer = this.impulse();
      this.buses.effects.connect(this.wetSend);
      this.buses.dialogue.connect(this.wetSend);
      this.wetSend.connect(this.reverb).connect(this.sceneGate);
      this.noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      const data = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = 0.92 * last + 0.08 * (Math.random() * 2 - 1);
        data[i] = last * 3;
      }
      this.rotorNoise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const rotor = this.rotorNoise.getChannelData(0);
      for (let i = 0; i < rotor.length; i++) {
        const t = i / c.sampleRate,
          blade = 0.3 + 0.7 * Math.pow((1 + Math.sin(t * Math.PI * 24)) / 2, 5);
        rotor[i] =
          (Math.sin(t * Math.PI * 140) * 0.23 +
            Math.sin(t * Math.PI * 280) * 0.12 +
            (Math.random() * 2 - 1) * 0.25) *
          blade;
      }
      this.bank = new AudioBank(c);
      this.ready = true;
      document.addEventListener('keydown', (e) => {
        if (
          !this.enabled ||
          !this.active ||
          e.repeat ||
          e.key.length !== 1 ||
          !e.target.matches?.(
            'input[type="text"],input[type="number"],textarea,[contenteditable="true"]',
          )
        )
          return;
        if (this.ctx.currentTime < (this.keyAt || 0)) return;
        this.keyAt = this.ctx.currentTime + 0.065;
        this.sample('keyboard_key_' + (1 + Math.floor(Math.random() * 8)), {
          bus: 'ui',
          volume: 0.2,
        });
      });
      document.addEventListener('click', (e) => {
        if (e.target.closest?.('button') && !e.target.closest?.('.touch-controls,.touch-actions'))
          this.play('click');
      });
      this.applyMix();
      this.gamePreloads = [
        'engine_loop',
        'engine_start',
        'car_door_close',
        'traffic',
        'rain',
        'toilet_01',
        'typing_01',
        ...Object.values(SFX)
          .flat()
          .filter((id) => !id.startsWith('voice_')),
      ];
      if (!this.introMix) this.preloadGame();
      c.resume().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.voices.stop();
          c.suspend().catch(() => {});
        } else c.resume().catch(() => {});
      });
    } catch (error) {
      this.enabled = false;
      this.errors.push(String(error.message));
    }
  }
  preloadGame() {
    if (!this.bank || this.gamePreloaded) return;
    this.gamePreloaded = true;
    this.bank.preload([...new Set(this.gamePreloads || [])].filter((id) => AUDIO_ASSETS[id]));
  }
  impulse() {
    const c = this.ctx,
      length = Math.floor(c.sampleRate * 1.45),
      b = c.createBuffer(2, length, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        smooth = 0.5 * smooth + 0.5 * (Math.random() * 2 - 1);
        d[i] = smooth * Math.exp(-i / (length * 0.15)) * 0.32;
      }
      for (const t of [0.019, 0.037, 0.061, 0.083])
        d[Math.floor((t + ch * 0.002) * c.sampleRate)] += 0.3;
    }
    return b;
  }
  applyMix() {
    if (!this.ready) return;
    const s = this.sim?.s || {},
      t = this.ctx.currentTime,
      intro = this.introMix;
    // Explicit film playback has its own temporary mix, independent of saved game/radio mute.
    set(
      this.output.gain,
      intro ? (intro.enabled ? 0.8 : 0) : this.enabled ? clamp(s.audioMaster ?? 0.8) : 0,
      t,
    );
    for (const [bus, key] of Object.entries(volumeKeys))
      set(
        this.buses[bus].gain,
        clamp(intro && bus === 'music' ? intro.volume : (s[key] ?? (bus === 'music' ? 0.4 : 0.8))) *
          (this.voices.current || this.cinematicVoice
            ? bus === 'music'
              ? 0.35
              : bus === 'ambience'
                ? 0.72
                : 1
            : 1),
        t,
      );
    const quiet = s.audioRange === 'night';
    set(this.compressor.threshold, quiet ? -24 : -10, t);
    set(this.compressor.ratio, quiet ? 10 : 5, t);
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.sim) {
      this.sim.s.audioEnabled = this.enabled;
      this.sim.save();
    }
    if (!this.enabled) this.voices.stop();
    this.applyMix();
    return this.enabled;
  }
  position(panner, pos) {
    const [x, y, z] = xyz(pos),
      t = this.ctx.currentTime;
    for (const [axis, value] of [
      ['X', x],
      ['Y', y],
      ['Z', z],
    ])
      set(panner['position' + axis], value, t, 0.04);
  }
  /** Every one-shot owns and disconnects its nodes. A source cap prevents crowd overload. */
  emit(buffer, opts = {}) {
    if (!this.ready || !buffer || this.sources.size >= 48) return null;
    const c = this.ctx,
      t = Math.max(c.currentTime, opts.when || 0),
      source = c.createBufferSource();
    const gain = c.createGain(),
      filter = c.createBiquadFilter();
    source.buffer = buffer;
    source.loop = !!opts.loop;
    source.playbackRate.value = clamp(opts.rate ?? 1, 0.35, 2.5);
    gain.gain.value = opts.fade ? 0 : clamp(opts.volume ?? 0.5, 0, 2);
    if (opts.fade) set(gain.gain, clamp(opts.volume ?? 0.5, 0, 2), t, opts.fade);
    filter.type = 'lowpass';
    filter.frequency.value = opts.lowpass || 18000;
    source.connect(filter).connect(gain);
    let panner = null;
    if (opts.position) {
      panner = c.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = opts.refDistance || 2;
      panner.maxDistance = 90;
      panner.rolloffFactor = 1.1;
      this.position(panner, opts.position);
      gain.connect(panner).connect(this.buses[opts.bus || 'effects']);
    } else gain.connect(this.buses[opts.bus || 'effects']);
    const handle = {
      source,
      gain,
      filter,
      panner,
      follow: opts.follow,
      bus: opts.bus || 'effects',
      stopped: false,
      stop: (fade = 0.06) => {
        if (handle.stopped) return;
        handle.stopped = true;
        set(gain.gain, 0, c.currentTime, Math.max(0.008, fade / 3));
        source.stop(c.currentTime + fade);
      },
    };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      filter.disconnect();
      panner?.disconnect();
      this.sources.delete(handle);
      opts.onEnded?.();
    };
    this.sources.add(handle);
    source.start(t, opts.offset || 0);
    if (opts.duration) source.stop(t + opts.duration);
    return handle;
  }
  async sample(id, opts = {}) {
    if (!this.ready || (!this.enabled && !opts.preview)) return null;
    const epoch = this.epoch,
      start = this.ctx.currentTime;
    const buffer = await this.bank.get(id);
    if (epoch !== this.epoch || (!opts.loop && this.ctx.currentTime - start > 1.5)) return null;
    return this.emit(buffer, opts);
  }
  variant(kind) {
    const list = SFX[kind] || [kind];
    const previous = this.variants.get(kind) ?? -1;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === previous) index = (index + 1) % list.length;
    this.variants.set(kind, index);
    return list[index];
  }
  play(kind, options = {}) {
    if (!this.ready || !this.enabled) return;
    if (SFX[kind]) {
      if (kind === 'coffee') this.sample('machine_01', { volume: 0.1, ...options });
      const volume = kind.startsWith('footstep')
        ? 0.55
        : ['crash', 'flush'].includes(kind)
          ? 0.72
          : 0.52;
      this.sample(this.variant(kind), { volume, rate: 0.97 + Math.random() * 0.06, ...options });
      if (kind === 'crash') this.sample('impactGlass_light_000', { volume: 0.22, ...options });
      return;
    }
    if (kind === 'success' || kind === 'promotion') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        this.tone(f, 0.32, 'sine', 0.1, i * 0.09, { bus: 'ui' }),
      );
    } else if (kind === 'mail' || kind === 'phone') {
      [659.25, 880].forEach((f, i) =>
        this.tone(f, 0.14, 'sine', kind === 'mail' ? 0.1 : 0.035, i * 0.15, {
          bus: kind === 'mail' ? 'ui' : 'ambience',
          ...options,
        }),
      );
    } else if (kind === 'horn') {
      [349.2, 440].forEach((f) => this.tone(f, 0.42, 'sawtooth', 0.07, 0, options));
      this.voices.nearMiss();
    } else if (kind === 'bike-bell') {
      [2400, 3190, 4760].forEach((f, i) => this.tone(f, 0.7, 'sine', 0.035 / (i + 1), 0, options));
    } else if (kind === 'bird') {
      [2300, 3100, 2600].forEach((f, i) => this.tone(f, 0.1, 'sine', 0.025, i * 0.16, options));
    } else if (kind === 'water-drip') this.tone(1700, 0.085, 'sine', 0.035, 0, options);
    else if (kind === 'gunshot') {
      this.noiseHit(0.085, 6100, 0.3, options);
      this.tone(92, 0.18, 'triangle', 0.18, 0, options);
      this.noiseHit(0.25, 600, 0.09, { ...options, reverb: true });
    } else if (kind === 'swing') this.noiseHit(0.13, 1800, 0.13, options);
    else this.tone(560, 0.045, 'sine', 0.045, 0, { bus: 'ui' });
  }
  tone(frequency = 600, duration = 0.15, type = 'sine', volume = 0.1, delay = 0, options = {}) {
    if (!this.ready || !this.enabled) return;
    const c = this.ctx,
      buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate),
      d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / c.sampleRate,
        phase = (t * frequency) % 1;
      const wave =
        type === 'sawtooth'
          ? 2 * phase - 1
          : type === 'triangle'
            ? 1 - 4 * Math.abs(phase - 0.5)
            : Math.sin(2 * Math.PI * phase);
      d[i] =
        wave *
        Math.min(1, t / 0.008) *
        Math.exp(-t / (duration * 0.25)) *
        Math.min(1, (duration - t) / 0.015);
    }
    this.emit(buffer, { volume, when: c.currentTime + delay, ...options });
  }
  noiseHit(duration = 0.1, frequency = 800, volume = 0.1, options = {}) {
    if (!this.ready || !this.enabled) return;
    const h = this.emit(this.noise, { volume, duration, lowpass: frequency, ...options });
    if (h) h.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
  }
  loop(key, id, target, options = {}) {
    let slot = this.loops.get(key);
    if (slot && slot.id !== id) {
      slot.handle?.stop(0.6);
      this.loops.delete(key);
      slot = null;
    }
    if (slot && !slot.loading && !slot.handle && this.time - slot.requested > 1) {
      this.loops.delete(key);
      slot = null;
    }
    if (!slot && target > 0.001) {
      slot = { id, target, loading: true, requested: this.time, last: this.time, handle: null };
      this.loops.set(key, slot);
      const bufferPromise =
        id === 'rotor'
          ? Promise.resolve(this.rotorNoise)
          : id === 'wind' || id === 'vent' || id === 'tires'
            ? Promise.resolve(this.noise)
            : this.bank.get(id);
      bufferPromise.then((buffer) => {
        slot.loading = false;
        if (this.loops.get(key) !== slot || slot.target <= 0.001) return;
        slot.handle = this.emit(buffer, { volume: 0, loop: true, bus: 'ambience', ...options });
      });
    }
    if (!slot) return;
    slot.target = target;
    slot.last = this.time;
    const h = slot.handle;
    if (h && !h.stopped) {
      set(h.gain.gain, target, this.ctx.currentTime, options.fade || 0.7);
      if (options.position && h.panner) this.position(h.panner, options.position);
      if (options.rate) set(h.source.playbackRate, options.rate, this.ctx.currentTime, 0.13);
      if (options.lowpass) set(h.filter.frequency, options.lowpass, this.ctx.currentTime, 0.25);
    }
  }
  engine(speed) {
    this.engineSpeed = speed;
  }
  waterFlow(enabled) {
    this.flow = enabled;
  }
  setActive(active) {
    if (!this.ready) return;
    if (this.active && !active && !this.voices.current?.preview) this.voices.stop();
    this.active = active;
    set(this.sceneGate.gain, active ? 1 : 0, this.ctx.currentTime, 0.1);
  }
  listener(world) {
    const p = world.player.position,
      cam = world.camera.position,
      l = this.ctx.listener,
      t = this.ctx.currentTime;
    const dx = p.x - cam.x,
      dz = p.z - cam.z,
      len = Math.hypot(dx, dz) || 1;
    // Ears stay on the character; direction follows the third-person camera.
    for (const [key, value] of Object.entries({
      positionX: p.x,
      positionY: (world.player.position.y || 0) + 1.65,
      positionZ: p.z,
      forwardX: dx / len,
      forwardY: 0,
      forwardZ: dz / len,
      upX: 0,
      upY: 1,
      upZ: 0,
    }))
      if (l[key]) set(l[key], value, t, 0.035);
    for (const h of this.sources)
      if (h.follow && h.panner && !h.stopped) this.position(h.panner, h.follow());
  }
  update(dt, world, active = true) {
    this.world = world;
    if (!this.ready) return;
    this.time += dt;
    // The film owns its score/sirens/explosions; avoid decoding and mixing the unseen game world.
    if (this.introMix) {
      this.setActive(false);
      this.applyMix();
      this.listener(world);
      return;
    }
    this.setActive(active);
    this.applyMix();
    this.listener(world);
    const room = roomFor(world),
      profile = ROOMS[room] || ROOMS.office;
    if (room !== this.room) {
      const oldZone = this.zone;
      this.room = room;
      this.zone = world.zone;
      this.nextAmbient = this.time + 2 + Math.random() * 2;
      this.lastPosition = null;
      if (oldZone !== this.zone) {
        this.epoch++;
        this.voices.stop();
        for (const h of this.sources)
          if (!['music', 'ui'].includes(h.bus) && !(this.cinematicMix && h.bus === 'dialogue'))
            h.stop(0.25);
        for (const [key, slot] of this.loops) {
          slot.target = 0;
          this.loops.delete(key);
        }
        if (active && !this.cinematicMix) this.voices.arrive(world);
        if (this.transitionSound) {
          this.play('door');
          this.transitionSound = false;
        }
      }
    }
    set(this.wetSend.gain, profile.reverb, this.ctx.currentTime, 0.65);
    for (const [key, slot] of this.loops) slot.target = 0;
    this.flushLoopRequests(active);
    updateGarageAudio(this, world, active);
    if (active && this.enabled) {
      for (const [id, gain] of profile.loops)
        this.loop('room-' + id, id, gain, {
          lowpass: id === 'vent' ? 480 : id === 'wind' ? 950 : profile.tone,
        });
      const rain = world.sim.s.weather === 'Regen';
      this.loop(
        'rain',
        'rain',
        rain ? (room === 'city' ? 0.27 : room === 'garage' ? 0.006 : 0.045) : 0,
        {
          lowpass: room === 'city' ? 15000 : 950,
        },
      );
      this.updateSteps(world);
      this.updateTraffic(world, rain);
      if (this.flow) this.loop('water', 'wash', 0.43, { bus: 'effects', lowpass: 6500 });
      if (world.pose === 'eat' && this.time > (this.nextBite || 0)) {
        this.nextBite = this.time + 1.5;
        this.play('dishes', { volume: 0.075 });
      }
      if (this.time > this.nextAmbient) {
        this.nextAmbient = this.time + profile.interval * (0.7 + Math.random() * 0.8);
        const kind = profile.events[Math.floor(Math.random() * profile.events.length)];
        let pos = world.zone === 'restaurant' ? [2, 1, -6] : SOURCES[kind];
        if (room === 'city') pos = [world.player.position.x + 10, 2, world.player.position.z + 8];
        this.play(kind, {
          volume: room === 'city' ? 0.11 : 0.23,
          position: pos,
          bus: 'ambience',
          lowpass: profile.tone,
        });
      }
      if (!this.cinematicMix) this.voices.update(dt, world);
    }
    for (const [key, slot] of this.loops) {
      if (!slot.target) {
        if (slot.handle && !slot.handle.stopped)
          set(slot.handle.gain.gain, 0, this.ctx.currentTime, 0.35);
        if (this.time - slot.last > 2) {
          slot.handle?.stop(0.1);
          this.loops.delete(key);
        }
      }
    }
    this.voices.tick();
  }
  updateSteps(world) {
    const p = world.player.position,
      prev = this.lastPosition;
    this.lastPosition = { x: p.x, z: p.z };
    if (prev && !world.gameplay?.vehicle && world.pose === 'walk') {
      const distance = Math.hypot(p.x - prev.x, p.z - prev.z);
      if (distance < 3) this.steps += distance;
      const stride = world.sprinting ? 1.35 : 0.88;
      if (this.steps > stride) {
        this.steps %= stride;
        this.foot = !this.foot;
        this.play('footstep-' + ROOMS[this.room].material, {
          volume: world.sprinting ? 0.55 : 0.36,
          position: [p.x + (this.foot ? 0.22 : -0.22), 0.1, p.z],
          refDistance: 2,
        });
        if (world.zone === 'city' && world.sim.s.weather === 'Regen')
          this.sample('footstep_water_00' + (this.foot ? '0' : '1'), { volume: 0.1 });
        if (world.sprinting) this.noiseHit(0.13, 1200, 0.027);
      }
    }
    let count = 0;
    for (const n of world.zoneData[world.zone].npcs) {
      const np = n.mesh.position,
        previous = this.walkers.get(n);
      const next = { x: np.x, z: np.z, distance: previous?.distance || 0 };
      this.walkers.set(n, next);
      if (
        n.down ||
        n.cycle ||
        n.pose !== 'walk' ||
        Math.hypot(p.x - np.x, p.z - np.z) > 13 ||
        count++ > 5
      )
        continue;
      if (previous)
        next.distance += Math.min(0.5, Math.hypot(np.x - previous.x, np.z - previous.z));
      if (next.distance > 0.8) {
        next.distance = 0;
        this.play('footstep-' + ROOMS[this.room].material, { volume: 0.18, position: np });
      }
    }
  }
  updateTraffic(world, rain) {
    const vehicle = world.gameplay?.vehicle,
      speed = this.engineSpeed;
    if (vehicle?.type === 'helicopter') {
      const rotor = vehicle.rotorSpeed || 0;
      this.loop('player-rotor', 'rotor', 0.04 + rotor * 0.42, {
        bus: 'effects',
        rate: 0.6 + rotor * 0.5,
        lowpass: 3400,
      });
      this.loop(
        'flight-wind',
        'wind',
        Math.min(0.13, Math.abs(world.gameplay.speed) * 0.0035 + vehicle.mesh.position.y * 0.0004),
        { bus: 'ambience', lowpass: 1800 },
      );
    }
    if (vehicle && !['bike', 'helicopter'].includes(vehicle.type) && speed !== null) {
      const v = clamp(speed),
        gear = Math.min(4, Math.floor(v * 5)),
        rev = v * 5 - gear;
      const throttle = world.keys.has('KeyW');
      this.loop('player-engine', 'engine_loop', 0.2 + v * 0.13 + (throttle ? 0.07 : 0), {
        bus: 'effects',
        rate: 0.7 + rev * 0.55 + gear * 0.07,
        lowpass: 1800 + v * 1400,
      });
      this.loop('player-tires', rain ? 'rain' : 'tires', v * (rain ? 0.22 : 0.1), {
        bus: 'effects',
        lowpass: 1200 + v * 4200,
      });
      if (world.keys.has('Space') && v > 0.3 && this.time > (this.brakeAt || 0)) {
        this.brakeAt = this.time + 0.7;
        this.noiseHit(0.38, 4600, 0.12);
      }
    }
    if (world.zone !== 'city') return;
    const p = world.player.position;
    const nearby = world.cars
      .filter(
        (c) =>
          c !== vehicle &&
          !c.parked &&
          Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 48,
      )
      .sort((a, b) => a.mesh.position.distanceToSquared(p) - b.mesh.position.distanceToSquared(p))
      .slice(0, 5);
    for (const car of nearby) {
      const cp = car.mesh.position,
        last = car.audioLast;
      const distance = Math.hypot(cp.x - p.x, cp.z - p.z);
      const relative = last
        ? clamp((last.distance - distance) / Math.max(0.01, this.time - last.time), -35, 35)
        : 0;
      const moving = last
        ? Math.hypot(cp.x - last.x, cp.z - last.z) / Math.max(0.01, this.time - last.time)
        : 0;
      car.audioLast = { distance, time: this.time, x: cp.x, z: cp.z };
      const doppler = 343 / (343 - relative);
      this.loop('car-' + car.id, 'engine_loop', car.type === 'bus' ? 0.36 : 0.22, {
        position: cp,
        refDistance: 3,
        rate: (car.type === 'bus' ? 0.6 : 0.86) * doppler * (1 + Math.min(moving, 18) / 42),
        lowpass: vehicle ? 1600 : 6000,
      });
    }
  }
  get status() {
    return {
      ready: this.ready,
      enabled: this.enabled,
      context: this.ctx?.state || 'not-started',
      room: this.room,
      sources: this.sources.size,
      loops: this.loops.size,
      dialogue: this.voices.current?.line.id || null,
      bank: this.bank?.status,
      errors: this.errors,
    };
  }
}

Object.assign(Soundscape.prototype, LOOP_REQUEST_METHODS);
