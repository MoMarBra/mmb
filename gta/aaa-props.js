// Original procedural assets. +Y up; +Z forward. No imports, DOM or external assets.
const cache = new WeakMap();
function kit(T) {
  if (cache.has(T)) return cache.get(T);
  const geometries = new Map();
  const geo = (name, make) => {
    if (!geometries.has(name)) geometries.set(name, make());
    return geometries.get(name);
  };
  const mat = (color, roughness, metalness = 0, extra = {}) =>
    new T.MeshPhysicalMaterial({ color, roughness, metalness, ...extra });
  const M = {
    silver: mat('#dedfd8', 0.3, 0.48, { clearcoat: 0.65 }),
    blue: mat('#175787', 0.29, 0.3, { clearcoat: 0.65 }),
    petrol: mat('#254b55', 0.43, 0.15),
    cream: mat('#e8dfc8', 0.49, 0.05),
    orange: mat('#ec9860', 0.42, 0.1),
    yellow: mat('#dedb50', 0.37, 0.05, { emissive: '#aea936', emissiveIntensity: 0.07 }),
    black: mat('#15232b', 0.54, 0.1),
    rubber: mat('#202728', 0.93),
    leather: mat('#655245', 0.83),
    steel: mat('#74868b', 0.42, 0.78),
    chrome: mat('#c8d0cd', 0.26, 0.85),
    wood: mat('#ba9570', 0.71),
    white: mat('#f2f0e4', 0.4),
    red: mat('#c6503d', 0.48, 0.1),
    plastic: mat('#5e686a', 0.72),
    glass: mat('#143744', 0.12, 0.25, {
      clearcoat: 1,
      transparent: true,
      opacity: 0.85,
      side: T.DoubleSide,
    }),
    blueLamp: mat('#368aff', 0.18, 0.08, { emissive: '#186aff', emissiveIntensity: 2.0, clearcoat: 1 }),
    amberLamp: mat('#ffb148', 0.2, 0.05, { emissive: '#ff9923', emissiveIntensity: 1.2 }),
    redLamp: mat('#ee4533', 0.18, 0.1, { emissive: '#fa2419', emissiveIntensity: 0.6 }),
    whiteLamp: mat('#f6efda', 0.16, 0.08, { emissive: '#fff1c4', emissiveIntensity: 0.9 }),
    cloth: mat('#295763', 0.52, 0, { side: T.DoubleSide, clearcoat: 0.25 }),
    cloth2: mat('#d8ccb1', 0.61, 0, { side: T.DoubleSide, clearcoat: 0.2 }),
  };
  const cube = geo('cube', () => new T.BoxGeometry(1, 1, 1));
  const sphereGeometry = geo('sphere', () => new T.SphereGeometry(1, 18, 12));
  const unitCylinder = geo('unit-cylinder', () => new T.CylinderGeometry(1, 1, 1, 10));
  const mesh = (g, geometry, material) => {
    const m = new T.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (g, p, size, material) => {
    const m = mesh(g, cube, material);
    m.position.set(...p);
    m.scale.set(...size);
    return m;
  };
  const sphere = (g, p, size, material) => {
    const m = mesh(g, sphereGeometry, material);
    m.position.set(...p);
    m.scale.set(...size);
    return m;
  };
  const tube = (g, a, b, radius, material) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start),
      m = mesh(g, unitCylinder, material);
    m.position.copy(start).add(end).multiplyScalar(0.5);
    m.scale.set(radius, delta.length(), radius);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return m;
  };
  const cylinder = (g, p, r, h, material, top = r, count = 18) => {
    const m = mesh(
      g,
      geo(`cyl-${r}-${h}-${top}-${count}`, () => new T.CylinderGeometry(top, r, h, count)),
      material,
    );
    m.position.set(...p);
    return m;
  };
  const torus = (g, p, r, thickness, material, arc = Math.PI * 2, radial = 8, tubular = 36) => {
    const m = mesh(
      g,
      geo(
        `torus-${r}-${thickness}-${arc}-${radial}-${tubular}`,
        () => new T.TorusGeometry(r, thickness, radial, tubular, arc),
      ),
      material,
    );
    m.position.set(...p);
    return m;
  };
  const round = (g, p, size, material) => {
    const geometry = geo('rounded-box', () => {
      const shape = new T.Shape();
      shape.moveTo(-0.4, -0.5);
      shape.lineTo(0.4, -0.5);
      shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.4);
      shape.lineTo(0.5, 0.4);
      shape.quadraticCurveTo(0.5, 0.5, 0.4, 0.5);
      shape.lineTo(-0.4, 0.5);
      shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.4);
      shape.lineTo(-0.5, -0.4);
      shape.quadraticCurveTo(-0.5, -0.5, -0.4, -0.5);
      const e = new T.ExtrudeGeometry(shape, {
        depth: 0.86,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.03,
        bevelThickness: 0.07,
        curveSegments: 3,
        steps: 1,
      });
      e.translate(0, 0, -0.43);
      return e;
    });
    const m = mesh(g, geometry, material);
    m.position.set(...p);
    m.scale.set(...size);
    return m;
  };
  const curve = (g, points, radius, material, count = 20) =>
    mesh(
      g,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
        count,
        radius,
        7,
        false,
      ),
      material,
    );
  const surface = (g, points, material) => {
    const geom = new T.BufferGeometry(),
      positions = points.flat(),
      indices = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
    geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return mesh(g, geom, material);
  };
  const K = { T, M, geo, mesh, box, sphere, tube, cylinder, torus, round, curve, surface, unitCylinder };
  cache.set(T, K);
  return K;
}

