import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createStreetProp } from './aaa-props.js';
import { rayBoxDistance } from './expansion.js';
export class StreetPhysics {
  constructor(d) {
    this.d = d;
    this.w = d.world;
    this.g = d.game;
    this.a = d.arcade;
    this.items = [];
    this.panes = [];
    this.bits = [];
    this.held = null;
    const layout = [
      ['bin', -17, 35],
      ['bin', 15, 25],
      ['barrier', -13, 16],
      ['barrier', -14, 18],
      ['chair', -18, 30],
      ['chair', -20, 30],
      ['shopping-cart', 73, 53],
      ['bin', 70, 60],
      ['chair', 80, 54],
      ['bin', 14, -68],
      ['barrier', 263, 274],
      ['chair', 277, 267],
      ['chair', 280, 267],
      ['bin', 343, 305],
    ];
    layout.forEach(([type, x, z], i) => this.add(type, x, 0, z, 'prop-' + i));
    for (const [x, z] of [
      [65, 56],
      [16, 35],
      [266, 266],
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.5, 0.035),
        new THREE.MeshPhysicalMaterial({
          color: '#9bd2d8',
          transparent: true,
          opacity: 0.34,
          roughness: 0.05,
          metalness: 0.2,
        }),
      );
      mesh.position.set(x, 1.25, z);
      this.w.groups.city.add(mesh);
      for (const [xx, yy, sx, sy] of [
        [x - 1.25, 1.25, 0.08, 2.7],
        [x + 1.25, 1.25, 0.08, 2.7],
        [x, 2.55, 2.6, 0.08],
      ]) {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(sx, sy, 0.13),
          new THREE.MeshStandardMaterial({ color: '#496168', roughness: 0.5, metalness: 0.4 }),
        );
        frame.position.set(xx, yy, z);
        frame.castShadow = true;
        this.w.groups.city.add(frame);
      }
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(1.2, 1.25, 0.02)),
      });
      body.position.copy(mesh.position);
      this.w.zoneData.city.physics.addBody(body);
      this.panes.push({ mesh, body, broken: false });
    }
    window.addEventListener('keydown', (e) => {
      if (
        e.code === 'KeyG' &&
        !e.repeat &&
        !this.g.modal &&
        !this.g.busy &&
        this.a.active &&
        !this.d.motion.action
      ) {
        if (this.held) this.release(true);
        else this.pick();
      }
    });
  }
  add(type, x, y, z, id) {
    const mesh = createStreetProp(THREE, type);
    mesh.position.set(x, y, z);
    mesh.userData.dynamic = true;
    this.w.groups.city.add(mesh);
    const dims = {
      bin: [0.62, 1.1, 0.65, 12],
      chair: [0.65, 0.88, 0.65, 4],
      barrier: [1.65, 1, 0.4, 8],
      'shopping-cart': [0.7, 1, 1.15, 9],
      suitcase: [0.58, 0.43, 0.23, 3],
    }[type];
    const body = new CANNON.Body({
      mass: dims[3],
      shape: new CANNON.Box(new CANNON.Vec3(dims[0] / 2, dims[1] / 2, dims[2] / 2)),
      linearDamping: 0.18,
      angularDamping: 0.3,
      allowSleep: true,
      sleepSpeedLimit: 0.14,
      sleepTimeLimit: 1.2,
    });
    body.position.set(x, y + dims[1] / 2, z);
    this.w.zoneData.city.physics.addBody(body);
    const item = { mesh, body, type, id, height: dims[1], lastSound: 0 };
    body.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 2 && this.d.time > item.lastSound + 1) {
        item.lastSound = this.d.time;
        this.g.audio.sample('aaa_metal_impact', {
          volume: Math.min(0.3, v * 0.025),
          position: body.position,
        });
      }
    });
    this.items.push(item);
    return item;
  }
  pick() {
    if (this.w.zone !== 'city' || this.a.vehicle) return;
    const p = this.w.player.position;
    const item = this.items
      .filter((i) => i.type !== 'suitcase' && i.mesh.position.distanceTo(p) < 2)
      .sort((a, b) => a.mesh.position.distanceTo(p) - b.mesh.position.distanceTo(p))[0];
    if (!item) return;
    this.held = item;
    item.body.collisionResponse = false;
    item.body.wakeUp();
    this.g.toast('Gegenstand aufgenommen.', 'G wirft · E legt ab');
  }
  release(throwIt = false) {
    if (!this.held) return;
    const item = this.held;
    this.held = null;
    item.body.collisionResponse = true;
    const dir = new CANNON.Vec3(-Math.sin(this.w.yaw), 0.35, -Math.cos(this.w.yaw));
    item.body.velocity.set(dir.x * (throwIt ? 10 : 1), throwIt ? 3 : 0, dir.z * (throwIt ? 10 : 1));
    item.body.wakeUp();
    if (throwIt) this.g.sim.s.propsThrown++;
  }
  shards(position, count = 12, color = '#b9e3e5') {
    while (this.bits.length > 90) this.disposeBit(this.bits[0]);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.06 + Math.random() * 0.09),
        new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.6 }),
      );
      mesh.position.copy(position);
      this.w.groups.city.add(mesh);
      this.bits.push({
        mesh,
        life: 10,
        v: new THREE.Vector3(
          Math.random() * 5 - 2.5,
          2 + Math.random() * 4,
          Math.random() * 5 - 2.5,
        ),
      });
    }
  }
  disposeBit(bit) {
    bit.mesh.removeFromParent();
    bit.mesh.geometry.dispose();
    bit.mesh.material.dispose();
    this.bits.splice(this.bits.indexOf(bit), 1);
  }
  shatter(pane) {
    if (pane.broken) return;
    pane.broken = true;
    pane.mesh.visible = false;
    this.w.zoneData.city.physics.removeBody(pane.body);
    this.shards(pane.mesh.position, 18);
    this.g.audio.sample('aaa_glass_break', { volume: 0.4, position: pane.mesh.position });
    this.d.life.emit('glass', pane.mesh.position, 1);
    this.g.sim.s.glassBroken++;
  }
  shot(origin, dir, max, apply = true) {
    let nearest = max,
      item = null;
    for (const p of [...this.items, ...this.panes.filter((p) => !p.broken)]) {
      const hit = rayBoxDistance(origin, dir, p.body, max);
      if (hit < nearest) {
        nearest = hit;
        item = p;
      }
    }
    if (item && apply) {
      if (item.body.mass) {
        item.body.applyImpulse(new CANNON.Vec3(dir.x * 18, 3, dir.z * 18));
        item.body.wakeUp();
      } else this.shatter(item);
    }
    return nearest;
  }
  punch() {
    if (this.w.zone !== 'city') return false;
    const p = this.w.player.position,
      pane = this.panes.find(
        (v) =>
          !v.broken && v.mesh.position.distanceTo(p.clone().add(new THREE.Vector3(0, 1, 0))) < 2.2,
      );
    if (pane) {
      this.shatter(pane);
      return true;
    }
    return false;
  }
  update(dt) {
    if (dt <= 0) return;
    const car = this.a.vehicle,
      p = this.w.player.position;
    for (const item of this.items) {
      const b = item.body;
      if (item === this.held) {
        const dir = new THREE.Vector3(-Math.sin(this.w.yaw), 0, -Math.cos(this.w.yaw)),
          q = p.clone().addScaledVector(dir, 1.1);
        b.position.set(q.x, p.y + 1.15, q.z);
        b.velocity.setZero();
        b.angularVelocity.setZero();
        b.quaternion.setFromEuler(0, this.w.yaw, 0);
      } else if (car && this.w.zone === 'city') {
        const cp = car.mesh.position,
          dist = Math.hypot(cp.x - b.position.x, cp.z - b.position.z);
        if (car.type === 'helicopter' && cp.y > 1 && cp.y < 18 && dist < 10) {
          const power = (1 - cp.y / 20) * (1 - dist / 12);
          b.wakeUp();
          b.applyForce(
            new CANNON.Vec3(
              (b.position.x - cp.x) * power * 18,
              power * 5,
              (b.position.z - cp.z) * power * 18,
            ),
          );
        } else if (
          car.type !== 'helicopter' &&
          dist < (car.length || 4.4) / 2 + 1 &&
          this.a.overlap(this.a.shape(car), {
            x: b.position.x,
            z: b.position.z,
            w: 1,
            l: 1,
            angle: 0,
          }) &&
          Math.abs(b.position.y - cp.y) < 2 &&
          Math.abs(this.a.speed) > 1.5
        ) {
          const angle = car.mesh.rotation.y;
          b.wakeUp();
          b.velocity.set(
            Math.sin(angle) * this.a.speed * 1.15,
            2,
            Math.cos(angle) * this.a.speed * 1.15,
          );
          b.angularVelocity.set(1, 2, 3);
        }
      }
      if (
        item.type === 'bin' &&
        !item.toppled &&
        Math.abs(b.quaternion.x) + Math.abs(b.quaternion.z) > 0.5
      ) {
        item.toppled = true;
        this.g.audio.voices?.say('Lena', 'prop.bin_toppled', { position: b.position });
      }
      if (item !== this.held && b.velocity.length() > 4 && this.d.time > (item.hitAt || 0)) {
        const victim = this.w.zoneData.city.npcs.find(
          (n) =>
            !n.down &&
            n.mesh.visible &&
            Math.abs(n.mesh.position.y - b.position.y) < 1.8 &&
            Math.hypot(n.mesh.position.x - b.position.x, n.mesh.position.z - b.position.z) < 0.6,
        );
        if (victim) {
          item.hitAt = this.d.time + 1;
          this.a.hitNPC(victim, 1, Math.atan2(b.velocity.x, b.velocity.z), 1.5, 'prop');
        }
      }
      item.mesh.position.copy(b.position);
      item.mesh.quaternion.copy(b.quaternion);
      item.mesh.position.add(
        new THREE.Vector3(0, -item.height / 2, 0).applyQuaternion(item.mesh.quaternion),
      );
      if (b.position.y < -5 || Math.abs(b.position.x) > 480 || Math.abs(b.position.z) > 480) {
        b.position.set(73, 1, 53);
        b.velocity.setZero();
      }
    }
    if (car && Math.abs(this.a.speed) > 2)
      for (const pane of this.panes) {
        if (
          !pane.broken &&
          pane.mesh.position.distanceTo(car.mesh.position.clone().add(new THREE.Vector3(0, 1, 0))) <
            3
        )
          this.shatter(pane);
      }
    for (const bit of [...this.bits]) {
      bit.life -= dt;
      bit.v.y -= dt * 10;
      bit.mesh.position.addScaledVector(bit.v, dt);
      bit.mesh.rotation.x += dt * 3;
      if (bit.mesh.position.y < 0.04) {
        bit.mesh.position.y = 0.04;
        bit.v.set(0, 0, 0);
      }
      if (bit.life < 1) bit.mesh.scale.setScalar(Math.max(0.001, bit.life));
      if (bit.life <= 0) this.disposeBit(bit);
    }
  }
}
