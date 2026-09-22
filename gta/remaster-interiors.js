import * as THREE from 'three';
import { mergeStaticGeometry } from './render-batches.js';
import { remasterMaterial } from './remaster-materials.js';

// Architectural additions only. They sit on existing fixtures, above head height
// or flush to walls. Navigation, interactions and story choreography stay intact.
const geometry = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
  sphere: new THREE.SphereGeometry(1, 16, 10),
  ring: new THREE.TorusGeometry(1, 0.025, 6, 32),
};
const materialCache = new Map();
const UP = new THREE.Vector3(0, 1, 0);
const reports = new WeakMap();
function material(name) {
  if (materialCache.has(name)) return materialCache.get(name);
  let value;
  if (name === 'light') {
    value = new THREE.MeshStandardMaterial({
      color: '#fff6df',
      emissive: '#ffddb0',
      emissiveIntensity: 0.85,
      roughness: 0.35,
    });
  } else if (name === 'ceramic') {
    value = new THREE.MeshPhysicalMaterial({
      color: '#f0eee6',
      roughness: 0.22,
      metalness: 0,
      clearcoat: 0.32,
    });
  } else {
    const definitions = {
      steel: ['metal', { color: '#bbc7c5', roughness: 0.34, metalness: 0.68 }],
      brass: ['metal', { color: '#d5b680', roughness: 0.4, metalness: 0.67 }],
      dark: ['metal', { color: '#283438', roughness: 0.54, metalness: 0.24 }],
      oak: ['oak', { color: '#e0c19b', roughness: 0.62 }],
      linen: ['fabric', { color: '#e9e2cf', roughness: 0.94 }],
    };
    value = remasterMaterial(...definitions[name]);
  }
  materialCache.set(name, value);
  return value;
}
function builder(kind) {
  const root = new THREE.Group();
  root.name = `Remaster · ${kind} fittings`;
  root.userData.dynamic = true; // Already batched; do not merge it a second time.
  root.userData.remasterInteriorKind = kind;
  const pieces = [],
    features = [];
  const add = (shape, position, scale, surface = 'steel', rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(
      typeof shape === 'string' ? geometry[shape] : shape,
      material(surface),
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    pieces.push(mesh);
    return mesh;
  };
  const api = {
    feature: (name) => features.push(name),
    box: (p, s, m, r) => add('box', p, s, m, r),
    plane: (p, s, m, r) => add('plane', p, [s[0], s[1], 1], m, r),
    cylinder: (p, radius, height, m, r) => add('cylinder', p, [radius, height, radius], m, r),
    sphere: (p, s, m) => add('sphere', p, s, m),
    ring: (p, radius, m, r = [Math.PI / 2, 0, 0]) => add('ring', p, [radius, radius, radius], m, r),
    pipe(points, radius = 0.016, surface = 'steel') {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      const tube = new THREE.TubeGeometry(curve, 18, radius, 7, false);
      return add(tube, [0, 0, 0], [1, 1, 1], surface);
    },
    rod(a, b, radius = 0.012, surface = 'steel') {
      const start = new THREE.Vector3(...a),
        end = new THREE.Vector3(...b);
      const delta = end.clone().sub(start);
      const mesh = add(
        'cylinder',
        start.clone().add(end).multiplyScalar(0.5).toArray(),
        [radius, delta.length(), radius],
        surface,
      );
      mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
      return mesh;
    },
    finish(parent) {
      // Build detached so merged vertices remain in the room's local coordinates,
      // even when a cinematic set is positioned elsewhere in the world.
      root.updateMatrixWorld(true);
      const byMaterial = new Map();
      for (const piece of pieces) {
        const bucket = byMaterial.get(piece.material) || [];
        bucket.push(piece);
        byMaterial.set(piece.material, bucket);
      }
      let triangles = 0;
      for (const [surface, list] of byMaterial) {
        const merged = mergeStaticGeometry(list);
        const mesh = new THREE.Mesh(merged, surface);
        mesh.name = `Remaster · ${kind} · material batch`;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
        triangles += merged.index.count / 3;
      }
      for (const piece of pieces) {
        root.remove(piece);
        if (!Object.values(geometry).includes(piece.geometry)) piece.geometry.dispose();
      }
      const report = {
        kind,
        batches: byMaterial.size,
        components: pieces.length,
        triangles,
        addedLights: 0,
        addedColliders: 0,
        features,
      };
      root.userData.remasterInteriorReport = report;
      parent.add(root);
      parent.userData.remasterInteriorReport = report;
      reports.set(parent, report);
      return report;
    },
  };
  return api;
}
function linearLight(b, x, y, z, length = 2.6, axis = 0, emit = true) {
  // Open-top housing: the camera often travels at luminaire height. A broad
  // closed box would become a near-plane black slab, whereas this downward
  // FrontSide face preserves the visible underside without blocking high views.
  b.plane([x, y - 0.041, z], [length, 0.34], 'dark', [Math.PI / 2, 0, -axis]);
  const dx = Math.cos(axis),
    dz = -Math.sin(axis);
  for (const side of [-1, 1]) {
    b.box(
      [x + dx * side * (length / 2 - 0.025), y - 0.024, z + dz * side * (length / 2 - 0.025)],
      [0.055, 0.076, 0.355],
      'steel',
      [0, axis, 0],
    );
  }
  if (emit) b.plane([x, y - 0.045, z], [length - 0.14, 0.245], 'light', [Math.PI / 2, 0, -axis]);
}
function pictureLight(b, x, y, z, yaw = 0, length = 0.8) {
  const groupPoints = (lx, ly, lz) => [
    x + Math.cos(yaw) * lx + Math.sin(yaw) * lz,
    y + ly,
    z - Math.sin(yaw) * lx + Math.cos(yaw) * lz,
  ];
  for (const side of [-1, 1]) {
    b.box(groupPoints(side * length * 0.32, 0, 0), [0.045, 0.15, 0.025], 'brass', [0, yaw, 0]);
    b.rod(
      groupPoints(side * length * 0.32, 0, 0),
      groupPoints(side * length * 0.32, 0.055, 0.14),
      0.013,
      'brass',
    );
  }
  b.box(groupPoints(0, 0.055, 0.16), [length, 0.058, 0.07], 'brass', [0, yaw, 0]);
  b.box(groupPoints(0, 0.023, 0.165), [length - 0.06, 0.012, 0.052], 'light', [0, yaw, 0]);
}
function faucet(b, x, base, z, scale = 1, yaw = 0) {
  const p = (a, y, d) => [
    x + (Math.cos(yaw) * a + Math.sin(yaw) * d) * scale,
    base + y * scale,
    z + (-Math.sin(yaw) * a + Math.cos(yaw) * d) * scale,
  ];
  b.cylinder(p(0, 0.022, 0), 0.056 * scale, 0.044 * scale, 'steel');
  b.pipe(
    [p(0, 0.02, 0), p(0, 0.24, 0), p(0, 0.38, 0.05), p(0, 0.39, 0.23), p(0, 0.23, 0.29)],
    0.023 * scale,
  );
  b.cylinder(p(0, 0.221, 0.29), 0.029 * scale, 0.041 * scale, 'steel');
  b.rod(p(0.03, 0.12, 0), p(0.12, 0.2, 0), 0.019 * scale);
}
function socket(b, p, yaw = 0) {
  b.box(p, [0.08, 0.11, 0.019], 'ceramic', [0, yaw, 0]);
  const x = p[0] + Math.sin(yaw) * 0.012,
    z = p[2] + Math.cos(yaw) * 0.012;
  b.box([x, p[1], z], [0.049, 0.069, 0.009], 'dark', [0, yaw, 0]);
}
function office(b) {
  b.feature('Nine framed suspended linear luminaires');
  for (const z of [-6, 0, 6])
    for (const x of [-8, -1, 6]) {
      // Original diffuser occupies y=3.1375..3.1825; housing meets its upper face.
      linearLight(b, x, 3.224, z, 2.62, 0, false);
      for (const side of [-1, 1])
        b.rod([x + side * 0.94, 3.269, z], [x + side * 0.94, 3.395, z], 0.008);
    }
  b.feature('Espresso group head, milk wand, drip-grate and curved kitchen tap');
  for (const side of [-1, 1]) b.box([8.1 + side * 0.267, 1.26, 8.4], [0.014, 0.54, 0.475], 'steel');
  b.cylinder([8.1, 1.219, 8.14], 0.075, 0.052, 'steel');
  b.rod([8.1, 1.208, 8.125], [8.1, 1.208, 7.982], 0.023, 'dark');
  b.pipe(
    [
      [7.89, 1.31, 8.2],
      [7.79, 1.26, 8.14],
      [7.79, 1.08, 8.04],
    ],
    0.012,
  );
  for (let i = 0; i < 7; i++) b.box([7.92 + i * 0.06, 1.034, 8.04], [0.016, 0.008, 0.15], 'steel');
  faucet(b, 10.5, 0.992, 8.27, 0.94, Math.PI);
  b.box([10.5, 0.978, 8.46], [0.85, 0.012, 0.53], 'steel');
  b.box([10.5, 0.987, 8.46], [0.72, 0.01, 0.41], 'dark');
  b.box([-6, 0.205, 7.579], [3.63, 0.024, 0.016], 'light');
  pictureLight(b, -13.315, 2.96, 0.1, Math.PI / 2, 0.89);
  pictureLight(b, 28.16, 3.18, -2, Math.PI / 2, 1.12);
  b.feature('IT rack handles, WC mixer spouts and dual-flush buttons');
  for (const x of [-38.5, -36.9, -35.3]) {
    for (const side of [-1, 1])
      b.rod([x + side * 0.57, 0.17, -4.641], [x + side * 0.57, 2.15, -4.641], 0.018);
    b.pipe(
      [
        [x + 0.45, 0.91, -4.639],
        [x + 0.45, 0.94, -4.57],
        [x + 0.45, 1.23, -4.57],
        [x + 0.45, 1.26, -4.639],
      ],
      0.016,
    );
  }
  for (const z of [24.7, 26.1]) faucet(b, 37.94, 0.949, z, 0.8, -Math.PI / 2);
  for (const x of [30.5, 33, 35.5]) {
    b.box([x, 1.272, 20.64], [0.22, 0.025, 0.095], 'steel');
    b.box([x - 0.048, 1.287, 20.64], [0.105, 0.007, 0.075], 'dark');
  }
  for (const [x, y, z, yaw] of [
    [1.38, 1.14, 10.875, Math.PI],
    [5.14, 1.14, 10.875, Math.PI],
    [33.03, 1.14, 27.884, Math.PI],
  ])
    socket(b, [x, y, z], yaw);
  linearLight(b, 34, 3.38, 0, 3.3);
  linearLight(b, -33, 3.17, 3.5, 3.8);
}
function restaurant(b) {
  b.feature('Pendulum fittings and rolled metal shade edges over six dining tables');
  for (const x of [-6, 0, 6])
    for (const z of [-1, 4.5]) {
      b.cylinder([x, 3.27, z], 0.087, 0.045, 'brass');
      b.rod([x, 3.247, z], [x, 3.01, z], 0.009, 'dark');
      b.ring([x, 2.668, z], 0.405, 'brass');
      b.ring([x, 3.005, z], 0.203, 'brass');
      b.cylinder([x, 2.957, z], 0.065, 0.092, 'ceramic');
    }
  b.feature('Brass-backed picture lights and window handles');
  for (const z of [0.3, 5.25]) pictureLight(b, 8.317, 3.1, z, -Math.PI / 2, 0.97);
  for (const z of [-3, 3, 7])
    b.pipe(
      [
        [-8.239, 1.66, z + 0.58],
        [-8.18, 1.66, z + 0.58],
        [-8.18, 1.94, z + 0.58],
        [-8.239, 1.94, z + 0.58],
      ],
      0.017,
      'brass',
    );
  socket(b, [1.73, 1.16, 8.895], Math.PI);
}
function home(b) {
  b.feature('Sculpted brass lamp fittings and warm portrait lighting');
  b.ring([0.2, 2.985, 0.3], 0.45, 'brass');
  b.ring([0.2, 3.215, 0.3], 0.202, 'brass');
  b.cylinder([0.2, 3.55, 0.3], 0.08, 0.039, 'brass');
  b.ring([-7.02, 1.638, 5.42], 0.321, 'brass');
  b.ring([-7.02, 2.039, 5.42], 0.145, 'brass');
  pictureLight(b, 7.824, 3.02, 0, -Math.PI / 2, 0.86);
  b.feature('Kitchen cabinet fronts, handles, sink and curved gooseneck tap');
  for (let i = 0; i < 4; i++) {
    const x = 2.51 + i * 0.992;
    b.box([x, 0.5, -4.191], [0.966, 0.73, 0.022], 'oak');
    b.rod([x - 0.11, 0.803, -4.163], [x + 0.11, 0.803, -4.163], 0.01, 'brass');
  }
  b.box([2.8, 1.02, -4.92], [0.77, 0.009, 0.64], 'steel');
  b.box([2.8, 1.027, -4.91], [0.65, 0.007, 0.53], 'dark');
  faucet(b, 2.8, 1.025, -5.27, 0.88, 0);
  for (const z of [2.65, 4.55]) b.rod([6.042, 0.91, z], [6.042, 1.27, z], 0.012, 'brass');
  socket(b, [1.67, 1.15, 7.888], Math.PI);
  socket(b, [2.73, 0.38, -7.882], 0);
  b.feature('Stitched bed-linen seams');
  for (const x of [-5.12, -4.74, -4.36, -3.98, -3.6, -3.22, -2.84])
    b.box([x, 0.882, -2.45], [0.012, 0.009, 2.83], 'linen');
  for (const z of [-4.85, -4.5, -4.15]) b.box([-4, 0.934, z], [2.45, 0.008, 0.012], 'linen');
}
function kitchen(b) {
  b.feature('Professional extraction canopy with baffle filters and task strips');
  b.box([-2, 3.26, -2.8], [6.34, 0.31, 1.62], 'steel');
  b.box([-2, 3.093, -2.8], [6.08, 0.022, 1.37], 'dark');
  for (let i = 0; i < 13; i++)
    b.box([-4.88 + i * 0.48, 3.075, -2.8], [0.04, 0.055, 1.27], 'steel', [0, 0, 0.2]);
  for (const z of [-3.46, -2.14]) b.box([-2, 3.07, z], [5.95, 0.019, 0.035], 'light');
  b.box([-2, 3.49, -2.8], [2.14, 0.15, 0.71], 'steel');
  for (const x of [-5, -2, 1]) {
    b.rod([x, 2.925, -3], [x, 3.092, -3], 0.011, 'dark');
    b.ring([x, 2.187, -3], 0.345, 'brass');
  }
  b.feature('Fridge hinge fittings and stainless preparation handles');
  b.pipe(
    [
      [-6.13, 0.92, -4.699],
      [-6.07, 0.92, -4.61],
      [-6.07, 1.63, -4.61],
      [-6.13, 1.63, -4.699],
    ],
    0.022,
  );
  for (const y of [0.45, 2.06]) b.box([-7.666, y, -4.713], [0.083, 0.15, 0.042], 'steel');
  for (const z of [-3.7, -2.0, -0.3])
    b.rod([4.827, 1.04, z - 0.24], [4.827, 1.04, z + 0.24], 0.014);
  pictureLight(b, 7.824, 3.07, 4.25, -Math.PI / 2, 1.03);
  socket(b, [1.66, 1.15, 7.888], Math.PI);
}
function brewery(b) {
  b.feature('Backbar uplight rail, brass shelving supports and gallery fitting');
  // The bar occupies x=.8..9, z=-3..-1.7; these stay against the back wall.
  b.box([4.7, 1.66, -8.624], [7.1, 0.025, 0.055], 'brass');
  b.box([4.7, 1.678, -8.615], [6.98, 0.012, 0.045], 'light');
  for (const x of [1.55, 4.8, 8.05]) b.rod([x, 1.35, -8.61], [x, 1.648, -8.61], 0.014, 'brass');
  pictureLight(b, 9.595, 3.15, 1.25, -Math.PI / 2, 0.94);
  for (const z of [2.4, 6.3])
    b.pipe(
      [
        [-9.581, 1.78, z + 0.42],
        [-9.51, 1.78, z + 0.42],
        [-9.51, 2.02, z + 0.42],
        [-9.581, 2.02, z + 0.42],
      ],
      0.016,
      'brass',
    );
  socket(b, [1.62, 1.17, 8.781], Math.PI);
}
const BUILDERS = { office, restaurant, home, zitronengras: kitchen, kitchen, brewery };
function kindOf(group) {
  if (BUILDERS[group?.userData?.remasterInteriorKind]) return group.userData.remasterInteriorKind;
  let kind = null;
  group?.traverse?.((node) => {
    if (kind) return;
    const name = node.name || '';
    if (name.startsWith('Home · lived-in')) kind = 'home';
    else if (name.startsWith('Zitronengras · culinary')) kind = 'zitronengras';
    else if (name.startsWith('BBE · architectural')) kind = 'office';
    else if (name.startsWith('BRIENNER BRÄU')) kind = 'brewery';
    else if (name.startsWith('Restaurant detail ·')) kind = 'restaurant';
  });
  return kind;
}
function decorate(group, kind) {
  if (!group || !BUILDERS[kind]) return null;
  if (reports.has(group)) return reports.get(group);
  let existing = null;
  group.traverse((node) => {
    existing ||= node.userData.remasterInteriorReport || null;
  });
  if (existing) {
    reports.set(group, existing);
    return existing;
  }
  const b = builder(kind);
  BUILDERS[kind](b);
  return b.finish(group);
}
export function remasterInteriorGroup(group) {
  return decorate(group, kindOf(group));
}
export function installInteriorRemaster(world) {
  const report = {};
  for (const kind of ['office', 'restaurant', 'home', 'zitronengras', 'brewery']) {
    if (world.groups?.[kind]) report[kind] = decorate(world.groups[kind], kind);
  }
  world.remasterInteriorReport = report;
  return report;
}
