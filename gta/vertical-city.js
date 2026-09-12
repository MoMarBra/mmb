import { CITY_LAYOUT } from './city-layout.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const ROOF_ROUTE = [
  { x: CITY_LAYOUT.hqBuilding.x, z: CITY_LAYOUT.hqBuilding.z, w: 36, d: 21, y: 19.85 },
  { x: 38, z: 70, w: 41, d: 17, y: 21.85 },
  { x: 38, z: 90, w: 41, d: 17, y: 18.85 },
  { x: 38, z: 110, w: 41, d: 17, y: 15.85 },
];
export const COURIER_DESTINATION = { x: 36, y: 15.85, z: 110 };
export function buildVerticalCity(w, h) {
  const { box, cylinder, label, material } = h,
    g = w.groups.city;
  w.walkRoutes = [];
  w.cityDoors = [];
  const solid = (x, y, z, sx, sy, sz, color) => {
    const m = box(g, x, y, z, sx, sy, sz, color);
    const body = w.obstacle('city', x, z, sx, sz, y, sy, m);
    if (sy < 0.3) body.walkSurface = true;
    return m;
  };
  for (const roof of ROOF_ROUTE) {
    const floor = solid(roof.x, roof.y - 0.06, roof.z, roof.w, 0.12, roof.d, '#8b9291');
    floor.material = floor.material.clone();
    floor.material.polygonOffset = true;
    floor.material.polygonOffsetFactor = -3;
    floor.material.polygonOffsetUnits = -3;
    for (const x of [roof.x - roof.w / 2 + 0.3, roof.x + roof.w / 2 - 0.3]) {
      solid(x, roof.y + 0.48, roof.z, 0.17, 0.96, roof.d, '#a3afa9');
    }
    // Keep the fire-ladder approach clear after recessing the ground-floor entrance.
    const equipmentZ = roof.z - (roof === ROOF_ROUTE[0] ? 6 : 3);
    for (const x of [roof.x - 9, roof.x + 9]) {
      solid(x, roof.y + 0.55, equipmentZ, 2.5, 1.1, 1.7, '#72828a');
      for (let i = -4; i <= 4; i++)
        box(g, x + i * 0.24, roof.y + 1.13, equipmentZ, 0.08, 0.05, 1.6, '#354952');
    }
  }
  const ladder = (x, z, fromY, toY, toX, toZ, id) => {
    for (const xx of [x - 0.36, x + 0.36])
      cylinder(g, xx, (fromY + toY) / 2, z, 0.037, toY - fromY + 0.9, '#b6bdb7');
    for (let y = fromY + 0.3; y < toY + 0.5; y += 0.34)
      box(g, x, y, z, 0.8, 0.045, 0.05, '#b5c0bc');
    const a = { x, y: fromY, z: z + 1 },
      b = { x: toX, y: toY, z: toZ };
    for (const [suffix, from, to] of [
      ['up', a, b],
      ['down', b, a],
    ])
      w.interact(
        'city',
        id + suffix,
        suffix === 'up' ? 'Feuerleiter hochklettern' : 'Feuerleiter hinunterklettern',
        from.x,
        from.z,
        {
          kind: 'traverse',
          radius: 1.8,
          y: from.y + 1.6,
          data: { from, to, type: 'ladder', duration: Math.max(2, (toY - fromY) / 2.6) },
        },
      );
    w.walkRoutes.push({ from: a, to: b, id });
  };
  ladder(60, 53, 0, 19.85, 56.5, 53, 'bbe-roof-');
  ladder(60, 108, 0, 15.85, 56, 108, 'client-roof-');
  // A real staircase raises the player between overlapping BBE and adjacent roofs.
  w.stairs = [];
  for (let i = 0; i < 12; i++) {
    const y = 19.85 + (i + 1) / 6,
      z = 57 + i * 0.45;
    solid(45, y - 0.13, z, 2.7, 0.26, 0.49, '#c0c5bb');
  }
  w.stairs.push({ x: 45, z0: 56.7, z1: 62.3, w: 2.7, y0: 19.85, y1: 21.85 });
  for (const [a, b] of [
    [ROOF_ROUTE[1], ROOF_ROUTE[2]],
    [ROOF_ROUTE[2], ROOF_ROUTE[3]],
  ]) {
    const z0 = a.z + a.d / 2 - 1,
      z1 = b.z - b.d / 2 + 1,
      dz = z1 - z0,
      dy = b.y - a.y,
      len = Math.hypot(dz, dy),
      angle = -Math.atan2(dy, dz),
      mid = (a.y + b.y) / 2;
    const m = box(g, 45, mid - 0.08, (z0 + z1) / 2, 2.8, 0.18, len, '#8b9b9c');
    m.rotation.x = angle;
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(1.4, 0.09, len / 2)),
    });
    body.walkSurface = true;
    body.position.copy(m.position);
    body.quaternion.setFromEuler(angle, 0, 0);
    w.zoneData.city.physics.addBody(body);
    w.zoneData.city.obstacles.push(m);
    w.stairs.push({ x: 45, z0, z1, w: 2.8, y0: a.y, y1: b.y });
    for (const x of [46.4, 43.6]) {
      const rail = box(g, x, mid + 0.8, (z0 + z1) / 2, 0.055, 0.055, len, '#d0d4c9');
      rail.rotation.x = angle;
    }
  }
  // Reachable middle balcony is also a believable recovery point for a dangling case.
  solid(55, 9.1, 46, 6, 0.25, 8, '#bdc1b3');
  solid(55, 9.65, 42.1, 6, 1, 0.12, '#889b98');
  w.interact('city', 'balcony-climb', 'Balkon über die Wartungsleiter erreichen', 60, 45, {
    kind: 'traverse',
    radius: 1.8,
    y: 1.6,
    data: {
      from: { x: 60, y: 0, z: 45 },
      to: { x: 55, y: 9.23, z: 44 },
      type: 'ladder',
      duration: 4,
    },
  });
  w.interact('city', 'balcony-down', 'Vom Balkon hinunterklettern', 55, 44, {
    kind: 'traverse',
    radius: 1.8,
    y: 10.83,
    data: {
      from: { x: 55, y: 9.23, z: 44 },
      to: { x: 60, y: 0, z: 45 },
      type: 'ladder',
      duration: 4,
    },
  });
  label(g, 'BBE · DACHWEG', 60, 2.4, 49, 4, 0.65, { sub: 'E · FEUERLEITER · KUNDENTERRASSE' });
  label(g, 'KUNDENTERMIN', 36, 18.4, 108, 6, 0.8, { sub: 'DACH 04 · DER KOFFER FEHLT NOCH' });
  w.interact('city', 'courier-roof', 'Präsentationskoffer beim Kunden abgeben', 36, 110, {
    kind: 'courier-deliver',
    data: 'roof',
    radius: 2.5,
    y: 17.45,
  });
  w.interact('city', 'courier-reception', 'Kundenempfang · Koffer abgeben', 15.2, 112, {
    kind: 'courier-deliver',
    data: 'reception',
    radius: 2,
    y: 1.6,
  });
  label(g, 'KUNDENEMPFANG', 15.8, 2.6, 111, 4, 0.7, { sub: 'E · ABGABE ODER ÜBER DIE DÄCHER' });
  // Courtyard: a real freely traversable passage and animated gate.
  box(g, 76, 0.02, 55, 14, 0.06, 19, '#9d9f91');
  for (const x of [81, 72]) {
    cylinder(g, x, 0.35, 57, 0.65, 0.7, '#9c8971');
    w.tree(g, x, 57);
  }
  const gate = new THREE.Group();
  gate.position.set(68, 0, 47);
  gate.userData.dynamic = true;
  g.add(gate);
  box(gate, -1.5, 1.2, 0, 3, 2.4, 0.1, '#425b61');
  for (let x = 0.2; x < 3; x += 0.3) box(gate, -x, 1.4, 0.065, 0.05, 1.7, 0.04, '#aec1be');
  const gateBody = w.obstacle('city', 66.5, 47, 3, 0.15, 1.2, 2.4);
  w.cityDoors.push({ mesh: gate, body: gateBody, zone: 'city', opened: false, openAngle: 1.4 });
  w.interact('city', 'courtyard-gate', 'Hoftor aufstoßen', 65, 45.8, {
    kind: 'swing-door',
    data: 0,
    radius: 2,
    y: 1.6,
  });
  w.interact('city', 'courtyard-gate-back', 'Hoftor öffnen', 65, 48.2, {
    kind: 'swing-door',
    data: 0,
    radius: 2,
    y: 1.6,
  });
  w.interact('city', 'garage-entry', 'Tiefgarage betreten', 76, 47, {
    kind: 'garage',
    data: 'in',
    radius: 2,
    y: 1.6,
  });
  label(g, 'TIEFGARAGE · HINTERHOF', 76, 2.4, 45.7, 6, 0.8, { sub: 'E · ZUGANG' });
  // The garage is an enclosed interior in the existing office scene, preserving its physics/saves.
  const inside = w.groups.office;
  w.zoneData.office.bounds = 76;
  box(inside, 57, -0.04, 38, 26, 0.08, 18, '#5b6467');
  for (const [x, z, sx, sz] of [
    [44, 38, 0.25, 18],
    [70, 38, 0.25, 18],
    [57, 29, 26, 0.25],
    [57, 47, 26, 0.25],
  ]) {
    const m = box(inside, x, 1.8, z, sx, 3.6, sz, '#717e80');
    w.obstacle('office', x, z, sx, sz, 1.8, 3.6, m);
  }
  for (const x of [48, 55, 62, 68]) {
    for (const z of [31, 44]) {
      box(inside, x, 1.7, z, 0.7, 3.4, 0.7, '#85928f');
      w.obstacle('office', x, z, 0.7, 0.7, 1.7, 3.4);
    }
    box(
      inside,
      x,
      3.38,
      38,
      3,
      0.08,
      0.25,
      new THREE.MeshStandardMaterial({
        color: '#e0f8f2',
        emissive: '#b2dcce',
        emissiveIntensity: 1.2,
      }),
    );
  }
  for (let x = 47; x < 69; x += 3.8) box(inside, x, 0.012, 39, 0.08, 0.01, 9, '#e8d594');
  for (const [i, x] of [
    [0, 50],
    [1, 60],
  ]) {
    w.car(inside, 'car', i ? '#425b6c' : '#b7bdb8').position.set(x, 0, 42);
    w.obstacle('office', x, 42, 1.9, 4.5, 0.8, 1.6);
  }
  label(inside, 'AUSGANG · HINTERHOF', 57, 2.5, 29.15, 7, 0.8);
  w.interact('office', 'garage-exit', 'Tiefgarage verlassen', 57, 31, {
    kind: 'garage',
    data: 'out',
    radius: 2.2,
    y: 1.6,
  });
  w.interact('office', 'courier-start', 'Eilauftrag · Präsentationskoffer', -1.5, 5.8, {
    kind: 'courier-start',
    radius: 1.6,
    y: 1.6,
  });
}
