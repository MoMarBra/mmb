/** Coffee delivery state and fluid motion; independent of DOM, audio and rendering. */
import {
  COFFEE_CUP_GEOMETRY,
  coffeeLiquidHeight,
  coffeeLiquidRadius,
} from './coffee-pitch-geometry.js';
export const COFFEE_PITCH = Object.freeze({
  version: 1,
  fillings: Object.freeze([0.8, 0.9, 0.95]),
  step: 1 / 60,
  maxFrame: 0.1,
  money: 12,
  xp: 8,
});
const MAX = Number.MAX_SAFE_INTEGER;
const finite = Number.isFinite;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const number = (v, fallback, a, b) => (finite(v) ? clamp(v, a, b) : fallback);
const integer = (v, fallback, a, b) => (Number.isSafeInteger(v) ? clamp(v, a, b) : fallback);
const object = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const pair = (v, fallback = 0, min = 0, max = 1) =>
  [0, 1].map((i) => number(Array.isArray(v) ? v[i] : undefined, fallback, min, max));
const location = (c, at) => c?.ready === true && c.zone === 'office' && c.at === at;
const positions = (p) => p && finite(p.x) && finite(p.z);
const fail = (reason) => ({ ok: false, reason });

export const freshCoffeePitch = () => ({
  version: 1,
  completedCount: 0,
  rewardClaimed: false,
  bestQuality: null,
  bestSeconds: null,
  nextAttemptId: 1,
  attempt: null,
});
// Runtime-only token: identity also rejects callbacks from before a reset/import,
// even when a brand-new save restarts its attempt IDs at 1. Never serialize tokens.
export const coffeePitchActionToken = (s) =>
  s.attempt
    ? Object.freeze({
        owner: s,
        attempt: s.attempt,
        phase: s.attempt.phase,
        round: s.attempt.round,
        refills: s.attempt.refills,
      })
    : null;
const currentAction = (s, token) =>
  token?.owner === s &&
  token.attempt === s.attempt &&
  token.phase === s.attempt.phase &&
  token.round === s.attempt.round &&
  token.refills === s.attempt.refills;

/** Load boundary only. A persisted attempt is parked at the kitchen, never auto-held. */
export function normalizeCoffeePitch(value) {
  const v = object(value),
    s = freshCoffeePitch();
  s.completedCount = integer(v.completedCount, 0, 0, 1000000);
  s.rewardClaimed = v.rewardClaimed === true || s.completedCount > 0;
  if (v.version !== 1) return s; // Never refund a known already-paid claim on schema mismatch.
  s.bestQuality = finite(v.bestQuality) ? clamp(v.bestQuality, 0, 100) : null;
  s.bestSeconds =
    finite(v.bestSeconds) && v.bestSeconds > 0 ? Math.min(86400, v.bestSeconds) : null;
  s.nextAttemptId = integer(v.nextAttemptId, 1, 1, MAX);
  const a = object(v.attempt);
  if (!Number.isSafeInteger(a.id) || a.id < 1 || a.id >= MAX) return s;
  const phase = a.phase === 'suspended' ? a.resumePhase : a.phase;
  if (!['carry', 'return', 'finish'].includes(phase)) return s;
  if (
    !Array.isArray(a.served) ||
    ![0, 2, 4, 6].includes(a.served.length) ||
    !a.served.every((n) => finite(n) && n >= 0 && n <= 1)
  )
    return s;
  const delivered = a.served.length / 2;
  if ((phase === 'finish') !== (delivered === 3) || (phase === 'return' && delivered === 0))
    return s;
  const round = phase === 'return' ? delivered - 1 : Math.min(2, delivered);
  s.nextAttemptId = Math.max(s.nextAttemptId, a.id + 1);
  s.attempt = {
    id: a.id,
    phase: phase === 'finish' ? 'finish' : 'suspended',
    resumePhase: phase,
    round,
    served: a.served.slice(),
    fill:
      phase === 'return' || phase === 'finish'
        ? [0, 0]
        : pair(a.fill, 0, 0, COFFEE_PITCH.fillings[round]),
    tilt: pair(a.tilt, 0, -0.34, 0.34),
    tiltVelocity: pair(a.tiltVelocity, 0, -1.6, 1.6),
    elapsed: number(a.elapsed, 0, 0, 86400),
    spilled: number(a.spilled, 0, 0, 100000),
    refills: integer(a.refills, 0, 0, 1000000),
    spillCooldown: number(a.spillCooldown, 0, 0, 0.35),
    resumed: true,
  };
  return s;
}

