import * as THREE from 'three';
import { box, label, animateHuman } from './world.js';
import { storyActor } from './workshop-sets.js';
import { OriginCinema } from './origin-cinema.js';
import { OriginCooking } from './origin-cooking.js';
import { buildOriginHome, buildOriginKitchen, animateKitchen } from './origin-models.js';
import {
  freshOriginStory,
  ORIGIN_HOME,
  ORIGIN_KITCHEN,
  ORIGIN_ROUTE,
  completeShift,
  completeOrigin,
} from './origin-state.js';
import { ORIGIN_LINES } from './origin-lines.js';
const $ = (id) => document.getElementById(id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export class OriginStory {
  constructor(g) {
    this.g = g;
    this.w = g.world;
    this.enabled = false;
    this.clock = 0;
    this.voiceToken = 0;
    this.walkLine = 0;
    this.nextWalkLine = 0;
    this.film = new OriginCinema(this);
    this.cooking = new OriginCooking(this);
    this.buildZone('home', buildOriginHome());
    this.buildZone('zitronengras', buildOriginKitchen());
    const w = this.w,
      city = w.groups.city;
    box(city, -17.34, 1.4, 110, 0.08, 2.8, 1.6, '#405f59');
    label(city, 'ZUHAUSE', -17.26, 2.95, 110, 1.9, 0.28, {
      rotation: Math.PI / 2,
      bg: '#345c54',
      fg: '#eddfbb',
    });
    w.interact('city', 'origin-home', 'Nach Hause', ORIGIN_HOME.x, ORIGIN_HOME.z, {
      kind: 'origin-home',
      radius: 2,
    });
    const restaurant = w.zoneData.city.interactions.find((i) => i.id === 'enter-zitronengras');
    if (restaurant) restaurant.kind = 'origin-restaurant';
    w.interact('home', 'origin-home-exit', 'Zur Augustenstraße', 0, 7.1, {
      kind: 'origin-home-exit',
      radius: 2,
    });
    w.interact('home', 'origin-home-phone', 'Nachricht von Noi', 1.8, 2.5, {
      kind: 'origin-home-phone',
      radius: 1.7,
    });
    w.interact('zitronengras', 'origin-exit', 'Zur Augustenstraße', 0, 7, {
      kind: 'origin-exit',
      radius: 2,
    });
    w.interact('zitronengras', 'origin-cook', 'Schicht am Wok beginnen', -2, -0.55, {
      kind: 'origin-cook',
      radius: 2.2,
    });
    w.interact('zitronengras', 'origin-order', 'Speisekarte', 3.5, 2, {
      kind: 'origin-order',
      radius: 2,
    });
    const noi = storyActor('noi');
    noi.position.set(0.7, 0, -4.5);
    w.groups.zitronengras.add(noi);
    this.noi = noi;
    this.escort = storyActor('lukas');
    this.escort.name = 'Lukas · Begleitung zur BBE';
    this.escort.visible = false;
    w.groups.city.add(this.escort);
    this.escortNav = {
      mesh: this.escort,
      x: 14.4,
      z: 70,
      speed: 1.5,
      navLane: 14.4,
      origin: { x: 14.4, z: 70 },
    };
    this.walkTalk = document.createElement('div');
    this.walkTalk.className = 'origin-walk-talk';
    this.walkTalk.hidden = true;
    $('ui').append(this.walkTalk);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopVoice();
    });
  }
  buildZone(name, set) {
    const g = this.w.group(name);
    g.visible = false;
    g.add(set.group);
    this.w.zoneData[name].bounds = 8.3;
    for (const b of set.collisions) this.w.obstacle(name, b.x, b.z, b.w, b.d, b.y, b.h, b.mesh);
    this[name] = set;
  }
  get state() {
    return this.g.sim.s.originStory;
  }
  get active() {
    return this.enabled && this.state.phase !== 'complete';
  }
  get activeFilm() {
    return this.cooking.current ? this.cooking : this.film.current ? this.film : null;
  }
  cancel() {
    this.enabled = false;
    this.stopVoice();
    this.escort.visible = false;
    ++this.film.token;
    this.film.loading = false;
    if (this.film.current) {
      this.film.current.done = null;
      this.film.finish();
    }
    ++this.cooking.token;
    this.cooking.loading = false;
    if (this.cooking.current) this.cooking.finish(false);
    this.g.waypoint = null;
  }
  async begin() {
    if (this.g.workshop.active || this.g.fireStory.active || this.g.sim.s.courier.active) {
      this.g.toast(
        'Zuerst den laufenden Auftrag abschließen.',
        'Dein Story-Speicherpunkt bleibt erhalten.',
      );
      return;
    }
    if (this.state.phase === 'complete') {
      const old = this.state;
      this.g.sim.s.originStory = {
        ...freshOriginStory(),
        paid: old.paid.slice(),
        rewardClaimed: old.rewardClaimed,
      };
    }
    const g = this.g;
    g.started = true;
    g.titleMusic.stop();
    this.w.started = true;
    g.audio.start();
    $('welcome')?.remove();
    $('ui').classList.remove('intro-open');
    this.enabled = true;
    this.g.arcade.immersion.physics.release();
    this.g.arcade.immersion.motion.cancel();
    this.g.sim.save();
    this.resume();
  }
  resume() {
    const phase = this.state.phase;
    if (['new', 'home'].includes(phase)) {
      this.setPhase('home');
      this.enter('home');
      this.film.play('home', () => {
        this.setPhase('commute');
        this.objective();
      });
    } else if (phase === 'commute') {
      this.enter('home');
      this.objective();
    } else if (['kitchen', 'shifts', 'offer'].includes(phase)) {
      this.enter('zitronengras');
      this.atKitchen();
    } else if (phase === 'escort') {
      this.startEscort(true);
    } else if (phase === 'arrival') {
      this.arrive();
    }
  }
  setPhase(phase) {
    this.state.phase = phase;
    this.g.sim.save();
  }
  enter(zone) {
    this.internalTransition = true;
    try {
      this.g.transition(zone);
    } finally {
      this.internalTransition = false;
    }
  }
  canArrive() {
    return (
      this.state.phase === 'escort' &&
      this.state.route === ORIGIN_ROUTE.length - 1 &&
      this.walkLine === 4 &&
      !this.voiceUntil &&
      !this.g.arcade.vehicle &&
      distance(this.escort.position, ORIGIN_ROUTE.at(-1)) < 0.8 &&
      distance(this.w.player.position, ORIGIN_ROUTE.at(-1)) < 3.8
    );
  }
  beforeTransition(zone) {
    if (!this.active || this.internalTransition) return true;
    if (zone === 'office') {
      if (this.canArrive()) {
        this.arrive();
        return false;
      }
      this.g.toast('Deine Geschichte beginnt im Zitronengras.', 'Folge dem markierten Ziel.');
      return false;
    }
    return true;
  }
  interact(n) {
    if (!n) return false;
    if (n.kind === 'origin-home') {
      this.enter('home');
      return true;
    }
    if (n.kind === 'origin-home-exit') {
      this.enter('city');
      this.w.teleport(ORIGIN_HOME.x, ORIGIN_HOME.z);
      this.w.yaw = -Math.PI / 2;
      this.objective();
      return true;
    }
    if (n.kind === 'origin-home-phone') {
      this.say('home_02', true);
      this.g.toast('Noi · Zitronengras', 'Deine Schicht wartet.');
      return true;
    }
    if (n.kind === 'origin-restaurant') {
      this.enter('zitronengras');
      if (this.active) this.atKitchen();
      return true;
    }
    if (n.kind === 'origin-exit') {
      this.enter('city');
      this.w.teleport(ORIGIN_KITCHEN.x, ORIGIN_KITCHEN.z);
      this.objective();
      return true;
    }
    if (n.kind === 'origin-order') {
      this.g.menu();
      return true;
    }
    if (n.kind === 'origin-cook') {
      if (this.active) this.atKitchen(true);
      else {
        this.g.open(
          'Zitronengras',
          '<p>Vier Services. Ein neuer Anfang.</p><button class="primary" id="origin-practice">Freies Kochen</button>',
          { pause: true },
        );
        $('origin-practice').onclick = () => {
          this.g.close();
          this.cooking.start(0);
        };
      }
      return true;
    }
    return false;
  }
  atKitchen(cook = false) {
    const phase = this.state.phase;
    if (['commute', 'kitchen'].includes(phase)) {
      this.setPhase('kitchen');
      this.film.play('kitchen', () => {
        this.setPhase('shifts');
        this.objective();
        this.g.toast('Service 1 / 4', 'Zum Wok · E');
      });
    } else if (phase === 'shifts') {
      this.objective();
      if (cook) this.cooking.start(this.state.level);
    } else if (phase === 'offer') this.film.play('offer', () => this.startEscort(false));
  }
  shiftComplete(round) {
    if (!this.active) {
      this.g.toast('Training abgeschlossen.', round.score + ' Punkte');
      return;
    }
    const result = completeShift(this.g.sim, round);
    if (!result) return;
    this.g.toast(
      'Service ' + result.level + ' geschafft',
      result.score + ' Punkte · +' + result.reward + ' €',
      true,
    );
    if (this.state.phase === 'offer') this.atKitchen();
    else this.cooking.start(this.state.level);
  }
  startEscort(resume) {
    this.setPhase('escort');
    if (!resume) this.state.route = 0;
    this.enter('city');
    const p = ORIGIN_ROUTE[Math.max(0, this.state.route - 1)];
    this.w.teleport(p.x + 1, p.z + 1);
    this.escort.position.set(p.x, 0, p.z);
    this.escortNav.x = p.x;
    this.escortNav.z = p.z;
    this.escortNav.navTarget = null;
    this.escort.visible = true;
    this.walkLine = 0;
    this.nextWalkLine = this.clock + 1;
    this.objective();
    this.g.sim.save();
  }
  arrive() {
    if (this.film.current || this.film.loading) return;
    this.setPhase('arrival');
    this.escort.visible = false;
    this.stopVoice();
    this.enter('office');
    this.w.teleport(34, 4.5);
    this.film.play('arrival', () => {
      const paid = completeOrigin(this.g.sim);
      this.enabled = false;
      this.g.waypoint = null;
      this.w.teleport(-1.5, 5.7);
      this.w.target.set(-1.5, 1.2, 5.7);
      this.g.sim.save();
      this.g.toast('Willkommen bei der BBE', 'Marienplatz: Workshop-Koffer · Eilauftrag: IT', true);
      if (paid) this.g.sim.emit('mission-complete', 'Vom Wok zum Workshop', { id: 'origin:1.7.0' });
      this.g.fireStory.onStart();
    });
  }
  objective() {
    if (!this.active) return;
    this.g.waypoint = ['commute', 'kitchen', 'shifts', 'offer'].includes(this.state.phase)
      ? { ...ORIGIN_KITCHEN }
      : this.state.phase === 'escort'
        ? { ...ORIGIN_ROUTE.at(-1), name: 'Mit Lukas zur BBE' }
        : null;
  }
  say(key, preview = false) {
    const line = ORIGIN_LINES.find((l) => l.key === key);
    if (!line) return;
    this.stopVoice();
    const token = ++this.voiceToken;
    this.g.audio.voices.stop();
    this.voiceUntil = this.clock + line.duration;
    this.voiceWallUntil = performance.now() + line.duration * 1000 + 500;
    this.walkTalk.innerHTML = '<b>' + line.speaker + '</b><span>' + line.text + '</span>';
    this.walkTalk.hidden = !this.g.sim.s.audioSubtitles || !!this.g.cinematic;
    this.g.audio.cinematicVoice = true;
    const subtitle = $('cook-dialogue');
    if (subtitle) {
      subtitle.textContent = line.speaker + ' · ' + line.text;
      subtitle.hidden = !this.g.sim.s.audioSubtitles;
    }
    this.g.audio
      .sample(line.asset, {
        bus: 'dialogue',
        volume: 0.93,
        preview,
        onEnded: () => {
          if (token === this.voiceToken) this.stopVoice();
        },
      })
      .then((handle) => {
        if (token === this.voiceToken) {
          this.voice = handle;
          if (handle) {
            this.voiceUntil = this.clock + line.duration + 0.15;
            this.voiceWallUntil = performance.now() + line.duration * 1000 + 500;
          }
        } else handle?.stop(0.05);
      })
      .catch(() => {});
  }
  stopVoice() {
    this.voiceToken++;
    this.voice?.stop(0.08);
    this.voice = null;
    this.voiceUntil = 0;
    this.voiceWallUntil = 0;
    const subtitle = $('cook-dialogue');
    if (subtitle) subtitle.hidden = true;
    if (this.walkTalk) this.walkTalk.hidden = true;
    this.g.audio.cinematicVoice = false;
  }
  update(dt, paused) {
    if (this.voiceWallUntil && performance.now() > this.voiceWallUntil) this.stopVoice();
    if (paused || document.hidden) {
      if (this.voice && !this.g.cinematic) this.stopVoice();
      return;
    }
    this.clock += dt;
    if (this.voiceUntil && this.clock > this.voiceUntil) this.stopVoice();
    if (this.w.zone === 'zitronengras') {
      animateHuman(this.noi, this.clock, 0, 'work');
      animateKitchen(this.zitronengras, this.clock, { phase: 'idle' });
    }
    this.escort.visible = this.active && this.state.phase === 'escort' && this.w.zone === 'city';
    if (!this.escort.visible) return;
    const p = this.w.player.position,
      s = this.state,
      target = ORIGIN_ROUTE[s.route];
    let moving = 0;
    if (distance(p, this.escort.position) < 9 && distance(this.escort.position, target) > 0.5) {
      moving = this.w.pedestrianNav.move(this.escortNav, target, 1.65, dt);
    }
    if (distance(this.escort.position, target) < 0.6 && s.route < ORIGIN_ROUTE.length - 1) {
      s.route++;
      this.g.sim.save();
    }
    animateHuman(this.escort, this.clock, moving || 0, 'walk');
    if (
      !this.voiceUntil &&
      this.walkLine < 4 &&
      this.clock >= this.nextWalkLine &&
      distance(p, this.escort.position) < 9
    ) {
      const key = 'walk_0' + ++this.walkLine;
      const line = ORIGIN_LINES.find((l) => l.key === key);
      this.say(key);
      this.nextWalkLine = this.clock + (line?.duration || 8) + 1.8;
    }
    if (
      s.route === ORIGIN_ROUTE.length - 1 &&
      distance(this.escort.position, ORIGIN_ROUTE.at(-1)) < 0.8 &&
      distance(p, ORIGIN_ROUTE.at(-1)) < 3.8 &&
      !this.g.arcade.vehicle &&
      this.walkLine === 4 &&
      !this.voiceUntil
    )
      this.arrive();
  }
  updateHUD() {
    if (!this.active) return;
    const s = this.state;
    const title = {
      home: 'Vom Wok zum Workshop',
      commute: 'Deine Schicht wartet',
      kitchen: 'Noi wartet in der Küche',
      shifts: 'Service ' + (s.level + 1) + ' / 4',
      offer: 'Der letzte Gast',
      escort: 'Mit Lukas zur BBE',
      arrival: 'Willkommen bei der BBE',
    }[s.phase];
    $('quest-title').textContent = title || 'Story-Modus';
    $('quest-description').textContent =
      s.phase === 'shifts'
        ? 'E · Am Wok beginnen'
        : s.phase === 'escort'
          ? 'Bleib bei Lukas.'
          : 'Zitronengras · Augustenstraße';
  }
}