// Retain articulated meshes and instance repeated static batches by shared geometry.
function bake(K, group, name, exclusions = []) {
  const { T, geo, mesh } = K,
    skipped = new Set(exclusions),
    groups = new Map();
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  function walk(n) {
    if (skipped.has(n)) return;
    if (n.isMesh && !n.isInstancedMesh && !n.material.transparent) {
      if (!groups.has(n.material)) groups.set(n.material, []);
      groups.get(n.material).push(n);
    }
    n.children.forEach(walk);
  }
  group.children.forEach(walk);
  let id = 0;
  for (const [material, items] of groups) {
    if (items.length < 2) continue;
    const geometry = geo(`${name}-batch-${id++}`, () => {
      const p = [],
        normals = [],
        v = new T.Vector3(),
        n = new T.Vector3();
      for (const item of items) {
        const matrix = inverse.clone().multiply(item.matrixWorld),
          normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
        const position = item.geometry.getAttribute('position'),
          normal = item.geometry.getAttribute('normal'),
          indices = item.geometry.index;
        for (let i = 0, length = indices ? indices.count : position.count; i < length; i++) {
          const j = indices ? indices.getX(i) : i;
          v.fromBufferAttribute(position, j).applyMatrix4(matrix);
          p.push(v.x, v.y, v.z);
          n.fromBufferAttribute(normal, j).applyMatrix3(normalMatrix).normalize();
          normals.push(n.x, n.y, n.z);
        }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geometry.computeBoundingSphere();
      return geometry;
    });
    items.forEach((m) => m.removeFromParent());
    const combined = mesh(group, geometry, material);
    combined.name = `${name} static details`;
  }
}

const glyphs = {
  P: [
    [
      [0, 0],
      [0, 1],
      [0.5, 1],
      [0.63, 0.83],
      [0.63, 0.62],
      [0.5, 0.5],
      [0, 0.5],
    ],
  ],
  O: [
    [
      [0.12, 0],
      [0, 0.12],
      [0, 0.86],
      [0.12, 1],
      [0.5, 1],
      [0.63, 0.86],
      [0.63, 0.12],
      [0.5, 0],
      [0.12, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [0.63, 0],
    ],
  ],
  I: [
    [
      [0.1, 1],
      [0.53, 1],
    ],
    [
      [0.315, 1],
      [0.315, 0],
    ],
    [
      [0.1, 0],
      [0.53, 0],
    ],
  ],
  Z: [
    [
      [0, 1],
      [0.63, 1],
      [0, 0],
      [0.63, 0],
    ],
  ],
  E: [
    [
      [0.63, 1],
      [0, 1],
      [0, 0],
      [0.63, 0],
    ],
    [
      [0, 0.52],
      [0.49, 0.52],
    ],
  ],
  1: [
    [
      [0.1, 0.78],
      [0.32, 1],
      [0.32, 0],
    ],
    [
      [0.1, 0],
      [0.52, 0],
    ],
  ],
  0: [
    [
      [0.12, 0],
      [0, 0.12],
      [0, 0.86],
      [0.12, 1],
      [0.5, 1],
      [0.63, 0.86],
      [0.63, 0.12],
      [0.5, 0],
      [0.12, 0],
    ],
  ],
};
function lettering(K, parent, word, height, material, p, rotation = [0, 0, 0]) {
  const group = new K.T.Group(),
    width = (word.length * 0.85 - 0.22) * height;
  group.position.set(...p);
  group.rotation.set(...rotation);
  parent.add(group);
  [...word].forEach((letter, index) =>
    (glyphs[letter] || []).forEach((line) => {
      for (let j = 1; j < line.length; j++)
        K.tube(
          group,
          [(line[j - 1][0] + index * 0.85) * height - width / 2, line[j - 1][1] * height, 0],
          [(line[j][0] + index * 0.85) * height - width / 2, line[j][1] * height, 0],
          height * 0.035,
          material,
        );
    }),
  );
  return group;
}

function hull(K, group, sections, material, key) {
  const geometry = K.geo(key, () => {
    const positions = [],
      indices = [];
    for (const [z, width, bottom, top] of sections) {
      for (const [x, y] of [
        [-width * 0.92, bottom],
        [-width, bottom + 0.055],
        [-width, top - 0.055],
        [-width * 0.93, top],
        [width * 0.93, top],
        [width, top - 0.055],
        [width, bottom + 0.055],
        [width * 0.92, bottom],
      ])
        positions.push(x, y, z);
    }
    for (let s = 0; s < sections.length - 1; s++)
      for (let p = 0; p < 8; p++) {
        const a = s * 8 + p,
          b = s * 8 + ((p + 1) % 8),
          c = a + 8,
          d = b + 8;
        indices.push(a, c, d, a, d, b);
      }
    for (let p = 1; p < 7; p++) {
      indices.push(0, p, p + 1);
      const q = (sections.length - 1) * 8;
      indices.push(q, q + p + 1, q + p);
    }
    const g = new K.T.BufferGeometry();
    g.setAttribute('position', new K.T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  });
  return K.mesh(group, geometry, material);
}

function carWheel(K, parent, p, side, key) {
  const { T, M, torus, cylinder, tube, sphere } = K,
    wheel = new T.Group();
  wheel.name = `${key} wheel — spin X`;
  wheel.position.set(...p);
  parent.add(wheel);
  torus(wheel, [0, 0, 0], 0.274, 0.066, M.rubber, Math.PI * 2, 12, 40).rotation.y = Math.PI / 2;
  const inner = cylinder(wheel, [side * 0.025, 0, 0], 0.221, 0.065, M.black, 0.221, 30);
  inner.rotation.z = Math.PI / 2;
  torus(wheel, [side * 0.066, 0, 0], 0.211, 0.013, M.chrome, Math.PI * 2, 7, 36).rotation.y =
    Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    tube(
      wheel,
      [side * 0.073, Math.sin(a) * 0.042, Math.cos(a) * 0.042],
      [side * 0.06, Math.sin(a + 0.13) * 0.203, Math.cos(a + 0.13) * 0.203],
      0.018,
      M.chrome,
    );
    sphere(
      wheel,
      [side * 0.083, Math.sin(a) * 0.031, Math.cos(a) * 0.031],
      [0.007, 0.007, 0.007],
      M.chrome,
    );
  }
  const center = cylinder(wheel, [side * 0.084, 0, 0], 0.023, 0.01, M.chrome);
  center.rotation.z = Math.PI / 2;
  bake(K, wheel, key);
  return wheel;
}

export function createPoliceCar(THREE) {
  const K = kit(THREE),
    { T, M, box, round, tube, curve, cylinder, torus, surface, sphere } = K;
  const g = new T.Group();
  g.name = 'Munich police estate car';
  hull(
    K,
    g,
    [
      [-2.37, 0.8, 0.43, 0.8],
      [-2.18, 0.92, 0.4, 0.86],
      [-1.63, 0.94, 0.39, 0.88],
      [1.59, 0.94, 0.39, 0.91],
      [2.15, 0.9, 0.43, 0.79],
      [2.4, 0.78, 0.49, 0.74],
    ],
    M.silver,
    'police-main-hull',
  );
  hull(
    K,
    g,
    [
      [1.14, 0.89, 0.7, 0.97],
      [1.76, 0.91, 0.64, 0.91],
      [2.25, 0.82, 0.61, 0.79],
    ],
    M.silver,
    'police-hood',
  );
  round(g, [0, 0.45, 0], [1.71, 0.18, 3.86], M.black);
  // An open cabin shell makes opened doors reveal actual seats, dashboard and footwell.
  round(g, [0, 0.59, -0.34], [1.64, 0.12, 2.45], M.black);
  round(g, [0, 1.46, -0.34], [1.48, 0.085, 2.4], M.silver);
  for (const side of [-1, 1]) {
    tube(g, [side * 0.85, 1.005, 1.47], [side * 0.744, 1.445, 0.84], 0.039, M.silver);
    tube(g, [side * 0.9, 0.94, -1.99], [side * 0.744, 1.445, -1.49], 0.05, M.silver);
    tube(g, [side * 0.752, 1.45, -0.15], [side * 0.931, 0.8, -0.15], 0.038, M.black);
    tube(g, [side * 0.752, 1.45, -1.46], [side * 0.752, 1.45, 0.84], 0.035, M.silver);
    tube(g, [side * 0.84, 1.515, -1.25], [side * 0.84, 1.515, 0.62], 0.018, M.black);
    for (const z of [-1.1, 0.44])
      tube(g, [side * 0.84, 1.51, z], [side * 0.71, 1.46, z], 0.024, M.black);
    round(g, [side * 0.947, 0.57, -0.05], [0.065, 0.12, 2.67], M.black);
    for (const z of [-1.43, 1.45])
      torus(g, [side * 0.953, 0.35, z], 0.356, 0.022, M.black, Math.PI, 6, 28).rotation.y = Math.PI / 2;
  }
  surface(
    g,
    [
      [-0.812, 1.01, 1.475],
      [0.812, 1.01, 1.475],
      [0.708, 1.427, 0.855],
      [-0.708, 1.427, 0.855],
    ],
    M.glass,
  );
  surface(
    g,
    [
      [0.83, 0.96, -1.975],
      [-0.83, 0.96, -1.975],
      [-0.703, 1.415, -1.49],
      [0.703, 1.415, -1.49],
    ],
    M.glass,
  );
  for (const side of [-1, 1]) {
    surface(
      g,
      [
        [side * 0.936, 0.985, -1.43],
        [side * 0.903, 0.977, -1.86],
        [side * 0.738, 1.416, -1.485],
        [side * 0.758, 1.411, -1.37],
      ],
      M.glass,
    );
    tube(g, [side * 0.837, 1.015, 1.46], [side * 0.68, 1.034, 1.45], 0.007, M.black);
  }
  tube(g, [-0.65, 1.026, 1.458], [-0.23, 1.09, 1.34], 0.011, M.black);
  tube(g, [0.17, 1.026, 1.458], [0.58, 1.091, 1.34], 0.011, M.black);
  round(g, [0, 0.99, 1.025], [1.52, 0.13, 0.38], M.black);
  round(g, [0, 1.083, 1.0], [0.24, 0.13, 0.035], M.glass);
  const steering = torus(g, [-0.45, 1.04, 0.82], 0.13, 0.018, M.black);
  steering.rotation.x = -0.38;
  tube(g, [-0.45, 0.95, 0.94], [-0.45, 1.04, 0.82], 0.03, M.steel);
  const seats = [];
  for (const z of [0.3, -0.94])
    for (const x of [-0.43, 0.43]) {
      round(g, [x, 0.66, z], [0.48, 0.14, 0.51], M.leather);
      const back = round(g, [x, 0.985, z - 0.235], [0.49, 0.52, 0.12], M.leather);
      back.rotation.x = -0.11;
      round(g, [x, 1.255, z - 0.27], [0.28, 0.13, 0.105], M.black);
      seats.push(new T.Vector3(x, 0.75, z));
    }
  const doors = {},
    hinges = [],
    mirrors = [];
  for (const side of [-1, 1])
    for (const front of [true, false]) {
      const name = `${front ? 'front' : 'rear'}${side === -1 ? 'Left' : 'Right'}`,
        door = new T.Group();
      door.name = `${name} door — hinge Y`;
      const length = front ? 1.36 : 1.21;
      door.position.set(side * 0.937, 0.72, front ? 1.22 : -0.155);
      g.add(door);
      round(door, [0, 0.115, -length / 2], [0.035, 0.287, length - 0.025], M.silver);
      box(door, [side * 0.024, 0.196, -length / 2], [0.01, 0.213, length - 0.03], M.blue);
      box(door, [side * 0.032, 0.317, -length / 2], [0.01, 0.026, length - 0.024], M.yellow);
      box(door, [side * 0.032, 0.077, -length / 2], [0.01, 0.022, length - 0.026], M.yellow);
      const glassPoints = front
        ? [
            [0, 0.333, -0.02],
            [-side * 0.177, 0.704, -0.363],
            [-side * 0.177, 0.704, -1.322],
            [0, 0.333, -1.322],
          ]
        : [
            [0, 0.333, -0.025],
            [-side * 0.177, 0.7, -0.025],
            [-side * 0.177, 0.7, -1.165],
            [0, 0.333, -1.19],
          ];
      surface(door, side === 1 ? glassPoints : glassPoints.slice().reverse(), M.glass);
      for (let i = 0; i < glassPoints.length; i++)
        tube(door, glassPoints[i], glassPoints[(i + 1) % glassPoints.length], 0.018, M.black);
      tube(
        door,
        [side * 0.043, 0.288, -length + 0.25],
        [side * 0.043, 0.288, -length + 0.44],
        0.017,
        M.silver,
      );
      round(door, [-side * 0.049, 0.13, -length / 2], [0.02, 0.22, length * 0.8], M.black);
      tube(
        door,
        [-side * 0.08, 0.19, -length * 0.6],
        [-side * 0.08, 0.19, -length * 0.38],
        0.024,
        M.black,
      );
      if (front) {
        lettering(
          K,
          door,
          'POLIZEI',
          0.113,
          M.silver,
          [side * 0.048, 0.127, -0.67],
          [0, (side * Math.PI) / 2, 0],
        );
        tube(door, [0, 0.352, -0.1], [side * 0.095, 0.37, -0.08], 0.024, M.black);
        const mirror = round(door, [side * 0.143, 0.385, -0.065], [0.145, 0.092, 0.133], M.silver);
        mirrors.push(mirror);
        const mirrorGlass = round(door, [side * 0.146, 0.39, -0.135], [0.13, 0.07, 0.01], M.chrome);
        mirrorGlass.castShadow = false;
      } else
        lettering(
          K,
          door,
          '110',
          0.085,
          M.silver,
          [side * 0.048, 0.151, -0.66],
          [0, (side * Math.PI) / 2, 0],
        );
      door.userData = { openAngle: -side * 1.12, side, front, hingeAxis: 'Y', closedAngle: 0 };
      bake(K, door, `police-door-${name}`);
      doors[name] = door;
      hinges.push(door);
    }
  for (const side of [-1, 1]) {
    const fenderPatch = [
      [side * 0.951, 0.719, 1.53],
      [side * 0.913, 0.66, 2.15],
      [side * 0.913, 0.765, 2.15],
      [side * 0.951, 0.876, 1.53],
    ];
    surface(g, side === -1 ? fenderPatch : fenderPatch.slice().reverse(), M.blue);
    tube(g, [side * 0.953, 0.886, 1.53], [side * 0.915, 0.775, 2.15], 0.01, M.yellow);
    round(g, [side * 0.872, 0.834, -2.0], [0.043, 0.25, 0.51], M.blue);
  }
  lettering(K, g, 'POLIZEI', 0.145, M.blue, [0, 0.944, 1.68], [-Math.PI / 2, 0, 0]);
  round(g, [0, 0.608, 2.34], [1.57, 0.16, 0.14], M.black);
  round(g, [0, 0.778, 2.25], [0.73, 0.12, 0.055], M.black);
  for (let i = 0; i < 7; i++) box(g, [-0.3 + i * 0.1, 0.778, 2.281], [0.032, 0.085, 0.01], M.chrome);
  round(g, [0, 0.6, -2.355], [1.61, 0.14, 0.12], M.black);
  round(g, [0, 0.718, -2.413], [0.47, 0.103, 0.012], M.white);
  round(g, [0, 0.647, 2.414], [0.47, 0.096, 0.012], M.white);
  const headlights = [],
    taillights = [],
    flashers = [],
    wheels = [],
    frontAxles = [];
  for (const side of [-1, 1]) {
    headlights.push(round(g, [side * 0.632, 0.822, 2.2], [0.43, 0.083, 0.062], M.whiteLamp));
    taillights.push(round(g, [side * 0.731, 0.868, -2.289], [0.263, 0.105, 0.07], M.redLamp));
    round(g, [side * 0.76, 0.808, -2.308], [0.17, 0.026, 0.063], M.whiteLamp);
    for (const [z, front] of [
      [-1.43, false],
      [1.45, true],
    ]) {
      const axle = new T.Group();
      axle.position.set(side * 0.927, 0.345, z);
      axle.name = front ? 'Front steering Y' : 'Rear axle';
      g.add(axle);
      const wheel = carWheel(K, axle, [0, 0, 0], side, `police-wheel-${side}-${front}`);
      wheels.push(wheel);
      if (front) frontAxles.push(axle);
    }
  }
  round(g, [0, 1.575, -0.29], [1.13, 0.055, 0.3], M.black);
  for (const x of [-0.41, 0.41]) {
    const light = round(g, [x, 1.647, -0.29], [0.27, 0.089, 0.261], M.blueLamp.clone());
    light.name = 'Blue roof strobe';
    flashers.push(light);
    for (let row = 0; row < 3; row++)
      box(g, [x, 1.618 + row * 0.018, -0.151], [0.23, 0.004, 0.006], M.chrome);
  }
  for (const x of [-0.195, 0.195]) {
    const light = round(g, [x, 0.776, 2.319], [0.1, 0.041, 0.022], M.blueLamp.clone());
    light.name = 'Blue grille strobe';
    flashers.push(light);
  }
  cylinder(g, [0, 1.644, -0.9], 0.028, 0.15, M.black);
  tube(g, [0, 1.7, -0.9], [0, 2.01, -0.98], 0.006, M.black);
  for (const x of [-0.62, 0.62]) {
    const exhaust = cylinder(g, [x, 0.44, -2.36], 0.055, 0.16, M.chrome);
    exhaust.rotation.x = Math.PI / 2;
  }
  const allAxles = wheels.map((w) => w.parent);
  bake(K, g, 'police-body', [...hinges, ...allAxles, ...headlights, ...taillights, ...flashers]);
  g.userData = {
    doors,
    doorPivots: hinges,
    wheels,
    frontAxles,
    flashers,
    lights: flashers,
    headlights,
    taillights,
    wheelRadius: 0.34,
    wheelbase: 2.88,
    forward: '+Z',
    groundY: 0,
    driverSeat: seats[0],
    passengerSeats: seats.slice(1),
    exitPoints: [new T.Vector3(-1.47, 0, 0.42), new T.Vector3(1.47, 0, 0.42)],
    cameraTarget: new T.Vector3(0, 1.0, -0.2),
    colliderCenter: new T.Vector3(0, 0.78, 0),
    colliderHalfExtents: new T.Vector3(1.0, 0.76, 2.4),
  };
  return g;
}

function smallWheel(K, parent, p, radius, key) {
  const wheel = new K.T.Group();
  wheel.name = 'Wheel — spin X';
  wheel.position.set(...p);
  parent.add(wheel);
  const tire = K.cylinder(wheel, [0, 0, 0], radius, radius * 0.7, K.M.rubber, radius, 18);
  tire.rotation.z = Math.PI / 2;
  for (const x of [-1, 1]) {
    const hub = K.cylinder(
      wheel,
      [x * radius * 0.37, 0, 0],
      radius * 0.45,
      0.006,
      K.M.chrome,
      radius * 0.45,
      12,
    );
    hub.rotation.z = Math.PI / 2;
  }
  bake(K, wheel, key);
  return wheel;
}

export function createStreetProp(THREE, type) {
  const K = kit(THREE),
    { T, M, geo, mesh, box, round, tube, curve, cylinder, torus, sphere, surface } = K;
  if (!['bin', 'chair', 'barrier', 'shopping-cart', 'suitcase'].includes(type))
    throw new RangeError(`Unknown street prop: ${type}`);
  const g = new T.Group();
  g.name = `Munich movable ${type}`;
  const preserve = [],
    details = { type, forward: '+Z', groundY: 0 };
  if (type === 'bin') {
    const shape = geo('bin-body', () => new T.CylinderGeometry(1, 0.82, 1, 4, 1, true));
    const binMaterial = M.petrol.clone();
    binMaterial.side = T.DoubleSide;
    const body = mesh(g, shape, binMaterial);
    body.rotation.y = Math.PI / 4;
    body.position.set(0, 0.508, 0);
    body.scale.set(0.37, 0.88, 0.41);
    for (const z of [-0.29, 0.29]) tube(g, [-0.265, 0.957, z], [0.265, 0.957, z], 0.018, M.black);
    for (const x of [-0.265, 0.265]) tube(g, [x, 0.957, -0.29], [x, 0.957, 0.29], 0.018, M.black);
    box(g, [0, 0.084, 0], [0.41, 0.023, 0.47], M.black);
    for (const x of [-0.22, 0.22]) tube(g, [x, 0.84, -0.29], [x, 1.0, -0.3], 0.014, M.steel);
    tube(g, [-0.23, 0.985, -0.31], [0.23, 0.985, -0.31], 0.021, M.black);
    const lid = new T.Group();
    lid.name = 'Bin lid — negative X opens';
    lid.position.set(0, 0.98, -0.3);
    g.add(lid);
    round(lid, [0, 0.02, 0.3], [0.56, 0.049, 0.625], M.petrol);
    round(lid, [0, 0.06, 0.51], [0.15, 0.04, 0.09], M.black);
    for (const x of [-0.19, 0.19]) box(lid, [x, 0.05, 0.28], [0.025, 0.017, 0.38], M.black);
    const wheels = [-0.217, 0.217].map((x, i) =>
      smallWheel(K, g, [x, 0.108, -0.25], 0.108, `bin-wheel-${i}`),
    );
    round(g, [0, 0.64, 0.286], [0.29, 0.185, 0.013], M.cream);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3,
        b = a + 1.55;
      tube(
        g,
        [Math.sin(a) * 0.066, 0.645 + Math.cos(a) * 0.055, 0.3],
        [Math.sin(b) * 0.066, 0.645 + Math.cos(b) * 0.055, 0.3],
        0.008,
        M.petrol,
      );
    }
    bake(K, lid, 'bin-lid');
    preserve.push(lid, ...wheels);
    Object.assign(details, {
      lid,
      wheels,
      mass: 12,
      colliderHalfExtents: new T.Vector3(0.3, 0.53, 0.34),
      colliderCenter: new T.Vector3(0, 0.53, 0),
      lidOpenAngle: -1.55,
    });
  } else if (type === 'chair') {
    round(g, [0, 0.455, 0], [0.43, 0.046, 0.422], M.wood);
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        tube(g, [x * 0.175, 0.445, z * 0.165], [x * 0.216, 0.025, z * 0.216], 0.014, M.black);
        sphere(g, [x * 0.216, 0.024, z * 0.216], [0.021, 0.016, 0.021], M.rubber);
      }
    for (const x of [-0.19, 0.19])
      curve(
        g,
        [
          [x, 0.34, -0.18],
          [x, 0.54, -0.205],
          [x, 0.75, -0.245],
          [x * 0.94, 0.855, -0.235],
        ],
        0.014,
        M.black,
        18,
      );
    for (const y of [0.64, 0.738, 0.837]) {
      const slat = round(g, [0, y, -0.205], [0.43, 0.07, 0.038], M.wood);
      slat.rotation.x = -0.05;
    }
    for (const z of [-0.185, 0.185]) tube(g, [-0.198, 0.22, z], [0.198, 0.22, z], 0.009, M.black);
    Object.assign(details, {
      mass: 5,
      seat: new T.Vector3(0, 0.485, 0),
      colliderHalfExtents: new T.Vector3(0.24, 0.44, 0.26),
      colliderCenter: new T.Vector3(0, 0.44, 0),
    });
  } else if (type === 'barrier') {
    for (const x of [-0.72, 0.72]) {
      round(g, [x, 0.061, 0], [0.24, 0.112, 0.52], M.rubber);
      tube(g, [x, 0.1, 0], [x, 1.13, 0], 0.022, M.steel);
      for (const z of [-0.2, 0.2]) box(g, [x, 0.12, z], [0.18, 0.018, 0.033], M.orange);
    }
    for (const y of [0.58, 0.89]) {
      round(g, [0, y, 0], [1.81, 0.18, 0.054], M.white);
      for (let i = -3; i <= 3; i++)
        for (const side of [-1, 1]) {
          const x = i * 0.245;
          const stripe = [
            [x - 0.084, y - 0.085, side * 0.031],
            [x + 0.038, y - 0.085, side * 0.031],
            [x + 0.118, y + 0.085, side * 0.031],
            [x - 0.004, y + 0.085, side * 0.031],
          ];
          surface(g, side === 1 ? stripe : stripe.reverse(), M.red);
        }
    }
    const lights = [-0.72, 0.72].map((x) => {
      cylinder(g, [x, 1.139, 0], 0.05, 0.052, M.black);
      const lamp = sphere(g, [x, 1.205, 0], [0.064, 0.073, 0.064], M.amberLamp.clone());
      preserve.push(lamp);
      return lamp;
    });
    Object.assign(details, {
      lights,
      mass: 17,
      colliderHalfExtents: new T.Vector3(0.96, 0.64, 0.29),
      colliderCenter: new T.Vector3(0, 0.64, 0),
    });
  } else if (type === 'shopping-cart') {
    const wheels = [],
      casters = [];
    for (const x of [-0.253, 0.253])
      for (const z of [-0.345, 0.345]) {
        const caster = new T.Group();
        caster.position.set(x, 0.12, z);
        caster.name = 'Caster — swivel Y';
        g.add(caster);
        tube(caster, [0, 0.1, 0], [0, -0.013, 0], 0.012, M.chrome);
        for (const side of [-1, 1])
          tube(caster, [side * 0.028, 0.005, 0], [side * 0.028, -0.042, 0.019], 0.007, M.steel);
        const wheel = smallWheel(K, caster, [0, -0.048, 0.019], 0.07, `cart-wheel-${x}-${z}`);
        wheels.push(wheel);
        casters.push(caster);
        bake(K, caster, `cart-caster-${x}-${z}`, [wheel]);
      }
    for (const x of [-0.25, 0.25]) {
      curve(
        g,
        [
          [x, 0.17, 0.36],
          [x, 0.19, -0.34],
          [x, 0.43, -0.37],
          [x, 0.96, -0.44],
        ],
        0.019,
        M.chrome,
        16,
      );
      tube(g, [x, 0.2, 0.32], [x * 0.8, 0.54, 0.31], 0.015, M.chrome);
    }
    for (const z of [-0.31, 0.0, 0.31]) tube(g, [-0.25, 0.2, z], [0.25, 0.2, z], 0.012, M.chrome);
    tube(g, [-0.28, 0.985, -0.455], [0.28, 0.985, -0.455], 0.026, M.orange);
    for (const side of [-1, 1]) {
      for (let row = 0; row <= 4; row++) {
        const f = row / 4,
          x = side * (0.2 + 0.081 * f),
          y = 0.535 + f * 0.305;
        tube(g, [x, y, -0.305 - f * 0.055], [x, y - f * 0.04, 0.3 + f * 0.11], 0.006, M.chrome);
      }
      for (let column = 0; column <= 8; column++) {
        const f = column / 8;
        tube(
          g,
          [side * 0.2, 0.535, -0.305 + f * 0.605],
          [side * 0.281, 0.84 - f * 0.04, -0.36 + f * 0.77],
          0.006,
          M.chrome,
        );
      }
    }
    for (let row = 0; row <= 4; row++) {
      const f = row / 4;
      tube(
        g,
        [-0.2 - f * 0.081, 0.535 + 0.265 * f, 0.3 + 0.11 * f],
        [0.2 + f * 0.081, 0.535 + 0.265 * f, 0.3 + 0.11 * f],
        0.006,
        M.chrome,
      );
      tube(
        g,
        [-0.2 - f * 0.081, 0.535 + 0.305 * f, -0.305 - 0.055 * f],
        [0.2 + f * 0.081, 0.535 + 0.305 * f, -0.305 - 0.055 * f],
        0.006,
        M.chrome,
      );
    }
    for (let c = 0; c <= 6; c++) {
      const f = c / 6,
        x = -0.2 + 0.4 * f,
        topX = -0.281 + 0.562 * f;
      tube(g, [x, 0.535, 0.3], [topX, 0.8, 0.41], 0.006, M.chrome);
      tube(g, [x, 0.535, -0.305], [topX, 0.84, -0.36], 0.006, M.chrome);
      tube(g, [x, 0.535, -0.305], [x, 0.535, 0.3], 0.005, M.chrome);
    }
    round(g, [0, 0.708, -0.35], [0.3, 0.143, 0.018], M.orange);
    Object.assign(details, {
      wheels,
      casters,
      mass: 18,
      handlePosition: new T.Vector3(0, 0.985, -0.455),
      basketCenter: new T.Vector3(0, 0.66, 0.03),
      colliderHalfExtents: new T.Vector3(0.31, 0.52, 0.49),
      colliderCenter: new T.Vector3(0, 0.52, -0.02),
    });
    preserve.push(...casters);
  } else {
    round(g, [0, 0.384, 0], [0.4, 0.57, 0.27], M.cream);
    round(g, [0, 0.383, 0.145], [0.36, 0.52, 0.018], M.petrol);
    for (const x of [-0.125, -0.064, 0, 0.064, 0.125])
      round(g, [x, 0.387, 0.166], [0.01, 0.434, 0.012], M.steel);
    for (const x of [-0.184, 0.184]) tube(g, [x, 0.16, 0], [x, 0.61, 0], 0.006, M.black);
    for (const y of [0.11, 0.66]) tube(g, [-0.18, y, 0], [0.18, y, 0], 0.006, M.black);
    const handle = new T.Group();
    handle.name = 'Suitcase telescopic handle';
    handle.position.set(0, 0.665, -0.073);
    g.add(handle);
    for (const x of [-0.09, 0.09]) tube(handle, [x, 0, 0], [x, 0.253, 0], 0.009, M.chrome);
    round(handle, [0, 0.26, 0], [0.235, 0.035, 0.038], M.black);
    curve(
      g,
      [
        [-0.058, 0.684, 0.035],
        [-0.055, 0.724, 0.038],
        [0.055, 0.724, 0.038],
        [0.058, 0.684, 0.035],
      ],
      0.011,
      M.black,
      15,
    );
    const wheels = [];
    for (const x of [-0.162, 0.162])
      for (const z of [-0.09, 0.09])
        wheels.push(smallWheel(K, g, [x, 0.045, z], 0.043, `case-wheel-${x}-${z}`));
    round(g, [0.12, 0.65, 0.018], [0.06, 0.024, 0.025], M.steel);
    round(g, [0.125, 0.66, 0.099], [0.08, 0.095, 0.005], M.orange);
    bake(K, handle, 'suitcase-handle');
    preserve.push(handle, ...wheels);
    Object.assign(details, {
      handle,
      wheels,
      mass: 9,
      carryPoint: new T.Vector3(0, 0.929, -0.073),
      colliderHalfExtents: new T.Vector3(0.22, 0.35, 0.16),
      colliderCenter: new T.Vector3(0, 0.36, 0),
    });
  }
  bake(K, g, `street-${type}`, preserve);
  g.userData = details;
  return g;
}

