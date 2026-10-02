/** Original BBE Blast boards. Coordinates are logical pixels, independent of the DOM. */
export const BLAST_BOARD = Object.freeze({
  width: 720, height: 760, left: 28, right: 692, top: 84,
  launcher: Object.freeze({ x: 360, y: 54 }), ballRadius: 7,
  bucketY: 716, bucketWidth: 110,
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rows = (count, columns, dx = 76, dy = 69, y0 = 165, stagger = 0) =>
  Array.from({ length: count * columns }, (_, i) => {
    const row = Math.floor(i / columns), col = i % columns;
    return { x: 360 + (col - (columns - 1) / 2) * dx + (row % 2 ? stagger : -stagger), y: y0 + row * dy };
  });
const ellipse = (cx, cy, rx, ry, count, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = offset + i * Math.PI * 2 / count;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
const unique = points => points.reduce((out, p) => {
  const q = { x: Math.round(clamp(p.x, 54, 666)), y: Math.round(clamp(p.y, 140, 640)) };
  if (out.every(o => Math.hypot(o.x - q.x, o.y - q.y) >= 31)) out.push(q);
  return out;
}, []).sort((a, b) => a.y - b.y || a.x - b.x);
function board(id, title, balls, orangeCount, points) {
  const pegs = unique(points).map(p => ({ ...p, r: 12, kind: 'blue' }));
  // Power pegs occupy reachable positions on the upper edge and both flanks.
  const anchors = [{ x: 360, y: 180 }, { x: 175, y: 350 }, { x: 545, y: 470 }];
  if (id >= 7) anchors.push({ x: 360, y: 570 });
  for (const a of anchors) {
    const p = pegs.filter(p => p.kind === 'blue').sort((p, q) =>
      Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    p.kind = 'green';
  }
  for (const a of [{ x: 125, y: 560 }, { x: 580, y: 230 }]) {
    const p = pegs.filter(p => p.kind === 'blue').sort((p, q) =>
      Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    p.kind = 'purple';
  }
  const free = pegs.filter(p => p.kind === 'blue');
  for (let i = 0; i < orangeCount; i++) free[Math.floor((i + .5) * free.length / orangeCount)].kind = 'orange';
  return Object.freeze({ id, title, balls, pegs: Object.freeze(pegs.map(Object.freeze)) });
}
const diamonds = [];
for (let row = 0; row < 9; row++) {
  const n = 9 - 2 * Math.abs(4 - row);
  for (let col = 0; col < n; col++) diamonds.push({ x: 360 + (col - (n - 1) / 2) * 52, y: 162 + row * 53 });
}
const spiral = [];
for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 18; i++) {
  const radius = 60 + i * 11, a = arm * 2 * Math.PI / 3 + i * .245;
  spiral.push({ x: 360 + Math.cos(a) * radius, y: 385 + Math.sin(a) * radius * .86 });
}
export const BLAST_LEVELS = Object.freeze([
  board(1, 'Posteingang', 12, 10, rows(5, 8, 73, 78, 168, 10)),
  board(2, 'Kaffeekreise', 12, 12, [
    ...ellipse(210, 265, 125, 108, 14), ...ellipse(500, 285, 125, 120, 14),
    ...ellipse(355, 525, 175, 100, 18), { x: 360, y: 320 }, { x: 340, y: 390 },
  ]),
  board(3, 'Die Folienleiter', 11, 13, rows(7, 7, 75, 66, 155, 24)),
  board(4, 'Budgetwelle', 11, 14, Array.from({ length: 52 }, (_, i) => {
    const row = Math.floor(i / 13), col = i % 13;
    return { x: 75 + col * 47.5, y: 195 + row * 112 + Math.sin(col * .67 + row * .75) * 42 };
  })),
  board(5, 'Doppeltes Reporting', 10, 16, [
    ...rows(7, 3, 57, 66, 166).map(p => ({ x: p.x - 183, y: p.y })),
    ...rows(7, 3, 57, 66, 166).map(p => ({ x: p.x + 183, y: p.y })),
    ...Array.from({ length: 9 }, (_, i) => ({ x: 300 + i % 3 * 60, y: 236 + Math.floor(i / 3) * 145 })),
  ]),
  board(6, 'Der Business Case', 10, 17, diamonds),
  board(7, 'Die Storyline', 9, 19, spiral),
  board(8, 'Vorstandsrunde', 9, 21, [
    ...ellipse(360, 385, 278, 234, 26), ...ellipse(360, 385, 182, 154, 18),
    ...ellipse(360, 385, 83, 75, 10), { x: 360, y: 385 },
  ]),
  board(9, 'Nachtschicht', 8, 23, rows(7, 8, 71, 68, 158, 19).map((p, i) => ({
    x: p.x, y: p.y + Math.sin(i % 8 * 1.1) * 19,
  }))),
  board(10, 'Partner-Pitch', 8, 25, [
    ...rows(7, 9, 63, 67, 164, 12),
    { x: 68, y: 220 }, { x: 652, y: 220 }, { x: 68, y: 470 }, { x: 652, y: 470 },
  ]),
]);
