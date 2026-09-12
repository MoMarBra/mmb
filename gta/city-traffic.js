import { KAROLINENPLATZ_RING } from './city-streets.js';
import { signalStage } from './street-signs.js';
// Lane-centred, closed traffic circuits. All coordinates are game-space metres.
// This controller owns only ambient traffic: parked, story and player cars retain
// their existing state and physics. No runtime recycling happens in the camera.
const TAU = Math.PI * 2;
const mod = (n, d) => ((n % d) + d) % d;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const COLORS = ['#526771', '#c8c8bd', '#354b50', '#acb8b5', '#765447', '#d0bd88'];
const JUNCTIONS = [
  { x: 0, z: -43, signals: true },
  { x: 0, z: 40, signals: true },
  { x: 0, z: 117 },
  { x: -144, z: -43 },
  { x: -144, z: 40 },
  { x: -180, z: -43 },
  { x: 249, z: 40 },
  { x: 249, z: 117 },
  { x: 249, z: 280 },
  { x: 410, z: 117 },
  { x: 410, z: 280 },
];

function circuit(id, points, limit = 8) {
  const clean = points.map((p) => ({ x: p[0] ?? p.x, z: p[1] ?? p.z }));
  const segments = [];
  let length = 0;
  clean.forEach((a, i) => {
    const b = clean[(i + 1) % clean.length],
      size = distance(a, b);
    if (size < 0.001) return;
    segments.push({ a, b, start: length, size, dx: (b.x - a.x) / size, dz: (b.z - a.z) / size });
    length += size;
  });
  return { id, points: clean, segments, length, limit };
}

function rounded(id, corners, radius = 5, limit = 8) {
  const out = [];
  corners.forEach((p, i) => {
    const a = corners[mod(i - 1, corners.length)],
      b = corners[(i + 1) % corners.length];
    const before = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const after = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(radius, before * 0.45, after * 0.45);
    const from = [p[0] + ((a[0] - p[0]) * r) / before, p[1] + ((a[1] - p[1]) * r) / before];
    const to = [p[0] + ((b[0] - p[0]) * r) / after, p[1] + ((b[1] - p[1]) * r) / after];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12,
        u = 1 - t;
      out.push([
        u * u * from[0] + 2 * u * t * p[0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * p[1] + t * t * to[1],
      ]);
    }
  });
  return circuit(id, out, limit);
}

function capsule(id, horizontal, from, to, center, lane, limit) {
  const out = [];
  // Sixteen samples per semicircle give continuous, restrained low-speed turns.
  for (let i = 0; i <= 16; i++) {
    const a = (i * Math.PI) / 16;
    out.push(
      horizontal
        ? [to + Math.sin(a) * lane, center + Math.cos(a) * lane]
        : [center - Math.cos(a) * lane, to + Math.sin(a) * lane],
    );
  }
  for (let i = 0; i <= 16; i++) {
    const a = (i * Math.PI) / 16;
    out.push(
      horizontal
        ? [from - Math.sin(a) * lane, center - Math.cos(a) * lane]
        : [center + Math.cos(a) * lane, from - Math.sin(a) * lane],
    );
  }
  return circuit(id, out, limit);
}

