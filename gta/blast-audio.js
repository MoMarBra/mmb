/** Original BBE Blast score and effects. Uses the existing Soundscape context/mixer only. */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
const note = (n) => 440 * 2 ** ((n - 69) / 12);
const MAX_VOICES = 24;
const MAX_PENDING = 64;
const LOOKAHEAD = 0.12;
const STEP_SECONDS = 60 / 96 / 4;
const ROOTS = [48, 44, 51, 46]; // C minor — A-flat — E-flat — B-flat, original four-bar phrase.
const HITS = [60, 63, 65, 67, 70, 72, 75, 77, 79, 82, 84];
const hidden = () => globalThis.document?.hidden === true;
const setting = (s, key, fallback) => (Number.isFinite(s?.[key]) ? clamp(s[key]) : fallback);

export class BlastAudio {
  constructor(soundscape) {
    this.audio = soundscape;
    this.active = false;
    this.paused = false;
    this.voices = new Set();
    this.pending = [];
    this.cooldowns = new Map();
    this.step = 0;
    this.nextStep = 0;
    this.wasAudible = false;
    this.eventCount = 0;
    this.stolen = 0;
    this.peakVoices = 0;
    this.created = 0;
    this.visibility = () => {
      if (hidden()) {
        this.haltAll();
        this.pending.length = 0;
        this.wasAudible = false;
        this.mix(false);
      }
    };
  }
  get ctx() {
    return this.audio?.ctx;
  }
  get settings() {
    return this.audio?.sim?.s || {};
  }
  get audible() {
    return !!(
      this.active &&
      !this.paused &&
      !hidden() &&
      this.ctx?.state === 'running' &&
      this.audio.enabled !== false &&
      this.settings.audioEnabled !== false
    );
  }
  get status() {
    return {
      active: this.active,
      paused: this.paused || hidden(),
      audible: this.audible,
      voices: this.voices.size,
      peakVoices: this.peakVoices,
      pending: this.pending.length,
      maxVoices: MAX_VOICES,
      step: this.step,
      events: this.eventCount,
      created: this.created,
      stolen: this.stolen,
      musicGain: this.music?.gain?.value || 0,
      effectsGain: this.effects?.gain?.value || 0,
    };
  }
  start() {
    if (this.active) return !!this.output;
    this.active = true;
    this.paused = false;
    this.step = 0;
    this.pending.length = 0;
    this.cooldowns.clear();
    this.musicHoldUntil = 0;
    this.previousMix = this.audio.cinematicMix;
    this.previousVoice = this.audio.cinematicVoice;
    this.mixOwner = { owner: this, musicDuck: 0.12 };
    this.audio.cinematicMix = this.mixOwner;
    this.audio.cinematicVoice = true;
    this.audio.voices?.stop();
    if (!this.audio.ready) this.audio.start?.();
    this.mount();
    this.nextStep = (this.ctx?.currentTime || 0) + 0.025;
    globalThis.document?.addEventListener?.('visibilitychange', this.visibility);
    this.audio.applyMix?.();
    this.update(0);
    return !!this.output;
  }
  mount() {
    if (this.output || !this.ctx || !this.audio.master) return;
    const c = this.ctx;
    this.output = c.createGain();
    this.output.gain.value = 0;
    this.output.connect(this.audio.master);
    this.music = c.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.output);
    this.effects = c.createGain();
    this.effects.gain.value = 0;
    this.effects.connect(this.output);
    const n = Math.max(1, Math.ceil(c.sampleRate * 1.4));
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const data = this.noise.getChannelData(0);
    let value = 0,
      seed = 0x451b;
    for (let i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      value = value * 0.7 + ((seed / 4294967296) * 2 - 1) * 0.3;
      data[i] = value;
    }
  }
  target(param, value, fade = 0.025) {
    if (!param || !this.ctx) return;
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setTargetAtTime(value, t, fade);
  }
  mix(on) {
    if (!this.output) return;
    this.target(this.output.gain, on ? 0.75 : 0, 0.018);
    this.target(this.effects.gain, setting(this.settings, 'audioEffects', 0.85));
    this.target(
      this.music.gain,
      this.settings.music === false ? 0 : setting(this.settings, 'musicVolume', 0.4) * 0.48,
    );
    // Soundscape applies audioMaster and audioEnabled at its shared output downstream.
    if (this.audio.cinematicMix === this.mixOwner) this.audio.cinematicVoice = !!on;
    this.audio.applyMix?.();
  }
  queue(delay, spec) {
    if (!this.audible || this.pending.length >= MAX_PENDING) return;
    const when = this.ctx.currentTime + Math.max(0, Math.min(4, delay || 0));
    this.pending.push({ when, spec });
    this.pending.sort((a, b) => a.when - b.when);
  }
  reserve(bus, when) {
    if (this.voices.size < MAX_VOICES) return true;
    const victim =
      [...this.voices].find((v) => v.bus === 'music') || this.voices.values().next().value;
    if (!victim) return false;
    this.stop(victim);
    this.stolen++;
    return this.voices.size < MAX_VOICES;
  }
  voice(spec, when) {
    if (!this.audible || !this.output || !this.reserve(spec.bus, when)) return null;
    const c = this.ctx,
      bus = spec.bus || 'effects',
      duration = clamp(spec.duration ?? 0.25, 0.025, 2.1);
    if (
      bus === 'music' &&
      (this.settings.music === false || setting(this.settings, 'musicVolume', 0.4) === 0)
    )
      return null;
    if (bus === 'effects' && setting(this.settings, 'audioEffects', 0.85) === 0) return null;
    const source = spec.noise ? c.createBufferSource() : c.createOscillator();
    const gain = c.createGain(),
      filter = c.createBiquadFilter();
    const t = Math.max(c.currentTime, when || c.currentTime),
      level = clamp(spec.level ?? 0.05, 0, 0.2),
      attack = Math.min(spec.attack ?? 0.006, duration / 3);
    filter.type = spec.filter || 'lowpass';
    filter.frequency.setValueAtTime(clamp(spec.cutoff ?? 3800, 80, 14000), t);
    filter.Q.value = spec.q ?? 0.6;
    if (spec.cutoffEnd)
      filter.frequency.exponentialRampToValueAtTime(clamp(spec.cutoffEnd, 80, 14000), t + duration);
    if (spec.noise) {
      source.buffer = this.noise;
      source.playbackRate.value = clamp(spec.rate ?? 1, 0.4, 2);
    } else {
      source.type = spec.wave || 'sine';
      source.frequency.setValueAtTime(clamp(spec.frequency ?? note(spec.note ?? 60), 35, 3200), t);
      if (spec.endFrequency)
        source.frequency.exponentialRampToValueAtTime(
          clamp(spec.endFrequency, 35, 3200),
          t + duration * 0.9,
        );
    }
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * 0.3), t + duration * 0.38);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    gain.gain.setValueAtTime(0, t + duration + 0.005);
    source.connect(filter);
    filter.connect(gain);
    const panner = c.createStereoPanner?.();
    if (panner) {
      panner.pan.value = clamp(spec.pan ?? 0, -0.8, 0.8);
      gain.connect(panner);
      panner.connect(this[bus]);
    } else gain.connect(this[bus]);
    const handle = {
      source,
      gain,
      filter,
      panner,
      bus,
      when: t,
      until: t + duration + 0.02,
      stopped: false,
    };
    source.onended = () => this.release(handle);
    this.voices.add(handle);
    this.created++;
    this.peakVoices = Math.max(this.peakVoices, this.voices.size);
    source.start(t);
    source.stop(t + duration + 0.015);
    return handle;
  }
  release(h) {
    if (!this.voices.has(h)) return;
    for (const n of [h.source, h.filter, h.gain, h.panner]) {
      try {
        n?.disconnect();
      } catch {}
    }
    this.voices.delete(h);
  }
  stop(h) {
    if (!h || h.stopped) return;
    h.stopped = true;
    try {
      h.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      h.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      h.source.stop(this.ctx.currentTime);
    } catch {}
    this.release(h);
  }
  haltAll(bus = null) {
    for (const h of [...this.voices]) if (!bus || h.bus === bus) this.stop(h);
  }
  bell(midi, delay = 0, options = {}) {
    this.queue(delay, { note: midi, duration: 0.27, level: 0.075, ...options });
    this.queue(delay, {
      note: midi + 12,
      duration: 0.13,
      level: 0.013,
      ...options,
      wave: 'triangle',
    });
  }
  chord(notes, delay = 0, options = {}) {
    notes.forEach((n, i) =>
      this.queue(delay + i * 0.022, {
        note: n,
        wave: 'sine',
        level: 0.045,
        duration: 0.55,
        ...options,
      }),
    );
  }
  event(event) {
    const e = typeof event === 'string' ? { type: event } : event || {};
    if (!this.audible) return false;
    const t = this.ctx.currentTime,
      cooldown = {
        hit: 0.022,
        shot: 0.12,
        end: 0.18,
        catch: 0.3,
        blast: 0.25,
        win: 1.8,
        lose: 1.3,
      }[e.type];
    if (cooldown === undefined || t < (this.cooldowns.get(e.type) ?? -1)) return false;
    this.cooldowns.set(e.type, t + cooldown);
    this.eventCount++;
    const pan = Number.isFinite(e.x) ? clamp((e.x - 360) / 380, -0.7, 0.7) : 0;
    const combo = clamp(Math.floor(e.combo || 1), 1, HITS.length),
      pitch = HITS[combo - 1];
    if (e.type === 'hit') {
      const kind = String(e.kind || 'blue').toLowerCase();
      this.bell(pitch + (kind === 'orange' ? 0 : -12), 0, {
        pan,
        level: kind === 'orange' ? 0.085 : 0.05,
        duration: 0.18 + combo * 0.013,
      });
      if (kind === 'purple') {
        this.chord([72, 79, 82, 87], 0, { pan, level: 0.034, duration: 0.43 });
        this.bell(91, 0.13, { pan, level: 0.027, duration: 0.25 });
      }
      if (kind === 'green')
        this.queue(0, {
          noise: true,
          filter: 'bandpass',
          cutoff: 900,
          cutoffEnd: 2900,
          duration: 0.3,
          level: 0.07,
          pan,
        });
    } else if (e.type === 'shot') {
      this.queue(0, { frequency: 210, endFrequency: 780, duration: 0.14, level: 0.045, pan });
      this.queue(0, {
        noise: true,
        filter: 'bandpass',
        cutoff: 600,
        cutoffEnd: 2100,
        duration: 0.16,
        level: 0.09,
        pan,
      });
      this.queue(0.04, { frequency: 820, endFrequency: 330, duration: 0.22, level: 0.035, pan });
    } else if (e.type === 'blast') {
      this.queue(0, { noise: true, cutoff: 4500, cutoffEnd: 150, duration: 0.7, level: 0.16, pan });
      this.queue(0, { frequency: 115, endFrequency: 38, duration: 0.43, level: 0.13, pan });
      [67, 72, 75, 79, 84].forEach((n, i) =>
        this.bell(n, i * 0.07, { pan: pan + (i - 2) * 0.07, level: 0.036, duration: 0.28 }),
      );
    } else if (e.type === 'catch') {
      this.bell(72, 0, { level: 0.072 });
      this.bell(79, 0.105, { level: 0.06 });
      this.bell(84, 0.21, { level: 0.065, duration: 0.48 });
      this.queue(0, { noise: true, cutoff: 1700, duration: 0.12, level: 0.055 });
    } else if (e.type === 'end') {
      this.queue(0, { note: 48, duration: 0.12, level: 0.052, cutoff: 900 });
      this.queue(0.08, { note: 43, duration: 0.2, level: 0.035, cutoff: 650 });
    } else if (e.type === 'win') {
      this.haltAll('music');
      this.pending = this.pending.filter((p) => p.spec.bus !== 'music');
      this.musicHoldUntil = t + 2.4;
      [60, 67, 72, 75, 79, 84, 87, 84].forEach((n, i) =>
        this.bell(n, i * 0.12, { level: 0.067, duration: 0.4 }),
      );
      this.chord([48, 60, 67, 75], 0.5, { level: 0.036, duration: 1.45 });
      this.chord([60, 67, 75, 84], 1.3, { level: 0.027, duration: 0.9 });
      this.queue(0.49, {
        noise: true,
        filter: 'highpass',
        cutoff: 3400,
        duration: 0.55,
        level: 0.045,
      });
    } else if (e.type === 'lose') {
      this.haltAll('music');
      this.musicHoldUntil = t + 1.25;
      [67, 63, 60, 55].forEach((n, i) => this.bell(n, i * 0.15, { level: 0.045, duration: 0.36 }));
      this.chord([43, 50, 58], 0.48, { level: 0.027, duration: 0.65 });
    }
    this.flush();
    return true;
  }
  scheduleStep(index, when) {
    const step = index % 16,
      bar = Math.floor(index / 16) % 4,
      root = ROOTS[bar];
    const arpeggio =
      Math.floor(index / 64) % 2
        ? [19, 24, 22, 19, 15, 19, 22, 26]
        : [12, 19, 22, 26, 19, 22, 24, 19];
    if (step % 2 === 0)
      this.voice(
        {
          bus: 'music',
          note: root + arpeggio[(step / 2) % 8],
          wave: 'triangle',
          level: 0.055,
          duration: 0.3,
          cutoff: 2200,
          pan: step % 4 ? 0.2 : -0.2,
        },
        when,
      );
    if (step % 4 === 0) {
      this.voice(
        {
          bus: 'music',
          frequency: 120,
          endFrequency: 43,
          duration: 0.18,
          level: 0.14,
          cutoff: 700,
        },
        when,
      );
      this.voice(
        { bus: 'music', note: root - 12, wave: 'sine', duration: 0.4, level: 0.12, cutoff: 450 },
        when + 0.006,
      );
    }
    if (step % 8 === 4)
      this.voice(
        {
          bus: 'music',
          noise: true,
          filter: 'bandpass',
          cutoff: 1800,
          duration: 0.105,
          level: 0.07,
        },
        when,
      );
    if (step % 2 === 1)
      this.voice(
        {
          bus: 'music',
          noise: true,
          filter: 'highpass',
          cutoff: 6500,
          duration: 0.045,
          level: 0.04,
          pan: step % 4 === 1 ? -0.2 : 0.2,
        },
        when,
      );
    if (step === 0)
      for (const n of [root + 12, root + (bar === 0 ? 15 : 16), root + 19])
        this.voice(
          {
            bus: 'music',
            note: n,
            wave: 'sine',
            level: 0.026,
            duration: 1.3,
            attack: 0.08,
            cutoff: 1300,
          },
          when,
        );
  }
  flush() {
    if (!this.audible) return;
    const t = this.ctx.currentTime;
    let scheduled = 0;
    while (this.pending.length && this.pending[0].when <= t + LOOKAHEAD && scheduled < 12) {
      const p = this.pending.shift();
      if (p.when >= t - 0.18) this.voice(p.spec, Math.max(t, p.when));
      scheduled++;
    }
  }
  update(dt = 0) {
    if (!this.active) return;
    this.mount();
    const on = this.audible;
    if (!on) {
      if (this.wasAudible || this.voices.size) this.haltAll();
      this.pending.length = 0;
      this.wasAudible = false;
      this.mix(false);
      return;
    }
    if (!this.wasAudible) {
      this.nextStep = this.ctx.currentTime + 0.025;
      this.wasAudible = true;
    }
    this.mix(true);
    const t = this.ctx.currentTime;
    for (const h of [...this.voices]) if (t > h.until + 0.1) this.stop(h);
    if (this.settings.music === false || setting(this.settings, 'musicVolume', 0.4) === 0)
      this.haltAll('music');
    else if (t >= (this.musicHoldUntil || 0)) {
      if (this.nextStep < t - 0.3) this.nextStep = t + 0.012;
      let count = 0;
      while (this.nextStep < t + LOOKAHEAD && count < 3) {
        this.scheduleStep(this.step++, this.nextStep);
        this.nextStep += STEP_SECONDS;
        count++;
      }
    }
    this.flush();
  }
  pause(value = true) {
    if (this.paused === !!value) return;
    this.paused = !!value;
    this.haltAll();
    this.pending.length = 0;
    this.wasAudible = false;
    this.mix(!value && this.audible);
  }
  close() {
    this.active = false;
    this.paused = false;
    this.haltAll();
    this.pending.length = 0;
    this.cooldowns.clear();
    this.wasAudible = false;
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibility);
    if (this.mixOwner && this.audio.cinematicMix === this.mixOwner) {
      this.audio.cinematicMix = this.previousMix;
      this.audio.cinematicVoice = this.previousVoice || false;
    }
    for (const n of [this.music, this.effects, this.output]) {
      try {
        n?.disconnect();
      } catch {}
    }
    this.music = this.effects = this.output = null;
    this.noise = null;
    this.mixOwner = null;
    this.audio.applyMix?.();
  }
}
