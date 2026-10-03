import { COLLEAGUES, COLLEAGUE_MOMENTS, COLLEAGUE_STAGES } from './colleagues-data.js';

// Finite source-backed milestones, not a repeatable daily meter. All helpers
// operate only on plain saved data: no timers, listeners, audio, DOM or Three.js.
const ids = COLLEAGUE_MOMENTS.map((moment) => moment.id);
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const has = (value, id) => Array.isArray(value) && value.includes(id);
const colleagueFor = (id) => COLLEAGUES.find((colleague) => colleague.id === id);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const boundedInteger = (value, maximum) =>
  finite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;

export const freshColleagues = () => ({
  version: 1,
  initialized: false,
  earned: [],
  spent: [],
  seen: [],
  banter: { benjamin: 0, tobias: 0, mara: 0 },
});

export function normalizeColleagues(value) {
  const raw = object(value),
    state = freshColleagues();
  state.initialized = raw.initialized === true;
  state.spent = ids.filter((id) => has(raw.spent, id));
  // Never refund a consumed favour when repairing a partially damaged save.
  state.earned = ids.filter((id) => has(raw.earned, id) || state.spent.includes(id));
  if ('spent' in raw && !Array.isArray(raw.spent)) state.spent = [...state.earned];
  state.seen = ids.filter((id) => state.earned.includes(id) && has(raw.seen, id));
  for (const colleague of COLLEAGUES) {
    state.banter[colleague.id] =
      boundedInteger(object(raw.banter)[colleague.id], 1000000) % colleague.banter.length;
  }
  return state;
}

function sourceCompleted(progress, source) {
  switch (source[0]) {
    case 'discovery':
      return has(progress.quizDiscoveries, source[1]);
    case 'campaign':
      return has(object(progress.bbeCampaign).completed, source[1]);
    case 'fire':
      return object(progress.fireStory).completed === true;
    case 'workshop':
      return object(progress.workshopStory).completed === true;
    default:
      return false;
  }
}

/** Reconcile on load and confirmed progress changes, never in the frame loop.
 * Existing saves receive their earned support silently, with no popup backlog.
 * Ordinary repeats/reloads preserve both consumption and acknowledged lines.
 */
export function syncColleagues(gameState, { silent = false } = {}) {
  const previous = gameState.colleagues;
  const state = normalizeColleagues(previous);
  const quiet = silent || !state.initialized;
  const added = [];
  for (const moment of COLLEAGUE_MOMENTS) {
    if (!state.earned.includes(moment.id) && sourceCompleted(gameState, moment.source)) {
      state.earned.push(moment.id);
      added.push(moment.id);
      if (quiet) state.seen.push(moment.id);
    }
  }
  // Canonical order makes JSON export/re-import stable regardless of event order.
  state.earned = ids.filter((id) => state.earned.includes(id));
  state.seen = ids.filter((id) => state.seen.includes(id));
  state.initialized = true;
  gameState.colleagues = state;
  return {
    changed: JSON.stringify(previous) !== JSON.stringify(state),
    added,
    moments: quiet ? [] : added.map((id) => COLLEAGUE_MOMENTS.find((moment) => moment.id === id)),
  };
}

export function colleagueStatus(value, id) {
  const colleague = colleagueFor(id);
  if (!colleague) return null;
  const state = normalizeColleagues(value);
  const earned = colleague.moments.filter((moment) => state.earned.includes(moment.id));
  const available = earned.filter((moment) => !state.spent.includes(moment.id));
  return {
    id,
    name: colleague.name,
    role: colleague.role,
    stage: earned.length,
    label: COLLEAGUE_STAGES[earned.length],
    helpAvailable: available.length > 0,
    available: available.length,
    support: colleague.support,
    offerId: available[0]?.id || null,
    nextMoment: earned.find((moment) => !state.seen.includes(moment.id))?.id || null,
  };
}

function validConversation(context, colleague) {
  return (
    context?.ready === true &&
    context.zone === 'office' &&
    context.interactingWith === colleague &&
    finite(context.distance) &&
    context.distance >= 0 &&
    context.distance <= 2.3
  );
}

/** Acknowledge only when the actual existing conversation displays this line.
 * No automatic speech interrupts a mission, cutscene, chase or existing voice.
 */
export function acknowledgeColleagueMoment(gameState, id, momentId, context) {
  if (!colleagueFor(id) || !validConversation(context, id)) return null;
  const state = normalizeColleagues(gameState.colleagues);
  const moment = COLLEAGUE_MOMENTS.find((entry) => entry.id === momentId && entry.colleague === id);
  if (!moment || !state.earned.includes(momentId) || state.seen.includes(momentId)) return null;
  state.seen = ids.filter((key) => key === momentId || state.seen.includes(key));
  gameState.colleagues = state;
  return moment;
}

/** Both the button and transaction use this preview. Passive stat drain can
 * create an imperceptible deficit between opening a conversation and clicking.
 * Preserve finite help until at least one full stat point can actually improve.
 */
export function previewColleagueSupport(gameState, id) {
  const colleague = colleagueFor(id);
  if (!colleague) return { ok: false, reason: 'unknown-colleague' };
  const effects = {};
  for (const [stat, amount] of Object.entries(colleague.support.stats)) {
    const current = gameState[stat];
    if (!finite(current) || current < 0 || current > 100)
      return { ok: false, reason: 'invalid-stats' };
    const applied = Math.min(amount, 100 - current);
    if (applied > 0) effects[stat] = applied;
  }
  if (!Object.values(effects).some((amount) => amount >= 1))
    return { ok: false, reason: 'already-rested' };
  return { ok: true, effects };
}

/** Consume the offer visible on the clicked button, not "whatever is next".
 * Duplicate callbacks therefore cannot consume a second help or reward twice.
 * This synchronous transaction commits consumption and clamped stat changes
 * before the caller may save, speak, emit a toast or render another menu.
 */
export function claimColleagueSupport(gameState, id, offerId, context) {
  const colleague = colleagueFor(id);
  if (!colleague) return { ok: false, reason: 'unknown-colleague' };
  if (!validConversation(context, id)) return { ok: false, reason: 'unavailable' };
  const state = normalizeColleagues(gameState.colleagues);
  const moment = colleague.moments.find((entry) => entry.id === offerId);
  if (!moment || !state.earned.includes(offerId) || !sourceCompleted(gameState, moment.source))
    return { ok: false, reason: 'locked' };
  if (state.spent.includes(offerId)) return { ok: false, reason: 'already-used' };
  const preview = previewColleagueSupport(gameState, id);
  if (!preview.ok) return preview;
  const { effects } = preview;
  state.spent = ids.filter((key) => key === offerId || state.spent.includes(key));
  gameState.colleagues = state;
  for (const [stat, amount] of Object.entries(effects)) gameState[stat] += amount;
  return {
    ok: true,
    id,
    offerId,
    effects,
    title: colleague.support.title,
    line: colleague.support.line,
    voiceId: colleague.support.voiceId,
  };
}

export function nextColleagueBanter(gameState, id, context) {
  const colleague = colleagueFor(id);
  if (!colleague || !validConversation(context, id)) return null;
  const state = normalizeColleagues(gameState.colleagues),
    index = state.banter[id];
  state.banter[id] = (index + 1) % colleague.banter.length;
  gameState.colleagues = state;
  return {
    text: colleague.banter[index],
    actor: colleague.actor,
    voiceId: `colleague_${id}_banter_${index + 1}`,
  };
}
