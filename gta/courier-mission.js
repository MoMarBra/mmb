import { CITY_LAYOUT } from './city-layout.js';
import { human, animateHuman, label } from './world.js';
import * as THREE from 'three';
import { createStreetProp, createWinchHook } from './aaa-props.js';
import { COURIER_DESTINATION, ROOF_ROUTE } from './vertical-city.js';
export class CourierMission {
  constructor(d) {
    this.d = d;
    this.g = d.game;
    this.w = d.world;
    this.a = d.arcade;
    this.mesh = createStreetProp(THREE, 'suitcase');
    this.mesh.userData.handle.scale.y = 0.1;
    this.w.scene.add(this.mesh);
    this.mesh.name = 'BBE workshop case';
    this.grip = new THREE.Vector3(0, 0.724, 0.038);
    this.hand = new THREE.Vector3();
    label(this.mesh, 'BBE · WORKSHOP', 0, 0.51, 0.182, 0.34, 0.1, { bg: '#e6c782', fg: '#173d4e' });
    this.hook = createWinchHook(THREE);
    this.w.groups.city.add(this.hook);
    this.rope = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: '#26373c' }),
    );
    this.w.groups.city.add(this.rope);
    this.client = human({ jacket: '#66534c', pants: '#343f4b' });
    this.client.position.set(
      COURIER_DESTINATION.x,
      COURIER_DESTINATION.y,
      COURIER_DESTINATION.z + 1.4,
    );
    this.client.rotation.y = Math.PI;
    this.w.groups.city.add(this.client);
    this.length = 2;
    this.lowered = false;
    this.hooked = false;
    if (this.g.sim.s.courier.active) {
      this.g.sim.s.courier.mode = 'carry';
      this.g.toast('Eilauftrag fortgesetzt.', 'Koffer am BBE-Arbeitsplatz.');
    }
    window.addEventListener('keydown', (e) => {
      if (e.repeat || this.g.modal || this.g.busy || !this.g.started || !this.a.active) return;
      if (e.code === 'KeyB' && this.state.active) {
        e.preventDefault();
        this.drop();
      }
      if (e.code === 'KeyQ' && this.a.vehicle?.type === 'helicopter') {
        this.lowered = !this.lowered;
        this.g.toast(
          'Seilwinde',
          this.lowered ? 'Ausgefahren · X einhängen' : 'Eingeholt · X lösen',
        );
      }
      if (e.code === 'KeyX' && this.a.vehicle?.type === 'helicopter') this.attach();
    });
  }
  get state() {
    return this.g.sim.s.courier;
  }
  brief() {
    if (this.g.workshop?.active || this.g.fireStory?.active) {
      this.g.toast(
        this.g.fireStory?.active
          ? 'Zuerst Ticket in Flammen abschließen.'
          : 'Zuerst den Workshop-Koffer abgeben.',
      );
      return;
    }
    if (this.state.active) {
      this.g.toast('Koffer zum Kunden bringen.', 'M · Route');
      return;
    }
    this.g.audio.voices?.say('Lena', 'mission.briefing', {
      preview: true,
      force: true,
      priority: 4,
    });
    this.g.open(
      'Eilauftrag · Koffer',
      `<div class="mission-brief"><p>Koffer zum Kunden hinter der BBE bringen.</p><p class="mission-row-meta">6 min · 90 € + Bonus · 45 XP · +4 REP</p><button class="primary" id="courier-accept">Koffer übernehmen</button><details class="mission-help"><summary>Wege &amp; Bonus</summary><p class="mission-row-meta">Empfang, Dachweg oder Seilwinde.<br>Dach: +35 € · Restzeit: bis +30 €</p><button id="courier-routes">Mara fragen</button></details><div id="dialogue-voice-slot"></div></div>`,
      { pause: true },
    );
    document.getElementById('courier-routes').onclick = () =>
      this.g.audio.voices?.say('Mara', 'mission.routes', {
        preview: true,
        force: true,
        priority: 4,
      });
    document.getElementById('courier-accept').onclick = () => {
      this.g.close();
      this.g.audio.setActive?.(true);
      this.g.audio.voices?.say('player', 'mission.pickup', { force: true, priority: 4 });
      this.g.sim.s.courier = {
        active: true,
        remaining: 360,
        mode: 'carry',
        position: [-8, 0, 2],
        integrity: 100,
        air: false,
        roof: false,
      };
      this.g.waypoint = {
        name: 'Kunde · Dachtermin',
        x: COURIER_DESTINATION.x,
        z: COURIER_DESTINATION.z,
      };
      this.g.sim.save();
      this.g.toast('Eilauftrag gestartet.', '6 min · Koffer zum Kunden bringen.');
    };
  }
  drop() {
    if (this.state.mode !== 'carry' || this.a.vehicle) return;
    const p = this.w.player.position;
    this.state.mode = 'ground';
    this.state.zone = this.w.zone;
    this.state.position = [p.x - Math.sin(this.w.yaw), p.y, p.z - Math.cos(this.w.yaw)];
    this.g.audio.voices?.say('Mara', 'mission.dropped');
    this.g.sim.save();
  }
  attach() {
    if (
      !this.state.active ||
      this.w.zone !== 'city' ||
      this.a.vehicle?.type !== 'helicopter' ||
      this.state.zone !== 'city' ||
      !this.mesh.visible
    )
      return;
    if (this.hooked) {
      this.hooked = false;
      this.state.mode = 'ground';
      this.state.zone = 'city';
      this.state.position = this.mesh.position.toArray();
      this.g.toast('Last gelöst.', 'E · Koffer übergeben');
      return;
    }
    if (this.state.mode === 'ground' || this.state.mode === 'snagged') {
      if (this.hook.position.distanceTo(this.mesh.position) < 3) {
        this.hooked = true;
        this.state.mode = 'winch';
        this.state.air = true;
        this.g.toast('Koffer eingehängt.');
      } else this.g.toast('Koffer außer Reichweite.', 'Q · Winde näher heranführen');
    }
  }
  deliver(route) {
    const s = this.state;
    if (!s.active) {
      this.g.toast('Eilauftrag am BBE-Empfang starten.');
      return;
    }
    if (
      s.mode !== 'carry' &&
      !(
        s.zone === 'city' &&
        new THREE.Vector3(...s.position).distanceTo(
          new THREE.Vector3(COURIER_DESTINATION.x, COURIER_DESTINATION.y, COURIER_DESTINATION.z),
        ) < 4
      )
    ) {
      this.g.toast('Koffer fehlt.', 'Aufnehmen oder auf der Terrasse absetzen.');
      return;
    }
    const earned = 90 + (route === 'roof' ? 35 : 0) + Math.floor(s.remaining / 12),
      air = s.air;
    s.active = false;
    s.mode = 'done';
    this.hooked = false;
    this.g.sim.s.courierCompleted++;
    if (this.g.waypoint?.name === 'Kunde · Dachtermin') this.g.waypoint = null;
    this.g.sim.transaction(
      earned,
      'BBE · Eilauftrag ' +
        (air ? 'Lufttransport' : route === 'roof' ? 'Dachroute' : 'Kundenempfang'),
    );
    this.g.sim.s.xp += 45;
    this.w.makeWorkstation();
    this.g.sim.change('rep', 4);
    this.g.sim.save();
    this.g.toast('Koffer geliefert.', '+' + earned + ' € · +45 XP · +4 REP');
    this.g.sim.emit('mission-complete', 'BBE · Eilauftrag', {
      id: 'courier:' + this.g.sim.s.courierCompleted,
    });
    this.g.audio.voices?.say('Lena', 'mission.success');
  }
  interact(n) {
    if (n?.kind === 'courier-start') {
      this.brief();
      return true;
    }
    if (n?.kind === 'courier-deliver') {
      this.deliver(n.data);
      return true;
    }
    if (n?.kind === 'courier-pick') {
      const recovered = this.state.mode === 'snagged';
      this.g.audio.voices?.say('Lena', recovered ? 'mission.recovery' : 'mission.carry', {
        force: true,
      });
      this.state.mode = 'carry';
      this.hooked = false;
      this.g.sim.save();
      this.g.toast('Koffer aufgenommen.');
      return true;
    }
    return false;
  }
  transition() {
    if (this.hooked) {
      this.hooked = false;
      this.state.mode = 'carry';
    }
    if (this.state.active && this.state.mode === 'vehicle') this.state.mode = 'carry';
  }
  update(dt) {
    animateHuman(this.client, this.d.time, 0, 'phone');
    this.client.position.y = 15.85;
    const s = this.state,
      car = this.a.vehicle;
    this.mesh.visible =
      !this.g.workshop?.active &&
      (!!s.active || (this.w.zone === 'office' && this.w.player.position.x < 22));
    this.mesh.rotation.set(0, 0, 0);
    if (!s.active) {
      this.mesh.position.set(-2.65, 0.015, 6.4);
      this.mesh.rotation.y = Math.PI / 2;
    }
    const heli = car?.type === 'helicopter' ? car : null;
    this.hook.visible = this.rope.visible = !!heli;
    if (heli) {
      const target = this.lowered ? 25 : 2,
        old = this.length;
      this.length = THREE.MathUtils.damp(this.length, target, 0.8, dt);
      const cp = heli.mesh.position,
        hookY = Math.max(0.3, cp.y + 1 - this.length);
      this.hook.position.set(
        cp.x + Math.sin(this.d.time * 1.6) * Math.min(2, Math.abs(this.a.speed) * 0.055),
        hookY,
        cp.z - Math.cos(heli.mesh.rotation.y) * Math.min(2, Math.abs(this.a.speed) * 0.08),
      );
      const attr = this.rope.geometry.attributes.position;
      attr.setXYZ(0, cp.x, cp.y + 1, cp.z);
      attr.setXYZ(1, this.hook.position.x, hookY, this.hook.position.z);
      attr.needsUpdate = true;
      this.rope.geometry.computeBoundingSphere();
      if (Math.abs(old - this.length) > 0.002)
        this.g.audio.requestLoop?.('winch', 'aaa_rope_winch', 0.16, { bus: 'effects' });
    }
    if (!s.active) return;
    s.remaining = Math.max(0, s.remaining - dt);
    if (s.remaining === 0) {
      s.active = false;
      s.mode = 'failed';
      this.hooked = false;
      this.g.sim.change('rep', -2);
      this.g.sim.save();
      this.g.toast('Zeit abgelaufen.', 'Neustart am BBE-Empfang.');
      return;
    }
    if (s.mode === 'carry' && car) {
      if (heli) {
        s.mode = 'ground';
        s.zone = 'city';
        s.position = [car.mesh.position.x + 4, 0, car.mesh.position.z];
        this.g.toast('Koffer am Landeplatz.', 'Q · Winde  |  X · Anhängen');
      } else {
        s.mode = 'vehicle';
      }
    }
    if (s.mode === 'vehicle' && !car) s.mode = 'carry';
    if (s.mode === 'carry') {
      const p = this.w.player,
        r = p.userData.rig;
      // Steady shoulder, slightly bent elbow: the handle stays in the palm above the pavement.
      if (!this.a.punchTime && !this.d.motion.action) {
        r.rightArm.rotation.x = -0.18;
        r.rightArm.rotation.z = -0.2;
        r.rightFore.rotation.x = -0.22;
      }
      p.updateWorldMatrix(true, true);
      this.hand.set(0, -0.3, 0).applyMatrix4(r.rightFore.matrixWorld);
      this.mesh.rotation.y = p.rotation.y + Math.PI;
      this.mesh.position
        .copy(this.hand)
        .sub(this.grip.clone().applyQuaternion(this.mesh.quaternion));
      s.zone = this.w.zone;
    } else if (s.mode === 'vehicle') {
      this.mesh.position
        .copy(car.mesh.position)
        .add(new THREE.Vector3(0.35, 0.45, -0.5).applyQuaternion(car.mesh.quaternion));
      this.mesh.visible = car.type === 'bike';
      if (car.type === 'bike') {
        this.mesh.rotation.set(Math.PI / 2, car.mesh.rotation.y, 0, 'YXZ');
        this.mesh.position
          .copy(car.mesh.position)
          .add(new THREE.Vector3(0, 0.98, -0.47).applyQuaternion(car.mesh.quaternion));
      } else this.mesh.rotation.y = car.mesh.rotation.y;
    } else if (s.mode === 'winch' && this.hooked) {
      this.mesh.position.copy(this.hook.position).add(new THREE.Vector3(0, -0.73, 0));
      this.mesh.rotation.z = Math.sin(this.d.time * 2) * 0.15;
      s.position = this.mesh.position.toArray();
      s.zone = 'city';
      if (
        Math.abs(this.mesh.position.x - CITY_LAYOUT.balcony.x) < 3 &&
        Math.abs(this.mesh.position.z - 44) < 2 &&
        this.mesh.position.y < 10.6 &&
        this.mesh.position.y > 8
      ) {
        this.hooked = false;
        s.mode = 'snagged';
        s.position = [CITY_LAYOUT.balcony.x, CITY_LAYOUT.balcony.y, CITY_LAYOUT.balcony.z];
        this.g.toast('Koffer am Balkon bergen.', 'Hofleiter nehmen · E aufnehmen');
      }
    } else {
      this.mesh.position.fromArray(s.position);
      this.mesh.visible = s.zone === this.w.zone;
      const dest = COURIER_DESTINATION;
      if (s.zone === 'city' && this.mesh.position.y > 0 && s.mode !== 'snagged') {
        const roof = ROOF_ROUTE.filter(
          (r) =>
            r.y <= this.mesh.position.y + 0.2 &&
            Math.abs(this.mesh.position.x - r.x) < r.w / 2 &&
            Math.abs(this.mesh.position.z - r.z) < r.d / 2,
        ).reduce((h, r) => Math.max(h, r.y), 0);
        this.mesh.position.y = Math.max(roof, this.mesh.position.y - dt * 5);
        s.position = this.mesh.position.toArray();
      }
      if (this.mesh.visible && this.mesh.position.distanceTo(this.w.player.position) < 2 && !car)
        this.w.nearest = { kind: 'courier-pick', label: 'Präsentationskoffer aufnehmen' };
      if (
        s.zone === 'city' &&
        this.mesh.position.distanceTo(new THREE.Vector3(dest.x, dest.y, dest.z)) < 3 &&
        !this.hooked &&
        s.air
      )
        this.deliver('roof');
    }
    if (this.w.player.position.y > 14) s.roof = true;
  }
}
