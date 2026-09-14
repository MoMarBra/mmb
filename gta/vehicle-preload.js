import * as THREE from 'three';

function lightKey(lights, shadows) {
  const counts = {};
  for (const light of lights) {
    const type = light.type + (light.castShadow ? ':shadow' : '');
    counts[type] = (counts[type] || 0) + 1;
  }
  return JSON.stringify(Object.entries(counts).sort()) + ':' + shadows;
}
function belongsTo(node, group) {
  for (let parent = node.parent; parent; parent = parent.parent) if (parent === group) return true;
  return false;
}
function visible(node) {
  for (let parent = node; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

// The traffic batch and an interactive car need distinct GPU shader variants.
// Prepare both daylight and lit-street variants behind the welcome screen,
// without revealing or moving the city, a vehicle, or any real scene light.
export class VehiclePreload {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'Vehicle shader preparation';
    this.lights = [];
    this.keys = new Set();
    this.pending = null;
    this.error = null;
    const seen = new Set();
    const collect = (source) => {
      if (!source.isMesh || source.isInstancedMesh || Array.isArray(source.material)) return;
      const key =
        source.material.uuid +
        ':' +
        Object.keys(source.geometry.attributes).join(',') +
        ':' +
        source.receiveShadow;
      if (seen.has(key)) return;
      seen.add(key);
      const mesh = new THREE.Mesh(source.geometry, source.material);
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      this.group.add(mesh);
    };
    for (const car of world.cars) {
      if (!['bike', 'helicopter'].includes(car.type)) car.mesh.traverse(collect);
    }
    world.player.traverse(collect);
    world.scene.traverse((node) => {
      if (node.isLight) this.lights.push(node);
    });
    if (!world.renderer.compileAsync) return;
    const prepareCity = (streetLights) => {
      const target = new THREE.Scene();
      target.fog = world.scene.fog;
      target.environment = world.scene.environment;
      target.environmentIntensity = world.scene.environmentIntensity;
      const lights = this.lights.filter(
        (light) =>
          !belongsTo(light, world.groups.office) &&
          (streetLights || !belongsTo(light, world.groups.city)),
      );
      for (const source of lights) {
        const light = source.clone();
        light.visible = true;
        target.add(light);
      }
      return this.prepare(target, lightKey(lights, world.renderer.shadowMap.enabled));
    };
    this.pending = prepareCity(false)
      .then(() => prepareCity(true))
      .finally(() => {
        this.pending = null;
      });
  }

  prepare(scene, key) {
    if (this.keys.has(key)) return Promise.resolve();
    this.keys.add(key);
    try {
      return Promise.resolve(
        this.world.renderer.compileAsync(this.group, this.world.camera, scene),
      ).catch((error) => {
        this.error = error;
      });
    } catch (error) {
      this.error = error;
      return Promise.resolve();
    }
  }

  update() {
    const { world } = this;
    if (world.zone !== 'city' || this.pending || !world.renderer.compileAsync) return;
    const key = lightKey(this.lights.filter(visible), world.renderer.shadowMap.enabled);
    if (this.keys.has(key)) return;
    this.pending = this.prepare(world.scene, key).finally(() => {
      this.pending = null;
    });
  }
}
