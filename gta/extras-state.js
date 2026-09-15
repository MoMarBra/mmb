const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const limit = (n, a, b) => Math.min(b, Math.max(a, finite(n, a)));
export const EXTRA_PLACES = Object.freeze({
  brewery: {
    id: 'brewery',
    name: 'Brienner Bräu',
    address: 'Brienner Straße · BBE-Nachbarschaft',
    x: 106,
    z: 47.2,
  },
  dogtown: {
    id: 'dogtown',
    name: 'DOGTOWN BURRITO CO.',
    address: 'Augustenstraße 16',
    x: 15,
    z: 88,
  },
});
export const BOMB_PRICE = 6.5;
export const BEER_PRICE = 7.8;
export const DRUNK_SECONDS = 180;
export function freshExtras() {
  return {
    bombs: 3,
    drunk: 0,
    beers: 0,
    steinBest: 0,
    steinWins: 0,
    bombsThrown: 0,
    explosions: 0,
  };
}
export function normalizeExtras(value = {}) {
  const s = freshExtras();
  if (!value || typeof value !== 'object') return s;
  for (const k of ['bombs', 'beers', 'steinWins', 'bombsThrown', 'explosions'])
    s[k] = Math.floor(limit(value[k] ?? s[k], 0, k === 'bombs' ? 30 : 1e6));
  s.drunk = limit(value.drunk, 0, DRUNK_SECONDS);
  s.steinBest = limit(value.steinBest, 0, 60);
  return s;
}
export function tickDrunk(state, seconds, active) {
  if (active) state.drunk = Math.max(0, state.drunk - Math.max(0, finite(seconds)));
  return state.drunk;
}
export function advanceStein(state, dt, axis) {
  dt = limit(dt, 0, 0.08);
  state.time += dt;
  const pull = Math.sin(state.time * 2.4) * 0.27 + Math.sin(state.time * 5.1) * 0.11;
  state.tilt += dt * (pull + state.tilt * 0.68 + limit(axis, -1, 1) * 0.9);
  state.stamina = Math.max(0, state.stamina - dt * (0.8 + state.time * 0.024));
  state.spill = Math.max(0, state.spill + dt * (Math.max(0, Math.abs(state.tilt) - 0.46) * 90));
  state.finished = state.time >= 30 || state.spill >= 100 || state.stamina <= 0;
  state.won = state.time >= 30 && state.spill < 100;
  return state;
}