export const CITY_TRAFFIC_ROUTES = [
  capsule('augusten', false, -162, 127, 0, 4.1, 8.2),
  rounded(
    'altstadt-inner',
    [
      [252.5, 120.5],
      [406.5, 120.5],
      [406.5, 226],
      [408.2, 238],
      [408.2, 271],
      [406.5, 276.5],
      [252.5, 276.5],
    ],
    3.2,
    8.5,
  ),
  rounded(
    'altstadt-outer',
    [
      [245.5, 113.5],
      [245.5, 283.5],
      [413.5, 283.5],
      [413.5, 113.5],
    ],
    7,
    8.5,
  ),
  rounded(
    'maxvorstadt-inner',
    [
      [-140.5, -39.5],
      [-4.1, -39.5],
      [-4.1, 37.8],
      [-140.5, 37.8],
    ],
    3.2,
    7.4,
  ),
  rounded(
    'maxvorstadt-outer',
    [
      [-147.5, 42.2],
      [4.1, 42.2],
      [4.1, -46.5],
      [-147.5, -46.5],
    ],
    6.6,
    7.4,
  ),
  rounded(
    'museen-altstadt',
    [
      [-140.5, 37.8],
      [-140.5, -39.5],
      [-4.1, -39.5],
      [-4.1, 42.2],
      [245.5, 42.2],
      [245.5, 283.5],
      [413.5, 283.5],
      [413.5, 113.5],
      [252.5, 113.5],
      [252.5, 37.8],
    ],
    3.15,
    9,
  ),
  rounded(
    'st-benno',
    [
      [-151, -46.5],
      [-176.5, -46.5],
      [-176.5, -70],
      [-183.5, -70],
      [-183.5, -39.5],
      [-151, -39.5],
    ],
    3.35,
    5.6,
  ),
  capsule('gabelsberger-west', true, -126, -18, -43, 3.35, 7.5),
  // Existing blocks at x±38,z110 close the southern cross street.
  // Local circuits serve the open ends without crossing those buildings.
  capsule('suedviertel-ost', true, 70, 133, 117, 3.35, 6.3),
  capsule('suedviertel-west', true, -133, -70, 117, 3.35, 6.3),
  circuit(
    'karolinenplatz',
    Array.from({ length: 96 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 96,
        r = KAROLINENPLATZ_RING;
      return [r.x + Math.sin(angle) * 13.5, r.z + Math.cos(angle) * 13.5];
    }),
    5,
  ),
];

export function sampleTrafficRoute(route, along) {
  const s = mod(along, route.length);
  let lo = 0,
    hi = route.segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (route.segments[mid].start <= s) lo = mid;
    else hi = mid - 1;
  }
  const seg = route.segments[lo],
    t = clamp((s - seg.start) / seg.size, 0, 1);
  return {
    x: lerp(seg.a.x, seg.b.x, t),
    z: lerp(seg.a.z, seg.b.z, t),
    dx: seg.dx,
    dz: seg.dz,
    index: lo,
  };
}

function project(route, point, heading = null) {
  let best = null;
  for (const seg of route.segments) {
    const t = clamp(((point.x - seg.a.x) * seg.dx + (point.z - seg.a.z) * seg.dz) / seg.size, 0, 1);
    const x = seg.a.x + seg.dx * seg.size * t,
      z = seg.a.z + seg.dz * seg.size * t;
    const score =
      Math.hypot(point.x - x, point.z - z) +
      (heading === null ? 0 : (1 - Math.cos(Math.atan2(seg.dx, seg.dz) - heading)) * 15);
    if (!best || score < best.score) best = { s: seg.start + seg.size * t, score };
  }
  return best.s;
}

function footprint(car, p = car.mesh.position, angle = car.mesh.rotation.y) {
  return {
    x: p.x,
    z: p.z,
    angle,
    w: car.width || (car.type === 'bus' ? 2.5 : 1.9),
    l: car.length || (car.type === 'bus' ? 8.5 : car.type === 'van' ? 5.3 : 4.4),
  };
}

export function trafficFootprintsOverlap(a, b, padding = 0) {
  for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
    const x = Math.cos(angle),
      z = -Math.sin(angle);
    const extent = (r) =>
      (Math.abs(x * Math.cos(r.angle) - z * Math.sin(r.angle)) * r.w +
        Math.abs(x * Math.sin(r.angle) + z * Math.cos(r.angle)) * r.l) *
      0.5;
    if (Math.abs((a.x - b.x) * x + (a.z - b.z) * z) > extent(a) + extent(b) + padding) return false;
  }
  return true;
}

function rebuildSolids(world, state) {
  const carBodies = new Set(world.cars.map((c) => c.body).filter(Boolean));
  state.solids = [];
  state.cells = new Map();
  for (const body of world.zoneData.city.physics.bodies) {
    const e = body.shapes?.[0]?.halfExtents;
    if (
      !e ||
      body.mass !== 0 ||
      carBodies.has(body) ||
      body.collisionResponse === false ||
      body.position.y + e.y < 0.13 ||
      body.position.y - e.y > 1.9
    )
      continue;
    const solid = {
      x: body.position.x,
      z: body.position.z,
      w: e.x * 2,
      l: e.z * 2,
      angle: 2 * Math.atan2(body.quaternion?.y || 0, body.quaternion?.w ?? 1),
    };
    state.solids.push(solid);
    const reach = Math.hypot(e.x, e.z);
    for (let x = Math.floor((solid.x - reach) / 24); x <= Math.floor((solid.x + reach) / 24); x++)
      for (let z = Math.floor((solid.z - reach) / 24); z <= Math.floor((solid.z + reach) / 24); z++) {
        const key = `${x},${z}`;
        if (!state.cells.has(key)) state.cells.set(key, []);
        state.cells.get(key).push(solid);
      }
  }
  state.solidRefresh = state.time + 4;
}

