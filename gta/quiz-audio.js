import { WWM_TRACKS } from './quiz-soundtrack.js';
/**
 * BBE Quizssoir — user-supplied show recordings with an audio-clock-driven playlist.
 * The original procedural score authoring functions remain for small UI stings.
 * Music uses the supplied MP3s and documented seamless question-loop derivatives.
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

const CACHE_LIMIT = 64 * 1024 * 1024;
// Three bounded 15 s bank attempts plus a small decode/startup margin.
const INTRO_AUDIO_WAIT_LIMIT = 48;
const trackInfo = (key) =>
  WWM_TRACKS[key] || { id: assetId(key), duration: DURATIONS[key], gain: 0.69 };
const cacheId = (key, loop) => key + (loop && trackInfo(key).loopAsset ? '@loop' : '');
const sourceId = (key, loop) => (loop && trackInfo(key).loopAsset) || trackInfo(key).id;
const segment = (key, options = {}) => {
  const a = trackInfo(key);
  return { key, from: 0, duration: a.duration, ...options };
};
const loopSegment = (key) => {
  const a = trackInfo(key),
    from = a.loopAsset ? a.runtimeLoopStart : a.loopStart;
  return segment(key, {
    from,
    duration: a.loopAsset ? a.loopDuration : a.loopEnd - from,
    loop: true,
  });
};
const questionKey = (tier) =>
  tier < 6 ? 'questionsEarly' : tier < 14 ? 'question2000' : 'questionMillion';
const correctKey = (tier) =>
  tier < 4 ? 'correctReveal' : tier < 6 ? 'win1000' : tier < 14 ? 'win2000' : 'winMillion';
const lossKey = (tier) => (tier < 14 ? 'lose2000' : 'loseMillion');
export const QUIZ_SHOW_INTRO_DURATION = WWM_TRACKS.theme.duration + 11;
export const QUIZ_SHOW_INTRO_SHOTS = Object.freeze([
  { at: 0, end: 4.74, shot: 'portal' },
  { at: 4.74, end: 9.66, shot: 'reveal', title: true },
  { at: 9.66, end: 12.16, shot: 'establish', title: true },
  { at: 12.16, end: 16.66, shot: 'audience' },
  { at: 16.66, end: 20.66, shot: 'host' },
  { at: 20.66, end: 24.46, shot: 'candidate' },
  { at: 24.46, end: 29.08, shot: 'duo' },
  { at: 29.08, end: WWM_TRACKS.theme.duration, shot: 'question-ready' },
  {
    at: WWM_TRACKS.theme.duration,
    end: WWM_TRACKS.theme.duration + 5,
    shot: 'host',
    welcome: true,
  },
  { at: WWM_TRACKS.theme.duration + 5, end: QUIZ_SHOW_INTRO_DURATION, shot: 'duo', welcome: true },
]);
/** Explicit editorial routing. Missing middle-tier recordings reuse the supplied 2,000 bed. */
export function quizTrackPlan(name, tier = 0, options = {}) {
  tier = clamp(tier, 0, 14);
  name = ALIASES[name] || name;
  if (name === 'intro')
    return [
      segment('theme'),
      segment('opening', {
        from: 0.18,
        duration: 11,
        gain: WWM_TRACKS.opening.gain * 0.72,
        fadeIn: 0.3,
        fadeOut: 0.7,
      }),
    ];
  if (name === 'question') {
    const lead =
      tier < 6
        ? null
        : tier === 6
          ? 'play2000'
          : tier < 11
            ? 'play4000'
            : tier < 14
              ? 'play64000'
              : 'playMillion';
    return [...(lead && !options.resume ? [segment(lead)] : []), loopSegment(questionKey(tier))];
  }
  if (name === 'lock' || name === 'heartbeat')
    return tier < 6
      ? [loopSegment('questionsEarly')]
      : [segment(tier < 14 ? 'final2000' : 'finalMillion')];
  if (name === 'correct' || name === 'safety' || name === 'million')
    return [segment(name === 'million' ? 'winMillion' : correctKey(tier))];
  if (name === 'wrong') return [segment(lossKey(tier))];
  if (name === 'exit') return [segment('closing')];
  if (name === 'finale')
    return options.outcome === 'walk-away' || options.outcome === 'abort'
      ? [segment('closing')]
      : [segment(options.outcome === 'win' ? 'winMillion' : lossKey(tier)), segment('closing')];
  return [];
}

