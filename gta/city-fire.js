import * as THREE from 'three';
import { EXTRA_PLACES, BOMB_PRICE } from './extras-state.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
// All explosions, smoke plumes and fires share two fixed GPU particle buffers.
// No explosion adds a light or changes the scene's shader-light budget.
export class CityFire {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.a = game.arcade;
    this.sources = [];
    this.projectiles = [];
    this.particles = [];
    this.clock = 0;
    this.next = 0;
    this.events = 0;
    this.root = new THREE.Group();
    this.root.name = 'City fire · bounded effects';
    this.root.userData.dynamic = true;
    this.w.groups.city.add(this.root);
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(1200 * 3);
    this.colors = new Float32Array(1200 * 3);
    this.sizes = new Float32Array(1200);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'size',
      new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: {},
      vertexShader:
        'attribute float size; varying vec3 vColor; varying float vAlpha; void main(){vColor=color;vAlpha=size>0.0?1.0:0.0;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(abs(size)*420.0/max(1.0,-p.z),1.0,180.0);}',
      fragmentShader:
        'varying vec3 vColor; varying float vAlpha; void main(){float d=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.1,1.,d))*.65*vAlpha;if(a<.01)discard;gl_FragColor=vec4(vColor,a);}',
      toneMapped: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.geometry.setDrawRange(0, 0);
    this.root.add(this.points);
    this.bombGeometry = new THREE.CapsuleGeometry(0.105, 0.29, 4, 10);
    this.bombMaterial = new THREE.MeshStandardMaterial({ color: '#c39453', roughness: 0.88 });
    this.foilMaterial = new THREE.MeshStandardMaterial({
      color: '#b9b9b0',
      metalness: 0.65,
      roughness: 0.37,
    });
    this.ray = new THREE.Raycaster();
    this.up = V(0, 1, 0);
    for (const car of this.w.cars) {
      const s = this.g.sim.s.vehicleDamage?.[car.id];
      if (Number.isFinite(s?.health) && s.health < 100) {
        this.a.immersion.vehicles.detail(car);
        if (s.health <= 0) this.wreck(car, false);
      }
    }
  }
  get state() {
    return this.g.sim.s.extras;
  }
  canThrow() {
    return (
      this.g.started &&
      !this.g.modal &&
      !this.g.busy &&
      !this.g.cinematic &&
      !this.g.fireStory.running &&
      !this.a.vehicle &&
      this.w.zone === 'city' &&
      !this.a.immersion.physics.held &&
      !this.g.sim.s.courier.active &&
      !this.g.workshop.active
    );
  }
  throwBomb() {
    if (!this.canThrow()) {
      this.g.toast('BurritoBombe · Zu Fuß draußen werfen.');
      return false;
    }
    if (!this.state.bombs) {
      this.g.toast('Keine BurritoBomben mehr.', 'Nachschub bei Dogtown.');
      return false;
    }
    if (this.clock < this.next || this.projectiles.length >= 4) return false;
    this.next = this.clock + 0.75;
    this.state.bombs--;
    this.state.bombsThrown++;
    const mesh = new THREE.Group(),
      wrap = new THREE.Mesh(this.bombGeometry, this.bombMaterial),
      foil = new THREE.Mesh(this.bombGeometry, this.foilMaterial);
    foil.scale.set(1.03, 0.45, 1.03);
    foil.position.y = -0.1;
    mesh.add(wrap, foil);
    mesh.rotation.z = 1.3;
    mesh.position.copy(this.w.player.position).add(V(0, 1.3, 0));
    const direction = V(-Math.sin(this.w.yaw), 0.38, -Math.cos(this.w.yaw)).normalize();
    mesh.position.addScaledVector(direction, 0.65);
    this.root.add(mesh);
    this.projectiles.push({ mesh, velocity: direction.multiplyScalar(11), fuse: 2.25 });
    this.a.punchTime = 0.34;
    this.g.audio.play('swing');
    this.g.toast('BurritoBombe', this.state.bombs + ' im Rucksack');
    this.g.sim.save();
    return true;
  }
  buyBomb() {
    if (this.state.bombs >= 30) {
      this.g.toast('Rucksack voll · 30 BurritoBomben.');
      return false;
    }
    if (this.g.sim.s.money < BOMB_PRICE) {
      this.g.toast('Das Budget reicht noch nicht.');
      return false;
    }
    this.g.sim.transaction(-BOMB_PRICE, 'Dogtown · BurritoBombe');
    this.state.bombs++;
    this.g.sim.save();
    this.g.toast('BurritoBombe eingepackt.', 'B · Werfen, sobald du draußen bist.');
    return true;
  }
  addParticle(p, color, size, life, velocity = V()) {
    if (this.particles.length >= 1200) return;
    this.particles.push({
      p: p.clone(),
      v: velocity.clone(),
      c: new THREE.Color(color),
      size,
      life,
      max: life,
    });
  }
  ignite(position, kind = 'ground', owner = null) {
    if (this.sources.length >= 22 || this.sources.some((s) => s.p.distanceTo(position) < 2.5))
      return;
    this.sources.push({
      p: position.clone(),
      kind,
      owner,
      life: kind === 'car' ? 25 : 45,
      tick: 0,
      spread: 0,
    });
  }
  environment(position, radius = 13) {
    for (const t of this.w.treeObstacles || []) {
      const p = V(t.x, 0.2, t.z);
      if (p.distanceTo(position) < radius) this.ignite(p, 'tree');
    }
    for (const b of [...(this.w.cityBlocks || []), ...(this.w.expansionBlocks || [])]) {
      const p = V(
        clamp(position.x, b.x - b.w / 2, b.x + b.w / 2),
        0.2,
        clamp(position.z, b.z - b.d / 2, b.z + b.d / 2),
      );
      if (p.distanceTo(position) < radius) this.ignite(p, 'building');
    }
  }
  explode(position, vehicle = null, cinematic = false) {
    if (vehicle?.exploded) return;
    if (vehicle) this.wreck(vehicle, true);
    if (!cinematic) {
      this.state.explosions++;
      this.a.immersion.life.emit('shot', position, 3);
      this.environment(position);
      this.ignite(position, 'ground');
    }
    for (let i = 0; i < 70; i++) {
      const dir = V(Math.sin(i * 2.4), 0.25 + (i % 7) / 8, Math.cos(i * 2.4)).multiplyScalar(
        3 + (i % 6) * 1.5,
      );
      this.addParticle(
        position.clone().add(V(0, 0.8, 0)),
        i % 3 ? '#ff7b16' : '#fff5b0',
        0.8 + (i % 4) * 0.3,
        1.5 + (i % 5) * 0.3,
        dir,
      );
    }
    if (!cinematic)
      this.g.audio.sample('v160_explosion_' + String(1 + (this.events++ % 3)).padStart(2, '0'), {
        position,
        volume: 0.75,
      });
    this.shake = Math.max(
      this.shake || 0,
      Math.max(0, 1 - position.distanceTo(this.w.player.position) / 40) * 0.45,
    );
    if (cinematic) return;
    if (this.clock > (this.nextCrowd || 0)) {
      this.nextCrowd = this.clock + 12;
      this.g.extras.say('crowd.react');
    }
    for (const car of this.w.cars) {
      if (
        car === vehicle ||
        car.exploded ||
        !car.mesh.visible ||
        ['bike', 'helicopter'].includes(car.type)
      )
        continue;
      const d = car.mesh.position.distanceTo(position);
      if (d < 11) this.a.immersion.vehicles.damage(car, Math.max(15, 110 - d * 8), false);
    }
    for (const n of this.w.zoneData.city.npcs) {
      const d = n.mesh.position.distanceTo(position);
      if (d < 8 && !n.down)
        this.a.hitNPC(
          n,
          4,
          Math.atan2(n.mesh.position.x - position.x, n.mesh.position.z - position.z),
          Math.max(1, 7 - d),
          'explosion',
        );
    }
    const d = position.distanceTo(this.w.player.position);
    if (d < 7) {
      this.g.sim.change('health', -Math.max(5, 50 - d * 6));
    }
    this.g.sim.save();
  }
  wreck(car, notify) {
    car.exploded = true;
    car.health = 0;
    car.speed = 0;
    car.parked = true;
    car.burning = 0;
    this.a.immersion.vehicles.detail(car);
    if (this.a.vehicle === car) {
      this.a.speed = 0;
      if (!this.a.exitCar()) {
        this.a.parkForTransition();
        this.w.teleport(EXTRA_PLACES.brewery.x, EXTRA_PLACES.brewery.z);
      }
    }
    this.a.immersion.courier.ejectDestroyedCar?.(car);
    for (const m of car.glazing || []) {
      m.visible = false;
      m.userData.suppressed = true;
    }
    for (const d of car.doors || []) d.target = d.side * 0.7;
    const mats = new Map();
    car.mesh.traverse((m) => {
      if (m.isMesh && !Array.isArray(m.material)) {
        if (!mats.has(m.material)) {
          const mat = m.material.clone();
          mat.color?.multiplyScalar(0.2);
          mat.roughness = 0.98;
          mat.metalness = 0.12;
          mats.set(m.material, mat);
        }
        m.material = mats.get(m.material);
      }
    });
    this.g.sim.s.vehicleDamage[car.id] = { health: 0 };
    if (notify)
      this.g.toast('Wirtschaftlicher Totalschaden.', 'Restwert: eine sehr mutige Annahme.');
  }
  update(dt, cinematic = false) {
    if (dt <= 0) return;
    this.clock += dt;
    if (this.w.zone !== 'city') {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    if (cinematic) {
      this.updateParticles(dt);
      return;
    }
    for (const bomb of [...this.projectiles]) {
      bomb.fuse -= dt;
      bomb.velocity.y -= 9.81 * dt;
      const step = bomb.velocity.clone().multiplyScalar(dt),
        length = step.length();
      this.ray.set(bomb.mesh.position, step.clone().normalize());
      this.ray.far = length + 0.12;
      const hit = this.ray.intersectObjects(this.w.zoneData.city.obstacles, false)[0];
      if (hit) {
        bomb.mesh.position.copy(hit.point).addScaledVector(this.ray.ray.direction, -0.2);
        bomb.velocity.multiplyScalar(-0.24);
      } else bomb.mesh.position.add(step);
      if (bomb.mesh.position.y < 0.18) {
        bomb.mesh.position.y = 0.18;
        bomb.velocity.y = Math.abs(bomb.velocity.y) * 0.28;
        bomb.velocity.x *= 0.75;
        bomb.velocity.z *= 0.75;
      }
      bomb.mesh.rotation.x += dt * 7;
      if (bomb.fuse <= 0) {
        this.explode(bomb.mesh.position);
        this.root.remove(bomb.mesh);
        this.projectiles.splice(this.projectiles.indexOf(bomb), 1);
      }
    }
    for (const car of this.w.cars) {
      if (car.exploded || ['bike', 'helicopter'].includes(car.type)) continue;
      const health = car.health ?? 100;
      if (health < 45 && car.mesh.position.distanceTo(this.w.player.position) < 85) {
        car.smokeClock = (car.smokeClock || 0) + dt;
        if (car.smokeClock > 0.13) {
          car.smokeClock = 0;
          const p = car.mesh.localToWorld(V(0, 1.05, (car.length || 4.4) * 0.32));
          this.addParticle(p, '#4d4b48', 0.7, 4, V(0.12, 1.2, 0.1));
        }
      }
      if (health <= 22) {
        car.burning = (car.burning || 0) + dt;
        this.ignite(car.mesh.position, 'car', car);
        if (car.burning >= 8 || health <= 0) this.explode(car.mesh.position.clone(), car);
      }
    }
    const audible = this.sources
      .filter((s) => s.p.distanceTo(this.w.player.position) < 50)
      .sort(
        (a, b) =>
          a.p.distanceToSquared(this.w.player.position) -
          b.p.distanceToSquared(this.w.player.position),
      )
      .slice(0, 2);
    audible.forEach((s, i) =>
      this.g.audio.requestLoop?.('city-fire-' + i, 'v160_fire_loop_0' + (i + 1), 0.27, {
        position: s.p,
        bus: 'effects',
        refDistance: 4,
      }),
    );
    for (const s of [...this.sources]) {
      s.life -= dt;
      s.tick += dt;
      s.spread += dt;
      if (s.owner) s.p.copy(s.owner.mesh.position);
      if (s.life <= 0) {
        this.sources.splice(this.sources.indexOf(s), 1);
        continue;
      }
      if (s.tick > 0.09) {
        s.tick = 0;
        const height = s.kind === 'tree' ? 4.5 : s.kind === 'building' ? 5 : 1.3;
        for (let i = 0; i < 3; i++) {
          const p = s.p
            .clone()
            .add(
              V(
                Math.sin(this.clock * 13 + i) * 0.75,
                0.4 + Math.random() * height,
                Math.cos(this.clock * 9 + i) * 0.7,
              ),
            );
          this.addParticle(p, i === 0 ? '#ffe39a' : '#ff7417', 0.9, 1.05, V(0, 1.4, 0));
        }
        this.addParticle(s.p.clone().add(V(0, height, 0)), '#373b3d', 1.4, 5, V(0.4, 1.3, 0.12));
      }
      if (s.spread > 5 && s.life > 15) {
        s.spread = 0;
        this.environment(s.p, 5);
      }
    }
    this.updateParticles(dt);
  }
  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.p.addScaledVector(p.v, dt);
      p.v.multiplyScalar(Math.exp(-dt * 0.6));
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.p.toArray(this.positions, i * 3);
      p.c.toArray(this.colors, i * 3);
      this.sizes[i] = p.size * Math.min(1, p.life / 0.4);
    }
    this.geometry.setDrawRange(0, this.particles.length);
    for (const a of Object.values(this.geometry.attributes)) a.needsUpdate = true;
    this.shake = Math.max(0, (this.shake || 0) - dt * 0.8);
  }
  camera() {
    if (this.shake > 0 && !this.g.cinematic) {
      this.w.camera.position.x += Math.sin(this.clock * 71) * this.shake;
      this.w.camera.position.y += Math.cos(this.clock * 61) * this.shake * 0.4;
    }
  }
}
