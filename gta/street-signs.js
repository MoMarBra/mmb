import * as THREE from 'three';

const metal = new THREE.MeshStandardMaterial({ color: '#65716e', roughness: 0.57, metalness: 0.58 });
const enamel = new THREE.MeshStandardMaterial({ color: '#244e77', roughness: 0.46, metalness: 0.24 });
const poleGeometry = new THREE.CylinderGeometry(0.055, 0.068, 1, 12);
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
const textures = new Map();

function mesh(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}
function textTexture(text, sub, bg, fg) {
  const key = [text, sub, bg, fg].join('|');
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = sub ? 256 : 144;
  const c = canvas.getContext('2d'),
    h = canvas.height;
  c.fillStyle = bg;
  c.fillRect(0, 0, 1024, h);
  c.strokeStyle = fg;
  c.lineWidth = 5;
  c.strokeRect(9, 9, 1006, h - 18);
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '600 ' + Math.min(sub ? 70 : 88, 1530 / Math.max(12, text.length)) + 'px Arial';
  c.fillText(text, 512, sub ? 101 : h / 2, 950);
  if (sub) {
    c.font = '33px Arial';
    c.fillText(sub, 512, 189, 950);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textures.set(key, texture);
  return texture;
}

/** Independent front-facing meshes keep the text readable on BOTH sides.
 * The back is not a mirrored DoubleSide render of the front texture. */
export function createStreetSign(world, options) {
  const {
    x,
    z,
    text,
    sub = '',
    rotation = 0,
    panelY = 3.12,
    width = Math.max(2.35, Math.min(4.1, text.length * 0.12)),
    height = sub ? 0.72 : 0.4,
    bg = '#244e77',
    fg = '#f4f2e8',
    arrows = false,
    id = text + ':' + x + ':' + z,
  } = options;
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotation;
  root.name = 'Street sign · ' + text;
  world.groups.city.add(root);
  // The post supports the panel from BELOW: a pole through its centre would
  // protrude past both text faces and obscure lettering from either direction.
  const top = panelY - height / 2 - 0.025;
  const post = mesh(root, poleGeometry, metal, 0, top / 2, 0, 1, top, 1);
  mesh(root, boxGeometry, metal, 0, top - 0.035, 0, 0.19, 0.07, 0.075);
  mesh(root, boxGeometry, metal, 0, 0.1, 0, 0.3, 0.2, 0.3);
  mesh(root, boxGeometry, enamel, 0, panelY, 0, width + 0.06, height + 0.05, 0.075);
  const faces = [];
  for (const back of [false, true]) {
    const flip = (value) => (back && arrows ? value.replace(/[←→]/g, (a) => (a === '←' ? '→' : '←')) : value);
    const face = mesh(
      root,
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        map: textTexture(flip(text), flip(sub), bg, fg),
        roughness: 0.61,
        metalness: 0.05,
        emissive: '#a7b7b3',
        emissiveIntensity: 0.12,
        side: THREE.FrontSide,
      }),
      0,
      panelY,
      back ? -0.043 : 0.043,
    );
    face.rotation.y = back ? Math.PI : 0;
    face.castShadow = false;
    face.userData.signText = flip(text);
    face.userData.signSubtitle = flip(sub);
    faces.push(face);
  }
  world.obstacle('city', x, z, 0.14, 0.14, top / 2, top);
  const entry = { id, x, z, text, sub, rotation, width, height, panelY, post, root, faces };
  (world.streetSigns ||= []).push(entry);
  return entry;
}

export const SIGNAL_JUNCTIONS = Object.freeze([
  Object.freeze({ x: 0, z: -43, horizontalHalf: 5.5, verticalHalf: 9 }),
  Object.freeze({ x: 0, z: 40, horizontalHalf: 4, verticalHalf: 9 }),
]);

export function signalStage(axis, time) {
  const phase = ((time % 16) + 16) % 16;
  return axis === 'vertical' ? (phase < 7 ? 2 : phase < 9 ? 1 : 0) : phase < 9 ? 0 : phase < 14.5 ? 2 : 1;
}

function trafficSignal(world, junction, approach) {
  const { sx, sz, axis, rotation } = approach;
  const x = junction.x + sx * (junction.verticalHalf + 1.7);
  const z = junction.z + sz * (junction.horizontalHalf + 2.1);
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotation;
  root.name = 'Traffic signal · ' + axis;
  world.groups.city.add(root);
  mesh(root, poleGeometry, metal, 0, 1.85, 0, 1.12, 3.7, 1.12);
  const casing = new THREE.MeshStandardMaterial({ color: '#243133', roughness: 0.69 });
  mesh(root, boxGeometry, casing, 0, 3.28, 0.05, 0.39, 1.14, 0.3);
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const lampMaterial = new THREE.MeshStandardMaterial({
      color: '#142024',
      roughness: 0.34,
      emissive: '#000000',
      emissiveIntensity: 2,
    });
    const lamp = mesh(root, sphereGeometry, lampMaterial, 0, 3.62 - i * 0.34, 0.219, 0.113, 0.113, 0.025);
    lamp.castShadow = false;
    lights.push(lamp);
    mesh(root, boxGeometry, casing, 0, 3.76 - i * 0.34, 0.31, 0.32, 0.035, 0.28);
  }
  world.obstacle('city', x, z, 0.17, 0.17, 1.85, 3.7);
  const signal = { x, z, axis, rotation, root, lights, junction: { x: junction.x, z: junction.z } };
  (world.streetSignals ||= []).push(signal);
  return signal;
}

