import * as THREE from 'three';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
const sphereGeometry = new THREE.SphereGeometry(1, 10, 7);
const planeGeometry = new THREE.PlaneGeometry(1, 1);
const palette = {
  trim: '#e7e8de',
  metal: '#a6b5b1',
  dark: '#30474c',
  paper: '#f2eddf',
  oak: '#b39873',
  petrol: '#315d63',
  fabric: '#748782',
  leaf: '#71826a',
};

// One immutable instance buffer per geometry/material. Small office fittings
// remain inexpensive even when the camera sees the entire open-plan room.
function detailBatch(parent, material) {
  const groups = new Map();
  const transform = new THREE.Object3D();
  function add(kind, x, y, z, sx, sy, sz, color = 'metal', rotation = 0) {
    const key = kind + ':' + color;
    if (!groups.has(key)) groups.set(key, { kind, color, matrices: [] });
    transform.position.set(x, y, z);
    transform.rotation.set(0, rotation, 0);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    groups.get(key).matrices.push(transform.matrix.clone());
  }
  return {
    box: (...args) => add('box', ...args),
    cylinder: (...args) => add('cylinder', ...args),
    sphere: (...args) => add('sphere', ...args),
    finish() {
      let instances = 0;
      for (const { kind, color, matrices } of groups.values()) {
        const geometry = { box: boxGeometry, cylinder: cylinderGeometry, sphere: sphereGeometry }[
          kind
        ];
        const mesh = new THREE.InstancedMesh(
          geometry,
          material(
            palette[color] || color,
            color === 'metal' ? 0.36 : 0.76,
            color === 'metal' ? 0.45 : 0,
          ),
          matrices.length,
        );
        mesh.name = 'Office fittings · ' + kind + ' · ' + color;
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        parent.add(mesh);
        instances += matrices.length;
      }
      return { batches: groups.size, instances };
    },
  };
}

function ceiling(parent, x, z, width, depth, height, surface) {
  const mesh = new THREE.Mesh(planeGeometry, surface);
  mesh.name = 'Ceiling underside';
  mesh.position.set(x, height, z);
  mesh.rotation.x = Math.PI / 2;
  mesh.scale.set(width, depth, 1);
  mesh.receiveShadow = true;
  // FrontSide faces down. The third-person camera can rise above the room
  // without replacing the playable view with an opaque roof.
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

function streetView(parent, d, material) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  const colors = ['#ddd2bd', '#d4d4c7', '#d9c4ad', '#d6d4c5'];
  for (let block = 0; block < 4; block++) {
    const origin = block * 256;
    c.fillStyle = colors[block];
    c.fillRect(origin, 0, 256, 512);
    for (let floor = 0; floor < 5; floor++) {
      const y = 24 + floor * 87;
      c.fillStyle = '#ece5d4';
      c.fillRect(origin, y + 68, 256, 6);
      c.fillStyle = '#b7aa94';
      c.fillRect(origin, y + 75, 256, 2);
      for (let column = 0; column < 4; column++) {
        const x = origin + 18 + column * 61;
        c.fillStyle = '#f0e9d8';
        c.fillRect(x - 4, y - 4, 41, 65);
        c.fillStyle = '#55727e';
        c.fillRect(x, y, 33, 55);
        c.fillStyle = '#8ca5ab';
        c.fillRect(x + 2, y + 2, 13, 30);
        c.fillStyle = '#e4dfce';
        c.fillRect(x + 15, y, 3, 55);
        c.fillRect(x, y + 30, 33, 3);
      }
    }
    c.fillStyle = '#6e7c79';
    c.fillRect(origin + 12, 451, 230, 61);
    c.fillStyle = '#cfc6b0';
    for (let x = origin + 12; x < origin + 250; x += 58) c.fillRect(x, 451, 6, 61);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  const facade = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.91 }),
  );
  facade.name = 'Brienner street view · Munich facades';
  facade.position.set(0, 10.5, -31);
  facade.scale.set(64, 21, 1);
  facade.receiveShadow = true;
  parent.add(facade);
  d.box(0, -0.08, -21, 65, 0.12, 21, '#737e7e');
  for (const z of [-13.5, -28.9]) {
    d.box(0, -0.01, z, 65, 0.14, 3.9, '#c4c7bb');
    d.box(0, 0.04, z + (z < -20 ? 2 : -2), 65, 0.16, 0.16, 'trim');
  }
  for (let x = -28; x <= 28; x += 7) d.box(x, 0.001, -21, 2.4, 0.008, 0.1, 'paper');
  for (const x of [-18, -7, 9, 22]) {
    d.cylinder(x, 1.55, -28, 0.13, 3.1, 0.13, '#776956');
    d.sphere(x, 4.05, -28, 1.8, 2, 1.8, 'leaf');
    d.sphere(x - 0.7, 3.7, -27.7, 1.15, 1.45, 1.2, 'leaf');
  }
}

