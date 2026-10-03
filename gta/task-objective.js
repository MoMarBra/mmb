// Pure navigation only. Progress, rewards, accepted-task order and saves are owned
// by Simulation; this module never changes them or marks an objective complete.
export const TASK_WAYPOINT_OWNER = 'bbe-task';
const OUTSIDE_TYPES = new Set(['lunch', 'benchmark', 'mystery', 'meeting']);
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const progressOf = task => Array.isArray(task?.progress) ? task.progress.filter(p => typeof p === 'string') : [];

function anchor(zoneData, zone, id, name) {
  const found = zoneData?.[zone]?.interactions?.find(p => p.id === id);
  return finitePoint(found) ? { zone, interactionId: id, name, x: found.x, z: found.z } : null;
}

function localExit(context) {
  const ids = { office: 'exit', restaurant: 'r-exit', brewery: 'brew-exit' };
  // Extra interiors can supply their existing exact exit ID. Do not guess a
  // position in an unknown room or invent a teleport across its walls.
  const id = context.exitId || ids[context.zone];
  return id ? anchor(context.zoneData, context.zone, id, 'Zur Straße') : null;
}

/** Existing mission readiness, not a second completion/reward implementation. */
export function outsideTaskPhase(task) {
  if (!OUTSIDE_TYPES.has(task?.type) || !Number.isFinite(task.id)) return null;
  const progress = progressOf(task);
  if (task.type === 'benchmark') return progress.length >= 3 ? 'report' : 'photograph';
  if (task.type === 'lunch') return progress.includes('delivered') ? 'report' : progress.includes('picked') ? 'deliver' : 'collect';
  if (task.type === 'meeting') return progress.includes('met') ? 'report' : 'meeting';
  return progress.includes('visited') && progress.includes('service') ? 'report' : progress.includes('visited') ? 'service' : 'visit';
}

/**
 * Context: {restaurants, zoneData, zone, restaurantId, position, hq,
 *           absolute?, preferredRestaurantId?, exitId?}.
 * All target coordinates come from registered interactions, never the facade.
 * cityTarget belongs on the existing city map; nextTarget belongs to the current
 * interior/zone. A label is still useful when an anchor is unavailable.
 */
