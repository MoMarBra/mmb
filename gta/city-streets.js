import * as THREE from 'three';
import { CITY_WALKS, CITY_FOOTWAYS } from './city-layout.js';

// One metre-based source for the visible carriageways, navigation and traffic.
// The north-west connector and the southern Altstadtring now actually join.
export const STREET_ROADS = Object.freeze(
  [
    { id: 'augusten', x: 0, z: -14, w: 18, d: 308 },
    { id: 'brienner', x: 52.5, z: 40, w: 405, d: 8 },
    { id: 'gabelsberger', x: 0, z: -43, w: 300, d: 11 },
    { id: 'south-maxvorstadt', x: 0, z: 117, w: 300, d: 11 },
    { id: 'benno-approach', x: -150, z: -43, w: 92, d: 12 },
    { id: 'west-connector', x: -144, z: 14.5, w: 12, d: 115 },
    { id: 'benno', x: -180, z: -61, w: 12, d: 37 },
    { id: 'altstadt-west', x: 249, z: 160, w: 12, d: 240 },
    { id: 'altstadt-south', x: 329, z: 280, w: 172, d: 12 },
    { id: 'altstadt-north', x: 328, z: 117, w: 170, d: 12 },
    { id: 'altstadt-east', x: 410, z: 199, w: 12, d: 175 },
    { id: 'altstadt-air-access', x: 278, z: 291, w: 12, d: 26, service: true },
  ].map(Object.freeze),
);

const rect = (r, margin = 0) => ({
  x0: r.x - r.w / 2 - margin,
  x1: r.x + r.w / 2 + margin,
  z0: r.z - r.d / 2 - margin,
  z1: r.z + r.d / 2 + margin,
});
const contains = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

export function isRoadPoint(x, z, roads = STREET_ROADS, margin = 0) {
  return roads.some((r) => contains(rect(r, margin), x, z));
}

/** A disjoint rectangular arrangement. Each occupied area is emitted once,
 * including T-junctions, overlaps and the spaces around solid architecture. */
function arrangement(areas, holes) {
  const relevant = holes.filter((h) => areas.some((a) => overlaps(a, h)));
  const xs = [...new Set([...areas, ...relevant].flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  const zs = [...new Set([...areas, ...relevant].flatMap((r) => [r.z0, r.z1]))].sort((a, b) => a - b);
  const cells = [],
    occupancy = [];
  for (let zi = 0; zi + 1 < zs.length; zi++) {
    const z = (zs[zi] + zs[zi + 1]) / 2,
      row = [];
    let start = -1;
    for (let xi = 0; xi + 1 < xs.length; xi++) {
      const x = (xs[xi] + xs[xi + 1]) / 2;
      const inside = areas.some((r) => contains(r, x, z)) && !relevant.some((r) => contains(r, x, z));
      row.push(inside);
      if (inside && start < 0) start = xi;
      if (start >= 0 && (!inside || xi === xs.length - 2)) {
        cells.push({ x0: xs[start], x1: xs[inside ? xi + 1 : xi], z0: zs[zi], z1: zs[zi + 1] });
        start = -1;
      }
    }
    occupancy.push(row);
  }
  return { cells, xs, zs, occupancy };
}

function surface(cells, y, uvScale) {
  const positions = [],
    normals = [],
    uvs = [];
  for (const r of cells) {
    // Counter-clockwise from above: the normal points upwards.
    for (const [x, z] of [
      [r.x0, r.z0],
      [r.x0, r.z1],
      [r.x1, r.z1],
      [r.x0, r.z0],
      [r.x1, r.z1],
      [r.x1, r.z0],
    ]) {
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(x * uvScale, z * uvScale);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  geometry.userData.surfaceCells = cells.length;
  return geometry;
}

export function buildRoadSurfaceGeometry(roads = STREET_ROADS, blocks = [], options = {}) {
  const areas = roads.map((r) => rect(r));
  const holes = blocks.map((r) => rect(r, options.clearance ?? 0.03));
  const result = arrangement(areas, holes);
  return surface(result.cells, options.y ?? 0.086, options.uvScale ?? 1 / 9);
}

const OPEN_SPACES = [
  { x: 167, z: -1, w: 104, d: 72 },
  { x: 228, z: 21, w: 36, d: 33 },
  { x: 280, z: 251, w: 78, d: 43 },
  { x: 365, z: 302, w: 102, d: 40 },
  { x: -182, z: -78, w: 79, d: 41 },
  { x: -144, z: 72, w: 33, d: 33 },
  { x: 280, z: 305, w: 33, d: 33 },
  { x: 53.5, z: 53, w: 65, d: 29 },
  { x: 60, z: 82, w: 7, d: 72 },
  { x: 356, z: 291, w: 19, d: 14 },
].map((r) => rect(r));

function nearPaths(x, z, paths, padding = 1) {
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        dx = b.x - a.x,
        dz = b.z - a.z;
      const denominator = dx * dx + dz * dz;
      const t = denominator ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / denominator)) : 0;
      if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < padding) return true;
    }
  }
  return false;
}

