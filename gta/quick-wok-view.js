// Logical stage coordinates make pointer drops independent of resolution and device pixel ratio.
export const WOK = Object.freeze({ x: 638, y: 383, rx: 184, ry: 154 });
export function insideWok(x, y, rect) {
  if (
    !rect ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    ![x, y, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
  )
    return false;
  const px = ((x - rect.left) * 1200) / rect.width,
    py = ((y - rect.top) * 720) / rect.height;
  return ((px - WOK.x) / WOK.rx) ** 2 + ((py - WOK.y) / WOK.ry) ** 2 <= 1;
}
const ellipse = (c, x, y, rx, ry, fill, rotation = 0) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
};
const rounded = (c, x, y, w, h, r, fill) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
};
export class QuickWokView {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false });
    this.background = document.createElement('canvas');
    this.background.width = 1200;
    this.background.height = 720;
    this.makeBackground(this.background.getContext('2d'));
  }
  makeBackground(c) {
    const base = c.createLinearGradient(0, 0, 0, 720);
    base.addColorStop(0, '#f6f0df');
    base.addColorStop(0.38, '#e5d9c0');
    base.addColorStop(1, '#d9b789');
    c.fillStyle = base;
    c.fillRect(0, 0, 1200, 720);
    // Sage tiles, finely grained oak and an inset steel cooking station.
    for (let y = 0; y < 260; y += 64)
      for (let x = -40; x < 1250; x += 112) {
        rounded(c, x + (y % 128 ? 56 : 0), y, 109, 61, 3, (x + y) % 3 ? '#d4dfc8' : '#cad6bc');
      }
    const shade = c.createLinearGradient(0, 100, 0, 284);
    shade.addColorStop(0, '#f6f0dff2');
    shade.addColorStop(1, '#f6f0df00');
    c.fillStyle = shade;
    c.fillRect(0, 0, 1200, 280);
    c.fillStyle = '#b3956b';
    c.fillRect(0, 262, 1200, 7);
    c.fillStyle = '#f6deab';
    c.fillRect(0, 270, 1200, 3);
    c.strokeStyle = '#855c2920';
    c.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
      let y = 282 + i * 3;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(330, y + Math.sin(i) * 4, 790, y + Math.cos(i) * 8, 1200, y + 2);
      c.stroke();
    }
    for (const x of [330, 750, 1100]) {
      c.fillStyle = '#805a2c16';
      c.fillRect(x, 277, 2, 443);
    }
    c.save();
    c.shadowColor = '#302b3045';
    c.shadowBlur = 28;
    c.shadowOffsetY = 12;
    rounded(c, 371, 216, 491, 389, 34, '#344348');
    c.restore();
    const metal = c.createLinearGradient(360, 220, 850, 580);
    metal.addColorStop(0, '#84918c');
    metal.addColorStop(0.1, '#596667');
    metal.addColorStop(1, '#27383b');
    rounded(c, 380, 221, 473, 371, 28, metal);
    for (const x of [407, 825])
      for (const y of [242, 568]) {
        ellipse(c, x, y, 3, 3, '#b8c7bd');
        c.strokeStyle = '#506061';
        c.beginPath();
        c.moveTo(x - 2, y);
        c.lineTo(x + 2, y);
        c.stroke();
      }
    c.save();
    c.translate(1002, 414);
    c.rotate(0.11);
    rounded(c, -145, -136, 278, 272, 12, '#e7e2cc');
    c.strokeStyle = '#6d877731';
    c.lineWidth = 2;
    for (let i = -128; i < 140; i += 17) {
      c.beginPath();
      c.moveTo(i, -136);
      c.lineTo(i, 136);
      c.moveTo(-145, i);
      c.lineTo(133, i);
      c.stroke();
    }
    c.restore();
    c.save();
    c.shadowColor = '#3c493d30';
    c.shadowBlur = 16;
    c.shadowOffsetY = 8;
    ellipse(c, 999, 393, 124, 100, '#fcf7e7');
    c.restore();
    ellipse(c, 999, 390, 104, 83, '#dfdfca');
    ellipse(c, 999, 388, 99, 78, '#f6efda');
    // Rice bowl, lime, chopsticks and a fresh sprig: set dressing without cluttering the controls.
    ellipse(c, 988, 601, 58, 34, '#2f6958');
    ellipse(c, 988, 591, 56, 30, '#efe9ca');
    for (let i = 0; i < 80; i++) {
      const a = i * 2.4,
        rad = Math.sqrt(i / 80) * 46;
      ellipse(c, 988 + Math.cos(a) * rad, 588 + Math.sin(a) * rad * 0.48, 5, 2, '#fff4dc', a);
    }
    ellipse(c, 1110, 606, 25, 22, '#5c813c');
    ellipse(c, 1110, 603, 21, 18, '#b7cc78');
    c.strokeStyle = '#e2ecc0';
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.moveTo(1110, 603);
      c.lineTo(1110 + Math.cos(a) * 20, 603 + Math.sin(a) * 17);
      c.stroke();
    }
    c.save();
    c.translate(1120, 345);
    c.rotate(-0.12);
    rounded(c, -3, -85, 5, 194, 2, '#784d28');
    rounded(c, 9, -85, 5, 194, 2, '#916232');
    c.restore();
    for (let i = 0; i < 6; i++)
      ellipse(c, 890 + Math.sin(i) * 18, 598 + i * 5, 15, 7, i % 2 ? '#3e7050' : '#61844b', i);
    c.fillStyle = '#35534e';
    c.font = '600 12px sans-serif';
    c.textAlign = 'center';
    c.fillText('FRISCH. HEISS. FERTIG.', 996, 243);
  }
  draw(m, stir) {
    const c = this.c,
      canvas = this.canvas,
      r = m.round,
      t = m.elapsed;
    const rect = canvas.getBoundingClientRect(),
      scale =
        Math.min(2, globalThis.devicePixelRatio || 1) *
        Math.max(0.3, Math.min(1.5, rect.width / 1200));
    const width = Math.round(1200 * scale),
      height = Math.round(720 * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    c.setTransform(width / 1200, 0, 0, height / 720, 0, 0);
    c.drawImage(this.background, 0, 0);
    const wobble = stir && r.phase === 'sear' ? Math.sin(t * 11) * 2 : 0;
    c.save();
    c.translate(WOK.x, WOK.y + wobble);
    if (r.phase === 'sear') {
      const glow = c.createRadialGradient(0, 35, 80, 0, 35, 198);
      glow.addColorStop(0, '#f5b55390');
      glow.addColorStop(1, '#f5b55300');
      ellipse(c, 0, 20, 205, 166, glow);
    }
    c.save();
    c.rotate(-0.3);
    rounded(c, 141, 3, 144, 32, 13, '#8c6742');
    rounded(c, 139, 8, 48, 21, 7, '#87938d');
    rounded(c, 193, 9, 78, 7, 3, '#a18056');
    c.restore();
    ellipse(c, -183, 0, 26, 44, '#273335');
    ellipse(c, -183, -2, 13, 27, '#677776');
    c.save();
    c.shadowColor = '#15232490';
    c.shadowBlur = 22;
    c.shadowOffsetY = 14;
    ellipse(c, 0, 0, 181, 151, '#93a19b');
    c.restore();
    const bowl = c.createRadialGradient(-42, -48, 15, 0, 0, 185);
    bowl.addColorStop(0, '#546366');
    bowl.addColorStop(0.63, '#293b40');
    bowl.addColorStop(1, '#12272d');
    ellipse(c, 0, -3, 173, 143, bowl);
    ellipse(c, -4, 3, 139, 111, '#203439');
    c.strokeStyle = m.hover ? '#e9d187' : '#a6b9a366';
    c.lineWidth = m.hover ? 5 : 2;
    c.beginPath();
    c.ellipse(0, -3, 180, 150, 0, 0, Math.PI * 2);
    c.stroke();
    const served = ['serve', 'done'].includes(r.phase),
      pour = served ? Math.min(1, r.serveTime / 1.1) : 0;
    if (r.added.length && !served) {
      c.save();
      if (r.step === 3) {
        ellipse(c, 0, 0, 128, 99, r.recipe.protein === 'Garnelen' ? '#ac69492e' : '#cf94366b');
        for (let i = 0; i < 22; i++) {
          const a = i * 2.4,
            rad = 32 + (i % 6) * 17;
          ellipse(
            c,
            Math.cos(a) * rad,
            Math.sin(a) * rad * 0.75,
            2 + Math.sin(t * 5 + i),
            1.5,
            '#f1d48890',
          );
        }
      }
      this.food(c, r, t, stir, 1);
      c.restore();
    } else if (!r.added.length) {
      c.strokeStyle = '#c7d4c067';
      c.lineWidth = 2;
      c.setLineDash([7, 10]);
      c.beginPath();
      c.ellipse(0, 0, 113, 85, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = '#d9e2cb';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -22);
      c.lineTo(0, 22);
      c.moveTo(-13, 9);
      c.lineTo(0, 22);
      c.lineTo(13, 9);
      c.stroke();
    }
    if (r.phase === 'sear') {
      c.strokeStyle = r.dry > 1.5 ? '#f3a975' : '#d2dea3';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.ellipse(0, -3, 188, 158, 0, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * r.cooked) / 100);
      c.stroke();
      c.save();
      c.translate(stir ? Math.sin(t * 7) * 75 : 92, stir ? Math.cos(t * 7) * 48 : 40);
      c.rotate(stir ? Math.sin(t * 7) * 0.7 : 0.3);
      rounded(c, -9, -6, 18, 181, 8, '#ad804b');
      ellipse(c, 0, -12, 25, 39, '#c3975e');
      ellipse(c, -3, -18, 15, 23, '#e0b478');
      c.restore();
    }
    for (const drop of m.drops) {
      const p = drop.age / 0.6;
      c.save();
      c.globalAlpha = 1 - p;
      c.strokeStyle = '#f9e5ab';
      c.lineWidth = 3;
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4,
          rad = 20 + p * 140;
        c.beginPath();
        c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.7);
        c.lineTo(Math.cos(a) * (rad + 14), Math.sin(a) * (rad + 14) * 0.7);
        c.stroke();
      }
      c.restore();
    }
    c.restore();
    if (r.phase === 'sear' || served) {
      for (let i = 0; i < 8; i++) {
        const p = (t * 0.55 + i / 8) % 1;
        c.save();
        c.globalAlpha = Math.sin(p * Math.PI) * 0.22 * (served ? 0.5 : 1);
        c.strokeStyle = '#fff9e0';
        c.lineWidth = 8;
        c.lineCap = 'round';
        c.beginPath();
        const x = 540 + (i % 4) * 58;
        c.moveTo(x, 330 - p * 120);
        c.bezierCurveTo(x + 25, 303 - p * 125, x - 15, 285 - p * 135, x + 8, 260 - p * 140);
        c.stroke();
        c.restore();
      }
    }
    if (served) {
      c.save();
      c.translate(
        WOK.x + (999 - WOK.x) * pour,
        WOK.y + (388 - WOK.y) * pour - Math.sin(pour * Math.PI) * 120,
      );
      c.scale(1 - pour * 0.48, 1 - pour * 0.48);
      ellipse(
        c,
        0,
        0,
        127,
        94,
        r.recipe.protein === 'Garnelen'
          ? '#b87945'
          : r.recipe.protein === 'Tofu'
            ? '#925e39'
            : '#c98f36',
      );
      this.food(c, r, t, false, 1);
      c.restore();
    }
    if (r.passed) {
      for (let i = 0; i < 24; i++) {
        const a = i * 2.4,
          p = Math.min(1, m.resultTime / 1.25);
        c.save();
        c.globalAlpha = 1 - p * 0.6;
        c.translate(
          999 + Math.cos(a) * (35 + p * 130),
          388 + Math.sin(a) * (35 + p * 125) + p * p * 50,
        );
        c.rotate(a + p * 2);
        c.fillStyle = ['#d7ac54', '#6c9670', '#fff6dc'][i % 3];
        c.fillRect(-3, -6, 6, 12);
        c.restore();
      }
    }
  }
  food(c, r, t, stir) {
    const angle = stir ? t * 4 : 0;
    for (let j = 0; j < r.added.length; j++)
      for (let i = 0; i < 14; i++) {
        const a = i * 2.399 + j * 1.9 + angle * (0.7 + (i % 3) * 0.13),
          rad = Math.sqrt((i + 1) / 15) * 105;
        const x = Math.cos(a) * rad,
          y = Math.sin(a) * rad * 0.68 + (stir ? Math.sin(t * 9 + i) * 7 : 0);
        c.save();
        c.translate(x, y);
        c.rotate(a * 0.6);
        c.shadowColor = '#17232160';
        c.shadowBlur = 3;
        c.shadowOffsetY = 3;
        const ingredient = r.added[j];
        if (['Gemüse', 'Paprika', 'Bambus + Morcheln'].includes(ingredient)) {
          if (i % 3 === 0) {
            rounded(c, -4, -15, 9, 29, 4, '#c45431');
            rounded(c, -2, -13, 3, 23, 2, '#ee9660');
          } else if (i % 3 === 1) {
            rounded(c, -4, -3, 7, 19, 2, '#8baf57');
            for (let k = 0; k < 3; k++)
              ellipse(c, -8 + k * 8, -6 - Math.sin(k) * 4, 8, 7, k % 2 ? '#a5bc66' : '#729649');
          } else {
            ellipse(c, 0, 0, 12, 8, '#a7c477');
            ellipse(c, -2, -2, 7, 4, '#d8e5a3');
          }
        } else if (ingredient === 'Garnelen') {
          c.beginPath();
          c.arc(0, 0, 11, 0.3, Math.PI * 1.8);
          c.strokeStyle = '#eeac80';
          c.lineWidth = 10;
          c.stroke();
          c.lineWidth = 3;
          c.strokeStyle = '#ffd4ad';
          c.stroke();
        } else if (ingredient === 'Reisbandnudeln') {
          c.beginPath();
          c.moveTo(-18, -3);
          c.bezierCurveTo(0, -22, 22, 22, 32, 0);
          c.strokeStyle = '#e9cf91';
          c.lineWidth = 4;
          c.stroke();
        } else if (ingredient === 'Currypaste') {
          ellipse(c, 0, 0, 4, 2, '#e9b65c');
        } else {
          const tofu = ingredient === 'Tofu',
            duck = ingredient === 'Ente';
          rounded(
            c,
            -12,
            -8,
            24,
            17,
            tofu ? 3 : 7,
            duck ? '#935033' : tofu ? '#e8d4a4' : '#cf955e',
          );
          rounded(c, -10, -7, 18, 9, 4, duck ? '#d69255' : tofu ? '#fff0c9' : '#f0c391');
          if (i % 2) {
            c.fillStyle = '#9d684340';
            c.fillRect(-6, 2, 14, 2);
          }
        }
        c.restore();
      }
  }
}
