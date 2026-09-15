import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ROOF_ROUTE } from './vertical-city.js';
const ease = (t) => t * t * (3 - 2 * t);
export class Locomotion {
  constructor(d) {
    this.d = d;
    this.g = d.game;
    this.w = d.world;
    this.a = d.arcade;
    this.action = null;
    this.land = 0;
    this.lastY = 0;
    this.lastV = 0;
    this.cooldown = 0;
    window.addEventListener('keydown', (e) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        !this.a.vehicle &&
        !this.g.modal &&
        !this.g.busy &&
        this.g.started
      ) {
        e.preventDefault();
        this.jumpOrVault();
      }
    });
  }
  grounded() {
    const b = this.w.zoneData[this.w.zone].body;
    let support = false;
    this.w.zoneData[this.w.zone].physics.raycastAll(
      new CANNON.Vec3(b.position.x, b.position.y - 0.2, b.position.z),
      new CANNON.Vec3(b.position.x, b.position.y - 0.48, b.position.z),
      { skipBackfaces: true },
      (r) => {
        if (r.body !== b && r.body.collisionResponse !== false) support = true;
      },
    );
    return support && Math.abs(b.velocity.y) < 1.7;
  }
  freeAt(x, y, z, r = 0.34) {
    for (const b of this.w.zoneData[this.w.zone].physics.bodies) {
      const h = b.shapes[0]?.halfExtents;
      if (
        !h ||
        b.mass ||
        b.walkSurface ||
        b.collisionResponse === false ||
        b.position.y + h.y < y + 0.12 ||
        b.position.y - h.y > y + 1.7
      )
        continue;
      const p = b.pointToLocalFrame(new CANNON.Vec3(x, y + 0.85, z));
      if (Math.abs(p.x) < h.x + r && Math.abs(p.z) < h.z + r && Math.abs(p.y) < h.y + 0.82)
        return false;
    }
    return true;
  }
  jumpOrVault() {
    if (this.action || this.d.time < this.cooldown || !this.grounded()) return;
    const p = this.w.player.position,
      dir = new THREE.Vector3(-Math.sin(this.w.yaw), 0, -Math.cos(this.w.yaw));
    let best = null;
    for (const body of this.w.zoneData[this.w.zone].physics.bodies) {
      const h = body.shapes[0]?.halfExtents;
      if (!h || body.mass || body.collisionResponse === false) continue;
      const top = body.position.y + h.y;
      if (top < p.y + 0.35 || top > p.y + 1.65) continue;
      const delta = new THREE.Vector3(body.position.x - p.x, 0, body.position.z - p.z),
        along = delta.dot(dir);
      if (
        along > 0.2 &&
        along < 2.5 &&
        Math.abs(delta.x * dir.z - delta.z * dir.x) < Math.max(h.x, h.z) + 0.2
      ) {
        const depth = Math.abs(dir.x) * h.x + Math.abs(dir.z) * h.z;
        const end = p.clone().addScaledVector(dir, along + depth + 0.75);
        if (this.freeAt(end.x, p.y, end.z))
          best = {
            from: p.clone(),
            to: end,
            height: top - p.y + 0.35,
            type: 'vault',
            duration: 0.78,
          };
      }
    }
    if (this.w.zone === 'city')
      for (const c of this.w.cars) {
        if (
          !c.mesh.visible ||
          Math.abs(c.mesh.position.y - p.y) > 2 ||
          ['bus', 'van', 'helicopter'].includes(c.type) ||
          Math.abs(c.speed) > 1
        )
          continue;
        const delta = c.mesh.position.clone().sub(p),
          along = delta.dot(dir);
        if (along > 0 && along < 2.5 && Math.abs(delta.x * dir.z - delta.z * dir.x) < 1.5) {
          const end = p.clone().addScaledVector(dir, 5);
          if (this.freeAt(end.x, p.y, end.z))
            best = { from: p.clone(), to: end, height: 1.8, type: 'slide', duration: 1.05 };
        }
      }
    if (best) {
      this.begin(best);
      this.g.audio.sample('aaa_cloth_vault', { volume: 0.35 });
      this.g.sim.s.vaults++;
    } else {
      this.w.zoneData[this.w.zone].body.velocity.y = 6.2;
      this.cooldown = this.d.time + 0.45;
      this.g.audio.play('swing');
    }
  }
  begin(action) {
    this.action = {
      ...action,
      from: new THREE.Vector3(action.from.x, action.from.y, action.from.z),
      to: new THREE.Vector3(action.to.x, action.to.y, action.to.z),
      elapsed: 0,
    };
    this.w.keys.clear();
  }
  board(car) {
    if (car.exploded) {
      this.g.toast('Totalschaden · Dieses Auto fährt nicht mehr.');
      return true;
    }
    if (this.action) return true;
    const p = car.mesh.position,
      side = new THREE.Vector3(-Math.cos(car.mesh.rotation.y), 0, Math.sin(car.mesh.rotation.y)),
      from = this.w.player.position.clone(),
      edge = p.clone().addScaledVector(side, (car.width || 1.85) / 2 + 0.55);
    edge.y = 0;
    if (!this.freeAt(edge.x, edge.y, edge.z)) {
      this.g.toast('Die Fahrertür ist blockiert.', 'Von der anderen Seite nähern.');
      return true;
    }
    this.d.vehicles.openDoor(car, true);
    this.begin({
      from,
      to: edge,
      type: 'board',
      height: 0,
      duration: 1.05,
      car,
      done: () => {
        this.a.enterCar(car);
        this.d.vehicles.openDoor(car, false);
      },
    });
    return true;
  }
  useDoor(item) {
    const door = this.w.cityDoors[item.data];
    if (!door) return;
    door.opened = !door.opened;
    if (door.opened && door.body.world) door.body.world.removeBody(door.body);
    else if (!door.opened && !door.body.world)
      this.w.zoneData[door.zone].physics.addBody(door.body);
    this.g.audio.sample('aaa_door_slam', { volume: 0.45 });
  }
  surfaceAt(x, z, y) {
    for (const s of this.w.stairs || [])
      if (Math.abs(x - s.x) < s.w / 2 && z >= s.z0 - 0.15 && z <= s.z1 + 0.15)
        return THREE.MathUtils.lerp(
          s.y0,
          s.y1,
          THREE.MathUtils.clamp((z - s.z0) / (s.z1 - s.z0), 0, 1),
        );
    const roofs = ROOF_ROUTE.filter(
      (r) => Math.abs(x - r.x) < r.w / 2 - 0.2 && Math.abs(z - r.z) < r.d / 2 - 0.2,
    );
    return roofs.length ? Math.max(...roofs.map((r) => r.y)) : null;
  }
  updateControlled(dt, blocked) {
    this.speed = 0;
    if (this.action) {
      const a = this.action;
      if (blocked) return true;
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration),
        p = a.from.clone().lerp(a.to, ease(t));
      if (a.type === 'vault' || a.type === 'slide') p.y += Math.sin(Math.PI * t) * a.height;
      if (a.type === 'ladder') {
        const up = a.to.y > a.from.y;
        if (up) {
          const climb = Math.min(1, t / 0.82);
          p.set(a.from.x, THREE.MathUtils.lerp(a.from.y, a.to.y, ease(climb)), a.from.z);
          if (t > 0.82) p.lerp(a.to, ease((t - 0.82) / 0.18));
        } else {
          if (t < 0.18)
            p.copy(a.from).lerp(new THREE.Vector3(a.to.x, a.from.y, a.to.z), ease(t / 0.18));
          else
            p.set(a.to.x, THREE.MathUtils.lerp(a.from.y, a.to.y, ease((t - 0.18) / 0.82)), a.to.z);
        }
      }
      const b = this.w.zoneData[this.w.zone].body;
      b.position.set(p.x, p.y + 0.34, p.z);
      b.velocity.setZero();
      b.aabbNeedsUpdate = true;
      this.w.zoneData[this.w.zone].physics.broadphase.dirty = true;
      this.w.player.position.copy(p);
      if (Math.hypot(a.to.x - a.from.x, a.to.z - a.from.z) > 0.001)
        this.w.player.rotation.y = Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z);
      if (t === 1) {
        this.action = null;
        this.cooldown = this.d.time + 0.3;
        a.done?.();
      }
      return true;
    }
    if (!this.a.vehicle) {
      const b = this.w.zoneData[this.w.zone].body;
      if (this.w.zone === 'city' && b.position.y > 8 && b.velocity.y < 0.8) {
        const keys = this.w.keys,
          forward = blocked
            ? 0
            : (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
              (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
          side = blocked
            ? 0
            : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
              (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
          speed = keys.has('ShiftLeft') ? 5.4 : 3,
          n = Math.hypot(forward, side) || 1,
          vx = ((-Math.sin(this.w.yaw) * forward + Math.cos(this.w.yaw) * side) / n) * speed,
          vz = ((-Math.cos(this.w.yaw) * forward - Math.sin(this.w.yaw) * side) / n) * speed,
          x = b.position.x + vx * dt,
          z = b.position.z + vz * dt,
          h = this.surfaceAt(x, z, b.position.y - 0.34);
        if (h !== null && Math.abs(b.position.y - 0.34 - h) < 0.7) {
          if (this.freeAt(x, h, z)) {
            b.position.set(x, h + 0.34, z);
            if (vx || vz) this.w.player.rotation.y = Math.atan2(vx, vz);
          }
          b.velocity.setZero();
          this.speed = Math.hypot(vx, vz);
          this.w.moveSpeed = this.speed;
          this.w.pose = 'walk';
          return true;
        }
      }
      for (const s of this.w.zone === 'city' ? this.w.stairs || [] : []) {
        if (
          Math.abs(b.position.x - s.x) < s.w / 2 - 0.15 &&
          b.position.z > s.z0 &&
          b.position.z < s.z1
        ) {
          const h = THREE.MathUtils.lerp(s.y0, s.y1, (b.position.z - s.z0) / (s.z1 - s.z0));
          if (Math.abs(b.position.y - 0.34 - h) < 0.65 && b.velocity.y < 1) {
            b.position.y = h + 0.37;
            b.velocity.y = 0;
          }
        }
      }
    }
    return false;
  }
  pose(dt) {
    if (this.a.vehicle) return;
    const b = this.w.zoneData[this.w.zone].body,
      p = this.w.player,
      r = p.userData.rig;
    p.position.y =
      b.position.y - 0.34 - (['eat', 'seated', 'work'].includes(this.w.pose) ? 0.23 : 0);
    const a = this.action;
    if (a) {
      const t = a.elapsed / a.duration;
      if (a.type === 'ladder') {
        r.leftArm.rotation.x = -2.7 + Math.sin(t * 35) * 0.35;
        r.rightArm.rotation.x = -2.7 - Math.sin(t * 35) * 0.35;
        r.leftLeg.rotation.x = Math.sin(t * 35) * 0.6;
        r.rightLeg.rotation.x = -Math.sin(t * 35) * 0.6;
      } else if (a.type === 'door') {
        r.leftLeg.rotation.x = r.rightLeg.rotation.x = 0;
        r.leftShin.rotation.x = r.rightShin.rotation.x = 0;
        r.rightArm.rotation.x = -0.75 * Math.sin(Math.PI * t);
        r.rightFore.rotation.x = -0.35;
      } else if (a.type === 'slide') {
        p.rotation.z = Math.sin(Math.PI * t) * 1.0;
        r.leftLeg.rotation.x = -1.0;
        r.rightLeg.rotation.x = -0.7;
      } else {
        r.leftArm.rotation.x = -1.4;
        r.rightArm.rotation.x = -1.4;
        r.leftLeg.rotation.x = -0.8;
        r.rightLeg.rotation.x = 0.3;
      }
    } else {
      p.rotation.z = 0;
      if (b.velocity.y < -3) {
        r.leftArm.rotation.z = 0.45;
        r.rightArm.rotation.z = -0.45;
      } else {
        r.leftArm.rotation.z = 0;
        r.rightArm.rotation.z = 0;
      }
      if (this.lastV < -4 && b.velocity.y > -0.5) {
        this.land = Math.min(0.45, -this.lastV * 0.035);
        this.g.audio.play('kick');
        if (this.lastV < -13) this.g.sim.change('health', -Math.min(30, (-this.lastV - 13) * 2));
      }
      this.land = Math.max(0, this.land - dt);
      if (this.land) {
        p.position.y -= Math.sin((this.land / 0.45) * Math.PI) * 0.22;
        r.leftLeg.rotation.x = -this.land;
        r.rightLeg.rotation.x = -this.land;
      }
    }
    this.lastV = b.velocity.y;
  }
  cancel() {
    if (this.action?.car) this.d.vehicles.openDoor(this.action.car, false);
    this.action = null;
    this.land = 0;
    this.w.player.rotation.z = 0;
  }
}
