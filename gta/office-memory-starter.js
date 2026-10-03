/** Personal desk notes for still-unused pinboard space; never progress or rewards. */
export const STARTER_NOTES = Object.freeze([
  { color: '#ead79a', ink: '#4b554c', w: 220, h: 166, angle: -0.065, dx: -7, dy: -4, pin: '#74887e', kind: 'quick', lines: ['Nur noch', 'kurz.'] },
  { color: '#bbcdcf', ink: '#365960', w: 230, h: 103, angle: 0.047, dx: 7, dy: -17, tape: true, kind: 'save', lines: ['Speichern!'] },
  { color: '#f0e9d9', ink: '#7c7866', w: 185, h: 186, angle: 0.07, dx: -8, dy: 3, tape: true, kind: 'coffee', lines: [] },
  { color: '#eeeadb', ink: '#586c6a', w: 203, h: 173, angle: 0.052, dx: -4, dy: 3, pin: '#b28262', kind: 'plan', lines: ['Plan B.'] },
  { color: '#bbc9ab', ink: '#405d4e', w: 205, h: 148, angle: -0.052, dx: 9, dy: 1, pin: '#a78b55', kind: 'lunch', lines: ['Mittag?'] },
  { color: '#d8b2a0', ink: '#65544d', w: 219, h: 146, angle: -0.036, dx: -6, dy: -9, tape: true, kind: 'final', lines: ['final_v2'] },
].map(Object.freeze));

const line = (c, points) => {
  c.beginPath(); c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.stroke();
};
function tape(c, x, y, width, angle) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.fillStyle = 'rgba(240,226,194,0.80)';
  c.beginPath(); c.moveTo(-width / 2, -11);
  c.lineTo(width / 2, -10); c.lineTo(width / 2 - 3, -4);
  c.lineTo(width / 2 + 1, 2); c.lineTo(width / 2 - 3, 9);
  c.lineTo(-width / 2, 10); c.lineTo(-width / 2 + 3, 3);
  c.lineTo(-width / 2 - 1, -3); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(163,143,112,0.20)'; c.lineWidth = 1; c.stroke();
  c.restore();
}
function pin(c, x, y, color) {
  c.fillStyle = 'rgba(55,46,35,0.24)';
  c.beginPath(); c.ellipse(x + 3, y + 4, 7, 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = color; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,250,229,0.60)'; c.beginPath(); c.arc(x - 1.5, y - 2, 1.6, 0, Math.PI * 2); c.fill();
}
export function paintStarterNote(c, index, x, y) {
  const note = STARTER_NOTES[index];
  if (!note) return false;
  const { w, h } = note;
  c.save(); c.translate(x + 155 + note.dx, y + 122 + note.dy); c.rotate(note.angle);
  // Baked, subtle paper lift. No runtime light or translucent scene geometry.
  c.save(); c.shadowColor = 'rgba(70,55,35,0.19)'; c.shadowBlur = 6; c.shadowOffsetY = 5;
  c.fillStyle = note.color; c.fillRect(-w / 2, -h / 2, w, h); c.restore();
  c.strokeStyle = 'rgba(255,255,239,0.42)'; c.lineWidth = 1;
  line(c, [[-w / 2 + 1, -h / 2 + 1], [w / 2 - 1, -h / 2 + 1]]);
  c.fillStyle = 'rgba(250,245,225,0.40)';
  c.beginPath(); c.moveTo(w / 2 - 17, h / 2); c.lineTo(w / 2 - 1, h / 2 - 17); c.lineTo(w / 2, h / 2); c.closePath(); c.fill();
  c.strokeStyle = note.ink; c.fillStyle = note.ink; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = "600 27px 'Segoe Print', 'Bradley Hand', cursive";
  if (note.kind === 'quick') {
    c.fillText(note.lines[0], 0, -22); c.fillText(note.lines[1], 0, 18);
    line(c, [[-37, 40], [-1, 42], [39, 39]]);
    line(c, [[43, 18], [53, 22], [49, 10]]);
  } else if (note.kind === 'save') {
    c.fillText(note.lines[0], 8, 3);
    // Tiny folded-page corner, not a completed task checkmark.
    c.lineWidth = 1.6; line(c, [[-99, 15], [-99, -12], [-86, -12], [-79, -5], [-79, 15], [-99, 15]]);
    line(c, [[-86, -12], [-86, -5], [-79, -5]]);
  } else if (note.kind === 'coffee') {
    c.lineWidth = 2.2;
    line(c, [[-33, -19], [-30, 36], [28, 36], [32, -19], [-33, -19]]);
    c.beginPath(); c.ellipse(41, 5, 15, 17, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.beginPath(); c.ellipse(0, 48, 55, 6, 0, 0, Math.PI * 2); c.stroke();
    for (const offset of [-15, 8]) {
      c.beginPath(); c.moveTo(offset, -34); c.bezierCurveTo(offset + 11, -47, offset - 8, -51, offset + 3, -65); c.stroke();
    }
    c.fillStyle = 'rgba(134,101,66,0.13)';
    c.beginPath(); c.arc(53, 61, 15, 0, Math.PI * 2); c.fill();
  } else if (note.kind === 'plan') {
    c.strokeStyle = 'rgba(115,141,147,0.18)'; c.lineWidth = 1;
    for (let q = -70; q <= 70; q += 18) line(c, [[q, -h / 2 + 9], [q, h / 2 - 10]]);
    for (let q = -65; q <= 65; q += 18) line(c, [[-w / 2 + 9, q], [w / 2 - 9, q]]);
    c.strokeStyle = note.ink; c.fillText(note.lines[0], 0, -39); c.lineWidth = 2;
    c.strokeRect(-61, -6, 40, 29); c.strokeRect(21, -6, 40, 29);
    line(c, [[-18, 8], [17, 8], [11, 3]]); line(c, [[17, 8], [11, 13]]);
    c.font = "22px 'Segoe Print', cursive"; c.fillText('?', 41, 10);
  } else if (note.kind === 'lunch') {
    c.fillText(note.lines[0], 0, -16);
    // An unfinished lunch doodle: it implies a plan, not restaurant loyalty already earned.
    c.beginPath(); c.arc(0, 29, 19, 0, Math.PI * 2); c.stroke();
    line(c, [[-38, 15], [-38, 47]]); line(c, [[-45, 12], [-45, 25], [-31, 25], [-31, 12]]);
    line(c, [[-38, 11], [-38, 25]]); line(c, [[37, 12], [37, 47]]);
  } else if (note.kind === 'final') {
    c.font = "24px 'Segoe Print', 'Bradley Hand', cursive";
    c.fillText(note.lines[0], -1, 5);
    line(c, [[43, -6], [65, 12]]); line(c, [[43, 12], [64, -5]]);
    c.font = "23px 'Segoe Print', cursive"; c.fillText('3', 74, -15);
    c.strokeStyle = 'rgba(101,84,77,0.28)'; c.lineWidth = 1.3;
    line(c, [[-68, 31], [-21, 31], [14, 33]]);
  }
  if (note.pin) pin(c, 0, -h / 2 + 10, note.pin);
  if (note.tape) tape(c, note.kind === 'coffee' ? -18 : 4, -h / 2 + 2, note.kind === 'coffee' ? 69 : 87, -note.angle - 0.075);
  c.restore();
  return true;
}