export function createUmbrella(THREE) {
  const K = kit(THREE),
    { T, M, geo, mesh, tube, curve, cylinder, sphere } = K;
  const g = new T.Group();
  g.name = 'Munich rain umbrella';
  tube(g, [0, 0.05, 0], [0, 0.905, 0], 0.007, M.chrome);
  curve(
    g,
    [
      [0, 0.11, 0],
      [0, 0.025, 0],
      [0.025, -0.025, 0],
      [0.083, -0.023, 0],
      [0.1, 0.03, 0],
    ],
    0.013,
    M.black,
    18,
  );
  const canopy = new T.Group();
  canopy.name = 'Umbrella canopy';
  g.add(canopy);
  const panels = 8,
    radial = 7,
    angular = 5;
  const point = (r, t, index) => {
    const a = ((index + t) * Math.PI * 2) / panels,
      edge = 0.605 - Math.sin(t * Math.PI) * 0.035 * r ** 5;
    const radius = r * edge,
      y = 0.9 - 0.258 * r ** 1.65 + Math.sin(t * Math.PI) * 0.019 * r ** 4;
    return [Math.sin(a) * radius, y, Math.cos(a) * radius];
  };
  for (let p = 0; p < panels; p++) {
    const geometry = geo(`umbrella-panel-${p}`, () => {
      const positions = [],
        indices = [];
      for (let y = 0; y <= radial; y++)
        for (let x = 0; x <= angular; x++) positions.push(...point(y / radial, x / angular, p));
      for (let y = 0; y < radial; y++)
        for (let x = 0; x < angular; x++) {
          const a = y * (angular + 1) + x,
            b = a + 1,
            c = a + angular + 1,
            d = c + 1;
          indices.push(a, c, d, a, d, b);
        }
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();
      return geom;
    });
    mesh(canopy, geometry, p % 4 === 0 ? M.cloth2 : M.cloth);
    const a = (p * Math.PI * 2) / panels;
    curve(
      canopy,
      Array.from({ length: 7 }, (_, j) => {
        const v = point(j / 6, 0, p);
        v[1] -= 0.009;
        return v;
      }),
      0.0038,
      M.steel,
      16,
    );
    tube(canopy, [0, 0.515, 0], [Math.sin(a) * 0.28, 0.81, Math.cos(a) * 0.28], 0.0038, M.chrome);
    cylinder(canopy, [Math.sin(a) * 0.61, 0.641, Math.cos(a) * 0.61], 0.007, 0.016, M.black, 0.005, 6);
  }
  const slider = cylinder(g, [0, 0.516, 0], 0.017, 0.059, M.black);
  sphere(g, [0, 0.929, 0], [0.019, 0.04, 0.019], M.black);
  bake(K, canopy, 'umbrella-canopy');
  bake(K, g, 'umbrella-shaft', [canopy, slider]);
  g.userData = {
    canopy,
    slider,
    grip: new T.Vector3(0, 0.08, 0),
    forward: '+Z',
    radius: 0.61,
    height: 1.0,
    poleAxis: 'Y',
  };
  return g;
}

