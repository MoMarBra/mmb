import { detail, openDoor, syncDriver, setDetailedVehicleLod } from './vehicle-detail.js';
import { alignVehicleWheelsToRoad } from './blender-vehicles.js';
import * as THREE from 'three';
export class VehicleFeel {
  constructor(d) {
    this.d = d;
    this.w = d.world;
    this.a = d.arcade;
    this.g = d.game;
    this.preSpeed = 0;
    this.lastCar = null;
    this.glass = [];
  }
  detail(car) {
    return detail.call(this, car);
  }
  openDoor(car, open, point = null) {
    return openDoor.call(this, car, open, point);
  }
  damage(car, strength, notify = true) {
    this.detail(car);
    if (!car.detailReady) return;
    car.health = Math.max(10, car.health - strength);
    this.g.sim.s.vehicleDamage[car.id] = { health: car.health };
    if (car.dentMesh) {
      const a = car.dentMesh.geometry.attributes.position,
        orig = car.originalVertices,
        f = (100 - car.health) / 100;
      for (let i = 0; i < a.count; i++) {
        const z = orig[i * 3 + 2];
        a.setXYZ(
          i,
          orig[i * 3] * (1 - f * 0.06),
          orig[i * 3 + 1] - (z > 0.22 ? f * 0.08 : 0),
          z - (z > 0.22 ? f * 0.22 : 0),
        );
      }
      a.needsUpdate = true;
      car.dentMesh.geometry.computeVertexNormals();
    }
    if (car.health < 70 && !car.glassBroken) {
      car.glassBroken = true;
      for (const m of car.glazing || []) {
        m.visible = false;
        m.userData.suppressed = true;
      }
      for (const door of car.doors || [])
        for (const pane of door.windows || (door.window ? [door.window] : [])) pane.visible = false;
      this.g.audio.sample('aaa_glass_break', { volume: 0.45, position: car.mesh.position });
      this.d.physics.shards(car.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 15);
    }
    if (notify) this.d.life.emit('crash', car.mesh.position, 1);
    this.g.sim.save();
  }
  update(dt) {
    for (const c of this.w.cars)
      c.driverVisuals?.get('player') && (c.driverVisuals.get('player').visible = false);
    const car = this.a.vehicle;
    for (const c of this.w.cars) {
      if (!c.detailReady) continue;
      setDetailedVehicleLod(c, c !== car && !!c.farLOD);
      if (c !== car && (c.mesh.userData.blenderModel || c.mesh.userData.groundAlignedWheels)) {
        // Exit must not leave the parked car suspended at its last cornering angle.
        c.mesh.position.y = THREE.MathUtils.damp(c.mesh.position.y, 0, 9, dt);
        c.mesh.rotation.x = THREE.MathUtils.damp(c.mesh.rotation.x, 0, 9, dt);
        c.mesh.rotation.z = THREE.MathUtils.damp(c.mesh.rotation.z, 0, 9, dt);
        alignVehicleWheelsToRoad(c);
      }
      for (const door of c.doors || []) {
        door.pivot.rotation.y = THREE.MathUtils.damp(door.pivot.rotation.y, door.target, 9, dt);
        door.pivot.rotation.z = c.health < 40 ? door.side * 0.2 : 0;
      }
    }
    if (!car || ['bike', 'helicopter'].includes(car.type)) {
      this.lastCar = car;
      return;
    }
    this.detail(car);
    const accel = this.lastCar === car ? (this.a.speed - this.preSpeed) / Math.max(dt, 0.016) : 0;
    this.lastCar = car;
    this.preSpeed = this.a.speed;
    const steering = (this.w.keys.has('KeyA') ? 1 : 0) - (this.w.keys.has('KeyD') ? 1 : 0),
      curb = Math.abs(Math.abs(car.mesh.position.x) - 8.4) < 0.9 && car.mesh.position.z < 125,
      bounce = curb
        ? Math.sin(this.d.time * Math.max(8, Math.abs(this.a.speed) * 2)) *
          0.045 *
          Math.min(1, Math.abs(this.a.speed) / 2)
        : Math.sin(this.d.time * 5) * Math.min(0.014, Math.abs(this.a.speed) * 0.001);
    car.mesh.position.y = Math.max(-0.04, bounce);
    car.mesh.rotation.x = THREE.MathUtils.damp(
      car.mesh.rotation.x,
      THREE.MathUtils.clamp(-accel * 0.008, -0.085, 0.085),
      7,
      dt,
    );
    car.mesh.rotation.z = THREE.MathUtils.damp(
      car.mesh.rotation.z,
      -steering * Math.min(0.09, Math.abs(this.a.speed) * 0.006),
      5,
      dt,
    );
    alignVehicleWheelsToRoad(car);
    syncDriver(car, {
      occupied: true,
      role: 'player',
      outsideActor: this.w.player,
      time: this.d.time,
      steering,
      speed: this.a.speed,
    });
    if (curb && Math.abs(this.a.speed) > 7 && this.d.time > (car.curbAt || 0)) {
      car.curbAt = this.d.time + 1.2;
      this.g.audio.sample('aaa_metal_impact', { volume: 0.13 });
    }
  }
}
