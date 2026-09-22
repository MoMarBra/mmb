import { dressFacade } from './remaster-architecture.js';
import { remasterMaterial } from './remaster-materials.js';
import * as THREE from 'three';
import { CITY_WALKS, CITY_FOOTWAYS } from './city-layout.js';
import { buildStreetSigns } from './street-signs.js';

// Compact game-space interpretation, not GPS coordinates. The circular Munich
// square is Karolinenplatz; Königsplatz remains a rectangular museum ensemble.
export const KAROLINENPLATZ_RING = Object.freeze({
  id: 'karolinenplatz',
  x: 228,
  z: 17,
  islandRadius: 8.5,
  innerRadius: 9.5,
  outerRadius: 17.5,
  sidewalkRadius: 20,
  segments: 96,
});
export const CIRCULAR_STREETS = Object.freeze([KAROLINENPLATZ_RING]);

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
    { id: 'altstadt-west', x: 249, z: 148.5, w: 12, d: 263 },
    { id: 'karolinen-south', x: 228, z: 36, w: 8, d: 12, service: true },
    { id: 'karolinen-east', x: 245, z: 17, w: 9, d: 8, service: true },
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
  return (
    roads.some((r) => contains(rect(r, margin), x, z)) ||
    (roads === STREET_ROADS &&
      CIRCULAR_STREETS.some((r) => {
        const distance = Math.hypot(x - r.x, z - r.z);
        return distance >= r.innerRadius - margin && distance <= r.outerRadius + margin;
      }))
  );
}

/** A disjoint rectangular arrangement. Each occupied area is emitted once,
 * including T-junctions, overlaps and the spaces around solid architecture. */
function arrangement(areas, holes) {
  const relevant = holes.filter((h) => areas.some((a) => overlaps(a, h)));
  const xs = [...new Set([...areas, ...relevant].flatMap((r) => [r.x0, r.x1]))].sort(
    (a, b) => a - b,
  );
  const zs = [...new Set([...areas, ...relevant].flatMap((r) => [r.z0, r.z1]))].sort(
    (a, b) => a - b,
  );
  const cells = [],
    occupancy = [];
  for (let zi = 0; zi + 1 < zs.length; zi++) {
    const z = (zs[zi] + zs[zi + 1]) / 2,
      row = [];
    let start = -1;
    for (let xi = 0; xi + 1 < xs.length; xi++) {
      const x = (xs[xi] + xs[xi + 1]) / 2;
      const inside =
        areas.some((r) => contains(r, x, z)) && !relevant.some((r) => contains(r, x, z));
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

function polygon(r) {
  return Array.isArray(r)
    ? r
    : [
        [r.x0, r.z0],
        [r.x0, r.z1],
        [r.x1, r.z1],
        [r.x1, r.z0],
      ];
}
function circlePolygon(r, radius) {
  return Array.from({ length: r.segments }, (_, i) => {
    const angle = (i * Math.PI * 2) / r.segments;
    return [r.x + Math.cos(angle) * radius, r.z + Math.sin(angle) * radius];
  });
}
function clipHalfPlane(points, a, b, inside) {
  const distance = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length],
      dp = distance(p),
      dq = distance(q);
    const keepP = inside ? dp >= -1e-9 : dp <= 1e-9;
    const keepQ = inside ? dq >= -1e-9 : dq <= 1e-9;
    if (keepP) result.push(p);
    if (keepP !== keepQ) {
      const t = dp / (dp - dq);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return result;
}
function boundsOf(points) {
  return {
    x0: Math.min(...points.map((p) => p[0])),
    x1: Math.max(...points.map((p) => p[0])),
    z0: Math.min(...points.map((p) => p[1])),
    z1: Math.max(...points.map((p) => p[1])),
  };
}
function subtractConvex(cells, hole) {
  const result = [],
    bounds = boundsOf(hole);
  for (const cell of cells) {
    let pending = polygon(cell);
    if (!overlaps(boundsOf(pending), bounds)) {
      result.push(pending);
      continue;
    }
    for (let i = 0; i < hole.length && pending.length >= 3; i++) {
      const a = hole[i],
        b = hole[(i + 1) % hole.length];
      const outside = clipHalfPlane(pending, a, b, false);
      if (outside.length >= 3) result.push(outside);
      pending = clipHalfPlane(pending, a, b, true);
    }
  }
  return result;
}
function subtractRects(cells, holes) {
  for (const r of holes)
    cells = subtractConvex(cells, [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ]);
  return cells;
}
function annulus(r, inner, outer) {
  const a = circlePolygon(r, inner),
    b = circlePolygon(r, outer);
  return a.map((p, i) => [p, b[i], b[(i + 1) % a.length], a[(i + 1) % a.length]]);
}
function withRings(cells, holes, outerProperty = 'outerRadius', roads = []) {
  for (const ring of CIRCULAR_STREETS) {
    const outer = ring[outerProperty];
    cells = subtractConvex(cells, circlePolygon(ring, outer));
    const inner = outerProperty === 'outerRadius' ? ring.innerRadius : ring.outerRadius;
    const strip = subtractRects(annulus(ring, inner, outer), [...holes, ...roads]);
    cells.push(...strip);
  }
  return cells;
}
function outsideRoundaboutEdges(edges) {
  let result = edges;
  for (const r of CIRCULAR_STREETS) {
    result = result.flatMap((edge) => {
      const offset = edge.at - (edge.horizontal ? r.z : r.x);
      if (Math.abs(offset) >= r.outerRadius + 0.05) return [edge];
      const span = Math.sqrt((r.outerRadius + 0.05) ** 2 - offset ** 2);
      const center = edge.horizontal ? r.x : r.z,
        lo = center - span,
        hi = center + span;
      if (edge.b <= lo || edge.a >= hi) return [edge];
      return [
        { ...edge, b: Math.min(edge.b, lo) },
        { ...edge, a: Math.max(edge.a, hi) },
      ].filter((e) => e.b - e.a > 0.08);
    });
  }
  return result;
}

function surface(cells, y, uvScale) {
  const positions = [],
    normals = [],
    uvs = [];
  for (const cell of cells) {
    let points = polygon(cell);
    let winding = 0;
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      winding += a[0] * b[1] - b[0] * a[1];
    });
    if (winding > 0) points = points.slice().reverse();
    for (let i = 1; i + 1 < points.length; i++) {
      const a = points[0],
        b = points[i],
        c = points[i + 1];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-8) continue;
      for (const [x, z] of [a, b, c]) {
        positions.push(x, y, z);
        normals.push(0, 1, 0);
        uvs.push(x * uvScale, z * uvScale);
      }
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
  const cells = roads === STREET_ROADS ? withRings(result.cells, holes) : result.cells;
  return surface(cells, options.y ?? 0.086, options.uvScale ?? 1 / 9);
}

const OPEN_SPACES = [
  { x: 167, z: -1, w: 104, d: 72 },
  { x: 228, z: 17, w: 44, d: 44 },
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
      const t = denominator
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / denominator))
        : 0;
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
  return {
    asphalt: remasterMaterial('asphalt'),
    paving: remasterMaterial('pavement'),
    curb: remasterMaterial('stone', { color: '#c6c5bf' }),
    paint: new THREE.MeshStandardMaterial({ color: '#e1ded1', roughness: 0.94 }),
  };
}

