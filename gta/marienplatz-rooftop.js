import * as THREE from 'three';
import { remasterMaterial, metricBoxGeometry } from './remaster-materials.js';
import { mergeStaticGeometry } from './render-batches.js';

// Fictional architecture in the existing compressed Munich layout. The central
// south-side house, not the Rathaus, is behind the Mariensäule in the intro.
export const MARIENPLATZ_ROOFTOP = Object.freeze({
  x: 365,
  z: 336,
  width: 35,
  depth: 25,
  buildingHeight: 16,
  deckY: 17.02,
  statue: Object.freeze({ x: 368, z: 302 }),
  preview: Object.freeze({ from: [391, 31, 302], look: [365, 18, 335] }),
  intro: Object.freeze({
    at: 44,
    end: 47,
    from: [337, 24, 285],
    to: [391, 28, 298],
    look: [367, 17, 327],
  }),
});

const cube = new THREE.BoxGeometry(1, 1, 1);
const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
const cylinders = new Map();
function mesh(parent, geometry, material, x, y, z, name = '') {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.name = name;
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}
function box(parent, x, y, z, w, h, d, material) {
  const object = mesh(
    parent,
    material.userData.remasterSurface ? metricBoxGeometry(w, h, d) : cube,
    material,
    x,
    y,
    z,
  );
  object.scale.set(w, h, d);
  return object;
}
function cylinder(parent, x, y, z, radius, height, material, top = radius) {
  const key = `${radius}/${height}/${top}`;
  if (!cylinders.has(key)) cylinders.set(key, new THREE.CylinderGeometry(top, radius, height, 10));
  return mesh(parent, cylinders.get(key), material, x, y, z);
}
function group(parent, x, y, z, name) {
  const result = new THREE.Group();
  result.position.set(x, y, z);
  result.name = name;
  parent.add(result);
  return result;
}
function gable(parent, x, y, z, width, height, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return mesh(
    parent,
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }),
    material,
    x,
    y,
    z,
  );
}
function beam(parent, from, to, width, material) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to);
  const object = box(
    parent,
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    (a.z + b.z) / 2,
    width,
    a.distanceTo(b),
    width,
    material,
  );
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return object;
}

function palette() {
  return {
    stone: remasterMaterial('stone', {
      color: '#dbd2bf',
      normalScale: new THREE.Vector2(0.15, 0.15),
    }),
    wood: remasterMaterial('oak', { color: '#9c7751', roughness: 0.79 }),
    metal: remasterMaterial('metal', { color: '#344441', roughness: 0.58 }),
    zinc: remasterMaterial('metal', { color: '#64736b', roughness: 0.65 }),
    slate: remasterMaterial('stone', { color: '#575e5d', roughness: 0.93 }),
    tile: remasterMaterial('stone', {
      color: '#976752',
      roughness: 0.96,
      normalScale: new THREE.Vector2(0.12, 0.12),
    }),
    ivory: remasterMaterial('fabric', { color: '#dfd4bd', roughness: 0.95 }),
    greenFabric: remasterMaterial('fabric', { color: '#647568', roughness: 0.95 }),
    plaster: remasterMaterial('plaster', { color: '#ded1b9' }),
    glass: new THREE.MeshStandardMaterial({ color: '#526a6c', roughness: 0.25, metalness: 0.45 }),
    soil: new THREE.MeshStandardMaterial({ color: '#403b2c', roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: '#5c7149', roughness: 0.94 }),
    leavesLight: new THREE.MeshStandardMaterial({ color: '#829265', roughness: 0.94 }),
    warm: new THREE.MeshStandardMaterial({
      color: '#ffe1a8',
      emissive: '#ffc267',
      emissiveIntensity: 1.2,
      roughness: 0.5,
    }),
  };
}

function rail(parent, from, to, material, height = 1.08) {
  const [x, y, z] = from,
    [xx, , zz] = to;
  const alongX = Math.abs(xx - x) > Math.abs(zz - z);
  const length = Math.hypot(xx - x, zz - z);
  const cx = (x + xx) / 2,
    cz = (z + zz) / 2;
  for (const dy of [0.12, height])
    box(parent, cx, y + dy, cz, alongX ? length : 0.06, 0.065, alongX ? 0.06 : length, material);
  const count = Math.ceil(length / 0.3);
  for (let i = 0; i <= count; i++) {
    const strong = i === 0 || i === count || i % 7 === 0;
    box(
      parent,
      x + ((xx - x) * i) / count,
      y + height / 2,
      z + ((zz - z) * i) / count,
      strong ? 0.075 : 0.027,
      height,
      strong ? 0.075 : 0.027,
      material,
    );
  }
}

