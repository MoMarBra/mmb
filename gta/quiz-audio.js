/**
 * BBE Quizssoir — original, deterministic stereo score. No sampled television
 * music or recognisable show melody. Instruments and room reflections are
 * pre-rendered as local MP3s; at most one bed and one sting play.
 * Uses Soundscape.emit so all sources share its mixer, limiter and cleanup.
 */
const RATE = 22050;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const bandFor = (tier) => Math.min(2, Math.floor(clamp(tier, 0, 14) / 5));
const hidden = () => globalThis.document?.hidden === true;
const ALIASES = {
  start: 'intro',
  welcome: 'intro',
  next: 'question',
  answer: 'lock',
  confirm: 'lock',
  locked: 'lock',
  login: 'lock',
  suspense: 'heartbeat',
  right: 'correct',
  success: 'correct',
  incorrect: 'wrong',
  fail: 'wrong',
  checkpoint: 'safety',
  safe: 'safety',
  win: 'million',
  jackpot: 'million',
  lifeline: 'joker',
  leave: 'exit',
  walkaway: 'exit',
};
const CUES = new Set([
  'select',
  'intro',
  'question',
  'lock',
  'heartbeat',
  'correct',
  'wrong',
  'safety',
  'million',
  'joker',
  'exit',
]);
const MUSIC = new Set(['intro', 'million', 'exit']);
const DURATIONS = {
  select: 0.22,
  intro: 12,
  lock: 1.1,
  correct: 2.7,
  wrong: 3.3,
  safety: 4.3,
  million: 8.4,
  joker: 1.5,
  exit: 2.8,
};
const SCORE_KEYS = [
  ...Object.keys(DURATIONS),
  ...['question', 'suspense'].flatMap((k) => [0, 1, 2].map((b) => k + ':' + b)),
];
const assetId = (key) => 'quiz_score_' + key.replace(':', '_');
const scoreDuration = (key) => {
  const [kind, band] = key.split(':');
  return band === undefined
    ? DURATIONS[kind]
    : ((kind === 'suspense' ? 8 : 16) * 60) / [92, 104, 116][+band];
};
export const QUIZ_SCORE_ASSETS = Object.freeze(
  Object.fromEntries(
    SCORE_KEYS.map((key) => [
      assetId(key),
      {
        path: './assets/audio/' + assetId(key) + '.mp3',
        group: 'music',
        duration: scoreDuration(key),
      },
    ]),
  ),
);
export const QUIZ_SCORE_CREDITS = Object.freeze({
  title: 'Between certainty and coffee',
  composer: 'Original procedural composition for BBE Quizssoir',
  source:
    'Deterministic additive/FM synthesis; no recordings, borrowed melodies or external samples.',
  sampleRate: RATE,
  channels: 2,
});

