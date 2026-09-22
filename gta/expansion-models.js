// Procedural, original meshes for BBE: Munich Consulting Simulator.
// +Y is up, +Z is forward. Every model's origin sits on its support surface.
// No DOM, textures, loader, external assets or global THREE dependency.
const resources = new WeakMap();

function kit(T) {
  if (resources.has(T)) return resources.get(T);
  const materials = new Map(),
    geometries = new Map();
  const material = (name, color, roughness = 0.45, metalness = 0, extra = {}) => {
    if (!materials.has(name))
      materials.set(name, new T.MeshPhysicalMaterial({ color, roughness, metalness, ...extra }));
    return materials.get(name);
  };
  const geo = (key, fn) => {
    if (!geometries.has(key)) geometries.set(key, fn());
    return geometries.get(key);
  };
  const M = {
    petrol: material('petrol', '#204a55', 0.34, 0.28, { clearcoat: 1, clearcoatRoughness: 0.15 }),
    cream: material('cream', '#e9dfc7', 0.34, 0.2, { clearcoat: 0.4 }),
    orange: material('orange', '#f29b66', 0.35, 0.05),
    black: material('black', '#17242c', 0.49, 0.1),
    rubber: material('rubber', '#202626', 0.88, 0.0),
    chrome: material('chrome', '#c8d3d3', 0.25, 0.87),
    steel: material('steel', '#71858a', 0.42, 0.75),
    leather: material('leather', '#794e38', 0.79, 0.0),
    glass: material('aircraft-glass', '#a4bac1', 0.075, 0.03, {
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    redLight: material('red-light', '#f33f2d', 0.2, 0.1, {
      emissive: '#ff2410',
      emissiveIntensity: 1.6,
    }),
    greenLight: material('green-light', '#42dfa0', 0.2, 0.1, {
      emissive: '#20cc8e',
      emissiveIntensity: 1.3,
    }),
    warmLight: material('warm-light', '#fff2bc', 0.15, 0.1, {
      emissive: '#ffe9ab',
      emissiveIntensity: 1.8,
    }),
    birdGlass: material('bird-glass', '#ca254c', 0.16, 0.08, {
      clearcoat: 1,
      transparent: true,
      opacity: 0.86,
    }),
    tubeGlass: material('tube-glass', '#e0eff0', 0.12, 0.03, {
      clearcoat: 1,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    blue: material('blue-felt', '#358fac', 0.9, 0.0),
    beak: material('beak', '#dfb875', 0.55, 0.0),
    wood: material('wood', '#c2a078', 0.68, 0.0),
    clearGlass: material('clear-glass', '#d5ebea', 0.11, 0.1, {
      transparent: true,
      opacity: 0.24,
      side: T.DoubleSide,
      depthWrite: false,
      clearcoat: 1,
    }),
    water: material('water', '#61b2c2', 0.1, 0.03, {
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      clearcoat: 1,
    }),
    white: material('white', '#f5f2e8', 0.37, 0.0),
  };
  const cube = geo('cube', () => new T.BoxGeometry(1, 1, 1));
  const ball = geo('sphere', () => new T.SphereGeometry(1, 24, 16));
  const unitTube = geo('unit-cylinder', () => new T.CylinderGeometry(1, 1, 1, 12));
  const mesh = (g, geometry, mat) => {
    const m = new T.Mesh(geometry, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (g, p, size, mat) => {
    const m = mesh(g, cube, mat);
    m.position.set(...p);
    m.scale.set(...size);
    return m;
  };
  const sphere = (g, p, size, mat) => {
    const m = mesh(g, ball, mat);
    m.position.set(...p);
    m.scale.set(...size);
    return m;
  };
  const tube = (g, a, b, r, mat) => {
    const va = new T.Vector3(...a),
      vb = new T.Vector3(...b),
      delta = vb.clone().sub(va);
    const m = mesh(g, unitTube, mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.scale.set(r, delta.length(), r);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return m;
  };
  const cylinder = (g, p, radius, height, mat, top = radius, segments = 20) => {
    const m = mesh(
      g,
      geo(
        `cyl-${radius}-${top}-${height}-${segments}`,
        () => new T.CylinderGeometry(top, radius, height, segments),
      ),
      mat,
    );
    m.position.set(...p);
    return m;
  };
  const torus = (g, p, radius, thickness, mat, arc = Math.PI * 2, radial = 8, tubular = 40) => {
    const m = mesh(
      g,
      geo(
        `ring-${radius}-${thickness}-${arc}-${radial}-${tubular}`,
        () => new T.TorusGeometry(radius, thickness, radial, tubular, arc),
      ),
      mat,
    );
    m.position.set(...p);
    return m;
  };
  const curvedTube = (g, points, radius, mat, segments = 28) => {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
    const key = 'curve:' + radius + ':' + segments + ':' + points.map((p) => p.join(',')).join(';');
    return mesh(
      g,
      geo(key, () => new T.TubeGeometry(curve, segments, radius, 7, false)),
      mat,
    );
  };
  const roundedBox = (g, p, size, mat) => {
    const geometry = geo('rounded-box', () => {
      const s = new T.Shape();
      s.moveTo(-0.4, -0.5);
      s.lineTo(0.4, -0.5);
      s.quadraticCurveTo(0.5, -0.5, 0.5, -0.4);
      s.lineTo(0.5, 0.4);
      s.quadraticCurveTo(0.5, 0.5, 0.4, 0.5);
      s.lineTo(-0.4, 0.5);
      s.quadraticCurveTo(-0.5, 0.5, -0.5, 0.4);
      s.lineTo(-0.5, -0.4);
      s.quadraticCurveTo(-0.5, -0.5, -0.4, -0.5);
      const e = new T.ExtrudeGeometry(s, {
        depth: 0.8,
        bevelEnabled: true,
        bevelSize: 0.05,
        bevelThickness: 0.1,
        bevelSegments: 2,
        steps: 1,
        curveSegments: 3,
      });
      e.translate(0, 0, -0.4);
      return e;
    });
    const m = mesh(g, geometry, mat);
    m.position.set(...p);
    m.scale.set(...size);
    return m;
  };
  const K = {
    T,
    M,
    geo,
    mesh,
    box,
    sphere,
    tube,
    cylinder,
    torus,
    curvedTube,
    roundedBox,
    unitTube,
  };
  resources.set(T, K);
  return K;
}

function ellipsoidPoint(T, azimuth, elevation, expansion = 1) {
  return new T.Vector3(
    1.24 * Math.sin(azimuth) * Math.cos(elevation) * expansion,
    2.1 + 1.08 * Math.sin(elevation) * expansion,
    0.7 + 3.5 * Math.cos(azimuth) * Math.cos(elevation) * expansion,
  );
}

function curvedPanel(K, g, az1, az2, el1, el2, mat, frame = false) {
  const { T, mesh, curvedTube, M } = K,
    positions = [],
    indices = [],
    nu = Math.max(14, Math.ceil(Math.abs(az2 - az1) * 10)),
    nv = Math.max(8, Math.ceil(Math.abs(el2 - el1) * 10));
  for (let y = 0; y <= nv; y++)
    for (let x = 0; x <= nu; x++) {
      const p = ellipsoidPoint(
        T,
        az1 + ((az2 - az1) * x) / nu,
        el1 + ((el2 - el1) * y) / nv,
        mat === M.glass ? 1.027 : 1.008,
      );
      positions.push(p.x, p.y, p.z);
    }
  for (let y = 0; y < nv; y++)
    for (let x = 0; x < nu; x++) {
      const a = y * (nu + 1) + x,
        b = a + 1,
        c = a + nu + 1,
        d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const shared = K.geo(
    'curved-panel:' + [az1, az2, el1, el2, mat === M.glass].join(':'),
    () => geometry,
  );
  if (shared !== geometry) geometry.dispose();
  const panel = mesh(g, shared, mat);
  if (mat.transparent) panel.castShadow = false;
  if (frame) {
    for (const edge of [
      [az1, el1, az2, el1],
      [az2, el1, az2, el2],
      [az2, el2, az1, el2],
      [az1, el2, az1, el1],
    ]) {
      const points = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        return ellipsoidPoint(
          T,
          edge[0] + (edge[2] - edge[0]) * t,
          edge[1] + (edge[3] - edge[1]) * t,
          mat === M.glass ? 1.036 : 1.018,
        ).toArray();
      });
      curvedTube(g, points, 0.025, M.black, 12);
    }
  }
  return panel;
}

// Batch static opaque details by material while keeping every articulation intact.
// Cached batches are shared by subsequent instances of the same model.
function bakeStatic(K, group, key, excluded = []) {
  const { T, mesh, geo } = K,
    skip = new Set(excluded),
    batches = new Map();
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  function walk(node) {
    if (skip.has(node)) return;
    if (
      node.isMesh &&
      !node.isInstancedMesh &&
      !Array.isArray(node.material) &&
      !node.material.transparent
    ) {
      if (!batches.has(node.material)) batches.set(node.material, []);
      batches.get(node.material).push(node);
    }
    for (const child of node.children) walk(child);
  }
  for (const child of group.children) walk(child);
  let index = 0;
  for (const [material, list] of batches) {
    if (list.length < 2) continue;
    const geometry = geo(`${key}-batch-${index++}`, () => {
      const positions = [],
        normals = [],
        p = new T.Vector3(),
        normal = new T.Vector3();
      for (const item of list) {
        const matrix = inverse.clone().multiply(item.matrixWorld),
          normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
        const position = item.geometry.getAttribute('position'),
          sourceNormal = item.geometry.getAttribute('normal');
        const indices = item.geometry.index,
          count = indices ? indices.count : position.count;
        for (let i = 0; i < count; i++) {
          const j = indices ? indices.getX(i) : i;
          p.fromBufferAttribute(position, j).applyMatrix4(matrix);
          positions.push(p.x, p.y, p.z);
          normal.fromBufferAttribute(sourceNormal, j).applyMatrix3(normalMatrix).normalize();
          normals.push(normal.x, normal.y, normal.z);
        }
      }
      const result = new T.BufferGeometry();
      result.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      result.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      result.computeBoundingSphere();
      return result;
    });
    for (const item of list) item.removeFromParent();
    const combined = mesh(group, geometry, material);
    combined.name = `${key} static detail batch`;
  }
}

// A true cabin shell: glazing apertures contain no hidden opaque ellipsoid.
// Each patch is shared and baked; the additional cockpit does not add draw calls
// per gauge or per fuselage rivet to repeated aircraft instances.
function aircraftHull(K, g) {
  const { T, M, mesh, geo } = K;
  const az = [
    -Math.PI,
    -2.35,
    -1.78,
    -1.68,
    -1.625,
    -0.965,
    -0.91,
    -0.76,
    -0.02,
    0.02,
    0.76,
    0.91,
    0.965,
    1.625,
    1.68,
    1.78,
    2.35,
    Math.PI,
  ];
  const el = [
    -Math.PI / 2 + 0.002,
    -0.49,
    -0.3,
    0.06,
    0.1,
    0.12,
    0.57,
    0.65,
    0.8,
    Math.PI / 2 - 0.002,
  ];
  const windows = (a, e) => {
    a = Math.abs(a);
    return (
      (a > 0.02 && a < 0.76 && e > 0.06 && e < 0.8) ||
      (a > 0.965 && a < 1.625 && e > 0.12 && e < 0.57) ||
      (a > 1.78 && a < 2.35 && e > 0.1 && e < 0.57)
    );
  };
  for (const finish of ['cream', 'petrol']) {
    const geometry = geo('remaster-aircraft-shell-' + finish, () => {
      const positions = [],
        indices = [],
        normals = [];
      for (let y = 0; y < el.length - 1; y++)
        for (let x = 0; x < az.length - 1; x++) {
          const a = (az[x] + az[x + 1]) / 2,
            e = (el[y] + el[y + 1]) / 2;
          if (windows(a, e)) continue;
          const color =
            e < -0.3 || (Math.abs(a) > 0.91 && Math.abs(a) < 1.68 && e < 0.65) ? 'petrol' : 'cream';
          if (color !== finish) continue;
          const base = positions.length / 3,
            nu = 4,
            nv = 3;
          for (let v = 0; v <= nv; v++)
            for (let u = 0; u <= nu; u++) {
              const p = ellipsoidPoint(
                T,
                az[x] + ((az[x + 1] - az[x]) * u) / nu,
                el[y] + ((el[y + 1] - el[y]) * v) / nv,
                1.008,
              );
              positions.push(p.x, p.y, p.z);
              const normal = new T.Vector3(
                p.x / (1.24 * 1.24),
                (p.y - 2.1) / (1.08 * 1.08),
                (p.z - 0.7) / (3.5 * 3.5),
              ).normalize();
              normals.push(normal.x, normal.y, normal.z);
            }
          for (let v = 0; v < nv; v++)
            for (let u = 0; u < nu; u++) {
              const i = base + v * (nu + 1) + u;
              indices.push(i, i + 1, i + nu + 2, i, i + nu + 2, i + nu + 1);
            }
        }
      const result = new T.BufferGeometry();
      result.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      result.setIndex(indices);
      result.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      return result;
    });
    const shell = mesh(g, geometry, M[finish]);
    shell.name = 'Open aircraft cabin shell ' + finish;
  }
}
function aircraftDoorOutline(K, g, az1, az2) {
  for (const [a1, e1, a2, e2] of [
    [az1, -0.49, az2, -0.49],
    [az2, -0.49, az2, 0.65],
    [az2, 0.65, az1, 0.65],
    [az1, 0.65, az1, -0.49],
  ]) {
    const p = Array.from({ length: 9 }, (_, i) =>
      ellipsoidPoint(K.T, a1 + ((a2 - a1) * i) / 8, e1 + ((e2 - e1) * i) / 8, 1.014).toArray(),
    );
    K.curvedTube(g, p, 0.012, K.M.black, 16);
  }
}
function aircraftInterior(K, g) {
  const { M, roundedBox, tube, cylinder, sphere, box } = K;
  roundedBox(g, [0, 1.38, 0.45], [1.72, 0.07, 3.75], M.black);
  for (const z of [2.16, 0.2])
    for (const side of [-1, 1]) {
      const x = side * 0.43;
      roundedBox(g, [x, 1.7, z], [0.57, 0.11, 0.61], M.leather);
      const back = roundedBox(g, [x, 2.01, z - 0.27], [0.56, 0.59, 0.12], M.leather);
      back.rotation.x = -0.11;
      roundedBox(g, [x, 2.38, z - 0.3], [0.34, 0.18, 0.14], M.black);
      tube(g, [x - 0.19, 2.26, z - 0.18], [x + 0.19, 1.76, z + 0.03], 0.013, M.black);
      box(g, [x + 0.16, 1.77, z + 0.035], [0.035, 0.045, 0.016], M.chrome);
      if (z > 1) {
        tube(g, [x, 1.46, z + 0.05], [x, 1.98, z + 0.24], 0.023, M.black);
        const grip = cylinder(g, [x, 2.02, z + 0.25], 0.034, 0.12, M.rubber);
        grip.rotation.x = -0.25;
        tube(g, [x - side * 0.29, 1.65, z], [x - side * 0.29, 1.76, z + 0.34], 0.025, M.black);
      }
    }
  const panel = roundedBox(g, [0, 2.0, 2.91], [1.5, 0.54, 0.16], M.black);
  panel.rotation.x = 0.15;
  for (const x of [-0.43, 0, 0.43]) {
    roundedBox(g, [x, 2.04, 2.805], [0.34, 0.25, 0.019], M.chrome);
    roundedBox(g, [x, 2.04, 2.79], [0.3, 0.21, 0.01], M.petrol);
    for (let row = 0; row < 3; row++)
      box(g, [x - 0.06, 2.08 - row * 0.048, 2.78], [0.11 + row * 0.025, 0.006, 0.005], M.cream);
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const knob = cylinder(
        g,
        [side * (0.09 + i * 0.12), 1.81, 2.79],
        0.014,
        0.02,
        i % 2 ? M.chrome : M.black,
        0.014,
        8,
      );
      knob.rotation.x = Math.PI / 2;
    }
  roundedBox(g, [0, 1.68, 1.82], [0.2, 0.44, 1.2], M.black);
  tube(g, [0, 1.98, 1.97], [0, 2.11, 2.13], 0.02, M.chrome);
  sphere(g, [0, 2.115, 2.13], [0.034, 0.034, 0.034], M.black);
  for (const side of [-1, 1]) {
    // Cabin handles, window seals and external maintenance rivets.
    tube(g, [side * 0.92, 2.65, 0.8], [side * 0.92, 2.65, 1.15], 0.023, M.chrome);
    for (let i = 0; i < 10; i++) {
      const p = ellipsoidPoint(K.T, side * (0.95 + i * 0.14), -0.38, 1.017);
      sphere(g, p.toArray(), [0.012, 0.012, 0.012], M.chrome);
    }
  }
}

export function createHelicopter(THREE) {
  const K = kit(THREE),
    { T, M, geo, mesh, sphere, tube, cylinder, box, roundedBox, curvedTube } = K;
  const g = new T.Group();
  g.name = 'BBE executive utility helicopter · Remaster';
  aircraftHull(K, g);
  aircraftInterior(K, g);
  // The curved windshield follows the fuselage instead of floating as flat cubes.
  curvedPanel(K, g, -0.76, -0.02, 0.06, 0.8, M.glass, true);
  curvedPanel(K, g, 0.02, 0.76, 0.06, 0.8, M.glass, true);
  for (const side of [-1, 1]) {
    const az = side === 1 ? [0.91, 1.68] : [-1.68, -0.91];
    aircraftDoorOutline(K, g, az[0], az[1]);
    const rearAz = side === 1 ? [1.78, 2.35] : [-2.35, -1.78];
    curvedPanel(K, g, rearAz[0], rearAz[1], 0.1, 0.57, M.glass, true);
    curvedPanel(K, g, az[0] + 0.055, az[1] - 0.055, 0.12, 0.57, M.glass, true);
    const handle = ellipsoidPoint(T, side * 1.3, -0.04, 1.05);
    tube(
      g,
      [handle.x, handle.y, handle.z - 0.12],
      [handle.x, handle.y, handle.z + 0.12],
      0.035,
      M.chrome,
    );
    for (const elevation of [-0.33, 0.5]) {
      const hinge = ellipsoidPoint(T, side * 1.67, elevation, 1.025);
      cylinder(g, hinge.toArray(), 0.032, 0.11, M.chrome);
    }
    // Belly access tread and paint chevrons.
    roundedBox(g, [side * 1.17, 1.13, 0.58], [0.35, 0.09, 1.3], M.black);
    for (let i = 0; i < 3; i++) {
      const mark = box(g, [side * 1.205, 1.61, 0.1 + i * 0.17], [0.028, 0.21, 0.075], M.orange);
      mark.rotation.x = -0.4;
    }
  }
  // Engine housing, exhausts, cooling slots and mechanical mast.
  sphere(g, [0, 3.08, -0.57], [0.83, 0.43, 1.42], M.petrol);
  for (const side of [-1, 1]) {
    const pipe = cylinder(g, [side * 0.6, 3.16, -1.81], 0.19, 0.5, M.steel, 0.15);
    pipe.rotation.x = Math.PI / 2;
    const mouth = cylinder(g, [side * 0.6, 3.16, -2.065], 0.14, 0.012, M.black);
    mouth.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++)
      box(g, [side * 0.794, 3.1, -0.95 + i * 0.18], [0.022, 0.17, 0.065], M.black);
  }
  cylinder(g, [0, 3.57, -0.07], 0.13, 0.62, M.chrome);
  for (let i = 0; i < 3; i++)
    cylinder(g, [0, 3.32 + i * 0.12, -0.07], 0.2 - i * 0.016, 0.045, M.steel);
  for (const side of [-1, 1]) {
    tube(g, [side * 0.24, 3.25, -0.16], [side * 0.34, 3.69, 0.04], 0.019, M.chrome);
    tube(g, [side * 0.36, 3.15, 0.11], [side * 0.24, 3.65, -0.2], 0.02, M.steel);
    roundedBox(g, [side * 0.51, 3.27, 0.37], [0.39, 0.2, 0.32], M.black);
    for (let i = 0; i < 6; i++)
      box(g, [side * 0.51, 3.3, 0.24 + i * 0.045], [0.33, 0.028, 0.012], M.steel);
  }
  cylinder(g, [0, 3.42, -0.07], 0.25, 0.12, M.black);
  const mainRotor = new T.Group();
  mainRotor.name = 'Main rotor — rotate Y';
  mainRotor.position.set(0, 3.91, -0.07);
  g.add(mainRotor);
  sphere(mainRotor, [0, 0.005, 0], [0.28, 0.12, 0.28], M.steel);
  const bladeGeometry = geo('main-rotor-blade', () => {
    const s = new T.Shape();
    s.moveTo(-0.15, 0.25);
    s.lineTo(0.15, 0.25);
    s.lineTo(0.11, 5.5);
    s.lineTo(-0.08, 5.5);
    s.closePath();
    const e = new T.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: false });
    e.rotateX(Math.PI / 2);
    e.translate(0, 0.0225, 0);
    return e;
  });
  for (let i = 0; i < 4; i++) {
    const blade = new T.Group();
    blade.rotation.y = (i * Math.PI) / 2 + 0.13;
    mainRotor.add(blade);
    mesh(blade, bladeGeometry, M.black);
    box(blade, [0, 0.026, 5.31], [0.2, 0.012, 0.32], M.orange);
    tube(blade, [-0.12, -0.04, 0.1], [-0.12, -0.04, 0.7], 0.026, M.chrome);
    cylinder(
      mainRotor,
      [Math.sin((i * Math.PI) / 2) * 0.16, 0.13, Math.cos((i * Math.PI) / 2) * 0.16],
      0.038,
      0.035,
      M.chrome,
    );
  }
  // Tapered tail boom points aft (-Z).
  const boomA = new T.Vector3(0, 2.4, -2.05),
    boomB = new T.Vector3(0, 2.98, -6.61);
  const boom = mesh(
    g,
    geo('tail-boom', () => new T.CylinderGeometry(0.14, 0.43, boomA.distanceTo(boomB), 20)),
    M.petrol,
  );
  boom.position.copy(boomA).add(boomB).multiplyScalar(0.5);
  boom.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), boomB.clone().sub(boomA).normalize());
  const finGeometry = geo('tail-fin', () => {
    const s = new T.Shape();
    s.moveTo(-0.12, -0.15);
    s.lineTo(0.1, 1.34);
    s.lineTo(-0.65, 1.47);
    s.lineTo(-0.88, -0.52);
    s.closePath();
    const e = new T.ExtrudeGeometry(s, {
      depth: 0.09,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.02,
      bevelSegments: 1,
    });
    e.rotateY(Math.PI / 2);
    return e;
  });
  const fin = mesh(g, finGeometry, M.cream);
  fin.position.set(-0.045, 2.79, -6.39);
  box(g, [0, 3.57, -6.3], [0.105, 0.29, 0.52], M.orange);
  const stabilizer = roundedBox(g, [0, 2.85, -5.57], [3.05, 0.075, 0.58], M.cream);
  stabilizer.rotation.x = -0.07;
  const tailRotor = new T.Group();
  tailRotor.name = 'Tail rotor — rotate X';
  tailRotor.position.set(-0.28, 3.38, -6.48);
  g.add(tailRotor);
  const tailHub = cylinder(tailRotor, [0, 0, 0], 0.12, 0.3, M.chrome);
  tailHub.rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const blade = new T.Group();
    blade.rotation.x = (i * Math.PI) / 2 + 0.3;
    tailRotor.add(blade);
    const m = roundedBox(blade, [-0.08, 0.54, 0], [0.044, 0.91, 0.12], M.black);
    m.rotation.x = -0.03;
    box(blade, [-0.08, 0.93, 0], [0.052, 0.17, 0.135], M.orange);
  }
  // Shared skid rail geometry with curved tips.
  const skidGeometry = geo(
    'skid',
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3([
          new T.Vector3(0, 0.24, -3.01),
          new T.Vector3(0, 0.12, -2.72),
          new T.Vector3(0, 0.11, -1.4),
          new T.Vector3(0, 0.11, 1.8),
          new T.Vector3(0, 0.19, 2.72),
          new T.Vector3(0, 0.5, 3.04),
        ]),
        32,
        0.082,
        9,
        false,
      ),
  );
  for (const side of [-1, 1]) {
    const skid = mesh(g, skidGeometry, M.steel);
    skid.position.x = side * 1.34;
    for (const z of [-1.2, 1.44])
      tube(g, [side * 0.81, 1.55, z], [side * 1.34, 0.17, z - 0.08], 0.075, M.steel);
    for (const z of [-1.3, 1.45])
      cylinder(g, [side * 1.34, 0.13, z], 0.095, 0.12, M.black).rotation.x = Math.PI / 2;
  }
  const red = sphere(g, [-1.28, 2.62, -0.37], [0.08, 0.07, 0.12], M.redLight);
  const green = sphere(g, [1.28, 2.62, -0.37], [0.08, 0.07, 0.12], M.greenLight);
  const beacon = sphere(g, [0, 3.6, -1.14], [0.09, 0.11, 0.09], M.redLight);
  for (const x of [-0.46, 0.46]) sphere(g, [x, 1.64, 3.65], [0.13, 0.1, 0.035], M.warmLight);
  tube(g, [0, 3.09, 1.82], [0, 3.71, 1.51], 0.018, M.black);
  tube(g, [0, 1.25, -0.7], [0, 0.9, -0.98], 0.018, M.black);
  bakeStatic(K, mainRotor, 'helicopter-main-rotor');
  bakeStatic(K, tailRotor, 'helicopter-tail-rotor');
  bakeStatic(K, g, 'helicopter-body', [mainRotor, tailRotor, red, green, beacon]);
  g.userData = {
    remastered: true,
    cabinShell: true,
    mainRotor,
    tailRotor,
    navigationLights: [red, green, beacon],
    forward: '+Z',
    groundY: 0,
    rotorDiameter: 11,
    fuselageLength: 7,
    seat: new T.Vector3(-0.43, 1.77, 2.16),
    passengerSeat: new T.Vector3(0.43, 1.77, 2.16),
    cameraTarget: new T.Vector3(0, 2.2, 0.3),
    colliderHalfExtents: new T.Vector3(1.28, 1.25, 3.5),
    colliderCenter: new T.Vector3(0, 2.1, 0.7),
  };
  return g;
}

