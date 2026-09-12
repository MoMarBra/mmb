import * as THREE from 'three';
import { box, label } from './world.js';
import { storyActor, animateStoryActor } from './workshop-sets.js';
import { mergeStaticGeometry } from './render-batches.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(x) ? x : a));
const smooth = (a, b, t) => {
  const u = clamp((t - a) / Math.max(0.001, b - a));
  return u * u * (3 - 2 * u);
};
const gold = '#f4d28a';
const particleGeometry = new THREE.PlaneGeometry(1, 1, 1, 6);
const orbGeometry = new THREE.SphereGeometry(1, 12, 8);
const up = new THREE.Vector3(0, 1, 0);

function cylinder(parent, x, y, z, radius, height, material, top = radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, radius, height, 20), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function surface(color, metalness = 0, roughness = 0.65) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function softMaterial(color, opacity = 0.25) {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:
      'varying vec2 vUv;uniform vec3 tint;uniform float opacity;void main(){float d=length((vUv-.5)*2.);float a=(1.-smoothstep(.15,1.,d))*opacity;if(a<.006)discard;gl_FragColor=vec4(tint,a);}',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Portable prop: bottom y=0; front +z; 0.78m wide, 0.55m deep. Never includes a collider. */
export function createBurningLaptop() {
  const laptop = new THREE.Group();
  laptop.name = 'BBE · Ticket in Flammen · Laptop';
  const shell = surface('#89999d', 0.75, 0.32),
    black = surface('#142127', 0.22, 0.42);
  box(laptop, 0, 0.025, 0, 0.78, 0.05, 0.55, shell);
  box(laptop, 0, 0.052, 0.16, 0.22, 0.006, 0.12, surface('#64777e', 0.5));
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.041, 0.008, 0.035), black, 56);
  const matrix = new THREE.Matrix4();
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 14; col++) {
      matrix.makeTranslation(-0.32 + col * 0.049, 0.057, -0.17 + row * 0.047);
      keys.setMatrixAt(row * 14 + col, matrix);
    }
  keys.instanceMatrix.needsUpdate = true;
  laptop.add(keys);
  const lid = new THREE.Group();
  lid.position.set(0, 0.06, -0.245);
  lid.rotation.x = -0.16;
  laptop.add(lid);
  box(lid, 0, 0.23, 0, 0.78, 0.46, 0.033, shell);
  const screen = box(
    lid,
    0,
    0.23,
    0.02,
    0.718,
    0.397,
    0.01,
    new THREE.MeshStandardMaterial({
      color: '#17363d',
      emissive: '#327ea2',
      emissiveIntensity: 0.3,
      roughness: 0.25,
    }),
  );
  label(lid, 'EMPOWER · BITTE WARTEN', 0, 0.29, 0.026, 0.66, 0.13, {
    bg: '#102d39',
    fg: '#f4d9a4',
    sub: 'Finale Version wird finalisiert …',
  });
  box(lid, -0.12, 0.14, 0.029, 0.38, 0.012, 0.003, '#6cc5ba', false);
  const fireMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 1 } },
    vertexShader:
      'varying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.x+=sin(uv.y*8.+time*3.4)*uv.y*.08;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float time;uniform float intensity;
      void main(){float y=vUv.y;float x=(vUv.x-.5)*2.;
      float wave=sin(y*17.-time*6.)*.065+sin(y*29.-time*3.)*.045;
      float edge=1.-pow(y,.72);float a=(1.-smoothstep(edge-.2,edge+.12,abs(x+wave)))*(1.-smoothstep(.62,1.,y));
      a*=smoothstep(0.,.07,y)*intensity*.82; if(a<.007)discard;
      vec3 c=mix(vec3(1.,.16,.015),vec3(1.,.83,.25),clamp((1.-y)*1.3-abs(x)*.7,0.,1.));
      gl_FragColor=vec4(c,a);}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const fire = new THREE.Group();
  fire.position.set(0, 0.09, -0.035);
  laptop.add(fire);
  for (let i = 0; i < 8; i++) {
    const plume = new THREE.Mesh(particleGeometry, fireMaterial);
    plume.position.set(Math.sin(i * 2.4) * 0.19, 0.2 + (i % 3) * 0.045, Math.cos(i * 2.4) * 0.13);
    plume.scale.set(0.19 + (i % 3) * 0.04, 0.39 + (i % 3) * 0.1, 1);
    plume.rotation.y = i * 1.3;
    fire.add(plume);
  }
  const smoke = new THREE.Group();
  laptop.add(smoke);
  const smokeMaterial = softMaterial('#61727b', 0.12);
  for (let i = 0; i < 10; i++) {
    const puff = new THREE.Mesh(particleGeometry, smokeMaterial);
    puff.rotation.y = i * 1.17;
    smoke.add(puff);
  }
  const light = new THREE.PointLight('#ffab47', 1, 2.4, 2);
  light.position.set(0, 0.36, 0);
  laptop.add(light);
  laptop.userData.fireData = {
    fire,
    smoke,
    light,
    screen,
    fireMaterial,
    smokeMaterial,
    intensity: 1,
  };
  setLaptopFire(laptop, 1, 0);
  return laptop;
}