class Score {
  constructor(seconds, loop = false, seed = 117) {
    this.length = Math.ceil(seconds * RATE);
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
    this.loop = loop;
    this.seed = seed;
  }
  noise() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 2147483648 - 1;
  }
  note(kind, pitch, start, duration, gain = 0.15, pan = 0) {
    const first = Math.round(start * RATE),
      count = Math.ceil(duration * RATE),
      f = midi(pitch);
    const l = Math.sqrt((1 - pan) * 0.5),
      r = Math.sqrt((1 + pan) * 0.5);
    let previousNoise = 0;
    for (let j = 0; j < count; j++) {
      const t = j / RATE,
        u = t / duration;
      const attack = Math.min(1, t / (kind === 'pad' ? 0.4 : kind === 'brass' ? 0.07 : 0.009));
      const release = Math.min(1, (duration - t) / (kind === 'pad' ? 0.5 : 0.09));
      const phase = TAU * f * t;
      let s;
      if (kind === 'pad') {
        s =
          (Math.sin(phase) +
            0.33 * Math.sin(phase * 1.0024 + 0.3) +
            0.19 * Math.sin(phase * 2.001)) *
          (0.7 + 0.12 * Math.sin(TAU * 0.37 * t));
      } else if (kind === 'bell') {
        s = Math.sin(phase + 1.8 * Math.exp(-t * 5) * Math.sin(phase * 2.007)) * Math.exp(-t * 2.4);
      } else if (kind === 'pluck') {
        s =
          (Math.sin(phase) +
            0.32 * Math.sin(phase * 2) * Math.exp(-t * 9) +
            0.13 * Math.sin(phase * 3) * Math.exp(-t * 14)) *
          Math.exp(-t * 5.5);
      } else if (kind === 'brass') {
        s = 0;
        for (let h = 1; h <= 5; h++)
          s += Math.sin(phase * h + 0.018 * h * Math.sin(TAU * 4.3 * t)) / (h * h * 0.55);
        s *= Math.exp(-t * 0.55);
      } else if (kind === 'kick' || kind === 'heart') {
        const decay = kind === 'heart' ? 22 : 15;
        s = Math.sin(TAU * (f * t + f * 0.035 * (1 - Math.exp(-t * 38)))) * Math.exp(-t * decay);
        if (kind === 'kick') s += this.noise() * Math.exp(-t * 120) * 0.12;
      } else if (kind === 'air') {
        const n = this.noise();
        s = (n - previousNoise) * Math.sin(Math.PI * u) ** 2 * 0.35;
        previousNoise = n * 0.7 + previousNoise * 0.3;
      } else if (kind === 'tick') {
        const n = this.noise();
        s = (n - previousNoise) * Math.exp(-t * 90) * 0.65;
        previousNoise = n;
      } else {
        s = (Math.sin(phase) + 0.18 * Math.sin(phase * 2)) * Math.exp(-t * 2.8);
      }
      const index = this.loop ? (first + j) % this.length : first + j;
      if (index >= this.length) break;
      if (index < 0) continue;
      const value = s * gain * attack * release;
      this.left[index] += value * l;
      this.right[index] += value * r;
    }
  }
  chord(notes, start, duration, gain = 0.035, kind = 'pad') {
    notes.forEach((n, i) =>
      this.note(kind, n, start, duration, gain, (i / Math.max(1, notes.length - 1) - 0.5) * 1.35),
    );
  }
  finish(ctx) {
    const buffer = ctx.createBuffer(2, this.length, RATE);
    const left = buffer.getChannelData(0),
      right = buffer.getChannelData(1);
    const taps = [0.073, 0.139, 0.227, 0.347, 0.493, 0.677].map((t) => Math.round(t * RATE));
    let dcL = 0,
      dcR = 0,
      peak = 0;
    for (let i = 0; i < this.length; i++) {
      let l = this.left[i],
        r = this.right[i];
      taps.forEach((delay, k) => {
        let at = i - delay;
        if (this.loop) at = (at + this.length) % this.length;
        if (at < 0) return;
        const wet = 0.19 * Math.exp(-k * 0.38);
        l += (k % 2 ? this.left[at] : this.right[at]) * wet;
        r += (k % 2 ? this.right[at] : this.left[at]) * wet;
      });
      dcL += (l - dcL) * 0.001;
      dcR += (r - dcR) * 0.001;
      const edge = this.loop ? 1 : Math.min(1, i / 110, (this.length - 1 - i) / 1100);
      left[i] = Math.tanh((l - dcL) * 1.2) * edge;
      right[i] = Math.tanh((r - dcR) * 1.2) * edge;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    if (peak > 0.85)
      for (let i = 0; i < this.length; i++) {
        left[i] *= 0.85 / peak;
        right[i] *= 0.85 / peak;
      }
    // Remove residual subsonic mismatch without fading every loop into silence.
    if (this.loop)
      for (const channel of [left, right]) {
        const width = 128;
        const delta = channel[this.length - 1] - channel[0];
        for (let i = 0; i < width; i++) {
          channel[i] += delta * 0.5 * (1 + Math.cos((Math.PI * i) / width));
        }
      }
    return buffer;
  }
}

