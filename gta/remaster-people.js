import * as THREE from 'three';

// Locally authored anatomical meshes. Every actor keeps the original eight-joint
// contract; shared mesh templates and materials avoid per-NPC texture allocations.
const GEO = new Map();
const TORSO_ROWS = [
  [-0.302, 0.159, 0.104],
  [-0.284, 0.179, 0.11],
  [-0.195, 0.188, 0.111],
  [-0.11, 0.174, 0.111],
  [0.005, 0.183, 0.12],
  [0.13, 0.209, 0.131],
  [0.205, 0.227, 0.118],
  [0.249, 0.21, 0.099],
  [0.289, 0.098, 0.073],
  [0.304, 0.066, 0.059],
];
const HEAD_ROWS = [
  [-0.142, 0.018, 0.025, 0.074],
  [-0.129, 0.047, 0.057, 0.055],
  [-0.111, 0.073, 0.069, 0.039],
  [-0.075, 0.09, 0.086, 0.034],
  [-0.019, 0.101, 0.098, 0.025],
  [0.039, 0.102, 0.105, 0.021],
  [0.087, 0.095, 0.095, 0.017],
  [0.122, 0.072, 0.072, 0.014],
  [0.144, 0.02, 0.023, 0.012],
];
function section(rows, y) {
  let i = 1;
  while (i < rows.length - 1 && rows[i][0] < y) i++;
  const a = rows[i - 1],
    b = rows[i],
    t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  return [
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * t,
  ];
}
const PARTS = new Map();
const COLOR = new Map();
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const position = new THREE.Vector3();
const scaling = new THREE.Vector3();
const rotation = new THREE.Euler();
const color = (value) => {
  if (!COLOR.has(value)) COLOR.set(value, new THREE.Color(value));
  return COLOR.get(value);
};

function textileTexture(normal = false) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = grain - Math.floor(grain);
      const warp = Math.sin((x * Math.PI) / 2),
        weft = Math.cos((y * Math.PI) / 2);
      if (normal) {
        data[i] = 128 + warp * 17 + (noise - 0.5) * 8;
        data[i + 1] = 128 + weft * 15;
        data[i + 2] = 251;
      } else {
        data[i] = data[i + 1] = data[i + 2] = 244 + warp * weft * 4 + noise * 7;
      }
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  if (!normal) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.name = normal ? 'Woven suiting · thread normal' : 'Woven suiting · fibre albedo';
  return texture;
}

const materials = {
  fabric: new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.87,
    map: textileTexture(),
    normalMap: textileTexture(true),
    normalScale: new THREE.Vector2(0.22, 0.22),
  }),
  skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.63, metalness: 0 }),
  hair: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.76 }),
  leather: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.43, metalness: 0.03 }),
  eye: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26 }),
  mouth: new THREE.MeshStandardMaterial({ color: '#4b2827', roughness: 0.8 }),
};
for (const [kind, material] of Object.entries(materials)) {
  material.name = `Remaster human · ${kind}`;
  material.userData.remasterHuman = true;
  material.userData.remasterType = 'person';
}

function cached(key, make) {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
}
function primitive(type, far) {
  return cached(`${type}-${far}`, () => {
    if (type === 'sphere') return new THREE.SphereGeometry(1, far ? 8 : 12, far ? 5 : 8);
    if (type === 'disc') return new THREE.SphereGeometry(1, far ? 6 : 10, 4);
    return new THREE.BoxGeometry(1, 1, 1);
  });
}
class Surface {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.indices = [];
  }
  add(geometry, tint, xyz = [0, 0, 0], size = [1, 1, 1], angles = [0, 0, 0], textureScale = 1) {
    position.fromArray(xyz);
    scaling.fromArray(size);
    rotation.set(...angles);
    quaternion.setFromEuler(rotation);
    matrix.compose(position, quaternion, scaling);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = geometry.attributes.position,
      n = geometry.attributes.normal,
      uv = geometry.attributes.uv;
    const offset = this.p.length / 3,
      point = new THREE.Vector3(),
      normal = new THREE.Vector3();
    const rgb = color(tint);
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(matrix);
      normal.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
      this.p.push(point.x, point.y, point.z);
      this.n.push(normal.x, normal.y, normal.z);
      this.uv.push((uv?.getX(i) || 0) * textureScale, (uv?.getY(i) || 0) * textureScale);
      this.c.push(rgb.r, rgb.g, rgb.b);
    }
    for (let i = 0, length = geometry.index?.count || p.count; i < length; i++)
      this.indices.push(offset + (geometry.index ? geometry.index.getX(i) : i));
    return this;
  }
  finish(name) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.indices);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    g.name = name;
    return g;
  }
}