/** Runtime sampler is deliberately not saved; create anew after load/import/reset. */
export const createCoffeeMotion = () => ({
  owner: null,
  attemptId: null,
  lastX: null,
  lastZ: null,
  accumulator: 0,
  dx: 0,
  dz: 0,
  velocityX: 0,
  velocityZ: 0,
  suspended: true,
});
function anchor(m, a, p, owner) {
  m.owner = owner;
  m.attemptId = a.id;
  m.lastX = p.x;
  m.lastZ = p.z;
  m.accumulator = m.dx = m.dz = m.velocityX = m.velocityZ = 0;
  m.suspended = false;
}
function clearMotion(m) {
  if (!m) return;
  m.lastX = m.lastZ = null;
  m.accumulator = m.dx = m.dz = m.velocityX = m.velocityZ = 0;
  m.suspended = true;
}

/** Repeated start input cannot overwrite a live/parked attempt. */
export function startCoffeePitch(s, context) {
  if (!location(context, 'kitchen')) return fail('unavailable');
  if (s.attempt) return fail('already-active');
  if (!Number.isSafeInteger(s.nextAttemptId) || s.nextAttemptId < 1 || s.nextAttemptId >= MAX)
    return fail('attempt-limit');
  const id = s.nextAttemptId++;
  s.attempt = {
    id,
    phase: 'carry',
    resumePhase: 'carry',
    round: 0,
    served: [],
    fill: [0.8, 0.8],
    tilt: [0, 0],
    tiltVelocity: [0, 0],
    elapsed: 0,
    spilled: 0,
    refills: 0,
    spillCooldown: 0,
    resumed: false,
  };
  return { ok: true, id, round: 0 };
}

export function suspendCoffeePitch(s, id, motion) {
  const a = s.attempt;
  if (!a || a.id !== id) return fail('stale-attempt');
  if (a.phase === 'finish') {
    clearMotion(motion);
    return { ok: true };
  }
  if (a.phase !== 'suspended') {
    a.resumePhase = a.phase;
    a.phase = 'suspended';
  }
  a.resumed = true; // Returning to the kitchen cannot improve the walking-time record.
  clearMotion(motion);
  return { ok: true };
}

export function resumeCoffeePitch(s, id, context, motion) {
  const a = s.attempt;
  if (!a || a.id !== id) return fail('stale-attempt');
  if (!location(context, 'kitchen')) return fail('unavailable');
  if (a.phase !== 'suspended') return fail('not-suspended');
  a.phase = a.resumePhase;
  clearMotion(motion);
  return { ok: true, round: a.round, phase: a.phase };
}

/** Next pair at kitchen; repeating this action during carry is an explicit retry. */
export function refillCoffeePitch(s, id, context, motion) {
  const a = s.attempt;
  if (!a || a.id !== id) return fail('stale-attempt');
  if (!location(context, 'kitchen') || !['carry', 'return'].includes(a.phase))
    return fail('unavailable');
  if (!currentAction(s, context.token)) return fail('stale-action');
  if (a.phase === 'return') a.round++;
  else a.refills = Math.min(1000000, a.refills + 1);
  const fill = COFFEE_PITCH.fillings[a.round];
  if (!finite(fill)) return fail('invalid-round');
  a.fill[0] = a.fill[1] = fill;
  a.tilt[0] = a.tilt[1] = a.tiltVelocity[0] = a.tiltVelocity[1] = 0;
  a.phase = a.resumePhase = 'carry';
  clearMotion(motion);
  return { ok: true, round: a.round };
}

