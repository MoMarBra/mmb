import * as THREE from 'three';
import { box, label, human, animateHuman } from './world.js';
import { buildBrewerySet } from './brewery-model.js';
import { EXTRA_PLACES, BEER_PRICE, DRUNK_SECONDS, advanceStein } from './extras-state.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export class Brewery {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.clock = 0;
    this.session = null;
    this.drink = null;
    this.steer = 0;
    const root = this.w.group('brewery');
    root.visible = false;
    this.w.zoneData.brewery.bounds = 10.8;
    this.set = buildBrewerySet(THREE);
    root.add(this.set.group);
    for (const b of this.set.collisionBoxes) {
      const body = this.w.obstacle('brewery', b.x, b.z, b.w, b.d, b.y, b.h);
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      proxy.position.set(b.x, b.y, b.z);
      root.add(proxy);
      this.w.zoneData.brewery.obstacles.push(proxy);
    }
    this.w.interact('brewery', 'brew-exit', 'Zur Brienner Straße', 0, 8.1, {
      kind: 'brew-exit',
      radius: 1.8,
    });
    this.w.interact(
      'brewery',
      'brew-order',
      'Bier bestellen',
      this.set.barSpot.x,
      this.set.barSpot.z,
      { kind: 'brew-order', radius: 2 },
    );
    this.w.interact(
      'brewery',
      'stein',
      'Maßkrugstemmen',
      this.set.gameSpot.x,
      this.set.gameSpot.z,
      { kind: 'stein', radius: 2 },
    );
    const host = human({ jacket: '#ac925d', pants: '#384a48', hair: '#685047' });
    host.position.set(this.set.barStaffSpot.x, 0, this.set.barStaffSpot.z);
    root.add(host);
    this.w.zoneData.brewery.npcs.push({
      mesh: host,
      name: 'Benno · Braumeister',
      pose: 'work',
      x: host.position.x,
      z: host.position.z,
      speed: 0,
      arcadeId: 'brewery-host',
      hp: 3,
      home: host.position.clone(),
      origin: { x: host.position.x, z: host.position.z },
    });
    const city = this.w.groups.city;
    // A surveyed empty plot, with the doorway clear of the public footpath and tree row.
    this.w.solid('city', city, 103, 2.4, 54, 18, 4.8, 12, '#bdb49b');
    box(city, 103, 4.88, 54, 18.5, 0.25, 12.5, '#343e3e');
    box(city, 106, 1.6, 47.92, 2.2, 3.2, 0.1, '#264d50');
    for (const x of [97, 101, 110]) {
      box(city, x, 2, 47.9, 2.2, 2.1, 0.12, '#53716d');
      box(city, x, 1.96, 47.8, 0.055, 2.1, 0.06, '#b58f54');
    }
    label(city, 'BRIENNER BRÄU', 103, 4.05, 47.77, 14, 1, {
      rotation: Math.PI,
      bg: '#1a3333',
      fg: '#eac989',
      sub: 'BRAUHAUS · MAßKRUGSTEMMEN',
    });
    label(city, 'Bier statt Buzzwords.', 110, 1.15, 47.76, 2.2, 0.7, {
      rotation: Math.PI,
      bg: '#263b39',
      fg: '#e8d09b',
    });
    this.w.cityBlocks.push({ x: 103, z: 54, w: 18, d: 12 });
    this.w.interact('city', 'brewery', 'Brienner Bräu betreten', 106, 47.2, {
      kind: 'brewery',
      radius: 2.4,
    });
    this.hud = document.createElement('section');
    this.hud.id = 'stein-hud';
    this.hud.hidden = true;
    document.getElementById('ui').append(this.hud);
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.session && !this.drink) return;
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.finish(true);
        } else if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.steer = ['KeyA', 'ArrowLeft'].includes(e.code) ? -1 : 1;
        }
      },
      true,
    );
    window.addEventListener('keyup', (e) => {
      if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.steer = 0;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.steer = 0;
    });
  }
  spend(amount, label) {
    if (this.g.sim.s.money < amount) {
      this.g.toast('Das Budget reicht noch nicht.');
      return false;
    }
    this.g.sim.transaction(-amount, label);
    return true;
  }
  interact(n) {
    if (!n) return false;
    if (n.kind === 'brewery') {
      this.g.transition('brewery');
      return true;
    }
    if (n.kind === 'brew-exit') {
      this.g.transition('city');
      this.w.teleport(EXTRA_PLACES.brewery.x, EXTRA_PLACES.brewery.z);
      return true;
    }
    if (n.kind === 'brew-order') {
      this.menu();
      return true;
    }
    if (n.kind === 'stein') {
      this.brief();
      return true;
    }
    return false;
  }
  menu() {
    this.g.open(
      'Brienner Bräu',
      `<div class="brew-menu"><div class="eyebrow">HAUSBRAUEREI</div><h3>Liquidität. Frisch gezapft.</h3><button id="beer-buy" class="brew-item"><span>Hausbier · Maß<small>+18 Zufriedenheit · 3 Min. beschwipst</small></span><b>7,80 €</b></button><button id="beer-free" class="brew-item"><span>Alkoholfreies<small>+8 Zufriedenheit · klarer Kopf</small></span><b>4,50 €</b></button><button id="beer-water" class="brew-item"><span>Leitungswasser<small>+5 Energie</small></span><b>Kostenlos</b></button><button id="beer-contest" class="primary">Maßkrugstemmen</button></div>`,
      { pause: true },
    );
    this.g.extras.say('brewery');
    document.getElementById('beer-buy').onclick = () => {
      if (this.spend(BEER_PRICE, 'Brienner Bräu · Maß')) this.startDrink(true);
    };
    document.getElementById('beer-free').onclick = () => {
      if (this.spend(4.5, 'Brienner Bräu · Alkoholfrei')) this.startDrink(false);
    };
    document.getElementById('beer-water').onclick = () => {
      this.g.sim.change('energy', 5);
      this.g.close();
      this.g.toast('Hydration ist auch ein KPI.');
    };
    document.getElementById('beer-contest').onclick = () => this.brief();
  }
  brief() {
    this.g.open(
      'Maßkrugstemmen',
      `<div class="stein-brief"><span class="tag">3D · 30 SEKUNDEN</span><h3>Halten. Nicht verschütten.</h3><p>A / D gleichen die Neigung aus.</p><p class="muted">30 Sekunden: 12 € · Bestzeit ${this.g.sim.s.extras.steinBest.toFixed(1)} s</p><button id="stein-start" class="primary">Maß heben</button></div>`,
      { pause: true },
    );
    document.getElementById('stein-start').onclick = () => this.startContest();
  }
  prepare() {
    this.g.close();
    this.g.audio.setActive?.(true);
    this.g.busy = true;
    this.w.keys.clear();
    this.w.teleport(-4.25, 2.31);
    this.w.player.rotation.y = Math.PI;
    this.savedCamera = { yaw: this.w.yaw, pitch: this.w.pitch, distance: this.w.distance };
    this.g.mouseControls?.release();
    this.hud.hidden = false;
    this.set.mug.visible = true;
    this.set.mug.userData.beer.scale.y = 1;
    this.set.mug.userData.beer.position.y = 0.11;
    this.set.mug.userData.foam.position.y = 0.207;
    this.set.mug.userData.foam.visible = true;
  }
  startContest() {
    if (this.w.zone !== 'brewery') return;
    this.prepare();
    this.steer = 0;
    this.session = { time: 0, tilt: 0.08, stamina: 100, spill: 0, finished: false, won: false };
    this.hud.innerHTML =
      '<div class="stein-title"><small>BRIENNER BRÄU</small><b>Maß halten.</b></div><div class="stein-balance"><span id="stein-pointer"></span><i></i></div><div class="stein-numbers"><strong id="stein-seconds">0.0 s</strong><span id="stein-spill">0 % verschüttet</span></div><div class="stein-controls"><button data-stein-axis="-1">A · Links</button><span>ESC · Absetzen</span><button data-stein-axis="1">D · Rechts</button></div>';
    this.hud.querySelectorAll('[data-stein-axis]').forEach((b) => {
      b.onpointerdown = (e) => {
        b.setPointerCapture(e.pointerId);
        this.steer = Number(b.dataset.steinAxis);
      };
      b.onpointerup = b.onpointercancel = () => (this.steer = 0);
    });
    this.g.extras.say('brewery.contest', true, 'v160_brewery_contest_03');
    this.g.audio.sample('v160_beer_clink', { volume: 0.55 });
  }
  startDrink(alcohol) {
    this.prepare();
    this.drink = { elapsed: 0, alcohol };
    this.hud.innerHTML =
      '<div class="stein-title"><small>BRIENNER BRÄU</small><b>Prost, Projektteam.</b></div><p>ESC · Absetzen</p>';
    this.g.audio.sample('v160_beer_pour', { volume: 0.55 });
  }
  finish(cancel = false) {
    const s = this.session,
      d = this.drink;
    if (!s && !d) return;
    this.session = null;
    this.drink = null;
    this.hud.hidden = true;
    this.g.busy = false;
    this.steer = 0;
    this.set.mug.position.copy(this.set.mug.userData.restPosition);
    this.set.mug.rotation.set(0, 0, 0);
    this.set.mug.userData.beer.scale.y = 1;
    this.set.mug.userData.beer.position.y = 0.11;
    this.set.mug.userData.foam.position.y = 0.207;
    this.set.mug.userData.foam.visible = true;
    if (this.w.zone === 'brewery') {
      this.w.teleport(-4.25, 3.32);
      this.w.pose = 'walk';
      Object.assign(this.w, this.savedCamera);
    }
    this.g.mouseControls?.resume();
    if (s) {
      this.g.sim.s.extras.steinBest = Math.max(this.g.sim.s.extras.steinBest, Math.min(30, s.time));
      if (s.won && !cancel) {
        this.g.sim.s.extras.steinWins++;
        this.g.sim.transaction(12, 'Brienner Bräu · Maßkrugstemmen');
        this.g.toast('Arm stabil. Business Case positiv.', '30 Sekunden · +12 €', true);
        this.g.extras.say('brewery.contest', true, 'v160_brewery_contest_01');
      } else {
        this.g.toast(
          cancel ? 'Maß abgesetzt.' : 'Die Marge schwappt über.',
          s.time.toFixed(1) + ' Sekunden',
        );
        if (!cancel) this.g.extras.say('brewery.contest', true, 'v160_brewery_contest_02');
      }
    }
    if (d && !cancel) {
      this.g.sim.change('happy', d.alcohol ? 18 : 8);
      this.g.sim.change('bladder', 20);
      if (d.alcohol) {
        this.g.sim.s.extras.drunk = DRUNK_SECONDS;
        this.g.sim.s.extras.beers++;
        this.g.extras.say('drunk.player', true);
      }
      this.g.toast(
        d.alcohol ? 'Beschwipst · 3 Minuten' : 'Prost. Klarer Kopf.',
        d.alcohol ? 'Die Storyline schwankt ein bisschen.' : 'Bereit fürs nächste Meeting.',
      );
    }
    this.g.sim.save();
  }
  update(dt) {
    this.clock += dt;
    if (this.w.zone !== 'brewery') {
      if (this.session || this.drink) this.finish(true);
      return;
    }
    if (document.hidden) return;
    if (this.session) {
      advanceStein(this.session, dt, this.steer);
      document.getElementById('stein-seconds').textContent = this.session.time.toFixed(1) + ' s';
      document.getElementById('stein-spill').textContent =
        Math.round(this.session.spill) + ' % verschüttet';
      document.getElementById('stein-pointer').style.left = 50 + this.session.tilt * 45 + '%';
      if (this.session.finished) this.finish();
    }
    if (this.drink) {
      this.drink.elapsed += dt;
      if (this.drink.elapsed > 1.3 && !this.drink.sound) {
        this.drink.sound = true;
        this.g.audio.sample('v160_beer_drink', { volume: 0.6 });
      }
      if (this.drink.elapsed >= 4.7) this.finish();
    }
  }
  camera() {
    if (!this.session && !this.drink) return;
    const p = this.w.player,
      r = p.userData.rig;
    animateHuman(p, this.clock, 0, 'seated');
    // The .64 m stool supports the horizontal thighs; feet rest on the .285 m step.
    r.leftLeg.rotation.x = r.rightLeg.rotation.x = -Math.PI / 2;
    r.leftShin.rotation.x = r.rightShin.rotation.x = Math.PI / 2;
    p.position.y = -0.134;
    p.rotation.y = Math.PI;
    r.rightArm.rotation.x = this.drink ? -1.7 : -Math.PI / 2;
    r.rightFore.rotation.x = this.drink ? -0.7 : -0.08;
    r.rightArm.rotation.z = this.session?.tilt || 0;
    p.updateWorldMatrix(true, true);
    const grip = r.rightFore.localToWorld(V(0, -0.28, 0.01));
    const mug = this.set.mug;
    mug.rotation.set(
      this.drink ? -Math.sin((Math.min(1, this.drink.elapsed / 2) * Math.PI) / 2) * 0.75 : 0,
      Math.PI,
      (this.session?.tilt || 0) * 0.7,
    );
    mug.updateMatrix();
    const offset = mug.userData.gripAnchor.clone().applyEuler(mug.rotation);
    mug.position.copy(grip).sub(offset);
    if (this.drink) {
      const fill = Math.max(0.06, 1 - this.drink.elapsed / 5);
      mug.userData.beer.scale.y = fill;
      mug.userData.beer.position.y = 0.023 + 0.087 * fill;
      mug.userData.foam.position.y = 0.025 + 0.18 * fill;
    }
    this.w.camera.position.set(-1.9, 1.9, 4.6);
    this.w.camera.lookAt(-4.2, 1.45, 1.6);
    this.w.camera.updateMatrixWorld();
  }
}