// Oval sections form continuous cheeks, tailoring, elbows and knees, instead of
// intersecting cylinders. Seam-sized radius changes catch light as cloth folds.
function loft(rows, sides = 12) {
  const vertices = [],
    uvs = [],
    indices = [];
  rows.forEach(([y, rx, rz, z = 0, x = 0], row) => {
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      vertices.push(x + Math.sin(a) * rx, y, z + Math.cos(a) * rz);
      uvs.push(s / sides, row / (rows.length - 1));
      if (row && s < sides) {
        const b = row * (sides + 1) + s,
          a0 = b - sides - 1;
        indices.push(a0, a0 + 1, b, a0 + 1, b + 1, b);
      }
    }
  });
  for (const rowIndex of [0, rows.length - 1]) {
    const row = rows[rowIndex],
      center = vertices.length / 3;
    vertices.push(row[4] || 0, row[0], row[3] || 0);
    uvs.push(0.5, 0.5);
    const base = rowIndex * (sides + 1);
    for (let i = 0; i < sides; i++)
      rowIndex === 0
        ? indices.push(center, base + i + 1, base + i)
        : indices.push(center, base + i, base + i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let r = 0; r < rows.length; r++) {
    const a = r * (sides + 1),
      b = a + sides,
      v = new THREE.Vector3()
        .fromBufferAttribute(n, a)
        .add(new THREE.Vector3().fromBufferAttribute(n, b))
        .normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}
function poly(points, layer = 0.009) {
  const positions = [],
    indices = [],
    uvs = [];
  const contour = points.map((p) => new THREE.Vector2(p[0], p[1]));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  const put = (p) => {
    const [rx, rz] = section(TORSO_ROWS, p[1]);
    const z = rz * Math.sqrt(Math.max(0, 1 - (p[0] / rx) ** 2)) + layer;
    const i = positions.length / 3;
    positions.push(p[0], p[1], z);
    uvs.push(p[0] * 7, p[1] * 7);
    return i;
  };
  const subdivide = (a, b, c, depth) => {
    if (!depth) {
      indices.push(put(a), put(b), put(c));
      return;
    }
    const ab = a.map((v, i) => (v + b[i]) * 0.5),
      bc = b.map((v, i) => (v + c[i]) * 0.5),
      ca = c.map((v, i) => (v + a[i]) * 0.5);
    subdivide(a, ab, ca, depth - 1);
    subdivide(ab, b, bc, depth - 1);
    subdivide(ca, bc, c, depth - 1);
    subdivide(ab, bc, ca, depth - 1);
  };
  for (const tri of triangles) subdivide(...tri.map((i) => points[i]), 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function seam(points, radius, far = false) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    far ? 3 : 6,
    radius,
    far ? 3 : 4,
    false,
  );
}
function shade(hex, factor) {
  return '#' + color(hex).clone().multiplyScalar(factor).getHexString();
}

function body(palette, far) {
  const s = new Surface(),
    sides = far ? 8 : 16,
    jacket = palette.jacket;
  const tailored = cached(`jacket-form-${far}`, () => loft(TORSO_ROWS, sides));
  s.add(tailored, jacket, [0, 0, 0], [1, 1, 1], [0, 0, 0], 7);
  s.add(primitive('sphere', far), palette.pants, [0, -0.24, -0.002], [0.183, 0.084, 0.109]);
  // Shirt opening, folded lapels and pocket welts are truly raised geometry.
  s.add(
    poly([
      [-0.065, 0.284, 0.07],
      [-0.092, 0.225, 0.121],
      [0, -0.045, 0.128],
      [0.09, 0.225, 0.122],
      [0.065, 0.284, 0.07],
    ]),
    '#eeeae2',
  );
  for (const side of [-1, 1]) {
    const points = [
      [side * 0.067, 0.288, 0.075],
      [side * 0.144, 0.217, 0.121],
      [side * 0.091, 0.146, 0.14],
      [side * 0.116, 0.131, 0.141],
      [side * 0.014, -0.099, 0.125],
    ];
    if (side > 0) points.reverse();
    s.add(poly(points, 0.016), shade(jacket, 1.12));
    s.add(
      seam(
        [
          [side * 0.09, 0.144, 0.145],
          [side * 0.072, 0.096, 0.151],
          [side * 0.016, -0.101, 0.128],
        ],
        0.0022,
        far,
      ),
      shade(jacket, 0.61),
    );
    s.add(
      primitive('box', far),
      shade(jacket, 0.69),
      [side * 0.122, -0.165, 0.101],
      [0.084, 0.006, 0.009],
      [0, side * -0.12, side * 0.04],
    );
  }
  s.add(
    poly([
      [-0.033, 0.267, 0.088],
      [-0.007, 0.219, 0.132],
      [0.007, 0.24, 0.128],
      [-0.006, 0.279, 0.092],
    ]),
    '#f8f5ed',
  );
  s.add(
    poly([
      [0.033, 0.267, 0.088],
      [0.006, 0.279, 0.092],
      [-0.007, 0.24, 0.128],
      [0.007, 0.219, 0.132],
    ]),
    '#dddcd6',
  );
  s.add(
    poly(
      [
        [-0.011, 0.227, 0.135],
        [-0.014, 0.026, 0.137],
        [0, 0.004, 0.139],
        [0.014, 0.026, 0.137],
        [0.01, 0.227, 0.135],
      ],
      0.023,
    ),
    '#85703d',
  );
  s.add(primitive('disc', far), '#89764f', [0, 0.222, 0.136], [0.012, 0.014, 0.005]);
  for (const y of [-0.045, -0.124])
    s.add(primitive('disc', far), '#283031', [0.018, y, 0.124], [0.006, 0.006, 0.003]);
  s.add(
    primitive('box', far),
    shade(jacket, 0.62),
    [0.103, 0.118, 0.133],
    [0.081, 0.006, 0.008],
    [0, -0.1, 0],
  );
  s.add(
    poly([
      [0.073, 0.119, 0.139],
      [0.076, 0.141, 0.143],
      [0.091, 0.13, 0.143],
      [0.105, 0.144, 0.139],
      [0.119, 0.12, 0.133],
    ]),
    '#e9e4d8',
  );
  return s.finish('Tailored wool jacket · lapels / shirt / pocket square');
}

function upperArm(palette, far, side) {
  const s = new Surface();
  const form = cached(`upper-arm-${side}-${far}`, () =>
    loft(
      [
        [-0.338, 0.054, 0.055, 0, side * 0.04],
        [-0.311, 0.064, 0.059, 0, side * 0.037],
        [-0.265, 0.061, 0.061, 0, side * 0.033],
        [-0.178, 0.068, 0.068, 0, side * 0.025],
        [-0.067, 0.077, 0.077, 0, side * 0.01],
        [0.012, 0.084, 0.079],
        [0.054, 0.067, 0.066],
        [0.084, 0.018, 0.022],
      ],
      far ? 8 : 12,
    ),
  );
  s.add(form, palette.jacket, [0, 0, 0], [1, 1, 1], [0, 0, 0], 4);
  return s.finish('Jacket sleeve · shoulder to elbow');
}
function forearm(palette, far) {
  const s = new Surface();
  const form = cached(`forearm-${far}`, () =>
    loft(
      [
        [-0.276, 0.042, 0.042],
        [-0.249, 0.045, 0.043],
        [-0.235, 0.047, 0.046],
        [-0.215, 0.045, 0.045],
        [-0.15, 0.052, 0.051],
        [-0.076, 0.058, 0.058],
        [-0.018, 0.061, 0.059],
        [0.025, 0.05, 0.044],
      ],
      far ? 8 : 12,
    ),
  );
  s.add(form, palette.jacket, [0, 0, 0], [1, 1, 1], [0, 0, 0], 4);
  s.add(primitive('disc', far), '#e6e5df', [0, -0.274, 0], [0.043, 0.011, 0.043]);
  if (!far)
    for (const y of [-0.21, -0.234, -0.254])
      s.add(primitive('disc', true), '#414543', [0.045, y, -0.012], [0.003, 0.005, 0.005]);
  return s.finish('Tapered forearm · cuff and sleeve buttons');
}
function hand(palette, far, side) {
  const s = new Surface(),
    skin = palette.skin;
  s.add(primitive('sphere', far), skin, [0, -0.307, 0.002], [0.034, 0.045, 0.023]);
  if (far) s.add(primitive('sphere', true), skin, [0, -0.348, 0.006], [0.029, 0.033, 0.021]);
  else
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.014,
        len = [0.039, 0.05, 0.049, 0.038][i];
      s.add(
        primitive('sphere', true),
        skin,
        [x, -0.336 - len * 0.45, 0.007],
        [0.008, len * 0.62, 0.01],
        [0.07, 0, (i - 1.5) * -0.035],
      );
      s.add(primitive('disc', true), shade(skin, 0.94), [x, -0.352, 0.016], [0.007, 0.002, 0.002]);
    }
  s.add(
    primitive('sphere', far),
    skin,
    [side * 0.034, -0.316, 0.018],
    [0.012, 0.027, 0.013],
    [0.25, 0, side * 0.48],
  );
  if (!far)
    s.add(
      primitive('sphere', true),
      skin,
      [side * 0.041, -0.337, 0.026],
      [0.01, 0.019, 0.011],
      [0.4, 0, side * -0.1],
    );
  return s.finish('Anatomical hand · palm / thumb / four separated fingers');
}
function thigh(palette, far) {
  const s = new Surface();
  const form = cached(`thigh-${far}`, () =>
    loft(
      [
        [-0.42, 0.063, 0.066],
        [-0.388, 0.069, 0.072, 0.006],
        [-0.354, 0.068, 0.073, 0.009],
        [-0.313, 0.07, 0.079, 0.011],
        [-0.23, 0.081, 0.084],
        [-0.11, 0.092, 0.086],
        [0.018, 0.094, 0.086],
        [0.053, 0.076, 0.073],
      ],
      far ? 8 : 12,
    ),
  );
  s.add(form, palette.pants, [0, 0, 0], [1, 1, 1], [0, 0, 0], 5);
  if (!far)
    s.add(
      seam(
        [
          [0, 0.025, 0.087],
          [0, -0.16, 0.087],
          [0, -0.33, 0.086],
        ],
        0.0018,
      ),
      shade(palette.pants, 1.18),
    );
  return s.finish('Pressed trousers · thigh');
}
function shin(palette, far) {
  const s = new Surface();
  const form = cached(`shin-${far}`, () =>
    loft(
      [
        [-0.347, 0.052, 0.056],
        [-0.329, 0.059, 0.063],
        [-0.311, 0.054, 0.057],
        [-0.27, 0.057, 0.059],
        [-0.16, 0.064, 0.067, -0.005],
        [-0.08, 0.067, 0.067],
        [-0.025, 0.065, 0.071],
        [0.022, 0.06, 0.06],
      ],
      far ? 8 : 12,
    ),
  );
  s.add(form, palette.pants, [0, 0, 0], [1, 1, 1], [0, 0, 0], 5);
  s.add(primitive('disc', far), '#323839', [0, -0.35, 0], [0.049, 0.039, 0.052]);
  return s.finish('Pressed trousers · calf / hem / sock');
}
function shoe(palette, far) {
  const s = new Surface(),
    base = primitive('sphere', far);
  s.add(base, '#282729', [0, -0.402, 0.052], [0.072, 0.038, 0.148]);
  s.add(base, '#2d2b2a', [0, -0.378, 0.043], [0.069, 0.058, 0.136]);
  s.add(base, '#181b1d', [0, -0.422, 0.055], [0.074, 0.012, 0.151]);
  if (!far) {
    s.add(
      seam(
        [
          [-0.055, -0.379, 0.121],
          [0, -0.352, 0.135],
          [0.055, -0.379, 0.121],
        ],
        0.002,
      ),
      '#3f3a36',
    );
    for (let i = 0; i < 3; i++)
      s.add(
        seam(
          [
            [-0.018, -0.327 - i * 0.002, 0.024 + i * 0.014],
            [0, -0.32 - i * 0.002, 0.03 + i * 0.014],
            [0.018, -0.327 - i * 0.002, 0.024 + i * 0.014],
          ],
          0.0019,
        ),
        '#534c41',
      );
  }
  return s.finish('Leather Oxford shoe · sole / toe cap / laces');
}
function headSkin(palette, far) {
  const s = new Surface(),
    skin = palette.skin;
  const form = cached(`head-${far}`, () => loft(HEAD_ROWS, far ? 10 : 18));
  s.add(form, skin);
  for (const side of [-1, 1]) {
    s.add(
      primitive('sphere', far),
      skin,
      [side * 0.105, -0.002, 0.013],
      [0.015, 0.03, 0.021],
      [0, 0, side * -0.08],
    );
    if (!far) {
      s.add(
        primitive('sphere', true),
        shade(skin, 0.77),
        [side * 0.116, -0.002, 0.025],
        [0.005, 0.02, 0.008],
      );
      s.add(
        seam(
          [
            [side * 0.019, 0.032, 0.134],
            [side * 0.04, 0.04, 0.143],
            [side * 0.063, 0.033, 0.135],
          ],
          0.004,
        ),
        skin,
      );
      s.add(
        seam(
          [
            [side * 0.021, 0.024, 0.136],
            [side * 0.04, 0.021, 0.143],
            [side * 0.061, 0.025, 0.137],
          ],
          0.0025,
        ),
        shade(skin, 0.87),
      );
      s.add(primitive('sphere', true), skin, [side * 0.014, -0.027, 0.143], [0.011, 0.009, 0.018]);
      s.add(
        primitive('disc', true),
        shade(skin, 0.48),
        [side * 0.015, -0.033, 0.154],
        [0.005, 0.003, 0.005],
      );
    }
  }
  s.add(primitive('sphere', far), skin, [0, 0.003, 0.136], [0.013, 0.04, 0.018]);
  s.add(primitive('sphere', far), skin, [0, -0.018, 0.153], [0.019, 0.017, 0.024]);
  if (!far) {
    s.add(primitive('disc', false), shade(skin, 0.79), [0, -0.052, 0.149], [0.028, 0.006, 0.005]);
    s.add(primitive('disc', false), shade(skin, 0.93), [0, -0.065, 0.148], [0.025, 0.005, 0.006]);
  }
  return s.finish('Anatomical head · jaw / cheeks / nose / ears / eyelids');
}
function hair(palette, far) {
  const s = new Surface(),
    vertices = [],
    uvs = [],
    indices = [],
    sides = far ? 12 : 20,
    rings = far ? 4 : 7;
  for (let r = 0; r <= rings; r++)
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        front = Math.max(0, Math.cos(a));
      const base = -0.057 + front * 0.132,
        amount = r / rings;
      const y = base + (0.16 - base) * amount;
      const [rx, rz, zc] = section(HEAD_ROWS, Math.min(y, 0.144));
      const close = y > 0.144 ? Math.max(0.001, (0.16 - y) / 0.016) : 1;
      const ridge = far ? 0 : Math.sin(a * 7 + amount * 3) * 0.001;
      vertices.push(
        Math.sin(a) * (rx + 0.013 + ridge) * close,
        y,
        Math.cos(a) * (rz + 0.014 + ridge) * close + zc,
      );
      uvs.push(i / sides, r / rings);
      if (r && i < sides) {
        const b = r * (sides + 1) + i,
          a0 = b - sides - 1;
        indices.push(a0, a0 + 1, b, a0 + 1, b + 1, b);
      }
    }
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cap.setIndex(indices);
  cap.computeVertexNormals();
  s.add(cap, palette.hair);
  for (const side of [-1, 1]) {
    s.add(
      primitive('disc', far),
      palette.hair,
      [side * 0.101, 0.025, 0.001],
      [0.007, 0.043, 0.031],
    );
    if (!far)
      s.add(
        seam(
          [
            [side * 0.019, 0.049, 0.141],
            [side * 0.041, 0.053, 0.142],
            [side * 0.066, 0.048, 0.131],
          ],
          0.0035,
        ),
        palette.hair,
      );
  }
  if (!far)
    for (let i = 0; i < 5; i++) {
      const x = -0.067 + i * 0.028;
      s.add(
        seam(
          [
            [x, 0.101, 0.077],
            [x + 0.02, 0.151, 0.024],
            [x + 0.012, 0.112, -0.067],
          ],
          0.0025,
        ),
        shade(palette.hair, 1.2),
      );
    }
  return s.finish('Combed hair · tapered hairline / sideburns / eyebrows');
}
function eyes(palette) {
  const s = new Surface();
  for (const side of [-1, 1]) {
    s.add(primitive('disc', false), '#d1d0c5', [side * 0.04, 0.029, 0.135], [0.022, 0.006, 0.008]);
    s.add(primitive('disc', false), '#4b493a', [side * 0.04, 0.029, 0.142], [0.006, 0.0058, 0.002]);
    s.add(
      primitive('disc', true),
      '#182326',
      [side * 0.04, 0.029, 0.1438],
      [0.0028, 0.0043, 0.0008],
    );
    s.add(
      primitive('disc', true),
      '#d9dfd5',
      [side * 0.038, 0.031, 0.1445],
      [0.0012, 0.0012, 0.0003],
    );
  }
  return s.finish('Inset eyes · sclera / irises / pupils');
}
function neck(palette, far) {
  const s = new Surface();
  const form = cached(`neck-${far}`, () =>
    loft(
      [
        [-0.089, 0.062, 0.062],
        [-0.034, 0.055, 0.057],
        [0.029, 0.048, 0.054],
        [0.06, 0.056, 0.05],
      ],
      far ? 8 : 12,
    ),
  );
  s.add(form, palette.skin);
  return s.finish('Neck · clavicle transition');
}

