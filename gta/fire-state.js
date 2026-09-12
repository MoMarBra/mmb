import { clamp } from './data.js';

export const FIRE_SECONDS = 60;
export const FIRE_PHASES = ['available', 'intro', 'run', 'rescue', 'success', 'complete', 'failed'];
export const FIRE_START = Object.freeze({ x: -1.2, z: -1.65, yaw: -0.65 });
export const FIRE_LAPTOP = Object.freeze({ x: -3.85, y: 0.845, z: -2.91 });
export const FIRE_DELIVERY = Object.freeze({ x: -32, z: 2.7 });
export const FIRE_ROUTE = Object.freeze([
  { x: -1, z: -1.5 },
  { x: -1, z: 5.5 },
  { x: -10, z: 5.5 },
  { x: -17, z: 6 },
  { x: -24, z: 6 },
  { x: -30, z: 6 },
  FIRE_DELIVERY,
]);
export const freshFireStory = () => ({
  phase: 'available',
  remaining: FIRE_SECONDS,
  elapsed: 0,
  attempts: 0,
  completed: false,
  rewardClaimed: false,
  log: [],
  position: null,
});
export function normalizeFireStory(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const s = freshFireStory();
  if (FIRE_PHASES.includes(v.phase)) s.phase = v.phase;
  s.completed = v.completed === true;
  s.rewardClaimed = v.rewardClaimed === true;
  s.attempts = Number.isFinite(v.attempts) ? Math.floor(clamp(v.attempts, 0, 9999)) : 0;
  s.remaining = Number.isFinite(v.remaining) ? clamp(v.remaining, 0, FIRE_SECONDS) : FIRE_SECONDS;
  s.elapsed = FIRE_SECONDS - s.remaining;
  s.log = Array.isArray(v.log)
    ? [...new Set(v.log.filter((x) => typeof x === 'string' && /^[a-z]+_\d+$/.test(x)))].slice(
        0,
        80,
      )
    : [];
  if (
    Array.isArray(v.position) &&
    v.position.length === 2 &&
    v.position.every(Number.isFinite) &&
    v.position[0] >= -39 &&
    v.position[0] <= 13 &&
    Math.abs(v.position[1]) <= 10.5
  )
    s.position = [...v.position];
  if (['complete', 'success'].includes(s.phase)) s.completed = s.rewardClaimed = true;
  if (s.phase === 'run' && s.remaining <= 0) s.phase = 'failed';
  return s;
}
export function startFireAttempt(sim) {
  const old = sim.s.fireStory;
  sim.s.fireStory = {
    ...freshFireStory(),
    phase: 'intro',
    attempts: Math.min(9999, old.attempts + 1),
    completed: old.completed,
    rewardClaimed: old.rewardClaimed,
    log: [...old.log],
  };
  sim.save();
}
export function tickFireRun(s, seconds, paused = false) {
  if (s.phase !== 'run' || paused || !Number.isFinite(seconds) || seconds <= 0) return false;
  s.remaining = Math.max(0, s.remaining - seconds);
  // Floating-point frame deltas must not add an extra frame to a 60-second run.
  if (s.remaining <= 1e-8) s.remaining = 0;
  s.elapsed = FIRE_SECONDS - s.remaining;
  if (s.remaining === 0) {
    s.phase = 'failed';
    return true;
  }
  return false;
}
export function finishFireMission(sim) {
  const s = sim.s.fireStory;
  if (s.phase !== 'rescue') return { ok: false, paid: 0, money: 0, xp: 0, rep: 0 };
  const money = s.rewardClaimed ? 0 : 90,
    before = sim.level;
  s.phase = 'success';
  s.completed = true;
  s.rewardClaimed = true;
  s.position = null;
  if (money) {
    sim.transaction(money, 'BBE Story · Ticket in Flammen');
    sim.s.xp += 45;
    sim.change('rep', 4);
    sim.unlock('fire-story');
  }
  if (sim.level > before)
    sim.emit('promotion', 'Beförderung: ' + sim.career.name, { perk: sim.career.perk });
  sim.save();
  return { ok: true, paid: money, money, xp: money ? 45 : 0, rep: money ? 4 : 0 };
}
