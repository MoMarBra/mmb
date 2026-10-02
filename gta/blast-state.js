import { BLAST_BOARD, BLAST_LEVELS } from './blast-levels.js';
export { BLAST_BOARD, BLAST_LEVELS } from './blast-levels.js';

const STEP = 1 / 120, RADIUS = BLAST_BOARD.ballRadius;
const GRAVITY = 590, LAUNCH_SPEED = 575, MAX_SPEED = 1000;
const BOUNCE = .85, BURST_RADIUS = 92, SHOT_BONUS = 2200;
const MAX_SHOT_TIME = 18, EPS = .001;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const integer = (n, lo, hi, fallback = lo) => Number.isFinite(n) ? clamp(Math.floor(n), lo, hi) : fallback;
const BASE_POINTS = Object.freeze({ blue: 30, orange: 100, green: 80, purple: 350 });

export function freshBlast() {
  return { version: 1, unlocked: 1,
    bests: BLAST_LEVELS.map(() => ({ score: 0, stars: 0, clears: 0 })),
    paid: BLAST_LEVELS.map(() => false) };
}
export function normalizeBlast(source) {
  const save = freshBlast();
  if (!source || typeof source !== 'object') return save;
  for (let i = 0; i < BLAST_LEVELS.length; i++) {
    const old = source.bests?.[i];
    if (old && typeof old === 'object') {
      const stars = integer(old.stars, 0, 3);
      save.bests[i] = { score: integer(old.score, 0, 1e8), stars,
        clears: Math.max(stars ? 1 : 0, integer(old.clears, 0, 1e6)) };
    }
    // Existing completed records imply payment even if an older export omitted its ledger.
    save.paid[i] = source.paid?.[i] === true || save.bests[i].stars > 0;
  }
  while (save.unlocked < BLAST_LEVELS.length && save.bests[save.unlocked - 1].stars > 0) save.unlocked++;
  return save;
}
export function recordBlastResult(source, levelIndex, result) {
  const save = normalizeBlast(source);
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= save.unlocked ||
      !result || !Number.isInteger(result.stars) || result.stars < 1 || result.stars > 3 ||
      !Number.isFinite(result.score) || result.score < 0) return { save, reward: 0, firstClear: false };
  const best = save.bests[levelIndex], firstClear = best.stars === 0;
  const reward = save.paid[levelIndex] ? 0 : 20 + 5 * levelIndex;
  best.score = Math.max(best.score, integer(result.score, 0, 1e8));
  best.stars = Math.max(best.stars, result.stars);
  best.clears = Math.min(1e6, best.clears + 1);
  save.paid[levelIndex] = true;
  while (save.unlocked < BLAST_LEVELS.length && save.bests[save.unlocked - 1].stars > 0) save.unlocked++;
  return { save, reward, firstClear };
}