function solidAt(state, rect) {
  const seen = new Set(),
    reach = Math.hypot(rect.w, rect.l) / 2;
  for (let x = Math.floor((rect.x - reach) / 24); x <= Math.floor((rect.x + reach) / 24); x++)
    for (let z = Math.floor((rect.z - reach) / 24); z <= Math.floor((rect.z + reach) / 24); z++)
      for (const b of state.cells.get(`${x},${z}`) || []) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (trafficFootprintsOverlap(rect, b, 0.08)) return true;
      }
  return false;
}

function clearSpawn(world, state, car, route, s) {
  const p = sampleTrafficRoute(route, s),
    rect = footprint(car, p, Math.atan2(p.dx, p.dz));
  if (solidAt(state, rect)) return false;
  return !world.cars.some(
    (other) =>
      other !== car &&
      other.mesh.position.y < 3 &&
      distance(p, other.mesh.position) < (rect.l + footprint(other).l) * 0.5 + 6,
  );
}

function assign(world, state, car, route, preferred = null) {
  const initial = preferred === null ? project(route, car.mesh.position, car.mesh.rotation.y) : preferred;
  let s = initial;
  for (let i = 0; i < Math.ceil(route.length / 7); i++) {
    const candidate = mod(initial + i * 7, route.length);
    if (clearSpawn(world, state, car, route, candidate)) {
      s = candidate;
      break;
    }
  }
  const p = sampleTrafficRoute(route, s);
  car.mesh.position.set(p.x, 0, p.z);
  car.mesh.rotation.y = Math.atan2(p.dx, p.dz);
  car.mesh.userData.dynamic = true;
  car.route = route.points;
  car.routeIndex = p.index;
  car.speed = 0;
  car.traffic = { route, s, blocked: 0, waitSince: 0, junction: null, moving: 0 };
  state.cars.push(car);
}

export function installCityTraffic(world) {
  if (world.cityTraffic) return world.cityTraffic;
  const state = {
    cars: [],
    time: 0,
    solids: [],
    cells: new Map(),
    solidRefresh: 0,
    reservations: new Map(),
    recoveries: 0,
  };
  world.cityTraffic = state;
  rebuildSolids(world, state);
  const existing = world.cars.filter(
    (c) => !c.parked && !c.controlled && !['bike', 'helicopter', 'police'].includes(c.type),
  );
  const avenue = existing.filter((c) => !c.route);
  avenue.forEach((car, i) =>
    assign(
      world,
      state,
      car,
      i === avenue.length - 1
        ? CITY_TRAFFIC_ROUTES.find((r) => r.id === 'karolinenplatz')
        : CITY_TRAFFIC_ROUTES[0],
    ),
  );
  existing
    .filter((c) => c.route && !c.traffic)
    .forEach((car, i) => {
      const route = CITY_TRAFFIC_ROUTES[1 + (i % 2)];
      assign(world, state, car, route, route.length * (0.1 + Math.floor(i / 2) * 0.5));
    });
  const additions = [
    [3, 0.28, 'car'],
    [4, 0.34, 'van'],
    [5, project(CITY_TRAFFIC_ROUTES[5], { x: 127, z: 42.2 }), 'car', true],
    [5, project(CITY_TRAFFIC_ROUTES[5], { x: 174, z: 37.8 }), 'taxi', true],
    [6, 0.35, 'car'],
    [7, 0.24, 'taxi'],
    [8, 0.66, 'car'],
    [9, 0.4, 'car'],
  ];
  for (const [r, along, type, absolute] of additions) {
    if (state.cars.length >= 24) break;
    const route = CITY_TRAFFIC_ROUTES[r];
    const car = {
      mesh: world.car(world.groups.city, type, COLORS[state.cars.length % COLORS.length]),
      type,
      speed: 0,
      max: route.limit,
      health: 100,
    };
    world.cars.push(car);
    assign(world, state, car, route, absolute ? along : along * route.length);
  }
  return state;
}

