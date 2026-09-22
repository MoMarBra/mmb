/** Saved chapter checkpoints are independent of the existing career and direct-start route. */
export const ORIGIN_HOME = Object.freeze({ x: -14.4, z: 110, name: 'Zuhause · Augustenstraße' });
export const ORIGIN_KITCHEN = Object.freeze({
  x: 14.4,
  z: 70,
  name: 'Zitronengras · Deine Schicht',
});
export const ORIGIN_ROUTE = Object.freeze([
  { x: 14.4, z: 70 },
  { x: 14.4, z: 62 },
  { x: 14.4, z: 52 },
  { x: 14.4, z: 45.2 },
  { x: 22, z: 45.2 },
  { x: 31, z: 45.2 },
]);
export const ORIGIN_PHASES = [
  'new',
  'home',
  'commute',
  'kitchen',
  'shifts',
  'offer',
  'escort',
  'arrival',
  'complete',
];
export const freshOriginStory = () => ({
  phase: 'new',
  level: 0,
  scores: [],
  paid: [false, false, false, false],
  rewardClaimed: false,
  route: 0,
});
export function normalizeOriginStory(v) {
  const s = freshOriginStory();
  if (!v || typeof v !== 'object') return s;
  s.level = Math.min(4, Math.max(0, Math.floor(Number(v.level) || 0)));
  s.phase = ORIGIN_PHASES.includes(v.phase) ? v.phase : 'new';
  s.scores = Array.from({ length: s.level }, (_, i) =>
    Math.min(100, Math.max(0, Number(v.scores?.[i]) || 0)),
  );
  s.paid = Array.from({ length: 4 }, (_, i) => v.paid?.[i] === true);
  s.rewardClaimed = v.rewardClaimed === true;
  s.route = Math.min(ORIGIN_ROUTE.length - 1, Math.max(0, Math.floor(Number(v.route) || 0)));
  if (['offer', 'escort', 'arrival', 'complete'].includes(s.phase) && s.level < 4)
    s.phase = 'shifts';
  if (s.phase === 'shifts' && s.level === 4) s.phase = 'offer';
  return s;
}
export const RECIPES = Object.freeze([
  {
    name: 'Rotes Thai-Curry',
    subtitle: 'Der erste Service',
    protein: 'Huhn',
    sauce: 'Kokosmilch + rotes Curry',
    color: '#d88139',
    ingredients: ['Huhn', 'Gemüse', 'Currypaste'],
    garnish: ['Reis', 'Curry', 'Kräuter'],
    ideal: [54, 77],
    speed: 3.8,
    target: 76,
    deadline: 75,
    reward: 18,
  },
  {
    name: 'Garnelen-Pad-Thai',
    subtitle: 'Alles zur gleichen Zeit',
    protein: 'Garnelen',
    sauce: 'Nudeln + Woksoße',
    color: '#bc8d52',
    ingredients: ['Garnelen', 'Gemüse', 'Reisbandnudeln'],
    garnish: ['Erdnüsse', 'Röstzwiebeln', 'Kräuter'],
    ideal: [62, 84],
    speed: 4.0,
    target: 80,
    deadline: 68,
    reward: 24,
  },
  {
    name: 'Tofu in Hoisin',
    subtitle: 'Die ruhige Hand',
    protein: 'Tofu',
    sauce: 'Hoisinsoße',
    color: '#8e5031',
    ingredients: ['Tofu', 'Bambus + Morcheln', 'Paprika'],
    garnish: ['Reis', 'Hoisin-Tofu', 'Kräuter'],
    ideal: [49, 68],
    speed: 3.6,
    target: 82,
    deadline: 64,
    reward: 30,
  },
  {
    name: 'Knusperente · Thai-Curry',
    subtitle: 'Ein Tisch verändert alles',
    protein: 'Ente',
    sauce: 'Kokosmilch + rotes Curry',
    color: '#bd6b2e',
    ingredients: ['Ente', 'Gemüse', 'Currypaste'],
    garnish: ['Reis', 'Curry', 'Entenstreifen'],
    ideal: [66, 86],
    speed: 4.1,
    target: 85,
    deadline: 60,
    reward: 38,
  },
]);
/** Short drag-and-stir rounds. Progress belongs to the simulation, never to animation frames. */
export class CookingRound {
  constructor(level) {
    this.level = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
    this.recipe = RECIPES[this.level];
    this.phase = 'prep';
    this.added = [];
    this.step = 0;
    this.elapsed = 0;
    this.stirred = 0;
    this.cooked = 0;
    this.burn = 0;
    this.dry = 0;
    this.plate = 0;
    this.serveTime = 0;
    this.deadline = 25 - this.level;
    this.stirSeconds = 9 + this.level;
  }
  select(value) {
    if (
      !['prep', 'sear'].includes(this.phase) ||
      !this.recipe.ingredients.includes(value) ||
      this.added.includes(value)
    )
      return false;
    this.added.push(value);
    this.step = this.added.length;
    if (this.step === this.recipe.ingredients.length) this.phase = 'sear';
    return true;
  }
  tick(dt, stir = false) {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    if (this.phase === 'serve') {
      this.serveTime += dt;
      if (this.serveTime >= 1.1) {
        this.phase = 'done';
        this.plate = 3;
      }
      return;
    }
    if (!['prep', 'sear'].includes(this.phase)) return;
    if (this.step) this.elapsed += dt;
    if (this.elapsed >= this.deadline) {
      this.phase = 'failed';
      return;
    }
    if (this.phase === 'sear') {
      this.dry = Math.max(0, this.dry + dt * (stir ? -4 : 1));
      if (stir) {
        this.stirred += dt;
        this.cooked = Math.min(100, (this.stirred / this.stirSeconds) * 100);
      }
      this.burn += dt * Math.max(0, this.dry - 1.5) * (2 + this.level * 0.25);
      if (this.burn >= 28) {
        this.phase = 'failed';
        return;
      }
      if (this.cooked >= 100) {
        this.phase = 'serve';
        this.serveTime = 0;
        return;
      }
    }
  }
  finishSear() {
    return this.phase === 'serve' || this.phase === 'done';
  }
  get score() {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(100 - this.burn * 1.25 - Math.max(0, this.elapsed - this.stirSeconds - 4) * 0.8),
      ),
    );
  }
  get passed() {
    return this.phase === 'done' && this.score >= 65;
  }
}
export function completeShift(sim, round) {
  const s = sim.s.originStory;
  if (!round.passed || s.phase !== 'shifts' || round.level !== s.level) return null;
  const level = s.level,
    reward = s.paid[level] ? 0 : RECIPES[level].reward;
  s.paid[level] = true;
  s.scores[level] = round.score;
  s.level++;
  if (s.level === 4) s.phase = 'offer';
  if (reward) sim.transaction(reward, 'Zitronengras · Service ' + s.level);
  sim.save();
  return { level: s.level, reward, score: round.score };
}
export function completeOrigin(sim) {
  const s = sim.s.originStory;
  if (s.level !== 4 || s.phase !== 'arrival') return false;
  const paid = !s.rewardClaimed;
  s.phase = 'complete';
  s.rewardClaimed = true;
  if (paid) {
    sim.s.xp += 60;
    sim.change('rep', 4);
    sim.change('happy', 12);
  }
  sim.save();
  return paid;
}
