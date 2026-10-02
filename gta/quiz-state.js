import {
  QUIZ_QUESTIONS,
  QUIZ_V2_QUESTIONS,
  QUIZ_V3_QUESTIONS,
  QUIZ_LEGACY_QUESTIONS,
  QUIZ_DISCOVERIES,
} from './quiz-questions.js';

export const QUIZ_LADDER = Object.freeze([
  50, 100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 500000, 1000000,
]);
export const QUIZ_SAFE_LEVELS = Object.freeze([5, 10]);
export const QUIZ_SAVE_VERSION = 4;
const CURRENT_BANK_VERSION = 4;
export const QUIZ_MODES = Object.freeze({
  classic: Object.freeze({
    title: 'Die große Show',
    levels: Object.freeze(Array.from({ length: 15 }, (_, i) => i + 1)),
    ladder: QUIZ_LADDER,
    safeLevels: QUIZ_SAFE_LEVELS,
  }),
  coffee: Object.freeze({
    title: 'Die Kaffeepause',
    levels: Object.freeze([1, 4, 7, 10, 13]),
    ladder: Object.freeze([5, 10, 20, 35, 60]),
    safeLevels: Object.freeze([3]),
  }),
});
const JOKERS = ['fifty', 'audience', 'phone'];
const LETTERS = ['A', 'B', 'C', 'D'];
const QUESTION_BANKS = new Map([
  [1, QUIZ_LEGACY_QUESTIONS],
  [2, QUIZ_V2_QUESTIONS],
  [3, QUIZ_V3_QUESTIONS],
  [4, QUIZ_QUESTIONS],
]);
const QUESTIONS_BY_BANK = new Map(
  [...QUESTION_BANKS].map(([version, bank]) => [version, new Map(bank.map((q) => [q.id, q]))]),
);
// History deliberately recognizes IDs from every release, including unchanged
// questions reused in a new bank. Active decks resolve only inside their bank:
// an ID reused at another tier must never change a resumed question or joker.
const ALL_QUESTIONS = new Map([...QUESTION_BANKS.values()].flat().map((q) => [q.id, q]));
const clampCount = (v) => (Number.isSafeInteger(v) ? Math.min(1000000, Math.max(0, v)) : 0);
const prize = (v, mode = 'classic') => (QUIZ_MODES[mode].ladder.includes(v) ? v : 0);
const copy = (v) => JSON.parse(JSON.stringify(v));
const available = (hidden) => [0, 1, 2, 3].filter((i) => !hidden.includes(i));
const cleanDiscoveries = (value) =>
  new Set(Array.isArray(value) ? value.filter((id) => Object.hasOwn(QUIZ_DISCOVERIES, id)) : []);
const safeAmount = (completed, mode = 'classic') => {
  const cfg = QUIZ_MODES[mode];
  const safe = cfg.safeLevels.filter((n) => n <= completed).at(-1);
  return cfg.ladder[safe - 1] || 0;
};
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
function makeDeck(seed, mode = 'classic', history = [], bankVersion = CURRENT_BANK_VERSION) {
  const random = rng(seed);
  const bank = QUESTION_BANKS.get(bankVersion);
  return QUIZ_MODES[mode].levels.map((level) => {
    let pool = bank.filter((q) => q.level === level);
    if (bankVersion !== 1) {
      // Exhaust unseen questions before recycling the least recently seen one.
      const age = Math.min(...pool.map((q) => history.lastIndexOf(q.id)));
      pool = pool.filter((q) => history.lastIndexOf(q.id) === age);
    }
    const question = pool[Math.floor(random() * pool.length)];
    const order = shuffle([0, 1, 2, 3], random);
    return { question, order, correct: order.indexOf(question.correct) };
  });
}
function restoreDeck(saved, mode, bankVersion) {
  const levels = QUIZ_MODES[mode].levels;
  if (!Array.isArray(saved) || saved.length !== levels.length) return null;
  const bank = QUESTIONS_BY_BANK.get(bankVersion);
  const deck = [];
  for (let i = 0; i < saved.length; i++) {
    const row = saved[i],
      question = bank.get(row?.id),
      order = row?.order;
    if (
      !question ||
      question.level !== levels[i] ||
      !Array.isArray(order) ||
      order.length !== 4 ||
      !order.every(Number.isInteger) ||
      [...order].sort().join('') !== '0123'
    )
      return null;
    deck.push({ question, order: [...order], correct: order.indexOf(question.correct) });
  }
  return deck;
}

/** Local quiz rules. Saved decks contain IDs and answer order, not revealed solutions.
 * Seed/action v1 and explicit-deck v2/v3 sessions retain their immutable banks. */