const builders = { body, upperArm, forearm, hand, thigh, shin, shoe, headSkin, hair, eyes, neck };
function partGeometry(kind, palette, side = 0, far = false) {
  const colors =
    kind === 'body'
      ? `${palette.jacket}/${palette.pants}`
      : ['upperArm', 'forearm'].includes(kind)
        ? palette.jacket
        : ['headSkin', 'hand', 'neck'].includes(kind)
          ? palette.skin
          : kind === 'hair'
            ? palette.hair
            : ['thigh', 'shin'].includes(kind)
              ? palette.pants
              : 'shared';
  const key = `${kind}:${colors}:${side}:${far}`;
  if (!PARTS.has(key)) PARTS.set(key, builders[kind](palette, far, side));
  return PARTS.get(key);
}

export function buildRealisticHuman({
  jacket = '#244e60',
  pants = '#24333a',
  skin = '#d1a382',
  hair: hairColor = '#41362f',
  scale = 1,
  crowd = false,
} = {}) {
  const palette = { jacket, pants, skin, hair: hairColor };
  const actor = new THREE.Group();
  actor.name = 'Remastered Munich citizen';
  actor.scale.setScalar(scale);
  actor.userData.remasterType = 'person';
  actor.userData.remasterHuman = true;
  actor.userData.phase = Math.random() * Math.PI * 2;
  const rig = {},
    lods = [];
  const add = (parent, kind, material, xyz = [0, 0, 0], side = 0, detailOnly = false) => {
    const near = partGeometry(
      kind,
      palette,
      side,
      crowd && !['headSkin', 'hair', 'eyes'].includes(kind),
    );
    const mesh = new THREE.Mesh(near, materials[material]);
    mesh.position.fromArray(xyz);
    mesh.name = near.name;
    mesh.castShadow = !detailOnly;
    mesh.receiveShadow = true;
    mesh.userData.remasterType = 'person';
    mesh.userData.remasterHuman = true;
    parent.add(mesh);
    lods.push({
      mesh,
      near,
      far: detailOnly ? near : partGeometry(kind, palette, side, true),
      detailOnly,
    });
    return mesh;
  };
  add(actor, 'body', 'fabric', [0, 1.1, 0]);
  add(actor, 'neck', 'skin', [0, 1.44, 0]);
  add(actor, 'headSkin', 'skin', [0, 1.62, 0]);
  add(actor, 'hair', 'hair', [0, 1.62, 0]);
  add(actor, 'eyes', 'eye', [0, 1.62, 0], 0, true);
  const mouth = new THREE.Mesh(
    cached('speech-mouth', () => primitive('disc', false).clone().scale(1, 0.5, 1)),
    materials.mouth,
  );
  mouth.name = 'Lip aperture · speech morph';
  mouth.position.set(0, 1.564, 0.153);
  // Existing cinematics animate this exact scale, so no controller needs a new rig.
  mouth.scale.set(0.022, 0.009, 0.0018);
  mouth.userData.remasterHuman = true;
  actor.add(mouth);
  actor.userData.mouth = mouth;
  lods.push({ mesh: mouth, near: mouth.geometry, far: mouth.geometry, detailOnly: true });
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'left' : 'right';
    const leg = new THREE.Group();
    leg.name = `${key} hip`;
    leg.position.set(side * 0.105, 0.86, 0);
    actor.add(leg);
    add(leg, 'thigh', 'fabric');
    const lower = new THREE.Group();
    lower.name = `${key} knee`;
    lower.position.y = -0.4;
    leg.add(lower);
    add(lower, 'shin', 'fabric');
    add(lower, 'shoe', 'leather');
    const arm = new THREE.Group();
    arm.name = `${key} shoulder`;
    arm.position.set(side * 0.24, 1.28, 0);
    actor.add(arm);
    add(arm, 'upperArm', 'fabric', [0, 0, 0], side);
    const fore = new THREE.Group();
    fore.name = `${key} elbow`;
    fore.position.set(side * 0.04, -0.32, 0);
    arm.add(fore);
    add(fore, 'forearm', 'fabric');
    add(fore, 'hand', 'skin', [0, 0, 0], side);
    rig[`${key}Leg`] = leg;
    rig[`${key}Shin`] = lower;
    rig[`${key}Arm`] = arm;
    rig[`${key}Fore`] = fore;
  }
  actor.userData.rig = rig;
  actor.userData.remasterLods = lods;
  actor.userData.remasterFar = false;
  actor.userData.remasterFixedLOD = crowd;
  return actor;
}

/** Optional: call once per visible actor after camera distance is known. */
export function setRealisticHumanDetail(actor, distance) {
  if (!actor?.userData?.remasterHuman || actor.userData.remasterFixedLOD) return;
  const previous = actor.userData.remasterFar;
  // A four-metre hysteresis band avoids switches on every step near the threshold.
  const far = previous ? distance > 24 : distance > 28;
  if (far === previous) return;
  actor.userData.remasterFar = far;
  for (const part of actor.userData.remasterLods) {
    part.mesh.geometry = far ? part.far : part.near;
    if (part.detailOnly) part.mesh.visible = !far;
  }
}

export function remasterPeopleResourceInfo() {
  return {
    templateGeometries: GEO.size,
    coloredGeometries: PARTS.size,
    materials: Object.keys(materials).length,
    textureCount: 2,
    rigJoints: 8,
  };
}