function nearWalk(x, z, padding = 1) {
  return nearPaths(x, z, Object.values(CITY_WALKS), padding);
}

function texture(draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

function streetMaterials() {
  // Seeded microtexture avoids a fresh material appearance after every reload.
  let seed = 62719;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  const asphalt = texture((c, n) => {
    c.fillStyle = '#535b5d';
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 76000; i++) {
      const v = 57 + Math.floor(random() * 58);
      c.fillStyle = `rgba(${v},${v + 3},${v + 4},${0.18 + random() * 0.32})`;
      c.fillRect(random() * n, random() * n, 1 + random() * 1.2, 1 + random() * 1.2);
    }
  });
  const paving = texture((c, n) => {
    c.fillStyle = '#969c97';
    c.fillRect(0, 0, n, n);
    for (let z = 0; z < n; z += 64)
      for (let x = 0; x < n; x += 64) {
        const v = 174 + Math.floor(random() * 20);
        c.fillStyle = `rgb(${v + 4},${v + 5},${v})`;
        c.fillRect(x + 1.5, z + 1.5, 61, 61);
        c.fillStyle = 'rgba(255,255,245,.13)';
        c.fillRect(x + 2, z + 2, 60, 1);
      }
    for (let i = 0; i < 12000; i++) {
      c.fillStyle = 'rgba(47,52,48,.065)';
      c.fillRect(random() * n, random() * n, 1, 1);
    }
  });
  return {
    asphalt: new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.96, metalness: 0.015 }),
    paving: new THREE.MeshStandardMaterial({ map: paving, roughness: 0.93 }),
    curb: new THREE.MeshStandardMaterial({ color: '#c6c5b7', roughness: 0.94 }),
    paint: new THREE.MeshStandardMaterial({ color: '#d8d6c6', roughness: 0.93 }),
  };
}

