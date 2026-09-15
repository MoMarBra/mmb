/** BRIENNER BRÄU — original procedural interior, metres, +Y up, +Z towards entrance.
 * No external files, model imports, lights, actors or game-state dependencies.
 * Local footprint: x [-10,10], z [-9,9]. Main doorway centred at z=9, width 2.6m.
 * Instanced static details; detachable mug/stool; explicit collision and interaction anchors.
 */
const CACHE = new WeakMap();
function resources(T) {
  if (CACHE.has(T)) return CACHE.get(T);
  const g = {
    box: new T.BoxGeometry(1, 1, 1),
    cylinder: new T.CylinderGeometry(1, 1, 1, 32),
    tube: new T.CylinderGeometry(1, 1, 1, 12),
    sphere: new T.SphereGeometry(1, 20, 12),
    ring: new T.TorusGeometry(1, 0.028, 8, 40),
    flange: new T.TorusGeometry(1, 0.12, 8, 28),
    valve: new T.TorusGeometry(1, 0.15, 7, 20),
    cone: new T.ConeGeometry(1, 1, 32),
    plane: new T.PlaneGeometry(1, 1),
  };
  function texture(kind) {
    if (!globalThis.document?.createElement) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    let seed = 73;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    ctx.fillStyle = kind === 'wood' ? '#805734' : '#c99659';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < (kind === 'wood' ? 500 : 1600); i++) {
      ctx.strokeStyle = `rgba(${kind === 'wood' ? '35,19,9' : '255,227,175'},${0.02 + rand() * 0.09})`;
      ctx.lineWidth = 0.2 + rand() * 1.1;
      ctx.beginPath();
      const y = rand() * 256;
      if (kind === 'wood') {
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(80, y - rand() * 6, 170, y + rand() * 6, 256, y);
      } else {
        const x = rand() * 256;
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand() * 3, y + rand() * 2);
      }
      ctx.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  const woodMap = texture('wood'),
    copperMap = texture('copper');
  const mat = (name, color, roughness, metalness = 0, extra = {}) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    m.name = 'Brienner Bräu · ' + name;
    return m;
  };
  const m = {
    wood: mat('aged oak', '#b89265', 0.68, 0, { map: woodMap }),
    darkWood: mat('smoked oak', '#73553c', 0.52, 0, { map: woodMap }),
    edgeWood: mat('endgrain and trim', '#372a21', 0.67),
    copper: mat('brushed copper', '#c48650', 0.31, 0.82, { map: copperMap }),
    patina: mat('copper patina', '#775239', 0.47, 0.66),
    brass: mat('brass hardware', '#c8a660', 0.3, 0.75),
    steel: mat('stainless brewing steel', '#a5b0b3', 0.26, 0.8),
    iron: mat('blackened steel', '#202a2a', 0.6, 0.66),
    wall: mat('lime plaster', '#b6b4a1', 0.94),
    brick: mat('old Munich brick', '#895443', 0.91),
    brickLight: mat('light brick variation', '#a5694c', 0.88),
    mortar: mat('mortar', '#77675b', 1),
    tile: mat('bar backsplash', '#234d4d', 0.3),
    stone: mat('soapstone bar top', '#313d3c', 0.3),
    cream: mat('ceramic and paper', '#eee2be', 0.75),
    green: mat('hop leaves', '#526b3c', 0.81),
    bottle: mat('bottle green', '#203c2b', 0.22, 0.12),
    leather: mat('oxblood leather', '#55392e', 0.63),
    bulb: mat('warm filament globe', '#fff2bc', 0.25, 0, {
      emissive: '#ffc66d',
      emissiveIntensity: 1.2,
    }),
    glass: new T.MeshPhysicalMaterial({
      name: 'Brienner Bräu · clear thick glass',
      color: '#d5eee6',
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    beer: new T.MeshPhysicalMaterial({
      name: 'Brienner Bräu · amber lager',
      color: '#d69a28',
      roughness: 0.24,
      metalness: 0,
      clearcoat: 0.45,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    }),
    foam: mat('dense fresh foam', '#fff4d5', 0.95),
  };
  const result = { g, m };
  CACHE.set(T, result);
  return result;
}

/** Collect identical geometry/material pairs into a single draw call. */
function batcher(T, parent) {
  const batches = new Map(),
    matrix = new T.Matrix4(),
    object = new T.Object3D();
  function add(geometry, material, p, size = [1, 1, 1], rotation = [0, 0, 0], shadow = true) {
    const key = geometry.uuid + '/' + material.uuid + '/' + shadow;
    let record = batches.get(key);
    if (!record) {
      record = { geometry, material, shadow, matrices: [] };
      batches.set(key, record);
    }
    object.position.set(...p);
    object.scale.set(...size);
    object.rotation.set(...rotation);
    object.updateMatrix();
    record.matrices.push(object.matrix.clone());
  }
  function finish() {
    for (const record of batches.values()) {
      const mesh = new T.InstancedMesh(record.geometry, record.material, record.matrices.length);
      mesh.name = record.material.name + ' · shared details';
      mesh.castShadow = record.shadow;
      mesh.receiveShadow = true;
      record.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.setUsage(T.StaticDrawUsage);
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      parent.add(mesh);
    }
    batches.clear();
  }
  return { add, finish };
}

export function buildBrewerySet(THREE) {
  const T = THREE,
    { g, m } = resources(T);
  const group = new T.Group();
  group.name = 'BRIENNER BRÄU · Munich craft brewery';
  const staticSet = new T.Group();
  staticSet.name = 'Brewery architecture and furnishings';
  group.add(staticSet);
  const b = batcher(T, staticSet),
    boxes = [];
  const box = (p, size, mat, r) => b.add(g.box, mat, p, size, r);
  const cylinder = (p, radius, h, mat) => b.add(g.cylinder, mat, p, [radius, h, radius]);
  const sphere = (p, size, mat) => b.add(g.sphere, mat, p, size);
  const ring = (p, radius, mat, rotation = [Math.PI / 2, 0, 0]) =>
    b.add(g.ring, mat, p, [radius, radius, radius], rotation);
  const pipe = (a, z, radius, mat = m.copper) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...z),
      delta = end.clone().sub(start);
    const q = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      delta.clone().normalize(),
    );
    const r = new T.Euler().setFromQuaternion(q);
    b.add(
      g.tube,
      mat,
      start.add(end).multiplyScalar(0.5).toArray(),
      [radius, delta.length(), radius],
      [r.x, r.y, r.z],
    );
  };
  const solid = (x, z, w, d, y, h) => boxes.push({ x, z, w, d, y, h });
  function sign(text, sub, p, size, rotation = 0, theme = 'dark') {
    const geometry = g.plane,
      color = theme === 'cream' ? '#ede1bd' : '#203534';
    let map = null;
    if (globalThis.document?.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = 1536;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1536, 512);
        ctx.strokeStyle = theme === 'cream' ? '#695335' : '#cda562';
        ctx.lineWidth = 5;
        ctx.strokeRect(24, 24, 1488, 464);
        ctx.strokeRect(38, 38, 1460, 436);
        ctx.textAlign = 'center';
        ctx.fillStyle = theme === 'cream' ? '#31413a' : '#efe0b9';
        ctx.font = 'bold 110px Georgia, serif';
        ctx.fillText(text, 768, 249);
        ctx.fillStyle = theme === 'cream' ? '#66573e' : '#c9ac76';
        ctx.font = '32px Arial, sans-serif';
        ctx.fillText(sub, 768, 341);
        ctx.fillRect(550, 381, 436, 2);
        map = new T.CanvasTexture(canvas);
        map.colorSpace = T.SRGBColorSpace;
      }
    }
    const mat = new T.MeshStandardMaterial({
      color: map ? '#ffffff' : color,
      map,
      roughness: 0.74,
    });
    const mesh = new T.Mesh(geometry, mat);
    mesh.name = text;
    mesh.position.set(...p);
    mesh.scale.set(size[0], size[1], 1);
    mesh.rotation.y = rotation;
    mesh.userData.text = text;
    staticSet.add(mesh);
    return mesh;
  }

  // Raised jointed oak boards, perimeter skirting and an open entry portal.
  box([0, -0.08, 0], [20, 0.16, 18], m.iron);
  for (let row = 0; row < 36; row++)
    for (let section = 0; section < 5; section++) {
      const z = -8.75 + row * 0.5,
        x = -8 + section * 4;
      box([x, 0.017, z], [3.987, 0.035, 0.482], row % 4 === 0 ? m.darkWood : m.wood);
    }
  for (const x of [-9.9, 9.9]) {
    box([x, 1.8, 0], [0.2, 3.6, 18], m.wall);
    box([x * 0.985, 0.18, 0], [0.15, 0.36, 18], m.edgeWood);
    solid(x, 0, 0.2, 18, 1.8, 3.6);
  }
  box([0, 1.8, -8.9], [20, 3.6, 0.2], m.mortar);
  solid(0, -8.9, 20, 0.2, 1.8, 3.6);
  for (const x of [-5.65, 5.65]) {
    box([x, 1.8, 8.9], [8.7, 3.6, 0.2], m.wall);
    solid(x, 8.9, 8.7, 0.2, 1.8, 3.6);
  }
  box([0, 3.26, 8.9], [2.6, 0.68, 0.2], m.edgeWood);
  for (const x of [-1.35, 1.35]) box([x, 1.45, 8.76], [0.16, 2.9, 0.24], m.darkWood);
  box([0, 0.045, 8.6], [2.5, 0.025, 0.65], m.stone);
  for (let row = 0; row < 11; row++)
    for (let col = 0; col < 34; col++) {
      const x = -9.64 + col * 0.576 + (row % 2) * 0.23;
      if (x < 9.6)
        box(
          [x, 0.28 + row * 0.282, -8.762],
          [0.55, 0.254, 0.08],
          (row * 7 + col) % 8 < 2 ? m.brickLight : m.brick,
        );
    }
  for (const z of [-7, -2, 3, 7.7]) {
    box([0, 3.43, z], [19.65, 0.24, 0.23], m.darkWood);
    for (const x of [-9.55, 9.55]) box([x, 2.95, z], [0.28, 0.85, 0.34], m.edgeWood);
  }
  // High windows: physical frames, mullions and a subtle tinted pane.
  for (const z of [-3.5, 2.4, 6.3]) {
    box([-9.73, 2.1, z], [0.09, 1.74, 2.25], m.iron);
    box([-9.665, 2.1, z], [0.02, 1.6, 2.1], m.glass);
    for (const zz of [z - 0.7, z, z + 0.7]) box([-9.64, 2.1, zz], [0.035, 1.6, 0.035], m.brass);
    box([-9.63, 2.08, z], [0.035, 0.04, 2.1], m.brass);
  }
  const mainSign = sign(
    'BRIENNER BRÄU',
    'MÜNCHNER HANDWERK · GEBRAUT MIT HALTUNG',
    [4.65, 2.69, -8.69],
    [7.35, 1.52],
  );
  sign(
    'GUTER STOFF.',
    'KLEINE CHARGEN · GROSSE PAUSEN',
    [-9.6, 2.37, 0.0],
    [3.2, 1.06],
    Math.PI / 2,
    'cream',
  );

  // Three individually plumbed copper kettles with conical domes and stainless fittings.
  for (let n = 0; n < 3; n++) {
    const x = -7.08 + n * 3.08,
      z = -6.05,
      r = 0.98;
    cylinder([x, 1.78, z], r, 1.72, m.copper);
    sphere([x, 2.64, z], [r, 0.47, r], m.copper);
    sphere([x, 0.9, z], [r, 0.38, r], m.patina);
    for (const y of [1.04, 1.14, 2.46, 2.57]) ring([x, y, z], r * 1.005, m.brass);
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const lx = x + Math.sin(a) * 0.72,
        lz = z + Math.cos(a) * 0.72;
      cylinder([lx, 0.47, lz], 0.075, 0.8, m.steel);
      cylinder([lx, 0.09, lz], 0.12, 0.11, m.iron);
    }
    cylinder([x, 3.16, z], 0.145, 0.46, m.copper);
    pipe([x, 3.32, z], [x, 3.32, -8.1], 0.14);
    ring([x, 1.83, z + 1.0], 0.275, m.steel, [0, 0, 0]);
    b.add(g.cylinder, m.iron, [x, 1.83, z + 1.005], [0.25, 0.06, 0.25], [Math.PI / 2, 0, 0]);
    b.add(
      g.cylinder,
      m.glass,
      [x, 1.83, z + 1.043],
      [0.215, 0.016, 0.215],
      [Math.PI / 2, 0, 0],
      false,
    );
    for (let j = 0; j < 8; j++)
      sphere(
        [
          x + Math.sin((j * Math.PI) / 4) * 0.276,
          1.83 + Math.cos((j * Math.PI) / 4) * 0.276,
          z + 1.036,
        ],
        [0.018, 0.018, 0.018],
        m.brass,
      );
    pipe([x, 0.9, z + 0.87], [x, 0.9, z + 1.35], 0.065, m.steel);
    b.add(g.valve, m.iron, [x, 0.98, z + 1.41], [0.13, 0.13, 0.13], [0, 0, 0]);
    pipe([x - 0.105, 0.98, z + 1.41], [x + 0.105, 0.98, z + 1.41], 0.018, m.iron);
    pipe([x, 1.24, z + 1.065], [x, 1.48, z + 1.065], 0.023, m.steel);
    b.add(g.cylinder, m.cream, [x, 1.49, z + 1.09], [0.085, 0.027, 0.085], [Math.PI / 2, 0, 0]);
    pipe([x, 1.49, z + 1.114], [x + 0.043, 1.526, z + 1.114], 0.008, m.iron);
    sign(
      String(n + 1).padStart(2, '0'),
      ['MAISCHE', 'WÜRZE', 'LAGER'][n],
      [x, 2.28, z + 0.974],
      [0.45, 0.22],
    );
    solid(x, z, 2.05, 2.2, 1.6, 3.2);
  }
  pipe([-8.8, 3.32, -8.1], [0.22, 3.32, -8.1], 0.14);
  for (const x of [-8, -5, -2]) {
    ring([x, 3.32, -8.1], 0.155, m.brass, [0, Math.PI / 2, 0]);
    pipe([x, 3.48, -8.1], [x, 3.6, -8.1], 0.025, m.iron);
  }
  // Brass guardrail protects the brewing equipment without boxing in the main aisle.
  for (const x of [-8.5, -5.6, -2.65, 0.15]) cylinder([x, 0.48, -4.47], 0.028, 0.93, m.brass);
  pipe([-8.5, 0.91, -4.47], [0.15, 0.91, -4.47], 0.028, m.brass);
  pipe([-8.5, 0.31, -4.47], [0.15, 0.31, -4.47], 0.024, m.brass);
  solid(-4.2, -4.47, 8.8, 0.12, 0.46, 0.92);

  // Soapstone bar, ribbed smoked-oak front, brass kick rail and four taps.
  const barX = 4.9,
    barZ = -2.35;
  box([barX, 0.53, barZ], [7.8, 1.02, 0.94], m.darkWood);
  for (let i = 0; i < 38; i++)
    box([1.08 + i * 0.203, 0.54, barZ + 0.493], [0.115, 0.91, 0.055], i % 4 ? m.wood : m.edgeWood);
  box([barX, 1.085, barZ], [8.15, 0.15, 1.28], m.stone);
  box([barX, 0.99, barZ + 0.66], [8.0, 0.045, 0.035], m.brass);
  pipe([1.15, 0.23, -1.43], [8.64, 0.23, -1.43], 0.038, m.brass);
  for (const x of [1.55, 3.65, 5.75, 8.15]) pipe([x, 0.23, -1.43], [x, 0.31, -1.9], 0.028, m.brass);
  solid(barX, barZ, 8.15, 1.28, 0.6, 1.2);
  for (let i = 0; i < 4; i++) {
    const x = 3.35 + i * 0.64;
    cylinder([x, 1.29, barZ - 0.18], 0.065, 0.36, m.brass);
    pipe([x, 1.44, barZ - 0.18], [x, 1.44, barZ + 0.1], 0.058, m.brass);
    pipe([x, 1.44, barZ + 0.1], [x, 1.3, barZ + 0.16], 0.042, m.steel);
    cylinder([x, 1.65, barZ - 0.17], 0.049, 0.24, i % 2 ? m.darkWood : m.cream);
    cylinder([x, 1.52, barZ - 0.17], 0.022, 0.09, m.steel);
  }
  box([4.3, 1.166, barZ + 0.22], [3.3, 0.028, 0.38], m.steel);
  for (let i = 0; i < 24; i++)
    box([2.77 + i * 0.133, 1.183, barZ + 0.22], [0.039, 0.007, 0.34], m.iron);
  // Shelves, stacked clean glasses, labelled bottles and teal ceramic backsplash.
  box([5.1, 1.41, -8.54], [7.6, 1.12, 0.18], m.tile);
  for (const y of [1.08, 1.92]) {
    box([5.1, y, -8.08], [7.7, 0.095, 0.82], m.darkWood);
    for (let i = 0; i < 18; i++) {
      const x = 1.65 + i * 0.397;
      cylinder([x, y + 0.19, -8.1], 0.072, 0.29, i % 3 === 0 ? m.cream : m.bottle);
      cylinder([x, y + 0.385, -8.1], 0.03, 0.115, m.bottle);
      cylinder([x, y + 0.44, -8.1], 0.034, 0.025, m.brass);
      box([x, y + 0.205, -8.022], [0.1, 0.13, 0.018], m.cream);
    }
  }
  solid(5.1, -8.1, 7.7, 0.86, 1.15, 2.3);
  sign(
    'HELL · DUNKEL · WEISSBIER',
    'FRISCH VOM FASS',
    [9.61, 2.39, -4.52],
    [4.7, 1.34],
    -Math.PI / 2,
  );
  // POS terminal, folded menu, ceramic crock and bar mat.
  box([7.6, 1.19, barZ], [0.42, 0.055, 0.3], m.iron);
  box([7.6, 1.43, barZ - 0.02], [0.41, 0.32, 0.07], m.iron, [-0.18, 0, 0]);
  box([7.6, 1.44, barZ + 0.026], [0.35, 0.235, 0.014], m.tile, [-0.18, 0, 0]);
  cylinder([2.0, 1.29, barZ], 0.12, 0.24, m.cream);
  for (const x of [1.97, 2.025, 2.075])
    pipe([x, 1.33, barZ], [x - 0.025, 1.65, barZ + 0.05], 0.015, m.darkWood);

  function table(x, z, w, d, height = 0.86) {
    for (let i = 0; i < 5; i++)
      box(
        [x, height, z - d / 2 + ((i + 0.5) * d) / 5],
        [w, 0.1, d / 5 - 0.009],
        i % 2 ? m.darkWood : m.wood,
      );
    for (const sx of [-1, 1]) {
      box([x + sx * (w / 2 - 0.23), height / 2, z], [0.13, height - 0.08, d * 0.71], m.iron);
      box([x + sx * (w / 2 - 0.23), 0.105, z], [0.33, 0.09, d * 0.9], m.iron);
    }
    box([x, 0.3, z], [w - 0.4, 0.1, 0.09], m.darkWood);
    solid(x, z, w, d, height / 2, height);
  }
  function bench(x, z, w) {
    box([x, 0.47, z], [w, 0.12, 0.4], m.darkWood);
    for (const sx of [-1, 1]) box([x + sx * (w / 2 - 0.27), 0.23, z], [0.12, 0.4, 0.34], m.iron);
    solid(x, z, w, 0.42, 0.25, 0.5);
  }
  function coaster(x, y, z) {
    b.add(g.cylinder, m.cream, [x, y, z], [0.09, 0.008, 0.09]);
    ring([x, y + 0.005, z], 0.069, m.brass);
  }
  for (const [x, z] of [
    [-6.1, 5.6],
    [5.8, 4.8],
  ]) {
    table(x, z, 3.45, 1.22);
    bench(x, z - 0.93, 3.3);
    bench(x, z + 0.93, 3.3);
    for (const dx of [-1.05, 1.05]) for (const dz of [-0.33, 0.33]) coaster(x + dx, 0.915, z + dz);
    cylinder([x, 0.99, z], 0.055, 0.16, m.brass);
    sphere([x, 1.1, z], [0.038, 0.072, 0.038], m.bulb);
    box([x + 0.27, 0.98, z], [0.18, 0.16, 0.025], m.cream);
  }
  // Contest surface and free approach from the central aisle.
  table(-4.25, 0.9, 2.35, 1.18, 0.96);
  coaster(-4.25, 1.016, 0.96);
  box([-5.09, 1.025, 0.73], [0.38, 0.018, 0.25], m.cream);
  sign('MASS HALTEN.', 'RUHIGE HAND. GROSSE EHRE.', [-4.25, 1.22, 0.42], [0.85, 0.28]);

  // Coopered barrels, forged hoops and decorative hop garlands.
  for (const [x, z] of [
    [-8.5, -1.8],
    [8.6, 7.4],
  ]) {
    sphere([x, 0.64, z], [0.53, 0.67, 0.53], m.darkWood);
    for (const y of [0.18, 0.39, 0.85, 1.1])
      ring([x, y, z], y < 0.2 || y > 1 ? 0.44 : 0.52, m.iron);
    cylinder([x, 1.245, z], 0.43, 0.055, m.wood);
    solid(x, z, 1.05, 1.05, 0.65, 1.3);
  }
  for (let i = 0; i < 28; i++) {
    const x = 1.35 + i * 0.265,
      y = 3.07 - 0.12 * Math.sin(i * 0.56);
    sphere([x, y, -8.32], [0.12, 0.19, 0.065], m.green);
    sphere([x + 0.065, y - 0.13, -8.27], [0.065, 0.09, 0.065], m.brass);
  }
  // Fixtures deliberately contain emissive meshes only: zero dynamic light sources.
  for (const [x, z] of [
    [-6.1, 5.6],
    [5.8, 4.8],
    [-4.25, 0.9],
    [3.1, -2.35],
    [6.7, -2.35],
  ]) {
    pipe([x, 3.5, z], [x, 2.92, z], 0.012, m.iron);
    cylinder([x, 2.9, z], 0.085, 0.085, m.brass);
    b.add(g.cone, m.iron, [x, 2.79, z], [0.34, 0.17, 0.34]);
    sphere([x, 2.72, z], [0.065, 0.077, 0.065], m.bulb);
    ring([x, 2.7, z], 0.34, m.brass);
  }
  b.finish();

  // Detachable contest stool: feet at its origin; seat top .64 m.
  const stool = new T.Group();
  stool.name = 'Contest stool · smoked oak and leather';
  const sb = batcher(T, stool);
  sb.add(g.cylinder, m.leather, [0, 0.595, 0], [0.29, 0.09, 0.29]);
  sb.add(g.cylinder, m.darkWood, [0, 0.527, 0], [0.265, 0.06, 0.265]);
  for (const x of [-0.185, 0.185])
    for (const z of [-0.185, 0.185]) sb.add(g.box, m.darkWood, [x, 0.265, z], [0.065, 0.52, 0.065]);
  for (const x of [-0.185, 0.185]) sb.add(g.box, m.brass, [x, 0.205, 0], [0.025, 0.025, 0.36]);
  for (const z of [-0.185, 0.185]) sb.add(g.box, m.brass, [0, 0.205, z], [0.36, 0.025, 0.025]);
  sb.add(g.box, m.darkWood, [0, 0.265, -0.46], [0.6, 0.04, 0.32]);
  for (const x of [-0.24, 0.24]) sb.add(g.box, m.darkWood, [x, 0.1325, -0.46], [0.04, 0.265, 0.22]);
  sb.finish();
  stool.position.set(-4.25, 0, 2.31);
  group.add(stool);
  solid(-4.25, 2.31, 0.56, 0.56, 0.3, 0.6);

  // Thick-walled 3D Maßkrug; origin is the flat base, handle extends towards +X.
  const mug = new T.Group();
  mug.name = 'Brienner Bräu · contest Maßkrug';
  const h = 0.235,
    r = 0.064;
  const profile = [
    [0, 0],
    [0.049, 0],
    [0.061, 0.004],
    [r, 0.025],
    [r, 0.205],
    [0.061, h],
    [0.057, h],
    [0.056, 0.219],
    [0.055, 0.025],
    [0.049, 0.017],
    [0, 0.017],
  ];
  const shell = new T.Mesh(
    new T.LatheGeometry(
      profile.map(([x, y]) => new T.Vector2(x, y)),
      40,
    ),
    m.glass,
  );
  shell.name = 'Thick glass body';
  shell.renderOrder = 3;
  mug.add(shell);
  const beer = new T.Mesh(new T.CylinderGeometry(0.054, 0.052, 0.174, 32), m.beer);
  beer.name = 'Amber lager · animate fill via scale.y and position.y';
  beer.position.y = 0.11;
  beer.renderOrder = 2;
  mug.add(beer);
  const foam = new T.Group();
  foam.name = 'Foam head';
  foam.position.y = 0.207;
  mug.add(foam);
  const fb = batcher(T, foam);
  fb.add(g.cylinder, m.foam, [0, 0, 0], [0.056, 0.022, 0.056]);
  for (let i = 0; i < 15; i++) {
    const a = i * 2.399,
      rr = 0.043 * Math.sqrt(i / 15);
    fb.add(
      g.sphere,
      m.foam,
      [Math.cos(a) * rr, 0.012 + (i % 3) * 0.001, Math.sin(a) * rr],
      [0.013, 0.007, 0.013],
    );
  }
  fb.finish();
  const mb = batcher(T, mug);
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14;
    mb.add(
      g.sphere,
      m.glass,
      [Math.cos(a) * 0.061, 0.12, Math.sin(a) * 0.061],
      [0.0055, 0.081, 0.0055],
      undefined,
      false,
    );
  }
  mb.add(g.ring, m.glass, [0, 0.235, 0], [0.059, 0.059, 0.059], [Math.PI / 2, 0, 0], false);
  mb.add(g.ring, m.glass, [0, 0.015, 0], [0.058, 0.058, 0.058], [Math.PI / 2, 0, 0], false);
  const handleCurve = new T.CatmullRomCurve3([
    new T.Vector3(0.06, 0.184, 0),
    new T.Vector3(0.106, 0.184, 0),
    new T.Vector3(0.125, 0.145, 0),
    new T.Vector3(0.119, 0.077, 0),
    new T.Vector3(0.065, 0.056, 0),
  ]);
  const handle = new T.Mesh(new T.TubeGeometry(handleCurve, 24, 0.011, 10, false), m.glass);
  handle.name = 'Solid glass handle';
  handle.renderOrder = 3;
  mug.add(handle);
  mb.finish();
  mug.position.set(-4.25, 1.025, 0.96);
  group.add(mug);
  Object.assign(mug.userData, {
    beer,
    foam,
    handle,
    gripAnchor: new T.Vector3(0.108, 0.123, 0),
    restPosition: mug.position.clone(),
    capacityLitres: 1,
    empty: false,
  });

  const counts = { drawCalls: 0, meshes: 0, instances: 0, triangles: 0, lights: 0, materials: 0 };
  const materials = new Set();
  group.traverse((node) => {
    if (node.isLight) counts.lights++;
    if (!node.isMesh) return;
    counts.meshes++;
    counts.drawCalls++;
    counts.instances += node.isInstancedMesh ? node.count : 1;
    counts.triangles +=
      ((node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count) /
        3) *
      (node.isInstancedMesh ? node.count : 1);
    materials.add(node.material);
  });
  counts.materials = materials.size;
  group.userData.assetVersion = '1.0.0';
  group.userData.counts = counts;
  return {
    group,
    barSpot: { x: 4.9, z: -0.5 },
    gameSpot: { x: -4.25, z: 3.32 },
    doorSpot: { x: 0, z: 8.1 },
    mug,
    stool,
    collisionBoxes: boxes,
    sign: mainSign,
    counts,
    seatedSpot: { x: -4.25, y: 0.64, z: 2.31, yaw: Math.PI },
    tableSpot: { x: -4.25, y: 1.01, z: 0.96 },
    barStaffSpot: { x: 4.9, z: -3.62 },
    bounds: { min: { x: -10, y: -0.16, z: -9 }, max: { x: 10, y: 3.6, z: 9 } },
    notes:
      'Fiktive Münchner Handwerksbrauerei. Eigenständig prozedural modelliert; keine externen Assets, keine Lichtobjekte. Mug +X = Griffseite.',
  };
}