function composeBed(ctx, kind, band) {
  const beat = 60 / [92, 104, 116][band],
    beats = kind === 'suspense' ? 8 : 16;
  const s = new Score(beat * beats, true, 719 + band * 41);
  if (kind === 'suspense') {
    s.chord([38, 45, 50, 57, 64], 0, beat * beats, 0.029);
    for (let b = 0; b < beats; b++) {
      s.note('heart', 31, b * beat, 0.23, 0.42);
      s.note('heart', 38, b * beat + 0.18, 0.19, 0.23);
      if (b % 2 === 1)
        s.note('bell', 81 + (b % 4 ? 0 : 2), b * beat + 0.4, 1, 0.026, b % 3 ? -0.7 : 0.7);
      if (band > 0) s.note('tick', 70, (b + 0.5) * beat, 0.1, 0.075);
    }
  } else {
    const chords = [
      [50, 57, 60, 64],
      [46, 53, 57, 62],
      [43, 50, 57, 58],
      [45, 52, 55, 62],
    ];
    const motif = [0, 7, 14, 10, 5, 12, 17, 9];
    for (let bar = 0; bar < 4; bar++) {
      s.chord(chords[bar], bar * 4 * beat, 4.4 * beat, 0.023 + band * 0.004);
      for (let b = 0; b < 4; b++) {
        const t = (bar * 4 + b) * beat;
        s.note('bass', chords[bar][0] - 12, t, beat * 0.85, 0.19);
        if (b % 2 === 0) s.note('kick', 32, t, 0.3, 0.24 + band * 0.025);
        s.note('tick', 65, t + beat * 0.5, 0.08, 0.032 + band * 0.025, b % 2 ? -0.45 : 0.45);
        s.note(
          'pluck',
          62 + motif[(bar * 2 + b) % motif.length],
          t + beat * 0.25,
          0.55,
          0.065,
          b % 2 ? 0.6 : -0.6,
        );
        if (band === 2)
          s.note(
            'pluck',
            74 + motif[(bar + b + 3) % motif.length],
            t + beat * 0.75,
            0.32,
            0.034,
            -0.35,
          );
      }
      s.note(
        'bell',
        chords[bar][3] + 12,
        (bar * 4 + 2.75) * beat,
        1.2,
        0.052,
        bar % 2 ? -0.7 : 0.7,
      );
    }
  }
  return s.finish(ctx);
}