function architecture(world, kit, initialBlocks) {
  const g = world.groups.city,
    blocks = initialBlocks.slice(),
    additions = [];
  const palettes = ['#d5c7ad', '#dfd6bf', '#b9c5c1', '#c8b6a3', '#d7c9b9', '#c0c6b4'];
  const facades = palettes.map(
    (color, i) =>
      new THREE.MeshStandardMaterial({
        map: world.facadeTexture(color, i + 140),
        roughness: 0.91,
      }),
  );
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#5d6262', roughness: 0.86 });
  // Shared low-poly pitched roof, a silhouette change without expensive tiny geometry.
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.5, 0);
  roofShape.lineTo(0.5, 0);
  roofShape.lineTo(0, 1);
  roofShape.closePath();
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false });
  roofGeometry.translate(0, 0, -0.5);
  const staticArchitecture = initialBlocks.map((r) => rect(r, 0.8));
  const roads = STREET_ROADS.map((r) => rect(r, 4.5));
  const interactions = world.zoneData.city.interactions;
  const blocked = (candidate) => {
    const bounds = rect(candidate, 0.35);
    if ([...roads, ...OPEN_SPACES, ...staticArchitecture].some((b) => overlaps(bounds, b))) return true;
    if (additions.some((b) => overlaps(bounds, rect(b, 0.85)))) return true;
    if (interactions.some((p) => contains(rect(candidate, 3.3), p.x, p.z))) return true;
    // Shared pedestrian axes remain wide enough for both the player and companions.
    const points = [
      [candidate.x, candidate.z],
      [bounds.x0, bounds.z0],
      [bounds.x1, bounds.z0],
      [bounds.x0, bounds.z1],
      [bounds.x1, bounds.z1],
    ];
    if (points.some(([x, z]) => nearWalk(x, z, 1.1))) return true;
    return false;
  };
  const add = (r, facing, index) => {
    const h = 17.8 + (index % 4) * 2.35;
    const body = kit.box(g, r.x, h / 2, r.z, r.w, h, r.d, facades[index % facades.length]);
    body.name = 'Münchner Blockrand · ' + index;
    world.obstacle('city', r.x, r.z, r.w, r.d, h / 2, h, body);
    (world.cityBlocks ||= []).push({ ...r });
    kit.box(g, r.x, 0.42, r.z, r.w + 0.08, 0.84, r.d + 0.08, '#98968b');
    kit.box(g, r.x, 3.5, r.z, r.w + 0.18, 0.25, r.d + 0.18, '#d7cebb');
    kit.box(g, r.x, h + 0.1, r.z, r.w + 0.55, 0.28, r.d + 0.55, '#d0c8b6');
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(r.x, h + 0.22, r.z);
    roof.scale.set(r.w + 0.2, 2.8 + (index % 3) * 0.35, r.d + 0.2);
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    kit.box(g, r.x + r.w * 0.22, h + 1.9, r.z + r.d * 0.2, 0.7, 3.8, 0.8, '#9a8977');
    kit.box(g, r.x + r.w * 0.22, h + 3.83, r.z + r.d * 0.2, 0.94, 0.14, 1.04, '#c0b9a8');
    // A grounded street entrance and its lit transom face the street, on the exterior surface.
    const horizontal = facing === 'north' || facing === 'south';
    const sign = facing === 'north' || facing === 'west' ? -1 : 1;
    const dx = horizontal ? 0 : sign * (r.w / 2 + 0.06);
    const dz = horizontal ? sign * (r.d / 2 + 0.06) : 0;
    kit.box(g, r.x + dx, 1.44, r.z + dz, horizontal ? 1.6 : 0.09, 2.88, horizontal ? 0.09 : 1.6, '#36494b');
    kit.box(g, r.x + dx, 2.69, r.z + dz, horizontal ? 1.25 : 0.12, 0.36, horizontal ? 0.12 : 1.25, '#b4b5a0');
    additions.push({ ...r });
    blocks.push({ ...r });
  };
  // Carefully aligned Brienner frontage, without blocking the two public squares opposite.
  for (const r of [
    { x: 132, z: 55, w: 22, d: 12 },
    { x: 160, z: 55, w: 26, d: 12 },
    { x: 189, z: 55, w: 26, d: 12 },
    { x: 220, z: 55, w: 30, d: 12 },
  ]) {
    if (!blocked(r)) add(r, 'north', additions.length);
  }
  // Fill road frontages only where a real parcel is available. Narrow parcels
  // close gaps, while intersections and established entrances stay clear.
  for (const road of STREET_ROADS) {
    if (road.service) continue;
    const horizontal = road.w > road.d;
    const length = horizontal ? road.w : road.d,
      width = horizontal ? road.d : road.w;
    for (const side of [-1, 1])
      for (let t = -length / 2 + 17; t < length / 2 - 11; t += 29) {
        if (additions.length >= 76) break;
        let placed = false;
        for (const depth of [22, 16, 12]) {
          for (const frontage of [26, 20, 13]) {
            if (placed) break;
            const offset = width / 2 + 5.5 + depth / 2;
            const r = {
              x: road.x + (horizontal ? t : side * offset),
              z: road.z + (horizontal ? side * offset : t),
              w: horizontal ? frontage : depth,
              d: horizontal ? depth : frontage,
            };
            if (!blocked(r)) {
              add(
                r,
                horizontal ? (side < 0 ? 'south' : 'north') : side < 0 ? 'east' : 'west',
                additions.length,
              );
              placed = true;
            }
          }
          if (placed) break;
        }
      }
  }
  return { blocks, additions };
}