/** Serve commits the pair before returning an animation/UI event to the caller. */
export function serveCoffeePitch(s, id, context, motion) {
  const a = s.attempt;
  if (!a || a.id !== id) return fail('stale-attempt');
  if (!location(context, 'meeting') || a.phase !== 'carry') return fail('unavailable');
  if (!currentAction(s, context.token)) return fail('stale-action');
  if (a.fill[0] + a.fill[1] < 0.1) return fail('refill-needed');
  if (a.served.length !== a.round * 2) return fail('invalid-round');
  const delivered = a.fill.slice();
  a.served.push(...delivered);
  a.fill[0] = a.fill[1] = 0;
  a.phase = a.resumePhase = a.served.length === 6 ? 'finish' : 'return';
  clearMotion(motion);
  return { ok: true, served: a.served.length / 2, phase: a.phase, delivered };
}

export function abandonCoffeePitch(s, id, motion) {
  if (!s.attempt || s.attempt.id !== id) return fail('stale-attempt');
  s.attempt = null;
  clearMotion(motion);
  return { ok: true };
}

/** Camera/yaw are absent from this API: looking around cannot spill a stationary cup.
 * Pass actual solved positions; dt is time with player control, not wall-clock time.
 * A blocked/stalled/invalid frame re-anchors samples without healing fill/tilt.
 */
export function advanceCoffeePitch(
  s,
  motion,
  dt,
  position,
  { paused = false, discontinuity = false } = {},
) {
  const a = s.attempt;
  if (!a || !['carry', 'return'].includes(a.phase)) {
    clearMotion(motion);
    return { steps: 0, spilled: 0, splash: false };
  }
  if (
    paused ||
    discontinuity ||
    !positions(position) ||
    !finite(dt) ||
    dt <= 0 ||
    dt > COFFEE_PITCH.maxFrame
  ) {
    clearMotion(motion);
    return { steps: 0, spilled: 0, splash: false };
  }
  if (
    motion.owner !== s ||
    motion.attemptId !== a.id ||
    motion.lastX === null ||
    motion.suspended
  ) {
    anchor(motion, a, position, s);
    return { steps: 0, spilled: 0, splash: false };
  }
  const dx = position.x - motion.lastX,
    dz = position.z - motion.lastZ;
  // Two solver ticks of tolerance handle high-refresh repeated positions; teleports don't.
  if (Math.hypot(dx, dz) > 7 * Math.max(dt, 1 / 30) + 0.025) {
    anchor(motion, a, position, s);
    a.resumed = true;
    return { steps: 0, spilled: 0, splash: false, discontinuity: true };
  }
  motion.lastX = position.x;
  motion.lastZ = position.z;
  motion.accumulator += dt;
  motion.dx += dx;
  motion.dz += dz;
  const h = COFFEE_PITCH.step;
  const steps = Math.min(6, Math.floor((motion.accumulator + 1e-10) / h));
  if (!steps) return { steps: 0, spilled: 0, splash: false };
  const vx = motion.dx / motion.accumulator,
    vz = motion.dz / motion.accumulator;
  const processed = steps * h;
  motion.accumulator = Math.max(0, motion.accumulator - processed);
  motion.dx = vx * motion.accumulator;
  motion.dz = vz * motion.accumulator;
  let loss = 0,
    splash = false;
  for (let i = 0; i < steps; i++) {
    a.elapsed = Math.min(86400, a.elapsed + h);
    const smooth = 1 - Math.exp(-h / 0.18);
    const nextX = motion.velocityX + (vx - motion.velocityX) * smooth;
    const nextZ = motion.velocityZ + (vz - motion.velocityZ) * smooth;
    const ax = clamp((nextX - motion.velocityX) / h, -32, 32);
    const az = clamp((nextZ - motion.velocityZ) / h, -32, 32);
    motion.velocityX = nextX;
    motion.velocityZ = nextZ;
    if (a.phase !== 'carry') continue;
    const speed = Math.hypot(vx, vz);
    const running = Math.max(0, speed - 3.3);
    // Inertial lag + a small gait component once actually running. No random forcing.
    const gait = Math.sin(a.elapsed * 9) * Math.min(0.23, running * 0.11);
    const targets = [-Math.atan(ax * 0.006) + gait * 0.55, -Math.atan(az * 0.006) + gait];
    for (let j = 0; j < 2; j++) {
      const acceleration = (targets[j] - a.tilt[j]) * 85 - a.tiltVelocity[j] * 9;
      a.tiltVelocity[j] = clamp(a.tiltVelocity[j] + acceleration * h, -1.6, 1.6);
      a.tilt[j] = clamp(a.tilt[j] + a.tiltVelocity[j] * h, -0.34, 0.34);
    }
    const tilt = Math.hypot(...a.tilt);
    a.spillCooldown = Math.max(0, a.spillCooldown - h);
    for (let cup = 0; cup < 2; cup++) {
      // Match the authored tapered cup and its real ceramic lip, not a guessed cylinder.
      const height = coffeeLiquidHeight(a.fill[cup]);
      const radius = coffeeLiquidRadius(a.fill[cup], tilt);
      const excess = Math.max(0, height + Math.sin(tilt) * radius - COFFEE_CUP_GEOMETRY.spillRim);
      const drop = Math.min(a.fill[cup], 0.25 * h, excess * 18 * h);
      a.fill[cup] -= drop;
      loss += drop;
    }
    if (loss > 0 && a.spillCooldown <= 0) {
      splash = true;
      a.spillCooldown = 0.35;
    }
  }
  a.spilled = Math.min(100000, a.spilled + loss);
  return { steps, spilled: loss, splash };
}

