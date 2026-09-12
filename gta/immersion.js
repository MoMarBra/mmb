import { setDoor, arrive, INTERIOR_LAYOUT } from './doors.js';
import { CITY_LAYOUT } from './city-layout.js';
import * as THREE from 'three';
import { Locomotion } from './locomotion.js';
import { CityLife } from './city-life.js';
import { VehicleFeel } from './vehicle-feel.js';
import { StreetPhysics } from './street-physics.js';
import { WeatherEffects } from './weather-effects.js';
import { CourierMission } from './courier-mission.js';
export class Immersion {
  constructor(arcade) {
    this.arcade = arcade;
    this.game = arcade.game;
    this.world = arcade.world;
    this.time = 0;
    this.motion = new Locomotion(this);
    this.vehicles = new VehicleFeel(this);
    this.life = new CityLife(this);
    this.physics = new StreetPhysics(this);
    this.weather = new WeatherEffects(this);
    this.courier = new CourierMission(this);
    this.lastZone = this.world.zone;
    const hud = document.createElement('div');
    hud.id = 'immersion-hud';
    hud.innerHTML = '<div id="wanted-hud" hidden></div><div id="courier-hud" hidden></div>';
    document.querySelector('#ui').append(hud);
  }
  interact(n) {
    if (this.motion.action) return true;
    if (this.physics.held) {
      this.physics.release();
      return true;
    }
    if (this.courier.interact(n)) return true;
    if (this.arcade.vehicle) {
      const c = this.arcade.vehicle;
      if (['bike', 'helicopter'].includes(c.type)) return false;
      const before = c.mesh.position.clone();
      if (this.arcade.exitCar()) {
        const end = this.world.player.position.clone();
        this.vehicles.openDoor(c, true, end);
        this.motion.begin({
          from: before,
          to: end,
          type: 'board',
          duration: 0.65,
          done: () => this.vehicles.openDoor(c, false),
        });
      }
      return true;
    }
    if (n?.kind === 'vehicle') return this.motion.board(n.data);
    if (n?.kind === 'traverse') {
      this.motion.begin(n.data);
      return true;
    }
    if (n?.kind === 'room-door') {
      const door = this.world.portals[n.data];
      if (door.opened && Math.abs(this.world.player.position.z - door.root.position.z) < 0.55) {
        this.game.toast('Einen Schritt aus dem Türbereich gehen.');
        return true;
      }
      setDoor(this.world, door, !door.opened);
      this.game.audio.sample('aaa_door_slam', { volume: 0.2 });
      return true;
    }
    if (n?.kind === 'swing-door') {
      this.motion.useDoor(n);
      return true;
    }
    if (n?.kind === 'garage') {
      this.game.transition(n.data === 'in' ? 'office' : 'city');
      this.world.teleport(
        n.data === 'in' ? 57 : CITY_LAYOUT.garageExit.x,
        n.data === 'in' ? 33 : CITY_LAYOUT.garageExit.z,
      );
      arrive(this.world, {
        x: this.world.player.position.x,
        z: this.world.player.position.z,
        yaw: n.data === 'in' ? Math.PI : 0,
      });
      this.game.toast(n.data === 'in' ? 'Tiefgarage · BBE Hinterhof' : 'Zurück im Hinterhof', '');
      return true;
    }
    if (['wc', 'office-back'].includes(n?.kind)) {
      const isWC = n.kind === 'wc',
        portalId = isWC ? 'wc' : n.id;
      const door = this.world.portals[portalId];
      setDoor(this.world, door, true);
      const p = this.world.player.position.clone();
      if (door)
        this.world.player.rotation.y = Math.atan2(
          door.root.position.x - p.x,
          door.root.position.z - p.z,
        );
      this.motion.begin({
        from: p,
        to: p,
        type: 'door',
        duration: 0.65,
        done: () => {
          this.game.transition('office');
          arrive(
            this.world,
            isWC
              ? INTERIOR_LAYOUT.bathroom
              : n.id === 'wc-back'
                ? INTERIOR_LAYOUT.wc
                : { x: 8, z: -8.8, yaw: Math.PI },
          );
          setDoor(this.world, door, false);
          if (isWC)
            this.game.toast(
              'WC · Kabine wählen',
              'E öffnet die Kabinentür. Danach Toilette benutzen, spülen und Hände waschen.',
            );
        },
      });
      this.game.audio.sample('aaa_door_slam', { volume: 0.2 });
      return true;
    }
    if (['exit', 'hq', 'restaurant', 'r-exit'].includes(n?.kind)) {
      const p = this.world.player.position.clone(),
        done = () => {
          if (n.kind === 'exit') this.game.transition('city');
          if (n.kind === 'hq') {
            this.game.transition('office');
            arrive(this.world, INTERIOR_LAYOUT.exit);
          }
          setDoor(this.world, this.world.portals?.[n.kind], false);
          if (n.kind === 'restaurant') {
            this.game.transition('restaurant', n.data);
            if (n.data === 'bao') this.game.sim.stamp('mystery', 'visited');
          }
          if (n.kind === 'r-exit') this.game.transition('city', this.world.currentRestaurant.id);
        };
      const door = this.world.portals?.[n.kind];
      setDoor(this.world, door, true);
      if (door)
        this.world.player.rotation.y = Math.atan2(
          door.root.position.x - p.x,
          door.root.position.z - p.z,
        );
      this.motion.begin({ from: p, to: p, type: 'door', duration: 0.72, done });
      this.game.audio.sample('aaa_door_slam', { volume: 0.26 });
      return true;
    }
    return false;
  }
  transition() {
    this.motion.cancel();
    this.physics.release();
    this.courier.transition();
  }
  update(dt, blocked) {
    const step = this.arcade.active ? dt : 0;
    this.time += step;
    this.vehicles.update(step);
    this.physics.update(step);
    this.life.update(step);
    this.weather.update(step);
    this.courier.update(step);
    for (const door of [...this.world.cityDoors, ...Object.values(this.world.portals || {})])
      door.mesh.rotation.y = THREE.MathUtils.damp(
        door.mesh.rotation.y,
        door.opened ? (door.openAngle ?? -1.4) : 0,
        8,
        step,
      );
    if (this.lastZone !== this.world.zone) {
      if (this.world.zone === 'office') this.life.onReturn();
      this.lastZone = this.world.zone;
    }
    if (this.world.zone === 'city' && !this.arcade.vehicle && !this.world.nearest) {
      const n = this.physics.items.find(
        (i) =>
          i.type !== 'suitcase' && i.mesh.position.distanceTo(this.world.player.position) < 1.7,
      );
      if (n) this.world.nearest = { kind: 'prop-pick', label: 'G · Gegenstand aufnehmen / werfen' };
    }
    const wanted = document.getElementById('wanted-hud');
    wanted.hidden = !this.life.level;
    const wantedText =
      '<b>' +
      '★'.repeat(this.life.level) +
      '</b> ' +
      (this.life.phase === 'search'
        ? 'SUCHE · Sichtkontakt verloren'
        : 'FAHNDUNG · Polizei verfolgt dich');
    if (wanted.innerHTML !== wantedText) wanted.innerHTML = wantedText;
    const s = this.courier.state,
      ch = document.getElementById('courier-hud');
    ch.hidden = !s.active;
    const courierText =
      '<b>BBE · DER KOFFER MUSS MIT</b><span>' +
      Math.ceil(s.remaining) +
      ' s · ' +
      ({
        carry: 'In deiner Hand',
        vehicle: 'Im Fahrzeug',
        winch: 'An der Seilwinde',
        snagged: 'Am Balkon · Leiter benutzen',
        ground: 'Abgestellt · E aufnehmen',
      }[s.mode] || '') +
      '</span>';
    if (ch.innerHTML !== courierText) ch.innerHTML = courierText;
    document.getElementById('immersion-hud').hidden = !this.game.started || !!this.game.modal;
  }
  drawMap(c, { X, Z, scale, mini }) {
    if (this.life.level) {
      c.strokeStyle = '#7ebcf0';
      c.fillStyle = '#7ebcf018';
      c.beginPath();
      c.arc(X(this.life.lastSeen.x), Z(this.life.lastSeen.z), 35 * scale, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      for (const u of this.life.units)
        if (u.active) {
          c.fillStyle = '#73baff';
          c.fillRect(X(u.car.mesh.position.x) - 4, Z(u.car.mesh.position.z) - 4, 8, 8);
        }
    }
    c.strokeStyle = '#d6b47f';
    c.lineWidth = mini ? 2 : 3;
    c.beginPath();
    c.moveTo(X(60), Z(53));
    c.lineTo(X(45), Z(58));
    c.lineTo(X(45), Z(110));
    c.stroke();
    if (!mini) {
      c.fillStyle = '#dfc795';
      c.font = '12px Arial';
      c.fillText('Dachroute', X(60) + 8, Z(100));
    }
  }
}