export function createRideableBike(THREE) {
  const K = kit(THREE),
    { T, M, geo, mesh, tube, box, cylinder, torus, roundedBox, curvedTube, unitTube } = K;
  const g = new T.Group();
  g.name = 'Augusten city bicycle · Remaster';
  const rear = [0, 0.37, -0.72],
    front = [0, 0.37, 0.8],
    bb = [0, 0.36, -0.1],
    seat = [0, 1.02, -0.32];
  const headTop = [0, 1.01, 0.55],
    headBottom = [0, 0.8, 0.62];
  tube(g, bb, seat, 0.025, M.petrol);
  tube(g, seat, headTop, 0.024, M.petrol);
  tube(g, bb, headBottom, 0.029, M.petrol);
  tube(g, headBottom, headTop, 0.035, M.petrol);
  for (const side of [-1, 1]) {
    tube(g, [side * 0.035, ...bb.slice(1)], [side * 0.057, ...rear.slice(1)], 0.013, M.petrol);
    tube(
      g,
      [side * 0.027, seat[1] - 0.02, seat[2]],
      [side * 0.057, ...rear.slice(1)],
      0.012,
      M.petrol,
    );
  }
  tube(g, seat, [0, 1.14, -0.355], 0.018, M.chrome);
  const saddleGeometry = geo('bike-saddle', () => {
    const shape = new T.Shape();
    shape.moveTo(-0.078, -0.145);
    shape.quadraticCurveTo(-0.12, -0.13, -0.11, -0.045);
    shape.quadraticCurveTo(-0.095, 0.02, -0.043, 0.06);
    shape.quadraticCurveTo(-0.026, 0.105, -0.028, 0.15);
    shape.quadraticCurveTo(0, 0.185, 0.028, 0.15);
    shape.quadraticCurveTo(0.026, 0.105, 0.043, 0.06);
    shape.quadraticCurveTo(0.095, 0.02, 0.11, -0.045);
    shape.quadraticCurveTo(0.12, -0.13, 0.078, -0.145);
    shape.quadraticCurveTo(0, -0.17, -0.078, -0.145);
    const e = new T.ExtrudeGeometry(shape, {
      depth: 0.038,
      bevelEnabled: true,
      bevelSize: 0.01,
      bevelThickness: 0.014,
      bevelSegments: 3,
      curveSegments: 5,
    });
    e.rotateX(Math.PI / 2);
    return e;
  });
  const saddle = mesh(g, saddleGeometry, M.leather);
  saddle.position.set(0, 1.175, -0.365);
  saddle.rotation.x = -0.035;
  tube(g, [-0.045, 1.11, -0.49], [-0.045, 1.105, -0.22], 0.009, M.chrome);
  tube(g, [0.045, 1.11, -0.49], [0.045, 1.105, -0.22], 0.009, M.chrome);
  for (const side of [-1, 1])
    curvedTube(
      g,
      [
        [side * 0.025, 1.177, -0.23],
        [side * 0.044, 1.181, -0.35],
        [side * 0.092, 1.175, -0.45],
        [side * 0.074, 1.172, -0.5],
      ],
      0.0017,
      M.cream,
      14,
    );
  cylinder(g, [0, 1.055, -0.332], 0.027, 0.032, M.black);

  function wheel(parent, position) {
    const w = new T.Group();
    w.name = 'Wheel — rotate X';
    w.position.set(...position);
    parent.add(w);
    torus(w, [0, 0, 0], 0.342, 0.027, M.rubber, Math.PI * 2, 10, 48).rotation.y = Math.PI / 2;
    torus(w, [0, 0, 0], 0.315, 0.012, M.chrome, Math.PI * 2, 7, 48).rotation.y = Math.PI / 2;
    for (const x of [-0.024, 0.024])
      torus(w, [x, 0, 0], 0.34, 0.0027, M.cream, Math.PI * 2, 4, 40).rotation.y = Math.PI / 2;
    const axle = cylinder(w, [0, 0, 0], 0.025, 0.145, M.chrome);
    axle.rotation.z = Math.PI / 2;
    const spokes = new T.InstancedMesh(unitTube, M.chrome, 32);
    spokes.castShadow = false;
    spokes.receiveShadow = true;
    w.add(spokes);
    const dummy = new T.Object3D(),
      up = new T.Vector3(0, 1, 0);
    for (let i = 0; i < 32; i++) {
      const angle = (i * Math.PI) / 16,
        side = i % 2 ? 1 : -1;
      const a = new T.Vector3(
        side * 0.051,
        Math.sin(angle + side * 0.4) * 0.025,
        Math.cos(angle + side * 0.4) * 0.025,
      );
      const b = new T.Vector3(0, Math.sin(angle) * 0.307, Math.cos(angle) * 0.307),
        delta = b.clone().sub(a);
      dummy.position.copy(a).add(b).multiplyScalar(0.5);
      dummy.scale.set(0.0018, delta.length(), 0.0018);
      dummy.quaternion.setFromUnitVectors(up, delta.normalize());
      dummy.updateMatrix();
      spokes.setMatrixAt(i, dummy.matrix);
    }
    spokes.instanceMatrix.needsUpdate = true;
    const reflector = roundedBox(w, [0.016, 0.02, 0.19], [0.018, 0.026, 0.067], M.orange);
    reflector.rotation.x = -0.2;

    const rotor = torus(w, [-0.047, 0, 0], 0.069, 0.01, M.steel, Math.PI * 2, 5, 32);
    rotor.rotation.y = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      tube(
        w,
        [-0.047, Math.sin(a) * 0.018, Math.cos(a) * 0.018],
        [-0.047, Math.sin(a + 0.25) * 0.065, Math.cos(a + 0.25) * 0.065],
        0.0035,
        M.steel,
      );
    }
    for (const side of [-1, 1])
      cylinder(w, [side * 0.072, 0, 0], 0.022, 0.012, M.black, 0.022, 8).rotation.z = Math.PI / 2;
    return w;
  }
  const rearWheel = wheel(g, rear);
  const handlebar = new T.Group();
  handlebar.name = 'Steering assembly — rotate Y';
  handlebar.position.set(0, 0.82, 0.615);
  g.add(handlebar);
  const localFront = [front[0], front[1] - 0.82, front[2] - 0.615];
  for (const side of [-1, 1])
    curvedTube(
      handlebar,
      [
        [side * 0.05, 0.045, 0],
        [side * 0.068, -0.24, 0.086],
        [side * 0.067, localFront[1], localFront[2]],
      ],
      0.018,
      M.petrol,
      14,
    );
  const frontWheel = wheel(handlebar, localFront);
  roundedBox(
    handlebar,
    [-0.052, localFront[1] + 0.057, localFront[2] - 0.043],
    [0.038, 0.05, 0.058],
    M.black,
  );
  roundedBox(g, [-0.052, rear[1] + 0.057, rear[2] - 0.043], [0.038, 0.05, 0.058], M.black);
  for (const side of [-1, 1]) {
    const axleCap = cylinder(
      handlebar,
      [side * 0.072, localFront[1], localFront[2]],
      0.024,
      0.012,
      M.chrome,
      0.024,
      8,
    );
    axleCap.rotation.z = Math.PI / 2;
    tube(g, [side * 0.085, 0.39, -0.7], [side * 0.085, 0.31, -0.62], 0.013, M.steel);
  }
  curvedTube(
    g,
    [
      [0.018, 0.65, 0.14],
      [0.052, 0.57, 0.09],
      [0.046, 0.49, 0.04],
      [-0.046, 0.49, 0.04],
      [-0.052, 0.57, 0.09],
      [-0.018, 0.65, 0.14],
    ],
    0.005,
    M.chrome,
    18,
  );
  tube(g, [0.073, 0.31, -0.64], [0.074, 0.18, -0.68], 0.012, M.black);
  for (const z of [-0.61, -0.72])
    torus(g, [0.08, 0.21, z], 0.025, 0.006, M.steel, Math.PI * 2, 5, 16).rotation.y = Math.PI / 2;

  tube(handlebar, [0, 0.02, 0], [0, 0.305, -0.095], 0.022, M.chrome);
  curvedTube(
    handlebar,
    [
      [-0.34, 0.32, -0.08],
      [-0.23, 0.32, 0.01],
      [-0.13, 0.31, 0.035],
      [0, 0.31, 0.04],
      [0.13, 0.31, 0.035],
      [0.23, 0.32, 0.01],
      [0.34, 0.32, -0.08],
    ],
    0.016,
    M.chrome,
    24,
  );
  for (const side of [-1, 1]) {
    tube(handlebar, [side * 0.245, 0.32, -0.015], [side * 0.352, 0.32, -0.092], 0.025, M.rubber);
    tube(handlebar, [side * 0.22, 0.302, 0.01], [side * 0.3, 0.277, -0.055], 0.008, M.black);
  }
  cylinder(handlebar, [-0.16, 0.342, 0.025], 0.03, 0.018, M.chrome);
  curvedTube(
    handlebar,
    [
      [-0.21, 0.3, 0.0],
      [-0.27, 0.09, 0.18],
      [-0.12, -0.01, 0.21],
      [-0.048, -0.17, 0.15],
    ],
    0.0035,
    M.black,
    16,
  );
  curvedTube(
    handlebar,
    [
      [0.21, 0.3, 0.0],
      [0.28, 0.12, 0.19],
      [0.1, -0.1, -0.02],
      [0.04, -0.06, -0.12],
    ],
    0.0035,
    M.black,
    16,
  );
  // Fenders and a useful rear luggage carrier stay fixed while wheels spin.
  const rearFender = torus(g, rear, 0.384, 0.022, M.cream, Math.PI, 7, 30);
  rearFender.rotation.y = Math.PI / 2;
  const frontFender = torus(handlebar, localFront, 0.384, 0.022, M.cream, Math.PI, 7, 30);
  frontFender.rotation.y = Math.PI / 2;
  for (const side of [-1, 1]) {
    tube(g, [side * 0.065, 0.41, -0.74], [side * 0.082, 0.85, -0.96], 0.007, M.steel);
    tube(g, [side * 0.074, 0.83, -0.97], [side * 0.074, 0.83, -0.42], 0.008, M.steel);
  }
  for (const z of [-0.94, -0.76, -0.56, -0.44])
    tube(g, [-0.076, 0.83, z], [0.076, 0.83, z], 0.007, M.steel);
  roundedBox(g, [0, 0.815, -1.005], [0.095, 0.048, 0.025], M.redLight);
  const light = cylinder(handlebar, [0, -0.15, 0.2], 0.035, 0.07, M.black);
  light.rotation.x = Math.PI / 2;
  const lens = cylinder(handlebar, [0, -0.15, 0.242], 0.029, 0.008, M.warmLight);
  lens.rotation.x = Math.PI / 2;
  // Chainring, paired cranks, real pedals and a chain outline.
  const crank = new T.Group();
  crank.name = 'Crank — rotate X';
  crank.position.set(...bb);
  g.add(crank);
  torus(crank, [0.08, 0, 0], 0.093, 0.009, M.chrome, Math.PI * 2, 7, 28).rotation.y = Math.PI / 2;
  const axle = cylinder(crank, [0, 0, 0], 0.023, 0.21, M.steel);
  axle.rotation.z = Math.PI / 2;
  const pedals = [];
  for (const side of [-1, 1]) {
    tube(crank, [side * 0.11, 0, 0], [side * 0.11, 0, side * 0.155], 0.014, M.chrome);
    const pedal = new T.Group();
    pedal.position.set(side * 0.17, 0, side * 0.155);
    crank.add(pedal);
    roundedBox(pedal, [0, 0, 0], [0.095, 0.031, 0.067], M.black);
    for (const z of [-0.034, 0.034]) box(pedal, [0, 0, z], [0.065, 0.019, 0.005], M.orange);
    pedals.push(pedal);
  }
  const chainPoints = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i * Math.PI) / 16;
    chainPoints.push([0.082, bb[1] + Math.cos(a) * 0.096, bb[2] + Math.sin(a) * 0.096]);
  }
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i * Math.PI) / 16;
    chainPoints.push([0.082, rear[1] + Math.cos(a) * 0.045, rear[2] + Math.sin(a) * 0.045]);
  }
  chainPoints.push(chainPoints[0]);
  curvedTube(g, chainPoints, 0.0045, M.steel, 52);
  for (let i = 0; i < 7; i++) {
    const cog = cylinder(
      g,
      [0.064 + i * 0.005, rear[1], rear[2]],
      0.061 - i * 0.0055,
      0.006,
      M.steel,
    );
    cog.rotation.z = Math.PI / 2;
  }
  tube(g, [-0.08, 0.34, -0.18], [-0.19, 0.055, -0.35], 0.008, M.steel);
  const bottle = cylinder(g, [0, 0.6, 0.06], 0.032, 0.19, M.cream, 0.028);
  bottle.rotation.x = -0.61;
  const cap = cylinder(g, [0, 0.68, 0.005], 0.02, 0.025, M.orange);
  cap.rotation.x = -0.61;
  bakeStatic(K, rearWheel, 'bike-rear-wheel');
  bakeStatic(K, frontWheel, 'bike-front-wheel');
  pedals.forEach((pedal, i) => bakeStatic(K, pedal, 'bike-pedal-' + i));
  bakeStatic(K, crank, 'bike-crank', pedals);
  bakeStatic(K, handlebar, 'bike-handlebar', [frontWheel]);
  bakeStatic(K, g, 'bike-frame', [rearWheel, handlebar, crank]);
  g.userData = {
    remastered: true,
    discBrakes: true,
    wheels: [rearWheel, frontWheel],
    crank,
    handlebar,
    pedals,
    wheelRadius: 0.369,
    wheelbase: 1.52,
    forward: '+Z',
    groundY: 0,
    seat: new T.Vector3(0, 1.2, -0.34),
    hands: [new T.Vector3(-0.31, 1.14, 0.55), new T.Vector3(0.31, 1.14, 0.55)],
    cameraTarget: new T.Vector3(0, 1.15, -0.1),
    steerLimit: 0.5,
  };
  return g;
}

