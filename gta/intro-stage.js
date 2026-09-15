import * as THREE from 'three';
import { human, animateHuman, box, label } from './world.js';
import { createHelicopter } from './expansion-models.js';
import { animateVehicleWheels } from './blender-vehicles.js';

export const INTRO_CROWD_LIMIT = 56;
export const INTRO_CROWD_PATHS = {
  square: [
    [
      [100, 28],
      [158, 28],
    ],
    [
      [100, 24],
      [158, 24],
    ],
  ],
  hq: [
    [
      [17, 46],
      [65, 46],
    ],
    [
      [17, 33.6],
      [65, 33.6],
    ],
  ],
  augusten: [
    [
      [-11.4, 7],
      [-11.4, 68],
    ],
    [
      [11.4, 7],
      [11.4, 68],
    ],
  ],
  dogtown: [
    [
      [-11.5, 72],
      [-11.5, 105],
    ],
    [
      [11.5, 72],
      [11.5, 105],
    ],
  ],
  chase: [
    [
      [52, 46],
      [110, 46],
    ],
    [
      [52, 33.5],
      [110, 33.5],
    ],
  ],
  church: [
    [
      [264, 258],
      [294, 258],
    ],
    [
      [264, 265],
      [294, 265],
    ],
  ],
  marien: [
    [
      [342, 299],
      [391, 299],
    ],
    [
      [342, 305],
      [391, 305],
    ],
  ],
};
const palette = ['#57665a', '#394b65', '#b77951', '#913d45', '#c7b99b', '#688a9c', '#b19b60'];
const skins = ['#e6bf9c', '#bf8865', '#8f5f45', '#d4a17d'];