export function coffeePitchResult(a) {
  if (!a || a.phase !== 'finish' || a.served.length !== 6) return null;
  const poured = COFFEE_PITCH.fillings.reduce((n, v) => n + v * 2, 0);
  const delivered = a.served.reduce((n, v) => n + v, 0);
  const quality = Math.round(
    clamp((100 * delivered) / poured - a.spilled * 12 - a.refills * 8, 0, 100),
  );
  return {
    quality,
    seconds: Math.round(a.elapsed * 100) / 100,
    timeRecordEligible: !a.resumed && !a.refills,
  };
}

/** Atomic mutation of PLAIN save data. No callbacks or Simulation dependency.
 * Pass the full plain progress object {coffeePitch,money,xp,earnings,ledger,day}.
 * Do NOT call sim.transaction again: money/XP/ledger are already committed here.
 * Caller may emit, save and animate only after this returns ok:true.
 */
export function finishCoffeePitch(progress, id, context = {}) {
  const s = progress?.coffeePitch,
    a = s?.attempt;
  if (!a || a.id !== id) return fail('stale-attempt');
  if (!location(context, 'meeting')) return fail('unavailable');
  if (!currentAction(s, context.token)) return fail('stale-action');
  const result = coffeePitchResult(a);
  if (!result) return fail('not-served');
  if (
    ![progress.money, progress.xp, progress.earnings].every((v) => finite(v) && v >= 0) ||
    !Array.isArray(progress.ledger)
  )
    return fail('invalid-economy');
  const paid = s.rewardClaimed ? 0 : COFFEE_PITCH.money,
    xp = paid ? COFFEE_PITCH.xp : 0;
  const money = Math.round((progress.money + paid) * 100) / 100;
  const totalXP = progress.xp + xp,
    earnings = progress.earnings + paid;
  if (![money, totalXP, earnings].every(finite)) return fail('invalid-economy');
  // Prepare all copies before any commit, then synchronously commit without callbacks.
  const ledger = paid
    ? [
        {
          amount: paid,
          label: 'BBE · Kaffee für den Pitch',
          day: integer(progress.day, 1, 1, 1000000),
          time: typeof context.clock === 'string' ? context.clock.slice(0, 12) : '',
        },
        ...progress.ledger.slice(0, 39),
      ]
    : progress.ledger;
  s.rewardClaimed = true;
  s.completedCount = Math.min(1000000, s.completedCount + 1);
  s.bestQuality = Math.max(s.bestQuality ?? 0, result.quality);
  if (result.timeRecordEligible && result.seconds > 0)
    s.bestSeconds = Math.min(s.bestSeconds ?? Infinity, result.seconds);
  s.attempt = null;
  progress.money = money;
  progress.xp = totalXP;
  progress.earnings = earnings;
  progress.ledger = ledger;
  return { ok: true, id, paid, xp, ...result };
}
