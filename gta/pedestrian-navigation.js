// Small spatial index of foot-height obstacles. Shared by strolling and reacting NPCs.
export class PedestrianNavigation {
  constructor(world) {
    this.world = world;
    this.count = -1;
    this.cells = new Map();
    this.boxes = [];
  }
  refresh() {
    const bodies = this.world.zoneData.city.physics.bodies;
    if (this.count === bodies.length) return;
    this.count = bodies.length;
    this.cells.clear();
    this.boxes = [];
    for (const body of bodies) {
      const h = body.shapes[0]?.halfExtents;
      if (
        body.mass !== 0 ||
        !h ||
        body.collisionResponse === false ||
        body.position.y + h.y < 0.16 ||
        body.position.y - h.y > 1.85
      )
        continue;
      const a = 2 * Math.atan2(body.quaternion.y, body.quaternion.w),
        ex = Math.abs(Math.cos(a)) * h.x + Math.abs(Math.sin(a)) * h.z,
        ez = Math.abs(Math.sin(a)) * h.x + Math.abs(Math.cos(a)) * h.z;
      const b = { x: body.position.x, z: body.position.z, hx: ex + 0.34, hz: ez + 0.34, body };
      this.boxes.push(b);
      for (let x = Math.floor((b.x - b.hx) / 8); x <= Math.floor((b.x + b.hx) / 8); x++)
        for (let z = Math.floor((b.z - b.hz) / 8); z <= Math.floor((b.z + b.hz) / 8); z++) {
          const key = x + ',' + z;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(b);
        }
    }
  }
  obstacle(x, z) {
    this.refresh();
    return this.cells
      .get(Math.floor(x / 8) + ',' + Math.floor(z / 8))
      ?.find(
        (b) =>
          b.body.collisionResponse !== false &&
          Math.abs(x - b.x) < b.hx &&
          Math.abs(z - b.z) < b.hz,
      );
  }
  free(x, z) {
    return !this.obstacle(x, z);
  }
  segment(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az),
      steps = Math.max(1, Math.ceil(d / 0.18));
    for (let i = 1; i <= steps; i++) {
      const b = this.obstacle(ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps);
      if (b) return b;
    }
    return null;
  }
  move(n, target, speed, dt) {
    if (dt <= 0 || speed <= 0) return 0;
    const p = n.mesh.position,
      start = { x: p.x, z: p.z };
    // Initial authorship/save recovery may place a pedestrian inside a tree clearance.
    const inside = this.obstacle(p.x, p.z);
    if (inside) {
      const exits = [
        { x: inside.x - inside.hx - 0.05, z: p.z },
        { x: inside.x + inside.hx + 0.05, z: p.z },
        { x: p.x, z: inside.z - inside.hz - 0.05 },
        { x: p.x, z: inside.z + inside.hz + 0.05 },
      ]
        .filter((q) => this.free(q.x, q.z))
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      if (exits[0]) {
        p.x = exits[0].x;
        p.z = exits[0].z;
      }
    }
    if (n.navTarget && Math.hypot(n.navTarget.x - p.x, n.navTarget.z - p.z) < 0.15)
      n.navTarget = null;
    let q = n.navTarget || target,
      dx = q.x - p.x,
      dz = q.z - p.z,
      d = Math.hypot(dx, dz);
    if (d < 0.01) return 0;
    const ahead = Math.min(d, 1.65),
      block = this.segment(p.x, p.z, p.x + (dx / d) * ahead, p.z + (dz / d) * ahead);
    if (block) {
      const margin = 0.15,
        candidates = [];
      for (const x of [block.x - block.hx - margin, block.x + block.hx + margin])
        for (const z of [block.z - block.hz - margin, block.z + block.hz + margin]) {
          if (this.free(x, z) && !this.segment(p.x, p.z, x, z)) {
            const cross = dx * (z - p.z) - dz * (x - p.x);
            candidates.push({
              x,
              z,
              score:
                Math.hypot(x - p.x, z - p.z) +
                Math.hypot(target.x - x, target.z - z) +
                (n.navSide && Math.sign(cross) !== n.navSide ? 1 : 0),
            });
          }
        }
      candidates.sort((a, b) => a.score - b.score);
      if (candidates[0]) {
        q = n.navTarget = candidates[0];
        n.navSide = Math.sign(dx * (q.z - p.z) - dz * (q.x - p.x));
        dx = q.x - p.x;
        dz = q.z - p.z;
        d = Math.hypot(dx, dz);
      } else return 0;
    }
    const step = Math.min(d, dt * speed),
      x = p.x + (dx / d) * step,
      z = p.z + (dz / d) * step;
    if (!this.segment(p.x, p.z, x, z)) {
      p.x = x;
      p.z = z;
      n.mesh.rotation.y = Math.atan2(dx, dz);
    }
    n.x = p.x;
    n.z = p.z;
    return Math.hypot(p.x - start.x, p.z - start.z) / Math.max(dt, 0.001);
  }
}