export function setLaptopFire(laptop, intensity, time = 0) {
  const d = laptop?.userData?.fireData;
  if (!d) return;
  intensity = clamp(intensity);
  time = Number.isFinite(time) ? time : 0;
  d.intensity = intensity;
  d.fire.visible = intensity > 0.005;
  d.smoke.visible = intensity > 0.005;
  d.fireMaterial.uniforms.time.value = time;
  d.fireMaterial.uniforms.intensity.value = intensity;
  d.fire.scale.y = 0.2 + intensity * 0.8;
  d.light.intensity = intensity * (1.2 + 0.16 * Math.sin(time * 11));
  d.screen.material.emissiveIntensity = 0.1 + intensity * (0.18 + 0.02 * Math.sin(time * 16));
  d.smokeMaterial.uniforms.opacity.value = intensity * 0.15;
  d.smoke.children.forEach((puff, i) => {
    const p = (((time * 0.2 + i / 10) % 1) + 1) % 1;
    puff.position.set(
      Math.sin(i * 2.4 + time * 0.3) * (0.08 + p * 0.23),
      0.3 + p * 1.08,
      Math.cos(i * 1.7) * 0.13,
    );
    puff.scale.setScalar(0.22 + p * 0.53);
  });
}

function actorAt(scene, role, x, z, rotation = 0) {
  const actor = storyActor(role);
  actor.position.set(x, 0, z);
  actor.rotation.y = rotation;
  actor.userData.home = actor.position.clone();
  scene.add(actor);
  return actor;
}
function room(scene, it) {
  scene.background = new THREE.Color(it ? '#152732' : '#9cb0b9');
  scene.fog = new THREE.Fog(it ? '#152732' : '#9cb0b9', 15, 34);
  scene.add(new THREE.HemisphereLight(it ? '#afc9dd' : '#f4eada', '#594736', it ? 1.4 : 2.1));
  const key = new THREE.DirectionalLight(it ? '#c5dfea' : '#ffe0a5', it ? 2.6 : 3.4);
  key.position.set(-4, 7, 5);
  key.target.position.set(0, 1, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0003;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 9, bottom: -7, near: 0.1, far: 25 });
  scene.add(key, key.target);
  box(scene, 0, -0.1, 0, 13, 0.2, 12, it ? '#45565c' : '#ab9879');
  for (let n = -6; n < 6; n += it ? 0.9 : 0.33)
    box(scene, 0, 0.003, n, 13, 0.006, 0.012, it ? '#33454c' : '#8d7b65', false);
  box(scene, 0, 2.4, -5.8, 13, 4.8, 0.18, it ? '#203742' : '#d6d2bf');
  box(scene, 6.5, 2.4, 0, 0.18, 4.8, 12, it ? '#2c454e' : '#d7d7cb');
  for (let z = -4.5; z < 4; z += 2.5) {
    box(scene, -6.4, 2.1, z, 0.06, 3, 2.15, it ? '#71949f' : '#bdd0cf', false);
    box(scene, -6.3, 0.58, z, 0.16, 0.18, 2.35, '#e0ddcc');
    box(scene, -6.3, 2.2, z, 0.1, 3.3, 0.08, '#788d90');
  }
  label(scene, 'BBE Handelsberatung', 0.15, 3.45, -5.67, 3.7, 0.76, {
    bg: it ? '#203742' : '#d6d2bf',
    fg: it ? '#e9cf91' : '#244753',
    sub: it ? 'INTERNAL IT · WIR KÜMMERN UNS.' : 'RETAIL. INSIGHT. IMPACT.',
  });
}
function workstation(scene, x, z, burning = false) {
  box(scene, x, 0.84, z, 2.1, 0.08, 0.92, '#b59d78');
  for (const sign of [-1, 1]) box(scene, x + sign * 0.85, 0.42, z, 0.065, 0.84, 0.74, '#acb7b8');
  if (!burning) {
    box(scene, x, 1.31, z - 0.2, 0.92, 0.53, 0.075, '#263e47');
    label(scene, 'BBE · 12 Folien. Eine Story.', x, 1.32, z - 0.155, 0.83, 0.43, { bg: '#234650' });
    box(scene, x, 0.99, z - 0.23, 0.035, 0.3, 0.04, '#73878b');
  }
  box(scene, x + 0.7, 0.902, z + 0.04, 0.22, 0.035, 0.31, '#ece3c9');
  cylinder(scene, x - 0.8, 0.99, z - 0.1, 0.065, 0.16, surface('#eae4d3'));
  box(scene, x, 0.55, z + 1.02, 0.64, 0.13, 0.55, '#3b5359');
  box(scene, x, 0.94, z + 1.25, 0.62, 0.68, 0.09, '#3b5359');
  cylinder(scene, x, 0.27, z + 1.02, 0.045, 0.5, surface('#9babad', 0.7));
}
function extinguisher() {
  const group = new THREE.Group();
  group.name = 'Benjamin · Feuerlöscher';
  const red = surface('#a92725', 0.22, 0.4),
    dark = surface('#1d2e35', 0.25);
  cylinder(group, 0, -0.25, 0, 0.11, 0.4, red);
  cylinder(group, 0, -0.025, 0, 0.04, 0.07, dark);
  box(group, 0, 0.025, 0, 0.18, 0.03, 0.065, dark);
  const band = cylinder(group, 0, -0.24, 0, 0.112, 0.16, surface('#e9e6d8'));
  label(group, 'CO₂', 0, -0.24, 0.114, 0.15, 0.09, { bg: '#e9e6d8', fg: '#253b44' });
  const pipe = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.06, 0, 0),
        new THREE.Vector3(0.21, -0.09, 0.02),
        new THREE.Vector3(0.16, -0.22, 0.2),
      ]),
      14,
      0.016,
      6,
      false,
    ),
    dark,
  );
  group.add(pipe);
  group.userData.band = band;
  return group;
}

