/** Exact oriented rectangle overlap, with conservative cheap rejection before SAT. */
export function orientedRectanglesOverlap(a, b, padding = 0) {
  const dx = a.x - b.x,
    dz = a.z - b.z;
  // The half perimeter encloses every rotation. Positive SAT padding can extend
  // its accepted region by at most sqrt(2) * padding along a world axis.
  const reach = (a.w + a.l + b.w + b.l) * 0.5 + Math.max(0, padding) * Math.SQRT2;
  if (Math.abs(dx) > reach || Math.abs(dz) > reach) return false;
  const ca = Math.cos(a.angle),
    sa = Math.sin(a.angle);
  const cb = Math.cos(b.angle),
    sb = Math.sin(b.angle);
  const c = Math.abs(ca * cb + sa * sb),
    s = Math.abs(ca * sb - sa * cb);
  const aw = a.w * 0.5,
    al = a.l * 0.5,
    bw = b.w * 0.5,
    bl = b.l * 0.5;
  const tolerance =
    (Math.abs(dx) + Math.abs(dz) + aw + al + bw + bl + Math.abs(padding) + 1) * 1e-12;
  let edge = false;
  let gap = Math.abs(dx * ca - dz * sa) - (aw + bw * c + bl * s + padding);
  if (gap > tolerance) return false;
  edge ||= Math.abs(gap) <= tolerance;
  gap = Math.abs(dx * sa + dz * ca) - (al + bw * s + bl * c + padding);
  if (gap > tolerance) return false;
  edge ||= Math.abs(gap) <= tolerance;
  gap = Math.abs(dx * cb - dz * sb) - (bw + aw * c + al * s + padding);
  if (gap > tolerance) return false;
  edge ||= Math.abs(gap) <= tolerance;
  gap = Math.abs(dx * sb + dz * cb) - (bl + aw * s + al * c + padding);
  if (gap > tolerance) return false;
  edge ||= Math.abs(gap) <= tolerance;
  // Keep the released predicate's floating-point boundary decisions at exact
  // tangencies. Normal, nonboundary pairs never allocate arrays or closures.
  if (edge) return boundaryOverlap(a, b, padding);
  return true;
}
function boundaryOverlap(a, b, padding) {
  for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
    const x = Math.cos(angle),
      z = -Math.sin(angle);
    const radius = (r) =>
      (Math.abs(x * Math.cos(r.angle) - z * Math.sin(r.angle)) * r.w) / 2 +
      (Math.abs(x * Math.sin(r.angle) + z * Math.cos(r.angle)) * r.l) / 2;
    if (Math.abs((a.x - b.x) * x + (a.z - b.z) * z) > radius(a) + radius(b) + padding) return false;
  }
  return true;
}
