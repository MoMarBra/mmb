/** Small, cosmetic memories. This module has no DOM, renderer, storage or rewards. */
export const MEMORY_RESTAURANTS = Object.freeze([
  'zitronengras', 'dogtown', 'seen', 'bao', 'palm', 'gyoza', 'wirt', 'mentors',
]);
export const OFFICE_MEMORIES = Object.freeze([
  { id: 'workshop', title: 'Koffer angekommen', prop: 'postcard',
    line: 'Eine Postkarte. Endlich ein Deliverable, das an den Kühlschrank passt.' },
  { id: 'fire', title: 'IT-geprüft', prop: 'seal',
    line: 'Benjamin hat geprüft: Dieser Arbeitsplatz ist jetzt offiziell nicht in Flammen.' },
  { id: 'origin', title: 'Vom Wok zum Workshop', prop: 'name-tag',
    line: 'Das alte Namensschild bleibt. Am Anfang stand ich noch am Herd.' },
  { id: 'bird', title: 'Dr. Dip sagt Danke', prop: 'watering-can',
    line: 'Drei Mal gegossen. Und schon nickt das Management wieder.' },
  { id: 'regular', title: 'Wie immer?', prop: 'stamp-card',
    line: 'Drei Besuche, ein Stammplatz. Kundenbindung kann auch lecker sein.' },
  { id: 'recycling', title: 'Kreislauf geschlossen', prop: 'bottle',
    line: 'Zehn Flaschen zurück. Nachhaltigkeit mit sofort messbarem Rücklauf.' },
].map((entry) => Object.freeze({ ...entry, voiceId: 'office_memory_' + entry.id })));
export const MEMORY_IDS = Object.freeze(OFFICE_MEMORIES.map((entry) => entry.id));
const maximumReceipt = Number.MAX_SAFE_INTEGER;
const count = (value, max) => Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const ids = (value) => MEMORY_IDS.filter((id) => Array.isArray(value) && value.includes(id));
export function freshOfficeMemory() {
  return {
    version: 1,
    unlocked: [],
    noticed: [],
    meals: Object.fromEntries(MEMORY_RESTAURANTS.map((id) => [id, 0])),
    lastMealReceipt: 0,
    regularAt: '',
  };
}
function earned(memory, progress) {
  return [
    progress?.workshopStory?.completed === true,
    progress?.fireStory?.completed === true,
    progress?.originStory?.phase === 'complete' && progress?.originStory?.level === 4,
    Number.isFinite(progress?.birdRefills) && progress.birdRefills >= 3,
    MEMORY_RESTAURANTS.some((id) => memory.meals[id] >= 3),
    Number.isFinite(progress?.returned) && progress.returned >= 10,
  ];
}
/** Repeated mission-complete notifications read canonical flags, never grant twice. */
export function reconcileOfficeMemory(memory, progress, { quiet = false } = {}) {
  const flags = earned(memory, progress);
  const added = MEMORY_IDS.filter((id, index) => flags[index] && !memory.unlocked.includes(id));
  if (!added.length) return { state: memory, unlocked: [] };
  const unlocked = MEMORY_IDS.filter((id) => memory.unlocked.includes(id) || added.includes(id));
  return {
    state: {
      ...memory, unlocked,
      noticed: quiet ? MEMORY_IDS.filter((id) => memory.noticed.includes(id) || added.includes(id)) : memory.noticed,
    },
    unlocked: added,
  };
}
/** Old saves get earned props quietly; a supported save retains its pending one-liners. */
export function normalizeOfficeMemory(value, progress = {}) {
  const v = object(value), out = freshOfficeMemory();
  const supported = v.version === 1;
  if (supported) {
    out.unlocked = ids(v.unlocked);
    out.noticed = ids(v.noticed).filter((id) => out.unlocked.includes(id));
    const meals = object(v.meals);
    for (const id of MEMORY_RESTAURANTS) out.meals[id] = count(meals[id], 3);
    out.lastMealReceipt = count(v.lastMealReceipt, maximumReceipt);
    out.regularAt = MEMORY_RESTAURANTS.includes(v.regularAt) && out.meals[v.regularAt] >= 3 ? v.regularAt : '';
  }
  if (!out.regularAt) out.regularAt = MEMORY_RESTAURANTS.find((id) => out.meals[id] >= 3) || '';
  return reconcileOfficeMemory(out, progress, { quiet: !supported }).state;
}
/**
 * Called only from the successful checkout transaction, before sim.save().
 * The checkout creates ONE immutable receipt with lastMealReceipt + 1. Listeners
 * may replay that same receipt; they must never generate another sequence number.
 * No historical purchases are guessed from the truncated bank ledger.
 */
export function rememberMealReceipt(memory, receipt) {
  if (!receipt || !MEMORY_RESTAURANTS.includes(receipt.restaurant) ||
      !Number.isSafeInteger(receipt.sequence) || receipt.sequence <= memory.lastMealReceipt ||
      receipt.sequence > maximumReceipt || receipt.paid !== true) {
    return { state: memory, accepted: false, unlocked: [] };
  }
  const meals = { ...memory.meals, [receipt.restaurant]: Math.min(3, memory.meals[receipt.restaurant] + 1) };
  const next = {
    ...memory, meals, lastMealReceipt: receipt.sequence,
    regularAt: memory.regularAt || (meals[receipt.restaurant] >= 3 ? receipt.restaurant : ''),
  };
  const result = reconcileOfficeMemory(next, {});
  return { ...result, accepted: true };
}
export function nextMemoryNotice(memory) {
  return OFFICE_MEMORIES.find((entry) => memory.unlocked.includes(entry.id) && !memory.noticed.includes(entry.id)) || null;
}
export function acknowledgeMemory(memory, id) {
  if (!MEMORY_IDS.includes(id) || !memory.unlocked.includes(id) || memory.noticed.includes(id)) return memory;
  return { ...memory, noticed: MEMORY_IDS.filter((key) => key === id || memory.noticed.includes(key)) };
}
export const officeMemoryMask = (memory) => MEMORY_IDS.reduce((mask, id, index) =>
  mask | (memory.unlocked.includes(id) ? 1 << index : 0), 0);
export const MEMORY_VOICE_LINES = Object.freeze(OFFICE_MEMORIES.map((entry) => Object.freeze({
  id: entry.voiceId, actor: 'player', event: 'office_memory', text: entry.line,
})));
