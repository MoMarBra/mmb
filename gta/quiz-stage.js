import * as THREE from 'three';
import { human, animateHuman, label } from './world.js';

const TAU = Math.PI * 2;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const ease = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
// Camera names carry no guessed music timings: the controller follows the supplied audio markers.
export const QUIZ_INTRO_SHOTS = Object.freeze([
  'portal',
  'reveal',
  'establish',
  'audience',
  'host',
  'candidate',
  'duo',
  'question-ready',
]);
export const QUIZ_INTRO_DURATION = 12; // Legacy fallback until a controller supplies shot/progress.
export const QUIZSSOIR_ANCHOR = Object.freeze({ x: 37.65, z: 22.15, y: 0, yaw: Math.PI / 2 });

// Every resource created here is owned locally. The classic human rig uses shared
// game geometry/materials, which are deliberately never disposed by this set.
class SetBuilder {
  constructor(root) {
    this.root = root;
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.cache = new Map();
  }
  material(color, roughness = 0.5, metalness = 0) {
    const key = `${color}|${roughness}|${metalness}`;
    if (!this.cache.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.cache.set(key, m);
      this.materials.add(m);
    }
    return this.cache.get(key);
  }
  glow(color, intensity = 1.6) {
    const key = `glow:${color}:${intensity}`;
    if (!this.cache.has(key)) {
      const m = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.26,
        metalness: 0.1,
      });
      this.cache.set(key, m);
      this.materials.add(m);
    }
    return this.cache.get(key);
  }
  mesh(geometry, material, position = [0, 0, 0], parent = this.root) {
    this.geometries.add(geometry);
    this.materials.add(material);
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(position, size, material, parent = this.root) {
    return this.mesh(new THREE.BoxGeometry(...size), material, position, parent);
  }
  cylinder(position, radius, height, material, parent = this.root, segments = 48) {
    return this.mesh(
      new THREE.CylinderGeometry(radius, radius, height, segments),
      material,
      position,
      parent,
    );
  }
  ring(position, radius, tube, material, parent = this.root, horizontal = true) {
    const m = this.mesh(new THREE.TorusGeometry(radius, tube, 8, 96), material, position, parent);
    if (horizontal) m.rotation.x = Math.PI / 2;
    return m;
  }
  text(text, position, width, height, options = {}, parent = this.root) {
    const m = label(parent, text, ...position, width, height, options);
    this.geometries.add(m.geometry);
    this.materials.add(m.material);
    this.textures.add(m.material.map);
    // Lettering is a lit display, so its dark artwork must not turn grey under the studio key.
    m.material = new THREE.MeshBasicMaterial({
      map: m.material.map,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.materials.add(m.material);
    return m;
  }
  instances(geometry, material, transforms, name) {
    this.geometries.add(geometry);
    this.materials.add(material);
    const m = new THREE.InstancedMesh(geometry, material, transforms.length);
    const o = new THREE.Object3D();
    transforms.forEach(({ position, scale = [1, 1, 1], yaw = 0 }, i) => {
      o.position.set(...position);
      o.scale.set(...scale);
      o.rotation.set(0, yaw, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.name = name;
    m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    m.computeBoundingSphere();
    this.root.add(m);
    return m;
  }
  dispose() {
    for (const t of this.textures) t?.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}

/** An additional fixture in the existing WC; no cubicle, sink or door is moved. */
export function installQuizssoir(world) {
  if (world.quizssoirFixture) return world.quizssoirFixture;
  const root = new THREE.Group();
  root.name = 'Quizssoir · Keramik-Pissoir';
  root.position.set(38.78, 0, 22.15);
  root.rotation.y = -Math.PI / 2;
  // Prevent a subsequently requested world rebatch from eating the animated ring.
  root.userData.dynamic = true;
  root.userData.quizssoir = true;
  world.groups.office.add(root);
  const b = new SetBuilder(root);
  const porcelain = b.material('#f5f1e9', 0.18, 0.02);
  const inside = b.material('#dce2df', 0.23, 0.02);
  const chrome = b.material('#bdcbd1', 0.13, 0.88);
  const charcoal = b.material('#081823', 0.32, 0.3);
  const blue = b.glow('#5fceff', 1.05);
  const gold = b.glow('#dfb872', 0.32);
  const outline = new THREE.Shape();
  outline.moveTo(-0.31, -0.42);
  outline.quadraticCurveTo(-0.4, 0.22, -0.23, 0.49);
  outline.quadraticCurveTo(0, 0.64, 0.23, 0.49);
  outline.quadraticCurveTo(0.4, 0.22, 0.31, -0.42);
  outline.quadraticCurveTo(0, -0.65, -0.31, -0.42);
  const back = new THREE.ExtrudeGeometry(outline, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.032,
    bevelThickness: 0.035,
    curveSegments: 18,
  });
  b.mesh(back, porcelain, [0, 1.08, 0.05]);
  const bowlGeo = new THREE.SphereGeometry(0.325, 32, 18, 0, TAU, Math.PI / 2, Math.PI / 2);
  const bowl = b.mesh(bowlGeo, porcelain, [0, 0.84, 0.25]);
  bowl.scale.set(1, 0.8, 1.16);
  const innerMat = inside.clone();
  innerMat.side = THREE.BackSide;
  const innerBowl = b.mesh(
    new THREE.SphereGeometry(0.291, 32, 18, 0, TAU, Math.PI / 2, Math.PI / 2),
    innerMat,
    [0, 0.846, 0.25],
  );
  innerBowl.scale.set(1, 0.77, 1.16);
  const rim = b.ring([0, 0.85, 0.25], 0.312, 0.026, porcelain);
  rim.scale.y = 1.16;
  const drain = b.cylinder([0, 0.628, 0.25], 0.045, 0.01, chrome, root, 24);
  drain.name = 'Quizssoir · Ablauf';
  b.cylinder([0, 1.78, 0.12], 0.024, 0.2, chrome, root, 16);
  b.box([0, 1.89, 0.12], [0.15, 0.085, 0.1], chrome);
  b.box([0, 1.915, 0.176], [0.052, 0.025, 0.026], charcoal);
  const pulseRing = b.ring([0, 1.41, 0.189], 0.155, 0.008, blue, root, false);
  const sensor = b.mesh(new THREE.CircleGeometry(0.13, 32), charcoal, [0, 1.41, 0.181]);
  sensor.name = 'Quizssoir · Sensor';
  const glyph = document.createElement('canvas');
  glyph.width = glyph.height = 128;
  const ctx = glyph.getContext('2d');
  ctx.fillStyle = '#cff3ff';
  ctx.font = '700 100px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 68);
  const glyphTexture = new THREE.CanvasTexture(glyph);
  glyphTexture.colorSpace = THREE.SRGBColorSpace;
  b.textures.add(glyphTexture);
  b.mesh(
    new THREE.PlaneGeometry(0.135, 0.135),
    new THREE.MeshBasicMaterial({ map: glyphTexture, transparent: true, toneMapped: false }),
    [0, 1.409, 0.188],
  );
  b.box([0, 2.27, 0.02], [1.04, 0.4, 0.07], charcoal);
  b.text('QUIZSSOIR', [0, 2.3, 0.061], 0.95, 0.18, { bg: '#081823', fg: '#f2d69a' });
  b.text('15 FRAGEN. EINE MILLION.', [0, 2.15, 0.061], 0.92, 0.09, {
    bg: '#081823',
    fg: '#a6c9df',
  });
  for (const x of [-0.52, 0.52]) b.box([x, 2.27, 0.048], [0.014, 0.36, 0.012], gold);
  // Slim privacy wings stay inside the previously unused right-wall strip.
  for (const x of [-0.57, 0.57]) {
    b.box([x, 1.12, 0.23], [0.034, 1.04, 0.56], b.material('#b6c8c4', 0.42, 0.12));
    b.box([x, 1.64, 0.23], [0.038, 0.016, 0.56], chrome);
  }
  const anchor = { ...QUIZSSOIR_ANCHOR };
  world.interact('office', 'quizssoir', 'Quizssoir · Quizshow starten', anchor.x, anchor.z, {
    kind: 'quizssoir',
    radius: 1.3,
    y: 1.4,
  });
  const interaction = world.zoneData.office.interactions.find((item) => item.id === 'quizssoir');
  // Keep collision clear of the cubicle door swing and of the sink approach.
  const body = world.obstacle?.('office', 38.53, 22.15, 0.55, 1.17, 1.05, 1.3);
  root.updateWorldMatrix(true, true);
  const fixture = {
    root,
    anchor,
    interaction,
    body,
    focus: new THREE.Vector3(38.55, 1.4, 22.15),
    update(time) {
      blue.emissiveIntensity = 0.9 + 0.18 * Math.sin(time * 1.8);
      pulseRing.scale.setScalar(1 + 0.018 * Math.sin(time * 1.8));
    },
    dispose() {
      root.removeFromParent();
      body?.world?.removeBody(body);
      const interactions = world.zoneData.office.interactions;
      const index = interactions.indexOf(interaction);
      if (index >= 0) interactions.splice(index, 1);
      if (world.quizssoirFixture === fixture) delete world.quizssoirFixture;
      b.dispose();
    },
  };
  world.quizssoirFixture = fixture;
  return fixture;
}

/** A small isolated set, drawn with the existing renderer; no second WebGL context. */
export class QuizStage {
  constructor(world, { fixture = world.quizssoirFixture } = {}) {
    this.world = world;
    this.fixture = fixture;
    this.scene = new THREE.Scene();
    this.scene.name = 'Quizssoir · Prime-time-Studio';
    this.scene.background = new THREE.Color('#02050e');
    this.scene.fog = new THREE.FogExp2('#020714', 0.024);
    this.scene.environment = world.scene?.environment || null;
    this.scene.environmentIntensity = 0.3;
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.08, 65);
    this.builder = new SetBuilder(this.scene);
    this.size = new THREE.Vector2();
    this.look = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.beams = [];
    this.audienceActors = [];
    this.audienceHands = [];
    this.audienceArms = [];
    this.audienceTransform = new THREE.Object3D();
    this.audienceStart = new THREE.Vector3();
    this.audienceEnd = new THREE.Vector3();
    this.audienceDirection = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.previousPhase = null;
    this.phaseTime = 0;
    this.disposed = false;
    this.build();
    this.resize();
  }
  build() {
    const b = this.builder;
    const navy = b.material('#061327', 0.29, 0.48);
    const black = b.material('#020710', 0.22, 0.62);
    const steel = b.material('#738899', 0.22, 0.83);
    const blue = (this.blue = b.glow('#3b9dec', 1.3));
    const pale = b.glow('#afdef7', 1.8);
    const gold = (this.gold = b.glow('#efb867', 1.1));
    const chairMat = b.material('#112036', 0.69, 0.03);
    b.cylinder([0, -0.08, 0], 13, 0.16, black, this.scene, 96);
    b.cylinder([0, 0.055, 0], 5.7, 0.11, navy, this.scene, 96);
    b.cylinder([0, 0.165, 0], 3.3, 0.11, black, this.scene, 96);
    for (const [radius, y] of [
      [3.25, 0.231],
      [3.58, 0.119],
      [5.55, 0.119],
      [6.08, 0.019],
      [9.98, 0.025],
    ]) {
      b.ring([0, y, 0], radius, 0.023, blue);
      b.ring([0, y - 0.004, 0], radius + 0.075, 0.008, steel);
    }
    b.ring([0, 0.235, 0], 2.68, 0.013, gold);
    // Radial floor fillets and light bars are instanced instead of 96 draw calls.
    const fillets = [],
      bars = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      fillets.push({
        position: [Math.sin(a) * 4.42, 0.116, Math.cos(a) * 4.42],
        scale: [0.012, 0.009, 1.45],
        yaw: a,
      });
      bars.push({
        position: [Math.sin(a) * 5.15, 0.123, Math.cos(a) * 5.15],
        scale: [0.045, 0.008, 0.44],
        yaw: a,
      });
    }
    b.instances(new THREE.BoxGeometry(1, 1, 1), steel, fillets, 'Quiz · 48 radiale Intarsien');
    b.instances(new THREE.BoxGeometry(1, 1, 1), blue, bars, 'Quiz · 48 Bühnen-LEDs');
    // Suspended concentric light rig creates an immediately readable studio silhouette.
    for (const r of [3.2, 4.5, 6]) {
      b.ring([0, 6.3, 0], r, 0.065, steel);
      b.ring([0, 6.19, 0], r, 0.024, pale);
    }
    const pylons = [],
      ledColumns = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 27) * Math.PI * 1.65 + Math.PI * 0.175;
      const x = Math.sin(a) * 11.6,
        z = Math.cos(a) * 11.6;
      pylons.push({ position: [x, 2.75, z], scale: [0.17, 5.5, 0.3], yaw: a });
      ledColumns.push({
        position: [x * 0.985, 2.75, z * 0.985],
        scale: [0.028, 4.9, 0.042],
        yaw: a,
      });
    }
    b.instances(new THREE.BoxGeometry(1, 1, 1), navy, pylons, 'Quiz · 28 Studiostelen');
    b.instances(
      new THREE.BoxGeometry(1, 1, 1),
      blue,
      ledColumns,
      'Quiz · 28 vertikale Lichtbänder',
    );
    // Own show branding; this is not a copy of a broadcaster's protected emblem.
    const back = new THREE.Group();
    back.position.set(0, 3.14, -9.7);
    this.scene.add(back);
    b.mesh(new THREE.CircleGeometry(2.12, 96), black, [0, 0, 0], back);
    b.ring([0, 0, 0.04], 1.92, 0.031, gold, back, false);
    b.ring([0, 0, 0.04], 1.7, 0.012, blue, back, false);
    b.text('QUIZSSOIR', [0, 0.12, 0.075], 3.07, 0.58, { bg: '#020710', fg: '#f5d298' }, back);
    b.text(
      'BBE · DIE MILLIONENFRAGE',
      [0, -0.43, 0.075],
      2.74,
      0.22,
      { bg: '#020710', fg: '#a5cce4' },
      back,
    );
    this.audience();
    this.host = human({ jacket: '#24354b', pants: '#111927', hair: '#403326', skin: '#d6ac8d' });
    this.candidate = human({ jacket: '#3f6374', pants: '#1b2735', hair: '#382d25' });
    this.hostMouth = b.box(
      [0, 1.565, 0.147],
      [0.045, 0.008, 0.009],
      b.material('#765249', 0.9),
      this.host,
    );
    for (const [actor, x, yaw, name] of [
      [this.host, -1.36, Math.PI / 2, 'Lukas Fleischmann'],
      [this.candidate, 1.36, -Math.PI / 2, 'Kandidat'],
    ]) {
      const stool = new THREE.Group();
      stool.position.set(x, 0.23, 0);
      this.scene.add(stool);
      b.cylinder([0, 0.038, 0], 0.32, 0.07, steel, stool, 32);
      b.cylinder([0, 0.52, 0], 0.04, 0.96, steel, stool, 16);
      b.ring([0, 0.701, 0], 0.38, 0.016, steel, stool);
      b.cylinder([0, 1.01, 0], 0.29, 0.11, chairMat, stool, 32);
      actor.position.set(x, 0.555, 0);
      actor.rotation.y = yaw;
      actor.name = `Quiz · ${name}`;
      actor.userData.dynamic = true;
      this.scene.add(actor);
      // A warm practical light at each monitor makes eye-lines legible.
      const screen = new THREE.Group();
      screen.position.set(x * 0.57, 1.64, -0.015);
      screen.rotation.y = yaw;
      this.scene.add(screen);
      b.cylinder([0, -0.68, -0.035], 0.025, 1.32, steel, screen, 12);
      const display = b.box([0, 0, 0], [0.45, 0.28, 0.042], black, screen);
      display.rotation.x = -0.16;
      const image = b.text(
        name === 'Kandidat' ? 'DEINE ANTWORT?' : 'LUKAS',
        [0, 0, 0.026],
        0.405,
        0.22,
        { bg: '#0c3154', fg: '#d4f2ff' },
        screen,
      );
      image.rotation.x = -0.16;
    }
    b.cylinder([0, 0.24, 0], 0.51, 0.025, navy);
    b.ring([0, 0.255, 0], 0.49, 0.013, gold);
    this.scene.add(new THREE.HemisphereLight('#abc9e8', '#111328', 1.6));
    const key = (this.keyLight = new THREE.DirectionalLight('#fff0d5', 2.7));
    key.position.set(3, 7, 6);
    this.scene.add(key);
    const fill = (this.fillLight = new THREE.DirectionalLight('#93bdff', 1.8));
    fill.position.set(-4, 4, -2);
    this.scene.add(fill);
    this.accent = new THREE.PointLight('#4799ff', 32, 12, 2);
    this.accent.position.set(0, 3.5, -4.5);
    this.scene.add(this.accent);
    for (let i = 0; i < 8; i++) this.beam(i, b, pale);
    this.buildConfetti();
  }
  audience() {
    const b = this.builder;
    const seats = [],
      skinGroups = [[], [], []],
      jackets = [[], [], [], []],
      hands = [[], [], []],
      arms = [[], [], [], []],
      hair = [[], [], []],
      eyes = [],
      legs = [],
      shoes = [],
      seatPads = [];
    const colors = ['#9b7763', '#c99b7b', '#e0b394'];
    for (let row = 0; row < 3; row++) {
      const radius = 7.45 + row * 1.12;
      b.ring([0, 0.08 + row * 0.3, 0], radius, 0.035, b.material('#14253a', 0.8));
      const terrace = b.mesh(
        new THREE.RingGeometry(radius - 0.57, radius + 0.57, 96),
        b.material('#0a1528', 0.66, 0.14),
        [0, 0.1 + row * 0.3, 0],
      );
      terrace.rotation.x = -Math.PI / 2;
      b.mesh(
        new THREE.CylinderGeometry(radius - 0.57, radius - 0.57, 0.12 + row * 0.3, 96, 1, true),
        b.material('#081020', 0.55),
        [0, 0.04 + row * 0.15, 0],
      );
      for (let i = 0; i < 35; i++) {
        const angle = 0.53 + (i / 34) * (TAU - 1.06);
        const x = Math.sin(angle) * radius,
          z = Math.cos(angle) * radius;
        const y = 0.19 + row * 0.3;
        const yaw = angle + Math.PI;
        seats.push({
          position: [x + Math.sin(angle) * 0.2, y + 0.49, z + Math.cos(angle) * 0.2],
          scale: [0.48, 0.59, 0.08],
          yaw,
        });
        skinGroups[(i + row) % 3].push({
          position: [x, y + 1.02, z],
          scale: [0.14, 0.18, 0.145],
        });
        jackets[(i * 3 + row) % 4].push({
          position: [x, y + 0.64, z],
          scale: [0.23, 0.33, 0.15],
          yaw,
        });
        const local = (lx, ly, lz) => [
          x + Math.cos(yaw) * lx + Math.sin(yaw) * lz,
          y + ly,
          z - Math.sin(yaw) * lx + Math.cos(yaw) * lz,
        ];
        const skin = (i + row) % 3,
          jacket = (i * 3 + row) % 4;
        const spectator = {
          x,
          y,
          z,
          yaw,
          sin: Math.sin(yaw),
          cos: Math.cos(yaw),
          skin,
          jacket,
          seed: i * 0.91 + row * 2.3,
          handIndex: hands[skin].length,
          armIndex: arms[jacket].length,
        };
        this.audienceActors.push(spectator);
        seatPads.push({ position: local(0, 0.3, 0.05), scale: [0.46, 0.055, 0.44], yaw });
        hair[skin].push({ position: local(0, 1.12, -0.014), scale: [0.146, 0.09, 0.147], yaw });
        skinGroups[skin].push({
          position: local(0, 1.012, 0.15),
          scale: [0.025, 0.033, 0.035],
          yaw,
        });
        for (const side of [-1, 1]) {
          hands[skin].push({
            position: local(side * 0.2, 0.67, 0.23),
            scale: [0.037, 0.052, 0.029],
            yaw,
          });
          arms[jacket].push({ position: local(side * 0.22, 0.7, 0.11), scale: [1, 0.3, 1], yaw });
          eyes.push({
            position: local(side * 0.051, 1.057, 0.135),
            scale: [0.01, 0.014, 0.009],
            yaw,
          });
          legs.push({
            position: local(side * 0.105, 0.33, 0.16),
            scale: [0.085, 0.092, 0.23],
            yaw,
          });
          legs.push({
            position: local(side * 0.105, 0.145, 0.33),
            scale: [0.065, 0.18, 0.068],
            yaw,
          });
          shoes.push({
            position: local(side * 0.105, -0.035, 0.38),
            scale: [0.082, 0.055, 0.13],
            yaw,
          });
        }
      }
    }
    b.instances(
      new THREE.BoxGeometry(1, 1, 1),
      b.material('#101c34', 0.9),
      seats,
      'Quiz · 105 Tribünensitze',
    );
    skinGroups.forEach((transforms, i) =>
      b.instances(
        new THREE.SphereGeometry(1, 8, 6),
        b.material(colors[i], 0.84),
        transforms,
        'Quiz · Publikum Köpfe',
      ),
    );
    jackets.forEach((transforms, i) =>
      b.instances(
        new THREE.SphereGeometry(1, 8, 6),
        b.material(['#172b43', '#343146', '#27484b', '#523b39'][i], 0.9),
        transforms,
        'Quiz · Publikum Kleidung',
      ),
    );
    b.instances(
      new THREE.BoxGeometry(1, 1, 1),
      b.material('#101c34', 0.9),
      seatPads,
      'Quiz · Tribünensitzflächen',
    );
    b.instances(
      new THREE.SphereGeometry(1, 8, 6),
      b.material('#111823', 0.9),
      legs,
      'Quiz · sitzendes Publikum Beine',
    );
    b.instances(
      new THREE.SphereGeometry(1, 8, 6),
      b.material('#080d16', 0.76),
      shoes,
      'Quiz · Publikum Schuhe',
    );
    b.instances(
      new THREE.SphereGeometry(1, 6, 5),
      b.material('#14232d', 0.83),
      eyes,
      'Quiz · Publikum Augen',
    );
    hair.forEach((transforms, i) =>
      b.instances(
        new THREE.SphereGeometry(1, 8, 6),
        b.material(['#2c2626', '#514035', '#a0906a'][i], 0.86),
        transforms,
        'Quiz · Publikum Haare',
      ),
    );
    hands.forEach((transforms, i) => {
      const m = b.instances(
        new THREE.SphereGeometry(1, 8, 6),
        b.material(colors[i], 0.84),
        transforms,
        'Quiz · animierte Applaushände',
      );
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.audienceHands.push(m);
    });
    arms.forEach((transforms, i) => {
      const m = b.instances(
        new THREE.CylinderGeometry(0.041, 0.045, 1, 8),
        b.material(['#172b43', '#343146', '#27484b', '#523b39'][i], 0.9),
        transforms,
        'Quiz · animierte Publikumsarme',
      );
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.audienceArms.push(m);
    });
  }
  updateAudience(time, applause) {
    // Seven cheap instance uploads only while the crowd is applauding. Idle/paused frames reuse them.
    const tick = Math.floor(time * 24);
    if (this.lastAudienceTick === tick && this.lastApplause === applause) return;
    if (!applause && this.lastApplause === false) return;
    this.lastAudienceTick = tick;
    this.lastApplause = applause;
    const o = this.audienceTransform,
      a = this.audienceStart,
      end = this.audienceEnd;
    for (const person of this.audienceActors) {
      const spread = applause
        ? 0.045 + 0.16 * (0.5 + 0.5 * Math.cos(time * 7.3 + person.seed))
        : 0.2;
      const handY = applause ? 0.72 + Math.sin(time * 2.1 + person.seed) * 0.025 : 0.59;
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex ? 1 : -1;
        const lx = side * spread,
          lz = applause ? 0.27 : 0.21;
        end.set(
          person.x + person.cos * lx + person.sin * lz,
          person.y + handY,
          person.z - person.sin * lx + person.cos * lz,
        );
        o.position.copy(end);
        o.rotation.set(0, person.yaw, side * (applause ? 0.12 : 0.05));
        o.scale.set(0.037, 0.052, 0.029);
        o.updateMatrix();
        this.audienceHands[person.skin].setMatrixAt(person.handIndex + sideIndex, o.matrix);
        a.set(
          person.x + person.cos * side * 0.225,
          person.y + 0.82,
          person.z - person.sin * side * 0.225,
        );
        this.audienceDirection.subVectors(a, end);
        o.position.copy(a).add(end).multiplyScalar(0.5);
        const length = this.audienceDirection.length();
        o.quaternion.setFromUnitVectors(this.up, this.audienceDirection.normalize());
        o.scale.set(1, length, 1);
        o.updateMatrix();
        this.audienceArms[person.jacket].setMatrixAt(person.armIndex + sideIndex, o.matrix);
      }
    }
    for (const mesh of [...this.audienceHands, ...this.audienceArms])
      mesh.instanceMatrix.needsUpdate = true;
  }
  beam(index, b, lampMaterial) {
    const group = new THREE.Group();
    const angle = (index / 8) * TAU;
    group.position.set(Math.sin(angle) * 5.85, 6.25, Math.cos(angle) * 5.85);
    this.scene.add(group);
    const housing = b.cylinder([0, 0, 0], 0.13, 0.25, b.material('#132136', 0.5, 0.5), group, 12);
    const lens = b.cylinder([0, -0.135, 0], 0.11, 0.015, lampMaterial, group, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: '#5999ff',
      transparent: true,
      opacity: 0.028,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const cone = b.mesh(
      new THREE.CylinderGeometry(0.055, 1.25, 6.8, 16, 1, true),
      mat,
      [0, -3.5, 0],
      group,
    );
    cone.renderOrder = 4;
    this.beams.push({ group, angle, mat, housing, lens });
  }
  buildConfetti() {
    const count = 128;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.particleSeeds = [];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963;
      const r = 1.5 + ((i % 23) / 23) * 4.2;
      this.particleSeeds.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        y: 2.5 + ((i % 19) / 19) * 5.5,
        speed: 0.5 + (i % 7) / 10,
      });
      color.set(i % 3 ? '#edca83' : '#b8e7ff');
      color.toArray(colors, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.builder.geometries.add(geometry);
    this.builder.materials.add(material);
    this.confetti = new THREE.Points(geometry, material);
    this.confetti.frustumCulled = false;
    this.confetti.visible = false;
    this.scene.add(this.confetti);
  }
  resize() {
    this.world.renderer.getSize(this.size);
    this.camera.aspect = Math.max(0.1, this.size.x / Math.max(1, this.size.y));
    this.camera.updateProjectionMatrix();
  }
  questionCamera(elapsed = 0) {
    const drift = Math.sin(elapsed * 0.13) * 0.17;
    this.camera.position.set(4.25 + drift, 2.68, 6.65);
    this.look.set(0, 1.4, 0);
    this.camera.fov = 40;
  }
  introFrame(state, elapsed = 0) {
    const shot = state.introShot;
    const raw = clamp(state.introProgress);
    const p = state.reducedMotion ? 0.5 : ease(raw);
    let scene = this.scene,
      fade = 0;
    if (shot === 'portal') {
      scene = this.world.scene;
      this.camera.position.set(lerp(36.98, 38, p), lerp(1.53, 1.415, p), lerp(22.32, 22.15, p));
      this.look.set(38.53, lerp(1.45, 1.415, p), 22.15);
      this.camera.fov = lerp(63, 33, p);
      fade = Math.max(1 - ease(elapsed / 0.6), ease((raw - 0.89) / 0.11));
    } else if (shot === 'reveal') {
      const a = lerp(0.78, 0.43, p),
        r = lerp(10.9, 9.2, p);
      this.camera.position.set(Math.sin(a) * r, lerp(6.7, 4.7, p), Math.cos(a) * r);
      this.look.set(0, lerp(0.7, 1.12, p), -0.9);
      this.camera.fov = lerp(54, 46, p);
      fade = 1 - ease(raw / 0.18);
    } else if (shot === 'establish') {
      const a = lerp(0.43, -0.31, p),
        r = lerp(9.2, 8.1, p);
      this.camera.position.set(Math.sin(a) * r, lerp(4.7, 3.15, p), Math.cos(a) * r);
      this.look.set(0, lerp(1.12, 1.36, p), lerp(-0.9, -0.15, p));
      this.camera.fov = lerp(46, 43, p);
    } else if (shot === 'audience') {
      const a = lerp(4.05, 4.58, p);
      this.camera.position.set(Math.sin(a) * 4.9, lerp(1.91, 2.13, p), Math.cos(a) * 4.9);
      this.look.set(Math.sin(a + 0.04) * 8.9, 1.44, Math.cos(a + 0.04) * 8.9);
      this.camera.fov = 46;
    } else if (shot === 'host') {
      this.camera.position.set(lerp(-0.2, 0.15, p), lerp(2.31, 2.24, p), lerp(3.38, 3.05, p));
      this.look.set(-1.36, 1.79, 0);
      this.camera.fov = lerp(43, 39, p);
    } else if (shot === 'candidate') {
      this.camera.position.set(lerp(-0.28, 0.06, p), 2.23, lerp(3.6, 3.28, p));
      this.look.set(1.36, lerp(1.62, 1.75, p), 0);
      this.camera.fov = lerp(43, 39, p);
    } else if (shot === 'question-ready') {
      this.camera.position.set(lerp(4.25, 3.63, p), lerp(2.68, 2.48, p), lerp(6.65, 5.85, p));
      this.look.set(0, lerp(1.4, 1.55, p), 0);
      this.camera.fov = lerp(40, 37, p);
    } else {
      const settle = ease(raw / 0.965);
      this.camera.position.set(
        lerp(0.8, 4.25, settle),
        lerp(2.93, 2.68, settle),
        lerp(7.25, 6.65, settle),
      );
      this.look.set(0, lerp(1.6, 1.4, settle), 0);
      this.camera.fov = lerp(44, 40, settle);
      // Settle for the last few frames of either duo shot. The audio-controlled
      // phase may end between RAFs; this guarantees the actual last rendered
      // frame already shares the first question's exact camera anchor.
      if (raw >= 0.965 || state.reducedMotion) this.questionCamera(0);
    }
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
    return { scene, fade, studio: scene === this.scene, shot };
  }
  frame(phase, elapsed, state) {
    if (phase === 'intro' && QUIZ_INTRO_SHOTS.includes(state.introShot))
      return this.introFrame(state, elapsed);
    let scene = this.scene,
      fade = 0,
      shot = 'two-shot';
    if (phase === 'intro' && elapsed < 4.35) {
      scene = this.world.scene;
      const a = ease(elapsed / 4.1);
      this.camera.position.set(lerp(36.98, 38.0, a), lerp(1.53, 1.415, a), lerp(22.32, 22.15, a));
      this.look.set(38.53, lerp(1.45, 1.415, a), 22.15);
      this.camera.fov = lerp(63, 33, a);
      fade = ease((elapsed - 3.85) / 0.48);
      shot = 'urinal-push';
    } else if (phase === 'intro') {
      const a = ease((elapsed - 4.35) / 4);
      const angle = lerp(1.15, 0.44, a),
        radius = lerp(12, 8.5, a);
      this.camera.position.set(
        Math.sin(angle) * radius,
        lerp(6.8, 3.05, a),
        Math.cos(angle) * radius,
      );
      this.look.set(0, lerp(0.8, 1.17, a), 0);
      this.camera.fov = lerp(48, 43, a);
      fade = 1 - ease((elapsed - 4.35) / 0.65);
      if (elapsed > 8.35) {
        const settle = ease((elapsed - 8.35) / 3.65);
        this.camera.position.lerp(this.goal.set(4.5, 2.65, 6.7), settle);
        this.look.y = lerp(1.17, 1.38, settle);
        this.camera.fov = lerp(43, 40, settle);
      }
      shot = 'studio-crane';
    } else if (phase === 'locked' || phase === 'lock' || phase === 'tension') {
      const t = ease(this.phaseTime / 3.5);
      this.camera.position.set(lerp(0.08, 0.42, t), 2.2, lerp(3.02, 2.54, t));
      this.look.set(1.32, 2.17, 0);
      this.camera.fov = lerp(35, 29, t);
      shot = 'candidate-close';
    } else if (
      phase === 'win' ||
      phase === 'won' ||
      phase === 'result' ||
      phase === 'lose' ||
      phase === 'lost'
    ) {
      const t = Math.min(this.phaseTime, 14);
      const angle = 0.42 + t * 0.025;
      this.camera.position.set(
        Math.sin(angle) * 8,
        3.25 + Math.sin(t * 0.15) * 0.15,
        Math.cos(angle) * 8,
      );
      this.look.set(0, 1.25, 0);
      this.camera.fov = 45;
      shot = 'result-crane';
    } else if (
      (phase === 'reveal' || phase === 'correct' || phase === 'wrong') &&
      this.phaseTime < 2.5
    ) {
      const t = ease(this.phaseTime / 2.5);
      this.camera.position.set(lerp(4.15, 4.45, t), 2.6, lerp(6, 6.5, t));
      this.look.set(0, 1.45, 0);
      this.camera.fov = 41;
      shot = 'answer-reveal';
    } else {
      this.questionCamera(elapsed);
    }
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
    return { scene, fade, studio: scene === this.scene, shot };
  }
  render(state = {}, elapsed = 0, dt = 0) {
    if (this.disposed) return { fade: 0, studio: false, shot: 'disposed' };
    const phase = typeof state === 'string' ? state : state.phase || 'question';
    if (phase !== this.previousPhase) {
      this.previousPhase = phase;
      this.phaseTime = 0;
    }
    this.phaseTime = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
    this.resize();
    this.scene.environment = this.world.scene?.environment || null;
    const frame = this.frame(phase, elapsed, state);
    const win =
      ['win', 'won', 'correct'].includes(phase) || (phase === 'reveal' && state.correct === true);
    const lose =
      ['lose', 'lost', 'wrong'].includes(phase) || (phase === 'reveal' && state.correct === false);
    const locked = ['locked', 'lock', 'tension'].includes(phase);
    const color = lose ? '#d4515b' : win ? '#61d4ae' : locked ? '#e7a846' : '#3b9dec';
    this.blue.color.set(color);
    this.blue.emissive.set(color);
    this.blue.emissiveIntensity = locked ? 0.8 + Math.sin(elapsed * 4.2) * 0.22 : 1.3;
    this.accent.color.set(color);
    this.accent.intensity = win ? 47 : locked ? 15 : 32;
    const showOpening = phase === 'intro' && frame.studio;
    const reveal = showOpening && state.introShot === 'reveal';
    const revealProgress = reveal ? ease(clamp(state.introProgress) / 0.45) : 1;
    this.keyLight.intensity = showOpening ? lerp(0.65, 2.9, revealProgress) : 2.7;
    this.fillLight.intensity = showOpening ? lerp(0.72, 2.0, revealProgress) : 1.8;
    if (showOpening) {
      this.blue.emissiveIntensity =
        (1.65 + Math.sin(elapsed * 1.8) * 0.2) * lerp(0.28, 1, revealProgress);
      this.gold.emissiveIntensity = 1.2 + Math.sin(elapsed * 0.7) * 0.18;
      this.accent.intensity = 38 + Math.sin(elapsed * 1.3) * 9;
    } else this.gold.emissiveIntensity = 1.1;
    this.updateAudience(elapsed, (showOpening && !state.speaking) || win);
    animateHuman(this.host, elapsed, 0, 'seated');
    animateHuman(this.candidate, elapsed + 0.5, 0, 'seated');
    // animateHuman uses the office chair baseline; studio bar stools have their own seat height.
    this.host.position.y = this.candidate.position.y = 0.555;
    this.hostMouth.scale.y = state.speaking ? 1 + Math.abs(Math.sin(elapsed * 13.2)) * 3.3 : 1;
    const hostRig = this.host.userData.rig;
    const candidateRig = this.candidate.userData.rig;
    if (
      state.speaking === true ||
      state.speaking === 'host' ||
      state.speaking === 'lukas' ||
      phase === 'intro'
    ) {
      hostRig.rightArm.rotation.x = -0.95 + Math.sin(elapsed * 1.8) * 0.08;
      hostRig.rightFore.rotation.x = -0.5 + Math.sin(elapsed * 2.3) * 0.13;
      hostRig.rightArm.rotation.z = -0.12;
    }
    if (showOpening && ['host', 'candidate'].includes(state.introShot)) {
      const actorRig = state.introShot === 'host' ? hostRig : candidateRig;
      const greeting = Math.sin(clamp(state.introProgress) * Math.PI);
      actorRig.rightArm.rotation.x -= greeting * 0.55;
      actorRig.rightArm.rotation.z -= greeting * 0.22;
      actorRig.rightFore.rotation.x -= greeting * 0.5;
    }
    if (win) {
      candidateRig.rightArm.rotation.x = -1.45 - Math.sin(elapsed * 2) * 0.08;
      candidateRig.rightFore.rotation.x = -1.1;
    }
    if (lose) {
      candidateRig.leftArm.rotation.x = -1.62;
      candidateRig.leftFore.rotation.x = -1.25;
    }
    for (const beam of this.beams) {
      const sweepSpeed = showOpening ? 0.51 : 0.2;
      beam.group.rotation.z =
        Math.sin(elapsed * sweepSpeed + beam.angle) * (locked ? 0.09 : showOpening ? 0.34 : 0.2);
      beam.group.rotation.x =
        Math.cos(elapsed * sweepSpeed * 0.83 + beam.angle) * (showOpening ? 0.31 : 0.18);
      beam.mat.color.set(showOpening && Math.sin(beam.angle * 3) > 0 ? '#b6d9ff' : color);
      beam.mat.opacity = locked ? 0.017 : showOpening ? lerp(0.014, 0.045, revealProgress) : 0.032;
    }
    this.confetti.visible =
      ['win', 'won'].includes(phase) ||
      (phase === 'result' && state.correct !== false && Number(state.level) >= 15);
    if (this.confetti.visible) {
      const positions = this.confetti.geometry.attributes.position;
      this.particleSeeds.forEach((seed, i) => {
        const y = ((((seed.y - this.phaseTime * seed.speed) % 6.2) + 6.2) % 6.2) + 0.4;
        positions.setXYZ(
          i,
          seed.x + Math.sin(elapsed + i) * 0.26,
          y,
          seed.z + Math.cos(elapsed * 0.7 + i) * 0.2,
        );
      });
      positions.needsUpdate = true;
    }
    this.fixture?.update(elapsed);
    const renderer = this.world.renderer;
    const oldTarget = renderer.getRenderTarget?.() || null;
    const oldAutoClear = renderer.autoClear;
    const oldShadowAuto = renderer.shadowMap.autoUpdate;
    const office = this.world.groups?.office;
    const player = this.world.player;
    const officeVisible = office?.visible;
    const playerVisible = player?.visible;
    try {
      renderer.setRenderTarget?.(null);
      renderer.autoClear = true;
      if (!frame.studio) {
        if (office) office.visible = true;
        if (player) player.visible = false;
      }
      // Stage lights do not cast shadows; WC keeps the world's existing cached map.
      renderer.shadowMap.autoUpdate = false;
      renderer.render(frame.scene, this.camera);
    } finally {
      if (!frame.studio) {
        if (office) office.visible = officeVisible;
        if (player) player.visible = playerVisible;
      }
      renderer.autoClear = oldAutoClear;
      renderer.shadowMap.autoUpdate = oldShadowAuto;
      renderer.setRenderTarget?.(oldTarget);
    }
    return { fade: frame.fade, studio: frame.studio, shot: frame.shot };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.builder.dispose();
    this.scene.clear();
    this.beams.length = 0;
  }
}
