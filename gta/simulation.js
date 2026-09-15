import { freshExtras, normalizeExtras } from './extras-state.js';
import { freshFireStory, normalizeFireStory } from './fire-state.js';
import { freshWorkshopStory, normalizeWorkshopStory } from './workshop-state.js';
import { CAREERS, RESTAURANTS, TASKS, ACHIEVEMENTS, clamp } from './data.js';
export const SAVE_KEY = 'bbe-munich-life-v1';
export const freshState = () => ({
  version: 1,
  extras: freshExtras(),
  vaults: 0,
  propsThrown: 0,
  glassBroken: 0,
  incidents: 0,
  escapes: 0,
  wanted: 0,
  cityMemory: '',
  vehicleDamage: {},
  wetness: 0,
  workshopStory: freshWorkshopStory(),
  fireStory: freshFireStory(),
  courier: { active: false },
  courierCompleted: 0,
  money: 32.8,
  health: 100,
  bladder: 30,
  knockouts: 0,
  chaosCash: 0,
  driven: 0,
  birdWater: 100,
  birdRefills: 0,
  cityVisits: [],
  cycled: 0,
  flown: 0,
  heliLandings: 0,
  heliTakeoff: false,
  drivebyShots: 0,
  drivebyHits: 0,
  scatterCount: 0,
  toiletUses: 0,
  toiletPending: false,
  wcBest: 0,
  lootClaims: [],
  music: true,
  musicVolume: 0.4,
  musicStation: 0,
  musicAuto: true,
  audioEnabled: true,
  audioMaster: 0.8,
  audioEffects: 0.85,
  audioAmbience: 0.65,
  audioDialogue: 1,
  audioUI: 0.65,
  audioSubtitles: true,
  audioRange: 'full',
  hunger: 76,
  energy: 70,
  happy: 72,
  focus: 78,
  rep: 0,
  xp: 0,
  minutes: 497,
  day: 1,
  caffeine: 0,
  coffeeToday: 0,
  completed: 0,
  perfectSlides: 0,
  revisions: 0,
  returned: 0,
  inventory: [],
  picked: [],
  visits: [],
  achievements: [],
  active: [],
  seq: 1,
  earnings: 0,
  spent: 0,
  upgrades: [],
  mail: [
    {
      title: 'Willkommen bei der BBE',
      body: 'Dein erster Auftrag wartet am Computer. Verdiene dein Mittagessen. Und denke daran: final ist ein Gefühl.',
      time: '08:17',
    },
  ],
  ledger: [],
  event: null,
  weather: 'Sonnig',
  eventClock: 0,
  weatherClock: 0,
  revision: 0,
});
export class Simulation {
  constructor(storage) {
    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
    } catch {
      this.storage = null;
    }
    this.state = freshState();
    this.saved = false;
    this.listeners = [];
    this.pending = [];
    this.load();
  }
  get s() {
    return this.state;
  }
  get level() {
    let n = 0;
    CAREERS.forEach((c, i) => {
      if (this.s.xp >= c.xp) n = i;
    });
    return n + 1;
  }
  get career() {
    return CAREERS[this.level - 1];
  }
  get clock() {
    let m = Math.floor(this.s.minutes) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  get weekday() {
    return ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][
      (this.s.day - 1) % 7
    ];
  }
  absolute() {
    return (this.s.day - 1) * 1440 + this.s.minutes;
  }
  emit(type, message, extra = {}) {
    const e = { type, message, ...extra };
    this.pending.push(e);
    this.listeners.forEach((f) => f(e));
  }
  load() {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v.version !== 1 || !Number.isFinite(v.money) || !Number.isFinite(v.xp) || v.xp < 0)
        throw Error('Invalid save');
      const base = freshState();
      for (const k of Object.keys(base)) {
        if (v[k] !== undefined && typeof v[k] === typeof base[k]) base[k] = v[k];
      }
      for (const k of [
        'inventory',
        'picked',
        'visits',
        'achievements',
        'active',
        'upgrades',
        'mail',
        'ledger',
        'lootClaims',
        'cityVisits',
      ])
        if (!Array.isArray(base[k])) base[k] = [];
      for (const k of ['hunger', 'energy', 'happy', 'focus', 'rep', 'caffeine'])
        base[k] = clamp(Number.isFinite(base[k]) ? base[k] : 50);
      base.money = Math.max(0, base.money);
      for (const k of ['health', 'bladder', 'wcBest', 'birdWater'])
        base[k] = clamp(Number.isFinite(base[k]) ? base[k] : 50);
      base.musicVolume = clamp(Number.isFinite(base.musicVolume) ? base.musicVolume : 0.4, 0, 1);
      for (const key of [
        'audioMaster',
        'audioEffects',
        'audioAmbience',
        'audioDialogue',
        'audioUI',
      ])
        base[key] = clamp(Number.isFinite(base[key]) ? base[key] : freshState()[key], 0, 1);
      base.musicStation = clamp(
        Math.floor(Number.isFinite(base.musicStation) ? base.musicStation : 0),
        0,
        2,
      );
      base.audioRange = base.audioRange === 'night' ? 'night' : 'full';
      base.lootClaims = base.lootClaims.filter((v) => typeof v === 'string').slice(-400);
      for (const k of [
        'knockouts',
        'chaosCash',
        'driven',
        'toiletUses',
        'birdRefills',
        'cycled',
        'flown',
        'heliLandings',
        'drivebyShots',
        'drivebyHits',
        'scatterCount',
      ])
        base[k] = Math.max(0, Number.isFinite(base[k]) ? base[k] : 0);
      base.cityVisits = [
        ...new Set(
          base.cityVisits.filter((v) =>
            ['koenigsplatz', 'karolinenplatz', 'frauenkirche', 'marienplatz', 'benno'].includes(v),
          ),
        ),
      ];
      base.heliTakeoff = false;
      for (const key of [
        'vaults',
        'propsThrown',
        'glassBroken',
        'incidents',
        'escapes',
        'courierCompleted',
      ])
        base[key] = Math.max(0, Number.isFinite(base[key]) ? base[key] : 0);
      base.wetness = clamp(Number.isFinite(base.wetness) ? base.wetness : 0, 0, 1);
      base.wanted = 0;
      base.vehicleDamage = Object.fromEntries(
        Object.entries(base.vehicleDamage || {})
          .filter(
            ([id, v]) =>
              /^(car-|police-|helicopter-|ride-bike-)[0-9]+$/.test(id) &&
              v &&
              Number.isFinite(v.health),
          )
          .slice(0, 80)
          .map(([id, v]) => [id, { health: clamp(v.health, 0, 100) }]),
      );
      base.extras = normalizeExtras(base.extras);
      base.workshopStory = normalizeWorkshopStory(base.workshopStory);
      base.fireStory = normalizeFireStory(base.fireStory);
      const c = base.courier;
      base.courier =
        c?.active && Number.isFinite(c.remaining) && c.remaining > 0
          ? {
              active: true,
              remaining: clamp(c.remaining, 0, 360),
              mode: 'carry',
              position: [-8, 0, 2],
              integrity: 100,
              air: !!c.air,
              roof: !!c.roof,
            }
          : { active: false };
      base.active = base.active
        .filter(
          (t) =>
            t &&
            TASKS.some((d) => d.type === t.type) &&
            Number.isFinite(t.id) &&
            Number.isFinite(t.deadline) &&
            Array.isArray(t.progress),
        )
        .map((t) => ({
          ...t,
          ...TASKS.find((d) => d.type === t.type),
          progress: t.progress.filter((p) => typeof p === 'string'),
          multiplier: [1, 1.25, 3].includes(t.multiplier) ? t.multiplier : 1,
        }));
      base.inventory = base.inventory.filter((v) => [8, 15, 25].includes(v)).slice(0, 30);
      base.mail = base.mail
        .filter((m) => m && typeof m.title === 'string' && typeof m.body === 'string')
        .slice(0, 30);
      base.ledger = base.ledger
        .filter((l) => l && Number.isFinite(l.amount) && typeof l.label === 'string')
        .slice(0, 40);
      base.minutes = clamp(base.minutes, 0, 1439.99);
      base.day = Math.max(1, Math.floor(base.day));
      this.state = base;
      this.saved = true;
    } catch {
      this.emit(
        'warning',
        'Der Spielstand konnte nicht gelesen werden. Eine neue Sitzung wurde gestartet.',
      );
    }
  }
  save() {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.s));
      return !!this.storage;
    } catch {
      this.emit(
        'warning',
        'Speichern ist in diesem Browser gerade nicht möglich. Bitte Speicherzugriff erlauben.',
      );
      return false;
    }
  }
  change(key, amount) {
    this.s[key] = clamp(this.s[key] + amount);
  }
  transaction(amount, label) {
    this.s.money = Math.round((this.s.money + amount) * 100) / 100;
    this.s.ledger.unshift({ amount, label, day: this.s.day, time: this.clock });
    this.s.ledger = this.s.ledger.slice(0, 40);
    if (amount > 0) this.s.earnings += amount;
    else this.s.spent -= amount;
  }
  mail(title, body) {
    this.s.mail.unshift({ title, body, time: this.clock });
    this.s.mail = this.s.mail.slice(0, 30);
    this.emit('mail', title, { body });
  }
  tick(dt, { sprint = false, inside = true } = {}) {
    dt = Math.min(dt, 0.15);
    this.s.minutes += dt / 6;
    this.change('hunger', -dt * 0.023);
    this.change('energy', -dt * (sprint ? 0.12 : 0.012));
    this.change('focus', -dt * (this.s.hunger < 20 ? 0.035 : 0.008));
    this.change('caffeine', -dt * 0.015);
    if (this.s.hunger < 15) this.change('happy', -dt * 0.02);
    if (this.s.minutes >= 1440) {
      this.s.minutes -= 1440;
      this.s.day++;
      this.s.coffeeToday = 0;
      this.s.picked = [];
      this.s.lootClaims = [];
      this.emit('day', 'Ein neuer Tag in München.');
    }
    const now = this.absolute();
    for (const t of [...this.s.active]) {
      if (t.deadline < now) {
        this.s.active = this.s.active.filter((a) => a.id !== t.id);
        this.change('rep', -5);
        this.mail(
          'Deadline verpasst',
          `${t.title}: Leider zu spät. −5 Reputation. Neue Aufträge warten im Büro.`,
        );
      }
    }
    if (this.s.event && now >= this.s.event.until) {
      this.s.event = null;
      this.emit('event', 'Das Sonderereignis ist vorbei.');
    }
    this.s.eventClock += dt;
    this.s.weatherClock += dt;
    if (this.s.eventClock > 180) {
      this.s.eventClock = 0;
      this.randomEvent();
    }
    if (this.s.weatherClock > 420) {
      this.s.weatherClock = 0;
      this.s.weather = this.s.weather === 'Regen' ? 'Sonnig' : 'Regen';
      this.emit(
        'weather',
        this.s.weather === 'Regen'
          ? 'Münchner Regen. Ein guter Moment für einen Kaffee.'
          : 'Die Sonne kommt zurück.',
      );
    }
  }
  randomEvent() {
    const kind = ['urgent', 'happyhour', 'partner', 'change', 'crash'][
      Math.floor(Math.random() * 5)
    ];
    this.s.event = { kind, until: this.absolute() + 50 };
    const messages = {
      urgent: [
        'Dringender BBE-Auftrag',
        'Eine Folie. Fünf echte Minuten. Dreifacher Verdienst. Am Arbeitsplatz annehmen.',
      ],
      happyhour: [
        'Happy Hour auf der Augustenstraße',
        'Alle Spielgerichte sind für fünf Minuten 20 % günstiger.',
      ],
      partner: [
        'Der Partner ist im Haus',
        'Für fünf Minuten ein zusätzlicher Projektplatz. Bitte beschäftigt aussehen.',
      ],
      change: [
        'Noch eine letzte Anpassung',
        'Die Kundschaft hätte gern eine Revision. Revisionsaufträge bringen heute +25 %.',
      ],
      crash: [
        'PowerPoint hat sich verabschiedet',
        'Die Wiederherstellung liegt am BBE-PC bereit. Gespeichert? Dann sind es nur zwei Klicks.',
      ],
    };
    this.mail(...messages[kind]);
  }
  available() {
    return TASKS.filter(
      (t) =>
        t.min <= this.level && t.rep <= this.s.rep && !this.s.active.some((a) => a.type === t.type),
    );
  }
  accept(type) {
    const t = TASKS.find((x) => x.type === type);
    if (!t || t.min > this.level || t.rep > this.s.rep)
      return { ok: false, message: 'Diesen Auftrag schaltest du später frei.' };
    if (this.s.active.some((x) => x.type === type))
      return { ok: false, message: 'Dieser Auftrag läuft bereits.' };
    if (this.s.active.length >= this.career.slots + (this.s.event?.kind === 'partner' ? 1 : 0))
      return {
        ok: false,
        message: 'Deine Projektplätze sind belegt. Schließe zuerst einen Auftrag ab.',
      };
    const urgent = this.s.event?.kind === 'urgent' && type === 'slide';
    const multiplier = urgent
      ? 3
      : this.s.event?.kind === 'change' && type === 'revision'
        ? 1.25
        : 1;
    const task = {
      ...t,
      id: this.s.seq++,
      deadline: this.absolute() + (urgent ? 50 : t.minutes),
      start: this.absolute(),
      progress: [],
      multiplier,
      revision: 0,
    };
    this.s.active.push(task);
    this.mail('BBE · Auftrag angenommen', task.title);
    this.save();
    return { ok: true, task };
  }
  cancel(id) {
    this.s.active = this.s.active.filter((x) => x.id !== id);
    this.change('rep', -3);
    this.save();
  }
  task(type) {
    return this.s.active.find((t) => t.type === type);
  }
  stamp(type, value) {
    const t = this.task(type);
    if (!t || t.progress.includes(value)) return false;
    t.progress.push(value);
    this.emit('progress', `${t.title}: Fortschritt gespeichert.`);
    this.save();
    return true;
  }
  finish(id, score, metrics = {}) {
    const t = this.s.active.find((a) => a.id === id);
    if (!t) return null;
    if (t.deadline < this.absolute()) {
      this.s.active = this.s.active.filter((x) => x.id !== id);
      this.change('rep', -5);
      return null;
    }
    if (!Number.isFinite(score)) return null;
    score = clamp(score);
    const level = this.level;
    const pay =
      Math.round(
        t.base *
          this.career.pay *
          t.multiplier *
          (0.4 + (score / 100) * 0.6) *
          (this.s.focus >= 80 ? 1.06 : 1) *
          100,
      ) / 100;
    const xp = Math.round(18 + score * 0.25 + Math.max(0, t.min - 1) * 5);
    this.transaction(pay, t.title);
    this.s.xp += xp;
    this.s.completed++;
    this.change('rep', score >= 90 ? 9 : score >= 70 ? 6 : score >= 50 ? 3 : -2);
    this.change('energy', -5);
    this.change('focus', -3);
    this.change('happy', score >= 85 ? 5 : 1);
    if (['slide', 'revision'].includes(t.type) && score >= 95) this.s.perfectSlides++;
    if (metrics.alignment === 100) this.unlock('pixel');
    this.s.active = this.s.active.filter((a) => a.id !== id);
    this.checkAchievements();
    if (this.level > level) {
      this.emit('promotion', `Beförderung: ${this.career.name}!`, {
        level: this.level,
        perk: this.career.perk,
      });
      this.mail(
        'BBE · Herzlichen Glückwunsch',
        `${this.career.name}: ${this.career.perk}. Deine Vergütung ist gestiegen.`,
      );
    }
    this.save();
    return { score, pay, xp, metrics, title: t.title };
  }
  unlock(id) {
    if (this.s.achievements.includes(id)) return;
    this.s.achievements.push(id);
    const a = ACHIEVEMENTS.find((x) => x[0] === id);
    if (a) this.emit('achievement', a[1], { body: a[2] });
  }
  checkAchievements() {
    const checks = {
      brawler: this.s.knockouts >= 1,
      driver: this.s.driven >= 100,
      wc: this.s.toiletUses >= 3,
      aim: this.s.wcBest >= 90,
      first: this.s.completed >= 1,
      slide: this.s.perfectSlides >= 5,
      veteran: this.s.completed >= 50,
      gourmet: this.s.visits.length >= RESTAURANTS.length,
      bottle: this.s.returned >= 100,
      coffee: this.s.coffeeToday >= 10,
      revision: this.s.revisions >= 7,
      partner: this.level === 7,
    };
    for (const [id, yes] of Object.entries(checks)) if (yes) this.unlock(id);
  }
  coffee() {
    this.s.coffeeToday++;
    this.change('caffeine', 18);
    this.change('energy', this.s.caffeine > 65 ? 30 : 15);
    this.change('focus', 10);
    if (this.s.caffeine > 65) this.change('happy', -5);
    this.emit(
      'coffee',
      this.s.caffeine > 65
        ? 'Koffein-Level kritisch. +30 Energie · +10 Fokus · −5 Zufriedenheit'
        : '+15 Energie · +10 Fokus',
    );
    this.checkAchievements();
    this.save();
  }
  price(food) {
    return Math.round(food.price * (this.s.event?.kind === 'happyhour' ? 0.8 : 1) * 100) / 100;
  }
  buyFood(id, index) {
    const r = RESTAURANTS.find((x) => x.id === id),
      f = r?.foods[index];
    if (!f) return { ok: false, message: 'Gericht nicht verfügbar.' };
    const price = this.price(f);
    if (this.s.money < price)
      return { ok: false, message: 'Das reicht leider nicht. Ein BBE-Auftrag oder Pfand hilft.' };
    this.transaction(-price, `${r.name}: ${f.name}`);
    for (const stat of ['hunger', 'energy', 'happy', 'focus']) this.change(stat, f[stat]);
    if (!this.s.visits.includes(id)) this.s.visits.push(id);
    this.checkAchievements();
    this.save();
    return { ok: true, food: f, restaurant: r, price };
  }
  pickBottle(id, cents) {
    if (this.s.picked.includes(id) || this.s.inventory.length >= 30) return false;
    if (![8, 15, 25].includes(cents)) return false;
    this.s.picked.push(id);
    this.s.inventory.push(cents);
    this.emit('bottle', `Pfand eingepackt · ${(cents / 100).toFixed(2).replace('.', ',')} €`);
    this.save();
    return true;
  }
  returnBottle() {
    if (!this.s.inventory.length) return 0;
    const cents = this.s.inventory.shift();
    this.transaction(cents / 100, 'Pfandrückgabe');
    this.s.returned++;
    this.checkAchievements();
    this.save();
    return cents;
  }
  upgrade(id) {
    const options = {
      mouse: { price: 18, min: 2 },
      monitor: { price: 65, min: 3 },
      plant: { price: 12, min: 1 },
      chair: { price: 90, min: 4 },
      award: { price: 150, min: 5 },
    };
    const o = options[id];
    if (!o || this.s.upgrades.includes(id) || this.level < o.min || this.s.money < o.price)
      return false;
    this.transaction(-o.price, 'Arbeitsplatz-Upgrade');
    this.s.upgrades.push(id);
    this.change('happy', 10);
    this.change('focus', 5);
    this.save();
    return true;
  }
  rest() {
    this.s.day++;
    this.s.minutes = 497;
    this.s.coffeeToday = 0;
    this.s.caffeine = 0;
    this.s.energy = 95;
    this.s.focus = 85;
    this.change('hunger', -15);
    this.change('happy', 10);
    this.s.picked = [];
    this.s.weather = 'Sonnig';
    this.s.event = null;
    for (const t of [...this.s.active])
      if (t.deadline < this.absolute()) {
        this.s.active = this.s.active.filter((a) => a.id !== t.id);
        this.change('rep', -5);
      }
    this.save();
    this.emit('day', 'Guten Morgen. Neue Aufgaben verfügbar.');
  }
  export() {
    return JSON.stringify(this.s, null, 2);
  }
  import(text) {
    const old = this.s;
    try {
      const v = JSON.parse(text);
      if (
        v.version !== 1 ||
        !Number.isFinite(v.money) ||
        !Number.isFinite(v.xp) ||
        !Array.isArray(v.active)
      )
        throw Error();
      this.storage.setItem(SAVE_KEY, text);
      this.load();
      return true;
    } catch {
      this.state = old;
      return false;
    }
  }
  reset() {
    this.state = freshState();
    this.save();
  }
}