export function updateStreetSignals(world, time) {
  const colors = ['#ff3822', '#ffc658', '#76e1ac'];
  for (const signal of world.streetSignals || []) {
    const stage = signalStage(signal.axis, time);
    if (signal.stage === stage) continue;
    signal.stage = stage;
    signal.lights.forEach((lamp, i) => lamp.material.emissive.set(i === stage ? colors[i] : '#000000'));
  }
}

function roundaboutApproach(world, x, z, rotation) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotation;
  root.name = 'Karolinenplatz · yield and roundabout';
  world.groups.city.add(root);
  mesh(root, poleGeometry, metal, 0, 1.2, 0, 1, 2.4, 1);
  const triangle = new THREE.Shape();
  triangle.moveTo(-0.4, 0.3);
  triangle.lineTo(0.4, 0.3);
  triangle.lineTo(0, -0.39);
  triangle.closePath();
  const red = new THREE.MeshStandardMaterial({ color: '#b94a3d', roughness: 0.7, side: THREE.DoubleSide });
  mesh(root, new THREE.ShapeGeometry(triangle), red, 0, 2.55, 0.045);
  const white = new THREE.MeshStandardMaterial({ color: '#f2eee0', roughness: 0.75 });
  mesh(root, new THREE.ShapeGeometry(triangle), white, 0, 2.55, 0.05, 0.77, 0.77, 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#25639b';
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#fffdf3';
  c.fillStyle = '#fffdf3';
  c.lineWidth = 12;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    c.beginPath();
    c.arc(128, 128, 64, a, a + 1.5);
    c.stroke();
    const t = a + 1.5,
      x = 128 + Math.cos(t) * 64,
      y = 128 + Math.sin(t) * 64;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(t - 0.2) * 25, y + Math.sin(t - 0.2) * 25);
    c.lineTo(x + Math.cos(t - 1.5) * 25, y + Math.sin(t - 1.5) * 25);
    c.closePath();
    c.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.68, side: THREE.FrontSide });
  mesh(root, new THREE.CircleGeometry(0.31, 32), face, 0, 1.93, 0.06);
  world.obstacle('city', x, z, 0.14, 0.14, 1.3, 2.6);
  (world.trafficSigns ||= []).push({ kind: 'roundabout-yield', x, z, rotation, root });
}

export function buildStreetSigns(world) {
  if (world.streetSignNetworkBuilt) return;
  world.streetSignNetworkBuilt = true;
  for (const junction of SIGNAL_JUNCTIONS) {
    for (const approach of [
      { sx: -1, sz: -1, axis: 'vertical', rotation: Math.PI },
      { sx: 1, sz: 1, axis: 'vertical', rotation: 0 },
      { sx: -1, sz: 1, axis: 'horizontal', rotation: -Math.PI / 2 },
      { sx: 1, sz: -1, axis: 'horizontal', rotation: Math.PI / 2 },
    ])
      trafficSignal(world, junction, approach);
  }
  const signs = [
    { x: -12.6, z: 31.7, text: 'Brienner Straße' },
    { x: 12.6, z: 48.5, text: 'Augustenstraße', rotation: Math.PI / 2 },
    { x: -12.6, z: -53.3, text: 'Gabelsbergerstraße' },
    { x: 12.6, z: -32.7, text: 'Augustenstraße', rotation: Math.PI / 2 },
    { x: 119, z: 32.6, text: 'Königsplatz' },
    { x: 203, z: 23.5, text: 'Karolinenplatz', rotation: Math.PI / 2 },
    { x: 257, z: 31.8, text: 'Brienner Straße' },
    { x: 238.5, z: 107.5, text: 'Altstadtring', rotation: Math.PI / 2 },
    { x: 399.7, z: 106.5, text: 'Altstadtring' },
    { x: 421, z: 267.5, text: 'Marienplatz', rotation: Math.PI / 2 },
    { x: 267, z: 268, text: 'Frauenplatz' },
    { x: -154.3, z: -31.7, text: 'Gabelsbergerstraße' },
    { x: -157, z: 50.5, text: 'BBE AIR', sub: 'Fiktiver Landeplatz · Zufahrt', rotation: Math.PI / 2 },
  ];
  signs.forEach((spec) => createStreetSign(world, spec));
  roundaboutApproach(world, 233.8, 35.7, 0);
  roundaboutApproach(world, 246.9, 11.5, Math.PI / 2);
  updateStreetSignals(world, 0);
}