function curbSegments(grid) {
  const { xs, zs, occupancy } = grid,
    raw = [];
  for (let z = 0; z < occupancy.length; z++)
    for (let x = 0; x < occupancy[z].length; x++) {
      if (!occupancy[z][x]) continue;
      if (!occupancy[z - 1]?.[x]) raw.push({ horizontal: true, at: zs[z], a: xs[x], b: xs[x + 1] });
      if (!occupancy[z + 1]?.[x]) raw.push({ horizontal: true, at: zs[z + 1], a: xs[x], b: xs[x + 1] });
      if (!occupancy[z][x - 1]) raw.push({ horizontal: false, at: xs[x], a: zs[z], b: zs[z + 1] });
      if (!occupancy[z][x + 1]) raw.push({ horizontal: false, at: xs[x + 1], a: zs[z], b: zs[z + 1] });
    }
  raw.sort((a, b) => Number(a.horizontal) - Number(b.horizontal) || a.at - b.at || a.a - b.a);
  const merged = [];
  for (const edge of raw) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.horizontal === edge.horizontal &&
      previous.at === edge.at &&
      Math.abs(previous.b - edge.a) < 0.001
    )
      previous.b = edge.b;
    else merged.push({ ...edge });
  }
  return merged;
}

function avenueTrees(world, kit, blocks) {
  const g = world.groups.city,
    placed = [],
    lamps = [];
  const bboxes = blocks.map((b) => rect(b, 1));
  const pedestrianCircuits = world.zoneData.city.npcs
    .filter((n) => n.route?.length > 1)
    .map((n) => [...n.route, n.route[0]]);
  const existingTrees = world.zoneData.city.physics.bodies
    .filter((b) => {
      const h = b.shapes[0]?.halfExtents;
      return h && h.x <= 0.4 && h.z <= 0.4 && h.y >= 1.3 && b.position.y > 1;
    })
    .map((b) => ({ x: b.position.x, z: b.position.z }));
  const noFurniture = [
    { x: 54, z: 48, w: 69, d: 15 },
    { x: -144, z: 72, w: 33, d: 33 },
    { x: 280, z: 305, w: 33, d: 33 },
    { x: 356, z: 297, w: 25, d: 24 },
    { x: 60, z: 82, w: 7, d: 74 },
  ].map((r) => rect(r));
  const available = (x, z, tree = true) => {
    if (isRoadPoint(x, z, STREET_ROADS, 1.05)) return false;
    if ([...bboxes, ...noFurniture].some((r) => contains(r, x, z))) return false;
    if (nearWalk(x, z, 0.94) || nearPaths(x, z, pedestrianCircuits, 0.9)) return false;
    if (
      world.zoneData.city.interactions.some(
        (p) => Math.hypot(p.x - x, p.z - z) < (p.kind === 'restaurant' ? 4 : 2.5),
      )
    )
      return false;
    if (tree && [...existingTrees, ...placed].some((p) => Math.hypot(p.x - x, p.z - z) < 9.5)) return false;
    if (tree && (world.streetLamps || []).some((p) => Math.hypot(p.x - 0.67 - x, p.z - z) < 2)) return false;
    return true;
  };
  for (const road of STREET_ROADS) {
    if (road.service) continue;
    const horizontal = road.w > road.d;
    const length = horizontal ? road.w : road.d;
    const halfWidth = (horizontal ? road.d : road.w) / 2;
    for (const side of [-1, 1])
      for (let t = -length / 2 + 13; t <= length / 2 - 9; t += 21.5) {
        const x = road.x + (horizontal ? t : side * (halfWidth + 2.6));
        const z = road.z + (horizontal ? side * (halfWidth + 2.6) : t);
        if (!available(x, z)) continue;
        world.tree(g, x, z);
        world.obstacle('city', x, z, 0.55, 0.55, 1.6, 3.2);
        // Flush metal tree grates, kept below the footway instead of floating planters.
        kit.box(g, x, 0.105, z, 1.22, 0.025, 1.22, '#7c8173', false);
        placed.push({ x, z, road: road.id, side });
        if (placed.length % 2 === 0) {
          const lx = x + (horizontal ? 5.2 : 0),
            lz = z + (horizontal ? 0 : 5.2);
          if (
            available(lx, lz, false) &&
            !(world.streetLamps || []).some((p) => Math.hypot(p.x - lx, p.z - lz) < 14)
          ) {
            world.lamp(g, lx, lz);
            lamps.push({ x: lx, z: lz });
          }
        }
      }
  }
  return { trees: placed, lamps };
}