// A single reusable animated skeleton writes all extras to shared instance buffers.
// Crowd size does not multiply draw calls, AI agents, physics bodies or audio emitters.
export class IntroCrowd {
  constructor(world, parent) {
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'Film extras · bounded instanced crowd';
    this.root.userData.dynamic = true;
    parent.add(this.root);
    this.actor = human({ jacket: '#abcdef', pants: '#fedcba', skin: '#ccbbaa', hair: '#112233' });
    const groups = new Map();
    this.actor.traverse((o) => {
      if (!o.isMesh) return;
      const key = o.geometry.uuid + o.material.uuid;
      if (!groups.has(key))
        groups.set(key, { geometry: o.geometry, material: o.material, parts: [] });
      groups.get(key).parts.push(o);
    });
    this.batches = [...groups.values()].map((item) => {
      const role = item.material.color.getHexString();
      const varied = ['abcdef', 'fedcba', 'ccbbaa', '112233'].includes(role);
      const material = item.material.clone();
      if (varied) material.color.set('#ffffff');
      const mesh = new THREE.InstancedMesh(
        item.geometry,
        material,
        INTRO_CROWD_LIMIT * item.parts.length,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      for (let i = 0; i < INTRO_CROWD_LIMIT; i++) {
        const color = new THREE.Color(
          role === 'abcdef'
            ? palette[i % palette.length]
            : role === 'fedcba'
              ? i % 2
                ? '#263940'
                : '#514943'
              : role === 'ccbbaa'
                ? skins[i % skins.length]
                : role === '112233'
                  ? i % 3
                    ? '#352b27'
                    : '#aa9273'
                  : '#ffffff',
        );
        for (let j = 0; j < item.parts.length; j++)
          mesh.setColorAt(i * item.parts.length + j, color);
      }
      this.root.add(mesh);
      return { ...item, mesh };
    });
    this.cache = new Map();
    this.people = [];
  }
  paths(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const people = [],
      nav = this.world.pedestrianNav;
    for (const [a, b] of INTRO_CROWD_PATHS[name] || []) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
      for (let d = 2; d < length - 2 && people.length < INTRO_CROWD_LIMIT; d += 1.8) {
        const lane = people.length % 2 ? 0.55 : -0.55;
        const x = a[0] + dx * d - dz * lane,
          z = a[1] + dz * d + dx * lane;
        const p = {
          ax: x - dx * 1.35,
          az: z - dz * 1.35,
          bx: x + dx * 1.35,
          bz: z + dz * 1.35,
          speed: 0.65 + (people.length % 5) * 0.09,
          phase: people.length * 1.73,
          idle: people.length % 7 === 0,
        };
        if (!nav.free(p.ax, p.az) || !nav.free(p.bx, p.bz) || nav.segment(p.ax, p.az, p.bx, p.bz))
          continue;
        people.push(p);
      }
    }
    this.cache.set(name, people);
    return people;
  }
  configure(name) {
    this.people = this.paths(name);
    this.root.visible = this.people.length > 0;
  }
  update(time, bursts = []) {
    if (!this.root.visible) return;
    const actor = this.actor;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      const length = Math.hypot(p.bx - p.ax, p.bz - p.az);
      let boost = 0,
        reacting = false;
      for (const burst of bursts) {
        if (Math.hypot(p.ax - burst.position[0], p.az - burst.position[2]) > 22) continue;
        const age = time - burst.at;
        boost += Math.max(0, Math.min(age, 2.5)) * p.speed * 1.9;
        reacting ||= age > 0 && age < 2.5;
      }
      const phase = ((time * p.speed + boost + p.phase) / length) % 2;
      const u = p.idle ? 0.5 : phase < 1 ? phase : 2 - phase;
      actor.userData.phase = p.phase;
      actor.scale.setScalar(0.93 + (i % 5) * 0.035);
      animateHuman(
        actor,
        time,
        reacting ? 1 : p.idle ? 0 : 0.75,
        p.idle && !reacting ? 'phone' : 'walk',
      );
      actor.position.x = THREE.MathUtils.lerp(p.ax, p.bx, u);
      actor.position.z = THREE.MathUtils.lerp(p.az, p.bz, u);
      actor.position.y += 0.09;
      actor.rotation.y = Math.atan2(p.bx - p.ax, p.bz - p.az) + (phase < 1 ? 0 : Math.PI);
      if (reacting) {
        actor.userData.rig.leftArm.rotation.x = -1.8;
        actor.userData.rig.rightArm.rotation.x = -1.7;
      }
      actor.updateMatrixWorld(true);
      for (const batch of this.batches)
        for (let j = 0; j < batch.parts.length; j++)
          batch.mesh.setMatrixAt(i * batch.parts.length + j, batch.parts[j].matrixWorld);
    }
    for (const batch of this.batches) {
      batch.mesh.count = this.people.length * batch.parts.length;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export class IntroStage {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.root = new THREE.Group();
    this.root.name = 'Intro · isolated action set';
    this.root.userData.dynamic = true;
    this.w.groups.city.add(this.root);
    this.hero = this.w.car(this.root, 'car', '#983c32');
    this.police = Array.from({ length: 3 }, (_, i) => {
      const mesh = this.w.car(this.root, 'car', i === 1 ? '#405262' : '#d8e0dd');
      box(mesh, 0, 1.67, 0, 0.95, 0.1, 0.26, '#263d57');
      const material = new THREE.MeshStandardMaterial({
        color: '#407ded',
        emissive: '#1673ff',
        emissiveIntensity: 3,
        roughness: 0.25,
      });
      const lights = [-0.32, 0.32].map((x) =>
        box(mesh, x, 1.78, 0, 0.2, 0.12, 0.2, material.clone(), false),
      );
      for (const side of [-1, 1])
        label(mesh, 'POLIZEI', side * 0.85, 0.93, 0, 1.45, 0.29, {
          bg: '#244e73',
          fg: '#ffffff',
          rotation: (side * Math.PI) / 2,
        });
      return { mesh, lights };
    });
    this.heli = createHelicopter(THREE);
    this.root.add(this.heli);
    this.crowd = new IntroCrowd(this.w, this.root);
    // Constant unshadowed light budget, present before warm-up. Intensity changes never compile shaders.
    this.floods = Array.from({ length: 2 }, () => {
      const light = new THREE.SpotLight('#ffe3b2', 0, 110, 1.08, 0.85, 1.4);
      light.castShadow = false;
      light.visible = false;
      this.w.scene.add(light, light.target);
      return light;
    });
    this.flash = new THREE.PointLight('#ff9f4d', 0, 28, 1.3);
    this.flash.visible = false;
    this.w.scene.add(this.flash);
    this.focus = new THREE.Vector3();
    this.lastBurst = -100;
    this.headlightCar = { mesh: this.hero, type: 'car', headlights: true, length: 4.4 };
    this.root.visible = false;
  }
  capture() {
    this.trafficVisibility = new Map(this.w.cars.map((car) => [car.mesh, car.mesh.visible]));
  }
  maskTraffic() {
    const s = this.shot;
    for (const [mesh, visible] of this.trafficVisibility || []) {
      const p = mesh.position;
      const corridor =
        s?.stage &&
        (s.stage === 'rain-chase'
          ? Math.abs(p.x) < 9 && p.z > 12 && p.z < 120
          : p.x > 30 && p.x < 178 && p.z > 33 && p.z < 47);
      mesh.visible = visible && !corridor;
    }
  }
  configure(shot) {
    this.shot = shot;
    document.body.classList.toggle('intro-night', shot.zone === 'city' && shot.minutes >= 1140);
    document.body.classList.toggle('intro-prologue', !!shot.prologue);
    this.flash.visible = true;
    for (const light of this.floods) light.visible = true;
    this.lastBurst = -100;
    this.root.visible = shot.zone === 'city';
    this.crowd.configure(shot.crowd);
    this.hero.visible = !!shot.stage;
    this.police.forEach((p) => (p.mesh.visible = !!shot.stage));
    this.heli.visible = shot.stage === 'heli';
    this.focus.fromArray(shot.look);
    this.w.cinematicFocus = this.focus;
    this.flash.intensity = 0;
  }
  update(t, dt) {
    const s = this.shot;
    if (!s) return;
    const time = t - s.at,
      u = THREE.MathUtils.clamp(time / (s.end - s.at), 0, 1);
    this.crowd.update(time, s.bursts);
    if (s.stage) {
      const rain = s.stage === 'rain-chase',
        west = s.stage === 'police';
      const x = rain ? -3.8 : west ? 99 - u * 49 : s.stage === 'heli' ? 110 + u * 30 : 68 + u * 33;
      const z = rain ? 78 - u * 58 : west ? 38.2 : 41.7;
      const yaw = rain ? Math.PI : west ? -Math.PI / 2 : Math.PI / 2;
      this.hero.position.set(x, 0, z);
      this.hero.rotation.y = yaw;
      animateVehicleWheels(this.headlightCar, 12, dt, Math.sin(time * 1.6) * 0.035);
      this.police.forEach((p, i) => {
        p.mesh.position.set(
          x + (rain ? (i === 1 ? 3.6 : 0) : (west ? 1 : -1) * (9 + i * 8)),
          0,
          z + (rain ? 10 + i * 9 : 0),
        );
        p.mesh.rotation.y = yaw;
        animateVehicleWheels({ mesh: p.mesh }, 12, dt, Math.sin(time * 1.6 + i) * 0.03);
        p.lights.forEach(
          (light, j) =>
            (light.material.emissiveIntensity =
              1.2 + 2.8 * (Math.sin(t * 12 + i + j * Math.PI) > 0.3)),
        );
      });
      this.heli.position.set(112 + u * 37, 16 + Math.sin(u * Math.PI) * 2, 38);
      this.heli.rotation.set(0.03, Math.PI / 2, -0.06);
      this.heli.userData.mainRotor.rotation.y = t * 42;
      this.heli.userData.tailRotor.rotation.x = t * 57;
      this.focus.copy(s.stage === 'heli' ? this.heli.position : this.hero.position);
      this.focus.y += 1.2;
    }
  }
  burst(position, t) {
    this.flash.position.fromArray(position);
    this.flash.position.y += 2;
    this.lastBurst = t;
  }
  light(t) {
    const s = this.shot,
      w = this.w;
    if (!s) return;
    if (s.prologue) {
      w.renderer.toneMappingExposure = 0.23;
      w.scene.environmentIntensity = 0.035;
      w.ambient.color.set('#3d5068');
      w.ambient.groundColor.set('#080d16');
      w.fill.color.set('#6a829b');
      w.ambient.intensity = 0.07;
      w.fill.intensity = 0.03;
      w.sun.intensity = 0.025;
      w.scene.background.set('#02050b');
      const sky = this.g.arcade.atmosphere.sky.material.uniforms;
      sky.top.value.set('#010308');
      sky.bottom.value.set('#060b14');
      w.scene.fog.color.copy(w.scene.background);
      w.scene.fog.density = 0.0018;
      for (const light of this.floods) light.intensity = 0;
      this.flash.intensity = 0;
      this.g.arcade.vehicleLighting?.update(null);
      return;
    }
    const night = s.zone === 'city' && s.minutes >= 1140;
    w.renderer.toneMappingExposure = night ? 1.2 : this.g.extras.intro.restore.exposure;
    w.scene.environmentIntensity = night ? 0.7 : this.g.extras.intro.restore.environment;
    w.ambient.color.set(night ? '#9fcbdc' : '#b5d7e2');
    w.ambient.groundColor.set(night ? '#657e84' : '#8d7258');
    w.fill.color.set(night ? '#a6c8ec' : '#ffe2bc');
    if (night) {
      w.ambient.intensity = Math.max(w.ambient.intensity, 0.72);
      w.fill.intensity = Math.max(w.fill.intensity, 0.65);
      w.scene.fog.density = Math.min(w.scene.fog.density, s.rain ? 0.0032 : 0.0018);
    }
    for (let i = 0; i < this.floods.length; i++) {
      const light = this.floods[i],
        sign = i ? 1 : -1;
      light.position.set(this.focus.x + sign * 18, this.focus.y + 20, this.focus.z + 24);
      light.target.position.copy(this.focus);
      light.intensity = night ? (s.stage ? 100 : 340) : 0;
    }
    const flashAge = t - this.lastBurst;
    this.flash.intensity =
      flashAge >= 0 && flashAge < 0.65 ? 260 * Math.pow(1 - flashAge / 0.65, 2) : 0;
    this.g.arcade.vehicleLighting?.update(s.stage ? this.headlightCar : null);
  }
  warm() {
    this.flash.visible = true;
    for (const light of this.floods) light.visible = true;
    this.root.visible = true;
    this.hero.visible = this.heli.visible = true;
    this.police.forEach((p) => (p.mesh.visible = true));
    this.crowd.configure('augusten');
    this.crowd.update(0);
  }
  hide() {
    for (const [mesh, visible] of this.trafficVisibility || []) mesh.visible = visible;
    this.trafficVisibility = null;
    this.root.visible = false;
    this.shot = null;
    for (const light of this.floods) {
      light.intensity = 0;
      light.visible = false;
    }
    this.flash.intensity = 0;
    this.flash.visible = false;
    document.body.classList.remove('intro-night');
    this.w.cinematicFocus = null;
    this.g.arcade.vehicleLighting?.update(null);
  }
}