function windowFrame(parent, x, y, z, width, height, p, rotation = 0) {
  const frame = group(parent, x, y, z, 'Deep timber casement');
  frame.rotation.y = rotation;
  box(frame, 0, 0, 0, width, height, 0.045, p.glass);
  for (const side of [-1, 1]) {
    box(frame, side * (width / 2 + 0.055), 0, -0.075, 0.11, height + 0.18, 0.17, p.stone);
    box(frame, 0, side * (height / 2 + 0.055), -0.075, width + 0.22, 0.11, 0.17, p.stone);
  }
  box(frame, 0, 0, -0.1, 0.055, height, 0.12, p.stone);
  box(frame, 0, 0.18, -0.1, width, 0.055, 0.12, p.stone);
}

function planter(parent, x, z, width, depth, p, tall = false) {
  const pot = group(parent, x, 0, z, tall ? 'Small multi-stem terrace tree' : 'Planted trough');
  box(pot, 0, 0.39, 0, width, 0.78, depth, p.stone);
  box(pot, 0, 0.8, 0, width + 0.06, 0.08, depth + 0.06, p.stone);
  box(pot, 0, 0.85, 0, width - 0.13, 0.03, depth - 0.13, p.soil);
  if (tall) {
    cylinder(pot, 0, 1.47, 0, 0.055, 1.3, p.wood, 0.03);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      beam(pot, [0, 1.1, 0], [Math.cos(a) * 0.45, 1.95, Math.sin(a) * 0.45], 0.025, p.wood);
      const leaf = mesh(
        pot,
        leafGeometry,
        i % 2 ? p.leavesLight : p.leaves,
        Math.cos(a) * 0.38,
        2 + (i % 2) * 0.25,
        Math.sin(a) * 0.38,
      );
      leaf.scale.set(0.65, 0.58, 0.62);
    }
  } else {
    const count = Math.max(2, Math.round(width / 0.65));
    for (let i = 0; i < count; i++) {
      const shrub = mesh(
        pot,
        leafGeometry,
        i % 2 ? p.leavesLight : p.leaves,
        -width / 2 + ((i + 0.5) * width) / count,
        1.1,
        Math.sin(i * 2) * depth * 0.13,
      );
      shrub.scale.set((width / count) * 0.69, 0.42 + (i % 3) * 0.04, depth * 0.6);
    }
  }
  return pot;
}

function loungeChair(parent, x, z, angle, p) {
  const chair = group(parent, x, 0, z, 'Teak lounge chair');
  chair.rotation.y = angle;
  for (const xx of [-0.37, 0.37]) {
    for (const zz of [-0.33, 0.33]) box(chair, xx, 0.29, zz, 0.055, 0.58, 0.055, p.wood);
    box(chair, xx, 0.69, 0, 0.065, 0.075, 0.88, p.wood);
    box(chair, xx, 0.54, -0.31, 0.055, 0.33, 0.055, p.wood);
  }
  box(chair, 0, 0.45, 0, 0.79, 0.085, 0.8, p.wood);
  box(chair, 0, 0.53, 0, 0.7, 0.14, 0.69, p.ivory);
  const back = box(chair, 0, 0.84, 0.3, 0.73, 0.58, 0.12, p.greenFabric);
  back.rotation.x = -0.12;
}

function seating(parent, x, z, p, count = 4) {
  const seating = group(parent, x, 0, z, 'Terrace seating group');
  cylinder(seating, 0, 0.62, 0, 0.76, 0.09, p.wood);
  cylinder(seating, 0, 0.3, 0, 0.05, 0.59, p.metal);
  box(seating, 0, 0.04, 0, 0.85, 0.07, 0.08, p.metal);
  box(seating, 0, 0.04, 0, 0.08, 0.07, 0.85, p.metal);
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    loungeChair(seating, Math.sin(a) * 1.65, Math.cos(a) * 1.65, a, p);
  }
  cylinder(seating, 0.2, 0.74, -0.1, 0.09, 0.18, p.warm).castShadow = false;
  cylinder(seating, -0.26, 0.705, 0.15, 0.15, 0.025, p.ivory);
  return seating;
}