function redFor(p, junction, phase) {
  if (!junction.signals) return false;
  const vertical = Math.abs(p.dz) > Math.abs(p.dx);
  return signalStage(vertical ? 'vertical' : 'horizontal', phase) !== 2;
}

function junctionAhead(p) {
  let best = null;
  for (let i = 0; i < JUNCTIONS.length; i++) {
    const j = JUNCTIONS[i],
      x = j.x - p.x,
      z = j.z - p.z;
    const ahead = x * p.dx + z * p.dz,
      lateral = Math.abs(x * p.dz - z * p.dx);
    if (ahead > 2 && ahead < 25 && lateral < 8 && (!best || ahead < best.ahead))
      best = { ...j, id: i, ahead };
  }
  return best;
}

function trafficLimit(world, state, car, p, phase) {
  const own = footprint(car),
    route = car.traffic.route;
  const next = sampleTrafficRoute(route, car.traffic.s + 4);
  const bend = Math.abs(Math.atan2(p.dx * next.dz - p.dz * next.dx, p.dx * next.dx + p.dz * next.dz));
  let limit =
    Math.min(car.max || route.limit, route.limit) * (bend > 0.11 ? clamp(1 - bend * 0.8, 0.24, 0.78) : 1);
  const corridor = (q, radius, length = 0) => {
    const x = q.x - p.x,
      z = q.z - p.z;
    const ahead = x * p.dx + z * p.dz,
      lateral = Math.abs(x * p.dz - z * p.dx);
    if (ahead <= -0.3 || lateral >= own.w * 0.5 + radius + 0.25) return;
    const gap = ahead - own.l * 0.5 - length * 0.5 - 1.4;
    if (gap < 23) limit = Math.min(limit, Math.max(0, gap * 0.7));
  };
  for (const other of world.cars) {
    if (
      other === car ||
      other.mesh.position.y > 3 ||
      (other.type === 'helicopter' && other.mesh.position.y > 1)
    )
      continue;
    const f = footprint(other);
    corridor(other.mesh.position, f.w * 0.5, f.l);
  }
  const player = world.zoneData.city.body?.position || world.player.position;
  if (player.y < 2.4 && !world.gameplay?.vehicle) corridor(player, 0.55, 0.5);
  for (const n of world.zoneData.city.npcs || [])
    if (!n.down && n.mesh.visible && n.mesh.position.y < 2.4)
      corridor(n.mesh.position, n.cycle ? 0.7 : 0.45, 0.6);
  const junction = junctionAhead(p);
  car.traffic.junction = junction;
  if (junction) {
    const reservation = state.reservations.get(junction.id);
    const red = redFor(p, junction, phase);
    const committed = reservation?.car === car && junction.ahead < own.l * 0.5 + 6;
    if (!committed && (red || reservation?.car !== car)) {
      const gap = junction.ahead - own.l * 0.5 - 6;
      limit = Math.min(limit, Math.max(0, gap * 0.7));
    }
  }
  // A physical obstacle is never ignored, even if a route is obstructed by a
  // dropped prop, a newly parked car, or a later level edit.
  for (const ahead of [0.4, 2.5, 5, 9]) {
    const q = sampleTrafficRoute(route, car.traffic.s + ahead);
    if (solidAt(state, footprint(car, q, Math.atan2(q.dx, q.dz)))) {
      limit = Math.min(limit, Math.max(0, (ahead - 1) * 0.6));
      break;
    }
  }
  return limit;
}

