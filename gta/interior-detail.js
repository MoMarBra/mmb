import * as THREE from 'three';

// Shared, immutable resources. All small fittings are instanced, including in
// rooms created after GameWorld.batchScenes. No additional real-time lights.
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
  sphere: new THREE.SphereGeometry(1, 14, 9),
  cone: new THREE.CylinderGeometry(0.45, 1, 1, 20),
  ring: new THREE.TorusGeometry(1, 0.12, 6, 22),
  plane: new THREE.PlaneGeometry(1, 1),
};
const MATERIALS = new Map();
const TEXTURES = new Map();
const C = {
  oak: '#b68b59',
  walnut: '#634a34',
  cream: '#eee6d3',
  paper: '#f8f1de',
  brass: '#bc9256',
  dark: '#253a3b',
  teal: '#456d69',
  leaf: '#63834b',
  terracotta: '#bd7958',
  fabric: '#b6b09c',
  steel: '#9eaaa5',
  ink: '#183b43',
};
function mat(color, options = {}) {
  color = C[color] || color;
  const key = color + JSON.stringify(options);
  if (!MATERIALS.has(key))
    MATERIALS.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: options.metal ? 0.38 : 0.79,
        metalness: options.metal ? 0.55 : 0,
        ...(options.glow ? { emissive: color, emissiveIntensity: 0.48 } : {}),
      }),
    );
  return MATERIALS.get(key);
}
function builder(parent, name) {
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  const batches = new Map(),
    temp = new THREE.Object3D();
  function add(kind, p, s, color = 'oak', rotation = [0, 0, 0], options = {}) {
    const material = mat(color, options),
      shadow = !!options.shadow;
    const key = kind + ':' + material.uuid + ':' + shadow;
    if (!batches.has(key)) batches.set(key, { kind, material, shadow, matrices: [] });
    temp.position.set(...p);
    temp.scale.set(...s);
    temp.rotation.set(...rotation);
    temp.updateMatrix();
    batches.get(key).matrices.push(temp.matrix.clone());
  }
  const api = {
    group,
    add,
    box: (p, s, c, r, o) => add('box', p, s, c, r, o),
    cylinder: (p, r, h, c, o) => add('cylinder', p, [r, h, r], c, undefined, o),
    sphere: (p, s, c, r, o) => add('sphere', p, s, c, r, o),
    finish() {
      let instances = 0;
      for (const item of batches.values()) {
        const mesh = new THREE.InstancedMesh(GEO[item.kind], item.material, item.matrices.length);
        mesh.name = name + ' · ' + item.kind;
        item.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.castShadow = item.shadow;
        mesh.receiveShadow = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        group.add(mesh);
        instances += item.matrices.length;
      }
      group.userData.detailBudget = { batches: batches.size, instances };
      return group;
    },
  };
  return api;
}
function texture(key, w, h, draw) {
  if (TEXTURES.has(key)) return TEXTURES.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  TEXTURES.set(key, tex);
  return tex;
}
function path(c, points, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...points[0]);
  for (const p of points.slice(1)) c.lineTo(...p);
  c.closePath();
  c.fill();
}
function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function portraitTexture() {
  return texture('employee-portrait', 768, 1024, (c, w, h) => {
    c.fillStyle = '#eee4ca';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#bf9a60';
    c.lineWidth = 3;
    c.strokeRect(21, 21, w - 42, h - 42);
    c.fillStyle = '#244a50';
    c.textAlign = 'center';
    c.font = '600 38px Georgia, serif';
    c.fillText('MITARBEITER', w / 2, 86);
    c.font = '25px Arial, sans-serif';
    c.fillText('DES MONATS', w / 2, 127);
    const grad = c.createLinearGradient(60, 160, 690, 805);
    grad.addColorStop(0, '#86a49a');
    grad.addColorStop(1, '#244d58');
    c.fillStyle = grad;
    c.fillRect(60, 163, w - 120, 650);
    c.fillStyle = '#b7c6ac';
    c.fillRect(87, 189, 154, 420);
    c.fillStyle = '#d8dac3';
    c.fillRect(101, 201, 8, 390);
    c.fillRect(112, 413, 110, 8);
    ellipse(c, 385, 794, 224, 30, '#173940');
    path(
      c,
      [
        [162, 813],
        [181, 594],
        [286, 538],
        [491, 538],
        [600, 594],
        [620, 813],
      ],
      '#1c4859',
    );
    path(
      c,
      [
        [273, 556],
        [329, 534],
        [385, 608],
        [438, 534],
        [492, 556],
        [430, 813],
        [327, 813],
      ],
      '#eceddd',
    );
    path(
      c,
      [
        [278, 557],
        [217, 608],
        [299, 658],
        [281, 701],
        [341, 813],
        [352, 636],
      ],
      '#315e6b',
    );
    path(
      c,
      [
        [492, 557],
        [550, 608],
        [474, 658],
        [491, 701],
        [430, 813],
        [415, 636],
      ],
      '#356674',
    );
    path(
      c,
      [
        [357, 608],
        [384, 591],
        [410, 608],
        [397, 640],
        [415, 806],
        [353, 806],
        [373, 640],
      ],
      '#a7844e',
    );
    c.fillStyle = '#bd8d6b';
    c.fillRect(338, 488, 94, 91);
    ellipse(c, 280, 405, 25, 39, '#c99675');
    ellipse(c, 487, 405, 25, 39, '#c99675');
    ellipse(c, 384, 390, 106, 142, '#d4a382');
    ellipse(c, 361, 383, 83, 119, '#deb293');
    path(
      c,
      [
        [278, 381],
        [269, 316],
        [296, 253],
        [365, 221],
        [441, 239],
        [486, 283],
        [494, 375],
        [469, 355],
        [458, 288],
        [398, 303],
        [343, 286],
        [303, 331],
        [300, 380],
      ],
      '#382f29',
    );
    path(
      c,
      [
        [285, 308],
        [277, 275],
        [332, 233],
        [397, 227],
        [452, 251],
        [465, 278],
        [405, 269],
        [351, 291],
      ],
      '#46392e',
    );
    c.strokeStyle = '#4d3d32';
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(318, 366);
    c.lineTo(351, 361);
    c.moveTo(416, 361);
    c.lineTo(450, 366);
    c.stroke();
    ellipse(c, 337, 388, 8, 6, '#29343a');
    ellipse(c, 433, 388, 8, 6, '#29343a');
    c.strokeStyle = '#b08264';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(388, 390);
    c.lineTo(378, 435);
    c.lineTo(397, 438);
    c.stroke();
    c.strokeStyle = '#855f4c';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(352, 468);
    c.quadraticCurveTo(385, 489, 419, 466);
    c.stroke();
    ellipse(c, 610, 754, 54, 54, '#c89e53');
    ellipse(c, 610, 754, 44, 44, '#e7c67d');
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 13 : 29;
      star.push([610 + Math.cos(a) * r, 754 + Math.sin(a) * r]);
    }
    path(c, star, '#775b31');
    c.fillStyle = '#274d55';
    c.font = '700 53px Arial, sans-serif';
    c.fillText('DU', 384, 887);
    c.font = '21px Arial, sans-serif';
    c.fillText('GROSSE IDEEN. KLEINE KAFFEEPAUSEN.', 384, 936);
    c.fillStyle = '#ab8952';
    c.fillRect(230, 966, 308, 3);
  });
}
function artTexture(kind, accent = '#56746b') {
  return texture('art-' + kind + '-' + accent, 512, 640, (c, w, h) => {
    c.fillStyle = '#e8dcc2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = accent;
    c.fillRect(38, 38, w - 76, h - 76);
    if (kind === 'munich') {
      ellipse(c, 366, 182, 72, 72, '#e9c481');
      path(
        c,
        [
          [54, 447],
          [170, 287],
          [265, 442],
          [349, 324],
          [464, 451],
          [464, 563],
          [54, 563],
        ],
        '#708783',
      );
      c.fillStyle = '#d6cab0';
      c.fillRect(166, 334, 64, 194);
      c.fillRect(282, 334, 64, 194);
      c.fillRect(220, 416, 69, 112);
      ellipse(c, 198, 331, 32, 36, '#526966');
      ellipse(c, 314, 331, 32, 36, '#526966');
      for (const x of [181, 297])
        for (const y of [385, 433, 481]) {
          c.fillStyle = '#4f6864';
          c.fillRect(x, y, 9, 24);
          c.fillRect(x + 20, y, 9, 24);
        }
    } else if (kind === 'botanical') {
      c.strokeStyle = '#d6c9a6';
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(253, 560);
      c.bezierCurveTo(270, 409, 211, 285, 278, 129);
      c.stroke();
      for (let i = 0; i < 9; i++) {
        const y = 174 + i * 40,
          x = 256 + Math.sin(i) * 12;
        ellipse(c, x + (i % 2 ? 45 : -43), y, 55, 19, i % 2 ? '#c6c9a0' : '#8aa07b');
      }
      ellipse(c, 256, 544, 59, 12, '#d2b989');
    } else if (kind === 'sun') {
      ellipse(c, 256, 248, 110, 110, '#efc27d');
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? '#cfa974' : '#e3ca9e';
        c.fillRect(64, 407 + i * 18, 384, 7);
      }
    } else if (kind === 'ramen') {
      ellipse(c, 256, 446, 157, 38, '#243944');
      ellipse(c, 256, 378, 156, 89, '#e4ddc7');
      ellipse(c, 256, 365, 140, 72, '#b98950');
      c.strokeStyle = '#dfc997';
      c.lineWidth = 6;
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.ellipse(228 + i * 7, 367, 60, 30, i * 0.3, 0, Math.PI * 1.85);
        c.stroke();
      }
      ellipse(c, 317, 349, 37, 26, '#f0e6cb');
      ellipse(c, 317, 349, 19, 17, '#dfa848');
      c.strokeStyle = '#a5b798';
      c.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(220 + i * 35, 268);
        c.bezierCurveTo(180 + i * 35, 220, 259 + i * 35, 193, 228 + i * 35, 143);
        c.stroke();
      }
    } else if (kind === 'grain') {
      c.strokeStyle = '#d5b278';
      c.lineWidth = 7;
      for (const x of [178, 256, 334]) {
        c.beginPath();
        c.moveTo(x, 544);
        c.lineTo(x, 202);
        c.stroke();
        for (let i = 0; i < 6; i++) {
          ellipse(c, x - 15, 224 + i * 34, 19, 10, '#e3c78b');
          ellipse(c, x + 15, 242 + i * 34, 19, 10, '#ceb071');
        }
      }
    } else {
      ellipse(c, 256, 303, 147, 147, '#e3af6f');
      ellipse(c, 256, 303, 127, 127, '#bd654b');
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4,
          r = 20 + (i % 3) * 31;
        ellipse(
          c,
          256 + Math.cos(a) * r,
          303 + Math.sin(a) * r,
          26,
          18,
          i % 2 ? '#ead5a3' : '#708961',
        );
      }
    }
    c.fillStyle = '#e6d4b2';
    c.textAlign = 'center';
    c.font = '26px Georgia, serif';
    c.fillText(
      kind === 'munich'
        ? 'MÜNCHEN'
        : kind === 'botanical'
          ? 'GROW SLOW'
          : kind === 'ramen'
            ? 'GUTER GESCHMACK'
            : kind === 'grain'
              ? 'GUTE ZEIT'
              : 'BON APPÉTIT',
      w / 2,
      604,
    );
  });
}
function frame(b, p, size, tex, yaw = 0, frameColor = 'walnut') {
  const [w, h] = size,
    sn = Math.sin(yaw),
    co = Math.cos(yaw);
  b.box([p[0] - 0.035 * sn, p[1], p[2] - 0.035 * co], [w + 0.11, h + 0.11, 0.065], frameColor, [
    0,
    yaw,
    0,
  ]);
  b.box([p[0] + 0.002 * sn, p[1], p[2] + 0.002 * co], [w + 0.025, h + 0.025, 0.018], 'paper', [
    0,
    yaw,
    0,
  ]);
  const face = new THREE.Mesh(
    GEO.plane,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.83, side: THREE.FrontSide }),
  );
  face.position.set(p[0] + 0.017 * sn, p[1], p[2] + 0.017 * co);
  face.rotation.y = yaw;
  face.scale.set(w, h, 1);
  face.name = 'Printed artwork';
  b.group.add(face);
  return face;
}
function rugTexture(kind = 'woven', accent = '#657c74') {
  return texture('rug-' + kind + '-' + accent, 512, 512, (c, w, h) => {
    c.fillStyle = accent;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d8c7a8';
    c.lineWidth = 11;
    c.strokeRect(22, 22, 468, 468);
    c.lineWidth = 3;
    c.strokeRect(39, 39, 434, 434);
    c.fillStyle = 'rgba(235,225,202,.1)';
    for (let i = 0; i < 512; i += 5) c.fillRect(0, i, 512, 1);
    c.fillStyle = 'rgba(19,39,39,.09)';
    for (let i = 0; i < 512; i += 5) c.fillRect(i, 0, 1, 512);
    if (kind === 'geo')
      for (const x of [128, 256, 384])
        for (const y of [128, 256, 384])
          path(
            c,
            [
              [x, y - 40],
              [x + 28, y],
              [x, y + 40],
              [x - 28, y],
            ],
            '#c4b28e',
          );
    else {
      c.strokeStyle = 'rgba(230,210,171,.28)';
      c.lineWidth = 2;
      for (let r = 50; r < 180; r += 14) {
        c.beginPath();
        c.arc(256, 256, r, 0, Math.PI * 2);
        c.stroke();
      }
    }
  });
}
function rug(b, x, z, w, d, color, kind = 'woven') {
  const mesh = new THREE.Mesh(
    GEO.plane,
    new THREE.MeshStandardMaterial({
      map: rugTexture(kind, color),
      roughness: 1,
      side: THREE.FrontSide,
    }),
  );
  mesh.position.set(x, 0.022, z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(w, d, 1);
  mesh.receiveShadow = true;
  mesh.name = 'Woven rug';
  b.group.add(mesh);
  return mesh;
}
function plant(b, x, y, z, s = 0.65, color = 'terracotta') {
  b.add('cone', [x, y + 0.18 * s, z], [0.23 * s, 0.36 * s, 0.23 * s], color, [Math.PI, 0, 0]);
  b.cylinder([x, y + 0.365 * s, z], 0.2 * s, 0.018 * s, 'walnut');
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399,
      r = 0.17 * s;
    b.sphere(
      [x + Math.cos(a) * r, y + (0.64 + (i % 3) * 0.13) * s, z + Math.sin(a) * r],
      [0.105 * s, 0.27 * s, 0.068 * s],
      i % 2 ? 'leaf' : '#3f654a',
      [Math.sin(a) * 0.35, a, Math.cos(a) * 0.5],
    );
  }
}
function books(b, x, y, z, n = 7, axis = 'x') {
  const colors = ['teal', 'terracotta', 'cream', 'brass', 'ink', 'fabric'];
  for (let i = 0; i < n; i++) {
    const h = 0.22 + (i % 3) * 0.04,
      off = (i - (n - 1) / 2) * 0.065;
    const p = axis === 'x' ? [x + off, y + h / 2, z] : [x, y + h / 2, z + off];
    b.box(p, axis === 'x' ? [0.052, h, 0.22] : [0.22, h, 0.052], colors[i % colors.length]);
    b.box(
      axis === 'x' ? [p[0], p[1] + h * 0.23, z + 0.112] : [x + 0.112, p[1] + h * 0.23, p[2]],
      axis === 'x' ? [0.036, 0.012, 0.005] : [0.005, 0.012, 0.036],
      'paper',
    );
  }
}
function cup(b, x, y, z, color = 'cream') {
  b.cylinder([x, y + 0.057, z], 0.051, 0.115, color);
  b.cylinder([x, y + 0.117, z], 0.043, 0.003, 'walnut');
  b.add('ring', [x + 0.054, y + 0.065, z], [0.031, 0.036, 0.031], color);
  b.cylinder([x, y + 0.004, z], 0.079, 0.009, color);
}
function bottle(b, x, y, z, color = 'teal', s = 1) {
  b.cylinder([x, y + 0.105 * s, z], 0.047 * s, 0.21 * s, color);
  b.add('cone', [x, y + 0.23 * s, z], [0.047 * s, 0.05 * s, 0.047 * s], color);
  b.cylinder([x, y + 0.29 * s, z], 0.022 * s, 0.07 * s, color);
  b.cylinder([x, y + 0.33 * s, z], 0.024 * s, 0.02 * s, 'brass');
  b.box([x, y + 0.115 * s, z + 0.046 * s], [0.063 * s, 0.09 * s, 0.006 * s], 'cream');
}
function bowl(b, x, y, z, color = 'cream', scale = 1) {
  b.add('cone', [x, y + 0.06 * scale, z], [0.11 * scale, 0.12 * scale, 0.11 * scale], color, [
    Math.PI,
    0,
    0,
  ]);
  b.cylinder([x, y + 0.119 * scale, z], 0.105 * scale, 0.006 * scale, 'walnut');
  b.add('ring', [x, y + 0.122 * scale, z], [0.105 * scale, 0.105 * scale, 0.105 * scale], color, [
    Math.PI / 2,
    0,
    0,
  ]);
}
function lamp(b, x, z, height = 1.85) {
  b.cylinder([x, 0.018, z], 0.22, 0.035, 'dark');
  b.cylinder([x, height * 0.49, z], 0.018, height * 0.94, 'brass', { metal: true });
  b.add('cone', [x, height - 0.1, z], [0.32, 0.4, 0.32], 'cream');
  b.sphere([x, height - 0.31, z], [0.08, 0.025, 0.08], '#ffe2a1', undefined, { glow: true });
}
function wallShelf(b, p, w, yaw = 0, contents = 'books') {
  const [x, y, z] = p,
    s = Math.sin(yaw),
    co = Math.cos(yaw);
  b.box(p, [w, 0.055, 0.33], 'walnut', [0, yaw, 0]);
  for (const sign of [-1, 1]) {
    const dx = sign * (w / 2 - 0.15);
    b.box(
      [x + co * dx - 0.08 * s, y - 0.13, z - s * dx - 0.08 * co],
      [0.035, 0.26, 0.16],
      'brass',
      [0, yaw, 0],
      { metal: true },
    );
  }
  if (contents === 'books')
    books(b, x, y + 0.029, z, Math.min(15, Math.floor(w / 0.09)), Math.abs(s) > 0.5 ? 'z' : 'x');
  else
    for (let i = 0; i < 8; i++) {
      const dx = ((i - 3.5) * w) / 9;
      bottle(b, x + co * dx, y + 0.03, z - s * dx, i % 2 ? 'teal' : 'terracotta');
    }
}
function clock(b, p, yaw = 0) {
  b.add('cylinder', p, [0.25, 0.045, 0.25], 'brass', [Math.PI / 2, 0, -yaw], { metal: true });
  const s = Math.sin(yaw),
    c = Math.cos(yaw),
    face = [p[0] + s * 0.027, p[1], p[2] + c * 0.027];
  b.add('cylinder', face, [0.225, 0.007, 0.225], 'cream', [Math.PI / 2, 0, -yaw]);
  b.box([face[0] + 0.005 * s, p[1] + 0.064, face[2] + 0.005 * c], [0.018, 0.15, 0.015], 'dark', [
    0,
    yaw,
    -0.35,
  ]);
  b.box([face[0] + 0.006 * s, p[1], face[2] + 0.006 * c], [0.16, 0.015, 0.015], 'dark', [
    0,
    yaw,
    0,
  ]);
}
function collision(set, x, z, w, d, y, h) {
  if (!set.solid) return;
  const proxy = set.solid(x, y, z, w, h, d, '#000000');
  proxy.name = 'Interior detail collision';
  proxy.visible = false;
}
export function decorateOriginHome(set) {
  if (set.interiorDetail) return set.interiorDetail;
  const b = builder(set.group, 'Home · lived-in Munich apartment');
  // Shallow staggered oak boards add actual join depth without overlapping the rug.
  for (let row = 0; row < 32; row++)
    for (let col = 0; col < 8; col++) {
      const x = -7 + col * 2,
        z = -7.75 + row * 0.5;
      b.box([x, 0.006, z], [1.989, 0.01, 0.489], (row + col) % 3 === 0 ? '#ae916d' : '#b89c78');
    }
  b.add('plane', [0, 3.57, 0], [16, 16, 1], 'cream', [Math.PI / 2, 0, 0]);
  b.cylinder([0.2, 3.38, 0.3], 0.012, 0.36, 'brass');
  b.add('cone', [0.2, 3.1, 0.3], [0.45, 0.23, 0.45], 'cream');
  b.sphere([0.2, 2.98, 0.3], [0.12, 0.03, 0.12], '#ffe2a1', undefined, { glow: true });
  rug(b, -5.4, 3.4, 4.15, 4.9, '#7d8b7c', 'geo');
  b.box([-6.92, 0.47, 3.4], [1.26, 0.25, 3.1], 'teal', undefined, { shadow: true });
  b.box([-7.42, 0.9, 3.4], [0.25, 1.05, 3.1], 'teal', undefined, { shadow: true });
  for (const z of [1.88, 4.92]) b.box([-6.9, 0.73, z], [1.3, 0.6, 0.19], 'teal');
  for (const z of [2.4, 3.4, 4.4]) {
    b.box([-6.86, 0.625, z], [1.04, 0.11, 0.89], '#789389');
    b.box([-7.15, 0.94, z], [0.24, 0.48, 0.58], z < 3 ? 'cream' : 'terracotta', [0, 0, -0.13]);
  }
  for (const x of [-7.3, -6.46])
    for (const z of [2.05, 4.76]) b.box([x, 0.18, z], [0.08, 0.36, 0.08], 'walnut');
  b.box([-6.67, 0.79, 4.89], [0.78, 0.065, 0.4], 'fabric');
  collision(set, -6.92, 3.4, 1.42, 3.32, 0.52, 1.04);
  b.box([-4.62, 0.49, 3.4], [1.42, 0.075, 1.85], 'oak', undefined, { shadow: true });
  for (const x of [-5.16, -4.08])
    for (const z of [2.72, 4.08]) b.box([x, 0.25, z], [0.075, 0.49, 0.075], 'walnut');
  collision(set, -4.62, 3.4, 1.42, 1.85, 0.26, 0.52);
  for (let i = 0; i < 3; i++)
    b.box(
      [-4.65, 0.54 + i * 0.023, 3.05],
      [0.46, 0.021, 0.33],
      ['teal', 'paper', 'terracotta'][i],
      [0, 0.1, 0],
    );
  cup(b, -4.32, 0.53, 3.74);
  plant(b, -4.95, 0.53, 3.79, 0.27, 'cream');
  lamp(b, -7.02, 5.42, 1.94);
  b.box([-6.34, 0.32, -4.47], [0.68, 0.64, 0.67], 'walnut', undefined, { shadow: true });
  b.box([-6.34, 0.66, -4.47], [0.74, 0.04, 0.72], 'oak');
  cup(b, -6.48, 0.69, -4.47);
  b.box([-6.12, 0.73, -4.45], [0.18, 0.12, 0.09], 'ink');
  b.box([-6.12, 0.735, -4.397], [0.14, 0.055, 0.008], '#b9d3bd');
  collision(set, -6.34, -4.47, 0.7, 0.7, 0.34, 0.68);
  // Small sideboard sits against the entry wall, leaving the central portal free.
  b.box([5.54, 0.34, 7.45], [2.2, 0.65, 0.65], 'walnut', undefined, { shadow: true });
  b.box([5.54, 0.69, 7.45], [2.3, 0.06, 0.71], 'oak');
  for (const x of [4.99, 6.09]) b.box([x, 0.38, 7.113], [1.06, 0.46, 0.025], 'fabric');
  plant(b, 6.25, 0.73, 7.45, 0.43);
  bowl(b, 4.78, 0.73, 7.38, 'cream', 0.9);
  collision(set, 5.54, 7.45, 2.3, 0.71, 0.365, 0.73);
  frame(b, [7.84, 2.1, 0], [1.2, 1.58], portraitTexture(), -Math.PI / 2, 'brass');
  frame(b, [-7.84, 2.18, 3.1], [1.65, 1.15], artTexture('munich'), Math.PI / 2);
  wallShelf(b, [-7.745, 2.08, -0.1], 2.2, Math.PI / 2);
  frame(b, [0.05, 1.91, -7.84], [1.02, 1.15], artTexture('botanical', '#486b62'));
  // Window textiles and radiator covers: no visible flat strips hanging in space.
  for (const x of [-4, 3]) {
    // Horizontal curtain rod uses the same instanced cylinder geometry.
    b.add('cylinder', [x, 3.15, -7.6], [0.018, 2.98, 0.018], 'brass', [0, 0, Math.PI / 2]);
    for (const sx of [-1, 1])
      for (let i = 0; i < 5; i++)
        b.box(
          [x + sx * (1.12 + i * 0.046), 2.02, -7.59 + Math.sin(i * 1.3) * 0.026],
          [0.06, 2.17, 0.09],
          'cream',
        );
    b.box([x, 0.46, -7.63], [1.82, 0.65, 0.2], 'cream');
    for (let i = 0; i < 12; i++)
      b.box([x - 0.81 + i * 0.148, 0.46, -7.512], [0.05, 0.53, 0.027], 'steel');
  }
  // Peg rail, keys and the employee's work bag at the entrance.
  b.box([2.96, 1.9, 7.79], [1.45, 0.16, 0.07], 'oak');
  for (const x of [2.48, 2.96, 3.44]) b.add('ring', [x, 1.87, 7.73], [0.04, 0.04, 0.04], 'brass');
  b.box([3.42, 1.32, 7.67], [0.38, 0.74, 0.11], 'teal');
  b.box([3.42, 1.64, 7.67], [0.56, 0.11, 0.13], 'teal');
  set.interiorDetail = b.finish();
  return set.interiorDetail;
}
export function decorateOriginKitchen(set) {
  if (set.interiorDetail) return set.interiorDetail;
  const b = builder(set.group, 'Zitronengras · culinary details');
  b.add('plane', [0, 3.57, 0], [16, 16, 1], 'cream', [Math.PI / 2, 0, 0]);
  // A supported back prep cabinet replaces a floating row of cookbooks.
  b.box([-4.43, 0.53, -6.25], [1.75, 1.02, 0.93], 'teal', undefined, { shadow: true });
  b.box([-4.43, 1.065, -6.25], [1.85, 0.07, 1.03], 'steel', undefined, { metal: true });
  for (const x of [-4.85, -4.0]) b.box([x, 0.54, -5.773], [0.024, 0.25, 0.018], 'brass');
  collision(set, -4.43, -6.25, 1.85, 1.03, 0.55, 1.1);
  // Root moves the existing books onto this surface (bottom y=1.10).
  wallShelf(b, [3.4, 2.04, -7.745], 3.65, 0, 'bottles');
  for (let i = 0; i < 5; i++) {
    bowl(b, 1.95 + i * 0.63, 2.07, -7.73, 'cream', 0.84);
  }
  frame(b, [-7.84, 2.0, -0.35], [1.6, 1.78], artTexture('botanical', '#345e4f'), Math.PI / 2);
  frame(b, [7.84, 2.06, 4.25], [1.45, 1.75], portraitTexture(), -Math.PI / 2, 'brass');
  clock(b, [5.55, 2.77, -7.69]);
  // Herb trough above the prep side, anchored to the wall.
  b.box([7.7, 2.06, -2.25], [0.42, 0.13, 2.85], 'walnut');
  for (const z of [-3.2, -2.25, -1.3]) plant(b, 7.69, 2.13, z, 0.35, 'cream');
  for (const x of [-4, 3.5]) {
    const z = x < 0 ? 3.4 : 3.6;
    b.box([x, 0.756, z], [0.42, 0.015, 0.32], 'fabric');
    cup(b, x + 0.55, 0.75, z - 0.15);
    plant(b, x - 0.54, 0.75, z, 0.26, 'terracotta');
    for (let i = 0; i < 2; i++)
      b.box([x + 0.28 + i * 0.025, 0.783, z + 0.14], [0.013, 0.015, 0.28], 'walnut');
  }
  // Aprons and rails are on the west wall away from the fridge and workstation.
  b.box([-7.71, 1.95, 3.8], [0.08, 0.1, 1.8], 'steel');
  for (const z of [3.18, 3.8, 4.42]) {
    b.box([-7.64, 1.28, z], [0.06, 0.76, 0.38], 'teal');
    b.box([-7.64, 1.66, z], [0.065, 0.16, 0.22], 'teal');
  }
  for (const x of [-4.65, -3.95]) {
    b.cylinder([x, 1.4, -2.8], 0.12, 0.09, 'cream');
    b.cylinder([x, 1.448, -2.8], 0.105, 0.009, x < -4.3 ? '#cc7950' : '#73914c');
  }
  // Ticket rail: short visual orders, no instruction paragraphs.
  b.box([0, 2.12, -7.71], [2.18, 0.06, 0.05], 'brass');
  for (let i = 0; i < 5; i++) {
    b.box([-0.84 + i * 0.42, 1.92, -7.67], [0.28, 0.37, 0.015], 'paper');
    for (let k = 0; k < 3; k++)
      b.box([-0.84 + i * 0.42, 2.01 - k * 0.065, -7.657], [0.18, 0.01, 0.006], 'teal');
  }
  set.interiorDetail = b.finish();
  return set.interiorDetail;
}
function officeDetails(w) {
  const b = builder(w.groups.office, 'BBE · personal and architectural finishing');
  frame(b, [-13.34, 2.05, 0.1], [1.18, 1.5], portraitTexture(), Math.PI / 2, 'brass');
  frame(b, [28.14, 2.05, -2], [1.6, 1.95], artTexture('munich', '#456f70'), Math.PI / 2);
  frame(b, [-39.84, 2.23, 5.5], [1.25, 1.57], artTexture('botanical', '#426363'), Math.PI / 2);
  // Desktop details remain on existing surfaces and do not change collision geometry.
  for (const [x, z] of [
    [-8, -7],
    [-3, -7],
    [-8, -3],
    [-3, -3],
  ]) {
    cup(b, x + 0.76, 0.819, z + 0.25, 'cream');
    b.box([x - 0.7, 0.831, z + 0.28], [0.33, 0.025, 0.43], 'teal');
    b.box([x - 0.66, 0.848, z + 0.26], [0.26, 0.008, 0.32], 'paper');
    b.box([x - 0.51, 0.86, z + 0.26], [0.012, 0.013, 0.29], 'brass');
    plant(b, x + 0.92, 0.819, z - 0.28, 0.29, 'cream');
  }
  // Wall shelves clear the reception route and hang above the existing archive.
  wallShelf(b, [-10, 2.56, 10.72], 3.45, Math.PI);
  clock(b, [13.33, 2.45, 6.0], -Math.PI / 2);
  for (const x of [7.1, 8.3, 9.5]) {
    b.cylinder([x, 0.87, -1.3], 0.059, 0.022, 'walnut');
    bottle(b, x, 0.883, -1.3, 'teal', 0.62);
  }
  // Presentation remote, cable dock and spare notebooks on the meeting table.
  b.box([9.6, 0.887, -0.5], [0.07, 0.035, 0.19], 'dark');
  b.box([7.05, 0.887, -0.4], [0.35, 0.025, 0.45], 'paper');
  // Partner's cabinet fits below the existing wall logo.
  b.box([37.07, 0.57, -6.45], [2.42, 1.1, 0.67], 'walnut');
  b.box([37.07, 1.145, -6.45], [2.5, 0.065, 0.74], 'oak');
  for (const x of [36.47, 37.67]) b.box([x, 0.64, -6.097], [0.78, 0.7, 0.025], 'teal');
  books(b, 36.43, 1.18, -6.46, 8);
  b.cylinder([37.75, 1.215, -6.43], 0.15, 0.065, 'dark');
  b.cylinder([37.75, 1.41, -6.43], 0.047, 0.33, 'brass', { metal: true });
  b.sphere([37.75, 1.64, -6.43], [0.21, 0.18, 0.21], 'brass', undefined, { metal: true });
  rug(b, 33.9, 1.54, 5.55, 4.13, '#607a75', 'geo');
  cup(b, 31.68, 0.46, 2.13);
  b.box([32.23, 0.47, 1.96], [0.45, 0.025, 0.36], 'paper');
  for (const z of [0.9, 2.1, 3.1])
    b.box([29.23, 0.86, z], [0.28, 0.35, 0.56], z === 2.1 ? 'cream' : 'fabric', [0, 0, -0.15]);
  // IT: tool mat, headphones, server cable trays and small plants.
  b.box([-32.77, 0.863, -0.22], [0.66, 0.019, 0.42], 'dark');
  for (let i = 0; i < 4; i++)
    b.box([-32.98 + i * 0.125, 0.884, -0.22], [0.025, 0.025, 0.25], i % 2 ? 'brass' : 'steel');
  cup(b, -35.72, 0.853, -0.13, 'cream');
  plant(b, -36.04, 0.853, -0.84, 0.31, 'terracotta');
  b.box([-37.05, 2.64, -6.65], [5.62, 0.1, 0.26], 'steel');
  for (let i = 0; i < 7; i++)
    b.box([-39 + i * 0.64, 2.41, -6.59], [0.025, 0.41, 0.028], i % 2 ? 'teal' : 'terracotta');
  b.add('ring', [-33.58, 0.912, 0.02], [0.12, 0.14, 0.12], 'dark', [Math.PI / 2, 0, 0]);
  for (const x of [-33.69, -33.47]) b.box([x, 0.91, 0.02], [0.063, 0.07, 0.1], 'dark');
  // Bathroom: wall mounted towel dispenser and bin, supported near the vanity.
  b.box([29.17, 1.39, 25.25], [0.21, 0.47, 0.4], 'cream');
  b.box([29.288, 1.185, 25.25], [0.013, 0.14, 0.27], 'paper');
  b.cylinder([29.53, 0.27, 26.51], 0.25, 0.53, 'steel', { metal: true });
  b.cylinder([29.53, 0.544, 26.51], 0.252, 0.035, 'dark');
  for (const z of [24.7, 26.1]) {
    b.cylinder([37.76, 1.08, z + 0.42], 0.041, 0.2, 'teal');
    b.box([37.76, 1.192, z + 0.42], [0.082, 0.025, 0.035], 'steel');
    b.box([38.84, 2.53, z], [0.035, 0.035, 1.15], '#ffedc8', undefined, { glow: true });
  }
  // Garage: structural finishing and wall safety fixtures, never in the drive aisle.
  for (const z of [30, 45.9]) {
    b.box([57, 3.15, z], [25, 0.18, 0.3], 'steel');
    for (const x of [47, 53, 59, 65]) b.box([x, 3.36, z], [0.055, 0.38, 0.055], 'dark');
  }
  for (const x of [44.16, 69.84])
    for (const z of [33, 40, 44.9]) {
      b.box([x, 1.05, z], [0.055, 0.14, 1.35], '#d3b571');
      for (let i = 0; i < 4; i++)
        b.box(
          [x + (x < 50 ? 0.013 : -0.013), 1.05, z - 0.45 + i * 0.3],
          [0.016, 0.16, 0.11],
          'dark',
        );
    }
  for (const x of [48, 65]) {
    frame(
      b,
      [x, 2.15, 29.17],
      [1.3, 0.52],
      texture('garage-bay-' + x, 512, 192, (c, W, H) => {
        c.fillStyle = '#263c40';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#dfca95';
        c.font = 'bold 105px Arial';
        c.textAlign = 'center';
        c.fillText(x === 48 ? 'P 01' : 'P 02', W / 2, 136);
      }),
      0,
      'dark',
    );
  }
  b.box([69.78, 1.45, 34.3], [0.16, 0.8, 0.56], '#a8513f');
  b.cylinder([69.66, 1.41, 34.3], 0.085, 0.47, '#b9593e');
  if (w.obstacle) {
    w.obstacle('office', 37.07, -6.45, 2.5, 0.74, 0.606, 1.21);
    w.obstacle('office', 29.53, 26.51, 0.5, 0.5, 0.28, 0.56);
  }
  const root = b.finish();
  w.interiorDetail = { root };
  return root;
}
const THEMES = {
  dogtown: { accent: '#b36e45', art: 'sun', label: 'DOGTOWN', style: 'mexican' },
  seen: { accent: '#773d48', art: 'botanical', label: 'SEEN', style: 'sichuan' },
  bao: { accent: '#b9503e', art: 'ramen', label: 'MAMMA BAO', style: 'bao' },
  palm: { accent: '#577b63', art: 'botanical', label: 'PALMTREECLUB', style: 'botanical' },
  gyoza: { accent: '#304c69', art: 'ramen', label: 'GYOZA BAR', style: 'japanese' },
  wirt: { accent: '#6c5e46', art: 'grain', label: 'MAXVORSTADT', style: 'bavarian' },
  mentors: { accent: '#aa754a', art: 'pizza', label: 'MENTOR’S', style: 'italian' },
};
function restaurantTheme(parent, id, theme) {
  const b = builder(parent, 'Restaurant detail · ' + id);
  b.group.userData.dynamic = true;
  b.group.visible = false;
  frame(
    b,
    [8.34, 2.02, 0.3],
    [1.46, 1.85],
    artTexture(theme.art, theme.accent),
    -Math.PI / 2,
    'walnut',
  );
  frame(
    b,
    [8.34, 2.02, 5.25],
    [1.46, 1.85],
    artTexture(id === 'palm' ? 'botanical' : 'munich', theme.accent),
    -Math.PI / 2,
    'walnut',
  );
  // Deliberate separate theme batches keep exactly one restaurant variant visible.
  wallShelf(b, [-4.9, 1.53, -8.68], 3.25, 0, 'bottles');
  wallShelf(b, [4.9, 1.53, -8.68], 3.25, 0, 'bottles');
  for (const x of [-6, 0, 6])
    for (const z of [-1, 4.5]) {
      b.box([x, 0.841, z], [0.42, 0.012, 0.28], theme.accent);
      b.cylinder([x, 0.894, z - 0.43], 0.048, 0.09, 'brass', { metal: true });
      b.sphere([x, 0.955, z - 0.43], [0.025, 0.041, 0.025], '#ffe4af', undefined, { glow: true });
      for (const sx of [-1, 1]) {
        b.box([x + sx * 0.51, 0.86, z + 0.2], [0.15, 0.012, 0.24], 'paper');
        if (['japanese', 'bao', 'sichuan'].includes(theme.style))
          for (let i = 0; i < 2; i++)
            b.box([x + sx * 0.7 + i * 0.024, 0.863, z], [0.014, 0.013, 0.3], 'walnut');
      }
      if (theme.style === 'botanical') plant(b, x + 0.12, 0.827, z + 0.5, 0.22, 'cream');
    }
  // Backbar details are supported by the counter top (1.27 m).
  for (let i = 0; i < 5; i++)
    bottle(b, -2.1 + i * 0.25, 1.275, -5.68, i % 2 ? 'teal' : 'terracotta');
  b.box([4.22, 1.305, -5.47], [0.43, 0.05, 0.35], 'dark');
  b.box([4.22, 1.51, -5.54], [0.4, 0.33, 0.045], 'dark', [-0.12, 0, 0]);
  b.box([4.22, 1.52, -5.51], [0.33, 0.25, 0.01], theme.accent, [-0.12, 0, 0]);
  // A shallow dado adds material depth without narrowing the route.
  for (const x of [-8.35, 8.35])
    for (let i = 0; i < 24; i++)
      b.box(
        [x, 0.45, -8.4 + i * 0.71],
        [0.055, 0.74, 0.056],
        theme.style === 'bavarian' ? 'oak' : 'walnut',
      );
  if (theme.style === 'mexican') {
    for (let i = 0; i < 14; i++) {
      const x = -6.5 + i;
      b.box([x, 2.96, -4.7], [0.025, 0.25, 0.025], 'brass');
      b.box(
        [x, 2.81, -4.7],
        [0.52, 0.23, 0.035],
        i % 3 === 0 ? 'terracotta' : i % 3 === 1 ? 'teal' : 'brass',
      );
    }
    for (const x of [-6.35, 6.35]) {
      b.cylinder([x, 1.78, -8.67], 0.16, 0.43, 'terracotta');
      b.cylinder([x, 2.1, -8.67], 0.045, 0.39, 'leaf');
      b.cylinder([x + 0.09, 2.0, -8.67], 0.033, 0.17, 'leaf');
      b.box([x + 0.052, 1.94, -8.67], [0.14, 0.04, 0.05], 'leaf');
    }
  } else if (['sichuan', 'bao', 'japanese'].includes(theme.style)) {
    for (const x of [-4, 0, 4]) {
      b.cylinder([x, 3.02, -3.25], 0.012, 0.4, 'dark');
      b.sphere(
        [x, 2.7, -3.25],
        [0.28, 0.34, 0.28],
        theme.style === 'sichuan' ? 'terracotta' : 'cream',
      );
      for (let j = 0; j < 5; j++)
        b.add(
          'ring',
          [x, 2.48 + j * 0.1, -3.25],
          [0.2 + (j === 2 ? 0.07 : 0), 0.2, 0.2 + (j === 2 ? 0.07 : 0)],
          'brass',
          [Math.PI / 2, 0, 0],
        );
    }
    for (let i = 0; i < 3; i++) {
      b.add('cone', [-3.5 + i * 0.5, 1.36, -5.45], [0.2, 0.16, 0.2], 'oak', [Math.PI, 0, 0]);
      b.cylinder([-3.5 + i * 0.5, 1.45, -5.45], 0.21, 0.045, 'cream');
    }
  } else if (theme.style === 'botanical') {
    for (const x of [-5.5, 0, 5.5]) {
      b.cylinder([x, 2.94, -7.45], 0.012, 0.44, 'brass');
      plant(b, x, 2.29, -7.45, 0.48, 'cream');
    }
    for (let i = 0; i < 4; i++) {
      b.sphere([-3.6 + i * 0.27, 1.39, -5.45], [0.09, 0.105, 0.085], i % 2 ? '#e6ae53' : '#8eaa62');
    }
  } else if (theme.style === 'bavarian') {
    for (const x of [-6.6, -5.8, -5, 4.2, 5, 5.8]) {
      cup(b, x, 1.57, -8.67, 'cream');
    }
    for (const x of [-7.2, 7.2]) {
      b.add('cylinder', [x, 2.16, -8.82], [0.39, 0.07, 0.39], 'walnut', [Math.PI / 2, 0, 0]);
      b.add('ring', [x, 2.16, -8.77], [0.38, 0.38, 0.38], 'brass');
      b.box([x, 2.16, -8.748], [0.035, 0.49, 0.027], 'cream');
    }
  } else {
    for (const x of [-6.2, -5.6, -5, 4.3, 4.9, 5.5]) bottle(b, x, 1.57, -8.67, 'teal', 1.23);
    for (let i = 0; i < 4; i++)
      b.sphere([-3.5 + i * 0.32, 1.4, -5.48], [0.14, 0.08, 0.07], '#d3ae69', [0, 0.4, 0]);
    b.box([-3.1, 1.29, -5.48], [1.5, 0.025, 0.42], 'oak');
  }
  return b.finish();
}
export function installInteriorDetails(world) {
  if (world.interiorDetail) return world.interiorDetail;
  officeDetails(world);
  const themes = {};
  for (const [id, theme] of Object.entries(THEMES))
    themes[id] = restaurantTheme(world.groups.restaurant, id, theme);
  world.interiorDetail.restaurantThemes = themes;
  selectRestaurantDetail(world, world.currentRestaurant?.id || 'dogtown');
  return world.interiorDetail;
}
export function selectRestaurantDetail(world, id) {
  const themes = world.interiorDetail?.restaurantThemes;
  if (!themes) return;
  const active = themes[id] ? id : 'dogtown';
  for (const [key, group] of Object.entries(themes)) group.visible = key === active;
}
export function decorateBrewery(group) {
  if (group.userData.interiorDetail) return group.userData.interiorDetail;
  const b = builder(group, 'Brienner Bräu · finishing details');
  frame(b, [9.61, 2.16, 1.25], [1.3, 1.62], artTexture('grain', '#526955'), -Math.PI / 2, 'walnut');
  for (const [x, z] of [
    [-6.1, 5.6],
    [5.8, 4.8],
  ]) {
    cup(b, x - 0.84, 0.915, z + 0.28, 'cream');
    b.box([x + 0.64, 0.924, z - 0.16], [0.27, 0.017, 0.34], 'cream');
    b.cylinder([x + 0.29, 0.98, z + 0.2], 0.031, 0.11, 'cream');
    b.cylinder([x + 0.4, 0.98, z + 0.2], 0.031, 0.11, 'dark');
  }
  b.box([8.1, 1.18, -2.58], [0.27, 0.025, 0.33], 'cream');
  b.box([8.26, 1.21, -2.58], [0.015, 0.018, 0.27], 'dark');
  group.userData.interiorDetail = b.finish();
  return group.userData.interiorDetail;
}
