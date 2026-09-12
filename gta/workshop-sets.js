import * as THREE from 'three';
import { box, human, animateHuman, label } from './world.js';
import { createStreetProp } from './aaa-props.js';

export function storyActor(role) {
  const colors = {
    lukas: '#334652',
    Tobias: '#66786b',
    player: '#244e60',
    clara: '#a66c58',
    guest: '#766989',
  };
  const actor = human({
    jacket: colors[role] || '#786c62',
    hair: role === 'clara' ? '#643d2c' : '#40372f',
  });
  actor.userData.storyRole = role;
  const face = new THREE.Group();
  face.position.y = 1.43;
  actor.add(face);
  for (const part of [...actor.children])
    if (part.isMesh && part.position.y >= 1.43) {
      actor.remove(part);
      part.position.y -= 1.43;
      face.add(part);
    }
  actor.userData.face = face;
  const mouth = box(face, 0, 0.135, 0.159, 0.048, 0.009, 0.009, '#795047', false);
  actor.userData.mouth = mouth;
  return actor;
}
export function animateStoryActor(actor, time, speaking = false, pose = 'walk') {
  const baseY = actor.userData.baseY || 0;
  animateHuman(actor, time, 0, pose);
  actor.position.y = baseY;
  const face = actor.userData.face;
  if (face) {
    face.rotation.x = speaking ? Math.sin(time * 2.4) * 0.018 : 0;
    face.rotation.y = speaking ? Math.sin(time * 1.4) * 0.035 : 0;
  }
  if (actor.userData.mouth)
    actor.userData.mouth.scale.y = 0.009 * (speaking ? 1 + Math.abs(Math.sin(time * 14)) * 2.7 : 1);
  if (speaking && (pose === 'walk' || pose === 'seated')) {
    actor.userData.rig.rightArm.rotation.x = -0.24 - Math.max(0, Math.sin(time * 1.7)) * 0.23;
    actor.userData.rig.rightFore.rotation.x = -0.7;
    actor.userData.rig.leftFore.rotation.x = -0.13;
  }
}
function tube(g, x, y, z, r, h, color) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62 }),
  );
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
function chair(g, x, z, rotation = 0) {
  const a = new THREE.Group();
  a.position.set(x, 0, z);
  a.rotation.y = rotation;
  g.add(a);
  box(a, 0, 0.53, 0, 0.62, 0.13, 0.6, '#36494c');
  box(a, 0, 0.94, -0.26, 0.65, 0.75, 0.12, '#36494c');
  for (const xx of [-0.23, 0.23])
    for (const zz of [-0.2, 0.2]) box(a, xx, 0.25, zz, 0.045, 0.5, 0.045, '#626b69');
  return a;
}
function plant(g, x, z) {
  tube(g, x, 0.23, z, 0.24, 0.45, '#a79b83');
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: i % 2 ? '#4d7155' : '#708666', roughness: 0.88 }),
    );
    m.position.set(x + Math.sin(i * 2.4) * 0.23, 0.65 + i * 0.08, z + Math.cos(i * 2.4) * 0.2);
    m.scale.set(0.16, 0.36, 0.11);
    m.rotation.z = Math.sin(i) * 0.6;
    m.castShadow = true;
    g.add(m);
  }
}
function cup(g, x, z, y = 0.96) {
  tube(g, x, y, z, 0.06, 0.13, '#e9e5d8');
  tube(g, x, y + 0.067, z, 0.049, 0.004, '#52362c');
}
function lightScene(scene, night = false) {
  scene.background = new THREE.Color(night ? '#172936' : '#b4c7c6');
  scene.add(new THREE.HemisphereLight(night ? '#9da9ce' : '#e7eff1', '#604632', night ? 1.3 : 2));
  const sun = new THREE.DirectionalLight(night ? '#ffd5a4' : '#ffe3b3', night ? 3.2 : 3.8);
  sun.position.set(-5, 8, 5);
  sun.target.position.set(0, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 35,
  });
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.045;
  scene.add(sun, sun.target);
}
export function buildBossSet() {
  const scene = new THREE.Scene();
  lightScene(scene);
  box(scene, 0, -0.09, 0, 10, 0.18, 11, '#9d896c');
  for (let z = -5; z < 5.5; z += 0.32) box(scene, 0, 0.002, z, 10, 0.009, 0.009, '#7d705c', false);
  box(scene, 0, 2, -5.4, 10, 4, 0.18, '#b5bdb4');
  box(scene, 5, 2, 0, 0.18, 4, 11, '#d7d4c5');
  for (let x = -4.8; x < 4.8; x += 0.3) box(scene, x, 1.5, -5.27, 0.11, 3, 0.055, '#7f7767');
  for (const z of [-3, 0, 3]) {
    box(scene, -4.95, 1.95, z, 0.08, 3, 2.55, '#adc6cb', false);
    box(scene, -4.85, 0.45, z, 0.18, 0.25, 2.7, '#dadbcf');
    box(scene, -4.85, 2, z, 0.13, 3.2, 0.09, '#768e92');
  }
  label(scene, 'BBE Handelsberatung', 0, 2.6, -5.14, 4.7, 0.85, {
    sub: 'LUKAS FLEISCHMANN · GESCHÄFTSFÜHRUNG',
  });
  box(scene, 0, 0.84, -1.3, 3.4, 0.16, 1.45, '#9b7451');
  for (const x of [-1.35, 1.35]) box(scene, x, 0.42, -1.3, 0.11, 0.84, 1.1, '#30444a');
  box(scene, -0.9, 1.25, -1.57, 0.8, 0.48, 0.055, '#263c43');
  label(scene, 'BBE Handelsberatung', -0.9, 1.25, -1.53, 0.72, 0.4, {
    sub: 'WACHSTUM BEGINNT MIT EINER FRAGE',
  });
  box(scene, -0.9, 0.96, -1.38, 0.85, 0.035, 0.46, '#626e6a');
  for (let i = 0; i < 4; i++)
    box(
      scene,
      -0.25 + i * 0.18,
      0.94,
      -0.99,
      0.13,
      0.014,
      0.23,
      ['#f0e6cb', '#bdd1bf', '#e6c285', '#d9a58d'][i],
    );
  cup(scene, 1.27, -1.45);
  label(scene, 'Lukas Fleischmann', 0.75, 1.06, -0.52, 1.2, 0.21, { bg: '#233f49', fg: '#e5d1a4' });
  const suitcase = createStreetProp(THREE, 'suitcase');
  suitcase.position.set(0.2, 0.94, -1.4);
  suitcase.rotation.y = 0.25;
  scene.add(suitcase);
  label(suitcase, 'WORKSHOP', 0, 0.5, 0.182, 0.4, 0.12, { bg: '#e6c782', fg: '#173d4e' });
  chair(scene, 0, -2.5);
  chair(scene, -1.25, 0.7, Math.PI);
  chair(scene, 1.4, 0.8, Math.PI);
  box(scene, 4.6, 1, -3.8, 0.6, 2, 2, '#a8a08b');
  for (let i = 0; i < 12; i++)
    box(
      scene,
      4.23,
      0.7 + (i % 2) * 0.78,
      -4.55 + Math.floor(i / 2) * 0.26,
      0.19,
      0.56,
      0.18,
      ['#365d69', '#ad9770', '#ced3c5'][i % 3],
    );
  plant(scene, 3.6, 2.9);
  plant(scene, -3.9, -4.6);
  const actors = {};
  for (const [role, x, z, yaw] of [
    ['lukas', 0.1, -2.3, 0],
    ['player', -1.22, 0.8, Math.PI],
    ['Tobias', 1.42, 0.95, -2.7],
  ]) {
    const a = storyActor(role);
    a.position.set(x, -0.28, z);
    a.userData.baseY = -0.28;
    a.userData.storyPose = 'seated';
    a.rotation.y = yaw;
    scene.add(a);
    actors[role] = a;
  }
  return { scene, actors, suitcase, kind: 'boss' };
}
export function buildWorkshopSet() {
  const scene = new THREE.Scene();
  lightScene(scene, true);
  box(scene, 0, -0.11, 0, 13, 0.2, 18, '#b2a38a');
  for (let z = -8.5; z < 8.5; z += 1.2)
    for (let x = -6; x < 6; x += 1.2)
      box(scene, x, 0.001, z, 1.18, 0.012, 1.18, ((x + z) * 10) % 4 ? '#bcb09a' : '#aa9e88', false);
  box(scene, 0, 3.5, -8.8, 13, 7, 0.22, '#b8b0a0');
  for (const side of [-1, 1]) {
    box(scene, side * 6.35, 3.1, 0, 0.22, 6.2, 18, '#b5ac99');
    for (const z of [-6, -1, 4]) {
      tube(scene, side * 5, 2.4, z, 0.2, 4.8, '#cfc5ad');
      if (side === 1) {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(5, 0.13, 8, 40, Math.PI),
          new THREE.MeshStandardMaterial({ color: '#ded3bb', roughness: 0.8 }),
        );
        arch.position.set(0, 4.8, z);
        arch.castShadow = true;
        scene.add(arch);
      }
    }
  }
  for (const side of [-1, 1])
    for (const z of [-4, 2]) {
      box(scene, side * 6.18, 3.4, z, 0.04, 3.9, 1.5, '#293b55', false);
      for (let i = 0; i < 5; i++)
        box(
          scene,
          side * 6.14,
          1.9 + i * 0.62,
          z,
          0.05,
          0.49,
          1.23,
          ['#ae874a', '#557a93', '#6a8369', '#a67055', '#536f82'][i],
          false,
        );
      box(scene, side * 6.1, 3.4, z, 0.06, 3.9, 0.07, '#c1af8a');
    }
  box(scene, 0, 1, -1.5, 6.8, 0.15, 2.6, '#936e4f');
  for (const x of [-2.8, 2.8])
    for (const z of [-2.45, -0.55]) box(scene, x, 0.5, z, 0.1, 1, 0.1, '#384a4e');
  const actors = {};
  for (const [role, x, z, yaw] of [
    ['clara', -2.5, -4, 0],
    ['Tobias', 2.2, -4.8, -0.25],
    ['player', 0.25, -4.1, 0.15],
  ]) {
    const a = storyActor(role);
    a.position.set(x, 0, z);
    a.rotation.y = yaw;
    actors[role] = a;
    scene.add(a);
  }
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + i * 1.6;
    chair(scene, x, 0.8, Math.PI);
    const a = storyActor(i % 2 ? 'guest' : 'guest2');
    a.position.set(x, -0.27, 0.8);
    a.userData.baseY = -0.27;
    a.rotation.y = Math.PI;
    scene.add(a);
    actors['guest' + i] = a;
  }
  for (const x of [-2.4, -0.8, 0.8, 2.4]) {
    cup(scene, x, -0.9, 1.16);
    box(scene, x, 1.09, -1.6, 0.62, 0.018, 0.42, '#eee9d8');
    for (let i = 0; i < 3; i++)
      box(
        scene,
        x - 0.17 + i * 0.16,
        1.111,
        -1.55,
        0.12,
        0.015,
        0.13,
        ['#d6b875', '#95b4a0', '#d79a82'][i],
      );
  }
  const screen = box(
    scene,
    1.25,
    2.67,
    -8.61,
    5,
    2.72,
    0.055,
    new THREE.MeshStandardMaterial({
      color: '#e8ecdf',
      emissive: '#89b9ba',
      emissiveIntensity: 0.15,
    }),
  );
  label(scene, 'BBE Handelsberatung', 1.25, 3.38, -8.54, 4.5, 0.63, {
    sub: 'VOM KUNDENBEDÜRFNIS ZUR MASSNAHME',
  });
  label(scene, 'VERSTEHEN   →   ENTSCHEIDEN   →   UMSETZEN', 1.25, 2.32, -8.53, 4.5, 0.58, {
    bg: '#e6eadc',
    fg: '#345860',
  });
  const chart = new THREE.Group();
  for (let i = 0; i < 5; i++)
    box(
      chart,
      -0.7 + i * 0.85,
      1.58 + i * 0.06,
      -8.48,
      0.46,
      0.28 + i * 0.12,
      0.03,
      i === 4 ? '#bd9553' : '#507d7f',
      false,
    );
  scene.add(chart);
  const board = box(scene, -4.05, 1.75, -6.4, 1.6, 2.15, 0.12, '#e4e2d1');
  label(scene, 'WAS BRAUCHT DER KUNDE?', -4.05, 2.42, -6.32, 1.4, 0.35, {
    bg: '#e4e2d1',
    fg: '#345860',
  });
  for (let i = 0; i < 9; i++)
    box(
      scene,
      -4.5 + (i % 3) * 0.44,
      1.91 - Math.floor(i / 3) * 0.35,
      -6.31,
      0.31,
      0.25,
      0.012,
      ['#e4c771', '#adc5b1', '#dba790'][i % 3],
      false,
    );
  for (const x of [-4.65, -3.45]) box(scene, x, 0.48, -6.4, 0.06, 0.96, 0.06, '#657672');
  const projector = box(scene, 2.8, 1.23, -2.1, 0.4, 0.25, 0.42, '#e1e2d6');
  const glow = new THREE.PointLight('#c0dce3', 1.1, 7, 2);
  glow.position.set(2.8, 1.3, -2.45);
  scene.add(glow);
  const suitcase = createStreetProp(THREE, 'suitcase');
  suitcase.position.set(-2.1, 1.11, -2);
  scene.add(suitcase);
  plant(scene, 5.5, -7.4);
  plant(scene, -5.5, 5.5);
  return { scene, actors, suitcase, screen, chart, projector, kind: 'workshop' };
}