/** Deterministic, DOM-free pinball simulation. Seconds in; logical board pixels out. */
export class BlastEngine {
  constructor(levelIndex = 0) {
    this.levelIndex = integer(levelIndex, 0, BLAST_LEVELS.length - 1);
    this.level = BLAST_LEVELS[this.levelIndex];
    this.pegs = this.level.pegs.map((p, i) => ({ ...p, id: `${this.level.id}:${i}`, hit: false }));
    this.phase = 'aim'; this.ball = null; this.balls = this.level.balls;
    this.score = 0; this.combo = 0; this.time = 0; this.shots = 0;
    this.bucket = { x: 360, y: BLAST_BOARD.bucketY, width: BLAST_BOARD.bucketWidth };
    this.events = [];
    this._accumulator = 0; this._shotTime = 0; this._shotPoints = 0;
    this._bonusGiven = false; this._stuckTime = 0; this._preview = false;
  }
  get remaining() { return this.pegs.reduce((n, p) => n + (p.kind === 'orange' && !p.hit ? 1 : 0), 0); }
  get stars() {
    if (this.phase !== 'won') return 0;
    return 1 + (this.balls >= Math.ceil(this.level.balls * .12) ? 1 : 0) +
      (this.balls >= Math.ceil(this.level.balls * .36) ? 1 : 0);
  }
  shoot(angle) {
    if (this.phase !== 'aim' || this.balls <= 0 || !Number.isFinite(angle)) return false;
    const a = clamp(angle, -1.25, 1.25);
    this.ball = { x: BLAST_BOARD.launcher.x, y: BLAST_BOARD.launcher.y,
      vx: Math.sin(a) * LAUNCH_SPEED, vy: Math.cos(a) * LAUNCH_SPEED };
    this.phase = 'shot'; this.balls--; this.shots++;
    this.combo = 0; this._shotPoints = 0; this._shotTime = 0; this._bonusGiven = false; this._stuckTime = 0;
    this.events.push({ type: 'shot', angle: a, balls: this.balls });
    return true;
  }
  drainEvents() { const events = this.events; this.events = []; return events; }
  clone() {
    const copy = Object.create(BlastEngine.prototype);
    Object.assign(copy, this);
    copy.pegs = this.pegs.map(p => ({ ...p }));
    copy.ball = this.ball ? { ...this.ball } : null;
    copy.bucket = { ...this.bucket }; copy.events = [];
    return copy;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.phase === 'won' || this.phase === 'lost') return;
    // Discard tab-suspension debt. A long background interval must never consume a shot.
    this._accumulator = Math.min(this._accumulator + Math.min(dt, .25), .25 + STEP);
    while (this._accumulator + 1e-10 >= STEP) {
      this._accumulator = Math.max(0, this._accumulator - STEP);
      this._step(STEP);
      if (this.phase === 'won' || this.phase === 'lost') { this._accumulator = 0; break; }
    }
  }
  _step(dt) {
    this.time += dt;
    this.bucket.x = 360 + Math.sin(this.time * .95) * 253;
    if (this.phase !== 'shot' || !this.ball) return;
    const b = this.ball, beforeX = b.x, beforeY = b.y;
    this._shotTime += dt;
    b.vy += GRAVITY * dt;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) { b.vx *= MAX_SPEED / speed; b.vy *= MAX_SPEED / speed; }
    // Swept-circle collision detection, with bounded residual-time microsteps after rebounds.
    let left = dt;
    for (let contacts = 0; contacts < 8 && left > 1e-7 && this.ball; contacts++) {
      const hit = this._collision(left);
      if (!hit) { b.x += b.vx * left; b.y += b.vy * left; left = 0; break; }
      b.x += b.vx * hit.t; b.y += b.vy * hit.t; left -= hit.t;
      if (hit.type === 'catch') { this._endShot(true); return; }
      if (hit.type === 'end') { this._endShot(false); return; }
      if (hit.peg) {
        const p = hit.peg, dx = b.x - p.x, dy = b.y - p.y, distance = Math.hypot(dx, dy);
        const nx = distance > EPS ? dx / distance : 0, ny = distance > EPS ? dy / distance : -1;
        b.x = p.x + nx * (p.r + RADIUS + EPS); b.y = p.y + ny * (p.r + RADIUS + EPS);
        const normalSpeed = b.vx * nx + b.vy * ny;
        if (normalSpeed < 0) {
          const impulse = -normalSpeed * (1 + BOUNCE);
          b.vx += nx * impulse; b.vy += ny * impulse;
          const exit = b.vx * nx + b.vy * ny;
          if (exit < 80) { b.vx += nx * (80 - exit); b.vy += ny * (80 - exit); }
        }
        this._hit(p);
      } else {
        if (hit.type === 'left') { b.x = BLAST_BOARD.left + RADIUS + EPS; b.vx = Math.abs(b.vx) * .93; }
        if (hit.type === 'right') { b.x = BLAST_BOARD.right - RADIUS - EPS; b.vx = -Math.abs(b.vx) * .93; }
        if (hit.type === 'top') { b.y = 40 + EPS; b.vy = Math.abs(b.vy) * .9; }
      }
      if (this._preview) this._previewHits++;
      // At most eight contacts per fixed step; separation keeps the next step outside obstacles.
      left = Math.max(0, left - 1e-6);
    }
    if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) { this._endShot(false); return; }
    this._stuckTime = Math.hypot(b.x - beforeX, b.y - beforeY) < .18 ? this._stuckTime + dt : 0;
    if (this._stuckTime > .65) {
      b.vx += b.x < 360 ? 70 : -70; b.vy -= 95; this._stuckTime = 0;
    }
    if (this._shotTime >= MAX_SHOT_TIME || b.y > BLAST_BOARD.height + 30) this._endShot(false);
  }
  _collision(limit) {
    const b = this.ball, dx = b.vx, dy = b.vy;
    let closest = null, earliest = limit + 1e-8;
    const accept = (t, type, peg = null) => {
      if (t >= -1e-8 && t <= earliest) { earliest = Math.max(0, t); closest = { t: earliest, type, peg }; }
    };
    if (dx < -.001) accept((BLAST_BOARD.left + RADIUS - b.x) / dx, 'left');
    if (dx > .001) accept((BLAST_BOARD.right - RADIUS - b.x) / dx, 'right');
    if (dy < -.001) accept((40 - b.y) / dy, 'top');
    if (dy > .001) {
      const catchTime = (this.bucket.y - RADIUS - b.y) / dy;
      if (catchTime >= 0 && Math.abs(b.x + dx * catchTime - this.bucket.x) <= this.bucket.width / 2 - RADIUS)
        accept(catchTime, 'catch');
      accept((BLAST_BOARD.height + 15 - b.y) / dy, 'end');
    }
    const endX = b.x + dx * limit, endY = b.y + dy * limit, a = dx * dx + dy * dy;
    if (a < .001) return closest;
    for (const p of this.pegs) {
      const r = p.r + RADIUS;
      if (p.x < Math.min(b.x, endX) - r || p.x > Math.max(b.x, endX) + r ||
          p.y < Math.min(b.y, endY) - r || p.y > Math.max(b.y, endY) + r) continue;
      const ox = b.x - p.x, oy = b.y - p.y, projection = ox * dx + oy * dy;
      const c = ox * ox + oy * oy - r * r;
      if (c < EPS) { if (projection < -.01) accept(0, 'peg', p); continue; }
      if (projection >= 0) continue;
      const discriminant = projection * projection - a * c;
      if (discriminant < 0) continue;
      accept((-projection - Math.sqrt(discriminant)) / a, 'peg', p);
    }
    return closest;
  }
  _hit(first) {
    if (this._preview) return;
    const queue = [first];
    for (let i = 0; i < queue.length && i <= this.pegs.length * 5; i++) {
      const peg = queue[i];
      if (peg.hit) continue;
      peg.hit = true; this.combo++;
      const multiplier = 1 + Math.min(14, this.combo - 1) * .2;
      const points = Math.round(BASE_POINTS[peg.kind] * multiplier);
      this.score += points; this._shotPoints += points;
      this.events.push({ type: 'hit', peg, x: peg.x, y: peg.y, kind: peg.kind, combo: this.combo, points });
      if (peg.kind === 'green') {
        this.events.push({ type: 'blast', x: peg.x, y: peg.y, radius: BURST_RADIUS });
        for (const neighbour of this.pegs) if (!neighbour.hit && Math.hypot(neighbour.x - peg.x, neighbour.y - peg.y) <= BURST_RADIUS) queue.push(neighbour);
      }
    }
    if (!this._bonusGiven && this._shotPoints >= SHOT_BONUS) {
      this._bonusGiven = true; this.balls++;
      this.events.push({ type: 'bonus', balls: 1, points: SHOT_BONUS });
    }
  }
  _endShot(caught) {
    if (this.phase !== 'shot') return;
    if (caught) {
      this.balls++; this.score += 150;
      this.events.push({ type: 'catch', x: this.bucket.x, y: this.bucket.y, points: 150, balls: this.balls });
    }
    this.pegs = this.pegs.filter(p => !p.hit);
    this.ball = null;
    this.events.push({ type: 'end', combo: this.combo, points: this._shotPoints, balls: this.balls });
    if (this.remaining === 0) {
      this.score += 1000 + this.balls * 100;
      this.phase = 'won';
      this.events.push({ type: 'win', score: this.score, stars: this.stars, levelIndex: this.levelIndex });
    } else if (this.balls <= 0) {
      this.phase = 'lost'; this.events.push({ type: 'lose', score: this.score, remaining: this.remaining });
    } else this.phase = 'aim';
  }
  getAimPath(angle) {
    if (this.phase !== 'aim' || !Number.isFinite(angle)) return [];
    const ghost = this.clone(); ghost._preview = true; ghost._previewHits = 0;
    ghost._accumulator = 0; ghost.shoot(angle);
    const path = [{ x: ghost.ball.x, y: ghost.ball.y }];
    let afterHit = 0;
    for (let i = 0; i < 300 && ghost.ball; i++) {
      ghost._step(STEP);
      if (!ghost.ball) break;
      if (i % 3 === 0) path.push({ x: ghost.ball.x, y: ghost.ball.y });
      if (ghost._previewHits && ++afterHit >= 32) break;
    }
    return path;
  }
}
