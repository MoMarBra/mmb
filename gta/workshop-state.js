export const WORKSHOP_PHASES = [
  'available',
  'intro',
  'meet',
  'car',
  'drive',
  'arrive',
  'handoff',
  'workshop',
  'complete',
];
export const WORKSHOP_ROUTE = [
  { x: 131, z: 40, name: 'Brienner Straße · am Königsplatz vorbei' },
  { x: 249, z: 40, name: 'Karolinenplatz · rechts abbiegen' },
  { x: 249, z: 113.5, name: 'Altstadtring · links abbiegen' },
  { x: 413, z: 113.5, name: 'Richtung Altstadt · rechts abbiegen' },
  { x: 413, z: 280, name: 'Zum Marienplatz · rechts abbiegen' },
  { x: 356, z: 280, name: 'Haltepunkt · links abbiegen' },
  { x: 356, z: 291, name: 'Marienplatz · anhalten und aussteigen' },
];
export const WORKSHOP_PARK = { x: 356, z: 291 };
export const WORKSHOP_HANDOFF = { x: 356, z: 301 };
export const freshWorkshopStory = () => ({
  phase: 'available',
  recruited: false,
  boarded: false,
  delivered: false,
  rewardClaimed: false,
  completed: false,
  attempts: 0,
  routeStep: 0,
  driveLine: 0,
  log: [],
});
export function normalizeWorkshopStory(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = freshWorkshopStory();
  if (WORKSHOP_PHASES.includes(v.phase)) out.phase = v.phase;
  for (const k of ['recruited', 'boarded', 'delivered', 'rewardClaimed', 'completed'])
    out[k] = v[k] === true;
  out.attempts = Number.isFinite(v.attempts)
    ? Math.max(0, Math.min(999, Math.floor(v.attempts)))
    : 0;
  out.routeStep = Number.isFinite(v.routeStep)
    ? Math.max(0, Math.min(WORKSHOP_ROUTE.length - 1, Math.floor(v.routeStep)))
    : 0;
  out.driveLine = Number.isFinite(v.driveLine)
    ? Math.max(0, Math.min(11, Math.floor(v.driveLine)))
    : 0;
  out.log = Array.isArray(v.log)
    ? v.log
        .filter((x) => typeof x === 'string')
        .slice(-60)
        .map((x) => x.slice(0, 80))
    : [];
  if (out.phase === 'complete') {
    out.delivered = true;
    out.rewardClaimed = true;
    out.completed = true;
  }
  if (['handoff', 'workshop'].includes(out.phase)) out.delivered = true;
  return out;
}
export function finishWorkshop(sim) {
  const s = sim.s.workshopStory;
  if (!s || s.phase !== 'workshop' || !s.delivered) return { ok: false, paid: 0, xp: 0, rep: 0 };
  const paid = s.rewardClaimed ? 0 : 180,
    before = sim.level;
  s.phase = 'complete';
  s.completed = true;
  s.rewardClaimed = true;
  if (paid) {
    sim.transaction(paid, 'BBE Story · Workshop am Marienplatz');
    sim.s.xp += 70;
    sim.change('rep', 6);
    sim.unlock('workshop-story');
  }
  if (sim.level > before)
    sim.emit('promotion', 'Beförderung: ' + sim.career.name, { perk: sim.career.perk });
  sim.save();
  return { ok: true, paid, xp: paid ? 70 : 0, rep: paid ? 6 : 0 };
}