function architecture(world, kit, initialBlocks) {
  const g = world.groups.city,
    blocks = initialBlocks.slice(),
    additions = [];
  const palettes = ['#d5c7ad', '#dfd6bf', '#b9c5c1', '#c8b6a3', '#d7c9b9', '#c0c6b4'];
  const facades = palettes.map((color) => remasterMaterial('plaster', { color }));
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
    if ([...roads, ...OPEN_SPACES, ...staticArchitecture].some((b) => overlaps(bounds, b)))
      return true;
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
    const museum = r.x === 189 && r.z === 55;
    const h = museum ? 13.6 : 17.8 + (index % 4) * 2.35;
    const body = kit.box(
      g,
      r.x,
      h / 2,
      r.z,
      r.w,
      h,
      r.d,
      museum
        ? new THREE.MeshStandardMaterial({ color: '#d5c7aa', roughness: 0.91 })
        : facades[index % facades.length],
    );
    if (!museum)
      dressFacade(g, {
        x: r.x,
        z: r.z,
        w: r.w,
        d: r.d,
        h,
        color: palettes[index % palettes.length],
        seed: index,
        body,
      });
    else body.material = remasterMaterial('stone', { color: '#e6dfcf' });
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
    kit.box(
      g,
      r.x + dx,
      1.44,
      r.z + dz,
      horizontal ? 1.6 : 0.09,
      2.88,
      horizontal ? 0.09 : 1.6,
      '#36494b',
    );
    kit.box(
      g,
      r.x + dx,
      2.69,
      r.z + dz,
      horizontal ? 1.25 : 0.12,
      0.36,
      horizontal ? 0.12 : 1.25,
      '#b4b5a0',
    );
    if (museum) {
      // South-facing museum counterpart to the Glyptothek across Königsplatz.
      const stone = new THREE.MeshStandardMaterial({ color: '#dcd0b8', roughness: 0.86 });
      const columnGeometry = new THREE.CylinderGeometry(0.32, 0.42, 9.1, 16);
      for (const dx of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
        const column = new THREE.Mesh(columnGeometry, stone);
        column.position.set(r.x + dx, 5.15, 47.85);
        column.castShadow = column.receiveShadow = true;
        g.add(column);
        world.obstacle('city', r.x + dx, 47.85, 0.84, 0.84, 5.15, 9.1, column);
        kit.box(g, r.x + dx, 9.8, 47.85, 1, 0.3, 1, stone);
      }
      kit.box(g, r.x, 10.65, 48.4, 25, 1.25, 2.7, stone);
      const shape = new THREE.Shape();
      shape.moveTo(-12.5, 0);
      shape.lineTo(12.5, 0);
      shape.lineTo(0, 4.3);
      shape.closePath();
      const pediment = new THREE.Mesh(new THREE.ShapeGeometry(shape), stone);
      pediment.position.set(r.x, 11.3, 47.04);
      pediment.rotation.y = Math.PI;
      pediment.castShadow = true;
      g.add(pediment);
      (world.urbanLandmarks ||= []).push({
        id: 'antikensammlungen',
        x: r.x,
        z: r.z,
        w: r.w,
        d: r.d,
        name: 'Staatliche Antikensammlungen',
      });
    }
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
  for (const phase of [0, 14.5])
    for (const road of STREET_ROADS) {
      if (road.service) continue;
      const horizontal = road.w > road.d;
      const length = horizontal ? road.w : road.d,
        width = horizontal ? road.d : road.w;
      for (const side of [-1, 1])
        for (let t = -length / 2 + 17 + phase; t < length / 2 - 11; t += 29) {
          if (additions.length >= 62) break;
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
      if (!occupancy[z + 1]?.[x])
        raw.push({ horizontal: true, at: zs[z + 1], a: xs[x], b: xs[x + 1] });
      if (!occupancy[z][x - 1]) raw.push({ horizontal: false, at: xs[x], a: zs[z], b: zs[z + 1] });
      if (!occupancy[z][x + 1])
        raw.push({ horizontal: false, at: xs[x + 1], a: zs[z], b: zs[z + 1] });
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
  // Short signposts no longer pass the tall-trunk collider heuristic. Reserve
  // every authored sign explicitly so tree crowns cannot hide its lettering.
  existingTrees.push(...(world.streetSigns || []).map(({ x, z }) => ({ x, z })));
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
    if (tree && [...existingTrees, ...placed].some((p) => Math.hypot(p.x - x, p.z - z) < 9.5))
      return false;
    if (tree && (world.streetLamps || []).some((p) => Math.hypot(p.x - 0.67 - x, p.z - z) < 2))
      return false;
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
  const carriagewayCells = withRings(grid.cells, holes);
  const roadMesh = new THREE.Mesh(surface(carriagewayCells, 0.086, 1), materials.asphalt);
  roadMesh.name = 'Continuous Munich asphalt · no overlapping intersections';
  roadMesh.receiveShadow = true;
  g.add(roadMesh);
  const sidewalks = arrangement(
    STREET_ROADS.map((r) => rect(r, 4.6)),
    [...roads, ...holes, ...CITY_FOOTWAYS.map((r) => rect(r, 0.01))],
  );
  const pavementCells = withRings(
    sidewalks.cells,
    [...holes, ...CITY_FOOTWAYS.map((r) => rect(r, 0.01))],
    'sidewalkRadius',
    roads,
  );
  const pavementMesh = new THREE.Mesh(surface(pavementCells, 0.101, 1), materials.paving);
  pavementMesh.name = 'Continuous granite sidewalks · exterior road edges';
  pavementMesh.receiveShadow = true;
  g.add(pavementMesh);
  const edges = outsideRoundaboutEdges(curbSegments(grid));
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
          (other) =>
            other !== road && other.w > other.d !== horizontal && contains(rect(other, 3.5), x, z),
        )
      )
        continue;
      if (CIRCULAR_STREETS.some((r) => Math.hypot(x - r.x, z - r.z) < r.outerRadius + 2)) continue;
      const paintRect = { x, z, w: horizontal ? 3.4 : 0.13, d: horizontal ? 0.13 : 3.4 };
      if (holes.some((b) => overlaps(rect(paintRect, 0.1), b))) continue;
      // Overlapping parallel source rectangles have only one owner for road paint.
      if (STREET_ROADS.find((r) => contains(rect(r), x, z)) !== road) continue;
      kit.box(g, x, 0.092, z, paintRect.w, 0.008, paintRect.d, materials.paint, false);
      markings++;
    }
  }
  for (const ring of CIRCULAR_STREETS) {
    const outerKerb = subtractRects(
      annulus(ring, ring.outerRadius - 0.08, ring.outerRadius + 0.13),
      STREET_ROADS.map((r) => rect(r, 0.16)),
    );
    const innerKerb = annulus(ring, ring.innerRadius - 0.12, ring.innerRadius + 0.1);
    const kerbMesh = new THREE.Mesh(
      surface([...outerKerb, ...innerKerb], 0.118, 1),
      materials.curb,
    );
    kerbMesh.receiveShadow = true;
    kerbMesh.name = 'Karolinenplatz · rounded kerbs';
    g.add(kerbMesh);
  }
  buildStreetSigns(world);
  const greenery = avenueTrees(world, kit, blocks);
  world.streetNetwork = {
    roads: STREET_ROADS,
    rings: CIRCULAR_STREETS,
    frontages: additions,
    trees: greenery.trees,
    lamps: greenery.lamps,
    asphaltCells: carriagewayCells.length,
    sidewalkCells: pavementCells.length,
    curbSegments: edges.length,
    markings,
    roadMesh,
    pavementMesh,
  };
  return world.streetNetwork;
}