export function buildOfficeDetail(world, { material }) {
  if (world.officeDetail) return world.officeDetail;
  const root = new THREE.Group();
  root.name = 'BBE · architectural details';
  world.groups.office.add(root);
  const d = detailBatch(root, material);
  const surface = new THREE.MeshStandardMaterial({
    color: '#dfe3db',
    roughness: 0.94,
    side: THREE.FrontSide,
  });
  const ceilings = [
    ceiling(root, 0, 0, 27, 22, 3.4, surface),
    ceiling(root, 34, 0, 12, 14, 3.5, surface),
    ceiling(root, 34, 24, 10, 8, 3.2, surface),
    ceiling(root, -19.75, 6, 12.5, 3.1, 3.3, surface),
    ceiling(root, -33, 1, 14, 16, 3.3, surface),
  ];
  // Wall-mounted trim never crosses a doorway or a walking route.
  for (const [x, z, width, depth] of [
    [-3.1, -10.85, 20.5, 0.07],
    [11.1, -10.85, 4.5, 0.07],
    [-13.35, -3.2, 0.07, 15.5],
    [-13.35, 9.1, 0.07, 3.5],
    [13.35, 0, 0.07, 21.6],
    [-7.2, 10.85, 12.3, 0.07],
    [2.15, 10.85, 2.15, 0.07],
    [9.1, 10.85, 8.4, 0.07],
  ])
    d.box(x, 0.095, z, width, 0.15, depth, 'trim');
  for (const x of [-10, -5, 0, 5, 11]) {
    d.box(x, 0.35, -10.61, 2.55, 0.49, 0.16, 'trim');
    for (let rib = 0; rib < 15; rib++)
      d.box(x - 1.18 + rib * 0.168, 0.35, -10.51, 0.052, 0.47, 0.045, 'metal');
    d.cylinder(x + 1.4, 0.19, -10.64, 0.022, 0.33, 0.022, 'metal');
  }
  // Acoustic rafts have shallow depth and leave the luminaire rows unobstructed.
  for (const z of [-8.8, -3.15, 2.8, 8.7]) {
    for (const x of [-8, -1, 6]) {
      d.box(x, 3.3, z, 3.8, 0.07, 1.3, 'fabric');
      d.box(x, 3.35, z, 0.025, 0.1, 1.0, 'metal');
    }
  }
  d.box(-6, 0.14, 7.56, 3.92, 0.12, 0.025, 'dark');
  for (const x of [-7.94, -4.06]) d.box(x, 0.65, 7.565, 0.055, 0.95, 0.02, 'oak');
  d.box(-6, 1.263, 6.55, 0.53, 0.022, 0.19, 'dark');
  d.box(-5.38, 1.271, 6.57, 0.25, 0.024, 0.36, 'fabric');
  d.sphere(-5.38, 1.303, 6.57, 0.052, 0.034, 0.08, 'dark');
  for (let i = 0; i < 3; i++)
    d.box(-7.33, 1.255 + i * 0.012, 7.04, 0.37, 0.011, 0.49, i === 2 ? 'petrol' : 'paper');
  d.box(-4.58, 1.305, 7.05, 0.26, 0.12, 0.1, 'metal');
  d.box(0, 0.013, 9.1, 2.15, 0.02, 1.7, 'dark');
  // Conference table: documents, table-top connectivity and a speakerphone.
  d.cylinder(8, 0.892, -1.1, 0.22, 0.054, 0.22, 'dark');
  d.cylinder(8, 0.921, -1.1, 0.029, 0.009, 0.029, 'petrol');
  d.box(8, 0.871, -0.55, 0.44, 0.012, 0.17, 'metal');
  for (const x of [6.4, 9.55]) {
    d.box(x, 0.88, -1.35, 0.42, 0.021, 0.59, 'paper', 0.07);
    d.box(x - 0.04, 0.893, -1.54, 0.27, 0.006, 0.025, 'petrol', 0.07);
    d.box(x + 0.27, 0.88, -1.32, 0.018, 0.018, 0.32, 'dark');
  }
  // Cupboards face the main office aisle, matching the coffee interaction.
  for (let x = 7.45; x < 13; x += 1) d.box(x, 0.77, 7.998, 0.32, 0.028, 0.034, 'metal');
  d.box(10.5, 0.982, 8.4, 0.79, 0.012, 0.41, 'dark');
  for (const x of [10.05, 10.95]) d.box(x, 0.995, 8.4, 0.06, 0.022, 0.53, 'metal');
  for (const z of [8.135, 8.665]) d.box(10.5, 0.995, z, 0.94, 0.022, 0.055, 'metal');
  d.box(10.5, 1.34, 8.38, 0.052, 0.044, 0.29, 'metal');
  d.cylinder(10.5, 1.295, 8.5, 0.025, 0.1, 0.025, 'metal');
  d.box(11.5, 1.01, 8.45, 0.44, 0.055, 0.3, 'oak');
  for (const x of [11.4, 11.59]) d.cylinder(x, 1.115, 8.45, 0.055, 0.155, 0.055, 'paper');
  d.box(12.5, 1.28, 9.293, 1.04, 0.018, 0.014, 'metal');
  d.box(12.91, 1.04, 9.26, 0.025, 0.43, 0.034, 'metal');
  // Printer controls and an output tray are supported by the existing housing.
  d.box(-11.28, 1.192, 3.38, 0.22, 0.012, 0.18, 'dark');
  d.box(-10.93, 0.7, 3.509, 0.62, 0.1, 0.025, 'dark');
  d.box(-10.93, 0.665, 3.63, 0.68, 0.035, 0.25, 'metal');
  d.box(-10.93, 0.69, 3.6, 0.5, 0.015, 0.21, 'paper');
  // Feet support the original lounge furniture without expanding its footprint.
  for (const x of [4.45, 6.35])
    for (const z of [-9.32, -8.68]) d.box(x, 0.0875, z, 0.1, 0.175, 0.1, 'dark');
  for (const x of [29.16, 29.84])
    for (const z of [0.64, 3.36]) d.box(x, 0.08, z, 0.1, 0.16, 0.1, 'dark');
  for (const x of [31.28, 32.72])
    for (const z of [1.58, 2.42]) d.box(x, 0.175, z, 0.065, 0.35, 0.065, 'dark');
  // Bathroom fittings sit against existing vanity / partition surfaces.
  for (const z of [24.7, 26.1]) {
    d.box(37.8, 1.22, z, 0.33, 0.045, 0.05, 'metal');
    d.box(37.57, 0.992, z + 0.47, 0.13, 0.21, 0.11, 'paper');
  }
  for (const x of [30.5, 33, 35.5]) {
    d.box(x, 1.29, 20.65, 0.19, 0.025, 0.07, 'metal');
    d.box(x + 0.99, 0.86, 21.55, 0.085, 0.12, 0.24, 'paper');
  }
  streetView(root, d, material);
  const budget = d.finish();
  world.officeDetail = { root, ceilings, ...budget };
  return world.officeDetail;
}
