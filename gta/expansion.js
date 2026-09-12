import { setHTML } from './render-batches.js';
import { CITY_LAYOUT } from './city-layout.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CITY_STOPS, HELIPADS, EXPANSION_ROADS } from './city-expansion.js';
import { clamp } from './data.js';

export const isSpecialVehicle = (car) => car && ['bike', 'helicopter'].includes(car.type);
export function rayBoxDistance(origin, direction, body, maxDistance = 80) {
  const h = body.shapes[0]?.halfExtents;
  if (!h) return Infinity;
  const a = 2 * Math.atan2(body.quaternion.y, body.quaternion.w),
    c = Math.cos(a),
    s = Math.sin(a);
  const x = origin.x - body.position.x,
    z = origin.z - body.position.z;
  const p = [x * c - z * s, origin.y - body.position.y, x * s + z * c],
    d = [direction.x * c - direction.z * s, direction.y, direction.x * s + direction.z * c],
    e = [h.x, h.y, h.z];
  let near = 0,
    far = maxDistance;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-6) {
      if (Math.abs(p[i]) > e[i]) return Infinity;
      continue;
    }
    let lo = (-e[i] - p[i]) / d[i],
      hi = (e[i] - p[i]) / d[i];
    if (lo > hi) [lo, hi] = [hi, lo];
    near = Math.max(near, lo);
    far = Math.min(far, hi);
    if (near > far) return Infinity;
  }
  return near;
}
export class Expansion {
  constructor(arcade) {
    this.a = arcade;
    this.game = arcade.game;
    this.w = arcade.world;
    this.sim = arcade.sim;
    this.pieces = [];
    this.tracers = [];
    this.fireHeld = false;
    this.shotAt = 0;
    this.magazine = 24;
    this.reloadUntil = 0;
    this.birdTime = 0;
    this.reticle = document.createElement('div');
    this.reticle.className = 'driveby-reticle';
    this.reticle.hidden = true;
    this.reticle.innerHTML = '<i></i><span id="driveby-status"></span>';
    document.body.append(this.reticle);
    const controls = document.createElement('div');
    controls.className = 'expansion-touch';
    controls.innerHTML =
      '<button data-flight="Space" aria-label="Helikopter steigen">↑</button><button data-flight="KeyC" aria-label="Helikopter sinken">↓</button><button id="driveby-touch" aria-label="Drive-by schießen">◎</button>';
    document.body.append(controls);
    this.touch = controls;
    controls.querySelectorAll('[data-flight]').forEach((b) => {
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.w.keys.add(b.dataset.flight);
      };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
        b.addEventListener(ev, () => this.w.keys.delete(b.dataset.flight));
    });
    const fire = controls.querySelector('#driveby-touch');
    fire.onpointerdown = (e) => {
      e.preventDefault();
      fire.setPointerCapture(e.pointerId);
      this.fireHeld = true;
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
      fire.addEventListener(ev, () => (this.fireHeld = false));
    window.addEventListener('keydown', (e) => {
      if (!this.a.active || this.game.modal || this.game.busy) return;
      if (e.code === 'KeyF' && this.a.vehicle?.type === 'bike') {
        e.preventDefault();
        this.fireHeld = true;
        this.shoot();
      }
      if (e.code === 'KeyT' && this.a.vehicle?.type === 'bike') {
        e.preventDefault();
        this.reload();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyF') this.fireHeld = false;
    });
    window.addEventListener('blur', () => (this.fireHeld = false));
    this.makeWeapon();
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, 0.4, 8),
      new THREE.MeshPhysicalMaterial({
        color: '#a3e3e9',
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
      }),
    );
    stream.position.set(0, 0.47, 0.32);
    stream.visible = false;
    this.w.drinkingBird.add(stream);
    this.birdStream = stream;
  }
  makeWeapon() {
    const root = new THREE.Group(),
      metal = new THREE.MeshStandardMaterial({ color: '#34494d', roughness: 0.3, metalness: 0.75 }),
      grip = new THREE.MeshStandardMaterial({ color: '#18252b', roughness: 0.9 });
    const add = (x, y, z, w, h, d, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      root.add(mesh);
    };
    add(0, 0, 0.12, 0.105, 0.14, 0.43, metal);
    add(0, -0.14, -0.03, 0.075, 0.22, 0.1, grip);
    add(0, -0.13, 0.14, 0.07, 0.2, 0.13, grip);
    add(0, 0.085, 0.07, 0.055, 0.04, 0.11, metal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 10), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.43;
    root.add(barrel);
    root.visible = false;
    this.w.scene.add(root);
    this.weapon = root;
  }
  enter(car) {
    if (this.a.vehicle || this.w.zone !== 'city') return false;
    this.a.vehicle = car;
    car.controlled = true;
    car.parked = true;
    this.a.speed = 0;
    car.speed = 0;
    if (car.body?.world) car.body.world.removeBody(car.body);
    this.w.player.visible = car.type === 'bike';
    this.w.playerShadow.visible = car.type === 'bike';
    this.w.pose = car.type === 'bike' ? 'cycle' : 'walk';
    this.w.distance = car.type === 'bike' ? 5.5 : 15;
    this.w.pitch = car.type === 'bike' ? 0.2 : 0.32;
    this.w.yaw = car.mesh.rotation.y + Math.PI;
    this.w.keys.clear();
    if (car.type === 'helicopter') {
      if (car.mesh.position.y < 0.1) this.sim.s.heliTakeoff = false;
      this.game.audio.play('car-open');
      this.game.toast(
        'BBE AIR · Bitte die Flughöhe der Storyline beachten.',
        'W/S Vorwärts & Rückwärts · A/D Drehen · SPACE Steigen · C Sinken · E nach der Landung',
      );
    } else {
      this.game.audio.play('bike-bell');
      this.game.toast(
        'Zwei Räder. Sehr kurze Entscheidungswege.',
        'W/S Fahren · A/D Lenken · Shift Sprint · SPACE Bremse · F Drive-by · Maus bewegen zum Zielen · T Nachladen',
      );
    }
    return true;
  }
  exit(force = false) {
    const car = this.a.vehicle;
    if (!isSpecialVehicle(car)) return false;
    if (
      !force &&
      (Math.abs(this.a.speed) > 1.5 ||
        (car.type === 'helicopter' &&
          (car.mesh.position.y > 0.3 || Math.abs(car.verticalSpeed) > 0.6)))
    ) {
      this.game.toast(
        car.type === 'helicopter' ? 'Erst sicher landen.' : 'Erst kurz bremsen.',
        car.type === 'helicopter'
          ? 'Mit C langsam sinken. Auf einer freien Fläche oder einem H-Landeplatz aufsetzen.'
          : 'SPACE bremst das Fahrrad.',
      );
      return false;
    }
    const p = car.mesh.position,
      angle = car.mesh.rotation.y;
    const spots = [
      [2.8, 0],
      [-2.8, 0],
      [0, 6],
      [0, -6],
      [4, 4],
      [-4, -4],
    ];
    const spot = spots
      .map(([x, z]) => ({
        x: p.x + Math.cos(angle) * x + Math.sin(angle) * z,
        z: p.z - Math.sin(angle) * x + Math.cos(angle) * z,
      }))
      .find((q) => this.a.freeSpot(q.x, q.z, 0.4, car));
    if (!spot && !force) {
      this.game.toast('Ausstieg blockiert.', 'Ein Stück auf eine freie Fläche rollen.');
      return false;
    }
    this.park(car);
    this.a.vehicle = null;
    this.a.speed = 0;
    this.fireHeld = false;
    this.w.player.visible = true;
    this.w.playerShadow.visible = true;
    this.w.player.userData.rig.rightArm.rotation.y = 0;
    this.weapon.visible = false;
    this.w.pose = 'walk';
    this.w.distance = 5.8;
    this.w.teleport(spot?.x ?? HELIPADS[0].x + 13, spot?.z ?? HELIPADS[0].z + 13);
    this.w.keys.clear();
    this.game.audio.play(car.type === 'bike' ? 'chair' : 'car-door');
    this.sim.save();
    return true;
  }
  park(car) {
    if (car.body?.world) car.body.world.removeBody(car.body);
    if (car.type === 'helicopter' && car.mesh.position.y > 0.3) {
      const pad = HELIPADS.reduce((a, b) =>
        Math.hypot(car.mesh.position.x - a.x, car.mesh.position.z - a.z) <
        Math.hypot(car.mesh.position.x - b.x, car.mesh.position.z - b.z)
          ? a
          : b,
      );
      car.mesh.position.set(pad.x, 0, pad.z);
    }
    car.mesh.position.y = 0;
    car.mesh.rotation.x = 0;
    car.mesh.rotation.z = 0;
    car.verticalSpeed = 0;
    car.controlled = false;
    car.parked = true;
    car.speed = 0;
    const height = car.type === 'bike' ? 1.2 : 3.2;
    car.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(car.width / 2, height / 2, car.length / 2)),
    });
    car.body.position.set(car.mesh.position.x, height / 2, car.mesh.position.z);
    car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
    this.w.zoneData.city.physics.addBody(car.body);
  }
  transition() {
    const car = this.a.vehicle;
    if (isSpecialVehicle(car)) {
      this.park(car);
      this.a.vehicle = null;
      this.a.speed = 0;
      this.w.player.visible = true;
      this.w.playerShadow.visible = true;
      this.w.player.userData.rig.rightArm.rotation.y = 0;
      this.weapon.visible = false;
      this.fireHeld = false;
      return true;
    }
    return false;
  }
  blockedAt(car, x, y, z, angle) {
    if (
      Math.abs(x) > this.w.zoneData.city.bounds - 8 ||
      Math.abs(z) > this.w.zoneData.city.bounds - 8
    )
      return true;
    const floor = y + 0.22,
      ceiling = y + (car.height || 2),
      rect = this.a.shape(car, x, z, angle);
    for (const body of this.w.zoneData.city.physics.bodies) {
      const h = body.shapes[0]?.halfExtents;
      if (
        body.mass ||
        !h ||
        body === car.body ||
        body.position.y + h.y < floor ||
        body.position.y - h.y > ceiling
      )
        continue;
      const a = 2 * Math.atan2(body.quaternion.y, body.quaternion.w);
      if (
        this.a.overlap(
          rect,
          { x: body.position.x, z: body.position.z, w: h.x * 2, l: h.z * 2, angle: a },
          0.15,
        )
      )
        return true;
    }
    for (const other of this.w.cars) {
      if (
        other === car ||
        !other.mesh.visible ||
        other.mesh.position.y + (other.height || 2) < floor ||
        other.mesh.position.y > ceiling
      )
        continue;
      if (this.a.overlap(rect, this.a.shape(other), 0.1)) return true;
    }
    return false;
  }
  updateVehicle(dt, blocked) {
    const car = this.a.vehicle;
    if (!isSpecialVehicle(car)) return false;
    const active = this.a.active && !blocked,
      w = this.w,
      keys = w.keys,
      p = car.mesh.position;
    if (!active) {
      car.verticalSpeed = 0;
      this.a.speed = 0;
      this.fireHeld = false;
    }
    const gas = active
      ? (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
      : 0;
    const steer = active
      ? (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
      : 0;
    if (car.type === 'helicopter') {
      car.rotorSpeed = THREE.MathUtils.damp(car.rotorSpeed, active ? 1 : 0.35, 1.8, dt);
      const lift = active ? (keys.has('Space') ? 1 : 0) - (keys.has('KeyC') ? 1 : 0) : 0;
      const canFly = car.rotorSpeed > 0.65;
      car.verticalSpeed = THREE.MathUtils.damp(car.verticalSpeed, canFly ? lift * 9 : 0, 2.8, dt);
      this.a.speed = THREE.MathUtils.damp(
        this.a.speed,
        canFly && p.y > 0.25 ? gas * (keys.has('ShiftLeft') ? 29 : 21) : 0,
        1.6,
        dt,
      );
      const angle = car.mesh.rotation.y + steer * dt * 0.95 * (p.y > 0.25 ? 1 : 0.3),
        steps = Math.max(
          1,
          Math.ceil(((Math.abs(this.a.speed) + Math.abs(car.verticalSpeed)) * dt) / 0.3),
        );
      let collision = false;
      for (let i = 0; i < steps; i++) {
        const y = clamp(p.y + (car.verticalSpeed * dt) / steps, 0, 115),
          x = p.x + (Math.sin(angle) * this.a.speed * dt) / steps,
          z = p.z + (Math.cos(angle) * this.a.speed * dt) / steps;
        if (this.blockedAt(car, x, y, z, angle)) {
          collision = true;
          this.a.speed *= 0.2;
          car.verticalSpeed = Math.max(0, car.verticalSpeed);
          break;
        }
        p.set(x, y, z);
        car.mesh.rotation.y = angle;
        if (y === 0) {
          car.verticalSpeed = 0;
          this.a.speed = 0;
        }
      }
      if (collision && this.a.time > (car.bumpAt || 0) + 1) {
        car.bumpAt = this.a.time;
        car.health = Math.max(1, car.health - 9);
        this.game.audio.play('crash');
        this.game.toast(
          'Vorsicht, Hindernis.',
          'Steigen oder zurücksetzen. Auf H-Markierungen ist Platz zum Landen.',
        );
      }
      car.mesh.rotation.x = THREE.MathUtils.damp(
        car.mesh.rotation.x,
        active ? gas * 0.1 : 0,
        4,
        dt,
      );
      car.mesh.rotation.z = THREE.MathUtils.damp(car.mesh.rotation.z, -steer * 0.12, 4, dt);
      car.altitude = p.y;
      this.sim.s.flown += Math.abs(this.a.speed) * dt;
      if (p.y > 8) this.sim.s.heliTakeoff = true;
      if (p.y < 0.06 && this.sim.s.heliTakeoff) {
        this.sim.s.heliTakeoff = false;
        this.sim.s.heliLandings++;
        this.game.toast('Sauber gelandet.', 'Bitte die Rotoren nicht mit dem Deck verwechseln.');
        this.sim.save();
      }
      if (car.health <= 1) {
        this.recall();
        this.game.toast(
          'Notlandung bei BBE AIR.',
          'Der Helikopter wurde repariert. Die Storyline hat leichte Kratzer.',
        );
        return false;
      }
    } else {
      const sprint =
        active && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && this.sim.s.energy > 5;
      this.a.speed += gas * (sprint ? 7.4 : 5.2) * dt;
      this.a.speed = THREE.MathUtils.damp(
        this.a.speed,
        0,
        keys.has('Space') ? 9 : gas ? 0.25 : 1.0,
        dt,
      );
      this.a.speed = clamp(this.a.speed, -3, sprint ? 12 : 8);
      const angle =
        car.mesh.rotation.y +
        steer * Math.sign(this.a.speed) * Math.min(1, Math.abs(this.a.speed) / 2) * dt * 1.85;
      const steps = Math.max(1, Math.ceil((Math.abs(this.a.speed) * dt) / 0.18));
      for (let i = 0; i < steps; i++) {
        const x = p.x + (Math.sin(angle) * this.a.speed * dt) / steps,
          z = p.z + (Math.cos(angle) * this.a.speed * dt) / steps;
        if (this.a.collides(this.a.shape(car, x, z, angle), car)) {
          this.a.speed = -this.a.speed * 0.1;
          break;
        }
        p.set(x, 0, z);
        car.mesh.rotation.y = angle;
        if (Math.abs(this.a.speed) > 4)
          for (const n of w.zoneData.city.npcs)
            if (
              !n.down &&
              n.mesh.visible &&
              Math.hypot(n.mesh.position.x - p.x, n.mesh.position.z - p.z) < 1.0
            ) {
              this.a.hitNPC(n, 2, angle, 2, 'bike');
              this.a.speed *= 0.6;
            }
      }
      if (sprint && gas) this.sim.change('energy', -dt * 0.32);
      for (const wheel of car.mesh.userData.wheels || [])
        wheel.rotation.x += (this.a.speed * dt) / 0.34;
      if (car.mesh.userData.crank) car.mesh.userData.crank.rotation.x += this.a.speed * dt * 1.5;
      for (const pedal of car.mesh.userData.pedals || [])
        pedal.rotation.x = -car.mesh.userData.crank.rotation.x;
      if (car.mesh.userData.handlebar) car.mesh.userData.handlebar.rotation.y = steer * 0.25;
      car.mesh.rotation.z = -steer * Math.min(0.1, Math.abs(this.a.speed) * 0.012);
      this.sim.s.cycled += Math.abs(this.a.speed) * dt;
      if (Math.abs(this.a.speed) > 1 && this.a.time > (this.chainAt || 0)) {
        this.chainAt = this.a.time + 0.45;
        this.game.audio.noiseHit(0.07, 2400, 0.018);
      }
    }
    car.speed = this.a.speed;
    if (active && !(w.dragging || w.time < (w.cameraLookUntil || 0)))
      w.yaw +=
        Math.atan2(
          Math.sin(car.mesh.rotation.y + Math.PI - w.yaw),
          Math.cos(car.mesh.rotation.y + Math.PI - w.yaw),
        ) *
        (1 - Math.exp(-dt * (car.type === 'bike' ? 1.5 : 2)));
    const body = w.zoneData.city.body;
    body.position.set(p.x, p.y + 0.34, p.z);
    body.velocity.setZero();
    w.player.position.copy(p);
    w.player.rotation.y = car.mesh.rotation.y;
    w.moveSpeed = 0;
    w.sprinting = false;
    w.pose = car.type === 'bike' ? 'cycle' : 'walk';
    this.game.audio.engine(null);
    return true;
  }
  poseRider() {
    const car = this.a.vehicle;
    if (!isSpecialVehicle(car)) return;
    if (car.type === 'helicopter') {
      this.w.player.position.y = car.mesh.position.y;
      return;
    }
    const p = car.mesh.position,
      r = this.w.player.userData.rig,
      t = this.a.time * Math.abs(this.a.speed) * 1.1;
    this.w.player.position.set(
      p.x - Math.sin(car.mesh.rotation.y) * 0.12,
      0.13,
      p.z - Math.cos(car.mesh.rotation.y) * 0.12,
    );
    this.w.player.rotation.y = car.mesh.rotation.y;
    r.leftLeg.rotation.x = -1.05 + Math.sin(t) * 0.43;
    r.rightLeg.rotation.x = -1.05 - Math.sin(t) * 0.43;
    r.leftShin.rotation.x = 1.3;
    r.rightShin.rotation.x = 1.3;
    r.leftArm.rotation.x = -1.15;
    const direction = new THREE.Vector3();
    this.w.camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const aim = Math.atan2(direction.x, direction.z);
    r.rightArm.rotation.x = -1.35;
    r.rightArm.rotation.y = aim - car.mesh.rotation.y;
    r.rightFore.rotation.x = -0.2;
    this.weapon.position.set(p.x + direction.x * 0.32 + 0.23, 1.16, p.z + direction.z * 0.32);
    this.weapon.rotation.set(0, aim, 0);
  }
  reload() {
    if (this.reloadUntil || this.magazine === 24) return;
    this.reloadUntil = this.a.time + 1.6;
    this.game.audio.play('paper', { volume: 0.16 });
  }
  shoot() {
    if (
      this.a.vehicle?.type !== 'bike' ||
      !this.a.active ||
      this.game.modal ||
      this.game.busy ||
      this.a.time < this.shotAt ||
      this.reloadUntil
    )
      return false;
    if (this.magazine <= 0) {
      this.reload();
      return false;
    }
    this.magazine--;
    this.shotAt = this.a.time + 0.17;
    this.a.heat = clamp(this.a.heat + 1.5);
    this.sim.s.drivebyShots++;
    const direction = new THREE.Vector3();
    this.w.camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const p = this.a.vehicle.mesh.position,
      origin = new THREE.Vector3(p.x, 1.2, p.z).addScaledVector(direction, 0.8);
    let distance = 65,
      target = null;
    this.a.immersion?.life.emit('shot', p, 2);
    for (const body of this.w.zoneData.city.physics.bodies)
      if (
        !body.mass &&
        body.collisionResponse !== false &&
        body !== this.a.vehicle.body &&
        !this.a.immersion?.physics.panes.some((p) => p.body === body)
      )
        distance = Math.min(distance, rayBoxDistance(origin, direction, body, distance));
    for (const other of this.w.cars) {
      if (!other.mesh.visible || other === this.a.vehicle || other.body?.world) continue;
      const fake = {
        position: {
          x: other.mesh.position.x,
          y: other.mesh.position.y + 1,
          z: other.mesh.position.z,
        },
        quaternion: other.mesh.quaternion,
        shapes: [
          { halfExtents: { x: (other.width || 1.85) / 2, y: 1, z: (other.length || 4.4) / 2 } },
        ],
      };
      distance = Math.min(distance, rayBoxDistance(origin, direction, fake, distance));
    }
    distance = this.a.immersion?.physics.shot(origin, direction, distance, false) ?? distance;
    for (const n of this.w.zoneData.city.npcs) {
      if (n.down || !n.mesh.visible) continue;
      const delta = new THREE.Vector3(
          n.mesh.position.x - origin.x,
          0,
          n.mesh.position.z - origin.z,
        ),
        along = delta.dot(direction);
      if (along > 0 && along < distance && delta.lengthSq() - along * along < 0.52 * 0.52) {
        target = n;
        distance = along;
      }
    }
    if (!target) this.a.immersion?.physics.shot(origin, direction, distance + 0.001);
    const end = origin.clone().addScaledVector(direction, distance),
      geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const tracer = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: '#f9d395', transparent: true, opacity: 0.9 }),
    );
    this.w.groups.city.add(tracer);
    this.tracers.push({ mesh: tracer, life: 0.085 });
    this.a.burst(origin, '#ffe7a5', 3);
    if (target) {
      this.a.hitNPC(target, 1, Math.atan2(direction.x, direction.z), 1.7, 'shot');
      this.sim.s.drivebyHits++;
      this.reticle.classList.add('hit');
      this.hitUntil = this.a.time + 0.15;
    } else if (distance < 65) this.a.burst(end, '#cfcbbb', 3);
    this.game.audio.play('gunshot');
    if (!this.magazine) this.reload();
    return true;
  }
  scatter(n, angle, force) {
    if (n.scattered) return;
    while (this.pieces.length > 45) this.removePiece(this.pieces[0]);
    const actor = n.mesh,
      r = actor.userData.rig;
    actor.updateMatrixWorld(true);
    const groups = [];
    const direct = actor.children.filter((c) => c.isMesh);
    groups.push(
      direct.filter((c) => c.position.y > 1.4),
      direct.filter((c) => c.position.y <= 1.4),
    );
    for (const [upper, lower] of [
      [r.leftArm, r.leftFore],
      [r.rightArm, r.rightFore],
      [r.leftLeg, r.leftShin],
      [r.rightLeg, r.rightShin],
    ]) {
      groups.push(upper.children.filter((c) => c.isMesh));
      const meshes = [];
      lower.traverse((c) => {
        if (c.isMesh) meshes.push(c);
      });
      groups.push(meshes);
    }
    for (let i = 0; i < groups.length; i++) {
      const sources = groups[i];
      if (!sources.length) continue;
      const group = new THREE.Group(),
        center = new THREE.Vector3();
      sources.forEach((m) => center.add(m.getWorldPosition(new THREE.Vector3())));
      center.multiplyScalar(1 / sources.length);
      group.position.copy(center);
      for (const source of sources) {
        const m = new THREE.Mesh(source.geometry, source.material);
        source.matrixWorld.decompose(m.position, m.quaternion, m.scale);
        m.position.sub(center);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }
      this.w.groups.city.add(group);
      this.pieces.push({
        mesh: group,
        life: 7,
        baseScale: group.scale.clone(),
        v: new THREE.Vector3(
          Math.sin(angle) * force + (Math.random() - 0.5) * 6,
          3 + Math.random() * 6,
          Math.cos(angle) * force + (Math.random() - 0.5) * 6,
        ),
        spin: new THREE.Vector3(
          Math.random() * 7 - 3,
          Math.random() * 7 - 3,
          Math.random() * 7 - 3,
        ),
        radius: i < 2 ? 0.22 : 0.12,
      });
    }
    n.scattered = true;
    n.down = 8.5;
    actor.visible = false;
    this.sim.s.scatterCount++;
    this.game.audio.play('crash', { volume: 0.25 });
  }
  restore(n) {
    n.scattered = false;
    n.mesh.visible = true;
    n.mesh.rotation.set(0, n.mesh.rotation.y, 0);
    if (n.bike) n.bike.visible = true;
  }
  removePiece(piece) {
    piece.mesh.removeFromParent();
    this.pieces.splice(this.pieces.indexOf(piece), 1);
  }
  recall() {
    const heli = this.w.expansionVehicles.find((v) => v.type === 'helicopter');
    if (!heli) return;
    const aboard = this.a.vehicle === heli;
    if (aboard) this.exit(true);
    if (heli.body?.world) heli.body.world.removeBody(heli.body);
    const pad = HELIPADS[0];
    heli.mesh.position.set(pad.x, 0, pad.z);
    heli.mesh.rotation.set(0, Math.PI / 2, 0);
    heli.health = 100;
    this.park(heli);
    this.game.toast(
      'BBE AIR ist wieder startklar.',
      'Der Helikopter steht auf dem H-Landeplatz westlich des Büros.',
    );
  }
  interact(item) {
    if (item?.kind === 'drinking-bird') {
      this.birdMenu();
      return true;
    }
    if (item?.kind === 'flight-recall') {
      this.recall();
      return true;
    }
    if (item?.kind === 'city-stop') {
      this.visit(item.data);
      return true;
    }
    return false;
  }
  birdMenu() {
    const dry = this.sim.s.birdWater < 1;
    this.game.open(
      'Der einzige Kollege, der immer nickt.',
      `<div class="bird-dialog"><div class="eyebrow">BBE · INOFFIZIELLES TEAMMITGLIED</div><h2>Dr. Dip. Senior Nicker.</h2><p>${dry ? 'Der Vogel steht still. Auch bedingungslose Zustimmung braucht gelegentlich Wasser.' : 'Er nickt jede Folie durch. Inhaltlich schwierig. Für die Stimmung unverzichtbar.'}</p><div class="bird-water"><span style="width:${this.sim.s.birdWater}%"></span></div><p>Wasser im Glas: <strong>${Math.round(this.sim.s.birdWater)} %</strong> · ${this.sim.s.birdRefills} Mal nachgefüllt</p><button class="primary" id="bird-refill">Glas mit Wasser auffüllen</button><p class="muted">Mit leerem Glas hört der Trinkvogel auf. Sein Wasserstand wird gespeichert.</p></div>`,
    );
    document.getElementById('bird-refill').onclick = () => {
      if (this.sim.s.birdWater > 98) {
        this.game.toast('Das Glas ist noch voll.', 'Bitte keine Wasserfall-Projektplanung.');
        return;
      }
      this.game.close();
      this.game.audio.play('water');
      this.birdPourUntil = this.a.time + 1.8;
      this.game.timedAction(
        'Wasser für Dr. Dip',
        'Stakeholder befeuchtet. Zustimmung gesichert.',
        1.8,
        () => {
          const wasDry = this.sim.s.birdWater < 20;
          this.sim.s.birdWater = 100;
          this.sim.s.birdRefills++;
          if (wasDry) this.sim.change('happy', 3);
          this.sim.save();
          this.game.toast('Er nickt wieder.', 'Managementtauglich seit dem letzten Schluck.');
        },
      );
    };
  }
  visit(id) {
    const stop = CITY_STOPS.find((x) => x.id === id);
    if (!stop) return;
    const first = !this.sim.s.cityVisits.includes(id);
    if (first) {
      this.sim.s.cityVisits.push(id);
      this.sim.change('happy', 3);
      this.sim.save();
    }
    this.game.open(
      stop.name,
      `<div class="landmark-note"><span class="tag">${first ? 'NEUE STANDORTNOTIZ' : 'DEIN MÜNCHEN-JOURNAL'}</span><h2>${stop.name}</h2><p>${stop.note}</p><p class="muted">„Standort verstanden. Jetzt fehlt nur noch eine Folie, die so aussieht.“</p><div class="hint-inline">${this.sim.s.cityVisits.length} / ${CITY_STOPS.length} Orte entdeckt. Die Spielkarte ist räumlich verdichtet und frei interpretiert.</div><div class="toolbar"><button class="primary" id="landmark-back">Weiter durch München</button><button id="landmark-hq">BBE als Ziel markieren</button></div></div>`,
    );
    document.getElementById('landmark-back').onclick = () => this.game.close();
    document.getElementById('landmark-hq').onclick = () => {
      this.game.waypoint = { ...CITY_LAYOUT.hq, name: 'BBE Handelsberatung' };
      this.game.close();
    };
    if (first) this.game.audio.play('success');
  }
  update(dt, blocked) {
    const step = this.a.active ? dt : 0,
      car = this.a.vehicle;
    if (blocked) this.fireHeld = false;
    if (this.fireHeld) this.shoot();
    if (this.reloadUntil && this.a.time >= this.reloadUntil) {
      this.reloadUntil = 0;
      this.magazine = 24;
      this.game.audio.play('click');
    }
    this.reticle.hidden = car?.type !== 'bike' || !!this.game.modal;
    if (car?.type === 'bike') {
      const dir = new THREE.Vector3();
      this.w.camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const aim = new THREE.Vector3(car.mesh.position.x, 1.2, car.mesh.position.z)
        .addScaledVector(dir, 35)
        .project(this.w.camera);
      this.reticle.style.left = (aim.x * 0.5 + 0.5) * 100 + '%';
      this.reticle.style.top = (-aim.y * 0.5 + 0.5) * 100 + '%';
    }
    this.reticle.classList.toggle('hit', this.a.time < (this.hitUntil || 0));
    this.reticle.querySelector('span').textContent = this.reloadUntil
      ? 'NACHLADEN…'
      : `DRIVE-BY · ${this.magazine} / 24 · F FEUERN · T LADEN`;
    this.weapon.visible = car?.type === 'bike' && this.w.zone === 'city';
    this.touch.hidden = !isSpecialVehicle(car) || !!this.game.modal;
    this.touch.classList.toggle('flight', car?.type === 'helicopter');
    for (const v of this.w.expansionVehicles) {
      if (v.type !== 'helicopter') continue;
      if (v !== car) v.rotorSpeed = THREE.MathUtils.damp(v.rotorSpeed, 0, 1.1, step);
      if (v.mesh.userData.mainRotor)
        v.mesh.userData.mainRotor.rotation.y += step * v.rotorSpeed * 39;
      if (v.mesh.userData.tailRotor)
        v.mesh.userData.tailRotor.rotation.x += step * v.rotorSpeed * 62;
    }
    for (const p of [...this.pieces]) {
      p.life -= step;
      p.v.y -= step * 15;
      const before = p.mesh.position.clone();
      p.mesh.position.addScaledVector(p.v, step);
      p.mesh.rotation.x += p.spin.x * step;
      p.mesh.rotation.y += p.spin.y * step;
      p.mesh.rotation.z += p.spin.z * step;
      if (p.mesh.position.y < p.radius) {
        p.mesh.position.y = p.radius;
        p.v.y = Math.abs(p.v.y) * 0.35;
        p.v.x *= 0.83;
        p.v.z *= 0.83;
        p.spin.multiplyScalar(0.75);
      }
      for (const body of this.w.zoneData.city.physics.bodies) {
        const h = body.shapes[0]?.halfExtents;
        if (
          body.mass ||
          !h ||
          p.mesh.position.y > body.position.y + h.y ||
          p.mesh.position.y < body.position.y - h.y
        )
          continue;
        if (
          Math.abs(p.mesh.position.x - body.position.x) < h.x &&
          Math.abs(p.mesh.position.z - body.position.z) < h.z
        ) {
          p.mesh.position.x = before.x;
          p.mesh.position.z = before.z;
          p.v.x *= -0.3;
          p.v.z *= -0.3;
          break;
        }
      }
      p.mesh.scale.setScalar(p.life < 1 ? Math.max(0.001, p.life) : 1);
      if (p.life <= 0) this.removePiece(p);
    }
    for (const t of [...this.tracers]) {
      t.life -= step;
      t.mesh.material.opacity = Math.max(0, t.life / 0.085);
      if (t.life <= 0) {
        t.mesh.removeFromParent();
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(this.tracers.indexOf(t), 1);
      }
    }
    const bird = this.w.drinkingBird;
    if (bird) {
      const s = this.sim.s;
      s.birdWater = Math.max(0, s.birdWater - step * 0.26);
      this.birdTime += step;
      const wet = s.birdWater > 0;
      if (bird.userData.pivot)
        bird.userData.pivot.rotation.x = wet
          ? Math.sin(this.birdTime * 1.25) * 0.22 +
            Math.pow(Math.max(0, Math.sin(this.birdTime * 0.78)), 8) * 1.25
          : 0.12;
      const ratio = Math.max(0.001, s.birdWater / 100);
      if (bird.userData.water) {
        bird.userData.water.scale.y = ratio;
        bird.userData.water.position.y = 0.0665 + 0.0845 * ratio;
        bird.userData.water.visible = s.birdWater > 0;
      }
      if (bird.userData.waterSurface) {
        bird.userData.waterSurface.position.y = 0.0665 + 0.169 * ratio;
        bird.userData.waterSurface.visible = s.birdWater > 0;
      }
      this.birdStream.visible = this.a.time < (this.birdPourUntil || 0);
      this.birdStream.scale.x = 0.8 + Math.sin(this.birdTime * 45) * 0.2;
      const target = this.w.zoneData.office.interactions.find((i) => i.kind === 'drinking-bird');
      if (target)
        target.label = `Trinkvogel · ${Math.round(s.birdWater)} % Wasser${wet ? '' : ' · Nachfüllen!'}`;
    }
    if (!isSpecialVehicle(car))
      setHTML(document.getElementById('arcade-guide'), 'F1 <span>Steuerung</span>');
    if (isSpecialVehicle(car)) {
      setHTML(
        document.getElementById('arcade-guide'),
        car.type === 'bike'
          ? 'F1 <span>Steuerung · Fahrrad</span>'
          : 'F1 <span>Steuerung · Helikopter</span>',
      );
      this.w.nearest = {
        kind: 'vehicle-exit',
        label: car.type === 'bike' ? 'Fahrrad abstellen' : 'Helikopter verlassen · erst landen',
      };
      const dash = document.getElementById('drive-hud');
      setHTML(
        dash,
        car.type === 'bike'
          ? `<strong>${Math.round(Math.abs(this.a.speed) * 3.6)} <small>km/h</small></strong><span>FAHRRAD · DRIVE-BY</span><small>W/S Pedale · A/D Lenken · SPACE Bremse<br>F Feuern · T Nachladen · H Klingel · E Absteigen</small>`
          : `<strong>${Math.round(car.mesh.position.y)} <small>m Höhe</small></strong><span>${Math.round(Math.abs(this.a.speed) * 3.6)} km/h · ${Math.round(car.health)} % Zustand</span><small>W/S Flug · A/D Drehen · SPACE Hoch · C Runter<br>E Aussteigen am Boden · H-Kreise = Landeplätze</small>`,
      );
    }
  }
  drawMap(ctx, { X, Z, scale, mini, surfaces = true }) {
    for (const r of surfaces ? EXPANSION_ROADS : []) {
      ctx.fillStyle = '#152c35';
      ctx.fillRect(X(r.x - r.w / 2), Z(r.z - r.d / 2), r.w * scale, r.d * scale);
    }
    for (const b of surfaces ? this.w.expansionBlocks || [] : []) {
      ctx.fillStyle = '#34515a';
      ctx.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * scale, b.d * scale);
    }
    for (const stop of CITY_STOPS) {
      ctx.fillStyle = this.sim.s.cityVisits.includes(stop.id) ? '#9dceb2' : '#e3c189';
      ctx.beginPath();
      ctx.arc(X(stop.x), Z(stop.z), mini ? 5 : 6, 0, Math.PI * 2);
      ctx.fill();
      if (!mini) {
        ctx.textAlign = 'center';
        ctx.font = '600 13px Arial';
        ctx.fillText(stop.name, X(stop.labelX), Z(stop.labelZ) - 14);
      }
    }
    for (const pad of HELIPADS) {
      ctx.strokeStyle = '#99ccc6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(pad.x), Z(pad.z), mini ? 8 : 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#bce1d4';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('H', X(pad.x), Z(pad.z) + 1);
    }
    for (const bike of this.w.expansionVehicles.filter((v) => v.type === 'bike')) {
      ctx.fillStyle = '#b6cee0';
      ctx.fillRect(X(bike.mesh.position.x) - 3, Z(bike.mesh.position.z) - 3, 6, 6);
    }
    ctx.textAlign = 'left';
  }
}