/** One score playlist and one short UI sting, on the game's existing audio mixer. */
export class QuizAudio {
  constructor(audio) {
    this.audio = audio;
    this.active = false;
    this.disposed = false;
    this.manualPause = this.framePause = false;
    this.phase = 'idle';
    this.tier = 0;
    this.buffers = new Map();
    this.pending = new Map();
    this.attempts = new Map();
    this.retryAt = new Map();
    this.tracks = new Map();
    this.retired = new Set();
    this.plan = [];
    this.clock = 0;
    this.lastContextTime = null;
    this.waited = 0;
    this.silentIntroTheme = false;
    this.epoch = 0;
    this.visibility = () => {
      this.lastContextTime = null;
      if (hidden()) this.haltAll();
      else if (this.active) this.update(0);
    };
  }
  start() {
    if (this.disposed) return false;
    if (this.active) return true;
    this.active = true;
    this.manualPause = this.framePause = false;
    this.phase = 'idle';
    this.clock = 0;
    this.plan = [];
    this.lastContextTime = null;
    this.lastResult = null;
    this.attempts.clear();
    this.retryAt.clear();
    globalThis.document?.addEventListener?.('visibilitychange', this.visibility);
    if (!this.audio.ready) this.audio.start?.();
    return true;
  }
  preloadIntro() {
    this.request('theme');
    this.request('opening');
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
  get presentationTime() {
    return this.clock;
  }
  get introDuration() {
    return QUIZ_SHOW_INTRO_DURATION;
  }
  get lockDuration() {
    return this.tier < 6 ? 4.2 : trackInfo(this.tier < 14 ? 'final2000' : 'finalMillion').duration;
  }
  get leadRemaining() {
    return this.phase === 'question' && this.plan[0] && !this.plan[0].loop
      ? Math.max(0, this.plan[0].duration - this.clock)
      : 0;
  }
  touch(key) {
    const value = this.buffers.get(key);
    if (value) {
      this.buffers.delete(key);
      this.buffers.set(key, value);
    }
    return value;
  }
  trim() {
    let bytes = [...this.buffers.values()].reduce(
      (n, b) => n + b.length * b.numberOfChannels * 4,
      0,
    );
    const pinned = new Set([...this.tracks.values()].map((t) => cacheId(t.key, t.loop)));
    for (const [key, b] of this.buffers) {
      if (bytes <= CACHE_LIMIT) break;
      if (!pinned.has(key)) {
        this.buffers.delete(key);
        bytes -= b.length * b.numberOfChannels * 4;
      }
    }
  }
  request(key, loop = false) {
    const cache = cacheId(key, loop),
      id = sourceId(key, loop),
      now = this.audio.ctx?.currentTime || 0;
    if (
      this.buffers.has(cache) ||
      this.pending.has(cache) ||
      !this.audio.bank ||
      (this.attempts.get(cache) || 0) >= 3 ||
      now < (this.retryAt.get(cache) || 0)
    )
      return;
    const epoch = this.epoch;
    this.attempts.set(cache, (this.attempts.get(cache) || 0) + 1);
    this.retryAt.set(cache, now + 2);
    this.audio.bank.failures?.delete(id);
    const promise = Promise.resolve()
      .then(() => (this.disposed || epoch !== this.epoch ? null : this.audio.bank.get(id)))
      .then((buffer) => {
        if (!buffer || this.disposed || epoch !== this.epoch) return;
        this.buffers.set(cache, buffer);
        this.trim();
        if (this.clock === 0) this.lastContextTime = this.audio.ctx?.currentTime ?? null;
      })
      .catch(() => {})
      .finally(() => {
        if (this.pending.get(cache) === promise) this.pending.delete(cache);
        if (this.active && !this.disposed && epoch === this.epoch) this.update(0);
      });
    this.pending.set(cache, promise);
  }
  halt(track, fade = 0) {
    const h = track.handle;
    if (!h) return;
    if (track.slot === 'sting')
      track.offset += Math.max(0, (this.audio.ctx?.currentTime || 0) - track.startedAt);
    if (track.slot === 'bed')
      track.offset =
        track.from +
        (track.loop
          ? (this.clock - track.at + (track.clockOffset || 0)) % track.duration
          : Math.max(0, this.clock - track.at));
    h.stop(fade);
    track.handle = null;
    if (fade > 0 && !h.ended) this.retired.add(h);
  }
  haltAll() {
    for (const t of this.tracks.values()) this.halt(t);
    for (const h of this.retired)
      if (!h.ended) {
        try {
          h.source.stop(this.audio.ctx.currentTime);
        } catch {}
      }
    this.retired.clear();
  }
  remove(slot, fade = 0.08) {
    const t = this.tracks.get(slot);
    if (t) this.halt(t, fade);
    this.tracks.delete(slot);
  }
  choose() {
    let at = 0;
    for (const s of this.plan) {
      if (s.loop || this.clock < at + s.duration) return { ...s, at };
      at += s.duration;
    }
    return null;
  }
  setPlan(plan, preserve = false) {
    const previous = this.tracks.get('bed');
    if (!preserve) {
      this.clock = 0;
      this.waited = 0;
      this.silentIntroTheme = false;
      this.remove('bed', 0.3);
    }
    this.plan = plan;
    this.lastContextTime = this.audio.ctx?.currentTime ?? null;
    const chosen = this.choose();
    if (
      preserve &&
      (!chosen || !previous || chosen.key !== previous.key || !!chosen.loop !== !!previous.loop)
    )
      this.remove('bed', 0.22);
  }
  play(track) {
    // A failed opening may continue visually; never join its music halfway through.
    if (this.silentIntroTheme && track.slot === 'bed' && track.key === 'theme') return;
    if (!this.playable || (track.bus === 'music' && this.audio.sim?.s.music === false)) return;
    const buffer = this.touch(cacheId(track.key, track.loop));
    if (!buffer) {
      this.request(track.key, track.loop);
      return;
    }
    if (track.handle && !track.handle.ended && !track.handle.stopped) return;
    const local =
      track.slot === 'sting'
        ? track.offset
        : Math.max(0, this.clock - track.at + (track.clockOffset || 0));
    const offset =
      track.slot === 'sting' ? local : track.from + (track.loop ? local % track.duration : local);
    if (!track.loop && offset >= Math.min(buffer.duration, track.from + track.duration) - 0.015)
      return;
    const h = this.audio.emit(buffer, {
      loop: !!track.loop,
      bus: track.bus,
      volume: track.volume,
      offset,
      fade: track.fadeIn ?? (track.loop ? 0.25 : 0.04),
    });
    if (!h) return;
    track.handle = h;
    track.startedAt = this.audio.ctx.currentTime;
    track.offset = offset;
    if (track.loop) {
      h.source.loopStart = track.from;
      h.source.loopEnd = Math.min(buffer.duration, track.from + track.duration);
    } else if (track.slot === 'bed') {
      const seconds = Math.min(buffer.duration - offset, track.duration - local);
      if (track.fadeOut) {
        const fade = Math.min(track.fadeOut, seconds / 2);
        h.gain.gain.setTargetAtTime(0, this.audio.ctx.currentTime + seconds - fade, fade / 4);
      }
      h.source.stop(this.audio.ctx.currentTime + Math.max(0.01, seconds));
    }
  }
  cue(name, tier = this.tier, options = {}) {
    name = ALIASES[name] || name;
    if (!this.active || (!CUES.has(name) && name !== 'finale')) return false;
    this.tier = clamp(tier, 0, 14);
    if (name === 'select' || name === 'joker') {
      this.remove('sting', 0.04);
      this.tracks.set('sting', {
        slot: 'sting',
        key: name,
        loop: false,
        from: 0,
        duration: DURATIONS[name],
        offset: 0,
        handle: null,
        bus: 'ui',
        volume: 0.6,
      });
    } else {
      this.remove('sting');
      const next = quizTrackPlan(name, this.tier, options);
      let preserve = name === 'finale' && this.lastResult && next[0]?.key === this.lastResult;
      if (preserve) this.clock = Math.min(this.clock, next[0].duration);
      if (name === 'lock' && this.tier < 6 && this.tracks.get('bed')?.key === 'questionsEarly') {
        // Low-stake confirmations keep the continuous question bed playing.
        preserve = true;
        const bed = this.tracks.get('bed');
        bed.clockOffset = (this.clock - bed.at + (bed.clockOffset || 0)) % bed.duration;
        this.clock = 0;
      }
      this.setPlan(next, preserve);
      this.phase =
        name === 'intro'
          ? 'intro'
          : name === 'question'
            ? 'question'
            : ['lock', 'heartbeat'].includes(name)
              ? 'locked'
              : ['exit', 'finale'].includes(name)
                ? 'finished'
                : 'reveal';
      if (['wrong', 'correct', 'safety', 'million'].includes(name)) this.lastResult = next[0]?.key;
      else if (name !== 'finale') this.lastResult = null;
    }
    this.update(0);
    return true;
  }
  update(dt = 0, options = {}) {
    if (!this.active) return;
    for (const h of this.retired) if (h.ended) this.retired.delete(h);
    if ('paused' in options) this.framePause = !!options.paused;
    const tier = 'tier' in options ? clamp(options.tier, 0, 14) : this.tier;
    if (options.phase && (options.phase !== this.phase || tier !== this.tier)) {
      const cue =
        options.phase === 'locked'
          ? 'lock'
          : options.phase === 'question'
            ? 'question'
            : options.phase === 'intro'
              ? 'intro'
              : null;
      this.phase = options.phase;
      this.tier = tier;
      if (cue) this.setPlan(quizTrackPlan(cue, tier, { resume: true }));
    }
    const now = this.audio.ctx?.currentTime;
    let delta =
      Number.isFinite(now) && this.lastContextTime !== null
        ? Math.max(0, now - this.lastContextTime)
        : Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.lastContextTime = Number.isFinite(now) ? now : null;
    if (this.manualPause || this.framePause || hidden()) {
      this.haltAll();
      return;
    }
    const first = this.plan[0];
    if (this.clock === 0 && first && this.playable && this.audio.sim?.s.music !== false) {
      const cache = cacheId(first.key, first.loop);
      const loaded = this.buffers.has(cache);
      if (this.phase === 'intro' && first.key === 'theme' && !this.silentIntroTheme) {
        const playing = this.tracks.get('bed')?.handle;
        if (!playing || playing.stopped || playing.ended) {
          if (!loaded) this.request(first.key, first.loop);
          this.waited += delta;
          const failed =
            !loaded && !this.pending.has(cache) && (this.attempts.get(cache) || 0) >= 3;
          if (!failed && this.waited < INTRO_AUDIO_WAIT_LIMIT) delta = 0;
          else this.silentIntroTheme = true;
        }
      } else if (!loaded && !this.silentIntroTheme) {
        this.request(first.key, first.loop);
        this.waited += delta;
        if (this.waited < 4 && (this.attempts.get(cache) || 0) < 3) delta = 0;
      }
    }
    this.clock += delta;
    const chosen = this.choose(),
      old = this.tracks.get('bed');
    if (!chosen) this.remove('bed', 0.25);
    else {
      if (!old || old.key !== chosen.key || old.at !== chosen.at || !!old.loop !== !!chosen.loop) {
        this.remove('bed', 0.3);
        this.tracks.set('bed', {
          ...chosen,
          slot: 'bed',
          handle: null,
          offset: chosen.from,
          bus: 'music',
          volume:
            chosen.gain ??
            (chosen.loop ? trackInfo(chosen.key).loopGain : undefined) ??
            trackInfo(chosen.key).gain,
        });
      }
      // Decode only the next required cue, never the entire 19 MB soundtrack.
      const index = this.plan.findIndex((p) => p.key === chosen.key);
      const next = this.plan[index + 1];
      if (next && !chosen.loop && this.clock - chosen.at > Math.max(0, chosen.duration - 3))
        this.request(next.key, next.loop);
    }
    if (!this.playable) {
      this.haltAll();
      return;
    }
    for (const [slot, track] of this.tracks) {
      if (slot === 'sting' && (track.handle?.ended || track.offset >= track.duration - 0.015)) {
        this.remove(slot, 0);
        continue;
      }
      if (track.bus === 'music' && this.audio.sim?.s.music === false) {
        this.halt(track);
        continue;
      }
      this.play(track);
    }
    this.trim();
  }
  pause(value = true) {
    this.manualPause = !!value;
    this.lastContextTime = null;
    if (value) this.haltAll();
    else this.update(0);
  }
  stop() {
    this.active = false;
    this.haltAll();
    this.tracks.clear();
    this.plan = [];
    this.phase = 'idle';
    ++this.epoch;
    this.pending.clear();
    this.buffers.clear();
    this.lastContextTime = null;
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibility);
  }
  dispose() {
    this.stop();
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
      time: this.clock,
      track: this.tracks.get('bed')?.key || null,
      sources: [...this.tracks.values()].filter(
        (t) => t.handle && !t.handle.stopped && !t.handle.ended,
      ).length,
      buffers: this.buffers.size,
      bytes: [...this.buffers.values()].reduce((n, b) => n + b.length * b.numberOfChannels * 4, 0),
      limit: CACHE_LIMIT,
    };
  }
}