export function buildCityStreets(world, kit) {
  if (world.streetNetwork) return world.streetNetwork;
  const g = world.groups.city;
  const deduplicated = new Map();
  for (const b of [...(world.cityBlocks || []), ...(world.expansionBlocks || [])]) {
    deduplicated.set([b.x, b.z, b.w, b.d].join(','), b);
  }
  const { blocks, additions } = architecture(world, kit, [...deduplicated.values()]);
  const roads = STREET_ROADS.map((r) => rect(r));
  const holes = blocks.map((r) => rect(r, 0.035));
  const grid = arrangement(roads, holes);
  const materials = streetMaterials();
  const roadMesh = new THREE.Mesh(surface(grid.cells, 0.086, 1 / 9), materials.asphalt);
  roadMesh.name = 'Continuous Munich asphalt · no overlapping intersections';
  roadMesh.receiveShadow = true;
  g.add(roadMesh);
  const sidewalks = arrangement(
    STREET_ROADS.map((r) => rect(r, 4.6)),
    [...roads, ...holes, ...CITY_FOOTWAYS.map((r) => rect(r, 0.01))],
  );
  const pavementMesh = new THREE.Mesh(surface(sidewalks.cells, 0.101, 1 / 4), materials.paving);
  pavementMesh.name = 'Continuous granite sidewalks · exterior road edges';
  pavementMesh.receiveShadow = true;
  g.add(pavementMesh);
  const edges = curbSegments(grid);
  for (const e of edges) {
    const length = e.b - e.a;
    if (length < 0.25) continue;
    // Do not stack a kerb into a solid facade where a legacy road ends against a block.
    const x = e.horizontal ? (e.a + e.b) / 2 : e.at;
    const z = e.horizontal ? e.at : (e.a + e.b) / 2;
    if (holes.some((b) => contains(b, x, z))) continue;
    kit.box(
      g,
      x,
      0.097,
      z,
      e.horizontal ? length : 0.16,
      0.055,
      e.horizontal ? 0.16 : length,
      materials.curb,
      false,
    );
  }
  let markings = 0;
  for (const road of STREET_ROADS) {
    if (road.service) continue;
    const horizontal = road.w > road.d;
    const length = horizontal ? road.w : road.d;
    for (let t = -length / 2 + 5; t < length / 2 - 4; t += 9) {
      const x = road.x + (horizontal ? t : 0),
        z = road.z + (horizontal ? 0 : t);
      if (
        STREET_ROADS.some(
          (other) => other !== road && other.w > other.d !== horizontal && contains(rect(other, 3.5), x, z),
        )
      )
        continue;
      const paintRect = { x, z, w: horizontal ? 3.4 : 0.13, d: horizontal ? 0.13 : 3.4 };
      if (holes.some((b) => overlaps(rect(paintRect, 0.1), b))) continue;
      // Overlapping parallel source rectangles have only one owner for road paint.
      if (STREET_ROADS.find((r) => contains(rect(r), x, z)) !== road) continue;
      kit.box(g, x, 0.092, z, paintRect.w, 0.008, paintRect.d, materials.paint, false);
      markings++;
    }
  }
  const greenery = avenueTrees(world, kit, blocks);
  world.streetNetwork = {
    roads: STREET_ROADS,
    frontages: additions,
    trees: greenery.trees,
    lamps: greenery.lamps,
    asphaltCells: grid.cells.length,
    sidewalkCells: sidewalks.cells.length,
    curbSegments: edges.length,
    markings,
    roadMesh,
    pavementMesh,
  };
  return world.streetNetwork;
}