export function buildFireSet(kind = 'intro') {
  const it = kind === 'rescue' || kind === 'success';
  const scene = new THREE.Scene();
  scene.name = `Ticket in Flammen · ${it ? 'IT' : 'Office'}`;
  room(scene, it);
  const set = { scene, actors: {}, kind, it, lamps: [], markers: {} };
  workstation(scene, 0, 0, true);
  set.laptop = createBurningLaptop();
  set.laptop.position.set(0, 0.89, 0);
  scene.add(set.laptop);
  set.actors.player = actorAt(scene, 'player', -1.5, 1.3, 0.75);
  set.actors.Lena = actorAt(scene, 'Lena', 1.7, -0.9, -0.55);
  set.actors.Tobias = actorAt(scene, 'Tobias', -2.1, -1.3, 0.65);
  set.actors.lukas = actorAt(scene, 'lukas', 3.45, -1.8, -0.8);
  if (!it) {
    workstation(scene, -3.2, -3.3);
    workstation(scene, 3.2, -3.3);
    label(scene, 'MEETING IN 5 MINUTEN', 4.7, 2.6, -5.65, 2.2, 0.7, {
      bg: '#ece7d8',
      fg: '#52696e',
      sub: 'Agenda: Ruhe bewahren. Dann Alignment.',
    });
    for (let i = 0; i < 6; i++)
      box(
        scene,
        -5.65 + i * 0.18,
        0.58,
        -5.1,
        0.11,
        0.65 + (i % 2) * 0.08,
        0.34,
        i % 2 ? '#285767' : '#b58654',
      );
  } else {
    const rackMat = surface('#172a34', 0.55, 0.35),
      railMat = surface('#758a92', 0.7, 0.3);
    const green = new THREE.MeshBasicMaterial({ color: '#68c5a6' });
    for (const x of [-4.4, -2.9, 2.9, 4.4]) {
      box(scene, x, 1.48, -4.7, 1.15, 2.95, 1.02, rackMat);
      for (const sign of [-1, 1])
        box(scene, x + sign * 0.5, 1.46, -4.16, 0.034, 2.8, 0.035, railMat);
      for (let row = 0; row < 9; row++) {
        box(scene, x, 0.3 + row * 0.285, -4.14, 0.95, 0.23, 0.04, '#354b57');
        for (let k = 0; k < 5; k++)
          box(
            scene,
            x - 0.31 + k * 0.11,
            0.3 + row * 0.285,
            -4.112,
            0.055,
            0.012,
            0.004,
            '#102630',
            false,
          );
        set.lamps.push(
          box(scene, x + 0.38, 0.3 + row * 0.285, -4.11, 0.025, 0.025, 0.015, green, false),
        );
      }
    }
    const ben = (set.actors.benjamin = actorAt(scene, 'benjamin', 2.1, 1.3, -1.25));
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.021, 8, 48),
      new THREE.MeshBasicMaterial({ color: gold, toneMapped: false }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.07;
    ben.add(halo);
    set.halo = halo;
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: '#eff0df',
      transparent: true,
      opacity: 0.78,
      roughness: 1,
      depthWrite: false,
    });
    set.clouds = new THREE.Group();
    set.clouds.position.set(2.1, 5.55, 1.3);
    scene.add(set.clouds);
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(orbGeometry, cloudMaterial);
      puff.position.set(Math.sin(i * 2.1) * 0.9, Math.cos(i * 1.6) * 0.17, Math.cos(i * 2.1) * 0.7);
      puff.scale.set(0.6 + (i % 2) * 0.22, 0.25, 0.49);
      set.clouds.add(puff);
    }
    const rays = (set.rays = new THREE.Group());
    rays.position.set(2.1, 0, 1.3);
    scene.add(rays);
    const rayMat = new THREE.MeshBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 5; i++) {
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.75 + i * 0.17, 6, 3, 1, true), rayMat);
      ray.position.y = 3.15;
      ray.rotation.y = i * 1.8;
      rays.add(ray);
    }
    set.angelLight = new THREE.PointLight(gold, 4.5, 7, 2);
    set.angelLight.position.set(2.1, 3.5, 1.3);
    scene.add(set.angelLight);
    set.extinguisher = extinguisher();
    scene.add(set.extinguisher);
    set.nozzle = new THREE.Group();
    ben.userData.rig.rightFore.add(set.nozzle);
    set.nozzle.position.set(0, -0.29, 0);
    set.nozzle.rotation.x = -Math.PI / 2;
    cylinder(set.nozzle, 0, 0.08, 0, 0.035, 0.16, surface('#203039'), 0.025);
    set.nozzleTip = new THREE.Object3D();
    set.nozzleTip.position.y = 0.16;
    set.nozzle.add(set.nozzleTip);
    const spray = (set.spray = new THREE.Group());
    scene.add(spray);
    set.sprayMaterial = softMaterial('#dfede8', 0.27);
    for (let i = 0; i < 44; i++) {
      const p = new THREE.Mesh(particleGeometry, set.sprayMaterial);
      p.rotation.y = i * 1.8;
      spray.add(p);
    }
    set.nozzle.visible = false;
    set.powder = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), softMaterial('#e3ece6', 0.0));
    set.powder.rotation.x = -Math.PI / 2;
    set.powder.position.set(0, 0.942, 0);
    scene.add(set.powder);
  }
  // Batch fixed scene meshes; actors, flames, LEDs and hand props keep their rigs.
  scene.updateMatrixWorld(true);
  const batches = new Map();
  for (const mesh of [...scene.children]) {
    if (
      !mesh.isMesh ||
      mesh === set.powder ||
      set.lamps.includes(mesh) ||
      mesh.material.isShaderMaterial
    )
      continue;
    const key = mesh.material.uuid + ':' + mesh.castShadow + ':' + mesh.receiveShadow;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  }
  for (const meshes of batches.values())
    if (meshes.length > 2) {
      const merged = new THREE.Mesh(mergeStaticGeometry(meshes), meshes[0].material);
      merged.castShadow = meshes[0].castShadow;
      merged.receiveShadow = meshes[0].receiveShadow;
      merged.name = 'Fire set · baked static geometry';
      for (const mesh of meshes) scene.remove(mesh);
      scene.add(merged);
    }
  set.tmp = {
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    aim: new THREE.Quaternion(),
  };
  updateFireSet(set, 0);
  return set;
}