export function createDrinkingBird(THREE) {
  const K = kit(THREE),
    { T, M, geo, mesh, sphere, tube, cylinder, torus, roundedBox } = K;
  const g = new T.Group();
  g.name = 'Thermodynamic consulting bird';
  roundedBox(g, [0, 0.027, 0.035], [0.44, 0.045, 0.73], M.wood);
  for (const x of [-0.168, 0.168]) {
    roundedBox(g, [x, 0.063, -0.045], [0.075, 0.03, 0.3], M.petrol);
    tube(g, [x, 0.079, -0.08], [x, 0.39, 0], 0.012, M.chrome);
    sphere(g, [x, 0.39, 0], [0.027, 0.027, 0.027], M.petrol);
  }
  tube(g, [-0.19, 0.39, 0], [0.19, 0.39, 0], 0.012, M.chrome);
  const pivot = new T.Group();
  pivot.name = 'Bird pivot — rotate X toward +Z';
  pivot.position.set(0, 0.39, 0);
  g.add(pivot);
  sphere(pivot, [0, -0.14, 0], [0.114, 0.134, 0.114], M.birdGlass);
  sphere(pivot, [-0.029, -0.108, 0.058], [0.026, 0.04, 0.014], M.tubeGlass);
  cylinder(pivot, [0, 0.078, 0], 0.018, 0.38, M.tubeGlass);
  cylinder(pivot, [0, 0.012, 0], 0.0065, 0.22, M.birdGlass);
  sphere(pivot, [0, 0.24, 0], [0.091, 0.091, 0.091], M.blue);
  // Beak tip meets the water at approximately pivot.rotation.x = 1.20 rad.
  const beak = mesh(
    pivot,
    geo('bird-beak', () => new T.ConeGeometry(0.036, 0.18, 14)),
    M.beak,
  );
  beak.position.set(0, 0.231, 0.16);
  beak.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    sphere(pivot, [side * 0.074, 0.258, 0.044], [0.017, 0.019, 0.012], M.white);
    sphere(pivot, [side * 0.08, 0.258, 0.052], [0.009, 0.011, 0.007], M.black);
  }
  cylinder(pivot, [0, 0.33, 0], 0.105, 0.016, M.black);
  cylinder(pivot, [0, 0.37, -0.004], 0.064, 0.077, M.black, 0.059);
  cylinder(pivot, [0, 0.345, -0.004], 0.065, 0.013, M.orange);
  sphere(pivot, [0, 0.416, -0.004], [0.013, 0.009, 0.013], M.orange);
  // The counterweight and clamp are separate from the fixed support axle.
  cylinder(pivot, [0, -0.008, 0], 0.026, 0.08, M.orange).rotation.z = Math.PI / 2;
  tube(pivot, [-0.105, 0, -0.007], [-0.105, -0.092, -0.032], 0.008, M.black);
  tube(pivot, [0.105, 0, -0.007], [0.105, -0.092, -0.032], 0.008, M.black);
  // Open glass cylinder, polished rim and a separate liquid surface.
  const glassGeometry = geo(
    'bird-water-glass',
    () => new T.CylinderGeometry(0.091, 0.077, 0.228, 32, 1, true),
  );
  const glass = mesh(g, glassGeometry, M.clearGlass);
  glass.position.set(0, 0.168, 0.32);
  glass.castShadow = false;
  cylinder(g, [0, 0.058, 0.32], 0.077, 0.01, M.clearGlass);
  const rim = torus(g, [0, 0.284, 0.32], 0.091, 0.0043, M.clearGlass, Math.PI * 2, 7, 36);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = false;
  const water = cylinder(g, [0, 0.151, 0.32], 0.081, 0.169, M.water, 0.087, 32);
  water.castShadow = false;
  const surface = cylinder(g, [0, 0.237, 0.32], 0.087, 0.002, M.water, 0.087, 32);
  surface.castShadow = false;
  bakeStatic(K, pivot, 'bird-pivot');
  bakeStatic(K, g, 'bird-stand', [pivot, water, surface, glass]);
  g.userData = {
    pivot,
    water,
    waterSurface: surface,
    glass,
    forward: '+Z',
    groundY: 0,
    drinkingAngle: 1.2,
    restAngle: -0.11,
    waterSurfaceY: 0.238,
    footprint: { width: 0.46, depth: 0.75 },
    height: 0.83,
  };
  return g;
}
