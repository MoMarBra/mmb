import * as THREE from 'three';
import { box, label, human, chair } from './world.js';
import { portal } from './doors.js';

export const IT_LAYOUT = Object.freeze({
  entrance: { x: -13.5, z: 6 },
  door: { x: -26, z: 6 },
  room: { x: -33, z: 1, w: 14, d: 16 },
  benjamin: { x: -34.4, z: 1.1 },
});
export const inIT = (p) => p.x < -26 && p.x > -40 && p.z > -7 && p.z < 9;

export function buildITOffice(w) {
  const g = w.groups.office;
  const solid = (x, y, z, sx, sy, sz, color) => w.solid('office', g, x, y, z, sx, sy, sz, color);
  const shell = '#dce5de',
    trim = '#547573';
  box(g, -19.75, -0.065, 6, 12.5, 0.13, 3.1, '#a8b7ad');
  for (const z of [4.45, 7.55]) solid(-19.75, 1.55, z, 12.5, 3.1, 0.16, shell);
  box(g, -33, -0.065, 1, 14, 0.13, 16, '#7c8f92');
  for (const [x, z, sx, sz] of [
    [-40, 1, 0.18, 16],
    [-33, -7, 14, 0.18],
    [-33, 9, 14, 0.18],
    [-26, -1.1, 0.18, 11.8],
    [-26, 8.2, 0.18, 1.6],
  ])
    solid(x, 1.65, z, sx, 3.3, sz, shell);
  // Ceilings are narrow luminaires and cornices to preserve third-person visibility.
  const light = new THREE.MeshStandardMaterial({
    color: '#eef5da',
    emissive: '#dbeedb',
    emissiveIntensity: 1.15,
  });
  for (const x of [-16, -21, -29, -36]) box(g, x, 3.02, 6, 1.8, 0.07, 0.24, light, false);
  for (const z of [-4, 1]) box(g, -33, 3.08, z, 10, 0.06, 0.22, light, false);
  for (const z of [-6.6, 8.6]) box(g, -33, 0.18, z, 13, 0.13, 0.08, trim, false);
  const entry = portal(w, 'office', 'it-wing', -13.5, 6, {
    width: 2.4,
    rotation: Math.PI / 2,
    title: 'IT · BENJAMIN',
    glass: true,
  });
  const door = portal(w, 'office', 'it-room', -26, 6, {
    width: 2.4,
    rotation: Math.PI / 2,
    title: 'IT · IMMER DA FÜRS TEAM',
    glass: true,
  });
  entry.openAngle = door.openAngle = -1.5;
  for (const [d, title] of [
    [entry, 'IT · BENJAMIN'],
    [door, 'IT · IMMER DA FÜRS TEAM'],
  ]) {
    d.nameplate.material.side = THREE.FrontSide;
    const back = label(d.root, title, 0, 2.92, -0.14, 1.7, 0.24, {
      rotation: Math.PI,
      bg: '#23594b',
      fg: '#f0f5dc',
    });
    back.material.side = THREE.FrontSide;
  }
  for (const [x, z, rotation] of [
    [-19, 4.55, 0],
    [-27.1, 8.85, Math.PI],
  ]) {
    for (const back of [false, true]) {
      const offset = back ? -0.012 : 0.012;
      const sign = label(
        g,
        back ? 'BENJAMIN  →  IT' : 'IT  ←  BENJAMIN',
        x + Math.sin(rotation) * offset,
        2.32,
        z + Math.cos(rotation) * offset,
        2.7,
        0.38,
        {
          rotation: rotation + (back ? Math.PI : 0),
          bg: '#23585f',
          sub: 'SERVICE DESK · WESTFLÜGEL',
        },
      );
      sign.material.side = THREE.FrontSide;
    }
  }
  label(g, 'BENJAMIN · IT', -33, 2.4, -6.86, 8, 0.72, {
    bg: '#193c4c',
    sub: 'IMMER DA FÜRS TEAM. AUCH WENN’S BRENNT.',
  });
  label(g, 'SERVICE LEVEL: HIMMLISCH', -39.86, 2.4, 1, 4.4, 0.52, {
    rotation: Math.PI / 2,
    bg: '#e1d6b6',
    fg: '#3e565b',
  });
  solid(-34, 0.79, -0.5, 4.4, 0.12, 1.6, '#b59d78');
  for (const x of [-35.7, -32.3])
    for (const z of [-1.1, 0.1]) box(g, x, 0.37, z, 0.09, 0.74, 0.09, trim);
  for (const x of [-35.1, -33.4]) {
    box(g, x, 1.2, -0.7, 0.95, 0.65, 0.075, '#18333d');
    label(g, 'BBE IT', x, 1.2, -0.65, 0.84, 0.52, { bg: '#1c5263', sub: 'ALLE SYSTEME IM BLICK' });
    box(g, x, 0.88, -0.7, 0.12, 0.25, 0.12, trim);
    box(g, x, 0.875, -0.08, 0.72, 0.025, 0.24, '#253e48');
  }
  // One facade per server rack keeps the new room inexpensive to render.
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 128;
  texCanvas.height = 256;
  const c = texCanvas.getContext('2d');
  c.fillStyle = '#152930';
  c.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 10; i++) {
    c.fillStyle = '#41545b';
    c.fillRect(8, 10 + i * 24, 111, 20);
    c.fillStyle = '#80d9bc';
    c.fillRect(96, 17 + i * 24, 5, 5);
    c.fillStyle = '#152930';
    c.fillRect(16, 15 + i * 24, 63, 9);
  }
  const tex = new THREE.CanvasTexture(texCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const rackMaterial = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 });
  for (const x of [-38.5, -36.9, -35.3]) {
    solid(x, 1.15, -5.2, 1.3, 2.3, 1, '#253c43');
    box(g, x, 1.15, -4.68, 1.2, 2.1, 0.035, rackMaterial);
  }
  const actor = human({ jacket: '#e3e9dd', pants: '#3c5863', hair: '#604a38' });
  actor.name = 'Benjamin · IT';
  actor.position.set(IT_LAYOUT.benjamin.x, 0, IT_LAYOUT.benjamin.z);
  actor.rotation.y = Math.PI;
  g.add(actor);
  const deskChair = chair(g, IT_LAYOUT.benjamin.x, IT_LAYOUT.benjamin.z, Math.PI, '#344c58', 0.49);
  deskChair.name = 'Benjamin · ergonomic desk chair';
  const footrest = box(g, IT_LAYOUT.benjamin.x, 0.1175, 0.64, 0.55, 0.055, 0.34, '#344c58');
  footrest.name = 'Benjamin · footrest';
  w.zoneData.office.npcs.push({
    mesh: actor,
    name: 'Benjamin · IT',
    pose: 'work',
    x: -34.4,
    z: 1.1,
    origin: { x: -34.4, z: 1.1 },
    hp: 3,
  });
  w.interact('office', 'it-benjamin', 'Mit Benjamin sprechen', -34.4, 2.25, {
    kind: 'it-benjamin',
    radius: 1.7,
  });
  // Two floor guides frame the route without blocking the corridor.
  for (let x = -15; x >= -29; x -= 3)
    label(g, 'IT  ←', x, 0.016, 6, 1.25, 0.5, {
      rotation: 0,
      bg: '#304b51',
      fg: '#b8e0ca',
    }).rotation.x = -Math.PI / 2;
  w.itOffice = { entry, door, actor, deskChair, footrest };
  return w.itOffice;
}
