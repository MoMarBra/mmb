import * as CANNON from 'cannon-es';

// Most of Munich is static. Cannon's SAP still visits every static/static pair
// before rejecting it. Visit pairs involving an awake body instead, retaining
// Cannon's filters, bounding-volume test and query API.
export class ActiveBodyBroadphase extends CANNON.SAPBroadphase {
  collisionPairs(world, p1, p2) {
    if (this.dirty) {
      this.sortList();
      this.dirty = false;
    }
    const bodies = this.axisList;
    const active = this.activeIndices || (this.activeIndices = []);
    active.length = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!(b.type & CANNON.Body.STATIC) && b.sleepState !== CANNON.Body.SLEEPING) active.push(i);
    }
    for (const i of active) {
      const a = bodies[i];
      for (let j = 0; j < bodies.length; j++) {
        if (j === i) continue;
        const b = bodies[j];
        // Each awake/awake pair is tested exactly once.
        if (j < i && !(b.type & CANNON.Body.STATIC) && b.sleepState !== CANNON.Body.SLEEPING)
          continue;
        if (!this.needBroadphaseCollision(a, b)) continue;
        this.intersectionTest(a, b, p1, p2);
      }
    }
  }
}

// The game reads solved positions, never Cannon's interpolatedPosition. Keep
// its 60 Hz solver, catch-up limit and time semantics while avoiding unused
// quaternion interpolation for hundreds of buildings on every display frame.
export function stepGamePhysics(physics, elapsed) {
  if (!(elapsed > 0) || !Number.isFinite(elapsed)) return;
  const fixed = 1 / 60;
  const delta = Math.min(elapsed, 0.05);
  physics.accumulator += delta;
  const started = performance.now();
  let steps = 0;
  while (physics.accumulator >= fixed && steps < 3) {
    physics.internalStep(fixed);
    physics.accumulator -= fixed;
    steps++;
    if (performance.now() - started > fixed * 1000) break;
  }
  physics.accumulator %= fixed;
  physics.time += delta;
}
