import { VehiclePreload } from './vehicle-preload.js';
import { VehicleLighting } from './vehicle-lighting.js';
import { animateVehicleWheels } from './blender-vehicles.js';
import { Immersion } from './immersion.js';
import { Expansion, isSpecialVehicle } from './expansion.js';
import { setText, setHTML } from './render-batches.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { clamp, euro } from './data.js';
import { Leisure } from './leisure.js';
import { Atmosphere } from './atmosphere.js';
import { Soundtrack } from './soundtrack.js';

// Separating-axis test for car footprints and solid world obstacles.
export function rectanglesOverlap(a, b, padding = 0) {
  const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2];
  for (const angle of axes) {
    const x = Math.cos(angle),
      z = -Math.sin(angle);
    const radius = (r) =>
      (Math.abs(x * Math.cos(r.angle) - z * Math.sin(r.angle)) * r.w) / 2 +
      (Math.abs(x * Math.sin(r.angle) + z * Math.cos(r.angle)) * r.l) / 2;
    if (Math.abs((a.x - b.x) * x + (a.z - b.z) * z) > radius(a) + radius(b) + padding) return false;
  }
  return true;
}

export class Arcade {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.sim = game.sim;
    this.world.gameplay = this;
    this.time = 0;
    this.heat = 0;
    this.punchTime = 0;
    this.attackReady = 0;
    this.particles = [];
    this.loot = [];
    this.vehicle = null;
    this.speed = 0;
    this.vehicleLighting = new VehicleLighting(this.world);
    this.music = new Soundtrack(game.audio, this.sim);
    this.atmosphere = new Atmosphere(this.world);
    this.leisure = new Leisure(this);
    this.world.cars.forEach((car, i) => {
      car.id = 'car-' + i;
      car.health = 100;
    });
    this.batchVehicles();
    for (const [zone, data] of Object.entries(this.world.zoneData))
      data.npcs.forEach((n, i) => {
        n.arcadeId = zone + '-' + i;
        n.hp = 3;
        n.home = n.mesh.position.clone();
      });
    const hud = document.createElement('div');
    hud.id = 'arcade-hud';
    hud.className = 'arcade-hud';
    hud.innerHTML =
      '<div class="arcade-vitals"><span id="arcade-health"></span><span id="arcade-bladder"></span><span id="arcade-heat"></span></div><div id="drive-hud" hidden></div><div id="fight-hint"></div><button id="arcade-guide">F1 <span>Steuerung</span></button>';
    document.querySelector('#ui').append(hud);
    document.querySelector('#arcade-guide').onclick = () => this.guide();
    const touch = document.createElement('button');
    touch.className = 'touch-punch';
    touch.textContent = 'F';
    touch.setAttribute('aria-label', 'Schlagen');
    touch.onclick = () => this.punch();
    document.querySelector('#ui').append(touch);
    window.addEventListener('keydown', (e) => {
      if (e.repeat || !game.started || game.modal || game.busy) return;
      if (e.code === 'KeyF') {
        e.preventDefault();
        this.punch();
      }
      if (e.code === 'KeyH' && this.vehicle) {
        e.preventDefault();
        if (this.vehicle.type !== 'helicopter')
          game.audio.play(this.vehicle.type === 'bike' ? 'bike-bell' : 'horn');
      }
      if (e.code === 'KeyL' && this.vehicle) {
        this.vehicle.headlights = !this.vehicle.headlights;
      }
      if (e.code === 'KeyR') this.music.toggle();
    });
    this.expansion = new Expansion(this);
    this.immersion = new Immersion(this);
    this.vehiclePreload = new VehiclePreload(this.world);
    this.world.keys.clear();
  }
  batchVehicles() {
    const root = this.world.groups.city;
    root.updateMatrixWorld(true);
    const groups = new Map();
    this.vehicleBatches = [];
    for (const car of this.world.cars)
      car.mesh.traverse((source) => {
        if (!source.isMesh || source.isInstancedMesh || !source.visible) return;
        const key = source.geometry.uuid + '|' + source.material.uuid;
        const list = groups.get(key) || [];
        list.push({ source, car });
        groups.set(key, list);
      });
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const first = list[0].source,
        batch = new THREE.InstancedMesh(first.geometry, first.material, list.length);
      batch.castShadow = list.some((o) => o.source.castShadow);
      batch.receiveShadow = true;
      batch.frustumCulled = false;
      list.forEach((o, i) => {
        batch.setMatrixAt(i, o.source.matrixWorld);
        o.source.visible = false;
      });
      root.add(batch);
      let farBatch = null;
      if (first.userData.lodGeometry) {
        farBatch = new THREE.InstancedMesh(first.userData.lodGeometry, first.material, list.length);
        farBatch.name = 'Blender traffic · distance LOD';
        farBatch.castShadow = batch.castShadow;
        farBatch.receiveShadow = true;
        farBatch.frustumCulled = false;
        farBatch.count = 0;
        root.add(farBatch);
      }
      this.vehicleBatches.push({ batch, farBatch, list });
    }
  }
  updateVehicleBatches() {
    if (this.world.zone !== 'city') return;
    if (this.game.extras?.intro.current) this.game.extras.intro.action?.maskTraffic();
    for (const car of this.world.cars) {
      car.renderVisible = this.world.inRenderRange(car.mesh, car.type === 'bus' ? 7 : 4);
      if (car.renderVisible) car.mesh.updateWorldMatrix(true, true);
      const d2 = car.mesh.position.distanceToSquared(this.world.camera.position);
      car.farLOD = d2 > (car.farLOD ? 52 * 52 : 62 * 62);
    }
    for (const { batch, farBatch, list } of this.vehicleBatches) {
      let count = 0,
        farCount = 0;
      for (const o of list) {
        if (!o.car.renderVisible || o.car.detailed || o.source.userData.suppressed) continue;
        if (farBatch && o.car.farLOD) farBatch.setMatrixAt(farCount++, o.source.matrixWorld);
        else batch.setMatrixAt(count++, o.source.matrixWorld);
      }
      batch.count = count;
      batch.visible = count > 0;
      if (count) batch.instanceMatrix.needsUpdate = true;
      if (farBatch) {
        farBatch.count = farCount;
        farBatch.visible = farCount > 0;
        if (farCount) farBatch.instanceMatrix.needsUpdate = true;
      }
    }
  }
  get active() {
    return this.game.started && !document.hidden && !this.game.modal?.pause;
  }
  freeSpot(x, z, radius = 0.35, exclude = null) {
    return !this.collides({ x, z, w: radius * 2, l: radius * 2, angle: 0 }, exclude);
  }
  shape(car, x = car.mesh.position.x, z = car.mesh.position.z, angle = car.mesh.rotation.y) {
    return {
      x,
      z,
      angle,
      y: car.mesh.position.y,
      w: car.width ?? (car.type === 'bus' ? 2.5 : 1.85),
      l: car.length ?? (car.type === 'bus' ? 8.5 : car.type === 'van' ? 5.3 : 4.4),
    };
  }
  overlap(a, b, padding = 0) {
    return rectanglesOverlap(a, b, padding);
  }
  collides(rect, exclude = this.vehicle, zoneName = this.world.zone) {
    const data = this.world.zoneData[zoneName];
    if (Math.abs(rect.x) > data.bounds - 2 || Math.abs(rect.z) > data.bounds - 4) return true;
    for (const b of data.physics.bodies) {
      if (b.mass !== 0 || b === exclude?.body) continue;
      const ext = b.shapes[0]?.halfExtents;
      const floor = rect.y ?? Math.max(0, this.world.player.position.y);
      if (
        !ext ||
        b.collisionResponse === false ||
        b.position.y + ext.y < floor + 0.12 ||
        b.position.y - ext.y > floor + 1.9
      )
        continue;
      const angle = 2 * Math.atan2(b.quaternion.y, b.quaternion.w);
      if (
        rectanglesOverlap(rect, {
          x: b.position.x,
          z: b.position.z,
          w: ext.x * 2,
          l: ext.z * 2,
          angle,
        })
      )
        return true;
    }
    if (zoneName === 'city')
      for (const c of this.world.cars) {
        if (c === exclude || !c.mesh.visible || c.mesh.position.y > 3) continue;
        if (Math.hypot(rect.x - c.mesh.position.x, rect.z - c.mesh.position.z) > 12) continue;
        if (rectanglesOverlap(rect, this.shape(c))) return true;
      }
    return false;
  }
  enterCar(car) {
    if (car.exploded || car.health <= 0) {
      this.game.toast('Totalschaden · Dieses Auto fährt nicht mehr.');
      return false;
    }
    if (isSpecialVehicle(car)) return this.expansion.enter(car);
    if (this.vehicle || this.world.zone !== 'city') return false;
    this.vehicle = car;
    car.controlled = true;
    car.parked = true;
    if (this.world.pedestrianNav) this.world.pedestrianNav.count = -1;
    this.speed = 0;
    car.mesh.userData.dynamic = true;
    if (car.body?.world) car.body.world.removeBody(car.body);
    this.world.player.visible = false;
    this.world.playerShadow.visible = false;
    this.world.distance = car.type === 'bus' ? 10 : 7.6;
    this.world.pitch = 0.24;
    this.world.yaw = car.mesh.rotation.y + Math.PI;
    this.world.keys.clear();
    this.game.audio.play('car-open');
    this.game.audio.play('engine-start');
    this.game.audio.voices?.say(
      car.type === 'bus' ? 'bus_driver' : car.type === 'taxi' ? 'taxi_driver' : 'player',
      'car_enter',
    );
    this.game.toast(
      'Anschnallen. Storyline verlassen.',
      'W/S Gas & Rückwärts · A/D Lenken · Leertaste Handbremse · E Aussteigen · H Hupe · R Radio',
    );
    return true;
  }
  exitCar() {
    if (isSpecialVehicle(this.vehicle)) return this.expansion.exit();
    if (!this.vehicle) return false;
    if (Math.abs(this.speed) > 1.8) {
      this.game.toast('Erst kurz anhalten.', 'Mit Leertaste bremsen.');
      return false;
    }
    const car = this.vehicle,
      a = car.mesh.rotation.y,
      p = car.mesh.position,
      shape = this.shape(car);
    let spot;
    for (const [side, front] of [
      [this.game.workshop?.passengerCar === car ? -1 : 1, 0],
      [this.game.workshop?.passengerCar === car ? 1 : -1, 0],
      [1, -2],
      [-1, -2],
      [0, -shape.l / 2 - 1],
      [0, shape.l / 2 + 1],
    ]) {
      const x = p.x + Math.cos(a) * side * (shape.w / 2 + 0.8) + Math.sin(a) * front;
      const z = p.z - Math.sin(a) * side * (shape.w / 2 + 0.8) + Math.cos(a) * front;
      if (this.freeSpot(x, z, 0.4, car)) {
        spot = { x, z };
        break;
      }
    }
    if (!spot) {
      this.game.toast('Die Türen sind blockiert.', 'Fahre ein Stück auf eine freie Fläche.');
      return false;
    }
    car.controlled = false;
    car.speed = 0;
    this.speed = 0;
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(shape.w / 2, 0.8, shape.l / 2)),
    });
    body.position.set(p.x, 0.8, p.z);
    body.quaternion.setFromEuler(0, a, 0);
    this.world.zoneData.city.physics.addBody(body);
    car.body = body;
    this.vehicle = null;
    this.vehicleLighting?.update(null);
    this.world.player.visible = true;
    this.world.playerShadow.visible = true;
    this.world.teleport(spot.x, spot.z);
    this.world.distance = 5.8;
    this.world.pose = 'walk';
    this.world.keys.clear();
    this.game.audio.play('car-door');
    this.sim.save();
    return true;
  }
  parkForTransition() {
    this.immersion?.transition();
    if (this.expansion?.transition()) return;
    if (!this.vehicle) return;
    const car = this.vehicle,
      shape = this.shape(car),
      p = car.mesh.position;
    if (car.body?.world) car.body.world.removeBody(car.body);
    car.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(shape.w / 2, 0.8, shape.l / 2)),
    });
    car.body.position.set(p.x, 0.8, p.z);
    car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
    this.world.zoneData.city.physics.addBody(car.body);
    car.controlled = false;
    car.parked = true;
    if (this.world.pedestrianNav) this.world.pedestrianNav.count = -1;
    car.speed = 0;
    this.vehicle = null;
    this.speed = 0;
    this.vehicleLighting?.update(null);
    this.world.player.visible = true;
    this.world.playerShadow.visible = true;
  }
  updateVehicle(dt, blocked) {
    if (!this.vehicle || isSpecialVehicle(this.vehicle)) {
      this.vehicleLighting?.update(null);
      return this.vehicle ? this.expansion.updateVehicle(dt, blocked) : false;
    }
    const car = this.vehicle,
      w = this.world,
      keys = w.keys;
    if (w.zone !== 'city') {
      this.vehicle = null;
      w.player.visible = true;
      w.playerShadow.visible = true;
      return false;
    }
    const driving = !blocked && this.active;
    if (!driving) this.speed = 0;
    else {
      const gas =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const steering =
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      const brake = keys.has('Space');
      this.speed += gas * (car.type === 'bus' ? 7 : 11) * dt;
      this.speed = THREE.MathUtils.damp(this.speed, 0, brake ? 7 : gas ? 0.16 : 1.1, dt);
      this.speed = clamp(
        this.speed,
        -7,
        (car.type === 'bus' ? 16 : 25) *
          (this.immersion?.weather.wet > 0.5 ? 0.86 : 1) *
          (0.45 + (0.55 * (car.health ?? 100)) / 100),
      );
      const angle =
        car.mesh.rotation.y +
        steering *
          Math.sign(this.speed) *
          Math.min(Math.abs(this.speed) / 4, 1) *
          (brake ? 2.25 : 1.35) *
          dt;
      const steps = Math.max(1, Math.ceil((Math.abs(this.speed) * dt) / 0.28));
      for (let i = 0; i < steps; i++) {
        const x = car.mesh.position.x + (Math.sin(angle) * this.speed * dt) / steps;
        const z = car.mesh.position.z + (Math.cos(angle) * this.speed * dt) / steps;
        if (this.collides(this.shape(car, x, z, angle))) {
          if (Math.abs(this.speed) > 3 && this.time > (car.lastCrash || 0) + 0.6) {
            car.lastCrash = this.time;
            // Damage is applied once through the shared deformation/fire system.
            this.burst(
              car.mesh.position
                .clone()
                .add(new THREE.Vector3(Math.sin(angle) * 2, 0.7, Math.cos(angle) * 2)),
              '#ffbf55',
              14,
            );
            this.game.audio.play('crash');
            if (this.immersion) this.immersion.vehicles.damage(car, Math.abs(this.speed) * 1.8);
            else car.health = Math.max(0, (car.health ?? 100) - Math.abs(this.speed) * 1.8);
            this.heat = clamp(this.heat + 4);
          }
          this.speed = -this.speed * 0.2;
          break;
        }
        car.mesh.position.set(x, 0, z);
        car.mesh.rotation.y = angle;
        if (Math.abs(this.speed) > 2.8)
          for (const n of w.zoneData.city.npcs) {
            if (n.down || !n.mesh.visible) continue;
            const npc = { x: n.mesh.position.x, z: n.mesh.position.z, w: 0.65, l: 0.65, angle: 0 };
            if (rectanglesOverlap(this.shape(car), npc))
              this.hitNPC(n, 4, angle, Math.min(8, Math.abs(this.speed) * 0.45), 'vehicle');
          }
      }
      this.sim.s.driven += Math.abs(this.speed) * dt;
      if (this.sim.s.driven >= 100) this.sim.unlock('driver');
      if (!(w.dragging || w.time < (w.cameraLookUntil || 0)))
        w.yaw +=
          Math.atan2(
            Math.sin(car.mesh.rotation.y + Math.PI - w.yaw),
            Math.cos(car.mesh.rotation.y + Math.PI - w.yaw),
          ) *
          (1 - Math.exp(-dt * 3));
    }
    const b = w.zoneData.city.body;
    b.position.set(car.mesh.position.x, 0.34, car.mesh.position.z);
    b.velocity.setZero();
    w.player.position.set(car.mesh.position.x, 0, car.mesh.position.z);
    w.player.rotation.y = car.mesh.rotation.y;
    w.moveSpeed = 0;
    w.sprinting = false;
    animateVehicleWheels(
      car,
      this.speed,
      dt,
      (this.world.keys.has('KeyA') ? 1 : 0) - (this.world.keys.has('KeyD') ? 1 : 0),
    );
    this.game.audio.engine?.(Math.abs(this.speed) / 25);
    this.vehicleLighting?.update(car);
    return true;
  }
  targetNPC() {
    const p = this.world.player.position;
    return this.world.zoneData[this.world.zone].npcs
      .filter((n) => !n.down && n.mesh.visible && Math.abs(n.mesh.position.y - p.y) < 2)
      .map((n) => ({ n, d: Math.hypot(n.mesh.position.x - p.x, n.mesh.position.z - p.z) }))
      .filter((o) => o.d < 2.25 && this.lineClear(p, o.n.mesh.position))
      .sort((a, b) => a.d - b.d)[0]?.n;
  }
  lineClear(a, b) {
    const data = this.world.zoneData[this.world.zone];
    for (let t = 0.15; t < 1; t += 0.15) {
      const x = THREE.MathUtils.lerp(a.x, b.x, t),
        z = THREE.MathUtils.lerp(a.z, b.z, t);
      for (const body of data.physics.bodies) {
        const h = body.shapes[0]?.halfExtents;
        if (body.mass || !h || body.position.y + h.y < 1.05) continue;
        if (Math.abs(x - body.position.x) < h.x && Math.abs(z - body.position.z) < h.z)
          return false;
      }
    }
    return true;
  }
  punch() {
    if (this.game.fireStory?.running) return;
    if (this.immersion?.motion.action) return;
    if (
      !this.vehicle &&
      !this.game.modal &&
      !this.game.busy &&
      this.active &&
      this.time >= this.attackReady &&
      this.immersion?.physics.punch()
    ) {
      this.attackReady = this.time + 0.44;
      return;
    }
    if (
      !this.active ||
      this.game.modal ||
      this.game.busy ||
      this.vehicle ||
      this.time < this.attackReady
    )
      return;
    if (this.sim.s.energy < 2) {
      this.game.toast('Kurz durchatmen.', 'Kaffee gibt neue Energie.');
      return;
    }
    this.attackReady = this.time + 0.44;
    this.punchTime = 0.36;
    this.sim.change('energy', -0.7);
    const n = this.targetNPC();
    if (n) {
      const p = this.world.player.position,
        angle = Math.atan2(n.mesh.position.x - p.x, n.mesh.position.z - p.z);
      this.world.player.rotation.y = angle;
      this.hitNPC(n, 1, angle, 1.4);
    } else this.game.audio.play('swing');
  }
  hitNPC(n, damage, angle, force, cause = 'melee') {
    if (n.down || this.time < (n.hitReady || 0)) return;
    n.hitReady = this.time + 0.25;
    n.hp -= damage;
    n.stagger = 0.25;
    if (cause === 'vehicle' || cause === 'explosion') this.game.extras?.impact(n);
    else this.game.audio.play('punch', { position: n.mesh.position });
    this.immersion?.life.emit(
      cause === 'vehicle' ? 'crash' : cause === 'shot' ? 'shot' : 'assault',
      n.mesh.position,
      damage > 1 ? 2 : 1,
    );
    if (n.umbrella) n.umbrella.visible = false;
    if (cause !== 'vehicle' && cause !== 'explosion')
      this.game.audio.voices?.npc(n, n.hp <= 0 ? 'down' : 'hit', { priority: 3 });
    this.burst(n.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0)), '#ffe09c', 7);
    this.heat = clamp(this.heat + (damage > 1 ? 16 : 5));
    if (n.hp <= 0) {
      n.down = 7;
      n.fall = 0;
      n.push = { x: Math.sin(angle) * force, z: Math.cos(angle) * force };
      n.bike && (n.bike.visible = false);
      this.sim.s.knockouts++;
      this.sim.checkAchievements();
      const claim = this.sim.s.day + ':' + n.arcadeId;
      if (!this.sim.s.lootClaims.includes(claim)) {
        this.sim.s.lootClaims.push(claim);
        const amount = Math.round((2.5 + (this.sim.s.knockouts % 7) * 0.65) * 100) / 100;
        this.dropCash(n.mesh.position, amount);
      }
      const name = n.name?.split(' ·')[0] || 'Passant';
      this.game.toast(
        name + ' geht zu Boden.',
        this.world.zone === 'office'
          ? '„Das nehmen wir mal mit ins nächste Feedbackgespräch.“'
          : 'Sterne sehen. Kurz durchatmen. Gleich wieder aufstehen.',
      );
      if (cause === 'vehicle') this.expansion?.scatter(n, angle, force);
      if (this.world.zone === 'office') this.sim.change('rep', -1);
      this.sim.save();
    } else n.counterAt = this.time + 0.75;
  }
  updateNPC(n, dt) {
    if (!n.down && this.world.zone === 'city' && this.immersion?.life.updateNPC(n, dt)) return true;
    const step = this.active ? dt : 0;
    if (n.down) {
      n.down = Math.max(0, n.down - step);
      n.fall = Math.min(1, (n.fall || 0) + step * 4);
      n.mesh.rotation.z = -n.fall * 1.45;
      n.mesh.position.y = 0.25 * n.fall;
      if (n.push) {
        const x = n.mesh.position.x + n.push.x * step,
          z = n.mesh.position.z + n.push.z * step;
        if (this.freeSpot(x, z, 0.25)) {
          n.mesh.position.x = x;
          n.mesh.position.z = z;
          if (n.x !== undefined) {
            n.x = x;
            n.z = z;
          }
        }
        n.push.x *= Math.exp(-step * 4);
        n.push.z *= Math.exp(-step * 4);
      }
      if (!n.down) {
        if (n.scattered) this.expansion?.restore(n);
        n.hp = 3;
        this.game.audio.voices?.npc(n, 'recover');
        n.mesh.rotation.z = 0;
        n.mesh.position.y = 0;
        n.counterAt = 0;
        n.hitReady = this.time + 2;
      }
      return true;
    }
    if (n.stagger > 0) {
      n.stagger -= step;
      n.mesh.rotation.z = Math.sin(n.stagger * 16) * 0.16;
      return true;
    }
    n.mesh.rotation.z = 0;
    if (n.counterAt && this.time >= n.counterAt) {
      n.counterAt = 0;
      if (
        !this.vehicle &&
        Math.hypot(
          n.mesh.position.x - this.world.player.position.x,
          n.mesh.position.z - this.world.player.position.z,
        ) < 2.5
      ) {
        this.sim.change('health', -9);
        this.game.audio.play('punch');
        this.game.audio.voices?.say('player', 'hit');
        this.flash = 0.2;
        n.attackUntil = this.time + 0.36;
      }
    }
    return false;
  }
  animatePlayer(dt) {
    this.expansion?.poseRider();
    this.immersion?.motion.pose(dt);
    if (this.punchTime > 0) {
      this.punchTime = Math.max(0, this.punchTime - (this.active ? dt : 0));
      const t = Math.sin((1 - this.punchTime / 0.36) * Math.PI),
        r = this.world.player.userData.rig;
      r.rightArm.rotation.x = -t * 1.65;
      r.rightFore.rotation.x = -0.15;
      r.leftArm.rotation.x = -0.8;
    }
  }
  burst(position, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.065),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.copy(position);
      this.world.groups[this.world.zone].add(mesh);
      this.particles.push({
        mesh,
        life: 0.6,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      });
    }
  }
  dropCash(position, amount) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.16),
      new THREE.MeshStandardMaterial({
        color: '#88cf83',
        emissive: '#62a761',
        emissiveIntensity: 0.35,
        metalness: 0.15,
      }),
    );
    mesh.position.set(position.x, 0.35, position.z);
    this.world.groups[this.world.zone].add(mesh);
    this.loot.push({ mesh, amount, zone: this.world.zone, life: 60 });
  }
  update(dt, blocked) {
    if (this.game.extras?.intro.current) {
      this.atmosphere.update(dt);
      this.immersion.weather.update(dt);
      this.updateVehicleBatches();
      return;
    }
    const step = this.active ? dt : 0;
    this.time += step;
    this.heat = Math.max(0, this.heat - step * 0.8);
    if (this.active) {
      this.sim.change('bladder', step * 0.065);
      if (this.sim.s.bladder > 95) this.sim.change('focus', -step * 0.035);
    }
    for (const p of [...this.particles]) {
      p.life -= step;
      p.mesh.position.addScaledVector(p.v, step);
      p.v.y -= step * 6;
      p.mesh.scale.setScalar(Math.max(0.01, p.life / 0.6));
      if (p.life <= 0) {
        p.mesh.removeFromParent();
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(this.particles.indexOf(p), 1);
      }
    }
    for (const drop of [...this.loot]) {
      drop.life -= step;
      drop.mesh.rotation.y += step * 2;
      drop.mesh.position.y = 0.32 + Math.sin(this.time * 4) * 0.08;
      if (
        !blocked &&
        drop.zone === this.world.zone &&
        drop.mesh.position.distanceTo(this.world.player.position) < 2.8
      ) {
        this.sim.transaction(drop.amount, 'Arcade · Cash-Drop');
        this.sim.s.chaosCash += drop.amount;
        this.game.toast('+' + euro(drop.amount), 'Cash eingesammelt.', true);
        this.game.audio.play('bottle');
        this.game.audio.voices?.say('player', 'cash');
        drop.life = 0;
        this.sim.save();
      }
      if (drop.life <= 0) {
        drop.mesh.removeFromParent();
        drop.mesh.geometry.dispose();
        drop.mesh.material.dispose();
        this.loot.splice(this.loot.indexOf(drop), 1);
      }
    }
    if (this.vehicle) {
      this.world.nearest = { kind: 'vehicle-exit', label: 'Aussteigen · erst anhalten' };
    } else if (this.world.zone === 'city') {
      const p = this.world.player.position;
      const cars = this.world.cars
        .map((car) => ({
          car,
          d: Math.hypot(car.mesh.position.x - p.x, car.mesh.position.z - p.z),
        }))
        .filter(
          (o) =>
            o.car.mesh.visible &&
            !o.car.exploded &&
            Math.abs(p.y - o.car.mesh.position.y) < 2 &&
            o.d < (o.car.type === 'helicopter' ? 6.7 : 3.3) &&
            Math.abs(o.car.speed) < 3.5 &&
            o.car.mesh.position.y < 0.5,
        )
        .sort((a, b) => a.d - b.d);
      if (cars.length && (!this.world.nearest || cars[0].d < 2.8))
        this.world.nearest = {
          kind: 'vehicle',
          data: cars[0].car,
          label:
            ({ bike: 'Fahrrad', helicopter: 'Helikopter', bus: 'Bus', taxi: 'Taxi' }[
              cars[0].car.type
            ] || 'Auto') + ' fahren · Einsteigen',
        };
    }
    if (this.sim.s.health <= 0) {
      if (this.vehicle) {
        this.speed = 0;
        this.exitCar();
      }
      this.game.transition('office');
      this.sim.s.health = 100;
      this.heat = 0;
      this.sim.transaction(-Math.min(this.sim.s.money, 5), 'Erholung · Erste Hilfe');
      this.game.toast('Kurze Auszeit bei der BBE.', 'Wieder fit. Die Karriere geht weiter.');
      this.sim.save();
    }
    this.leisure.update(step);
    this.music.update(
      this.active && !this.game.modal?.pause && !this.game.fireStory?.running,
      this.world.zone,
      !!this.vehicle,
    );
    if (!this.vehicle) this.game.audio.engine?.(null);
    this.atmosphere.update(dt);
    const hud = document.querySelector('#arcade-hud');
    hud.hidden = !this.game.started || !!this.game.modal;
    setText(document.querySelector('#arcade-health'), '♥ ' + Math.ceil(this.sim.s.health));
    setText(
      document.querySelector('#arcade-bladder'),
      'WC ' + Math.floor(this.sim.s.bladder) + ' %',
    );
    document.querySelector('#arcade-bladder').classList.toggle('urgent', this.sim.s.bladder > 80);
    setText(document.querySelector('#arcade-heat'), 'AUFSEHEN ' + Math.ceil(this.heat) + ' %');
    const dash = document.querySelector('#drive-hud');
    dash.hidden = !this.vehicle;
    if (this.vehicle && !isSpecialVehicle(this.vehicle))
      setHTML(
        dash,
        '<strong>' +
          Math.round(Math.abs(this.speed) * 3.6) +
          ' <small>km/h</small></strong><span>' +
          (this.speed < -0.1 ? 'R' : 'D') +
          ' · Zustand ' +
          Math.round(this.vehicle.health) +
          ' %</span><small>W/S Gas · A/D Lenken · SPACE Bremse<br>E Aussteigen · H Hupe · L Licht · R Radio</small>',
      );
    const target = this.vehicle ? null : this.targetNPC();
    setText(
      document.querySelector('#fight-hint'),
      target
        ? 'F · ' +
            (target.name?.split(' ·')[0] || 'Passant') +
            ' schlagen · ' +
            '●'.repeat(target.hp)
        : '',
    );
    this.flash = Math.max(0, (this.flash || 0) - dt);
    document.body.classList.toggle('hit-flash', this.flash > 0);
    this.expansion?.update(dt, blocked);
    this.immersion?.update(dt, blocked);
    this.updateVehicleBatches();
    this.vehiclePreload?.update();
  }
  interact(n) {
    if (n?.kind === 'prop-pick') {
      this.immersion.physics.pick();
      return true;
    }
    if (this.immersion?.interact(n)) return true;
    if (this.vehicle) {
      this.exitCar();
      return true;
    }
    if (n?.kind === 'vehicle') {
      this.enterCar(n.data);
      return true;
    }
    return this.expansion?.interact(n) || this.leisure.interact(n);
  }
  addSettings() {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML =
      '<div><strong>ISAR FM · Soundtrack</strong><p>Drei eigene Tracks. R schaltet Musik ein oder aus.</p></div><button id="soundtrack-settings">Radio & Lautstärke</button>';
    document.querySelector('.settings-list').prepend(row);
    document.querySelector('#soundtrack-settings').onclick = () => this.leisure.radio();
    const extras = document.createElement('button');
    extras.id = 'extras-settings';
    extras.textContent = 'Extras & Steuerung';
    document.querySelector('.settings-list .toolbar').prepend(extras);
    extras.onclick = () => this.guide();
  }
  guide() {
    if (!this.game.started) return;
    this.game.open(
      'Maxvorstadt nach Feierabend',
      `<div class="three-col"><article class="card"><h3>BurritoBombe & Brienner Bräu</h3><p>B wirft draußen eine BurritoBombe. Nachschub gibt es bei Dogtown; beim aktiven Kofferauftrag bleibt B für den Koffer reserviert. In der Brauerei hältst du mit A/D die Maß ruhig. Bier macht drei Minuten beschwipst. M öffnet die große Karte.</p></article><article class="card"><h3>Autos & Straßenchaos</h3><p>Mit E in ein stehendes Auto, Taxi, Lieferfahrzeug oder einen Bus einsteigen. W/S beschleunigt und fährt rückwärts, A/D lenkt. Leertaste bremst. E steigt aus, H hupt, L schaltet die Scheinwerfer.</p></article><article class="card"><h3>Auch im Büro: F</h3><p>In Reichweite mit F schlagen. Drei Treffer bringen eine Figur zu Boden. Passanten und Kollegen wehren sich. Cash-Drops liegen kurz auf dem Boden: einfach einsammeln. Figuren stehen wieder auf. Jede Figur gibt einmal pro Spieltag Cash.</p></article><article class="card"><h3>Mehr als Folien</h3><p>WC am Flur → Kabine → Ziel-Minispiel → Spülen → Hände waschen. Darts beim Whiteboard, Papierkorb beim Drucker, Wasser, Snackautomat und Radio im Büro. Draußen warten Fußball, Parkbank und ein Parkscheinautomat.</p></article></div><div class="three-col"><article class="card"><h3>Fahrrad & Drive-by</h3><p>E steigt auf. W/S Pedale, A/D Lenken, Shift schneller, SPACE bremsen. Maus bewegen zielt in Blickrichtung, F feuert, T lädt nach, H klingelt. E stellt das Fahrrad ab.</p></article><article class="card"><h3>BBE AIR</h3><p>Der Helikopter wartet westlich des Büros. M markiert den Landeplatz. E einsteigen, SPACE steigen, C sinken, W/S vorwärts/rückwärts, A/D drehen. Erst landen und anhalten, dann E aussteigen. Die Altstadt hat einen zweiten H-Landeplatz.</p></article><article class="card"><h3>Neue Standortqualitäten</h3><p>Frauenkirche, Marienplatz, Königsplatz, Karolinenplatz und St. Benno warten auf E. Im Büro braucht Dr. Dip Wasser, sonst hört das Nicken auf. Auto-Kollisionen verteilen Figuren kurzzeitig in einzelne animierte Teile.</p></article></div><div class="three-col"><article class="card"><h3>Bewegen & anfassen</h3><p>SPACE springt oder überwindet ein niedriges Hindernis; neben einer Motorhaube rutscht du darüber. E benutzt Leitern und Tore. G hebt Gegenstände auf und wirft sie, E legt sie ab. An der BBE-Seitenwand zum Hof beginnt der Dachweg.</p></article><article class="card"><h3>Stadt & Fahndung</h3><p>Zeugen flüchten, filmen oder rufen nach einigen Sekunden die Polizei. Blaue Fahrzeuge und der Suchradius stehen auf der Karte. Sichtkontakt abbrechen und versteckt bleiben. Beschädigte Autos behalten Beulen und kaputte Scheiben. In der BBE-Tiefgarage gibt es Deckung.</p></article><article class="card"><h3>Koffer & Seilwinde</h3><p>Am BBE-Empfang wartet der Eilauftrag. B setzt den Koffer ab, E nimmt ihn auf. Im Heli fährt Q die Winde aus/ein, X hängt den nahen Koffer an oder löst ihn. Kundenempfang und Dachterrasse sind gültige Ziele.</p></article></div><div class="hint-inline">R schaltet den Original-Soundtrack ein und aus. Lautstärke und Station stehen in der Pause. Chaos klingt mit der Zeit ab. Deine Karriere und Speicherstände bleiben erhalten.</div><button id="guide-back" class="primary">Los geht’s</button>`,
      { pause: true },
    );
    document.querySelector('#guide-back').onclick = () => this.game.close();
  }
}