function dormer(parent, x, bottom, front, p, { width = 2.4, roof = p.zinc } = {}) {
  const dormer = group(parent, x, bottom, front, 'Roof dormer');
  box(dormer, 0, 1.04, 0.85, width, 2.08, 1.7, p.plaster);
  windowFrame(dormer, 0, 1.12, -0.035, width - 0.48, 1.52, p);
  gable(dormer, 0, 2.08, -0.18, width + 0.38, 0.88, 2.08, roof);
}

function roofShell(parent, y, p, mansard) {
  // Sloped roofs are four large surfaces, not thousands of individual tiles.
  const outer = [
    [-17.7, -12.7],
    [17.7, -12.7],
    [17.7, 12.7],
    [-17.7, 12.7],
  ];
  const inner = mansard
    ? [
        [-14.1, -8.6],
        [14.1, -8.6],
        [14.1, 8.6],
        [-14.1, 8.6],
      ]
    : [
        [-17.7, 0],
        [17.7, 0],
        [17.7, 0],
        [-17.7, 0],
      ];
  const rise = mansard ? 4.1 : 5.9;
  const positions = [],
    uv = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const points = [
      [...outer[i], 0],
      [...outer[j], 0],
      [...inner[j], rise],
      [...inner[i], rise],
    ];
    for (const corners of [
      [0, 2, 1],
      [0, 3, 2],
    ]) {
      const vectors = corners.map(
        (k) => new THREE.Vector3(points[k][0], points[k][2], points[k][1]),
      );
      if (
        vectors[1].clone().sub(vectors[0]).cross(vectors[2].clone().sub(vectors[0])).lengthSq() <
        1e-10
      )
        continue; // Pitched gable ends are triangles, not collapsed quads.
      for (const k of corners) {
        const [x, z, h] = points[k];
        positions.push(x, y + h, z);
        uv.push(x, z + h);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  mesh(
    parent,
    geometry,
    mansard ? p.slate : p.tile,
    0,
    0,
    0,
    mansard ? 'Mansard roof' : 'Terracotta pitched roof',
  );
  if (mansard) box(parent, 0, y + rise + 0.04, 0, 28.2, 0.08, 17.2, p.slate);
  else box(parent, 0, y + rise + 0.03, 0, 35.6, 0.13, 0.24, p.tile);
  for (const x of [-12, 11]) {
    box(parent, x, y + rise + 0.67, 3, 0.86, 1.55, 0.94, p.plaster);
    box(parent, x, y + rise + 1.49, 3, 1.08, 0.12, 1.15, p.stone);
  }
}

function dressNeighbours(root, buildings, p) {
  const descriptions = [];
  for (const [index, building] of buildings.entries()) {
    const height = building.position.y * 2;
    const west = index === 0;
    const x = building.position.x;
    building.material = remasterMaterial('plaster', { color: west ? '#bdc8bb' : '#cfb4a5' });
    const facade = group(root, x, 0, 336, west ? 'Sage Gründerzeit house' : 'Rose Altstadt house');
    for (const y of [3.65, height - 0.09, height + 0.23])
      box(facade, 0, y, -12.67, 35.6, y > height ? 0.22 : 0.16, 0.48, p.stone);
    if (west) {
      // Rusticated corners, tall pilasters and a projecting three-storey oriel.
      for (const xx of [-16.6, 16.6]) {
        box(facade, xx, height / 2 + 1.1, -12.64, 0.62, height - 3, 0.21, p.stone);
        for (let y = 4; y < height - 0.8; y += 0.62)
          box(facade, xx, y, -12.83, 1.03, 0.29, 0.14, p.stone);
      }
      for (const y of [7.43, 13.73, 20.03]) box(facade, 0, y, -12.7, 34.9, 0.18, 0.42, p.stone);
      const oriel = group(facade, 0, 4.2, -12.59, 'Projecting sandstone oriel');
      const outline = new THREE.Shape();
      outline.moveTo(-2.25, 0);
      outline.lineTo(2.25, 0);
      outline.lineTo(2.25, 0.42);
      outline.lineTo(1.68, 1.25);
      outline.lineTo(-1.68, 1.25);
      outline.lineTo(-2.25, 0.42);
      outline.closePath();
      const geo = new THREE.ExtrudeGeometry(outline, { depth: 12.1, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      mesh(oriel, geo, p.stone, 0, 0, 0);
      for (const y of [1.4, 4.55, 7.7, 10.85]) {
        windowFrame(oriel, 0, y, -1.29, 2.13, 2.0, p);
        windowFrame(oriel, -1.99, y, -0.89, 0.69, 2.0, p, -0.6);
        windowFrame(oriel, 1.99, y, -0.89, 0.69, 2.0, p, 0.6);
        box(oriel, 0, y - 1.17, -0.78, 4.65, 0.17, 1.35, p.stone);
      }
      box(oriel, 0, 12.22, -0.55, 4.9, 0.26, 1.9, p.zinc);
      roofShell(facade, height + 0.87, p, true);
      for (const xx of [-10, 0, 10]) dormer(facade, xx, height + 1.57, -11.25, p);
    } else {
      // Narrower central balcony stack, triangular window pediments, tile roof.
      for (const y of [8.17, 11.32, 14.47]) {
        box(facade, 0, y - 1.24, -13.05, 4.8, 0.22, 1.3, p.stone);
        rail(facade, [-2.3, y - 1.13, -13.65], [2.3, y - 1.13, -13.65], p.metal, 0.83);
        for (const xx of [-2.3, 2.3])
          rail(facade, [xx, y - 1.13, -13.65], [xx, y - 1.13, -12.55], p.metal, 0.83);
        for (const xx of [-9.74, -4.17, 4.17, 9.74])
          gable(facade, xx, y + 1.2, -12.99, 2.0, 0.47, 0.24, p.stone);
      }
      for (const xx of [-16.4, 16.4])
        box(facade, xx, height / 2 + 1, -12.6, 0.4, height - 2.5, 0.12, p.stone);
      roofShell(facade, height + 0.87, p, false);
      for (const xx of [-10, 0, 10])
        dormer(facade, xx, height + 2.02, -10.1, p, { width: 2.65, roof: p.tile });
    }
    descriptions.push({
      x,
      z: 336,
      height,
      style: west ? 'Gründerzeit · Mansarddach · Erker' : 'Altstadt · Ziegeldach · Balkone',
      dormers: 3,
    });
  }
  return descriptions;
}

// Collapse authoring primitives into a few spatial material meshes. The normal
// world.batchScenes then incorporates these into its existing static cell batches.
// No added lights, per-frame callbacks, dynamic flags or high-poly asset downloads.
function compact(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  let triangles = 0,
    sourceMeshes = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    sourceMeshes++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
    const local = inverse.clone().multiply(object.matrixWorld);
    const cell = `${Math.floor(local.elements[12] / 48)}:${Math.floor(local.elements[14] / 48)}`;
    const key = `${object.material.uuid}|${object.castShadow}|${object.renderOrder}|${cell}`;
    if (!groups.has(key))
      groups.set(key, {
        material: object.material,
        shadow: object.castShadow,
        renderOrder: object.renderOrder,
        items: [],
      });
    groups.get(key).items.push({ geometry: object.geometry, matrixWorld: local });
  });
  root.clear();
  for (const data of groups.values()) {
    const result = mesh(
      root,
      mergeStaticGeometry(data.items),
      data.material,
      0,
      0,
      0,
      'Marienplatz · static architectural detail',
    );
    result.castShadow = data.shadow;
    result.renderOrder = data.renderOrder;
  }
  return { sourceMeshes, triangles, batches: groups.size, newLights: 0 };
}

/** Call after buildCityExpansion, before world.batchScenes. Safe to call twice. */
export function buildMarienplatzRooftop(world) {
  if (world.marienplatzRooftop) return world.marienplatzRooftop;
  const city = world.groups.city;
  const buildingAt = (x) =>
    city.children.find(
      (o) =>
        o.isMesh &&
        o.userData.remasterFacade &&
        Math.abs(o.position.x - x) < 0.01 &&
        Math.abs(o.position.z - 336) < 0.01,
    );
  const centre = buildingAt(365),
    west = buildingAt(322),
    east = buildingAt(405);
  if (!centre || !west || !east)
    throw new Error('Build Marienplatz houses before their rooftop detail');
  const p = palette();
  const root = group(city, 0, 0, 0, 'Marienplatz · Dachterrasse und Altstadthäuser');
  const deck = group(root, 365, MARIENPLATZ_ROOFTOP.deckY, 336, 'Central rooftop terrace');
  centre.material = p.plaster;
  box(deck, 0, -0.085, 0, 34.1, 0.17, 24.1, p.wood);
  // Broad plank rhythm and narrow recessed seams survive the high intro camera.
  for (let z = -11.85; z <= 11.85; z += 0.6)
    box(deck, 0, 0.006, z, 33.9, 0.008, 0.019, p.soil).castShadow = false;
  for (const z of [-11.9, 11.9]) rail(deck, [-16.9, 0, z], [16.9, 0, z], p.metal);
  for (const x of [-16.9, 16.9]) rail(deck, [x, 0, -11.9], [x, 0, 11.9], p.metal);
  // Low planting toward the square preserves seated views and the intro sightline.
  for (const x of [-13, -5, 5, 13]) planter(deck, x, -10.75, 4.9, 0.84, p).scale.y = 0.72;
  for (const x of [-15.5, 15.5]) {
    planter(deck, x, -5.2, 1.45, 1.45, p, true);
    planter(deck, x, 5, 1.45, 1.45, p, true);
    planter(deck, x, 10.55, 1.45, 1.45, p, true);
  }
  for (const [x, z] of [
    [-9, -4.8],
    [0, -5.3],
    [9, -4.8],
    [-9, 4.5],
  ])
    seating(deck, x, z, p);

  // A recessed stair pavilion gives the terrace a credible access point without
  // inventing a new interaction or touching existing office/courier roof routes.
  box(deck, -2.8, 1.49, 9.45, 5.8, 2.98, 4.15, p.plaster);
  box(deck, -2.8, 3.06, 9.45, 6.1, 0.15, 4.42, p.zinc);
  windowFrame(deck, -2.8, 1.23, 7.34, 2.08, 2.42, p);
  box(deck, -1.98, 1.05, 7.18, 0.045, 0.34, 0.05, p.metal);
  const pergola = group(deck, 7.7, 0, 5.5, 'Oak pergola with linen sun sails');
  for (const x of [-4.1, 4.1])
    for (const z of [-3.7, 3.7]) {
      box(pergola, x, 1.53, z, 0.14, 3.06, 0.14, p.wood);
      box(pergola, x, 0.09, z, 0.24, 0.18, 0.24, p.metal);
    }
  for (const z of [-3.7, 3.7]) box(pergola, 0, 3.07, z, 8.6, 0.22, 0.15, p.wood);
  for (let x = -4.2; x <= 4.21; x += 0.6) box(pergola, x, 3.23, 0, 0.07, 0.14, 8.05, p.wood);
  for (const x of [-2.9, 0, 2.9]) box(pergola, x, 3.33, 0, 2.52, 0.035, 7.7, p.ivory);
  for (const x of [-2.7, 2.7]) seating(pergola, x, 0, p, 2);
  for (let x = -3.6; x <= 3.61; x += 1.2) {
    cylinder(pergola, x, 2.93, -3.55, 0.012, 0.32, p.metal);
    cylinder(pergola, x, 2.72, -3.55, 0.078, 0.12, p.warm).castShadow = false;
  }
  for (const x of [-12, -4, 4, 12]) {
    box(deck, x, 0.4, -11.8, 0.19, 0.21, 0.17, p.metal);
    box(deck, x, 0.4, -11.69, 0.13, 0.12, 0.035, p.warm).castShadow = false;
  }
  // Layered central cornice and pilasters frame the terrace as one house.
  for (const y of [15.7, 16.11, 16.39]) box(root, 365, y, 323.27, 35.7, 0.16, 0.6, p.stone);
  for (const x of [348.25, 381.75]) box(root, x, 9.5, 323.42, 0.65, 11.5, 0.23, p.stone);
  const neighbours = dressNeighbours(root, [west, east], p);
  const stats = compact(root);
  // Just a deck and four rail collision envelopes, all above the existing roof.
  // Street navigation and the original building footprints remain unchanged.
  const floor = world.obstacle('city', 365, 336, 34.1, 24.1, 16.935, 0.17);
  floor.walkSurface = true;
  for (const z of [324.1, 347.9]) world.obstacle('city', 365, z, 33.8, 0.09, 17.56, 1.08);
  for (const x of [348.1, 381.9]) world.obstacle('city', x, 336, 0.09, 23.8, 17.56, 1.08);
  world.marienplatzRooftop = {
    root,
    ...MARIENPLATZ_ROOFTOP,
    neighbours,
    stats,
    facades: [
      { x: 322, z: 336, role: 'west', style: neighbours[0].style },
      { x: 365, z: 336, role: 'terrace', style: 'Kalkputz · Gesims · Dachgarten' },
      { x: 405, z: 336, role: 'east', style: neighbours[1].style },
    ],
    features: { seatingGroups: 6, seats: 20, planters: 10, trees: 6, pergolas: 1, dormers: 6 },
  };
  root.userData.marienplatzRooftop = true;
  return world.marienplatzRooftop;
}
