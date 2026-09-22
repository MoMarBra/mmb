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
/** Deterministic, framerate-independent kitchen simulation; rendering never owns scoring. */
export class CookingRound {
  constructor(level) {
    this.level = Math.max(0, Math.min(3, level));
    this.recipe = RECIPES[this.level];
    this.phase = 'prep';
    this.step = 0;
    this.heat = 35;
    this.power = 55;
    this.cooked = 0;
    this.burn = 0;
    this.elapsed = 0;
    this.stirred = 0;
    this.dry = 0;
    this.mistakes = 0;
    this.plate = 0;
    this.qualityTime = 0;
    this.searTime = 0;
    this.feedback = 'Zutaten in der angegebenen Reihenfolge vorbereiten.';
  }
  select(value) {
    if (this.phase !== 'prep' && this.phase !== 'plate') return false;
    const list = this.phase === 'prep' ? this.recipe.ingredients : this.recipe.garnish;
    const index = this.phase === 'prep' ? this.step : this.plate;
    if (value !== list[index]) {
      this.mistakes++;
      this.feedback = 'Fast. Jetzt: ' + list[index];
      return false;
    }
    this.feedback = value + ' · sitzt.';
    if (this.phase === 'prep') {
      if (++this.step === list.length) {
        this.phase = 'sear';
        this.feedback = 'Hitze im grünen Bereich halten. Leertaste zum Rühren.';
      }
    } else if (++this.plate === list.length) {
      this.phase = 'done';
      this.feedback = 'Service!';
    }
    return true;
  }
  tick(dt, stir = false) {
    if (this.phase !== 'sear') return;
    dt = Math.max(0, Math.min(dt, 0.1));
    this.elapsed += dt;
    this.searTime += dt;
    this.heat += (this.power - this.heat) * (1 - Math.exp(-dt * 1.4));
    const good = this.heat >= this.recipe.ideal[0] && this.heat <= this.recipe.ideal[1];
    this.qualityTime += good ? dt : 0;
    this.stirred += stir ? dt : 0;
    this.dry = Math.max(0, this.dry + dt * (stir ? -3 : 1));
    this.cooked += dt * this.recipe.speed * Math.max(0, (this.heat - 25) / 45) * (stir ? 0.88 : 1);
    this.burn +=
      dt *
      (Math.max(0, this.heat - this.recipe.ideal[1]) * 0.18 +
        Math.max(0, this.dry - 3.5) * 0.7 +
        Math.max(0, this.cooked - 100) * 0.13);
    if (this.burn >= 26 || this.elapsed >= this.recipe.deadline) {
      this.phase = 'failed';
      this.feedback =
        this.burn >= 26
          ? 'Zu dunkel. Neue Pfanne, neuer Versuch.'
          : 'Service verpasst. Wir versuchen es noch einmal.';
    }
  }
  finishSear() {
    if (this.phase !== 'sear') return false;
    if (this.cooked < this.recipe.target - 8) {
      this.feedback = 'Noch nicht gar. Etwas länger braten.';
      return false;
    }
    this.phase = 'plate';
    this.feedback = this.recipe.sauce + ' · anrichten';
    return true;
  }
  get score() {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            Math.abs(this.cooked - this.recipe.target) * 0.85 -
            this.burn * 1.7 -
            this.mistakes * 4 -
            (1 - this.qualityTime / Math.max(1, this.searTime)) * 10,
        ),
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