export function createWinchHook(THREE) {
  const K = kit(THREE),
    { T, M, curve, torus, cylinder, tube, round } = K;
  const g = new T.Group();
  g.name = 'Rescue winch swivel hook';
  torus(g, [0, -0.016, 0], 0.029, 0.008, M.chrome, Math.PI * 2, 8, 22);
  cylinder(g, [0, -0.071, 0], 0.02, 0.05, M.steel);
  round(g, [0, -0.114, 0], [0.064, 0.043, 0.062], M.orange);
  for (const y of [-0.102, -0.119]) tube(g, [-0.032, y, 0.033], [0.032, y, 0.033], 0.004, M.black);
  curve(
    g,
    [
      [0, -0.134, 0],
      [-0.047, -0.178, 0],
      [-0.07, -0.26, 0],
      [-0.039, -0.33, 0],
      [0.042, -0.337, 0],
      [0.095, -0.274, 0],
      [0.081, -0.223, 0],
    ],
    0.019,
    M.orange,
    30,
  );
  const latch = new T.Group();
  latch.name = 'Hook safety latch — rotate Z';
  latch.position.set(0, -0.152, 0.009);
  g.add(latch);
  tube(latch, [0, 0, 0], [0.083, -0.078, 0], 0.006, M.chrome);
  cylinder(latch, [0, 0, 0], 0.011, 0.035, M.steel).rotation.x = Math.PI / 2;
  bake(K, latch, 'winch-latch');
  bake(K, g, 'winch-body', [latch]);
  g.userData = {
    latch,
    swivel: g,
    attachment: new T.Vector3(0, 0.021, 0),
    loadPoint: new T.Vector3(0.008, -0.314, 0),
    forward: '+Z',
    cableAxis: 'Y',
    latchAxis: 'Z',
    latchOpenAngle: -0.65,
    mass: 0.55,
    height: 0.39,
  };
  return g;
}
