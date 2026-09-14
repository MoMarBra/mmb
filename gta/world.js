import { buildITOffice } from './it-office.js';
import { buildOfficeDetail } from './office-detail.js';
import { updateStreetSignals } from './street-signs.js';
import { blenderVehicle } from './blender-vehicles.js';
import { buildCityStreets } from './city-streets.js';
import { installCityTraffic, updateCityTraffic } from './city-traffic.js';
import { mergeStaticGeometry } from './render-batches.js';
import { portal, INTERIOR_LAYOUT } from './doors.js';
import { CITY_LAYOUT } from './city-layout.js';
import { buildVerticalCity, ROOF_ROUTE } from './vertical-city.js';
import { buildCityExpansion } from './city-expansion.js';
import { brandTexture } from './branding.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { SSAOPass } from './vendor/addons/postprocessing/SSAOPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
import { RESTAURANTS, clamp } from './data.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const matCache = new Map();
function material(color, roughness = 0.75, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!matCache.has(key))
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return matCache.get(key);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1),
  sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const cylinderCache = new Map();
const carShape = new THREE.Shape();
carShape.moveTo(-0.42, -0.42);
carShape.lineTo(0.42, -0.42);
carShape.lineTo(0.42, 0.42);
carShape.lineTo(-0.42, 0.42);
carShape.closePath();
const carBodyGeo = new THREE.ExtrudeGeometry(carShape, {
  depth: 0.84,
  bevelEnabled: true,
  bevelSegments: 3,
  steps: 1,
  bevelSize: 0.08,
  bevelThickness: 0.08,
});
carBodyGeo.translate(0, 0, -0.42);
export function box(g, x, y, z, w, h, d, color, cast = true) {
  const m = new THREE.Mesh(boxGeo, typeof color === 'object' ? color : material(color));
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = cast;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function sphere(g, x, y, z, rx, ry, rz, color) {
  const m = new THREE.Mesh(sphereGeo, material(color));
  m.position.set(x, y, z);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
function cylinder(g, x, y, z, r, h, color, rt = r, segments = 16) {
  const key = [r, rt, h, segments].join();
  if (!cylinderCache.has(key))
    cylinderCache.set(key, new THREE.CylinderGeometry(rt, r, h, segments));
  const m = new THREE.Mesh(cylinderCache.get(key), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function label(
  g,
  text,
  x,
  y,
  z,
  w,
  h,
  { bg = '#123e4a', fg = '#fff', sub = '', rotation = 0 } = {},
) {
  const tex = canvasTexture(1024, 256, (c, W, H) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `600 ${Math.min(92, 1700 / text.length)}px Arial`;
    c.fillText(text, W / 2, sub ? H * 0.4 : H * 0.5, W * 0.93);
    if (sub) {
      c.font = '32px Arial';
      c.fillText(sub, W / 2, H * 0.76, W * 0.92);
    }
  });
  if (text === 'BBE Handelsberatung') brandTexture(tex, sub);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.6,
      emissive: fg,
      emissiveIntensity: 0.07,
      side: THREE.DoubleSide,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.y = rotation;
  g.add(m);
  return m;
}
const aoTexture = () =>
  canvasTexture(64, 64, (c) => {
    const r = c.createRadialGradient(32, 32, 2, 32, 32, 31);
    r.addColorStop(0, 'rgba(0,0,0,.35)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = r;
    c.fillRect(0, 0, 64, 64);
  });
let shadowTex;
function contactShadow(g, x, z, w = 1.5, d = 1.2) {
  if (!shadowTex) shadowTex = aoTexture();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.025, z);
  g.add(m);
  return m;
}
function plant(g, x, z, s = 1) {
  cylinder(g, x, 0.25 * s, z, 0.22 * s, 0.5 * s, '#d7c5a6', 0.28 * s);
  cylinder(g, x, 0.5 * s, z, 0.22 * s, 0.035 * s, '#382c20');
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    sphere(
      g,
      x + Math.cos(a) * 0.23 * s,
      (0.8 + i * 0.065) * s,
      z + Math.sin(a) * 0.23 * s,
      0.13 * s,
      0.36 * s,
      0.12 * s,
      i % 2 ? '#416b45' : '#789652',
    );
  }
  contactShadow(g, x, z, 0.9 * s, 0.9 * s);
}
function mug(g, x, y, z, color = '#f2ece0') {
  cylinder(g, x, y, z, 0.07, 0.13, color);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 7, 12), material(color));
  ring.position.set(x + 0.075, y, z);
  g.add(ring);
  cylinder(g, x, y + 0.068, z, 0.057, 0.003, '#412820');
}
function monitor(g, x, y, z, w = 0.8) {
  box(g, x, y, z, w, 0.49, 0.055, '#182730');
  box(g, x, y - 0.35, z, 0.045, 0.24, 0.05, '#505b61');
  box(g, x, y - 0.46, z, 0.3, 0.025, 0.22, '#303c44');
  label(g, 'BBE Handelsberatung', x, y, z + 0.03, w * 0.91, 0.39, {
    bg: '#153f4a',
    sub: 'RETAIL. INSIGHT. IMPACT.',
  });
}
export function chair(g, x, z, rot = 0, color = '#344c58', seatHeight = 0.62) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rot;
  g.add(root);
  const stemHeight = seatHeight - 0.06;
  cylinder(root, 0, 0.05 + stemHeight / 2, 0, 0.04, stemHeight, '#8e989a');
  const seat = box(root, 0, seatHeight, 0, 0.58, 0.11, 0.55, color);
  seat.name = 'Office chair cushion';
  const back = box(root, 0, seatHeight + 0.32, -0.24, 0.55, 0.58, 0.09, color);
  back.rotation.x = -0.08;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const leg = box(
      root,
      Math.sin(a) * 0.14,
      0.12,
      Math.cos(a) * 0.14,
      0.04,
      0.045,
      0.35,
      '#66777e',
    );
    leg.rotation.y = a;
    sphere(root, Math.sin(a) * 0.28, 0.08, Math.cos(a) * 0.28, 0.055, 0.055, 0.055, '#24292b');
  }
  for (const sx of [-1, 1]) {
    box(root, sx * 0.31, seatHeight + 0.18, 0, 0.06, 0.04, 0.33, '#232e34');
    box(root, sx * 0.31, seatHeight + 0.08, -0.06, 0.035, 0.2, 0.035, '#5e6970');
  }
  return root;
}
function desk(g, x, z, { width = 2.3, dual = false } = {}) {
  box(g, x, 0.78, z, width, 0.075, 1.12, '#b39873');
  for (const sx of [-1, 1]) {
    box(g, x + sx * (width / 2 - 0.14), 0.39, z, 0.07, 0.78, 0.75, '#d4d6d1');
  }
  monitor(g, x + (dual ? -0.43 : 0), 1.29, z - 0.28, dual ? 0.74 : 0.84);
  if (dual) monitor(g, x + 0.43, 1.29, z - 0.28, 0.74);
  box(g, x - 0.12, 0.838, z + 0.2, 0.48, 0.025, 0.16, '#d4d7d4');
  const keys = new THREE.InstancedMesh(boxGeo, material('#667378'), 40);
  keys.name = 'Office keyboard · 40 shared keys';
  const keyTransform = new THREE.Object3D();
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 10; i++) {
      keyTransform.position.set(x - 0.32 + i * 0.046, 0.854, z + 0.15 + j * 0.035);
      keyTransform.scale.set(0.03, 0.007, 0.024);
      keyTransform.updateMatrix();
      keys.setMatrixAt(j * 10 + i, keyTransform.matrix);
    }
  keys.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  keys.computeBoundingSphere();
  keys.receiveShadow = true;
  g.add(keys);
  sphere(g, x + 0.4, 0.851, z + 0.24, 0.055, 0.025, 0.08, '#d9dad4');
  box(g, x - 0.78, 0.85, z + 0.02, 0.29, 0.04, 0.36, '#fcf5df');
  mug(g, x + 0.8, 0.89, z - 0.1);
  contactShadow(g, x, z, width + 1, 2);
}
export function human({
  jacket = '#244e60',
  pants = '#24333a',
  skin = '#d1a382',
  hair = '#41362f',
  scale = 1,
} = {}) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  const rig = {};
  sphere(g, 0, 1.06, 0, 0.24, 0.32, 0.14, jacket);
  box(g, 0, 1.16, 0.133, 0.095, 0.36, 0.024, '#f0ede4');
  const tie = box(g, 0, 1.14, 0.157, 0.035, 0.23, 0.015, '#b18b49');
  tie.rotation.z = 0.03;
  cylinder(g, 0, 1.43, 0, 0.072, 0.15, skin);
  sphere(g, 0, 1.64, 0, 0.16, 0.205, 0.16, skin);
  sphere(g, 0, 1.76, -0.025, 0.165, 0.115, 0.159, hair);
  sphere(g, 0, 1.63, 0.151, 0.035, 0.039, 0.04, skin);
  for (const x of [-0.064, 0.064]) sphere(g, x, 1.69, 0.145, 0.012, 0.015, 0.009, '#29312e');
  for (const sign of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sign * 0.105, 0.86, 0);
    g.add(leg);
    cylinder(leg, 0, -0.205, 0, 0.078, 0.4, pants, 0.086);
    const shin = new THREE.Group();
    shin.position.y = -0.4;
    leg.add(shin);
    cylinder(shin, 0, -0.185, 0, 0.066, 0.37, pants, 0.078);
    sphere(shin, 0, -0.37, 0.048, 0.083, 0.068, 0.145, '#202a2c');
    const arm = new THREE.Group();
    arm.position.set(sign * 0.24, 1.28, 0);
    g.add(arm);
    sphere(arm, 0, -0.015, 0, 0.092, 0.094, 0.092, jacket);
    cylinder(arm, sign * 0.025, -0.16, 0, 0.067, 0.33, jacket, 0.08);
    const fore = new THREE.Group();
    fore.position.set(sign * 0.04, -0.32, 0);
    arm.add(fore);
    sphere(fore, 0, 0, 0, 0.063, 0.065, 0.063, jacket);
    cylinder(fore, 0, -0.135, 0.0, 0.052, 0.27, jacket, 0.064);
    sphere(fore, 0, -0.3, 0, 0.05, 0.075, 0.05, skin);
    rig[sign < 0 ? 'leftLeg' : 'rightLeg'] = leg;
    rig[sign < 0 ? 'leftShin' : 'rightShin'] = shin;
    rig[sign < 0 ? 'leftArm' : 'rightArm'] = arm;
    rig[sign < 0 ? 'leftFore' : 'rightFore'] = fore;
  }
  g.userData.rig = rig;
  g.userData.phase = Math.random() * 6.28;
  return g;
}
export function animateHuman(g, time, speed = 0, pose = 'walk') {
  const r = g.userData.rig,
    t = time * 8 + g.userData.phase;
  // A new base pose clears every joint axis before driving/IK/action overlays.
  for (const joint of Object.values(r)) joint.rotation.set(0, 0, 0);
  const swing = Math.sin(t) * Math.min(speed, 1) * 0.6;
  r.leftLeg.rotation.x = swing;
  r.rightLeg.rotation.x = -swing;
  r.leftShin.rotation.x = Math.max(0, -swing) * 0.7;
  r.rightShin.rotation.x = Math.max(0, swing) * 0.7;
  r.leftArm.rotation.x = -swing * 0.75;
  r.rightArm.rotation.x = swing * 0.75;
  r.leftFore.rotation.x = -0.1;
  r.rightFore.rotation.x = -0.1;
  if (pose === 'seated' || pose === 'eat' || pose === 'work') {
    r.leftLeg.rotation.x = r.rightLeg.rotation.x = -1.45;
    r.leftShin.rotation.x = r.rightShin.rotation.x = 1.4;
    r.leftArm.rotation.x = -0.8;
    r.rightArm.rotation.x = -0.8;
    r.leftFore.rotation.x = -0.6;
    r.rightFore.rotation.x = pose === 'eat' ? -1.25 + Math.sin(time * 5) * 0.45 : -0.6;
  }
  if (pose === 'wash') {
    r.leftArm.rotation.x = r.rightArm.rotation.x = -0.72;
    r.leftFore.rotation.x = -0.5 + Math.sin(time * 9) * 0.12;
    r.rightFore.rotation.x = -0.5 - Math.sin(time * 9) * 0.12;
  }
  if (pose === 'restroom') {
    r.leftArm.rotation.x = r.rightArm.rotation.x = -0.2;
    r.leftFore.rotation.x = r.rightFore.rotation.x = -0.5;
  }
  if (pose === 'phone') {
    r.rightArm.rotation.x = -0.35;
    r.rightFore.rotation.x = -2.3;
  }
  if (pose === 'cycle') {
    r.leftLeg.rotation.x = -0.65 + Math.sin(t) * 0.45;
    r.rightLeg.rotation.x = -0.65 - Math.sin(t) * 0.45;
    r.leftShin.rotation.x = 1.2;
    r.rightShin.rotation.x = 1.2;
    r.leftArm.rotation.x = r.rightArm.rotation.x = -1.05;
  }
  if (pose === 'drink') {
    r.rightArm.rotation.x = -0.8;
    r.rightFore.rotation.x = -1.6 + Math.sin(time * 3) * 0.15;
  }
  g.position.y =
    pose === 'cycle'
      ? 0.34
      : pose === 'seated' || pose === 'eat' || pose === 'work'
        ? -0.23
        : Math.abs(Math.sin(t)) * 0.018 * Math.min(speed, 1);
}