/** All transforms are deterministic in timeline time: pause/skip/replay cannot accumulate drift. */
export function updateFireSet(set, time, phase = {}) {
  const t = Number.isFinite(time) ? time : 0;
  const markers = phase.markers || set.markers || {};
  const landing = markers.landing ?? 11,
    pickup = markers.pickup ?? 17,
    sprayStart = markers.sprayStart ?? 24,
    sprayEnd = markers.sprayEnd ?? 29;
  const isSuccess = set.kind === 'success';
  const intensity = set.it
    ? isSuccess
      ? 0
      : 1 - smooth(sprayStart, sprayEnd, t)
    : 0.7 + smooth(0, 7, t) * 0.3;
  setLaptopFire(set.laptop, intensity, t);
  for (const [role, actor] of Object.entries(set.actors)) {
    const speaking = phase.speaking === role;
    animateStoryActor(actor, t, speaking);
    if (actor.userData.mouth)
      actor.userData.mouth.scale.y = 0.009 * (speaking ? 1 + Math.abs(Math.sin(t * 12)) * 1.8 : 1);
    actor.position.copy(actor.userData.home);
    if (role !== 'benjamin' && !isSuccess && intensity > 0.15) {
      const rig = actor.userData.rig;
      const agitation = set.it ? 0.035 : 0.085;
      actor.position.x += Math.sin(t * 0.8 + role.length) * agitation;
      rig.leftArm.rotation.x = -0.28 - Math.sin(t * 2.2 + role.length) * 0.075;
      rig.leftFore.rotation.x = -0.9;
      if (role === 'Tobias') {
        rig.rightArm.rotation.x = -0.45;
        rig.rightFore.rotation.x = -1.3;
      }
    }
  }
  for (let i = 0; i < set.lamps.length; i++)
    set.lamps[i].visible = Math.sin(t * 2.7 + i * 3.2) > -0.5;
  if (!set.it) return;
  const ben = set.actors.benjamin,
    rig = ben.userData.rig;
  const descent = isSuccess ? 1 : smooth(0.8, landing, t);
  ben.position.y = (1 - descent) * 4.9;
  ben.rotation.y = -1.25;
  const take = isSuccess ? 1 : smooth(pickup - 1.25, pickup, t);
  const spray = !isSuccess && t >= sprayStart && t < sprayEnd;
  const poised = take > 0;
  rig.leftArm.rotation.x = -0.15 - take * 0.7;
  rig.leftArm.rotation.z = 0.11;
  rig.leftFore.rotation.x = -0.72;
  rig.rightArm.rotation.x = spray ? -1.35 : -0.24;
  rig.rightFore.rotation.x = spray ? -0.28 : -0.3;
  if (descent < 1) {
    rig.leftArm.rotation.z = 0.26;
    rig.rightArm.rotation.z = -0.26;
  }
  ben.updateWorldMatrix(true, true);
  rig.leftFore.localToWorld(set.tmp.a.set(0, -0.3, 0));
  set.extinguisher.position.set(2.68, 0.46, 1.18).lerp(set.tmp.a, take);
  // The cylinder hangs upright under the left grip; the right hand aims the nozzle.
  ben.getWorldQuaternion(set.tmp.q);
  set.extinguisher.quaternion.identity().slerp(set.tmp.q, take);
  set.nozzle.visible = poised;
  set.halo.rotation.z = Math.sin(t * 0.5) * 0.06;
  set.halo.material.color.set(isSuccess ? '#e6c172' : gold);
  set.clouds.visible = !isSuccess && t < landing + 2;
  set.clouds.children[0].material.opacity = 0.78 * (1 - smooth(landing - 1, landing + 2, t));
  set.rays.visible = !isSuccess && t < pickup + 2;
  set.rays.children[0].material.opacity = 0.038 * (1 - smooth(pickup - 1, pickup + 2, t));
  set.angelLight.intensity = isSuccess ? 0.7 : 0.8 + 3.1 * (1 - smooth(pickup, pickup + 3, t));
  set.spray.visible = spray;
  set.powder.material.uniforms.opacity.value =
    0.45 * (isSuccess ? 1 : smooth(sprayStart, sprayEnd, t));
  if (spray) {
    set.nozzle.getWorldPosition(set.tmp.a);
    set.laptop.localToWorld(set.tmp.b.set(0, 0.2, 0));
    set.tmp.b.sub(set.tmp.a).normalize();
    set.tmp.aim.setFromUnitVectors(up, set.tmp.b);
    set.nozzle.parent.getWorldQuaternion(set.tmp.q).invert();
    set.nozzle.quaternion.copy(set.tmp.q).multiply(set.tmp.aim);
    set.nozzleTip.getWorldPosition(set.tmp.a);
    set.laptop.localToWorld(set.tmp.b.set(0, 0.2, 0));
    const spread = 0.16;
    set.spray.children.forEach((p, i) => {
      const u = (((t * 1.7 + i / set.spray.children.length) % 1) + 1) % 1;
      p.position.copy(set.tmp.a).lerp(set.tmp.b, u);
      p.position.x += Math.sin(i * 7.2) * spread * u;
      p.position.y += Math.cos(i * 3.7) * spread * u;
      p.position.z += Math.sin(i * 2.9) * spread * u;
      p.scale.setScalar(0.06 + u * 0.28);
    });
  }
}
