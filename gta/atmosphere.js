import { LocalLighting } from './lighting-polish.js';
import * as THREE from 'three';
import { clamp } from './data.js';

export class Atmosphere {
  constructor(world) {
    this.world = world;
    this.localLights = new LocalLighting(world);
    this.overcastTop = new THREE.Color('#688793');
    this.overcastBottom = new THREE.Color('#b2c0c4');
    this.sunDirection = new THREE.Vector3();
    world.renderer.toneMappingExposure = 1.08;
    world.scene.environmentIntensity = 0.58;
    world.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(world.sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28 });
    world.sun.shadow.camera.updateProjectionMatrix();
    world.sun.shadow.normalBias = 0.02;
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(850, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color('#368dd0') },
          bottom: { value: new THREE.Color('#d9e5eb') },
          photo: { value: null },
          photoReady: { value: 0 },
          photoBlend: { value: 0 },
        },
        vertexShader:
          'varying vec3 vDirection; void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
        fragmentShader: `uniform vec3 top;uniform vec3 bottom;uniform sampler2D photo;uniform float photoReady;uniform float photoBlend;varying vec3 vDirection;void main(){
vec3 dir=normalize(vDirection);float h=pow(clamp(dir.y*.8+.12,0.,1.),.55);vec3 color=mix(bottom,top,h);
vec2 uv=vec2(atan(dir.z,dir.x)*0.159154943+0.5,asin(clamp(dir.y,-1.,1.))*0.318309886+0.5);
float lightGate=smoothstep(.02,.13,dot(top,vec3(.2126,.7152,.0722)));
vec3 hdr=texture2D(photo,uv).rgb*.68;
color=mix(color,hdr,photoReady*photoBlend*lightGate);gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    world.scene.add(this.sky);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,239,184,1)');
    grad.addColorStop(0.13, 'rgba(255,210,118,.7)');
    grad.addColorStop(0.4, 'rgba(255,211,151,.17)');
    grad.addColorStop(1, 'rgba(255,223,171,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glow.scale.set(48, 48, 1);
    world.scene.add(this.glow);
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(3, 20, 16),
      new THREE.MeshBasicMaterial({ color: '#fff0b1', toneMapped: false }),
    );
    world.scene.add(this.sunDisc);
    this.clouds = new THREE.Group();
    world.scene.add(this.clouds);
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 128;
    const cc = cloudCanvas.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 35 + i * 22,
        y = 64 + Math.sin(i * 2) * 16,
        r = 25 + Math.sin(i) * 9;
      const g = cc.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(255,248,230,.5)');
      g.addColorStop(1, 'rgba(255,248,230,0)');
      cc.fillStyle = g;
      cc.fillRect(0, 0, 256, 128);
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 13; i++) {
      const cloud = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: cloudTexture,
          transparent: true,
          depthWrite: false,
          opacity: 0.55,
        }),
      );
      cloud.position.set(Math.sin(i * 2.4) * 160, 42 + (i % 4) * 12, Math.cos(i * 2.4) * 160);
      cloud.scale.set(70, 26, 1);
      this.clouds.add(cloud);
    }
    const rim = new THREE.PointLight('#ffce82', 5, 15, 2);
    rim.position.set(-8, 3, -7);
    world.groups.office.add(rim);
    const kitchen = new THREE.PointLight('#ffe3b3', 4, 10, 2);
    kitchen.position.set(8, 2.7, 6);
    world.groups.office.add(kitchen);
    const overlay = document.createElement('div');
    overlay.className = 'cinema-vignette';
    document.body.append(overlay);
  }
  update(dt) {
    const w = this.world,
      city = w.zone === 'city',
      rain = w.sim.s.weather === 'Regen',
      cloud = w.gameplay?.immersion?.weather.cloud || 0;
    const day = clamp(Math.sin(((w.sim.s.minutes - 360) / 1440) * Math.PI * 2) * 1.4, 0.06, 1);
    const warm = day < 0.8;
    this.localLights.update(day);
    w.sun.color.set(warm ? '#ffe0b8' : '#fff6e9');
    w.sun.intensity = (city ? 3.15 * day : 2.9) * (1 - cloud * 0.57);
    w.ambient.intensity = city ? 0.28 + day * 0.55 : 0.9;
    w.scene.environmentIntensity = city ? 0.08 + day * 0.53 : 0.48;
    w.fill.intensity = city ? 0.32 : 0.48;
    w.scene.fog.density = city ? 0.0018 + cloud * 0.0042 : 0.004;
    if (city) {
      const altitude = Math.max(0, w.player.position.y),
        span = 45 + Math.ceil(altitude / 10) * 5;
      w.sun.position.set(
        w.player.position.x - 36,
        24 + day * 20 + altitude,
        w.player.position.z + 18,
      );
      // Snap the shadow target in the light camera's own horizontal/vertical axes.
      // This prevents sub-texel shimmer while the player/car moves through the world.
      const direction = new THREE.Vector3(-36, 24 + day * 20, 18).normalize();
      const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), direction)
        .normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const target = new THREE.Vector3(
        w.player.position.x,
        Math.round(altitude / 2) * 2,
        w.player.position.z,
      );
      const texel = (span * 2) / w.sun.shadow.mapSize.x;
      const x = target.dot(right),
        y = target.dot(up);
      target
        .addScaledVector(right, Math.round(x / texel) * texel - x)
        .addScaledVector(up, Math.round(y / texel) * texel - y);
      w.sun.target.position.copy(target);
      w.sun.position.copy(target).add(new THREE.Vector3(-36, 24 + day * 20, 18));
      Object.assign(w.sun.shadow.camera, {
        left: -span,
        right: span,
        top: span,
        bottom: -span,
        far: 300,
      });
      if (this.shadowSpan !== span) {
        w.sun.shadow.camera.updateProjectionMatrix();
        this.shadowSpan = span;
      }
    } else {
      Object.assign(w.sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 180 });
      if (this.shadowSpan !== -1) {
        w.sun.shadow.camera.updateProjectionMatrix();
        this.shadowSpan = -1;
      }
      const annex = Math.abs(w.player.position.x) > 22;
      w.sun.position.set(
        (annex ? w.player.position.x : 0) - 16,
        20,
        (annex ? w.player.position.z : 0) - 9,
      );
      w.sun.target.position.set(
        annex ? w.player.position.x : 0,
        0,
        annex ? w.player.position.z : 0,
      );
    }
    const uniforms = this.sky.material.uniforms;
    if (w.remaster?.skyTexture && !uniforms.photoReady.value) {
      uniforms.photo.value = w.remaster.skyTexture;
      uniforms.photoReady.value = 1;
    }
    uniforms.photoBlend.value = THREE.MathUtils.smoothstep(day, 0.25, 0.82) * (1 - cloud * 0.84);
    this.sky.position.copy(w.camera.position);
    this.sky.visible = city;
    this.sky.material.uniforms.top.value
      .set(day < 0.25 ? '#122b49' : '#7da8c4')
      .lerp(this.overcastTop, cloud);
    this.sky.material.uniforms.bottom.value.set(
      day < 0.25 ? '#514e5f' : warm ? '#e7d6be' : '#c9dce5',
    );
    this.sky.material.uniforms.bottom.value.lerp(this.overcastBottom, cloud);
    const direction = this.sunDirection.copy(w.sun.position).sub(w.sun.target.position).normalize();
    this.sunDisc.position.copy(w.camera.position).addScaledVector(direction, 210);
    this.glow.position.copy(this.sunDisc.position);
    this.sunDisc.visible = this.glow.visible = city && cloud < 0.82 && day > 0.12;
    this.clouds.visible = city && (!uniforms.photoReady.value || cloud > 0.55);
    this.clouds.position.set(w.camera.position.x, 0, w.camera.position.z);
    this.clouds.rotation.y += dt * 0.002;
    for (const c of this.clouds.children) c.material.opacity = day * (0.55 + cloud * 0.25);
  }
}