export class QuizState {
  #s = null;
  #seed = 0;
  #deck = [];
  #events = [];
  #replaying = false;
  #mode = 'classic';
  #bankVersion = CURRENT_BANK_VERSION;
  #history = [];
  #discoveries = new Set();
  #preferredMode = 'classic';
  #introSeen = false;
  #stats = {
    bestWin: 0,
    bestPaid: 0,
    totalRuns: 0,
    totalWins: 0,
    coffeeBestWin: 0,
    coffeeBestPaid: 0,
    coffeeRuns: 0,
    coffeeWins: 0,
    classicWins: 0,
    answered: 0,
    correct: 0,
    cleanSweeps: 0,
  };

  constructor(saved, context = {}) {
    this.#discoveries = cleanDiscoveries(context.discoveries);
    if (!saved || typeof saved !== 'object' || ![1, 2, 3, 4].includes(saved.version)) return;
    const paid = prize(saved.bestPaid),
      coffeePaid = prize(saved.coffeeBestPaid, 'coffee');
    const runs = clampCount(saved.totalRuns),
      wins = Math.min(runs, clampCount(saved.totalWins));
    const coffeeRuns = Math.min(runs, clampCount(saved.coffeeRuns));
    const coffeeWins = Math.min(wins, coffeeRuns, clampCount(saved.coffeeWins));
    this.#stats = {
      bestPaid: paid,
      bestWin: Math.max(paid, prize(saved.bestWin)),
      totalRuns: runs,
      totalWins: wins,
      coffeeBestPaid: coffeePaid,
      coffeeBestWin: Math.max(coffeePaid, prize(saved.coffeeBestWin, 'coffee')),
      coffeeRuns,
      coffeeWins,
      classicWins: Math.min(wins - coffeeWins, clampCount(saved.classicWins ?? wins - coffeeWins)),
      answered: clampCount(saved.answered),
      correct: Math.min(clampCount(saved.answered), clampCount(saved.correct)),
      cleanSweeps: clampCount(saved.cleanSweeps),
    };
    this.#preferredMode = Object.hasOwn(QUIZ_MODES, saved.preferredMode)
      ? saved.preferredMode
      : 'classic';
    this.#introSeen = saved.introSeen === true;
    this.#history = Array.isArray(saved.history)
      ? [...new Set(saved.history.filter((id) => ALL_QUESTIONS.has(id)))].slice(-150)
      : [];
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
    const legacy = saved.version === 1;
    const mode = legacy ? 'classic' : session.mode;
    const bankVersion = legacy ? 1 : session.bankVersion;
    if (
      !Object.hasOwn(QUIZ_MODES, mode) ||
      !QUESTION_BANKS.has(bankVersion) ||
      (bankVersion === 1 && mode !== 'classic')
    )
      return;
    const deck = legacy
      ? makeDeck(session.seed, 'classic', [], 1)
      : restoreDeck(session.deck, mode, bankVersion);
    if (!deck) return;
    const stats = { ...this.#stats };
    this.#replaying = true;
    this.#initialize(session.seed, mode, deck, bankVersion);
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
        const before = this.#s?.claimed,
          result = allowed[event.type](event.value);
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
      this.#s = null;
      this.#deck = [];
      this.#events = [];
    } else this.#events = accepted;
  }
  #initialize(seed, mode, deck, bankVersion = CURRENT_BANK_VERSION) {
    this.#seed = seed;
    this.#mode = mode;
    this.#deck = deck;
    this.#bankVersion = bankVersion;
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
  }
  #record(type, value) {
    if (this.#replaying) return;
    const event = { type };
    if (value !== undefined) event.value = value;
    if (type === 'select' && this.#events.at(-1)?.type === 'select')
      this.#events[this.#events.length - 1] = event;
    else this.#events.push(event);
  }
  #touch() {
    if (this.#replaying) return;
    const id = this.#deck[this.#s.index].question.id;
    this.#history = this.#history.filter((value) => value !== id);
    this.#history.push(id);
    this.#history = this.#history.slice(-150);
  }
  #bestPaid() {
    return this.#mode === 'coffee' ? this.#stats.coffeeBestPaid : this.#stats.bestPaid;
  }
  #reward() {
    return this.#s && !this.#s.claimed ? Math.max(0, this.#s.payout - this.#bestPaid()) : 0;
  }

  setPreferredMode(mode) {
    if (!Object.hasOwn(QUIZ_MODES, mode)) return false;
    this.#preferredMode = mode;
    return true;
  }
  markIntroSeen() {
    this.#introSeen = true;
    return true;
  }
  setDiscoveries(values) {
    this.#discoveries = cleanDiscoveries(values);
  }
  start(seed = freshSeed(), options = {}) {
    if (this.#s && this.#s.phase !== 'finished') return false;
    if (this.#s && !this.#s.claimed && this.#reward() > 0) return false;
    if (
      !(typeof seed === 'string' || typeof seed === 'number') ||
      (typeof seed === 'number' && !Number.isFinite(seed))
    )
      return false;
    const mode = options.mode ?? this.#preferredMode;
    if (!Object.hasOwn(QUIZ_MODES, mode)) return false;
    if (options.discoveries !== undefined)
      this.#discoveries = cleanDiscoveries(options.discoveries);
    const value = typeof seed === 'number' ? seed >>> 0 : hash(seed);
    this.#initialize(value, mode, makeDeck(value, mode, this.#history));
    this.#preferredMode = mode;
    this.#stats.totalRuns = clampCount(this.#stats.totalRuns + 1);
    if (mode === 'coffee') this.#stats.coffeeRuns = clampCount(this.#stats.coffeeRuns + 1);
    return true;
  }
  restartIntro(mode) {
    if (!Object.hasOwn(QUIZ_MODES, mode) || this.#s?.phase !== 'intro' || this.#events.length !== 0)
      return false;
    if (this.#mode === mode) {
      this.#preferredMode = mode;
      return true;
    }
    if (this.#mode === 'coffee') this.#stats.coffeeRuns = Math.max(0, this.#stats.coffeeRuns - 1);
    if (mode === 'coffee') this.#stats.coffeeRuns = clampCount(this.#stats.coffeeRuns + 1);
    this.#initialize(this.#seed, mode, makeDeck(this.#seed, mode, this.#history));
    this.#preferredMode = mode;
    return true;
  }
  begin() {
    if (this.#s?.phase !== 'intro') return false;
    this.#s.phase = 'question';
    this.#touch();
    this.#record('begin');
    return true;
  }
  select(index) {
    if (
      this.#s?.phase !== 'question' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 3 ||
      this.#s.hidden.includes(index) ||
      this.#s.selection === index
    )
      return false;
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
    const item = this.#deck[this.#s.index],
      correct = this.#s.selection === item.correct;
    this.#s.reveal = {
      correct,
      correctIndex: item.correct,
      explanation: item.question.explanation,
    };
    if (correct) this.#s.completed = this.#s.index + 1;
    if (!this.#replaying) {
      this.#stats.answered = clampCount(this.#stats.answered + 1);
      if (correct) this.#stats.correct = clampCount(this.#stats.correct + 1);
    }
    this.#s.phase = 'reveal';
    this.#record('reveal');
    return true;
  }
  next() {
    if (this.#s?.phase !== 'reveal') return false;
    const cfg = QUIZ_MODES[this.#mode];
    if (!this.#s.reveal.correct) this.#finish('wrong', safeAmount(this.#s.completed, this.#mode));
    else if (this.#s.completed === cfg.levels.length) this.#finish('win', cfg.ladder.at(-1));
    else {
      this.#s.index++;
      this.#s.phase = 'question';
      this.#s.selection = null;
      this.#s.hidden = [];
      this.#s.hints = {};
      this.#s.reveal = null;
      this.#touch();
    }
    this.#record('next');
    return true;
  }
  #finish(outcome, payout) {
    this.#s.phase = 'finished';
    this.#s.outcome = outcome;
    this.#s.payout = payout;
    const bestKey = this.#mode === 'coffee' ? 'coffeeBestWin' : 'bestWin';
    this.#stats[bestKey] = Math.max(this.#stats[bestKey], payout);
    if (outcome === 'win' && !this.#replaying) {
      this.#stats.totalWins = clampCount(this.#stats.totalWins + 1);
      const winKey = this.#mode === 'coffee' ? 'coffeeWins' : 'classicWins';
      this.#stats[winKey] = clampCount(this.#stats[winKey] + 1);
      if (this.#mode === 'classic' && Object.values(this.#s.jokers).every(Boolean))
        this.#stats.cleanSweeps = clampCount(this.#stats.cleanSweeps + 1);
    }
  }
  walkAway() {
    if (!['intro', 'question'].includes(this.#s?.phase)) return false;
    this.#finish('walk-away', QUIZ_MODES[this.#mode].ladder[this.#s.completed - 1] || 0);
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
    const candidates = available(this.#s.hidden),
      difficulty = item.question.level - 1;
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
      const correctLeads = random() < 0.97 - difficulty * 0.02;
      const pick = correctLeads
        ? item.correct
        : candidates[Math.floor(random() * candidates.length)];
      const weights = candidates.map((i) => (i === pick ? 3.5 + random() * 3 : 0.25 + random()));
      const total = weights.reduce((a, b) => a + b, 0),
        percentages = [0, 0, 0, 0];
      candidates.forEach((i, n) => {
        percentages[i] = Math.floor((weights[n] / total) * 100);
      });
      percentages[pick] += 100 - percentages.reduce((a, b) => a + b, 0);
      this.#s.hints.audience = percentages;
      result = { percentages: [...percentages] };
    } else {
      const confident = random() < 0.96 - difficulty * 0.015;
      const pick = confident ? item.correct : candidates[Math.floor(random() * candidates.length)];
      const name = 'Benjamin';
      const line =
        name +
        ': Ich würde ' +
        LETTERS[pick] +
        ' nehmen. ' +
        (difficulty < 7
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
    const value = this.#reward(),
      key = this.#mode === 'coffee' ? 'coffeeBestPaid' : 'bestPaid';
    this.#stats[key] = Math.max(this.#stats[key], this.#s.payout);
    this.#s.claimed = true;
    this.#record('claim');
    return value;
  }
  view() {
    const s = this.#s,
      item = s ? this.#deck[s.index] : null,
      phase = s?.phase || 'idle';
    const mode = s ? this.#mode : this.#preferredMode,
      cfg = QUIZ_MODES[mode];
    const ranks = [
      ['newcomer', 'Frisch im Studio', 0],
      ['facts', 'Faktenfinder', 5],
      ['analyst', 'Quiz-Analyst', 20],
      ['senior', 'Senior Quizzultant', 50],
      ['legend', 'Studiolegende', 100],
      ['partner', 'Quizssoir Partner', 200],
    ];
    const score = this.#stats.correct;
    const ri = ranks.findLastIndex((row) => score >= row[2]),
      r = ranks[ri],
      next = ranks[ri + 1];
    const rank = {
      id: r[0],
      title: r[1],
      correct: score,
      nextAt: next?.[2] ?? null,
      progress: next ? Math.min(1, (score - r[2]) / (next[2] - r[2])) : 1,
    };
    const trophies = [
      { id: 'coffee-win', title: 'Espresso-Experte', earned: this.#stats.coffeeWins > 0 },
      {
        id: 'classic-win',
        title: 'Die goldene Million',
        earned: this.#stats.classicWins > 0 || this.#stats.bestWin === 1000000,
      },
      { id: 'clean-sweep', title: 'Ohne Sicherheitsnetz', earned: this.#stats.cleanSweeps > 0 },
      { id: 'explorer', title: 'Wissen aus erster Hand', earned: this.#discoveries.size === 3 },
    ];
    const unlocked = item?.question.discovery && this.#discoveries.has(item.question.discovery);
    return {
      phase,
      mode,
      preferredMode: this.#preferredMode,
      introSeen: this.#introSeen,
      shortIntro: this.#introSeen || mode === 'coffee',
      totalLevels: cfg.levels.length,
      ladder: [...cfg.ladder],
      safeLevels: [...cfg.safeLevels],
      level: s ? s.index + 1 : 1,
      difficultyLevel: item?.question.level || cfg.levels[0],
      completed: s?.completed || 0,
      question: item
        ? {
            id: item.question.id,
            level: item.question.level,
            text: item.question.text,
            category: item.question.category,
            answers: item.order.map((i) => item.question.answers[i]),
            source: item.question.source,
            visual: copy(item.question.visual || null),
            discovery: unlocked ? { ...QUIZ_DISCOVERIES[item.question.discovery] } : null,
          }
        : null,
      selection: s?.selection ?? null,
      hidden: [...(s?.hidden || [])],
      hints: copy(s?.hints || {}),
      jokers: { ...(s?.jokers || { fifty: true, audience: true, phone: true }) },
      won: cfg.ladder[(s?.completed || 0) - 1] || 0,
      safe: safeAmount(s?.completed || 0, mode),
      payout: s?.payout || 0,
      claimed: s?.claimed || false,
      ...this.#stats,
      stats: { ...this.#stats },
      rank,
      trophies,
      discoveries: [...this.#discoveries],
      reveal: s?.reveal ? { ...s.reveal } : null,
      outcome: s?.outcome || null,
      reward: phase === 'finished' ? this.#reward() : 0,
      can: {
        start: !s || (phase === 'finished' && (s.claimed || this.#reward() === 0)),
        select: phase === 'question',
        lock: phase === 'question' && s.selection !== null,
        reveal: phase === 'locked',
        next: phase === 'reveal',
        walkAway: ['intro', 'question'].includes(phase),
        jokers: phase === 'question',
        claim: phase === 'finished' && !s.claimed,
        switchMode: phase === 'intro' && this.#events.length === 0,
      },
    };
  }
  serialize() {
    return {
      version: QUIZ_SAVE_VERSION,
      ...this.#stats,
      history: [...this.#history],
      preferredMode: this.#preferredMode,
      introSeen: this.#introSeen,
      session: this.#s
        ? {
            seed: this.#seed,
            mode: this.#mode,
            bankVersion: this.#bankVersion,
            deck: this.#deck.map((item) => ({ id: item.question.id, order: [...item.order] })),
            events: copy(this.#events),
          }
        : null,
    };
  }
}
