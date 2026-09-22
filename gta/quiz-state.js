import { QUIZ_QUESTIONS } from './quiz-questions.js';

export const QUIZ_LADDER = Object.freeze([
  50, 100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 500000, 1000000,
]);
export const QUIZ_SAFE_LEVELS = Object.freeze([5, 10]);
export const QUIZ_SAVE_VERSION = 1;

const JOKERS = ['fifty', 'audience', 'phone'];
const LETTERS = ['A', 'B', 'C', 'D'];
const clampCount = (v) => (Number.isSafeInteger(v) ? Math.min(1000000, Math.max(0, v)) : 0);
const prize = (v) => (QUIZ_LADDER.includes(v) ? v : 0);
const safeAmount = (completed) => (completed >= 10 ? 16000 : completed >= 5 ? 500 : 0);
const copy = (v) => JSON.parse(JSON.stringify(v));
const available = (hidden) => [0, 1, 2, 3].filter((i) => !hidden.includes(i));

function hash(value) {
  let n = 2166136261;
  for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(values, random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function freshSeed() {
  if (globalThis.crypto?.getRandomValues)
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return hash(Date.now() + ':' + Math.random());
}
function makeDeck(seed) {
  const random = rng(seed);
  return QUIZ_LADDER.map((_, i) => {
    const pool = QUIZ_QUESTIONS.filter((q) => q.level === i + 1);
    const question = pool[Math.floor(random() * pool.length)];
    const order = shuffle([0, 1, 2, 3], random);
    return { question, order, correct: order.indexOf(question.correct) };
  });
}

/**
 * DOM-independent quiz rules.
 * Saves contain the seed and accepted player actions, never pre-revealed solutions.
 * This is local game state, not a security boundary against edited save files.
 */
export class QuizState {
  #s = null;
  #seed = 0;
  #deck = [];
  #events = [];
  #replaying = false;
  #stats = { bestWin: 0, bestPaid: 0, totalRuns: 0, totalWins: 0 };

  constructor(saved) {
    if (!saved || typeof saved !== 'object' || saved.version !== QUIZ_SAVE_VERSION) return;
    const paid = prize(saved.bestPaid);
    this.#stats = {
      bestPaid: paid,
      bestWin: Math.max(paid, prize(saved.bestWin)),
      totalRuns: clampCount(saved.totalRuns),
      totalWins: Math.min(clampCount(saved.totalRuns), clampCount(saved.totalWins)),
    };
    const session = saved.session;
    if (
      !session ||
      typeof session !== 'object' ||
      !Number.isInteger(session.seed) ||
      session.seed < 0 ||
      session.seed > 0xffffffff ||
      !Array.isArray(session.events)
    )
      return;
    const stats = { ...this.#stats };
    this.#replaying = true;
    this.start(session.seed);
    const accepted = [];
    let invalid = session.events.length > 256;
    const allowed = {
      begin: () => this.begin(),
      select: (v) => this.select(v),
      lock: () => this.lock(),
      reveal: () => this.reveal(),
      next: () => this.next(),
      joker: (v) => this.useJoker(v),
      walk: () => this.walkAway(),
      abort: () => this.abort(),
      claim: () => this.claimReward(),
    };
    if (!invalid)
      for (const event of session.events) {
        if (
          !event ||
          typeof event !== 'object' ||
          typeof event.type !== 'string' ||
          !Object.hasOwn(allowed, event.type)
        ) {
          invalid = true;
          break;
        }
        const before = this.#s?.claimed;
        const result = allowed[event.type](event.value);
        const valid =
          event.type === 'claim' ? before === false && this.#s?.claimed === true : result !== false;
        if (!valid) {
          invalid = true;
          break;
        }
        const clean = { type: event.type };
        if (event.type === 'select' || event.type === 'joker') clean.value = event.value;
        accepted.push(clean);
      }
    this.#replaying = false;
    this.#stats = stats;
    if (invalid) {
      // A partial or malformed save cannot manufacture a prize or skip a question.
      this.#s = null;
      this.#deck = [];
      this.#events = [];
    } else {
      this.#events = accepted;
      if (this.#s?.phase === 'finished')
        this.#stats.bestWin = Math.max(this.#stats.bestWin, this.#s.payout);
    }
  }

  #record(type, value) {
    if (this.#replaying) return;
    const event = { type };
    if (value !== undefined) event.value = value;
    if (type === 'select' && this.#events.at(-1)?.type === 'select')
      this.#events[this.#events.length - 1] = event;
    else this.#events.push(event);
  }

  start(seed = freshSeed()) {
    if (this.#s && this.#s.phase !== 'finished') return false;
    if (this.#s && !this.#s.claimed && this.#s.payout > this.#stats.bestPaid) return false;
    if (
      !(typeof seed === 'string' || typeof seed === 'number') ||
      (typeof seed === 'number' && !Number.isFinite(seed))
    )
      return false;
    this.#seed = typeof seed === 'number' ? seed >>> 0 : hash(seed);
    this.#deck = makeDeck(this.#seed);
    this.#events = [];
    this.#s = {
      phase: 'intro',
      index: 0,
      completed: 0,
      selection: null,
      hidden: [],
      hints: {},
      jokers: { fifty: true, audience: true, phone: true },
      reveal: null,
      payout: 0,
      outcome: null,
      claimed: false,
    };
    if (!this.#replaying) this.#stats.totalRuns = clampCount(this.#stats.totalRuns + 1);
    return true;
  }

  begin() {
    if (this.#s?.phase !== 'intro') return false;
    this.#s.phase = 'question';
    this.#record('begin');
    return true;
  }

  select(index) {
    if (
      this.#s?.phase !== 'question' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 3 ||
      this.#s.hidden.includes(index)
    )
      return false;
    // Repeated clicks do not enlarge the save or create duplicate input events.
    if (this.#s.selection === index) return false;
    this.#s.selection = index;
    this.#record('select', index);
    return true;
  }

  lock() {
    if (this.#s?.phase !== 'question' || this.#s.selection === null) return false;
    this.#s.phase = 'locked';
    this.#record('lock');
    return true;
  }

  reveal() {
    if (this.#s?.phase !== 'locked') return false;
    const item = this.#deck[this.#s.index];
    const correct = this.#s.selection === item.correct;
    this.#s.reveal = {
      correct,
      correctIndex: item.correct,
      explanation: item.question.explanation,
    };
    if (correct) this.#s.completed = this.#s.index + 1;
    this.#s.phase = 'reveal';
    this.#record('reveal');
    return true;
  }

  next() {
    if (this.#s?.phase !== 'reveal') return false;
    if (!this.#s.reveal.correct) this.#finish('wrong', safeAmount(this.#s.completed));
    else if (this.#s.completed === 15) this.#finish('win', 1000000);
    else {
      this.#s.index++;
      this.#s.phase = 'question';
      this.#s.selection = null;
      this.#s.hidden = [];
      this.#s.hints = {};
      this.#s.reveal = null;
    }
    this.#record('next');
    return true;
  }

  #finish(outcome, payout) {
    this.#s.phase = 'finished';
    this.#s.outcome = outcome;
    this.#s.payout = payout;
    this.#stats.bestWin = Math.max(this.#stats.bestWin, payout);
    if (outcome === 'win' && !this.#replaying)
      this.#stats.totalWins = clampCount(this.#stats.totalWins + 1);
  }

  walkAway() {
    if (!['intro', 'question'].includes(this.#s?.phase)) return false;
    this.#finish('walk-away', QUIZ_LADDER[this.#s.completed - 1] || 0);
    this.#record('walk');
    return true;
  }

  abort() {
    if (!this.#s || this.#s.phase === 'finished') return false;
    this.#finish('abort', 0);
    this.#record('abort');
    return true;
  }

  useJoker(kind) {
    if (this.#s?.phase !== 'question' || !JOKERS.includes(kind) || !this.#s.jokers[kind])
      return false;
    const item = this.#deck[this.#s.index];
    const random = rng(hash(this.#seed + ':' + this.#s.index + ':' + kind));
    const candidates = available(this.#s.hidden);
    let result;
    if (kind === 'fifty') {
      this.#s.hidden = shuffle(
        candidates.filter((i) => i !== item.correct),
        random,
      )
        .slice(0, 2)
        .sort();
      if (this.#s.hidden.includes(this.#s.selection)) this.#s.selection = null;
      result = { hidden: [...this.#s.hidden] };
    } else if (kind === 'audience') {
      const correctLeads = random() < 0.97 - this.#s.index * 0.02;
      const pick = correctLeads
        ? item.correct
        : candidates[Math.floor(random() * candidates.length)];
      const weights = candidates.map((i) => (i === pick ? 3.5 + random() * 3 : 0.25 + random()));
      const total = weights.reduce((a, b) => a + b, 0);
      const percentages = [0, 0, 0, 0];
      candidates.forEach((i, n) => {
        percentages[i] = Math.floor((weights[n] / total) * 100);
      });
      percentages[pick] += 100 - percentages.reduce((a, b) => a + b, 0);
      this.#s.hints.audience = percentages;
      result = { percentages: [...percentages] };
    } else {
      const confident = random() < 0.96 - this.#s.index * 0.015;
      const pick = confident ? item.correct : candidates[Math.floor(random() * candidates.length)];
      const name = 'Benjamin';
      const line =
        name +
        ': Ich würde ' +
        LETTERS[pick] +
        ' nehmen. ' +
        (this.#s.index < 7
          ? 'Die Datenlage sieht gut aus. Kaffee ist trotzdem keine Quelle.'
          : 'Eine belastbare Hypothese. Die finale Freigabe liegt bei dir.');
      this.#s.hints.phone = { pick, name, line };
      result = { pick, name, line };
    }
    this.#s.jokers[kind] = false;
    this.#record('joker', kind);
    return { kind, ...result };
  }

  claimReward() {
    if (this.#s?.phase !== 'finished' || this.#s.claimed) return 0;
    const value = Math.max(0, this.#s.payout - this.#stats.bestPaid);
    this.#stats.bestPaid = Math.max(this.#stats.bestPaid, this.#s.payout);
    this.#s.claimed = true;
    this.#record('claim');
    return value;
  }

  view() {
    const s = this.#s;
    const item = s ? this.#deck[s.index] : null;
    const phase = s?.phase || 'idle';
    return {
      phase,
      level: s ? s.index + 1 : 1,
      completed: s?.completed || 0,
      question: item
        ? {
            id: item.question.id,
            text: item.question.text,
            category: item.question.category,
            answers: item.order.map((i) => item.question.answers[i]),
            source: item.question.source,
          }
        : null,
      selection: s?.selection ?? null,
      hidden: [...(s?.hidden || [])],
      hints: copy(s?.hints || {}),
      jokers: { ...(s?.jokers || { fifty: true, audience: true, phone: true }) },
      won: QUIZ_LADDER[(s?.completed || 0) - 1] || 0,
      safe: safeAmount(s?.completed || 0),
      payout: s?.payout || 0,
      claimed: s?.claimed || false,
      bestWin: this.#stats.bestWin,
      bestPaid: this.#stats.bestPaid,
      totalRuns: this.#stats.totalRuns,
      totalWins: this.#stats.totalWins,
      reveal: s?.reveal ? { ...s.reveal } : null,
      outcome: s?.outcome || null,
      reward: phase === 'finished' && !s.claimed ? Math.max(0, s.payout - this.#stats.bestPaid) : 0,
      can: {
        start: !s || (phase === 'finished' && (s.claimed || s.payout <= this.#stats.bestPaid)),
        select: phase === 'question',
        lock: phase === 'question' && s.selection !== null,
        reveal: phase === 'locked',
        next: phase === 'reveal',
        walkAway: ['intro', 'question'].includes(phase),
        jokers: phase === 'question',
        claim: phase === 'finished' && !s.claimed,
      },
    };
  }

  serialize() {
    return {
      version: QUIZ_SAVE_VERSION,
      ...this.#stats,
      session: this.#s ? { seed: this.#seed, events: copy(this.#events) } : null,
    };
  }
}