function composeCue(ctx, name) {
  const s = new Score(DURATIONS[name], false, 915);
  if (name === 'intro') {
    // Pissoir prelude, then the studio reveal on the film's exact 4.35 s cut.
    // The arrangement continues beneath the host until the 12 s question handoff.
    const reveal = 4.35;
    s.chord([38, 45, 50, 64], 0, reveal + 0.45, 0.018);
    s.note('bell', 81, 0.75, 1.4, 0.035, -0.6);
    s.note('bell', 76, 2.0, 1.65, 0.032, 0.6);
    for (const at of [1.35, 2.45, 3.25, 3.82]) s.note('heart', 33, at, 0.27, 0.1);
    s.note('air', 69, reveal - 1.05, 1.05, 0.075);
    const progression = [
      [50, 57, 60, 64],
      [46, 53, 57, 62],
      [43, 50, 57, 62],
      [50, 57, 62, 66],
    ];
    progression.forEach((chord, bar) => {
      const at = reveal + bar * 1.85,
        length = Math.min(2.25, 12 - at);
      s.chord(chord, at, length, 0.057, 'brass');
      s.chord(
        chord.map((n) => n + 12),
        at,
        length,
        0.032,
      );
      s.note('kick', 30, at, 0.42, bar === 0 ? 0.5 : 0.3);
      for (let i = 0; i < 3; i++) {
        const t = at + i * 0.6;
        s.note('bass', chord[0] - 12, t, 0.55, 0.12);
        s.note(
          'bell',
          chord[(i + 1) % chord.length] + 12,
          t + 0.15,
          Math.min(1.15, 12 - t - 0.15),
          0.069,
          (i - 1) * 0.6,
        );
        s.note('tick', 70, t + 0.3, 0.085, 0.065, i % 2 ? -0.5 : 0.5);
      }
    });
    s.note('bell', 86, reveal, 1.65, 0.1, 0.3);
  } else if (name === 'million' || name === 'safety') {
    const grand = name === 'million',
      duration = DURATIONS[name];
    s.note('air', 62, 0, 0.85, 0.08, 0.2);
    const progression = grand
      ? [
          [50, 57, 62, 66],
          [46, 53, 58, 62],
          [43, 50, 59, 62],
          [50, 57, 62, 66, 69],
        ]
      : [
          [50, 57, 60, 64],
          [46, 53, 57, 62],
          [50, 57, 62, 65],
        ];
    const spacing = grand ? 1.5 : 0.85;
    progression.forEach((chord, i) => {
      const t = 0.15 + i * spacing;
      s.chord(chord, t, Math.min(2.4, duration - t - 0.2), grand ? 0.065 : 0.043, 'brass');
      s.chord(
        chord.map((n) => n + 12),
        t,
        Math.min(2.6, duration - t - 0.1),
        0.022,
      );
      s.note('kick', 30, t, 0.45, 0.45);
      [0, 0.28, 0.56].forEach((offset, j) =>
        s.note('bell', chord[j % chord.length] + 24, t + offset, 0.9, 0.07, (j - 1) * 0.55),
      );
    });
    if (grand)
      for (let i = 0; i < 8; i++)
        s.note(
          'bell',
          [74, 81, 78, 86, 81, 90, 86, 93][i],
          5 + i * 0.22,
          1.65,
          0.067,
          Math.sin(i) * 0.7,
        );
  } else if (name === 'correct') {
    [62, 69, 74, 77].forEach((n, i) => s.note('bell', n, i * 0.15, 1.9, 0.15, (i - 1.5) * 0.3));
    s.chord([50, 57, 62, 65], 0.35, 2.1, 0.052, 'brass');
    s.note('kick', 38, 0.34, 0.34, 0.3);
  } else if (name === 'wrong') {
    s.note('brass', 38, 0, 2.5, 0.18, -0.15);
    s.note('brass', 39, 0.03, 1.4, 0.07, 0.15);
    [65, 63, 62].forEach((n, i) => s.note('bell', n, 0.05 + i * 0.26, 1.8, 0.08, (i - 1) * 0.5));
    s.note('air', 48, 0.15, 0.7, 0.065);
  } else if (name === 'select') {
    s.note('pluck', 81, 0, 0.16, 0.16, -0.1);
    s.note('tick', 70, 0, 0.045, 0.09);
  } else if (name === 'lock') {
    s.note('kick', 36, 0, 0.25, 0.42);
    s.note('bell', 74, 0.01, 0.8, 0.1, -0.25);
    s.note('bell', 81, 0.13, 0.7, 0.075, 0.25);
    s.note('tick', 70, 0.02, 0.1, 0.2);
  } else if (name === 'joker') {
    [69, 74, 81, 78].forEach((n, i) => s.note('pluck', n, i * 0.11, 0.7, 0.19, (i - 1.5) * 0.35));
    s.note('air', 74, 0.01, 0.45, 0.035);
  } else if (name === 'exit') {
    s.chord([53, 57, 60, 67], 0, 1.4, 0.05);
    s.chord([50, 57, 62, 65], 0.9, 1.8, 0.048);
    [77, 74, 69].forEach((n, i) => s.note('bell', n, i * 0.28, 1.5, 0.075, 0.25 - i * 0.25));
  }
  return s.finish(ctx);
}

/** Offline authoring entry point used by work/quiz-audio/build-score.mjs only. */
export function renderQuizScore(ctx, key) {
  if (!SCORE_KEYS.includes(key)) throw new Error('Unknown original score: ' + key);
  const [kind, band] = key.split(':');
  return band === undefined ? composeCue(ctx, kind) : composeBed(ctx, kind, +band);
}