function reserveJunctions(world, state, phase) {
  for (const [id, r] of state.reservations) {
    const car = r.car,
      j = JUNCTIONS[id];
    if (car.controlled || car.parked || distance(car.mesh.position, j) > 19 || state.time - r.since > 18)
      state.reservations.delete(id);
  }
  const candidates = state.cars
    .filter((c) => !c.controlled && !c.parked)
    .map((car) => {
      const p = sampleTrafficRoute(car.traffic.route, car.traffic.s),
        j = junctionAhead(p);
      if (!j || j.ahead > 21 || redFor(p, j, phase)) return null;
      return { car, j, wait: car.traffic.waitSince || state.time };
    })
    .filter(Boolean)
    .sort((a, b) => a.wait - b.wait || a.j.ahead - b.j.ahead);
  for (const { car, j } of candidates) {
    if (state.reservations.has(j.id)) continue;
    const occupied = world.cars.some(
      (other) => other !== car && other.mesh.position.y < 3 && distance(other.mesh.position, j) < 8,
    );
    if (!occupied) state.reservations.set(j.id, { car, since: state.time });
  }
}

function safelyRecover(world, state, car) {
  const t = car.traffic,
    p = car.mesh.position,
    camera = world.camera;
  if (t.blocked < 38 || distance(p, world.player.position) < 100 || distance(p, camera.position) < 110)
    return;
  // Frustum membership plus distance is deliberately conservative: when the
  // camera is looking down a long street, a queued car never visibly vanishes.
  const visible = world.visibilityFrustum?.containsPoint?.(p);
  if (visible !== false) return;
  for (let ahead = 45; ahead < Math.min(t.route.length * 0.5, 200); ahead += 15) {
    const s = t.s + ahead,
      q = sampleTrafficRoute(t.route, s);
    const point = p.clone();
    point.set(q.x, p.y, q.z);
    if (
      distance(q, world.player.position) < 110 ||
      distance(q, camera.position) < 110 ||
      world.visibilityFrustum.containsPoint(point)
    )
      continue;
    if (!clearSpawn(world, state, car, t.route, s)) continue;
    t.s = mod(s, t.route.length);
    t.blocked = 0;
    t.waitSince = 0;
    car.speed = 0;
    car.mesh.position.set(q.x, 0, q.z);
    car.mesh.rotation.y = Math.atan2(q.dx, q.dz);
    state.recoveries++;
    for (const [id, r] of state.reservations) if (r.car === car) state.reservations.delete(id);
    return;
  }
}

export function updateCityTraffic(world, dt, phase = world.time % 16) {
  const state = world.cityTraffic || installCityTraffic(world);
  if (world.zone !== 'city' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.08);
  state.time += dt;
  if (state.time >= state.solidRefresh) rebuildSolids(world, state);
  reserveJunctions(world, state, mod(phase, 16));
  for (const car of state.cars) {
    if (car.controlled || car.parked) continue;
    const t = car.traffic,
      p = sampleTrafficRoute(t.route, t.s);
    const limit = trafficLimit(world, state, car, p, mod(phase, 16));
    const acceleration = limit < car.speed ? 6.5 : 1.65;
    car.speed += clamp(limit - car.speed, -acceleration * dt, acceleration * dt);
    if (limit < 0.05) car.speed = Math.max(0, car.speed - 12 * dt);
    const travel = Math.max(0, car.speed * dt),
      nextS = t.s + travel;
    const next = sampleTrafficRoute(t.route, nextS);
    const angle = Math.atan2(next.dx, next.dz);
    const nextFootprint = footprint(car, next, angle);
    const blockedByCar = world.cars.some(
      (other) =>
        other !== car &&
        other.mesh.position.y < 3 &&
        trafficFootprintsOverlap(nextFootprint, footprint(other), 0.2),
    );
    if (blockedByCar || solidAt(state, nextFootprint)) car.speed = 0;
    else {
      t.s = mod(nextS, t.route.length);
      car.mesh.position.set(next.x, 0, next.z);
      const near = sampleTrafficRoute(t.route, t.s - 0.35),
        far = sampleTrafficRoute(t.route, t.s + 0.35);
      car.mesh.rotation.y = Math.atan2(far.x - near.x, far.z - near.z);
      for (const wheel of car.mesh.userData.wheels || [])
        wheel.rotation[wheel.userData.axis || 'y'] +=
          travel / (wheel.userData.radius || (car.type === 'bus' ? 0.4 : 0.32));
      car.routeIndex = next.index;
      t.moving += travel;
    }
    if (car.speed < 0.15) {
      t.blocked += dt;
      t.waitSince ||= state.time;
    } else {
      t.blocked = 0;
      t.waitSince = 0;
    }
    safelyRecover(world, state, car);
  }
}
