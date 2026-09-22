import * as THREE from 'three';
import { createUmbrella } from './aaa-props.js';
export class WeatherEffects {
  constructor(d) {
    this.d = d;
    this.w = d.world;
    this.g = d.game;
    this.wet = this.g.sim.s.wetness || 0;
    this.cloud = 0;
    this.frames = 0;
    this.reflectionTime = 0;
    this.reflectionReady = false;
    this.lastReflectionPosition = new THREE.Vector3(Infinity, 0, 0);
    this.lastReflectionRotation = new THREE.Quaternion();
    this.overcast = new THREE.Color('#879eaa');
    this.puddles = new THREE.Group();
    this.w.groups.city.add(this.puddles);
    this.reflectionCamera = new THREE.PerspectiveCamera();
    this.target = new THREE.WebGLRenderTarget(384, 384);
    this.textureMatrix = new THREE.Matrix4();
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        reflection: { value: this.target.texture },
        textureMatrix: { value: this.textureMatrix },
        wet: { value: 0 },
        reflectionReady: { value: 0 },
      },
      vertexShader:
        'uniform mat4 textureMatrix;varying vec4 reflectCoord;varying vec2 vUv;void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.0);reflectCoord=textureMatrix*wp;gl_Position=projectionMatrix*viewMatrix*wp;}',
      fragmentShader:
        'uniform sampler2D reflection;uniform float wet;uniform float reflectionReady;varying vec4 reflectCoord;varying vec2 vUv;void main(){vec2 q=vUv*2.0-1.0;float edge=1.0-smoothstep(.65,1.0,length(q));vec4 r=texture2DProj(reflection,reflectCoord);vec3 sky=vec3(.22,.31,.34);gl_FragColor=vec4(mix(sky,r.rgb,.72*reflectionReady),edge*wet*.58);}',
    });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + (i % 3), 5 + (i % 4)), this.material);
      m.rotation.x = -Math.PI / 2;
      m.position.set((i % 2 ? -1 : 1) * (1.4 + (i % 3)), 0.12, -132 + i * 12);
      this.puddles.add(m);
    }
    this.parasols = [];
    for (const [x, z] of [
      [-18, 29],
      [15, -67],
      [15, -88],
    ]) {
      const umbrella = createUmbrella(THREE);
      umbrella.position.set(x, 0, z);
      umbrella.scale.setScalar(2.7);
      this.w.groups.city.add(umbrella);
      this.parasols.push(umbrella);
    }
    const positions = new Float32Array(200 * 6);
    for (let i = 0; i < 200; i++) {
      const k = i * 6,
        x = Math.random() * 48 - 24,
        y = Math.random() * 26,
        z = Math.random() * 48 - 24;
      positions.set([x, y, z, x + 0.06, y + 0.62, z], k);
    }
    this.rainStreaks = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
      new THREE.LineBasicMaterial({
        color: '#d7e7ef',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.w.groups.city.add(this.rainStreaks);
    this.rainStreaks.geometry.computeBoundingSphere();
    this.dust = new THREE.Group();
    this.w.groups.city.add(this.dust);
    this.dustBits = [];
    const geo = new THREE.PlaneGeometry(0.23, 0.3),
      mat = new THREE.MeshBasicMaterial({
        color: '#d7c9a3',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
    for (let i = 0; i < 45; i++) {
      const m = new THREE.Mesh(geo, mat);
      this.dust.add(m);
      this.dustBits.push(m);
    }
  }
  update(dt) {
    const rainy = this.g.sim.s.weather === 'Regen',
      w = this.w;
    this.wet = THREE.MathUtils.damp(this.wet, rainy ? 1 : 0, rainy ? 0.22 : 0.018, dt);
    this.g.sim.s.wetness = this.wet;
    this.cloud = THREE.MathUtils.damp(this.cloud, rainy ? 1 : 0, 0.16, dt);
    this.material.uniforms.wet.value = this.wet;
    const street = w.streetNetwork;
    if (street?.roadMesh?.material.userData.remasterSurface) {
      street.roadMesh.material.roughness = THREE.MathUtils.lerp(0.96, 0.32, this.wet);
      street.roadMesh.material.color.setScalar(1 - this.wet * 0.2);
      street.pavementMesh.material.roughness = THREE.MathUtils.lerp(0.93, 0.48, this.wet);
    }
    this.rainStreaks.visible = w.zone === 'city' && this.cloud > 0.02;
    this.rainStreaks.material.opacity = this.cloud * 0.48;
    this.rainStreaks.position.copy(w.player.position);
    if (this.rainStreaks.visible && dt > 0) {
      const a = this.rainStreaks.geometry.attributes.position;
      for (let i = 0; i < 200; i++) {
        const k = i * 6;
        let y = a.array[k + 1] - dt * 18;
        if (y < 0) y += 26;
        a.array[k + 1] = y;
        a.array[k + 4] = y + 0.62;
      }
      a.needsUpdate = true;
    }
    w.rain.position.y = w.player.position.y;
    w.rain.material.opacity = 0.25 + 0.35 * this.cloud;
    for (const u of this.parasols) {
      u.userData.canopy?.scale.set(
        1 - this.cloud * 0.88,
        1 + this.cloud * 0.4,
        1 - this.cloud * 0.88,
      );
    }
    if (w.zone === 'city') {
      w.scene.background.lerp(this.overcast, this.cloud);
      w.scene.fog.color.copy(w.scene.background);
      w.scene.fog.density = THREE.MathUtils.lerp(0.0018, 0.006, this.cloud);
    } else if (rainy) {
      this.g.audio.requestLoop?.(
        'window-rain',
        'aaa_rain_on_glass',
        w.zone === 'office' && w.player.position.x > 44 ? 0.006 : 0.13,
        { bus: 'ambience', lowpass: 4500 },
      );
    }
    const garage = w.zone === 'office' && w.player.position.x > 44;
    if (garage) {
      w.sun.intensity = 0.3;
      w.ambient.intensity = 0.55;
      w.fill.intensity = 0.15;
    }
    this.puddles.visible = w.zone === 'city' && this.wet > 0.015;
    const car = this.d.arcade.vehicle;
    this.dust.visible =
      w.zone === 'city' &&
      car?.type === 'helicopter' &&
      car.mesh.position.y < 20 &&
      car.rotorSpeed > 0.6;
    if (this.dust.visible) {
      const t = this.d.time,
        cp = car.mesh.position;
      this.dustBits.forEach((m, i) => {
        const a = i * 2.4 + t * 2,
          r = 2 + (i % 9) * 0.6;
        m.position.set(
          cp.x + Math.sin(a) * r,
          0.12 + (Math.sin(i + t * 3) * 0.5 + 0.5) * Math.max(0.2, 2 - cp.y * 0.08),
          cp.z + Math.cos(a) * r,
        );
        m.rotation.set(t * 2 + i, t + i, t * 4);
      });
    }
    this.reflectionTime += dt;
    const closeToWater =
      this.puddles.visible &&
      Math.abs(w.player.position.x) < 27 &&
      w.player.position.z > -155 &&
      w.player.position.z < 149 &&
      w.player.position.y < 9;
    const moved =
      this.lastReflectionPosition.distanceToSquared(w.camera.position) > 0.03 ||
      this.lastReflectionRotation.angleTo(w.camera.quaternion) > 0.012;
    this.material.uniforms.reflectionReady.value = this.reflectionReady && !w.lowQuality ? 1 : 0;
    if (
      dt > 0 &&
      closeToWater &&
      !w.lowQuality &&
      this.reflectionTime > (this.g.extras?.intro.current ? 0.6 : 0.3) &&
      (!this.reflectionReady || moved || this.reflectionTime > 1.2) &&
      typeof w.renderer.getRenderTarget === 'function'
    ) {
      this.reflect();
      this.reflectionTime = 0;
      this.reflectionReady = true;
      this.lastReflectionPosition.copy(w.camera.position);
      this.lastReflectionRotation.copy(w.camera.quaternion);
    }
  }
  reflect() {
    const w = this.w,
      r = w.renderer,
      c = this.reflectionCamera,
      source = w.camera;
    c.copy(source);
    c.position.copy(source.position);
    c.position.y = 0.24 - source.position.y;
    const target = new THREE.Vector3();
    source.getWorldDirection(target);
    target.add(source.position);
    target.y = 0.24 - target.y;
    c.up.set(0, -1, 0);
    c.lookAt(target);
    c.updateMatrixWorld();
    c.far = 180;
    c.updateProjectionMatrix();
    this.textureMatrix
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(c.projectionMatrix)
      .multiply(c.matrixWorldInverse);
    const old = r.getRenderTarget(),
      planes = r.clippingPlanes,
      auto = r.shadowMap.autoUpdate;
    const needsUpdate = r.shadowMap.needsUpdate;
    // Keep the sky and sun inside the short reflection frustum without rendering distant city blocks.
    const atmosphere = this.d.arcade.atmosphere;
    const skyScale = atmosphere?.sky.scale.clone(),
      sunPosition = atmosphere?.sunDisc.position.clone(),
      glowScale = atmosphere?.glow.scale.clone();
    if (atmosphere) {
      atmosphere.sky.scale.setScalar(0.15);
      atmosphere.sunDisc.position
        .copy(source.position)
        .addScaledVector(atmosphere.sunDirection, 100);
      atmosphere.sunDisc.scale.setScalar(100 / 210);
      atmosphere.glow.position.copy(atmosphere.sunDisc.position);
      atmosphere.glow.scale.multiplyScalar(100 / 210);
    }
    this.puddles.visible = false;
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14)];
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = false;
    try {
      r.setRenderTarget(this.target);
      r.clear();
      r.render(w.scene, c);
    } finally {
      r.setRenderTarget(old);
      r.clippingPlanes = planes;
      r.shadowMap.autoUpdate = auto;
      r.shadowMap.needsUpdate = needsUpdate;
      if (atmosphere) {
        atmosphere.sky.scale.copy(skyScale);
        atmosphere.sunDisc.position.copy(sunPosition);
        atmosphere.sunDisc.scale.setScalar(1);
        atmosphere.glow.position.copy(sunPosition);
        atmosphere.glow.scale.copy(glowScale);
      }
      this.puddles.visible = true;
    }
  }
}
