import { RESTAURANTS, clamp } from './data.js';

export const MEAL_GOALS = Object.freeze({
  focus: Object.freeze({ label: 'Fokus tanken', stat: 'focus', target: 80 }),
  budget: Object.freeze({ label: 'Satt fürs Budget', stat: 'hunger', target: 70 }),
});
const STATS = ['hunger', 'energy', 'happy', 'focus'];
const nothing = () => ({ focus: null, budget: null });

// Pure projection of Simulation.buyFood/change. Prices always come from the
// supplied Simulation.price, including its exact rounding/event semantics.
// One bounded menu scan per app render; no tick, cache, RNG, writes or save fields.
export function resolveMealAdvice(sim, restaurants = RESTAURANTS) {
  const state = sim?.s;
  if (!state || typeof sim.price !== 'function' || !Number.isFinite(state.money) ||
      STATS.some(stat => !Number.isFinite(state[stat]) || state[stat] < 0 || state[stat] > 100)) return nothing();
  const candidates = [];
  for (const restaurant of restaurants) {
    for (const [foodIndex, food] of restaurant.foods.entries()) {
      if (STATS.some(stat => !Number.isFinite(food[stat]))) continue;
      const price = sim.price(food);
      // Match buyFood's comparison exactly: no rounding a poor balance upward.
      if (!Number.isFinite(price) || price < 0 || state.money < price) continue;
      const effects = {};
      for (const stat of STATS) {
        const before = state[stat], after = clamp(before + food[stat]);
        effects[stat] = { before, after, delta: after - before, nominal: food[stat] };
      }
      candidates.push({ restaurantId: restaurant.id, restaurantName: restaurant.name, foodIndex, foodName: food.name,
        price, basePrice: food.price, discounted: state.event?.kind === 'happyhour' && price < food.price,
        effects, order: candidates.length });
    }
  }
  const delta = (meal, stat) => meal.effects[stat].delta;
  const losses = meal => STATS.reduce((sum, stat) => sum + Math.max(0, -delta(meal, stat)), 0);
  const tie = (a, b) => losses(a) - losses(b) || delta(b, 'energy') - delta(a, 'energy') ||
    delta(b, 'focus') - delta(a, 'focus') || delta(b, 'hunger') - delta(a, 'hunger') ||
    delta(b, 'happy') - delta(a, 'happy') || a.order - b.order;
  const choose = (goal, pool, target) => {
    if (!pool.length) return null;
    const stat = MEAL_GOALS[goal].stat;
    const reaching = pool.filter(meal => meal.effects[stat].after >= target);
    const ranked = reaching.length ? reaching : pool;
    ranked.sort(reaching.length
      ? (a, b) => a.price - b.price || tie(a, b)
      : goal === 'focus'
        // Focus gain per actual euro; cross multiplication handles a free item
        // without Infinity/NaN and leaves equal offers deterministic.
        ? (a, b) => delta(b, stat) * a.price - delta(a, stat) * b.price || a.price - b.price || tie(a, b)
        : (a, b) => delta(b, stat) - delta(a, stat) || a.price - b.price || tie(a, b));
    const { order, ...meal } = ranked[0];
    return { ...meal, goal, label: MEAL_GOALS[goal].label, target, reachesTarget: reaching.length > 0 };
  };
  return {
    // 80 is the actual good-work pay bonus threshold in Simulation.finish.
    // At/above it, only the remaining room to 100 counts. No empty +20 promises.
    focus: choose('focus', candidates.filter(meal => delta(meal, 'focus') > 0), state.focus < 80 ? 80 : 100),
    // Prefer the least expensive single meal that reaches comfortable satiety.
    // If the wallet cannot reach it, suggest the largest affordable real gain.
    budget: choose('budget', candidates.filter(meal => delta(meal, 'hunger') > 0), 70),
  };
}
