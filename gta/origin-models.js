import { remasterInteriorGroup } from './remaster-interiors.js';
import { remasterMaterial, upgradeInteriorSurfaces } from './remaster-materials.js';
import { realisticPlant } from './remaster-vegetation.js';
import { decorateOriginHome, decorateOriginKitchen } from './interior-detail.js';
import { mergeStaticGeometry } from './render-batches.js';
import * as THREE from 'three';
import { box, label, chair } from './world.js';
import { storyActor } from './workshop-sets.js';
const steel = new THREE.MeshStandardMaterial({ color: '#a8b8b5', roughness: 0.3, metalness: 0.72 });
const black = new THREE.MeshStandardMaterial({
  color: '#1b2727',
  roughness: 0.55,
  metalness: 0.42,
  side: THREE.DoubleSide,
});
const ceramic = new THREE.MeshStandardMaterial({ color: '#f5ead3', roughness: 0.27 });
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 28);
const sphere = new THREE.SphereGeometry(1, 16, 10);
export function round(g, x, y, z, r, h, mat = ceramic) {
  const m = new THREE.Mesh(cylinder, mat);
  m.position.set(x, y, z);
  m.scale.set(r, h, r);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
function plant(g, x, z) {
  return realisticPlant(g, x, z);
}

function room(kind) {
  const group = new THREE.Group(),
    collisions = [];
  const solid = (x, y, z, w, h, d, c) => {
    const m = box(group, x, y, z, w, h, d, c);
    collisions.push({ x, y, z, w, h, d, mesh: m });
    return m;
  };
  box(group, 0, -0.08, 0, 16, 0.16, 16, kind === 'home' ? '#ad8b64' : '#bdb6a3');
  solid(0, 1.8, -8, 16, 3.6, 0.18, '#d3d4bd');
  solid(-8, 1.8, 0, 0.18, 3.6, 16, '#e3dccc');
  solid(8, 1.8, 0, 0.18, 3.6, 16, '#d3d4bd');
  solid(-4.65, 1.8, 8, 6.7, 3.6, 0.18, '#d4ccba');
  solid(4.65, 1.8, 8, 6.7, 3.6, 0.18, '#d4ccba');
  for (const x of [-1.35, 1.35]) box(group, x, 1.5, 8, 0.09, 3, 0.25, '#526962');
  box(group, 0, 3, 8, 2.8, 0.14, 0.25, '#526962');
  for (const z of [-7.8, 7.8]) box(group, 0, 0.1, z, 16, 0.18, 0.05, '#5b6357');
  for (const x of [-4, 3]) {
    box(group, x, 2.1, -7.88, 2.5, 2, 0.05, '#8aaab4', false);
    box(group, x, 2.1, -7.82, 0.07, 2, 0.06, '#e8ddc6');
    box(group, x, 2.1, -7.8, 2.5, 0.06, 0.08, '#e8ddc6');
  }
  return { group, collisions, solid, actors: {} };
}
export function buildOriginHome() {
  const set = room('home'),
    { group: g, solid } = set;
  solid(-4, 0.3, -3, 3, 0.6, 4.5, '#75634f');
  box(g, -4, 0.67, -3, 2.9, 0.25, 4.4, remasterMaterial('fabric', { color: '#e3dfcd' }));
  box(g, -4, 0.84, -4.5, 2.5, 0.18, 0.8, remasterMaterial('fabric', { color: '#f5ecdc' }));
  box(g, -4, 0.83, -2.45, 2.93, 0.09, 2.9, remasterMaterial('fabric', { color: '#73958e' }));
  solid(4, 0.47, -4.9, 4, 0.94, 1.4, '#898170');
  box(g, 4, 0.975, -4.9, 4.1, 0.08, 1.5, '#d6d6c9');
  round(g, 4, 1.085, -4.7, 0.3, 0.14, black);
  box(g, 5.5, 1.2, -4.8, 0.4, 0.37, 0.5, '#222f33');
  solid(1.9, 0.405, 1.2, 2.4, 0.81, 1.2, '#9e7956');
  chair(g, 1.9, 2.25, 0, '#526566');
  box(g, 1.7, 0.828, 1.2, 0.9, 0.035, 0.6, '#293d47');
  const screen = box(g, 1.7, 1.1, 0.94, 0.92, 0.54, 0.035, '#92abb0');
  screen.rotation.x = -0.16;
  label(g, 'SCHICHT 11:30', 2.65, 0.816, 1.15, 0.55, 0.3, {
    bg: '#eee7d1',
    fg: '#344d48',
  }).rotation.x = -Math.PI / 2;
  label(g, 'MÜNCHEN. WIRD SCHON.', 0, 2.8, -7.8, 3, 0.44, { bg: '#315d59', fg: '#f1dfb4' });
  solid(6.8, 1.15, 3.6, 1.5, 2.3, 2.6, '#a7865d');
  plant(g, -6.6, 6.1);
  plant(g, 6.5, -7);
  for (let i = 0; i < 5; i++)
    box(g, 1.8 + i * 0.12, 0.885, 1.5, 0.07, 0.15, 0.24, ['#b76e4b', '#d7c97c', '#42756b'][i % 3]);
  decorateOriginHome(set);
  upgradeInteriorSurfaces(set.group, 'home');
  remasterInteriorGroup(set.group);
  return set;
}
export function buildOriginKitchen() {
  const set = room('kitchen'),
    { group: g, solid } = set;
  for (let x = -7; x < 8; x += 1)
    for (let z = -7; z < 8; z += 1)
      box(g, x, 0.004, z, 0.97, 0.012, 0.97, (x + z) % 2 ? '#b7b6a4' : '#cac4ae', false);
  for (let x = -7; x < 8; x += 0.5) box(g, x, 1.8, -7.86, 0.47, 1.2, 0.05, '#427d70', false);
  solid(-2, 0.62, -2.8, 6, 1.24, 1.8, '#697f79');
  box(g, -2, 1.3, -2.8, 6.1, 0.13, 1.9, steel);
  solid(6.1, 0.7, -2, 2.5, 1.4, 5, '#626f68');
  box(g, 6.1, 1.44, -2, 2.6, 0.08, 5.1, steel);
  solid(-6.8, 1.2, -5.8, 1.8, 2.4, 2.1, steel);
  box(g, -6.8, 1.2, -4.72, 0.08, 2, 0.05, '#273f3e');
  label(g, 'ZITRONENGRAS', 0, 2.9, -7.78, 4.8, 0.65, {
    bg: '#22594b',
    fg: '#f8e6b7',
    sub: 'KLEINE KÜCHE. GROSSE PLÄNE.',
  });
  for (const x of [-5, -2, 1]) {
    box(g, x, 2.6, -3, 0.06, 0.65, 0.06, '#253b34');
    round(
      g,
      x,
      2.27,
      -3,
      0.34,
      0.16,
      new THREE.MeshStandardMaterial({
        color: '#d9b76e',
        emissive: '#d2a146',
        emissiveIntensity: 0.45,
      }),
    );
  }
  for (let i = 0; i < 8; i++) {
    round(
      g,
      5.45 + (i % 2) * 0.65,
      1.65,
      -4 + Math.floor(i / 2) * 0.7,
      0.12,
      0.32,
      new THREE.MeshStandardMaterial({ color: ['#bf543e', '#daae4c', '#355d48'][i % 3] }),
    );
  }
  for (let i = 0; i < 5; i++) {
    box(g, -4.9 + i * 0.22, 1.51, -6.1, 0.16, 0.82, 0.6, ['#536b55', '#aeaa83', '#b69056'][i % 3]);
  }
  for (const [x, z] of [
    [-4, 3.4],
    [3.5, 3.6],
  ]) {
    solid(x, 0.37, z, 2, 0.74, 1.1, '#9f7c50');
    for (const side of [-1, 1]) chair(g, x + side * 1.4, z, (side * Math.PI) / 2, '#36644e');
    round(g, x, 0.79, z, 0.23, 0.045);
  }
  plant(g, -6.6, 6.3);
  plant(g, 6.7, 6.2);
  const wok = new THREE.Group();
  wok.position.set(-2, 1.67, -2.8);
  g.add(wok);
  set.wok = wok;
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.74, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    black,
  );
  bowl.rotation.x = Math.PI;
  bowl.scale.y = 0.4;
  wok.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.035, 8, 36), steel);
  rim.rotation.x = Math.PI / 2;
  wok.add(rim);
  const handle = box(wok, 1.08, 0.015, 0, 0.78, 0.11, 0.12, '#3c382c');
  set.handle = handle;
  set.sauce = round(
    wok,
    0,
    -0.13,
    0,
    0.64,
    0.035,
    new THREE.MeshStandardMaterial({ color: '#c68442', roughness: 0.5 }),
  );
  set.sauce.visible = false;
  const burner = round(
    g,
    -2,
    1.365,
    -2.8,
    0.61,
    0.055,
    new THREE.MeshStandardMaterial({
      color: '#b66a20',
      emissive: '#ff8b28',
      emissiveIntensity: 0.6,
    }),
  );
  set.burner = burner;
  const foodMat = ['#d2aa78', '#bd693b', '#e3b858', '#538740'].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.66 }),
  );
  set.food = [];
  for (let i = 0; i < 36; i++) {
    const m = box(wok, 0, 0, 0, 0.14, 0.11, 0.17, foodMat[i % 4]);
    m.userData.seed = i * 2.39996;
    set.food.push(m);
  }
  const steamGeo = new THREE.BufferGeometry(),
    steam = new Float32Array(40 * 3);
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steam, 3));
  set.steam = new THREE.Points(
    steamGeo,
    new THREE.PointsMaterial({
      color: '#e8eee2',
      size: 0.095,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  );
  wok.add(set.steam);
  set.spatula = new THREE.Group();
  g.add(set.spatula);
  box(set.spatula, 0, 0, 0, 0.075, 0.8, 0.065, '#b49b72');
  box(set.spatula, 0, -0.47, 0, 0.22, 0.18, 0.045, steel);
  set.plate = new THREE.Group();
  set.plate.position.set(0.1, 1.405, -2.8);
  g.add(set.plate);
  round(set.plate, 0, 0, 0, 0.59, 0.05);
  set.plating = [];
  for (let i = 0; i < 3; i++) {
    const p = round(
      set.plate,
      Math.sin(i * 2.1) * 0.23,
      0.09,
      Math.cos(i * 2.1) * 0.23,
      0.2,
      0.12,
      new THREE.MeshStandardMaterial({ color: ['#eee2b6', '#c68b43', '#58813e'][i] }),
    );
    p.visible = false;
    set.plating.push(p);
  }
  const cup = new THREE.Group();
  round(cup, 0, 0, 0, 0.15, 0.3);
  set.pour = cup;
  g.add(cup);
  cup.visible = false;
  set.stream = round(g, 0, 0, 0, 0.045, 0.6, new THREE.MeshStandardMaterial({ color: '#eddbb5' }));
  set.stream.visible = false;
  // Static tiles share three draws; no per-frame mesh allocation or duplicate shadow passes.
  g.updateMatrixWorld(true);
  const tileGroups = new Map();
  for (const mesh of [...g.children])
    if (
      mesh.isMesh &&
      !mesh.castShadow &&
      (mesh.position.y === 0.004 || mesh.position.z === -7.86)
    ) {
      const list = tileGroups.get(mesh.material) || [];
      list.push(mesh);
      tileGroups.set(mesh.material, list);
    }
  for (const [mat, meshes] of tileGroups) {
    const batch = new THREE.Mesh(mergeStaticGeometry(meshes), mat);
    batch.receiveShadow = true;
    batch.name = 'Zitronengras · static tile batch';
    g.add(batch);
    for (const m of meshes) g.remove(m);
  }
  decorateOriginKitchen(set);
  upgradeInteriorSurfaces(set.group, 'zitronengras');
  remasterInteriorGroup(set.group);
  return set;
}
const shrimpGeometry = new THREE.TorusGeometry(1, 0.34, 8, 16, Math.PI * 1.65);
const noodleGeometry = new THREE.TorusGeometry(1, 0.075, 5, 22, Math.PI * 1.8);
const dicedGeometry = new THREE.BoxGeometry(1, 1, 1);
const culinaryColors = ['#e9d7a5', '#cc9b63', '#d79071', '#5b963c', '#b8633b'].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
);
function configureDish(set, recipe) {
  if (set.recipeName === recipe.name) return;
  set.recipeName = recipe.name;
  const noodle = recipe.protein === 'Garnelen',
    tofu = recipe.protein === 'Tofu',
    duck = recipe.protein === 'Ente';
  for (let i = 0; i < set.food.length; i++) {
    const m = set.food[i],
      protein = i < 12;
    m.geometry =
      protein && noodle ? shrimpGeometry : protein && !tofu && !duck ? sphere : dicedGeometry;
    m.material = culinaryColors[protein ? (noodle ? 2 : tofu ? 0 : duck ? 4 : 1) : i % 2 ? 3 : 4];
    m.scale.set(
      protein && noodle ? 0.1 : duck && protein ? 0.22 : 0.13,
      protein && !tofu ? 0.07 : 0.1,
      protein && noodle ? 0.09 : 0.12,
    );
  }
  const names = recipe.garnish;
  for (let index = 0; index < set.plating.length; index++) {
    const old = set.plating[index];
    set.plate.remove(old);
    const group = new THREE.Group();
    set.plate.add(group);
    group.visible = false;
    set.plating[index] = group;
    const isRice = names[index] === 'Reis';
    if (isRice) {
      const grains = new THREE.InstancedMesh(sphere, culinaryColors[0], 32),
        dummy = new THREE.Object3D();
      for (let i = 0; i < 32; i++) {
        const r = 0.17 * Math.sqrt(i / 32),
          a = i * 2.4;
        dummy.position.set(-0.2 + Math.cos(a) * r, 0.075 + (1 - r / 0.17) * 0.12, Math.sin(a) * r);
        dummy.rotation.y = a;
        dummy.scale.set(0.035, 0.018, 0.018);
        dummy.updateMatrix();
        grains.setMatrixAt(i, dummy.matrix);
      }
      group.add(grains);
    } else if (noodle && index === 0) {
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(noodleGeometry, culinaryColors[1]);
        m.scale.set(0.15, 0.15, 0.12);
        m.rotation.set(Math.PI / 2, 0, i);
        m.position.set(Math.sin(i * 2.4) * 0.2, 0.07 + i * 0.004, Math.cos(i * 2.4) * 0.16);
        group.add(m);
      }
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(shrimpGeometry, culinaryColors[2]);
        m.scale.set(0.09, 0.09, 0.08);
        m.rotation.x = Math.PI / 2;
        m.position.set(Math.sin(i * 2.1) * 0.2, 0.13, Math.cos(i * 2.1) * 0.16);
        group.add(m);
      }
    } else if (index === 1 && !noodle) {
      round(
        group,
        0.2,
        0.05,
        0,
        0.27,
        0.055,
        new THREE.MeshStandardMaterial({ color: recipe.color, roughness: 0.4 }),
      );
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(tofu ? dicedGeometry : sphere, culinaryColors[tofu ? 0 : 1]);
        m.scale.set(tofu ? 0.095 : 0.065, 0.06, 0.06);
        m.position.set(0.2 + Math.sin(i * 2.4) * 0.17, 0.12, Math.cos(i * 2.4) * 0.16);
        group.add(m);
      }
    } else {
      for (let i = 0; i < (duck && index === 2 ? 5 : 9); i++) {
        const m = new THREE.Mesh(
          duck ? dicedGeometry : sphere,
          culinaryColors[duck ? 4 : noodle && index === 1 ? 1 : 3],
        );
        m.scale.set(duck ? 0.18 : 0.035, 0.018, duck ? 0.05 : 0.055);
        m.rotation.y = i * 0.4;
        m.position.set(
          duck ? 0.12 : Math.sin(i * 2.4) * 0.22,
          0.15,
          duck ? (i - 2) * 0.07 : Math.cos(i * 2.4) * 0.22,
        );
        group.add(m);
      }
    }
  }
}
export function animateKitchen(set, t, state = {}) {
  if (state.recipe) configureDish(set, state.recipe);
  const cooking = state.phase === 'sear',
    stirring = !!state.stir,
    prepared = state.step > 0;
  set.wok.rotation.z = stirring ? Math.sin(t * 9) * 0.04 : 0;
  for (let i = 0; i < set.food.length; i++) {
    const m = set.food[i],
      a = m.userData.seed + t * (stirring ? 2 : 0.15),
      r = 0.17 + (i % 5) * 0.075;
    m.visible = prepared && i < state.step * 12;
    m.position.set(
      Math.cos(a) * r,
      -0.4 * Math.sqrt(0.74 * 0.74 - Math.pow(r + 0.13, 2)) +
        0.13 +
        (stirring ? Math.max(0, Math.sin(t * 8 + i)) * 0.19 : 0),
      Math.sin(a) * r,
    );
    m.rotation.set(i * 0.6, a, i * 0.4);
  }
  const attr = set.steam.geometry.attributes.position;
  for (let i = 0; i < attr.count; i++) {
    const y = (t * 0.48 + i * 0.069) % 1.65;
    attr.setXYZ(
      i,
      Math.sin(i * 3.1 + t * 0.3) * (0.15 + y * 0.12),
      y,
      Math.cos(i * 2.7) * (0.12 + y * 0.1),
    );
  }
  attr.needsUpdate = true;
  set.steam.visible = cooking;
  set.steam.material.opacity = 0.1 + (state.heat || 35) / 400;
  set.burner.material.emissiveIntensity = cooking ? (state.heat || 35) / 50 : 0.08;
  set.sauce.visible = ['plate', 'done'].includes(state.phase);
  if (state.recipe) set.sauce.material.color.set(state.recipe.color);
  set.spatula.position.set(
    -2 + (stirring ? Math.sin(t * 6) * 0.25 : 0.9),
    2.1,
    -2.8 + (stirring ? Math.cos(t * 6) * 0.25 : 0),
  );
  set.spatula.rotation.z = stirring ? -0.45 : 1.4;
  for (let i = 0; i < 3; i++) set.plating[i].visible = state.plate > i;
  const pouring = state.pour > 0;
  set.pour.visible = set.stream.visible = pouring;
  if (pouring) {
    set.pour.position.set(-1.65, 2.3, -2.8);
    set.pour.rotation.z = 0.8;
    set.stream.position.set(-1.85, 1.88, -2.8);
  }
}
export function cinematicSet(kind) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#829494');
  scene.add(new THREE.HemisphereLight('#f1edcf', '#546c68', 2.15));
  const key = new THREE.DirectionalLight('#ffe0a4', 3.6);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#a5dce2', 1.1);
  fill.position.set(6, 5, -5);
  scene.add(fill);
  const set = kind === 'home' ? buildOriginHome() : buildOriginKitchen();
  scene.add(set.group);
  set.scene = scene;
  const roles = kind === 'home' ? ['player', 'noi'] : ['player', 'noi', 'lukas'];
  for (const role of roles) {
    const actor = storyActor(role);
    actor.position.set(
      role === 'player' ? -2 : role === 'noi' ? 0.5 : 3,
      0,
      kind === 'home' ? 2 : 0,
    );
    actor.rotation.y = role === 'player' ? 0.8 : -0.65;
    set.group.add(actor);
    set.actors[role] = actor;
  }
  if (kind === 'home') set.actors.noi.visible = false;
  return set;
}
