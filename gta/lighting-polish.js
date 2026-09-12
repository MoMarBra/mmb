import * as THREE from 'three';

export class LocalLighting {
  constructor(world) {
    this.w = world;
    this.lamps = world.streetLamps || [];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'),
      g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,218,156,.25)');
    g.addColorStop(0.45, 'rgba(255,210,140,.12)');
    g.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.poolMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const geometry = new THREE.PlaneGeometry(11, 11);
    const pools = new THREE.InstancedMesh(geometry, this.poolMaterial, this.lamps.length),
      transform = new THREE.Object3D();
    this.lamps.forEach((lamp, i) => {
      transform.rotation.x = -Math.PI / 2;
      transform.position.set(lamp.x, 0.105, lamp.z);
      transform.updateMatrix();
      pools.setMatrixAt(i, transform.matrix);
    });
    pools.computeBoundingSphere();
    world.groups.city.add(pools);
    // Bounded light budget: two nearest real lights illuminate people, cars and street materials.
    this.streetLights = Array.from({ length: 2 }, () => {
      const light = new THREE.SpotLight('#ffe0af', 0, 17, 0.95, 0.72, 2);
      light.castShadow = false;
      world.groups.city.add(light, light.target);
      return light;
    });
    for (const [x, y, z, intensity, distance] of [
      [34, 2.85, 24.3, 18, 10],
      [34, 3.05, 0, 13, 12],
      [57, 3.4, 37, 22, 17],
    ]) {
      const light = new THREE.PointLight('#f2edda', intensity, distance, 2);
      light.position.set(x, y, z);
      world.groups.office.add(light);
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, 0.35),
        new THREE.MeshStandardMaterial({
          color: '#f5efe1',
          emissive: '#fff2d3',
          emissiveIntensity: 1.3,
        }),
      );
      fixture.position.set(x, y + 0.15, z);
      world.groups.office.add(fixture);
    }
  }
  update(day) {
    const w = this.w,
      night = 1 - THREE.MathUtils.smoothstep(day, 0.12, 0.52);
    this.poolMaterial.opacity = night;
    for (const lamp of this.lamps) lamp.material.emissiveIntensity = 0.035 + night * 1.7;
    this.interiorLights ||= w.groups.office.children.filter((o) => o.isPointLight);
    for (const light of this.interiorLights) {
      const range = light.distance + 4;
      light.visible =
        w.zone === 'office' &&
        Math.hypot(light.position.x - w.player.position.x, light.position.z - w.player.position.z) <
          range;
    }
    for (const light of this.streetLights) light.visible = w.zone === 'city' && night > 0.001;
    if (w.zone !== 'city') return;
    const p = w.player.position;
    const nearest = this.lamps
      .map((lamp) => ({ lamp, d: Math.hypot(lamp.x - p.x, lamp.z - p.z) }))
      .sort((a, b) => a.d - b.d);
    this.streetLights.forEach((light, i) => {
      const found = nearest[i];
      if (!found) {
        light.intensity = 0;
        return;
      }
      light.position.set(found.lamp.x, 5.07, found.lamp.z);
      light.target.position.set(found.lamp.x, 0, found.lamp.z);
      light.intensity = 75 * night * (1 - THREE.MathUtils.smoothstep(found.d, 23, 34));
    });
  }
}