export class QuizAudio {
  constructor(audio) {
    this.audio = audio;
    this.active = false;
    this.disposed = false;
    this.manualPause = false;
    this.framePause = false;
    this.phase = 'idle';
    this.tier = 0;
    this.buffers = new Map();
    this.pending = new Map();
    this.attempts = new Map();
    this.retryAt = new Map();
    this.tracks = new Map();
    this.retired = new Set();
    this.visibility = () => {
      if (hidden()) this.haltAll();
      else if (this.active) this.update(0);
    };
  }
  start() {
    if (this.disposed) return false;
    if (this.active) return true;
    this.active = true;
    this.manualPause = this.framePause = false;
    // Starting a controller is not starting a new show: resumed question and
    // locked checkpoints must not replay the introduction. The caller cues it.
    this.phase = 'idle';
    this.attempts.clear();
    this.retryAt.clear();
    globalThis.document?.addEventListener?.('visibilitychange', this.visibility);
    if (!this.audio.ready) this.audio.start?.();
    return true;
  }
  get playable() {
    return (
      this.active &&
      !this.manualPause &&
      !this.framePause &&
      !hidden() &&
      this.audio.ready &&
      this.audio.enabled !== false &&
      this.audio.ctx?.state === 'running'
    );
  }
  request(key) {
    if (
      this.buffers.has(key) ||
      this.pending.has(key) ||
      !this.audio.bank ||
      (this.attempts.get(key) || 0) >= 3 ||
      (this.audio.ctx?.currentTime || 0) < (this.retryAt.get(key) || 0)
    )
      return;
    this.attempts.set(key, (this.attempts.get(key) || 0) + 1);
    this.retryAt.set(key, (this.audio.ctx?.currentTime || 0) + 2);
    this.audio.bank.failures?.delete(assetId(key));
    const promise = Promise.resolve()
      .then(() => (this.disposed ? null : this.audio.bank.get(assetId(key))))
      .then((buffer) => {
        if (buffer && !this.disposed) this.buffers.set(key, buffer);
      })
      .catch(() => {})
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
        if (this.active && !this.disposed) this.update(0);
      });
    this.pending.set(key, promise);
  }
  halt(track, fade = 0) {
    const h = track.handle;
    if (!h) return;
    const t = this.audio.ctx?.currentTime || 0;
    track.offset += Math.max(0, t - track.startedAt);
    if (track.loop && track.buffer)
      track.offset %= Math.min(scoreDuration(track.key), track.buffer.duration);
    h.stop(fade);
    track.handle = null;
  }
  haltAll() {
    for (const track of this.tracks.values()) this.halt(track);
    // Soundscape handles already fading out have stopped=true, so a second
    // handle.stop() is intentionally ignored there. End their sources directly
    // when the quiz closes/hides instead of letting a suspended tail resume.
    for (const handle of this.retired) {
      if (!handle.ended) {
        try {
          handle.source.stop(this.audio.ctx.currentTime);
        } catch {}
      }
    }
    this.retired.clear();
  }
  remove(slot, fade = 0.06) {
    const track = this.tracks.get(slot);
    if (track) {
      const handle = track.handle;
      this.halt(track, fade);
      if (fade > 0 && handle && !handle.ended) this.retired.add(handle);
    }
    this.tracks.delete(slot);
  }
  play(track) {
    if (!this.playable || (track.bus === 'music' && this.audio.sim?.s.music === false)) return;
    track.buffer ||= this.buffers.get(track.key);
    if (!track.buffer) {
      this.request(track.key);
      return;
    }
    if (!track.loop && track.offset >= track.buffer.duration - 0.015) return;
    if (track.handle && !track.handle.ended && !track.handle.stopped) return;
    track.handle = this.audio.emit(track.buffer, {
      loop: track.loop,
      bus: track.bus,
      volume: track.volume,
      offset: track.offset,
      fade: track.loop ? 0.14 : 0.025,
    });
    if (track.handle) {
      track.startedAt = this.audio.ctx.currentTime;
      if (track.loop)
        track.handle.source.loopEnd = Math.min(scoreDuration(track.key), track.buffer.duration);
    }
  }
  cue(name, tier = this.tier) {
    name = ALIASES[name] || name;
    if (!this.active || !CUES.has(name)) return false;
    this.tier = clamp(tier, 0, 14);
    if (name === 'question' || name === 'heartbeat') {
      this.phase = name === 'question' ? 'question' : 'locked';
    } else {
      if (name === 'intro') this.phase = 'intro';
      if (name === 'lock') this.phase = 'locked';
      if (['correct', 'wrong', 'safety', 'million', 'exit'].includes(name)) this.phase = 'reveal';
      this.remove('sting', 0.035);
      this.tracks.set('sting', {
        key: name,
        loop: false,
        offset: 0,
        handle: null,
        bus: MUSIC.has(name) ? 'music' : 'ui',
        volume: name === 'million' ? 0.83 : 0.69,
      });
    }
    this.update(0);
    return true;
  }
  /** Only quiz pause state belongs here; its enclosing game modal may pause the world. */
  update(dt = 0, options = {}) {
    if (!this.active) return;
    for (const h of this.retired) if (h.ended) this.retired.delete(h);
    if ('paused' in options) this.framePause = !!options.paused;
    if ('phase' in options) this.phase = options.phase;
    if ('tier' in options) this.tier = clamp(options.tier, 0, 14);
    if (this.phase !== 'intro' && this.tracks.get('sting')?.key === 'intro')
      this.remove('sting', 0.12);
    const kind = ['locked', 'suspense', 'checking'].includes(this.phase)
      ? 'suspense'
      : ['question', 'answering', 'playing'].includes(this.phase)
        ? 'question'
        : null;
    const key = kind ? kind + ':' + bandFor(this.tier) : null;
    if (this.tracks.get('bed')?.key !== key) {
      this.remove('bed', 0.16);
      if (key)
        this.tracks.set('bed', {
          key,
          loop: true,
          offset: 0,
          handle: null,
          bus: 'music',
          volume: 0.59,
        });
    }
    if (!this.playable) {
      this.haltAll();
      return;
    }
    for (const [slot, track] of this.tracks) {
      if (
        track.handle?.ended ||
        (!track.loop && track.buffer && track.offset >= track.buffer.duration - 0.015)
      ) {
        this.remove(slot, 0);
        continue;
      }
      if (track.bus === 'music' && this.audio.sim?.s.music === false) {
        this.halt(track);
        continue;
      }
      this.play(track);
    }
    const bed = this.tracks.get('bed')?.handle;
    const sting = this.tracks.get('sting')?.handle;
    bed?.gain?.gain?.setTargetAtTime(
      sting && !sting.ended ? 0.2 : 0.59,
      this.audio.ctx.currentTime,
      0.16,
    );
  }
  pause(value = true) {
    this.manualPause = !!value;
    if (this.manualPause) this.haltAll();
    else this.update(0);
  }
  stop() {
    this.active = false;
    this.haltAll();
    this.tracks.clear();
    this.phase = 'idle';
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibility);
  }
  dispose() {
    this.stop();
    this.buffers.clear();
    this.pending.clear();
    this.attempts.clear();
    this.retryAt.clear();
    this.disposed = true;
  }
  get status() {
    return {
      active: this.active,
      paused: this.manualPause || this.framePause || hidden(),
      phase: this.phase,
      tier: this.tier,
      sources: [...this.tracks.values()].filter(
        (t) => t.handle && !t.handle.stopped && !t.handle.ended,
      ).length,
      buffers: this.buffers.size,
      bytes: [...this.buffers.values()].reduce((n, b) => n + b.length * b.numberOfChannels * 4, 0),
    };
  }
}
