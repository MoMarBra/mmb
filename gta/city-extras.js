import * as THREE from 'three';
import { CityFire } from './city-fire.js';
import { Brewery } from './brewery.js';
import { FullMap } from './full-map.js';
import { IntroFilm } from './intro-film.js';
import { tickDrunk, EXTRA_PLACES, BOMB_PRICE } from './extras-state.js';
import { VOICE_LINES } from './voice-lines.js';
import { RESTAURANTS, euro } from './data.js';
import { human, label } from './world.js';
export class CityExtras {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.clock = 0;
    this.lastZone = this.w.zone;
    this.lastCar = null;
    this.lastLine = new Map();
    this.nextPolice = 0;
    this.nextDrunk = 0;
    this.brewery = new Brewery(game);
    this.fire = new CityFire(game);
    this.map = new FullMap(game);
    this.intro = new IntroFilm(game);
    this.drunkHUD = document.createElement('div');
    this.drunkHUD.id = 'drunk-status';
    this.drunkHUD.hidden = true;
    document.getElementById('ui').append(this.drunkHUD);
    const boss = human({ jacket: '#253d4e', pants: '#303438', hair: '#6b5744' });
    boss.position.set(37.3, 0, -3.1);
    boss.rotation.y = -1;
    this.w.groups.office.add(boss);
    this.boss = boss;
    this.w.zoneData.office.npcs.push({
      mesh: boss,
      name: 'Lukas Fleischmann',
      pose: 'phone',
      x: 37.3,
      z: -3.1,
      arcadeId: 'office-lukas',
      hp: 3,
      home: boss.position.clone(),
      origin: { x: 37.3, z: -3.1 },
    });
    label(this.w.groups.office, 'LUKAS FLEISCHMANN', 37.3, 2.3, -3.1, 2.6, 0.35, {
      bg: '#254451',
      fg: '#ecc989',
    });
    this.w.interact('office', 'boss-story', 'Lukas · Nur noch kurz zum Marienplatz', 36.6, -1.5, {
      kind: 'boss-story',
      radius: 2.3,
    });
    window.addEventListener('keydown', (e) => {
      if (
        e.defaultPrevented ||
        e.repeat ||
        e.code !== 'KeyB' ||
        game.modal ||
        game.busy ||
        !game.started
      )
        return;
      e.preventDefault();
      this.fire.throwBomb();
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-burrito-equip]')) {
        game.close();
        this.fire.throwBomb();
      }
      if (e.target.closest('[data-burrito-route]')) {
        game.waypoint = { ...EXTRA_PLACES.dogtown };
        this.map.open();
      }
    });
  }
  get state() {
    return this.g.sim.s.extras;
  }
  say(event, force = false, id = null) {
    const list = VOICE_LINES.filter((l) => l.id.startsWith('v160_') && l.event === event);
    if (!list.length) return;
    let i = ((this.lastLine.get(event) ?? -1) + 1) % list.length;
    this.lastLine.set(event, i);
    const line = id ? list.find((l) => l.id === id) || list[i] : list[i];
    this.g.audio.voices.say(line.actor, event, {
      id: line.id,
      force,
      preview: !!this.g.modal,
      priority: event === 'police.taunt' ? 4 : 3,
    });
  }
  interact(n) {
    if (this.g.fireStory.running) return false;
    if (n?.kind === 'boss-story') {
      this.g.workshop.brief();
      return true;
    }
    if (n?.kind === 'order' && this.w.currentRestaurant?.id === 'dogtown') {
      this.dogtown();
      return true;
    }
    return this.brewery.interact(n);
  }
  dogtown() {
    this.g.open(
      'Dogtown',
      `<div class="brew-menu"><h3>Lunch mit Nachwirkung.</h3><p class="muted">Spielsortiment</p><button id="dog-food" class="brew-item"><span>California Burrito<small>+50 Sättigung · +12 Zufriedenheit</small></span><b>${euro(this.g.sim.price(RESTAURANTS.find((r) => r.id === 'dogtown').foods[0]))}</b></button><button id="dog-bomb" class="brew-item"><span>BurritoBombe<small>B · Draußen werfen · ${this.state.bombs} / 30 dabei</small></span><b>6,50 €</b></button></div>`,
      { pause: true },
    );
    document.getElementById('dog-food').onclick = () => this.g.eat('dogtown', 0);
    document.getElementById('dog-bomb').onclick = () => {
      if (this.fire.buyBomb()) this.dogtown();
    };
  }
  inventory() {
    return `<article class="card equipment-card"><small>AUSRÜSTUNG</small><h3>BurritoBombe <span class="tag">${this.state.bombs}</span></h3><p>B · Werfen · Nachschub bei Dogtown</p><div class="toolbar"><button data-burrito-equip ${!this.state.bombs ? 'disabled' : ''}>Werfen</button><button data-burrito-route>Dogtown markieren</button></div></article>`;
  }
  update(dt, raw, paused) {
    const active = this.g.started && !document.hidden && !paused && !this.g.cinematic;
    this.clock += active ? dt : 0;
    const wasDrunk = this.state.drunk > 0;
    tickDrunk(this.state, raw, active);
    if (wasDrunk && !this.state.drunk) {
      this.g.toast('Wieder nüchtern.', 'Die Storyline steht wieder gerade.');
      this.g.sim.save();
    }
    this.drunkHUD.hidden = !this.state.drunk || !this.g.started || this.g.cinematic;
    if (this.state.drunk)
      this.drunkHUD.textContent =
        'BESCHWIPST · ' +
        Math.floor(Math.ceil(this.state.drunk) / 60) +
        ':' +
        String(Math.ceil(this.state.drunk) % 60).padStart(2, '0');
    if (!this.g.cinematic) {
      this.brewery.update(active ? dt : 0);
      this.fire.update(active ? dt : 0);
    }
    const car = this.g.arcade.vehicle;
    if (active && this.state.drunk) {
      if (car && car !== this.lastCar) {
        this.pendingReaction = 'drunk.car';
        this.nextDrunk = this.clock + 25;
      } else if (this.w.zone === 'office' && this.lastZone !== 'office') {
        this.pendingReaction = 'drunk.office';
        this.nextDrunk = this.clock + 25;
      } else if (this.clock > this.nextDrunk) {
        this.nextDrunk = this.clock + 28;
        this.say(this.w.zone === 'office' ? 'drunk.office' : 'drunk.player');
      }
    }
    if (active && this.g.arcade.immersion.life.level && this.clock > this.nextPolice) {
      this.nextPolice = this.clock + 15;
      this.say('police.taunt');
    }
    this.lastCar = car;
    this.lastZone = this.w.zone;
  }
  afterAudio() {
    if (this.pendingReaction) {
      const event = this.pendingReaction;
      this.pendingReaction = null;
      this.say(event, true);
    }
  }
  beforeRender() {
    if (this.intro.current) {
      this.intro.camera();
      this.intro.action.light(this.intro.time());
      return;
    }
    if (this.brewery.session || this.brewery.drink) {
      this.brewery.camera();
      return;
    }
    if (this.state.drunk > 0 && this.g.started && !this.g.cinematic) {
      const strength = Math.min(1, this.state.drunk / 12),
        t = this.clock;
      this.w.camera.rotateZ(Math.sin(t * 1.1) * 0.016 * strength);
      this.w.camera.position.x += Math.sin(t * 0.85) * 0.09 * strength;
      if (!this.g.arcade.vehicle) {
        const r = this.w.player.userData.rig;
        this.w.player.rotation.z = Math.sin(t * 1.7) * 0.07 * strength;
        r.leftArm.rotation.z += Math.sin(t * 2) * 0.1;
        r.rightArm.rotation.z -= Math.sin(t * 2) * 0.1;
      }
    }
    this.fire.camera();
    this.w.camera.updateMatrixWorld();
  }
  impact(n) {
    if (this.clock < (this.nextImpact || 0)) return;
    this.nextImpact = this.clock + 0.5;
    this.impactIndex = ((this.impactIndex || 0) % 6) + 1;
    this.g.audio.sample('v160_impact_yell_' + String(this.impactIndex).padStart(2, '0'), {
      position: n.mesh.position,
      volume: 0.65,
      refDistance: 4,
    });
    this.g.audio.sample('impactSoft_medium_000', { position: n.mesh.position, volume: 0.45 });
  }
  get status() {
    return {
      bombs: this.state.bombs,
      drunk: this.state.drunk,
      fires: this.fire.sources.length,
      particles: this.fire.particles.length,
      projectiles: this.fire.projectiles.length,
      exploded: this.w.cars.filter((c) => c.exploded).length,
      stein: this.brewery.session ? { ...this.brewery.session } : null,
      intro: this.intro.current
        ? {
            elapsed: this.intro.current.elapsed,
            paused: this.intro.current.paused,
            loading: this.intro.current.loading,
          }
        : null,
    };
  }
}