export class GameWorld {
  constructor(canvas, sim) {
    this.sim = sim;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9bbdcd');
    this.scene.fog = new THREE.FogExp2('#acc7d2', 0.005);
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (cause) {
      const error = new Error('Der Browser konnte keinen WebGL-2-Kontext erstellen.', { cause });
      error.code = 'WEBGL_UNAVAILABLE';
      throw error;
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, 0.08, 330);
    this.ambient = new THREE.HemisphereLight('#c6e2f3', '#786752', 2.1);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#ffe2ac', 3.3);
    this.sun.position.set(-35, 55, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -45,
      right: 45,
      top: 45,
      bottom: -45,
      near: 0.5,
      far: 180,
    });
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#a7d9e9', 0.7);
    this.fill.position.set(20, 12, -30);
    this.scene.add(this.fill);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#bfd7df');
    const envRoom = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshBasicMaterial({ color: '#a9b8b9', side: THREE.BackSide }),
    );
    envScene.add(envRoom);
    for (const [x, y, z, c] of [
      [0, 9, 0, '#eaf6ff'],
      [-9, 3, 0, '#ffe2b5'],
      [9, 3, 0, '#8faebf'],
    ])
      box(envScene, x, y, z, 8, 8, 8, new THREE.MeshBasicMaterial({ color: c }));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.1).texture;
    pmrem.dispose();
    this.zone = 'office';
    this.groups = {};
    this.zoneData = {};
    this.interactions = [];
    this.npcs = [];
    this.cars = [];
    this.yaw = 2.6;
    this.pitch = 0.24;
    this.distance = 4.3;
    this.time = 0;
    this.pose = 'seated';
    this.moveSpeed = 0;
    this.target = new THREE.Vector3();
    this.keys = new Set();
    this.dragging = false;
    this.started = false;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.lowQuality = false;
    this.player = human({ jacket: '#235565', pants: '#1f303d', hair: '#332922' });
    this.scene.add(this.player);
    this.playerShadow = contactShadow(this.scene, 0, 0, 1.05, 0.8);
    this.makeOffice();
    this.makeCity();
    this.makeRestaurant();
    this.makeAnnex();
    buildITOffice(this);
    this.addLife();
    buildCityExpansion(this, { box, cylinder, sphere, label, material, human });
    this.cars.push(...this.expansionVehicles);
    buildVerticalCity(this, { box, cylinder, label, material });
    buildCityStreets(this, { box });
    installCityTraffic(this);
    this.cityRoofAt = (x, z) =>
      ROOF_ROUTE.filter((r) => Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2).reduce(
        (h, r) => Math.max(h, r.y),
        0,
      );
    for (const data of Object.values(this.zoneData)) {
      for (const body of data.physics.bodies) body.updateAABB();
      data.physics.broadphase.dirty = true;
    }
    this.batchScenes();
    this.makeRain();
    this.enter('office');
    this.teleport(-8, 2.2);
    this.pose = 'seated';
    this.resize();
    if (this.renderer.isWebGLRenderer) {
      // SSAO in r180 overlays the existing scene buffer; RenderPass must fill it first.
      let composer;
      let ssao;
      try {
        composer = new EffectComposer(this.renderer);
        composer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
        composer.addPass(new RenderPass(this.scene, this.camera));
        ssao = new SSAOPass(this.scene, this.camera, innerWidth, innerHeight, 16);
        ssao.kernelRadius = 0.65;
        ssao.minDistance = 0.001;
        ssao.maxDistance = 0.06;
        composer.addPass(ssao);
        composer.addPass(new OutputPass());
        composer.setSize(innerWidth, innerHeight);
        this.composer = composer;
        this.ssao = ssao;
        this.resize();
      } catch (error) {
        // Optional effects must not prevent a playable, directly rendered scene.
        console.warn('BBE: Zusätzliche Grafikeffekte konnten nicht geladen werden.', error);
        for (const pass of composer?.passes || []) pass.dispose();
        if (ssao && !composer?.passes.includes(ssao)) ssao.dispose();
        composer?.dispose();
        this.setQuality(true);
      }
    }
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }
  group(name) {
    const g = new THREE.Group();
    this.scene.add(g);
    this.groups[name] = g;
    const physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    physics.broadphase = new CANNON.SAPBroadphase(physics);
    const addBody = physics.addBody.bind(physics);
    physics.addBody = (body) => {
      body.updateAABB();
      addBody(body);
      physics.broadphase.dirty = true;
    };
    physics.defaultContactMaterial.friction = 0;
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physics.addBody(ground);
    const body = new CANNON.Body({
      mass: 75,
      fixedRotation: true,
      shape: new CANNON.Sphere(0.32),
      linearDamping: 0,
    });
    body.position.set(0, 0.34, 0);
    body.updateMassProperties();
    physics.addBody(body);
    this.zoneData[name] = { physics, body, interactions: [], npcs: [], obstacles: [], bounds: 50 };
    return g;
  }
  obstacle(zone, x, z, w, d, y = 1, h = 2, mesh = null) {
    const data = this.zoneData[zone];
    const b = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
    });
    b.position.set(x, y, z);
    data.physics.addBody(b);
    if (mesh) data.obstacles.push(mesh);
    return b;
  }
  solid(zone, g, x, y, z, w, h, d, color) {
    const m = box(g, x, y, z, w, h, d, color);
    this.obstacle(zone, x, z, w, d, y, h, m);
    return m;
  }
  interact(zone, id, labelText, x, z, { kind = id, data = null, radius = 2.05, y = 1.6 } = {}) {
    this.zoneData[zone].interactions.push({ id, label: labelText, x, z, kind, data, radius, y });
  }
  makeOffice() {
    const g = this.group('office');
    this.zoneData.office.bounds = 20;
    const floorTex = canvasTexture(512, 512, (c) => {
      c.fillStyle = '#b9a689';
      c.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 64) {
        for (let x = -128; x < 512; x += 256) {
          const off = ((y / 64) % 2) * 100;
          c.fillStyle = `rgba(72,54,31,${rnd(0.04, 0.13)})`;
          c.fillRect(x + off, y, 254, 63);
          for (let k = 0; k < 30; k++) {
            c.strokeStyle = 'rgba(50,39,30,.08)';
            c.beginPath();
            c.moveTo(x + off, y + rnd(0, 63));
            c.lineTo(x + off + 250, y + rnd(0, 63));
            c.stroke();
          }
        }
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 5);
    box(
      g,
      0,
      -0.07,
      0,
      27,
      0.14,
      22,
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }),
    );
    // Glazing and masonry meet exactly; no invisible wall or open slits.
    for (const [a, b] of [
      [-13.5, 7.25],
      [8.75, 13.5],
    ])
      this.solid('office', g, (a + b) / 2, 0.35, -11, b - a, 0.7, 0.2, '#e7e8de');
    this.solid('office', g, 0, 3.15, -11, 27, 0.5, 0.2, '#e7e8de');
    for (const [a, b] of [
      [-13.5, -11.9],
      [-8.1, -6.9],
      [-3.1, -1.9],
      [1.9, 3.1],
      [6.9, 7.25],
      [8.75, 9.4],
      [12.6, 13.5],
    ])
      this.solid('office', g, (a + b) / 2, 1.8, -11, b - a, 2.2, 0.2, '#e7e8de');
    this.solid('office', g, 8, 2.81, -11, 1.5, 0.18, 0.2, '#e7e8de');
    // A real 2.5 m opening joins the existing office to the IT corridor.
    for (const [a, b] of [
      [-11, 4.75],
      [7.25, 11],
    ])
      this.solid('office', g, -13.5, 1.7, (a + b) / 2, 0.2, 3.4, b - a, '#e0e4dc');
    this.solid('office', g, -13.5, 3.05, 6, 0.2, 0.7, 2.5, '#e0e4dc');
    this.solid('office', g, 13.5, 1.7, 0, 0.2, 3.4, 22, '#e4e8df');
    // Reception exit and WC belong to the corridor wall, with real openings.
    for (const [a, b] of [
      [-13.5, -0.95],
      [0.95, 3.3],
      [4.7, 13.5],
    ])
      this.solid('office', g, (a + b) / 2, 1.7, 11, b - a, 3.4, 0.2, '#dde2dc');
    for (const [x, width] of [
      [0, 1.9],
      [4, 1.4],
    ]) {
      this.solid('office', g, x, 3.07, 11, width, 0.66, 0.2, '#dde2dc');
      // Enclosed recess behind the leaf keeps opening doors from exposing the void.
      box(g, x, -0.035, 11.6, width, 0.07, 1.3, '#a0aaa3');
      box(g, x, 1.55, 12.2, width, 3.1, 0.1, '#cbd5cc');
      for (const side of [-1, 1])
        box(g, x + (side * width) / 2, 1.55, 11.6, 0.08, 3.1, 1.2, '#d6ddd4');
    }
    const windowGlass = new THREE.MeshPhysicalMaterial({
      color: '#b5d4dc',
      transparent: true,
      opacity: 0.14,
      roughness: 0.09,
      metalness: 0.2,
      depthWrite: false,
    });
    for (const [x, width] of [
      [-10, 3.8],
      [-5, 3.8],
      [0, 3.8],
      [5, 3.8],
      [11, 3.2],
    ]) {
      const pane = this.solid('office', g, x, 1.8, -10.96, width, 2.2, 0.045, windowGlass);
      pane.name = 'Office street window';
      pane.castShadow = false;
      box(g, x, 0.73, -10.74, width + 0.12, 0.12, 0.45, '#e9e7db');
      for (const xx of [x - width / 2 + 0.045, x, x + width / 2 - 0.045])
        box(g, xx, 1.8, -10.87, 0.07, 2.2, 0.09, '#ebeee7');
      for (const y of [0.74, 2.2, 2.87]) box(g, x, y, -10.87, width, 0.055, 0.09, '#ebeee7');
      for (let i = 0; i < 8; i++)
        box(g, x, 2.62 + i * 0.035, -10.8, width, 0.018, 0.1, '#d6d6c9', false);
    }
    for (const z of [-6, 0, 6]) {
      box(g, 0, 3.22, z, 24, 0.08, 0.045, '#cbd0c9');
      for (const x of [-8, -1, 6]) {
        const m = box(
          g,
          x,
          3.16,
          z,
          2.5,
          0.045,
          0.28,
          new THREE.MeshStandardMaterial({
            color: '#fff5db',
            emissive: '#fff3d6',
            emissiveIntensity: 1.8,
          }),
        );
      }
    }
    box(g, -5, 0.013, -4, 13, 0.012, 10, '#64797c');
    this.workstation = new THREE.Group();
    this.workstation.userData.dynamic = true;
    g.add(this.workstation);
    this.makeWorkstation();
    for (const [x, z] of [
      [-8, -7],
      [-3, -7],
      [-8, -3],
      [-3, -3],
    ]) {
      desk(g, x, z);
      chair(g, x, z + 1.1, Math.PI);
      this.obstacle('office', x, z, 2.3, 1.12, 0.6, 1.2);
    }
    label(g, 'BBE Handelsberatung', -13.36, 2.12, -3, 4.8, 0.8, {
      rotation: Math.PI / 2,
      sub: 'RETAIL EXPERTISE SEIT 1953',
    });
    // Glass meeting room with a broad walk-through doorway.
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#a8c8c7',
      transparent: true,
      opacity: 0.2,
      roughness: 0.12,
      metalness: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const [z, d] of [
      [-8.4, 5.2],
      [1, 6.2],
    ]) {
      this.solid('office', g, 3, 1.45, z, 0.08, 2.9, d, glass);
      for (const zz of [z - d / 2, z + d / 2]) box(g, 3, 1.45, zz, 0.07, 2.9, 0.07, '#516c71');
    }
    for (const x of [4.75, 11.25]) this.solid('office', g, x, 1.45, -5.8, 3.5, 2.9, 0.07, glass);
    const meetingGlass = this.solid('office', g, 8, 1.45, 4, 10, 2.9, 0.07, glass);
    meetingGlass.name = 'Meeting room · rear glass';
    label(g, 'ISAR · BESPRECHUNG', 3.1, 2.25, -3.6, 2.5, 0.4, { rotation: -Math.PI / 2 });
    box(g, 8, 0.8, -1, 4.5, 0.13, 2, '#9e805c');
    for (const x of [6.5, 9.5])
      for (const z of [-1.7, -0.3]) box(g, x, 0.4, z, 0.1, 0.8, 0.1, '#2d444b');
    this.obstacle('office', 8, -1, 4.5, 2, 0.7, 1.3);
    for (const x of [6.5, 8, 9.5]) {
      chair(g, x, -2.7, 0);
      chair(g, x, 0.8, Math.PI);
      mug(g, x, 0.94, -0.5);
    }
    box(g, 13.34, 1.95, -1, 0.09, 1.55, 3.2, '#182c35');
    label(g, 'BBE Handelsberatung', 13.28, 1.95, -1, 2.9, 1.4, {
      rotation: -Math.PI / 2,
      bg: '#173b49',
      sub: 'WACHSTUM BEGINNT MIT EINER GUTEN FRAGE.',
    });
    const strategyBoard = box(g, 7, 1.75, 3.91, 2.6, 1.4, 0.045, '#e9e8df');
    strategyBoard.name = 'Meeting room · strategy board backing';
    this.zoneData.office.obstacles.push(strategyBoard);
    const strategyCaption = label(g, 'Strategie 2026', 7, 2, 3.87, 2.3, 0.7, {
      rotation: Math.PI,
      bg: '#f1f0e8',
      fg: '#244e60',
      sub: 'INSIGHT → ENTSCHEIDUNG → WIRKUNG',
    });
    strategyCaption.name = 'Meeting room · strategy board text';
    strategyCaption.material.side = THREE.FrontSide;
    // Reception, kitchen, printer, pinboard, archive and restrooms.
    this.solid('office', g, -6, 0.59, 7, 4, 1.18, 1.1, '#1b4755');
    box(g, -6, 1.21, 7, 4.25, 0.07, 1.3, '#c3ae8b');
    label(g, 'BBE Handelsberatung', -6, 0.77, 7.56, 3.6, 0.6, {
      sub: 'BRIENNER STRASSE 45 · MÜNCHEN',
    });
    const receptionScreen = new THREE.Group();
    receptionScreen.name = 'Reception monitor · operator side';
    receptionScreen.position.set(-6, 0, 6.8);
    receptionScreen.rotation.y = Math.PI;
    g.add(receptionScreen);
    monitor(receptionScreen, 0, 1.7195, 0, 0.68);
    chair(g, -6, 6.15, 0);
    this.interact('office', 'reception', 'Empfang · Aufträge & Spielstand', -6, 8.9, {
      kind: 'reception',
      radius: 2.4,
    });
    this.solid('office', g, 10, 0.46, 8.4, 6, 0.92, 0.75, '#e0dfd2');
    box(g, 10, 0.94, 8.4, 6.15, 0.07, 0.92, '#8a9895');
    for (let x = 7.7; x < 12.7; x += 1) box(g, x, 0.55, 7.99, 0.025, 0.65, 0.015, '#a6ada5');
    box(g, 8.1, 1.26, 8.4, 0.52, 0.55, 0.47, material('#515c5d', 0.4, 0.5));
    box(g, 8.1, 1.31, 8.14, 0.38, 0.19, 0.02, '#17333a');
    label(g, 'KAFFEE', 8.1, 1.35, 8.126, 0.3, 0.13, { fg: '#80eed1', rotation: Math.PI });
    box(g, 8.1, 1.01, 8.13, 0.45, 0.04, 0.26, '#1b2b2e');
    mug(g, 8.1, 1.095, 8.06);
    this.interact('office', 'coffee', 'Kaffee holen · kostenlos', 8.1, 7.1, { kind: 'coffee' });
    cylinder(g, 10.5, 1.18, 8.25, 0.025, 0.37, '#d6ded8');
    box(g, 12.5, 1.05, 9.7, 1.1, 2.1, 0.8, '#cbd4d0');
    label(g, 'KÜCHE', 10, 2.35, 10.87, 2, 0.5, { rotation: Math.PI, bg: '#dee4da', fg: '#31575e' });
    this.solid('office', g, -11, 0.55, 3.1, 1.1, 1.1, 0.8, '#d9ded7');
    box(g, -11, 1.13, 3.1, 1, 0.12, 0.8, '#778585');
    box(g, -11, 1.22, 3.25, 0.4, 0.035, 0.3, '#f7f3e5');
    this.interact('office', 'printer', 'Drucker · kleine Bürogeschichte', -10.9, 4.4, {
      kind: 'printer',
    });
    box(g, -13.32, 1.85, 3, 0.1, 1.35, 2.5, '#a58457');
    for (let i = 0; i < 6; i++) {
      box(
        g,
        -13.25,
        1.5 + (i % 2) * 0.53,
        2.2 + Math.floor(i / 2) * 0.65,
        0.015,
        0.4,
        0.48,
        ['#ddd185', '#a5cbb7', '#edd4ba'][i % 3],
      );
    }
    for (const x of [-11, -9]) {
      this.solid('office', g, x, 1.1, 10.3, 1.5, 2.2, 0.55, '#e3e1d3');
      for (let i = 0; i < 9; i++)
        box(
          g,
          x - 0.55 + i * 0.14,
          1.65,
          9.98,
          0.1,
          0.42,
          0.2,
          ['#285569', '#738783', '#c9b284'][i % 3],
        );
    }
    portal(this, 'office', 'wc', 4, 10.94, { title: 'WC · TOILETTEN' });
    this.interact(
      'office',
      'wc',
      'Toiletten betreten',
      INTERIOR_LAYOUT.wc.x,
      INTERIOR_LAYOUT.wc.z,
      { kind: 'wc', radius: 1.3 },
    );
    portal(this, 'office', 'exit', 0, 10.94, {
      width: 1.8,
      title: 'AUSGANG · BRIENNER STRASSE',
      glass: true,
    });
    label(g, 'WC  ←      EMPFANG  →', 1.8, 2.8, 10.82, 2.1, 0.3, {
      rotation: Math.PI,
      bg: '#dde2dc',
      fg: '#31575b',
    });
    this.interact(
      'office',
      'exit',
      'Büro verlassen · Brienner Straße',
      INTERIOR_LAYOUT.exit.x,
      INTERIOR_LAYOUT.exit.z,
      {
        kind: 'exit',
        radius: 1.8,
      },
    );
    const partnerDoor = portal(this, 'office', 'partner-entry', 8, -10.94, {
      width: 1.4,
      rotation: 0,
      title: 'PARTNERBÜRO · LEVEL 7',
    });
    partnerDoor.root.userData.dynamic = false;
    partnerDoor.mesh.userData.dynamic = true;
    for (const x of [-0.685, 0.685])
      box(partnerDoor.root, x, 1.325, -0.067, 0.085, 2.65, 0.03, '#465e61');
    box(partnerDoor.root, 0, 2.62, -0.067, 1.4, 0.04, 0.03, '#465e61');
    box(g, 8, -0.035, -11.6, 1.5, 0.07, 1.3, '#a0aaa3');
    box(g, 8, 1.55, -12.2, 1.5, 3.1, 0.1, '#cbd5cc');
    for (const x of [7.25, 8.75]) box(g, x, 1.55, -11.6, 0.08, 3.1, 1.2, '#d6ddd4');
    this.interact('office', 'partner', 'Partnerbüro', 8, -9.2, { kind: 'partner' });
    for (const [x, z] of [
      [-12, -9],
      [1, -9],
      [1, 3],
      [12, 4.7],
      [-9, 7],
      [6, 6],
    ])
      plant(g, x, z, 1.25);
    const colleagues = [
      { name: 'Lena · Projektleitung', x: -8, z: -5.9, pose: 'work', jacket: '#796a62' },
      { name: 'Tobias · Research', x: -3, z: -5.9, pose: 'work', jacket: '#66786b' },
      { name: 'Mara · Consulting', x: 5.6, z: 5.3, pose: 'phone', jacket: '#9c6663' },
      { name: 'Jan · Partner', x: 10.5, z: -8, pose: 'walk', jacket: '#303f50' },
    ];
    for (const c of colleagues) {
      const npc = human({ jacket: c.jacket, scale: 0.98 });
      npc.position.set(c.x, 0, c.z);
      npc.rotation.y = Math.PI;
      g.add(npc);
      this.zoneData.office.npcs.push({ mesh: npc, ...c, origin: { x: c.x, z: c.z } });
      this.interact(
        'office',
        `colleague-${c.name}`,
        `Mit ${c.name.split(' ·')[0]} sprechen`,
        c.x,
        c.z,
        {
          kind: 'colleague',
          data: c.name,
          radius: 1.9,
        },
      );
    }
    this.interact('office', 'lounge', 'Senior Lounge · kurz durchatmen', 6.3, -8.5, {
      kind: 'lounge',
    });
    box(g, 5.4, 0.5, -9, 2.3, 0.65, 1, '#64857e');
    box(g, 5.4, 0.85, -9.45, 2.3, 0.6, 0.15, '#64857e');
  }
  makeWorkstation() {
    const g = this.workstation;
    if (!g) return;
    g.traverse((object) => {
      if (object.isInstancedMesh) object.dispose();
    });
    g.clear();
    const level = this.sim.level;
    desk(g, -8, 1, {
      width: level >= 5 ? 3.4 : 2.5,
      dual: level >= 3 || this.sim.s.upgrades.includes('monitor'),
    });
    chair(g, -8, 2.15, Math.PI, level >= 4 ? '#6c493a' : '#344c58');
    const plaque = box(g, -8, 1.05, 1.55, 1.6, 0.21, 0.03, '#ded9c9', false);
    plaque.name = 'Desk nameplate backing';
    const nameplate = label(g, 'DEIN ARBEITSPLATZ', -8, 1.05, 1.567, 1.6, 0.21, {
      bg: '#ded9c9',
      fg: '#224a58',
    });
    nameplate.name = 'Desk nameplate face';
    nameplate.material.side = THREE.FrontSide;
    for (const x of [-8.55, -7.45]) {
      box(g, x, 0.885, 1.5, 0.035, 0.135, 0.1, '#a6b5b1', false);
      box(g, x, 0.825, 1.485, 0.13, 0.015, 0.16, '#a6b5b1', false);
    }
    if (level >= 2 || this.sim.s.upgrades.includes('mouse'))
      sphere(g, -7.56, 0.863, 1.23, 0.065, 0.032, 0.09, '#213b47');
    if (this.sim.s.upgrades.includes('plant')) {
      const p = new THREE.Group();
      p.position.set(-9, 0.84, 1);
      p.scale.setScalar(0.32);
      g.add(p);
      plant(p, 0, 0);
    }
    if (level >= 5 || this.sim.s.upgrades.includes('award')) {
      cylinder(g, -6.9, 1.04, 0.65, 0.09, 0.32, '#caa657');
      sphere(g, -6.9, 1.28, 0.65, 0.17, 0.19, 0.17, '#caa657');
    }
    if (!this.zoneData.office.interactions.some((x) => x.id === 'computer')) {
      this.obstacle('office', -8, 1, 2.5, 1.1, 0.5, 1);
      this.interact('office', 'computer', 'Computer benutzen · BBE Desktop', -8, 2.35, {
        kind: 'computer',
        radius: 2.25,
      });
    }
  }
  facadeTexture(color, seed = 0) {
    return canvasTexture(512, 512, (c) => {
      c.fillStyle = color;
      c.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 6500; i++) {
        c.fillStyle = `rgba(40,38,33,${Math.random() * 0.07})`;
        c.fillRect(rnd(0, 512), rnd(0, 512), 2, 2);
      }
      for (let y = 20; y < 500; y += 96) {
        c.fillStyle = 'rgba(255,250,233,.45)';
        c.fillRect(0, y + 74, 512, 5);
        for (let x = 18; x < 512; x += 96) {
          c.fillStyle = '#d9d5c6';
          c.fillRect(x - 5, y - 5, 64, 74);
          c.fillStyle = '#536775';
          c.fillRect(x, y, 54, 64);
          const grad = c.createLinearGradient(x, y, x + 54, y + 64);
          grad.addColorStop(0, '#9db4bc');
          grad.addColorStop(1, '#344956');
          c.fillStyle = grad;
          c.fillRect(x + 3, y + 3, 48, 58);
          c.fillStyle = (x + y + seed) % 3 ? 'rgba(220,219,191,.3)' : 'rgba(254,218,130,.8)';
          c.fillRect(x + 8, y + 7, 12, 51);
          c.fillRect(x + 37, y + 7, 9, 51);
          c.fillStyle = '#e7e4d7';
          c.fillRect(x + 25, y, 4, 64);
          c.fillRect(x, y + 30, 54, 3);
          c.fillStyle = '#b2ac9b';
          c.fillRect(x - 7, y + 64, 68, 7);
        }
      }
    });
  }
  building(g, x, z, w, d, h, color, seed) {
    const tex = this.facadeTexture(color, seed);
    const m = box(
      g,
      x,
      h / 2,
      z,
      w,
      h,
      d,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.91 }),
    );
    this.obstacle('city', x, z, w, d, h / 2, h, m);
    (this.cityBlocks ||= []).push({ x, z, w, d });
    box(g, x, h + 0.14, z, w + 0.6, 0.32, d + 0.6, '#d5cbbb');
    box(g, x, h + 0.5, z, w + 0.1, 0.7, d + 0.1, '#4d5b61');
    box(g, x, 3.3, z, w + 0.08, 0.22, d + 0.08, '#c3bba8');
    m.userData.plinth = box(g, x, 0.32, z, w + 0.05, 0.5, d + 0.05, '#918d81');
    return m;
  }
  makeCity() {
    const g = this.group('city');
    this.zoneData.city.bounds = 126; // Keep exploration inside the built neighbourhood.
    // One tessellated street surface is built after the architecture. Keeping
    // crossing slabs here caused overlapping asphalt and kerbs through junctions.
    box(g, 0, -0.075, -28, 320, 0.1, 320, '#8f9883', false);
    for (const z of [40, -43]) {
      for (const zz of [z - 9, z + 9])
        for (let x = -7; x < 8; x += 2.1) box(g, x, 0.094, zz, 1.2, 0.016, 3, '#e2e0d4', false);
      // Directional signals are installed with the final street geometry.
    }
    for (let i = 0; i < 14; i++) {
      const z = 110 - i * 20;
      for (const side of [-1, 1]) {
        if (
          [40, -43].some((t) => Math.abs(t - z) < 14) ||
          (side > 0 && Math.abs(z + 40) < 25) ||
          (side > 0 && z > 45 && z < 68)
        )
          continue;
        this.building(
          g,
          side * 38,
          z,
          41,
          17,
          15 + (i % 4) * 3,
          ['#d8c6a7', '#e5dcca', '#aebabb', '#cebdaf', '#c7c9bb'][i % 5],
          i,
        );
      }
    }
    for (const x of [-105, -78, 78, 105])
      for (const z of [-112, -82, -13, 15, 73, 100])
        this.building(
          g,
          x,
          z,
          24,
          22,
          15 + (Math.abs(z) % 4) * 3,
          ['#c7c4b7', '#ded0b9', '#c9b1a0'][Math.abs(z) % 3],
          z,
        );
    // Headquarters is the unmistakable navigation anchor of the neighbourhood.
    const hqBuilding = this.building(
      g,
      CITY_LAYOUT.hqBuilding.x,
      CITY_LAYOUT.hqBuilding.z,
      36,
      21,
      19,
      '#ded5bd',
      7,
    );
    // A recessed entrance cut into the facade, not a door pasted onto an opaque wall.
    const entrance = new THREE.Shape(),
      left = (-10 - 1.14) / 36,
      right = (-10 + 1.14) / 36,
      top = 3.08 / 19 - 0.5;
    entrance.moveTo(-0.5, -0.5);
    entrance.lineTo(left, -0.5);
    entrance.lineTo(left, top);
    entrance.lineTo(right, top);
    entrance.lineTo(right, -0.5);
    entrance.lineTo(0.5, -0.5);
    entrance.lineTo(0.5, 0.5);
    entrance.lineTo(-0.5, 0.5);
    entrance.closePath();
    const facade = new THREE.ExtrudeGeometry(entrance, { depth: 1, bevelEnabled: false });
    facade.translate(0, 0, -0.5);
    const uv = facade.attributes.uv,
      pos = facade.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + 0.5, pos.getY(i) + 0.5);
    hqBuilding.geometry = facade;
    hqBuilding.userData.plinth.visible = false;
    for (const [a, b] of [
      [23, 29.86],
      [32.14, 59],
    ])
      box(g, (a + b) / 2, 0.32, 49.49, b - a, 0.5, 0.12, '#918d81');
    for (const x of [29.83, 32.17]) box(g, x, 1.55, 50.75, 0.12, 3.1, 2.6, '#bac9c4');
    box(g, 31, 1.55, 52.03, 2.3, 3.1, 0.1, '#527074');
    box(g, 31, 0.12, 50.7, 2.3, 0.12, 2.7, '#9daba8');
    box(g, 31, 3.1, 50.7, 2.3, 0.1, 2.7, '#cbd6cc');
    label(g, 'EMPFANG · BBE', 31, 1.85, 51.96, 1.8, 0.35, { rotation: Math.PI });
    label(g, 'BBE Handelsberatung', 40, 4.6, 49.37, 24, 2.2, {
      rotation: Math.PI,
      bg: '#1d5060',
      sub: 'BRIENNER STRASSE 45 · MÜNCHEN',
    });
    portal(this, 'city', 'hq', CITY_LAYOUT.hq.x, 49.24, {
      width: 2.1,
      height: 2.95,
      title: 'BBE · EMPFANG',
      glass: true,
    });
    box(g, 31, 0.115, 48.9, 2.55, 0.1, 0.72, '#aaa99f');
    label(g, '45', 33.2, 2.4, 49.2, 1, 0.8, { rotation: Math.PI });
    this.interact(
      'city',
      'hq',
      'BBE Handelsberatung betreten',
      CITY_LAYOUT.hqDoor.x,
      CITY_LAYOUT.hqDoor.z,
      { kind: 'hq', radius: 3.5 },
    );
    this.hq = { ...CITY_LAYOUT.hq };
    for (const r of RESTAURANTS) {
      const sign = r.x < 0 ? 1 : -1,
        rot = (sign * Math.PI) / 2;
      const sx = sign < 0 ? 17.48 : -17.48;
      const storefront = new THREE.Group();
      g.add(storefront);
      box(storefront, sx, 1.8, r.z, 0.14, 3.5, 14, material(r.color, 0.65));
      label(storefront, r.name, sx + sign * 0.1, 3.03, r.z, 12.8, 0.78, {
        rotation: rot,
        bg: r.color,
        sub: r.address.toUpperCase(),
      });
      box(storefront, sx + sign * 0.12, 1.46, r.z, 0.08, 2.5, 2.1, material('#819fa7', 0.18, 0.5));
      for (const zz of [-4.5, 4.5]) {
        box(
          storefront,
          sx + sign * 0.12,
          1.5,
          r.z + zz,
          0.08,
          2.15,
          3.8,
          material('#78999e', 0.15, 0.45),
        );
        const awning = box(storefront, sx + sign * 0.8, 2.61, r.z + zz, 1.75, 0.1, 4.3, r.color);
        awning.rotation.z = -sign * 0.13;
      }
      this.interact('city', `enter-${r.id}`, `${r.name} betreten`, r.x + sign * 1.5, r.z, {
        kind: 'restaurant',
        data: r.id,
        radius: 2.5,
      });
      this.interact(
        'city',
        `photo-${r.id}`,
        'Speisekarte fotografieren · BBE Benchmark',
        r.x + sign * 2,
        r.z + 4,
        { kind: 'photo', data: r.id, radius: 1.7 },
      );
      label(g, 'SPEISEKARTE', r.x + sign * 1.1, 1.1, r.z + 4, 1, 0.9, {
        rotation: rot,
        bg: '#213a3c',
        sub: 'FRISCH. LOKAL. MITTAG.',
      });
      for (const zz of [-5.5, 5.5]) {
        cylinder(g, r.x + sign * 3, 0.72, r.z + zz, 0.65, 0.08, '#d0b086');
        cylinder(g, r.x + sign * 3, 0.35, r.z + zz, 0.045, 0.7, '#526b6d');
        for (const zzz of [-0.85, 0.85])
          chair(g, r.x + sign * 3, r.z + zz + zzz, zzz < 0 ? 0 : Math.PI, '#675c48');
      }
      plant(g, r.x + sign * 2, r.z - 7, 0.85);
    }
    for (let i = 0; i < 20; i++) {
      const z = -146 + i * 13;
      const x = i % 2 ? 11.6 : -11.6;
      if ([40, -43].some((t) => Math.abs(t - z) < 13)) continue;
      this.tree(g, x, z);
      this.obstacle('city', x, z, 0.6, 0.6, 1.4, 2.8);
      if (i % 3 === 0) {
        cylinder(g, x + 1, 0.55, z + 2, 0.28, 1.1, '#516267');
        cylinder(g, x + 1, 1.1, z + 2, 0.31, 0.08, '#2d4248');
      }
      if (i % 3 === 1) {
        this.lamp(g, x, z + 3);
      }
    }
    for (let x = 41; x < 235; x += 40) this.lamp(g, x, 46.8);
    for (let x = 51; x < 235; x += 40) this.lamp(g, x, 33.2);
    this.bicycleParking = [];
    for (let i = 0; i < 9; i++) {
      const x = 12.3,
        z = -118 + i * 24;
      // Park entirely on the footway, leaving the Gabelsberger junction empty.
      if (Math.abs(z + 43) < 9) continue;
      const bike = this.bicycle(g, x, z, Math.PI / 2);
      bike.position.y = 0.105;
      const rack = new THREE.Group();
      rack.position.set(x, 0, z + 0.6);
      g.add(rack);
      const metal = material('#a4afad', 0.4, 0.6);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 20, Math.PI), metal);
      arch.position.y = 0.53;
      rack.add(arch);
      for (const side of [-1, 1]) {
        cylinder(rack, side * 0.4, 0.3, 0, 0.03, 0.46, metal);
        box(rack, side * 0.4, 0.084, 0, 0.13, 0.025, 0.13, metal);
      }
      this.bicycleParking.push({ x, z, bike, rack });
    }
    // Stop, delivery vehicles, work zone, and a return machine.
    box(g, 11.2, 1.65, 98, 0.08, 3.3, 0.08, '#79908c');
    label(g, 'H · AUGUSTENSTRASSE', 11.2, 2.9, 98, 3.2, 0.8, {
      rotation: -Math.PI / 2,
      bg: '#ecdf86',
      fg: '#2c664f',
      sub: 'BUS 100 · MUSEENLINIE',
    });
    box(g, 13.4, 2.55, 99, 3, 0.12, 6, '#5d7378');
    box(g, 14.8, 1.4, 99, 0.06, 2.2, 6, material('#9fbdc0', 0.18, 0.3));
    box(g, 13.7, 0.55, 99, 0.7, 0.16, 3.8, '#896b4a');
    for (let i = 0; i < 5; i++) {
      box(g, -70 - i * 2, 1, 32, 0.07, 2, 0.07, '#c78a58');
      box(g, -70 - i * 2, 1.4, 32, 1.8, 0.32, 0.15, i % 2 ? '#f0e2cb' : '#c85643');
    }
    box(g, -75, 0.2, 29, 12, 0.4, 4, '#9e8d70');
    this.building(g, 35, -40, 25, 13, 14, '#d1c9b8', 11);
    label(g, 'KUNDENBÜRO · RETAIL LAB', 35, 3, -33.4, 18, 1.2, {
      bg: '#58786d',
      sub: 'GABELSBERGERSTRASSE',
    });
    this.interact('city', 'client', 'Kundentermin wahrnehmen', 35, -30.5, {
      kind: 'client',
      radius: 3,
    });
    box(g, 15.8, 1.25, 31, 1.6, 2.5, 1.3, '#477968');
    box(g, 14.97, 1.1, 31, 0.04, 1.45, 0.91, '#b9c8bf');
    const hole = cylinder(g, 14.92, 1.4, 31, 0.25, 0.08, '#1b302c');
    hole.rotation.z = Math.PI / 2;
    label(g, 'PFAND', 14.94, 2.16, 31, 1.15, 0.42, {
      rotation: -Math.PI / 2,
      bg: '#244b40',
      sub: 'JEDER CENT ZÄHLT',
    });
    this.interact('city', 'return', 'Pfandautomat benutzen', 13.3, 31, {
      kind: 'return',
      radius: 2.4,
    });
    this.bottles = [];
    for (let i = 0; i < 48; i++) {
      const x = (i % 2 ? 1 : -1) * (10.4 + (i % 4) * 0.7),
        z = -144 + ((i * 37) % 256);
      if ([40, -43].some((t) => Math.abs(t - z) < 8)) continue;
      const cents = [25, 15, 8][i % 3];
      const bottle = new THREE.Group();
      bottle.position.set(x, 0.11, z);
      bottle.userData.dynamic = true;
      g.add(bottle);
      this.bottleMesh(bottle, cents);
      bottle.rotation.z = Math.PI / 2;
      bottle.rotation.y = i * 2.1;
      const id = `b${i}`;
      this.bottles.push({ mesh: bottle, id });
      this.interact('city', id, 'Flasche aufheben', x, z, {
        kind: 'bottle',
        data: { id, cents },
        radius: 1.45,
        y: 0.35,
      });
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1,
        x = side * (10.8 + (i % 3) * 1.1),
        z = -142 + i * 9.3;
      const npc = human({
        jacket: ['#476b76', '#9c6c4f', '#737b68', '#4c526c', '#beaa86'][i % 5],
        hair: i % 3 ? '#44362c' : '#bf9c68',
        skin: i % 4 === 0 ? '#865a44' : '#d7af8c',
        scale: 0.93 + (i % 4) * 0.035,
      });
      g.add(npc);
      const n = {
        mesh: npc,
        x,
        z,
        speed: 0.65 + (i % 4) * 0.17,
        dir: i % 2 ? 1 : -1,
        origin: { x, z },
        pose: i % 7 === 0 ? 'phone' : 'walk',
      };
      this.zoneData.city.npcs.push(n);
      contactShadow(g, x, z, 0.8, 0.6);
      if (i % 5 === 0) {
        box(npc, 0.35, 0.69, 0, 0.25, 0.38, 0.13, '#c3a778');
      }
    }
    for (let i = 0; i < 12; i++) {
      const lane = i % 2 ? 3.9 : -3.9,
        dir = i % 2 ? -1 : 1;
      const type = i === 0 ? 'bus' : i === 4 ? 'van' : i === 7 ? 'taxi' : 'car';
      const car = this.car(g, type, ['#e6e5da', '#54686e', '#7f9396', '#9b574a', '#344a5a'][i % 5]);
      car.position.set(lane, 0, -155 + i * 24);
      car.rotation.y = dir > 0 ? 0 : Math.PI;
      this.cars.push({ mesh: car, lane, dir, speed: 0, max: type === 'bus' ? 6.7 : 8.5, type });
    }
    for (let i = 0; i < 9; i++) {
      const car = this.car(g, i === 2 ? 'van' : 'car', ['#b0b9b7', '#42566b', '#e1dacb'][i % 3]);
      car.userData.dynamic = true;
      car.position.set(i % 2 ? 7.8 : -7.8, 0, i === 7 ? 57 : -124 + i * 25);
      if ([40, -43].some((t) => Math.abs(car.position.z - t) < 13)) {
        car.position.z -= 12;
      }
      const body = this.obstacle('city', car.position.x, car.position.z, 1.9, 4.3, 0.8, 1.6);
      this.cars.push({
        mesh: car,
        type: i === 2 ? 'van' : 'car',
        parked: true,
        speed: 0,
        max: 0,
        body,
      });
    }
  }
  tree(g, x, z) {
    cylinder(g, x, 2.25, z, 0.19, 4.5, '#71664e', 0.13);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      sphere(
        g,
        x + Math.sin(a) * 0.95,
        4.6 + (i % 3) * 0.5,
        z + Math.cos(a) * 0.85,
        1.1,
        1.35,
        1.1,
        ['#6d844e', '#829558', '#4f744b'][i % 3],
      );
    }
    contactShadow(g, x, z, 5, 5);
  }
  lamp(g, x, z) {
    cylinder(g, x, 2.65, z, 0.055, 5.3, '#52666a');
    box(g, x + 0.35, 5.28, z, 0.75, 0.08, 0.08, '#52666a');
    const lens = box(
      g,
      x + 0.67,
      5.19,
      z,
      0.5,
      0.08,
      0.32,
      (this.streetLampMaterial ||= new THREE.MeshStandardMaterial({
        color: '#ece8d4',
        emissive: '#ffd59b',
        emissiveIntensity: 0.25,
      })),
    );
    (this.streetLamps ||= []).push({ x: x + 0.67, z, material: lens.material });
  }
  trafficLight(g, x, z, rot) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rot;
    g.add(root);
    cylinder(root, 0, 1.7, 0, 0.07, 3.4, '#586565');
    box(root, 0, 3.15, 0, 0.43, 1.13, 0.33, '#21312f');
    const lights = [];
    for (let i = 0; i < 3; i++) {
      const m = sphere(
        root,
        0,
        3.52 - i * 0.34,
        0.18,
        0.13,
        0.13,
        0.055,
        ['#ff5a3d', '#eaba51', '#77d7a1'][i],
      );
      m.material = m.material.clone();
      lights.push(m);
    }
    this.trafficLights ??= [];
    root.userData.dynamic = true;
    this.trafficLights.push({ lights });
  }
  bicycle(g, x, z, rotation) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotation;
    g.add(root);
    for (const zz of [-0.57, 0.57]) {
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.032, 7, 24),
        material('#273c42'),
      );
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.37, zz);
      root.add(wheel);
      for (let i = 0; i < 5; i++) {
        const spoke = box(root, 0, 0.37, zz, 0.012, 0.65, 0.012, '#b6beb4');
        spoke.rotation.x = (i * Math.PI) / 5;
      }
    }
    const bar = (y, z, l, rot, c = '#bda35d') => {
      const b = box(root, 0, y, z, 0.045, l, 0.045, c);
      b.rotation.x = rot;
    };
    bar(0.58, 0, 0.8, Math.PI / 2);
    bar(0.63, -0.27, 0.7, -0.75);
    bar(0.65, 0.3, 0.64, 0.7);
    bar(0.9, 0.02, 0.65, Math.PI / 2);
    bar(0.87, -0.32, 0.55, -0.2);
    box(root, 0, 1.13, -0.35, 0.22, 0.04, 0.22, '#273840');
    bar(1.025, 0.53, 0.295, 0.137, '#4e696a');
    box(root, 0, 1.17, 0.55, 0.5, 0.025, 0.035, '#4e696a');
    return root;
  }
  car(g, type, color) {
    return blenderVehicle(g, type, color, { box, label, contactShadow });
  }
  bottleMesh(g, cents = 25) {
    const c = cents === 8 ? '#69805a' : cents === 15 ? '#996443' : '#81bbb6';
    cylinder(g, 0, 0.17, 0, 0.068, 0.33, c, 0.07, 10);
    cylinder(g, 0, 0.375, 0, 0.025, 0.1, c, 0.026, 10);
    cylinder(g, 0, 0.43, 0, 0.031, 0.025, '#d5d2b7', 0.031, 10);
    cylinder(g, 0, 0.2, 0, 0.071, 0.11, cents === 25 ? '#dce5d5' : '#ece0b6', 0.071, 10);
  }
  makeRestaurant() {
    const g = this.group('restaurant');
    this.zoneData.restaurant.bounds = 12;
    box(g, 0, -0.055, 0, 17, 0.1, 18, '#b5a58b');
    this.solid('restaurant', g, 0, 1.65, -9, 17, 3.3, 0.16, '#d5c9b4');
    this.solid('restaurant', g, -8.5, 1.65, 0, 0.16, 3.3, 18, '#d5c9b4');
    this.solid('restaurant', g, 8.5, 1.65, 0, 0.16, 3.3, 18, '#d5c9b4');
    this.solid('restaurant', g, 0, 1.65, 9, 17, 3.3, 0.16, '#c2c3ad');
    this.restaurantWall = box(g, 0, 1.65, -8.87, 16.7, 3.25, 0.05, '#507969');
    this.restaurantWall.userData.dynamic = true;
    this.restaurantSign = label(g, 'AUGUSTENSTRASSE', 0, 2.45, -8.79, 8, 1, {
      sub: 'GUT ESSEN. BESSER BERATEN.',
    });
    this.restaurantSign.userData.dynamic = true;
    this.solid('restaurant', g, 0, 0.6, -5.5, 10, 1.2, 1.25, '#826348');
    box(g, 0, 1.23, -5.5, 10.3, 0.08, 1.4, '#c6bba3');
    for (let i = 0; i < 8; i++) {
      box(g, -4 + i * 1.1, 1.3, -5.4, 0.7, 0.035, 0.4, '#dedecf');
      cylinder(g, -4 + i * 1.1, 1.4, -5.7, 0.085, 0.2, '#e1d9c0');
    }
    for (const x of [-6, 0, 6])
      for (const z of [-1, 4.5]) {
        box(g, x, 0.78, z, 1.8, 0.09, 1.4, '#ad895e');
        cylinder(g, x, 0.38, z, 0.075, 0.75, '#38535b');
        this.obstacle('restaurant', x, z, 1.8, 1.4, 0.65, 1.3);
        for (const zz of [-1.15, 1.15]) chair(g, x, z + zz, zz < 0 ? 0 : Math.PI, '#4c6961');
        for (const xx of [-0.5, 0.5]) {
          cylinder(g, x + xx, 0.838, z, 0.22, 0.022, '#f0e9d6');
          mug(g, x + xx, 0.915, z - 0.42);
          box(g, x + xx + 0.29, 0.846, z, 0.03, 0.015, 0.32, material('#bfc7c0', 0.2, 0.75));
        }
        cylinder(g, x, 2.84, z, 0.4, 0.34, '#be9e68', 0.2);
        sphere(g, x, 2.67, z, 0.13, 0.07, 0.13, '#fff3ca');
      }
    for (const z of [-3, 3, 7]) {
      box(g, -8.36, 1.85, z, 0.04, 2, 2.2, material('#99b7bd', 0.13, 0.35));
      box(g, -8.3, 1.85, z, 0.08, 2.2, 0.06, '#dfe0d1');
    }
    plant(g, 7.5, 7.3, 1.8);
    plant(g, -7.2, -7, 1.5);
    this.interact('restaurant', 'order', 'Essen bestellen · Speisekarte', 0, -3.8, {
      kind: 'order',
      radius: 3.4,
    });
    this.interact('restaurant', 'service', 'Mit dem Service sprechen', 3, -3.8, {
      kind: 'service',
      radius: 2,
    });
    this.interact('restaurant', 'r-exit', 'Zur Augustenstraße', 0, 7.5, {
      kind: 'r-exit',
      radius: 2,
    });
    label(g, 'AUGUSTENSTRASSE', 0, 2.35, 8.88, 3.7, 0.55, { rotation: Math.PI, sub: 'AUSGANG' });
    const staff = human({ jacket: '#ebe6d6', pants: '#3d4c47' });
    staff.position.set(2, 0, -6.5);
    g.add(staff);
    this.zoneData.restaurant.npcs.push({
      mesh: staff,
      audioRole: 'staff',
      pose: 'phone',
      origin: { x: 2, z: -6.5 },
    });
    const diner = human({ jacket: '#8b6654' });
    diner.position.set(-6, -0.23, 0.15);
    diner.rotation.y = Math.PI;
    g.add(diner);
    this.zoneData.restaurant.npcs.push({
      mesh: diner,
      audioRole: 'diner',
      pose: 'eat',
      origin: { x: -6, z: 0.15 },
    });
    this.foodProp = new THREE.Group();
    this.foodProp.userData.dynamic = true;
    this.foodProp.position.set(0, 0.87, 4.5);
    g.add(this.foodProp);
    cylinder(this.foodProp, 0, 0, 0, 0.3, 0.03, '#f5edd5');
    for (let i = 0; i < 12; i++)
      sphere(
        this.foodProp,
        Math.cos(i * 2.4) * 0.16,
        0.07 + Math.sin(i) * 0.015,
        Math.sin(i * 2.4) * 0.16,
        0.09,
        0.035,
        0.07,
        ['#d7ac69', '#c76442', '#609754'][i % 3],
      );
    this.foodProp.visible = false;
  }
  addLife() {
    const g = this.groups.city;
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 ? 1 : -1,
        x = dir * 6.6,
        z = -136 + i * 61;
      const rider = human({ jacket: ['#9d8260', '#698a79', '#926c67', '#55768b'][i], scale: 0.96 });
      sphere(rider, 0, 1.81, 0, 0.177, 0.09, 0.17, '#d8d5ba');
      g.add(rider);
      const bike = this.bicycle(g, x, z, 0);
      bike.userData.dynamic = true;
      this.zoneData.city.npcs.push({
        mesh: rider,
        bike,
        cycle: true,
        x,
        z,
        dir,
        speed: 2.6,
        pose: 'cycle',
        origin: { x, z },
      });
    }
    const mara = this.zoneData.office.npcs.find((n) => n.name.startsWith('Mara'));
    mara.path = [
      [8.1, 7],
      [1, 5.2],
      [-10.9, 4.5],
      [1, 5.2],
      [5.6, 5.3],
    ];
    mara.pathIndex = 0;
    const office = this.groups.office;
    box(office, 0, -0.06, -19, 50, 0.1, 16, '#697679');
    box(office, 0, 0.01, -13, 50, 0.08, 4, '#bbc2b5');
    box(office, 0, 0.01, -25, 50, 0.08, 4, '#bbc2b5');
    for (let x = -22; x < 25; x += 12) {
      box(
        office,
        x,
        7.5,
        -32,
        11,
        15,
        8,
        new THREE.MeshStandardMaterial({
          map: this.facadeTexture(['#d5c6ae', '#d9d8c8', '#b5c5c7'][Math.abs(x) % 3]),
          roughness: 0.9,
        }),
      );
      box(office, x, 15.15, -32, 11.3, 0.3, 8.3, '#d9d1bd');
    }
    this.tree(office, 9, -14.8);
    this.tree(office, -9, -25.8);
    const parked = this.car(office, 'car', '#d6d3c7');
    parked.position.set(2, 0, -17);
    parked.rotation.y = Math.PI / 2;
    parked.userData.dynamic = false;
    this.heldFork = new THREE.Group();
    const rig = this.player.userData.rig;
    rig.rightFore.add(this.heldFork);
    this.heldFork.position.set(0, -0.29, 0.025);
    const handle = cylinder(this.heldFork, 0, 0, 0.1, 0.008, 0.26, '#c7d4ce');
    handle.rotation.x = Math.PI / 2;
    for (const x of [-0.018, 0, 0.018]) {
      const tine = cylinder(this.heldFork, x, 0, 0.26, 0.003, 0.075, '#c7d4ce');
      tine.rotation.x = Math.PI / 2;
    }
    this.heldFork.visible = false;
    this.heldCup = new THREE.Group();
    rig.rightFore.add(this.heldCup);
    this.heldCup.position.set(0, -0.32, 0.08);
    mug(this.heldCup, 0, 0, 0);
    this.heldCup.visible = false;
    this.returnProp = new THREE.Group();
    this.returnProp.userData.dynamic = true;
    g.add(this.returnProp);
    this.bottleMesh(this.returnProp, 25);
    this.returnProp.position.set(14.4, 1.15, 31);
    this.returnProp.rotation.z = -Math.PI / 2;
    this.returnProp.visible = false;
    this.restaurantPalette = [];
    for (const node of this.groups.restaurant.children) {
      if (node.isMesh && node.material === material('#ad895e')) this.restaurantPalette.push(node);
    }
  }
  setFood(name) {
    const g = this.foodProp;
    g.clear();
    cylinder(g, 0, 0, 0, 0.32, 0.03, '#f3ead7');
    if (/Espresso|Tee|tee|Matcha|Schorle/.test(name)) {
      mug(g, 0, 0.09, 0, '#dedfd0');
      return;
    }
    if (/Pizza/.test(name)) {
      cylinder(g, 0, 0.038, 0, 0.29, 0.035, '#ca9853');
      cylinder(g, 0, 0.06, 0, 0.266, 0.015, '#b94e2e');
      for (let i = 0; i < 12; i++)
        sphere(
          g,
          Math.sin(i * 2.4) * 0.19,
          0.085,
          Math.cos(i * 2.4) * 0.19,
          0.044,
          0.013,
          0.04,
          i % 3 ? '#eee0b2' : '#598444',
        );
    } else if (/Bao|Gyoza/.test(name)) {
      for (let i = 0; i < 5; i++) {
        sphere(
          g,
          Math.cos(i * 1.25) * 0.18,
          0.08,
          Math.sin(i * 1.25) * 0.18,
          0.085,
          0.07,
          0.06,
          '#e7d6a9',
        );
      }
    } else {
      cylinder(g, 0, 0.08, 0, 0.22, 0.13, '#d7d6bf', 0.31);
      for (let i = 0; i < 21; i++)
        sphere(
          g,
          Math.cos(i * 2.4) * 0.19,
          0.165 + Math.sin(i) * 0.012,
          Math.sin(i * 2.4) * 0.19,
          0.065,
          0.021,
          0.05,
          ['#e6bb74', '#ad633f', '#698a4e'][i % 3],
        );
    }
    g.visible = true;
  }
  makeAnnex() {
    const g = this.groups.office;
    this.zoneData.office.bounds = 50;
    // Walkable private office earned at Partner level.
    box(g, 34, -0.06, 0, 12, 0.12, 14, '#a59073');
    for (const [x, z, w, d] of [
      [28, 0, 0.15, 14],
      [40, 0, 0.15, 14],
      [34, -7, 12, 0.15],
      [30.625, 7, 5.25, 0.15],
      [37.375, 7, 5.25, 0.15],
    ])
      this.solid('office', g, x, 1.75, z, w, 3.5, d, '#dce0d3');
    for (const z of [-3, 2]) {
      box(g, 39.9, 1.85, z, 0.05, 2.3, 3.7, material('#97b7c4', 0.15, 0.4));
      box(g, 39.85, 1.85, z, 0.07, 2.3, 0.06, '#e1e5d8');
    }
    desk(g, 34, -3, { width: 3.6, dual: true });
    this.obstacle('office', 34, -3, 3.6, 1.12, 0.6, 1.2);
    chair(g, 34, -1.8, Math.PI, '#76523e');
    label(g, 'BBE Handelsberatung', 34, 2.25, -6.89, 8, 1.3, {
      sub: 'PARTNER OFFICE · DEINE PERSPEKTIVE ZÄHLT',
    });
    plant(g, 29.5, -5, 1.7);
    plant(g, 38.5, 5, 1.8);
    box(g, 29.5, 0.46, 2, 1, 0.6, 3.2, '#426963');
    box(g, 29, 0.9, 2, 0.15, 0.6, 3.2, '#426963');
    box(g, 32, 0.4, 2, 1.8, 0.1, 1.2, '#b7986b');
    this.interact('office', 'suite-pc', 'Partner-Computer benutzen', 34, -1.65, {
      kind: 'computer',
    });
    this.interact('office', 'suite-back', 'Zurück ins BBE-Büro', 34, 5.5, { kind: 'office-back' });
    this.solid('office', g, 34, 3.11, 7, 1.5, 0.78, 0.15, '#dce0d3');
    const suiteDoor = portal(this, 'office', 'suite-back', 34, 6.94, {
      width: 1.4,
      title: 'BBE · BÜRO',
    });
    suiteDoor.root.userData.dynamic = false;
    suiteDoor.mesh.userData.dynamic = true;
    for (const x of [-0.685, 0.685])
      box(suiteDoor.root, x, 1.325, -0.067, 0.085, 2.65, 0.03, '#465e61');
    box(suiteDoor.root, 0, 2.62, -0.067, 1.4, 0.04, 0.03, '#465e61');
    box(g, 34, -0.035, 7.6, 1.5, 0.07, 1.3, '#a0aaa3');
    box(g, 34, 1.55, 8.2, 1.5, 3.1, 0.1, '#cbd5cc');
    for (const x of [33.25, 34.75]) box(g, x, 1.55, 7.6, 0.08, 3.1, 1.2, '#d6ddd4');
    // Actual bathroom room with sinks, mirrors and individual cubicles.
    const bathroomTile = canvasTexture(256, 256, (c) => {
      c.fillStyle = '#bac9c3';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#94aaa3';
      c.lineWidth = 2;
      for (let k = 0; k <= 256; k += 128) {
        c.beginPath();
        c.moveTo(k, 0);
        c.lineTo(k, 256);
        c.moveTo(0, k);
        c.lineTo(256, k);
        c.stroke();
      }
    });
    bathroomTile.wrapS = bathroomTile.wrapT = THREE.RepeatWrapping;
    bathroomTile.repeat.set(5, 4);
    const tileBump = bathroomTile.clone();
    tileBump.colorSpace = THREE.NoColorSpace;
    box(
      g,
      34,
      -0.05,
      24,
      10,
      0.1,
      8,
      new THREE.MeshStandardMaterial({
        map: bathroomTile,
        bumpMap: tileBump,
        bumpScale: 0.008,
        roughness: 0.55,
      }),
    );
    for (const [x, z, w, d] of [
      [29, 24, 0.15, 8],
      [39, 24, 0.15, 8],
      [34, 20, 10, 0.15],
      [31.175, 28, 4.35, 0.15],
      [36.825, 28, 4.35, 0.15],
    ])
      this.solid('office', g, x, 1.6, z, w, 3.2, d, '#dce6dd');
    this.solid('office', g, 34, 2.94, 28, 1.3, 0.52, 0.15, '#dce6dd');
    portal(this, 'office', 'wc-back', 34, 27.94, { title: 'BBE · BÜRO' });
    for (const x of [30.5, 33, 35.5]) {
      const door = portal(this, 'office', 'cubicle-' + x, x, 23, {
        width: 1.75,
        height: 2.4,
        title: 'FREI',
        cubicle: true,
      });
      door.openAngle = -1.35;
      this.interact('office', 'cubicle-door-' + x, 'Kabinentür öffnen / schließen', x, 23.85, {
        kind: 'room-door',
        data: 'cubicle-' + x,
        radius: 0.95,
      });
      box(g, x, 1.7, 20.15, 2.2, 2.8, 0.06, '#b6ccc5');
      cylinder(g, x, 0.43, 21.4, 0.3, 0.6, '#eaece0', 0.38);
      // Open porcelain rim instead of a solid lid that concealed the water.
      const seat = new THREE.Mesh(
        new THREE.TorusGeometry(0.325, 0.065, 10, 32),
        material('#f3f2e6', 0.24),
      );
      seat.rotation.x = -Math.PI / 2;
      seat.scale.y = 1.16;
      seat.position.set(x, 0.74, 21.4);
      seat.castShadow = true;
      seat.receiveShadow = true;
      g.add(seat);
      const bowl = cylinder(g, x, 0.64, 21.4, 0.29, 0.08, '#72969e');
      bowl.castShadow = false;
      box(g, x, 0.9, 20.65, 0.63, 0.72, 0.32, '#e6e9df');
      this.solid('office', g, x + 1.05, 1.3, 21.5, 0.06, 2.6, 3, '#a3bdb3');
    }
    box(g, 37.8, 0.88, 25.5, 0.8, 0.14, 2.7, '#dbe4d9');
    for (const z of [24.7, 26.1]) {
      sphere(g, 37.65, 0.9, z, 0.28, 0.1, 0.4, '#f1f0e7');
      cylinder(g, 37.94, 1.08, z, 0.025, 0.32, '#b1c7c2');
      box(g, 38.86, 1.78, z, 0.03, 1.35, 1.1, material('#b4ced2', 0.04, 0.85));
    }
    label(g, 'BITTE HÄNDE WASCHEN', 37, 2.45, 27.86, 3.8, 0.6, {
      rotation: Math.PI,
      bg: '#dce6dd',
      fg: '#366269',
    });
    this.interact('office', 'wc-back', 'Zurück ins BBE-Büro', 34, 26.7, { kind: 'office-back' });
    // A laptop, real whiteboard, pinned notes and a small presentation trolley.
    box(g, -2, 0.84, -2.8, 0.62, 0.035, 0.4, '#748786');
    const laptop = box(g, -2, 1.06, -3, 0.62, 0.43, 0.026, '#324d57');
    laptop.rotation.x = -0.1;
    label(g, 'BBE Research', -2, 1.06, -2.978, 0.55, 0.36, { sub: 'INSIGHTS 2026' });
    box(g, 11.5, 1.8, 3.86, 2.2, 1.3, 0.035, '#e6e9dd');
    label(g, 'RETAIL STRATEGY', 11.5, 1.86, 3.82, 2, 0.95, {
      rotation: Math.PI,
      bg: '#eef0e5',
      fg: '#31616b',
      sub: '1. VERSTEHEN   2. VERDICHTEN   3. ENTSCHEIDEN',
    });
    buildOfficeDetail(this, { material });
  }
  batchScenes() {
    this.crowdBatches = [];
    for (const [name, root] of Object.entries(this.groups)) {
      root.updateMatrixWorld(true);
      const groups = new Map();
      root.traverse((o) => {
        if (
          !o.isMesh ||
          o.isInstancedMesh ||
          Array.isArray(o.material) ||
          Object.keys(o.geometry.morphAttributes).length
        )
          return;
        let p = o,
          skip = false;
        while (p && p !== root) {
          if (p.userData.dynamic || p.userData.rig) {
            skip = true;
            break;
          }
          p = p.parent;
        }
        if (skip || !o.visible) return;
        // Spatial batches remain cullable; a distant facade cannot drag an entire city into a pass.
        const cell =
          name === 'city'
            ? '|' +
              Math.floor(o.matrixWorld.elements[12] / 48) +
              ':' +
              Math.floor(o.matrixWorld.elements[14] / 48)
            : '';
        if (o.material.transparent && o.material.opacity < 0.8) o.castShadow = false;
        o.updateMatrix();
        o.matrixAutoUpdate = false;
        const attributes = Object.entries(o.geometry.attributes)
          .map(([k, v]) => k + v.itemSize)
          .sort()
          .join();
        const key = attributes + '|' + o.material.uuid + '|' + o.castShadow + cell;
        const list = groups.get(key) || [];
        list.push(o);
        groups.set(key, list);
      });
      for (const list of groups.values()) {
        if (list.length < 3) continue;
        const first = list[0],
          batch = new THREE.Mesh(mergeStaticGeometry(list), first.material);
        batch.name = 'Static material cell';
        batch.castShadow = list.some((o) => o.castShadow);
        batch.receiveShadow = true;
        list.forEach((o, i) => {
          o.visible = false;
          o.matrixWorldAutoUpdate = false;
        });
        batch.matrixAutoUpdate = false;
        root.add(batch);
      }
      // Share draw calls across the articulated crowd while preserving all bone motion.
      const crowdGroups = new Map();
      for (const actor of this.zoneData[name].npcs) {
        actor.mesh.traverse((o) => {
          if (!o.isMesh) return;
          const key = o.geometry.uuid + '|' + o.material.uuid;
          const list = crowdGroups.get(key) || [];
          list.push({ source: o, actor: actor.mesh });
          crowdGroups.set(key, list);
        });
      }
      for (const list of crowdGroups.values()) {
        const first = list[0].source,
          batch = new THREE.InstancedMesh(first.geometry, first.material, list.length);
        batch.castShadow = true;
        batch.receiveShadow = true;
        batch.frustumCulled = false;
        for (const item of list) item.source.visible = false;
        root.add(batch);
        this.crowdBatches.push({ zone: name, batch, list });
      }
    }
  }
  inRenderRange(object, radius = 2.5) {
    if (!object.visible) return false;
    if (this.zone !== 'city' || !this.visibilityFrustum) return true;
    const p = object.position,
      distance = p.distanceToSquared(this.player.position);
    if (distance < 40 * 40) return true; // Preserve nearby offscreen shadow casters and reflections.
    this.visibilitySphere.center.copy(p);
    this.visibilitySphere.center.y += radius * 0.5;
    this.visibilitySphere.radius = radius;
    return this.visibilityFrustum.intersectsSphere(this.visibilitySphere);
  }
  updateCrowd() {
    for (const actor of this.zoneData[this.zone].npcs) {
      actor.mesh.userData.renderVisible = !actor.storyAway && this.inRenderRange(actor.mesh);
      if (actor.mesh.userData.renderVisible) actor.mesh.updateWorldMatrix(true, true);
    }
    for (const item of this.crowdBatches) {
      if (item.zone !== this.zone) continue;
      let count = 0;
      for (const o of item.list)
        if (o.actor.userData.renderVisible) item.batch.setMatrixAt(count++, o.source.matrixWorld);
      item.batch.count = count;
      item.batch.visible = count > 0;
      item.batch.instanceMatrix.needsUpdate = true;
    }
  }
  makeRain() {
    const pos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      pos[i * 3] = rnd(-45, 45);
      pos[i * 3 + 1] = rnd(0, 22);
      pos[i * 3 + 2] = rnd(-45, 45);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: '#c9e3ed', size: 0.055, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(this.rain);
    this.rain.visible = false;
  }
  enter(zone, restaurantId = null) {
    this.zone = zone;
    Object.entries(this.groups).forEach(([name, g]) => (g.visible = name === zone));
    this.pose = 'walk';
    this.keys.clear();
    if (zone === 'office') {
      this.teleport(-8, 2.6);
      this.yaw = 0.48;
      this.distance = 4.2;
      this.pitch = 0.3;
    } else if (zone === 'city') {
      if (restaurantId) {
        const r = RESTAURANTS.find((a) => a.id === restaurantId);
        this.teleport(r.x + (r.x < 0 ? 2.6 : -2.6), r.z);
        this.yaw = r.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        this.teleport(CITY_LAYOUT.hq.x, CITY_LAYOUT.hq.z);
        this.yaw = 0;
      }
      this.distance = 5.8;
      this.pitch = 0.24;
    } else {
      this.currentRestaurant = RESTAURANTS.find((a) => a.id === restaurantId) || RESTAURANTS[0];
      this.restaurantWall.material = material(this.currentRestaurant.color);
      this.restaurantSign.material.map.dispose();
      const temp = new THREE.Group();
      const sign = label(temp, this.currentRestaurant.name, 0, 0, 0, 8, 1, {
        bg: this.currentRestaurant.color,
        sub: this.currentRestaurant.kind.toUpperCase(),
      });
      this.restaurantSign.material.map = sign.material.map;
      this.restaurantSign.material.needsUpdate = true;
      this.teleport(0, 6.9);
      this.yaw = 0;
      this.distance = 3.6;
      this.pitch = 0.24;
    }
    this.target.set(this.player.position.x, 1.2, this.player.position.z);
    this.camera.position.set(
      this.player.position.x + Math.sin(this.yaw) * this.distance,
      3.1,
      this.player.position.z + Math.cos(this.yaw) * this.distance,
    );
    this.nearest = null;
    this.updateBottles();
  }
  teleport(x, z, y = 0) {
    this.nearest = null;
    const b = this.zoneData[this.zone].body;
    b.position.set(x, y + 0.34, z);
    b.aabbNeedsUpdate = true;
    b.wakeUp();
    this.zoneData[this.zone].physics.broadphase.dirty = true;
    b.velocity.setZero();
    b.angularVelocity.setZero();
    this.player.position.set(x, y, z);
    this.player.rotation.y = Math.PI;
  }
  updateBottles() {
    this.bottles?.forEach((b) => (b.mesh.visible = !this.sim.s.picked.includes(b.id)));
  }
  bindInput() {
    const canLook = () =>
      this.mouseControls ? this.mouseControls.canLook() : this.started && !this.blocked;
    let drag = null;
    const stopDrag = (event = null) => {
      if (event && (!drag || event.pointerId !== drag.id)) return;
      drag = null;
      this.dragging = false;
    };
    const look = (dx, dy) => {
      if (!canLook() || !Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
      this.yaw -= dx * 0.004;
      this.pitch = clamp(this.pitch + dy * 0.003, -0.08, 0.8);
      this.cameraLookUntil = this.time + 2;
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (
        !canLook() ||
        (e.button !== 0 && e.button !== 2) ||
        document.pointerLockElement === this.canvas
      )
        return;
      // A menu/lock release can clear the public flag before this pointer ends.
      if (!this.dragging) drag = null;
      if (drag) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.dragging = true;
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      window.addEventListener(event, stopDrag);
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) stopDrag();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      stopDrag();
    });
    // Pointer lock reports relative mouse deltas. Touch/pen/drag instead use
    // client coordinates: their movementX/Y may stay zero in mobile browsers.
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) look(e.movementX, e.movementY);
    });
    window.addEventListener('pointermove', (e) => {
      if (
        document.pointerLockElement === this.canvas ||
        !this.dragging ||
        !drag ||
        e.pointerId !== drag.id
      )
        return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      look(dx, dy);
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!canLook()) return;
        this.distance = clamp(
          this.distance + e.deltaY * 0.003,
          2,
          this.gameplay?.vehicle?.type === 'helicopter' ? 26 : 10,
        );
        e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
          'Space',
          'KeyC',
        ].includes(e.code)
      ) {
        if (!this.blocked) {
          this.keys.add(e.code);
          e.preventDefault();
        }
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer?.setSize(innerWidth, innerHeight);
    const ratio = Math.min(devicePixelRatio, 1.25);
    this.ssao?.setSize(Math.ceil(innerWidth * ratio * 0.65), Math.ceil(innerHeight * ratio * 0.65));
  }
  setQuality(low) {
    this.lowQuality = low;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.6));
    this.renderer.shadowMap.enabled = true;
    const resolution = low ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== resolution) {
      this.sun.shadow.mapSize.set(resolution, resolution);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }
  update(dt, blocked = false) {
    this.time += dt;
    this.blocked = blocked;
    const zone = this.zoneData[this.zone],
      b = zone.body;
    const movement = this.gameplay?.immersion?.motion.updateControlled(dt, blocked) || false;
    const driving = movement || this.gameplay?.updateVehicle(dt, blocked) || false;
    let vx = 0,
      vz = 0;
    if (!driving && this.started && !blocked && this.pose !== 'eat') {
      const forward =
          (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
          (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0),
        side =
          (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
          (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      const length = Math.hypot(forward, side) || 1;
      this.sprinting =
        (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && this.sim.s.energy > 10;
      const speed = (this.sprinting ? 5.4 : 3.0) * (this.sim.s.energy < 15 ? 0.7 : 1);
      vx = ((-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) / length) * speed;
      vz = ((-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) / length) * speed;
      if (forward || side) this.pose = 'walk';
    }
    if (!driving) {
      b.velocity.x = vx;
      b.velocity.z = vz;
      zone.physics.step(1 / 60, Math.min(dt, 0.05), 3);
    }
    if (driving && dt > 0) {
      const held = b.position.clone();
      zone.physics.step(1 / 60, Math.min(dt, 0.05), 3);
      b.position.copy(held);
      b.velocity.setZero();
    }
    const limit = zone.bounds;
    b.position.x = clamp(b.position.x, -limit, limit);
    b.position.z = clamp(b.position.z, -limit, limit);
    this.player.position.x = b.position.x;
    this.player.position.z = b.position.z;
    this.moveSpeed = movement ? this.gameplay.immersion.motion.speed || 0 : Math.hypot(vx, vz);
    if (this.moveSpeed > 0.1 && !movement) {
      const angle = Math.atan2(vx, vz);
      this.player.rotation.y +=
        Math.atan2(
          Math.sin(angle - this.player.rotation.y),
          Math.cos(angle - this.player.rotation.y),
        ) * Math.min(dt * 12, 1);
    }
    animateHuman(this.player, this.time, this.moveSpeed * 0.35, this.pose);
    this.gameplay?.animatePlayer(dt);
    this.heldFork.visible = this.pose === 'eat';
    this.heldCup.visible = this.pose === 'drink';
    if (this.returnTime > 0) {
      this.returnTime -= dt;
      this.returnProp.visible = true;
      this.returnProp.position.x = 14.4 + (1 - this.returnTime / 0.55) * 0.65;
      this.returnProp.scale.setScalar(Math.max(0.05, this.returnTime / 0.55));
    } else this.returnProp.visible = false;
    this.playerShadow.position.set(b.position.x, 0.022, b.position.z);
    this.nearest = null;
    let best = Infinity;
    for (const i of zone.interactions) {
      if (i.storyAway) continue;
      if (i.kind === 'bottle' && this.sim.s.picked.includes(i.data.id)) continue;
      const d = Math.hypot(b.position.x - i.x, b.position.z - i.z);
      if (d < i.radius && d < best && Math.abs((i.y || 1.6) - (b.position.y - 0.34 + 1.6)) < 2.2) {
        this.nearest = i;
        best = d;
      }
    }
    for (const n of zone.npcs) {
      if (n.storyAway) {
        n.mesh.visible = false;
        continue;
      }
      if (this.gameplay?.updateNPC(n, dt)) continue;
      if (this.zone === 'city') {
        if (n.route) {
          const target = n.route[n.routeIndex],
            p = n.mesh.position,
            dx = target.x - p.x,
            dz = target.z - p.z,
            d = Math.hypot(dx, dz),
            step = Math.min(d, dt * n.speed);
          if (d < 0.12) n.routeIndex = (n.routeIndex + 1) % n.route.length;
          else {
            p.x += (dx / d) * step;
            p.z += (dz / d) * step;
            n.mesh.rotation.y = Math.atan2(dx, dz);
          }
          n.x = p.x;
          n.z = p.z;
          n.mesh.visible = true;
          animateHuman(n.mesh, this.time, n.speed, 'walk');
          continue;
        }
        const isCrossing = [40, -43].find((z) => Math.abs(n.z - z) < 11);
        const stop =
          isCrossing !== undefined &&
          (n.cycle ? this.trafficPhase >= 7 : this.trafficPhase < 7) &&
          ((n.dir > 0 && n.z < isCrossing - 7) || (n.dir < 0 && n.z > isCrossing + 7));
        if (n.pose !== 'phone' && !stop) {
          n.z += dt * n.speed * n.dir;
          if (n.z > 119) n.z = -154;
          if (n.z < -154) n.z = 119;
        }
        n.mesh.visible = true;
        n.mesh.position.x = n.x;
        n.mesh.position.z = n.z;
        n.mesh.rotation.y = n.dir > 0 ? 0 : Math.PI;
        animateHuman(n.mesh, this.time, stop ? 0 : n.speed, n.pose);
        if (n.bike) {
          n.bike.visible = n.mesh.visible;
          n.bike.position.set(n.x, 0, n.z);
          n.bike.rotation.y = n.dir > 0 ? 0 : Math.PI;
        }
      } else {
        if (n.path) {
          n.wait = Math.max(0, (n.wait || 0) - dt);
          const target = n.path[n.pathIndex || 0],
            dx = target[0] - n.mesh.position.x,
            dz = target[1] - n.mesh.position.z,
            dist = Math.hypot(dx, dz);
          if (n.wait > 0) {
            n.pose = 'phone';
          } else if (dist < 0.12) {
            n.pathIndex = ((n.pathIndex || 0) + 1) % n.path.length;
            n.wait = 4;
            n.pose = 'phone';
          } else {
            n.pose = 'walk';
            n.mesh.position.x += (dx / dist) * dt * 0.85;
            n.mesh.position.z += (dz / dist) * dt * 0.85;
            n.mesh.rotation.y = Math.atan2(dx, dz);
          }
          const it = zone.interactions.find((i) => i.data === n.name);
          if (it) {
            it.x = n.mesh.position.x;
            it.z = n.mesh.position.z;
          }
        } else if (n.pose === 'walk') {
          const x = n.origin.x + Math.sin(this.time * 0.17) * 1.4;
          n.mesh.position.x = x;
          n.mesh.rotation.y = Math.cos(this.time * 0.17) > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        animateHuman(n.mesh, this.time, n.pose === 'walk' ? 0.5 : 0, n.pose);
        if (n.attackUntil > this.gameplay?.time) {
          const strike = Math.sin((1 - (n.attackUntil - this.gameplay.time) / 0.36) * Math.PI);
          n.mesh.userData.rig.rightArm.rotation.x = -1.8 * strike;
          n.mesh.userData.rig.rightFore.rotation.x = -0.15;
        }
      }
    }
    this.trafficPhase = this.time % 16;
    updateStreetSignals(this, this.trafficPhase);
    if (this.zone === 'city') {
      updateCityTraffic(this, dt, this.trafficPhase);
      this.sun.position.set(b.position.x - 35, 55, b.position.z + 22);
      this.sun.target.position.set(b.position.x, 0, b.position.z);
    } else {
      this.sun.position.set(-16, 25, -9);
      this.sun.target.position.set(0, 0, 0);
    }
    const minutes = this.sim.s.minutes,
      daylight = clamp(Math.sin(((minutes - 360) / 1440) * Math.PI * 2) * 1.4, 0.08, 1);
    const rainy = this.sim.s.weather === 'Regen';
    this.sun.intensity = (this.zone === 'city' ? 3.2 * daylight : 2.8) * (rainy ? 0.48 : 1);
    this.ambient.intensity = this.zone === 'city' ? 0.6 + daylight * 1.3 : 1.9;
    this.scene.background.set(
      this.zone === 'city'
        ? daylight < 0.3
          ? '#243b54'
          : rainy
            ? '#879eaa'
            : '#a7c5d4'
        : '#aec6ce',
    );
    this.scene.fog.color.copy(this.scene.background);
    this.rain.visible = rainy && this.zone === 'city';
    if (this.rain.visible) {
      this.rain.position.set(b.position.x, 0, b.position.z);
      const a = this.rain.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        a.array[i * 3 + 1] -= dt * 15;
        if (a.array[i * 3 + 1] < 0) a.array[i * 3 + 1] = 22;
      }
      a.needsUpdate = true;
    }
    const flightHeight =
      this.gameplay?.vehicle?.type === 'helicopter' ? this.gameplay.vehicle.mesh.position.y + 2 : 0;
    const bathroom =
      this.zone === 'office' && b.position.x > 28 && b.position.x < 40 && b.position.z > 19;
    const wantedFov = bathroom ? 66 : 53;
    if (Math.abs(this.camera.fov - wantedFov) > 0.03) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, wantedFov, 9, dt || 0.016);
      this.camera.updateProjectionMatrix();
      if (this.ssao) {
        this.ssao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(
          this.camera.projectionMatrix,
        );
        this.ssao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(
          this.camera.projectionMatrixInverse,
        );
      }
    }
    const desiredTarget = new THREE.Vector3(
      b.position.x,
      flightHeight || b.position.y - 0.34 + (this.pose === 'eat' ? 1.0 : 1.25),
      b.position.z,
    );
    this.target.lerp(desiredTarget, 1 - Math.exp(-dt * 10));
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      1 + Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    );
    const desired = this.target.clone().add(offset);
    this.ray.set(this.target, offset.clone().normalize());
    this.ray.far = offset.length();
    const hits = this.ray.intersectObjects(zone.obstacles, false);
    if (hits.length && hits[0].distance > 0.1)
      desired
        .copy(this.target)
        .addScaledVector(offset.normalize(), Math.max(0.45, hits[0].distance - 0.2));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.visibilityFrustum ||= new THREE.Frustum();
    this.visibilityProjection ||= new THREE.Matrix4();
    this.visibilitySphere ||= new THREE.Sphere();
    this.visibilityFrustum.setFromProjectionMatrix(
      this.visibilityProjection.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      ),
    );
    this.gameplay?.update(dt, blocked);
    this.workshop?.updateWorld(dt, blocked);
    this.fireStory?.updateWorld(dt, blocked);
    this.updateCrowd();
    // The SSAO normal pass reuses the shadow map from the first colour pass.
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowFrame = (this.shadowFrame || 0) + 1;
    this.lastShadowPosition ||= new THREE.Vector3(Infinity, 0, 0);
    const refreshShadow =
      !this.lowQuality ||
      this.shadowFrame % 2 === 0 ||
      !this.sun.shadow.map ||
      this.shadowZone !== this.zone ||
      this.lastShadowPosition.distanceToSquared(this.player.position) > 1;
    this.renderer.shadowMap.needsUpdate = refreshShadow;
    if (refreshShadow) {
      this.shadowZone = this.zone;
      this.lastShadowPosition.copy(this.player.position);
    }
    if (this.composer && !this.lowQuality) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.renderer.dispose();
  }
}