export function taskObjective(task, context = {}) {
  const phase = outsideTaskPhase(task);
  if (!phase || (Number.isFinite(context.absolute) && Number.isFinite(task.deadline) && task.deadline < context.absolute)) return null;
  const progress = progressOf(task);
  const restaurants = Array.isArray(context.restaurants) ? context.restaurants : [];
  const zoneData = context.zoneData || {};
  let label, destination = null, cityTarget = null, restaurantId = null;

  if (phase === 'report' || phase === 'deliver') {
    label = phase === 'deliver' ? 'Lunch zum BBE-Empfang' : task.type === 'mystery' ? 'Bericht am BBE-PC auswerten' : 'Am BBE-PC abgeben';
    destination = anchor(zoneData, 'office', phase === 'deliver' ? 'reception' : 'computer', phase === 'deliver' ? 'BBE · Empfang' : 'BBE · Arbeitsplatz');
    cityTarget = anchor(zoneData, 'city', 'hq', 'BBE Handelsberatung');
  } else if (phase === 'meeting') {
    label = 'Kundenbüro · Termin';
    destination = cityTarget = anchor(zoneData, 'city', 'client', 'Kundenbüro');
  } else if (phase === 'photograph') {
    const remaining = restaurants.filter(r => typeof r.id === 'string' && !progress.includes(r.id));
    let chosen = remaining.find(r => r.id === context.preferredRestaurantId);
    if (!chosen) {
      // GameWorld retains currentRestaurant when returning to the office. Never
      // let that old tenant masquerade as the office's outdoor position.
      const currentRestaurant = ['restaurant', 'zitronengras'].includes(context.zone)
        ? restaurants.find(r => r.id === context.restaurantId) : null;
      const from = context.zone === 'city' && finitePoint(context.position) ? context.position : finitePoint(currentRestaurant) ? currentRestaurant : context.hq;
      let bestDistance = Infinity;
      for (const r of remaining) {
        const target = anchor(zoneData, 'city', 'photo-' + r.id, r.name);
        if (!target) continue;
        const distance = finitePoint(from) ? Math.hypot(target.x - from.x, target.z - from.z) : 0;
        if (!chosen || distance < bestDistance) { chosen = r; bestDistance = distance; }
      }
    }
    restaurantId = chosen?.id || null;
    label = chosen ? chosen.name + ' · Karte fotografieren' : 'Speisekarten fotografieren · ' + progress.length + '/3';
    destination = cityTarget = chosen ? anchor(zoneData, 'city', 'photo-' + chosen.id, chosen.name + ' · Speisekarte') : null;
  } else {
    restaurantId = task.type === 'lunch' ? 'palm' : 'bao';
    const r = restaurants.find(r => r.id === restaurantId);
    label = task.type === 'lunch' ? 'PALMTREECLUB · Lunch abholen' : phase === 'visit' ? 'MAMMA BAO besuchen' : 'MAMMA BAO · Service befragen';
    // Both outdoor entrance and interior counter are retained. The shared
    // restaurant room alone is insufficient: its current tenant must match too.
    cityTarget = anchor(zoneData, 'city', 'enter-' + restaurantId, r?.name || restaurantId);
    destination = anchor(zoneData, 'restaurant', task.type === 'lunch' ? 'order' : 'service', label);
    if (destination) destination.restaurantId = restaurantId;
  }

  const sameZone = destination?.zone === context.zone && (!destination.restaurantId || destination.restaurantId === context.restaurantId);
  const nextTarget = sameZone ? destination : context.zone === 'city' ? cityTarget : localExit(context);
  return {
    taskId: task.id, type: task.type, phase,
    phaseKey: task.id + ':' + task.type + ':' + phase + ':' + [...progress].sort().join('|'),
    label, ready: phase === 'report', restaurantId,
    destination, cityTarget, nextTarget,
    // Concise room guidance only; no new 3D indicator, pathfinding or hidden progress.
    localLabel: sameZone || context.zone === 'city' ? label : nextTarget ? nextTarget.name + ' · ' + label : label,
  };
}

export function isTaskWaypoint(point) { return point?.owner === TASK_WAYPOINT_OWNER; }

/**
 * Pure ownership policy. An explicit task selection can replace a manually
 * selected destination; automatic progress never does. Foreign story ownership
 * always wins, including the older untagged story waypoints (foreignBusy).
 * `dismissed` is an explicit per-task opt-out, not proximity/arrival.
 */
export function chooseTaskWaypoint(objective, current, { explicit = false, foreignBusy = false, dismissed = false } = {}) {
  const ours = isTaskWaypoint(current);
  if (foreignBusy || current?.campaign || current?.story) return ours ? null : current;
  if (!objective?.cityTarget || (dismissed && !explicit)) return ours ? null : current;
  if (current && !ours && !explicit) return current;
  const target = objective.cityTarget;
  if (!finitePoint(target)) return ours ? null : current;
  if (ours && current.taskId === objective.taskId && current.phaseKey === objective.phaseKey && current.x === target.x && current.z === target.z && current.name === target.name) return current;
  return { owner: TASK_WAYPOINT_OWNER, taskId: objective.taskId, phaseKey: objective.phaseKey, name: target.name, x: target.x, z: target.z };
}

/** The missing workplace is a normal static place in the existing atlas list. */
export function clientMapPlace(zoneData) {
  const point = anchor(zoneData, 'city', 'client', 'Kundenbüro');
  return point ? { id: 'bbe-client', name: point.name, type: 'work', x: point.x, z: point.z } : null;
}
