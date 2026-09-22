import { Quizssoir } from './quizssoir.js';
import { OriginStory } from './origin-story.js';
import { TitleMusic } from './title-music.js';
import { MissionPassed } from './mission-passed.js';
import { CityExtras } from './city-extras.js';
import { FireStory } from './fire-story.js';
import { STREET_ROADS, CIRCULAR_STREETS } from './city-streets.js';
import { inIT } from './it-office.js';
import { MouseControls } from './mouse-controls.js';
import { hudIcon, updateCinematicHUD } from './cinematic-hud.js';
import { WorkshopStory } from './workshop-story.js';
import { CITY_LAYOUT, CITY_WALKS } from './city-layout.js';
import { COURIER_DESTINATION } from './vertical-city.js';
import { BBE_LOGO } from './branding.js';
import { CITY_STOPS, HELIPADS } from './city-expansion.js';
import { Simulation } from './simulation.js';
import { GameWorld } from './world.js';
import { Soundscape } from './audio.js';
import { CAREERS, RESTAURANTS, TASKS, ACHIEVEMENTS, QUIPS, euro, clamp } from './data.js';
import { Minigames } from './mission-games.js';
import { Arcade } from './arcade.js';
import { openAudioSettings } from './audio-settings.js';
import { showPhone } from './smartphone.js';

const $ = (q, root = document) => root.querySelector(q);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export class Game {
  constructor() {
    this.sim = new Simulation();
    this.audio = new Soundscape(this.sim);
    this.modal = null;
    this.started = false;
    this.busy = false;
    this.autosave = 0;
    this.uiTimer = 0;
    this.lastFrame = 0;
    this.fps = 60;
    this.waypoint = null;
    this.timeouts = new Set();
    this.phonePage = 'home';
    this.renderShell();
    try {
      this.world = new GameWorld($('#world'), this.sim);
    } catch (e) {
      const unavailable = e.code === 'WEBGL_UNAVAILABLE';
      this.error(
        unavailable ? 'WebGL 2 ist nicht verfügbar.' : 'Das Spiel konnte nicht starten.',
        unavailable
          ? 'Der Browser konnte keine 3D-Verbindung herstellen. Bitte WebGL 2 und Hardwarebeschleunigung in den Browser-Einstellungen prüfen.'
          : 'Beim Laden des Spiels ist ein Fehler aufgetreten. Die technischen Details helfen dabei, die Ursache zu finden.',
        e,
      );
      return;
    }
    this.minigames = new Minigames(this);
    this.arcade = new Arcade(this);
    this.workshop = new WorkshopStory(this);
    this.fireStory = new FireStory(this);
    this.extras = new CityExtras(this);
    this.origin = new OriginStory(this);
    this.quizssoir = new Quizssoir(this);
    this.mouseControls = new MouseControls(this);
    this.missionPassed = new MissionPassed(this);
    this.titleMusic = new TitleMusic(this);
    this.bind();
    this.sim.listeners.push((e) => this.onEvent(e));
    this.intro();
    this.updateHUD();
    const boot = window.__bbeBoot;
    this.extras.intro.skipKeyHeld = !!boot?.spaceHeld;
    boot?.takeOver?.();
    if (!boot?.skipIntro) {
      this.introReady = this.extras.intro.play({ automatic: true }).catch((error) => {
        this.error('Das Intro konnte nicht starten.', 'Bitte die Seite neu laden.', error);
      });
    } else this.titleMusic.adopt();
    // Keep the minimal boot overlay until surfaces and a real scene frame are ready.
    // Skipping the intro must not wait for a cancelled shader warm-up.
    let bootAssetsReady = false;
    Promise.resolve(this.world.remasterReady).then(
      () => {
        bootAssetsReady = true;
      },
      () => {
        bootAssetsReady = true;
      },
    );
    this.frame = (now) => {
      const rawDelta = (now - this.lastFrame) / 1000 || 0.016;
      const dt = Math.min(rawDelta, 0.08);
      this.lastFrame = now;
      const hidden = document.hidden;
      const paused = !this.started || hidden || this.modal?.pause === true;
      const renderedWorld = !hidden && !this.cinematic;
      if (!hidden) {
        if (this.cinematic) {
          const film = this.activeFilm;
          film.performance?.record(rawDelta, film.current);
          film.render(Math.min(rawDelta, 0.25));
        } else
          this.world.update(paused ? 0 : dt, !!this.modal || this.busy || !this.started || hidden);
      }
      if (!hidden && bootAssetsReady && !this.extras.intro.current?.loading) boot?.complete?.();
      if (!paused) {
        this.sim.tick(dt, { sprint: this.world.sprinting, inside: this.world.zone !== 'city' });
        this.autosave += dt;
        if (this.autosave > 20) {
          this.sim.save();
          this.autosave = 0;
        }
      }
      this.extras.update(dt, rawDelta, paused);
      this.titleMusic.update();
      this.audio.update(
        dt,
        this.world,
        !paused ||
          !!(
            this.extras.intro.current &&
            !this.extras.intro.current.paused &&
            !this.extras.intro.current.loading
          ),
      );
      this.extras.afterAudio();
      this.origin.update(dt, paused);
      this.fireStory.update(rawDelta, paused);
      this.missionPassed.update(renderedWorld);
      this.uiTimer += dt;
      this.fps = this.fps * 0.96 + (1 / Math.max(rawDelta, 0.001)) * 0.04;
      this.world.remasterPerformance.record(rawDelta, {
        active: !paused,
        hidden,
        cinematic: !!this.cinematic || !!this.extras.intro.current,
      });
      // Resolution alone cannot solve a draw-call bottleneck on integrated GPUs.
      const adaptive = this.world.remasterPerformance;
      const sustainedFloorLoad =
        !paused &&
        !this.cinematic &&
        !this.extras.intro.current &&
        !this.world.lowQuality &&
        adaptive.scale <= adaptive.floor + 0.001 &&
        this.fps < 28 &&
        rawDelta < 0.2;
      this.remasterSlowSeconds = sustainedFloorLoad
        ? (this.remasterSlowSeconds || 0) + rawDelta
        : 0;
      if (this.remasterSlowSeconds > 6) {
        this.world.setQuality(true);
        this.remasterSlowSeconds = 0;
        this.toast(
          'Grafik für flüssigeres Spielen angepasst.',
          'Fototexturen bleiben aktiv. Grafikqualität in den Einstellungen.',
        );
      }
      if (this.uiTimer > 0.15) {
        this.uiTimer = 0;
        if (!this.extras.intro.current) this.updateHUD();
      }
      if (!hidden) this.quizssoir.update(dt);
      this.mouseControls.update();
      requestAnimationFrame(this.frame);
    };
    requestAnimationFrame(this.frame);
    window.addEventListener('beforeunload', () => this.sim.save());
    document.addEventListener('visibilitychange', () => {
      this.lastFrame = performance.now();
      this.world.keys.clear();
      if (document.hidden) this.sim.save();
    });
  }
  get activeFilm() {
    if (this.quizssoir?.active) return this.quizssoir;
    if (this.extras?.intro.current) return this.extras.intro;
    if (this.origin?.activeFilm) return this.origin.activeFilm;
    return this.fireStory?.cinematic
      ? this.fireStory.film
      : this.workshop?.cinematic
        ? this.workshop.film
        : null;
  }
  get cinematic() {
    return !!this.activeFilm;
  }
  renderShell() {
    $('#ui').innerHTML =
      `<header class="hud-top"><div class="brand"><div class="brand-mark"><img src="${BBE_LOGO}" alt="BBE Handelsberatung GmbH"></div><div class="brand-copy"><b>Handelsberatung</b><span>MUNICH CONSULTING SIMULATOR</span></div></div><div class="top-state"><div class="clock"><span id="day-name">Montag</span><strong id="clock">08:17</strong><small id="weather">17 °C · Sonnig</small></div><div class="wallet"><span id="money">32,80 €</span><small>BANKKONTO</small></div><button class="icon-btn" id="phone-button" aria-label="Smartphone öffnen" title="Smartphone · P">${hudIcon('phone')}<span class="key-badge">P</span></button><button class="icon-btn" id="settings-button" aria-label="Einstellungen öffnen" title="Einstellungen · Esc">${hudIcon('settings')}</button></div></header><div class="zone-label"><b id="zone-name">BBE Handelsberatung</b><span id="zone-address">Brienner Straße 45</span></div><section class="mission-hud"><div class="eyebrow" id="quest-eyebrow" hidden>DEIN ERSTER ARBEITSTAG</div><h3 id="quest-title">BBE-Aufträge</h3><p id="quest-description"></p><div class="quest-meta" hidden><span id="quest-location">BBE · Arbeitsplatz</span><strong id="quest-reward">ab 24,50 €</strong></div><button class="quest-button" id="tasks-button" aria-label="Aufträge öffnen" title="Aufträge · J"><kbd>J</kbd></button></section><div class="waypoint" id="waypoint" hidden></div><div class="mini-wrap"><div class="mini-head"><span>MAXVORSTADT</span><span>N ↑</span></div><canvas id="minimap" width="424" height="328" class="mini-map" aria-label="Minikarte"></canvas><div class="mini-foot"><kbd>M</kbd> Karte <span>·</span> <b>BBE ist dein Zuhause.</b></div></div><button class="interaction" id="interaction"><kbd>E</kbd><span></span></button><div class="controls"><div id="context-controls"></div></div><div class="stats-hud"><div class="career-mini"><div><span class="level" id="level">LEVEL 1</span><strong id="career">Praktikant</strong></div><span id="rep">0 REP</span></div>${[
        ['hunger', 'Sättigung'],
        ['energy', 'Energie'],
        ['happy', 'Zufriedenheit'],
        ['focus', 'Fokus'],
      ]
        .map(
          ([id, l]) =>
            `<div class="stat-row"><span>${l}</span><div class="stat-track"><div id="bar-${id}" class="stat-fill"></div></div><span class="value" id="value-${id}"></span></div>`,
        )
        .join(
          '',
        )}</div><div class="fps" id="fps"></div><div class="touch-controls"><div class="touch-pad"><span></span><button data-key="KeyW" aria-label="Vorwärts">↑</button><span></span><button data-key="KeyA" aria-label="Links">←</button><button data-key="KeyS" aria-label="Rückwärts">↓</button><button data-key="KeyD" aria-label="Rechts">→</button></div></div><div class="touch-actions"><button id="touch-map" aria-label="Karte">M</button><button id="touch-interact" aria-label="Interagieren">E</button></div>`;
  }
  bind() {
    this.uiClick('#phone-button', () => this.phone());
    this.uiClick('#settings-button', () => this.settings());
    this.uiClick('#tasks-button', () => this.phone('tasks'));
    this.uiClick('#interaction', () => this.interact());
    this.uiClick('#touch-interact', () => this.interact());
    this.uiClick('#touch-map', () => this.phone('map'));
    document.querySelectorAll('[data-key]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.world.keys.add(b.dataset.key);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) =>
        b.addEventListener(t, () => this.world.keys.delete(b.dataset.key)),
      );
    });
    window.addEventListener('keydown', (e) => {
      if (this.workshop.cinematic) {
        if (e.code === 'Tab') this.trapFocus(e);
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          if (!e.repeat) {
            if (e.key === 'Escape') this.workshop.film.pause(!this.workshop.film.current.paused);
            else this.workshop.film.finish();
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.busy) return;
        if (this.modal) {
          if (this.modal.locked) return;
          this.close();
        } else if (this.started) this.settings();
        return;
      }
      if (this.modal || !this.started || this.busy) {
        if (e.code === 'Tab' && this.modal) this.trapFocus(e);
        return;
      }
      if (e.code === 'F1') {
        e.preventDefault();
        if (!e.repeat) this.arcade.guide();
        return;
      }
      if (['Tab', 'KeyM', 'KeyE', 'KeyJ', 'KeyP'].includes(e.code)) {
        e.preventDefault();
        if (e.repeat) return;
        if (e.code === 'KeyE') this.interact();
        else
          this.phone(
            e.code === 'KeyM'
              ? 'map'
              : e.code === 'Tab'
                ? 'stats'
                : e.code === 'KeyJ'
                  ? 'tasks'
                  : 'home',
          );
      }
    });
  }
  uiClick(q, fn) {
    $(q)?.addEventListener('click', fn);
  }
  trapFocus(e) {
    const els = [
      ...document.querySelectorAll(
        '#modal-root button:not(:disabled),#modal-root input,#modal-root select,#modal-root a,#modal-root summary',
      ),
    ].filter((x) => x.offsetParent !== null);
    if (!els.length) return;
    const first = els[0],
      last = els.at(-1);
    if (this.modal?.phone && !els.includes(document.activeElement)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  intro() {
    $('#ui').classList.add('intro-open');
    const box = document.createElement('section');
    box.className = 'welcome';
    box.id = 'welcome';
    box.tabIndex = -1;
    box.innerHTML = `<div class="eyebrow">MÜNCHEN · MAXVORSTADT · ${this.sim.clock}</div><h1>Zwischen Folien<br>und <span>Feierabend.</span></h1><p class="greeting">Guten Morgen.<br>Neue Aufgaben verfügbar.</p><button class="primary" id="start-game">${this.sim.saved ? 'Aufstehen & weiterspielen' : 'Aufstehen & Arbeitstag beginnen'} <span style="float:right">↗</span></button><button class="story-welcome-button" id="start-origin-story">${this.sim.s.originStory.phase === 'complete' ? 'Story erneut erleben' : this.sim.s.originStory.phase === 'new' ? 'Story-Modus' : 'Story fortsetzen'} <span>↗</span></button><button class="story-welcome-button" id="start-intro">Intro <span>▶</span></button><div class="save-note">${this.sim.saved ? `Spielstand geladen · ${this.sim.career.name} · ${euro(this.sim.s.money)}` : 'WASD bewegen · Maus bewegen · P Smartphone · E interagieren'}</div><div class="divider"></div><div class="small-print">Eine fiktive Spielwelt mit realen Münchner Ortsnamen. Innenräume und Handlung frei interpretiert. Kein offizielles BBE-Produkt.</div>`;
    $('#ui').append(box);
    this.uiClick('#start-origin-story', () => this.origin.begin());
    this.uiClick('#start-intro', () => this.extras.intro.play());
    this.uiClick('#start-game', () => {
      this.started = true;
      this.titleMusic.stop();
      this.world.started = true;
      // Stand beside the chair, with a free path to the desk and corridor.
      this.world.teleport(-9.15, 2.65);
      this.world.pose = 'walk';
      this.audio.start();
      this.mouseControls.resume();
      this.fireStory.onStart();
      box.remove();
      $('#ui').classList.remove('intro-open');
      this.toast(
        'Willkommen bei der BBE',
        'E · Benutzen. P · Smartphone. F1 · Alle Steuerungen. München wartet auf dich.',
      );
      for (const e of this.sim.pending.splice(0)) if (e.type === 'warning') this.toast(e.message);
    });
  }
  open(
    title,
    html,
    {
      eyebrow = 'BBE · MUNICH LIFE',
      pause = false,
      locked = false,
      onClose = null,
      task = null,
    } = {},
  ) {
    this.missionPassed?.pause();
    if (this.modal?.onClose) this.modal.onClose();
    if (!this.modal) this.focusReturn = document.activeElement;
    this.modal = { title, pause, locked, onClose, task };
    this.world.keys.clear();
    this.mouseControls?.release();
    $('#modal-root').innerHTML =
      `<div class="modal-shade"><section class="panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="panel-header"><div><div class="eyebrow">${eyebrow}${pause ? '<span class="paused-badge">SPIEL PAUSIERT</span>' : ''}</div><h2 id="modal-title">${title}</h2>${Number.isFinite(task?.deadline) ? '<p class="mission-deadline" role="timer" aria-live="off"></p>' : ''}</div>${locked ? '' : `<button class="close" aria-label="Schließen">×</button>`}</header><div class="panel-body">${html}</div></section></div>`;
    this.updateTaskDeadline();
    $('.close')?.addEventListener('click', () => this.close());
    const openedModal = this.modal;
    setTimeout(() => {
      if (this.modal === openedModal && !openedModal.phone)
        $('#modal-root button, #modal-root input')?.focus();
    }, 30);
  }
  close() {
    if (this.modal?.locked) return;
    if (this.modal?.onClose) this.modal.onClose();
    this.modal = null;
    $('#modal-root').innerHTML = '';
    this.world.keys.clear();
    this.world.pose = 'walk';
    this.focusReturn?.focus?.();
    this.mouseControls?.resume();
  }
  toast(title, body = '', gold = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (gold ? ' gold' : '');
    el.innerHTML = `<strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ''}`;
    $('#toasts').append(el);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(() => el.remove(), 6200);
  }
  onEvent(e) {
    if (e.type === 'mission-complete') {
      this.missionPassed.enqueue(e);
      return;
    }
    if (e.type === 'promotion') {
      this.world.makeWorkstation();
      this.audio.play('promotion');
      this.toast(e.message, e.perk, true);
    } else if (e.type === 'achievement') {
      this.audio.play('success');
      this.toast('Erfolg freigeschaltet · ' + e.message, e.body, true);
    } else if (e.type === 'mail') {
      this.audio.play('mail');
      this.toast(e.message, e.body);
    } else if (e.type === 'coffee' || e.type === 'bottle') {
      this.audio.play(e.type);
      this.toast(e.message);
    } else this.toast(e.message, e.body || '');
    if (e.type === 'day') this.world.updateBottles();
  }
  updateTaskDeadline() {
    const task = this.modal?.task;
    if (!Number.isFinite(task?.deadline)) return;
    const element = $('#modal-root .mission-deadline');
    if (!element) return;
    const current = this.sim.s.active.find((entry) => entry.id === task.id) || task;
    const remaining = current.deadline - this.sim.absolute();
    const label =
      remaining < 0 ? 'Frist abgelaufen' : `Noch ${Math.max(0, Math.ceil(remaining))} Spielmin.`;
    if (element.textContent !== label) element.textContent = label;
    element.classList.toggle('deadline-urgent', remaining <= 10);
  }
  updateHUD() {
    this.updateTaskDeadline();
    updateCinematicHUD(this);
    const s = this.sim.s;
    $('#money').textContent = euro(s.money);
    $('#clock').textContent = this.sim.clock;
    $('#day-name').textContent = this.sim.weekday.slice(0, 2);
    $('#weather').textContent =
      `Tag ${s.day} · ${s.weather === 'Regen' ? '14 °C · Regen' : '19 °C · ' + (s.minutes > 1200 || s.minutes < 360 ? 'Nacht' : 'Sonnig')}`;
    $('#career').textContent = this.sim.career.name;
    $('#level').textContent = `LEVEL ${this.sim.level}`;
    $('#rep').textContent = `${Math.floor(s.rep)} REP`;
    for (const key of ['hunger', 'energy', 'happy', 'focus']) {
      $('#bar-' + key).style.width = s[key] + '%';
      $('#bar-' + key).classList.toggle('low', s[key] < 25);
      $('#value-' + key).textContent = Math.round(s[key]);
    }
    const z = this.world.zone;
    $('#zone-name').textContent =
      z === 'office'
        ? 'BBE Handelsberatung'
        : z === 'city'
          ? 'München · Maxvorstadt'
          : z === 'brewery'
            ? 'Brienner Bräu'
            : this.world.currentRestaurant.name;
    $('#zone-address').textContent =
      z === 'office'
        ? 'Brienner Straße 45'
        : z === 'city'
          ? 'Brienner Straße / Augustenstraße'
          : z === 'brewery'
            ? 'Brienner Straße · Hausbrauerei'
            : this.world.currentRestaurant.address;
    if (z === 'city') {
      const p = this.world.player.position,
        stop = CITY_STOPS.map((q) => ({ q, d: Math.hypot(p.x - q.x, p.z - q.z) })).sort(
          (a, b) => a.d - b.d,
        )[0];
      if (stop.d < 75) {
        $('#zone-name').textContent = stop.q.name;
        $('#zone-address').textContent =
          stop.q.id === 'benno' || stop.q.id === 'koenigsplatz'
            ? 'München · Maxvorstadt'
            : 'München · Innenstadt';
      }
      if (this.arcade?.vehicle?.type === 'helicopter')
        $('#zone-address').textContent = 'BBE AIR · Über den Dächern von München';
    }
    if (z === 'office' && this.world.player.position.x > 44) {
      $('#zone-name').textContent = 'BBE · Tiefgarage';
      $('#zone-address').textContent = 'Hinterhof · Ausgang bei der Beschilderung';
    }
    const task = s.active[0];
    if (task) {
      $('#quest-eyebrow').textContent =
        task.multiplier === 3 ? 'DRINGENDER BBE-AUFTRAG' : 'AKTIVER BBE-AUFTRAG';
      $('#quest-title').textContent = task.title;
      const hints = {
        benchmark: 'Speisekarten fotografieren · ' + task.progress.length + '/3',
        mystery: task.progress.includes('service')
          ? 'Bericht am BBE-PC abgeben'
          : task.progress.includes('visited')
            ? 'MAMMA BAO · Service befragen'
            : 'MAMMA BAO besuchen',
        lunch: task.progress.includes('delivered')
          ? 'Am BBE-PC abgeben'
          : task.progress.includes('picked')
            ? 'Lunch zum BBE-Empfang bringen'
            : 'PALMTREECLUB · Lunch abholen',
        meeting: task.progress.includes('met') ? 'Am BBE-PC abgeben' : 'Kundenbüro besuchen',
      };
      $('#quest-description').textContent = hints[task.type] || '';
      $('#quest-location').textContent =
        `Noch ${Math.max(0, Math.ceil(task.deadline - this.sim.absolute()))} Spielmin.`;
      $('#quest-reward').textContent =
        `ab ${euro(task.base * this.sim.career.pay * task.multiplier)}`;
    } else if (s.completed) {
      $('#quest-eyebrow').textContent = 'DEIN NÄCHSTER SCHRITT';
      $('#quest-title').textContent = 'BBE-Aufträge';
      $('#quest-description').textContent = '';
      $('#quest-location').textContent = `${s.completed} Aufträge erledigt`;
      $('#quest-reward').textContent = `${s.xp} XP`;
    } else {
      $('#quest-eyebrow').textContent = 'DEIN ERSTER ARBEITSTAG';
      $('#quest-title').textContent = 'BBE-Aufträge';
      $('#quest-description').textContent = '';
      $('#quest-location').textContent = 'BBE · Arbeitsplatz';
      $('#quest-reward').textContent = 'ab 24,50 €';
    }
    const inter = $('#interaction'),
      n = this.world.nearest;
    inter.classList.toggle('visible', !!n && this.started && !this.modal && !this.busy);
    if (n) $('span', inter).textContent = n.label;
    $('#fps').textContent =
      `${Math.round(this.fps)} FPS · ${this.world.lowQuality ? 'Sparmodus' : 'Hohe Grafik'}`;
    this.drawMap($('#minimap'), true);
    if (this.modal?.title === 'Dein Smartphone' && this.phonePage === 'map')
      this.drawMap($('#large-map'), false);
    if (this.waypoint && z === 'city') {
      const d = Math.hypot(
        this.world.player.position.x - this.waypoint.x,
        this.world.player.position.z - this.waypoint.z,
      );
      $('#waypoint').hidden = false;
      $('#waypoint').textContent = `◇ ${this.waypoint.name} · ${Math.round(d)} m`;
      if (d < 3) {
        this.waypoint = null;
        $('#waypoint').hidden = true;
      }
    } else $('#waypoint').hidden = true;
    this.workshop?.updateHUD();
    this.fireStory?.updateHUD();
    this.origin?.updateHUD();
    if (z === 'office' && this.world.player.position.x < -13.5) {
      $('#zone-name').textContent = inIT(this.world.player.position)
        ? 'BBE · IT / Benjamin'
        : 'BBE · Westflügel';
      $('#zone-address').textContent = 'Brienner Straße 45 · Immer da fürs Team';
    }
  }
  transition(zone, id) {
    if (this.quizssoir?.active) return;
    if (this.origin?.beforeTransition(zone) === false) return;
    if (this.fireStory?.beforeTransition() === false) return;
    this.worldTransitionUntil = performance.now() + 700;
    this.missionPassed?.pause();
    this.close();
    this.busy = false;
    const f = document.createElement('div');
    f.className = 'transition-flash';
    document.body.append(f);
    this.audio.transitionSound = true;
    this.audio.voices.stop();
    this.workshop?.transition();
    this.arcade?.parkForTransition();
    this.world.enter(zone, id);
    setTimeout(() => f.remove(), 700);
    this.sim.save();
  }
  interact() {
    if (!this.started || this.modal || this.busy) return;
    const n = this.world.nearest;
    if (this.quizssoir.interact(n)) return;
    if (this.origin.interact(n)) return;
    if (this.extras.interact(n)) return;
    if (this.fireStory.interact(n)) return;
    if (this.workshop.interact(n)) return;
    if (this.arcade.interact(n)) return;
    if (!n) return;
    this.audio.play('click');
    switch (n.kind) {
      case 'computer':
        this.desktop();
        break;
      case 'coffee':
        this.coffee();
        break;
      case 'exit':
        this.transition('city');
        break;
      case 'hq':
        this.transition('office');
        break;
      case 'restaurant':
        this.transition('restaurant', n.data);
        if (n.data === 'bao') this.sim.stamp('mystery', 'visited');
        break;
      case 'r-exit':
        this.transition('city', this.world.currentRestaurant.id);
        break;
      case 'order':
        this.menu();
        break;
      case 'service':
        this.service();
        break;
      case 'bottle':
        if (this.sim.pickBottle(n.data.id, n.data.cents)) this.world.updateBottles();
        else
          this.toast('Dein Rucksack ist voll.', 'Der Pfandautomat steht auf der Augustenstraße.');
        break;
      case 'return':
        this.returnMachine();
        break;
      case 'reception':
        this.reception();
        break;
      case 'colleague':
        this.colleague(n.data);
        break;
      case 'photo':
        this.photo(n.data);
        break;
      case 'client':
        this.client();
        break;
      case 'partner':
        this.partner();
        break;
      case 'lounge':
        this.lounge();
        break;
      case 'wc':
        this.world.teleport(34, 25.7);
        this.world.yaw = 0;
        this.toast(
          'Pssssch? Die Kabinen sind geradeaus.',
          'Vor einer Toilette E drücken. Nach dem Minispiel spülen und Hände waschen.',
        );
        break;
      case 'office-back':
        this.world.teleport(-0.4, 5.3);
        this.world.yaw = 0;
        break;
      case 'printer':
        this.printer();
        break;
    }
  }
  timedAction(title, body, duration, done) {
    this.busy = true;
    const e = document.createElement('div');
    e.className = 'eat-banner';
    e.innerHTML = `<strong>${title}</strong><p>${body}</p><div class="eat-progress"></div>`;
    e.querySelector('.eat-progress').style.setProperty('--duration', duration + 's');
    document.body.append(e);
    setTimeout(() => {
      e.remove();
      this.busy = false;
      done?.();
    }, duration * 1000);
  }
  coffee() {
    this.sim.coffee();
    this.audio.voices.say('player', 'coffee');
    this.sim.change('bladder', 14);
    this.world.pose = 'drink';
    this.timedAction(
      'Ein Kaffee. Eine gute Idee.',
      'Die Kaffeemaschine analysiert bereits das Bohnenpotenzial.',
      2.1,
      () => {
        this.world.pose = 'walk';
      },
    );
  }
  result(r) {
    if (!r) {
      this.toast('Dieser Auftrag ist nicht mehr aktiv.', 'Vielleicht ist die Deadline abgelaufen.');
      this.close();
      return;
    }
    this.world.makeWorkstation();
    const metrics = r.metrics;
    this.open(
      'Abgabe erfolgreich',
      `<div class="score-result"><div class="eyebrow">BBE HANDELSBERATUNG · QUALITÄTSCHECK</div><h3>${esc(r.title)}</h3><div class="score-big">${Math.round(r.score)}<span> %</span></div><p class="muted">${r.score >= 95 ? 'Managementtauglich. Sogar vor dem ersten Kaffee.' : r.score >= 80 ? 'Klare Storyline. Der Kunde kann damit arbeiten.' : r.score >= 60 ? 'Solide Grundlage. Da geht noch etwas beim nächsten Auftrag.' : 'Abgegeben ist auch ein Status. Der nächste Versuch wird besser.'}</p>${
        Object.keys(metrics).length
          ? `<div class="score-grid">${Object.entries(metrics)
              .map(
                ([k, v]) =>
                  `<div>${{ content: 'Inhalt', layout: 'Layout', alignment: 'Alignment', speed: 'Tempo' }[k] || k}<strong>${Math.round(v)} %</strong></div>`,
              )
              .join('')}</div>`
          : ''
      }<div class="reward">+ ${euro(r.pay)}</div><p>+${r.xp} XP · ${this.sim.career.name} · ${Math.floor(this.sim.s.rep)} Reputation</p><div class="divider"></div><button class="primary" id="result-done">Zurück in den Arbeitstag</button> <button class="ghost" id="result-more">Nächster Auftrag</button></div>`,
      { pause: true },
    );
    this.audio.voices.say('Lena', 'greet', {
      id: 'lena_dialog_' + (r.score >= 80 ? 'success' : 'failure'),
      preview: true,
      force: true,
      priority: 4,
    });
    this.uiClick('#result-done', () => {
      this.audio.voices.stop();
      this.close();
    });
    this.uiClick('#result-more', () => {
      this.audio.voices.stop();
      this.desktop();
    });
  }
  desktop() {
    if (this.origin?.active) {
      this.toast('Zuerst deine Schicht im Zitronengras abschließen.');
      return;
    }
    this.world.pose = 'work';
    const s = this.sim.s;
    const active = s.active;
    this.open(
      'Dein BBE Desktop',
      `<div class="toolbar compact-desktop-actions"><button class="selected" id="desk-tasks">Aufträge ${active.length}/${this.sim.career.slots + (s.event?.kind === 'partner' ? 1 : 0)}</button><button id="desk-upgrades">Arbeitsplatz</button><button id="desk-save">Speichern</button></div>${s.focus < 30 ? '<p class="mission-note">Fokus niedrig · Kaffee hilft.</p>' : ''}${s.event?.kind === 'crash' ? '<p class="mission-note">Entwurf verfügbar. <button id="recover" class="small">Wiederherstellen</button></p>' : ''}${active.length ? `<h3 class="mission-list-heading">In Arbeit</h3><div class="mission-list">${active.map((t) => this.taskCard(t, true)).join('')}</div>` : ''}<h3 class="mission-list-heading">Verfügbar</h3><div class="mission-list">${
        this.sim
          .available()
          .map((t) => this.taskCard(t, false))
          .join('') || '<p class="muted">Alles in Arbeit.</p>'
      }</div><details class="mission-extra"><summary>Story-Missionen</summary><div class="mission-list">${this.workshop.entryCard()}${this.fireStory.entryCard()}<button id="desk-courier" class="mission-row mission-open"><span class="mission-row-title">Eilauftrag · Koffer</span><span aria-hidden="true">↗</span></button></div></details>`,
      { eyebrow: 'BBE · AUFTRÄGE' },
    );
    document.querySelectorAll('[data-accept]').forEach(
      (b) =>
        (b.onclick = () => {
          const r = this.sim.accept(b.dataset.accept);
          if (!r.ok) this.toast(r.message);
          this.desktop();
          if (r.ok)
            this.audio.voices.say(
              b.dataset.accept === 'excel'
                ? 'Tobias'
                : ['benchmark', 'mystery', 'lunch'].includes(b.dataset.accept)
                  ? 'Mara'
                  : 'Lena',
              'job',
              { force: true },
            );
        }),
    );
    document
      .querySelectorAll('[data-play]')
      .forEach((b) => (b.onclick = () => this.playTask(Number(b.dataset.play))));
    this.uiClick('#desk-courier', () => {
      if (this.world.zone !== 'office' || this.world.player.position.x > 44) {
        this.toast('Der Koffer wartet bei der BBE.', 'Am Arbeitsplatz oder Empfang übernehmen.');
        return;
      }
      this.arcade.immersion.courier.brief();
    });
    this.uiClick('#desk-upgrades', () => this.upgrades());
    this.uiClick('#desk-save', () => {
      if (this.sim.save()) this.toast('Spiel gespeichert.', 'Deine Karriere wartet hier auf dich.');
    });
    this.uiClick('#recover', () => {
      this.sim.s.event = null;
      this.toast('Wiederherstellung erfolgreich.', 'final_final_v4_gerettet.pptx');
      this.sim.save();
      this.desktop();
    });
  }
  taskCard(t, active) {
    const action = active ? 'Bearbeiten' : 'Annehmen';
    return `<button class="mission-row bbe-task-row" ${active ? `data-play="${t.id}"` : `data-accept="${t.type}"`} aria-label="${esc(t.title)} · ${action}" title="${action}"><span class="mission-row-title">${esc(t.title)}</span><span class="mission-row-icon" aria-hidden="true">${active ? '↗' : '+'}</span></button>`;
  }
  playTask(id) {
    const t = this.sim.s.active.find((a) => a.id === id);
    if (!t) return this.desktop();
    if (['benchmark', 'mystery', 'lunch', 'meeting'].includes(t.type)) {
      this.outsideTask(t);
      return;
    }
    this.minigames.open(t);
  }
  outsideTask(t) {
    const complete =
      t.type === 'benchmark'
        ? t.progress.length >= 3
        : t.type === 'mystery'
          ? t.progress.includes('visited') && t.progress.includes('service')
          : t.type === 'lunch'
            ? t.progress.includes('delivered')
            : t.progress.includes('met');
    const hint = {
      benchmark: '3 Speisekarten fotografieren · E',
      mystery: t.progress.includes('visited')
        ? 'MAMMA BAO · Service befragen'
        : 'MAMMA BAO besuchen',
      lunch: t.progress.includes('picked')
        ? 'Lunch zum BBE-Empfang bringen'
        : 'PALMTREECLUB · Lunch abholen',
      meeting: 'Kundentermin · Gabelsbergerstraße',
    }[t.type];
    if (complete) {
      if (t.type === 'mystery') return this.minigames.mystery(t);
      return this.result(this.sim.finish(t.id, t.type === 'meeting' ? t.meetingScore || 80 : 96));
    }
    this.open(
      t.title,
      `<p class="mission-objective">${hint}</p><div class="mission-meta"><span>${t.type === 'benchmark' ? t.progress.length + '/3 Fotos' : t.type === 'mystery' ? t.progress.length + '/2 Hinweise' : t.type === 'lunch' ? (t.progress.includes('picked') ? 'Abgeholt' : 'Zur Abholung') : 'Termin offen'}</span><span>Abgabe · BBE-PC</span></div><div class="editor-bottom"><button class="primary" id="outside-map">Karte</button><button class="ghost" id="outside-close">Losgehen</button></div>`,
      { task: t },
    );
    this.uiClick('#outside-close', () => this.close());
    this.uiClick('#outside-map', () => {
      const r =
        t.type === 'mystery'
          ? RESTAURANTS.find((r) => r.id === 'bao')
          : t.type === 'lunch'
            ? RESTAURANTS.find((r) => r.id === 'palm')
            : null;
      this.waypoint = r
        ? { name: r.name, x: r.x, z: r.z }
        : t.type === 'meeting'
          ? { name: 'Kundenbüro', x: 35, z: -30.5 }
          : { name: 'MAMMA BAO', x: -15, z: 10 };
      this.phone('map');
    });
  }
  photo(id) {
    const r = RESTAURANTS.find((x) => x.id === id);
    const t = this.sim.task('benchmark');
    if (t && t.progress.length < 3) {
      this.sim.stamp('benchmark', id);
      this.audio.play('click');
      this.toast(
        'Speisekarte fotografiert',
        `${r.name} · ${t.progress.length}/3. ${t.progress.length >= 3 ? 'Zurück zur BBE und abgeben.' : ''}`,
      );
    } else
      this.toast(
        r.name,
        `${r.address} · ${r.kind}. Ein Foto wert – besonders mit aktivem Benchmark-Auftrag.`,
      );
  }
  menu() {
    const r = this.world.currentRestaurant;
    this.open(
      r.name,
      `<div class="menu-header"><div><div class="eyebrow">${esc(r.address)} · MÜNCHEN</div><h2>${esc(r.name)}</h2><span class="muted">${esc(r.kind)}</span></div><span class="tag gold">${this.sim.s.event?.kind === 'happyhour' ? 'HAPPY HOUR · −20 %' : 'GUTEN APPETIT'}</span></div><div class="three-col">${r.foods
        .map(
          (f, i) =>
            `<article class="card food-card"><div class="food-number">0${i + 1}</div><h3>${f.name}</h3><div class="food-stats">${[
              ['hunger', 'Sättigung'],
              ['happy', 'Zufriedenheit'],
              ['energy', 'Energie'],
              ['focus', 'Fokus'],
            ]
              .filter(([k]) => f[k] !== 0)
              .map(([k, l]) => `<span>${f[k] > 0 ? '+' : ''}${f[k]} ${l}</span>`)
              .join(
                ' · ',
              )}</div><strong class="price">${euro(this.sim.price(f))}</strong><button class="primary" data-food="${i}" ${this.sim.s.money < this.sim.price(f) ? 'disabled' : ''}>${this.sim.s.money < this.sim.price(f) ? 'Guthaben reicht nicht' : 'Bestellen & Platz nehmen'}</button></article>`,
        )
        .join(
          '',
        )}</div>${r.id === 'palm' && this.sim.task('lunch') && !this.sim.task('lunch').progress.includes('picked') ? '<div class="divider"></div><button class="primary" id="pickup-lunch">BBE Meeting-Lunch abholen · bereits bezahlt</button>' : ''}<p class="muted" style="font-size:.78rem;margin:22px 0 0">Speisen und Preise sind fiktive Spielwerte. Restaurantnamen und Ortsangaben nach veröffentlichten Quellen.</p>`,
      { eyebrow: 'AUGUSTENSTRASSE · SPEISEKARTE' },
    );
    document
      .querySelectorAll('[data-food]')
      .forEach((b) => (b.onclick = () => this.eat(r.id, Number(b.dataset.food))));
    this.uiClick('#pickup-lunch', () => {
      this.sim.stamp('lunch', 'picked');
      this.close();
      this.toast(
        'Meeting-Lunch abgeholt.',
        'Zurück zum BBE-Empfang. Das Team wartet mit leeren Tellern.',
      );
    });
  }
  eat(id, index) {
    const r = this.sim.buyFood(id, index);
    if (!r.ok) return this.toast(r.message);
    this.close();
    if (this.world.zone === 'zitronengras') {
      this.world.groups.zitronengras.add(this.world.foodProp);
      this.world.foodProp.position.set(3.5, 0.87, 3.6);
      this.world.teleport(3.5, 4.45);
    } else {
      this.world.groups.restaurant.add(this.world.foodProp);
      this.world.foodProp.position.set(0, 0.87, 4.5);
      this.world.teleport(0, 5.67);
    }
    this.world.player.rotation.y = Math.PI;
    this.world.pose = 'eat';
    this.world.yaw = 2.4;
    this.world.distance = 3.7;
    this.world.setFood(r.food.name);
    this.audio.play('dishes');
    this.audio.voices.sequence([
      ...(id === 'zitronengras'
        ? []
        : [{ actor: id, event: 'serve', npc: this.world.zoneData.restaurant.npcs[0] }]),
      { actor: 'player', event: 'eat' },
    ]);
    this.timedAction(
      r.food.name,
      'Serviert. Kurz durchatmen. München schmeckt besser ohne Deadline.',
      5,
      () => {
        this.world.foodProp.visible = false;
        this.world.pose = 'walk';
        const e = document.createElement('div');
        e.className = 'stat-float';
        e.textContent = `+${r.food.hunger} Sättigung · +${r.food.happy} Zufriedenheit`;
        document.body.append(e);
        setTimeout(() => e.remove(), 2600);
        this.toast(
          'Guten Appetit gehabt.',
          `Fokus ${Math.round(this.sim.s.focus)} · Energie ${Math.round(this.sim.s.energy)}. Bereit für die nächste BBE-Storyline.`,
        );
      },
    );
  }
  service() {
    const r = this.world.currentRestaurant;
    if (r.id === 'bao') this.sim.stamp('mystery', 'service');
    this.audio.voices.say(r.id, 'greet', {
      npc: this.world.zoneData.restaurant.npcs[0],
      force: true,
    });
    this.open(
      'Ein kurzer Austausch',
      `<span class="tag">${esc(r.name)} · SERVICE</span><h2>„Grüß dich! Schon entschieden?“</h2><p>„Bei uns gibt es ${esc(r.kind)}. Unser Einstiegsgericht auf der Spielkarte ist ${esc(r.foods.reduce((a, b) => (a.price < b.price ? a : b)).name)}. Für den kleinen Hunger empfehlen wir ${esc(r.foods[1].name)}.“</p>${r.id === 'bao' ? '<div class="hint-inline">Research-Notiz: MAMMA BAO steht für handgezogene Biang-Biang-Nudeln und Bao. Gedämpfte Bao kosten auf der Spielkarte 8,50 €.</div>' : ''}<button class="primary" id="service-menu">Speisekarte ansehen</button>`,
    );
    this.uiClick('#service-menu', () => this.menu());
  }
  returnMachine() {
    let total = 0,
      feeding = false;
    this.open(
      'Der kleine Kreislauf des Geldes',
      `<div class="bottle-machine"><div class="eyebrow">PFANDRÜCKGABE · AUGUSTENSTRASSE</div><div class="machine-display" id="return-display">BEREIT</div><div class="bottle-animation" id="return-animation">♻</div><p id="return-count"></p><button class="primary" id="feed-bottle">Eine Flasche einlegen</button><div class="return-total" id="return-total">Pfandbon: 0,00 €</div><small>Jede Flasche wird sofort gutgeschrieben. Der Bon ist deine Übersicht.</small></div>`,
      {
        onClose: () => {
          feeding = false;
        },
      },
    );
    const update = () => {
      if (!$('#return-count')) return;
      $('#return-count').textContent =
        `${this.sim.s.inventory.length} Flaschen im Rucksack · ${euro(this.sim.s.inventory.reduce((a, b) => a + b, 0) / 100)} Pfandwert`;
      $('#feed-bottle').disabled = !this.sim.s.inventory.length || feeding;
    };
    update();
    this.uiClick('#feed-bottle', () => {
      if (feeding || !this.sim.s.inventory.length) return;
      feeding = true;
      update();
      $('#return-animation').classList.add('feeding');
      this.world.returnTime = 0.55;
      this.audio.play('bottle');
      setTimeout(() => {
        if (this.modal?.title !== 'Der kleine Kreislauf des Geldes') return;
        const cents = this.sim.returnBottle();
        total += cents;
        $('#return-display').textContent = `+ ${euro(cents / 100)}`;
        $('#return-total').textContent = `Pfandbon: ${euro(total / 100)}`;
        $('#return-animation').classList.remove('feeding');
        feeding = false;
        update();
      }, 550);
    });
  }
  reception() {
    const lunch = this.sim.task('lunch');
    if (lunch?.progress.includes('picked') && !lunch.progress.includes('delivered')) {
      this.sim.stamp('lunch', 'delivered');
      this.result(this.sim.finish(lunch.id, 98));
      return;
    }
    this.open(
      'Willkommen zurück bei der BBE',
      `<p>Hier laufen alle Projekte zusammen. Und irgendwo im Drucker steckt noch eine Marktanalyse von gestern.</p><div class="three-col"><article class="card"><h3>Karriere sichern</h3><p>Dein aktueller Fortschritt wird in diesem Browser gespeichert.</p><button class="primary" id="save-reception">Spiel speichern</button></article><article class="card"><h3>Dein Arbeitstag</h3><p>Aufträge, Reputation und die nächste Beförderung im Blick.</p><button class="primary" id="reception-tasks">BBE Tasks</button></article><article class="card"><h3>Feierabend</h3><p>Zum nächsten Morgen springen. Energie und Fokus erholen sich. Offene Deadlines laufen ab.</p><button class="primary" id="rest">Nächsten Arbeitstag starten</button></article></div>`,
      { pause: true },
    );
    this.uiClick('#save-reception', () => {
      if (this.sim.save()) this.toast('Spiel gespeichert.');
    });
    this.uiClick('#reception-tasks', () => this.phone('tasks'));
    this.uiClick('#rest', () => {
      this.sim.rest();
      this.transition('office');
    });
  }
  colleague(name) {
    this.audio.voices.openConversation(this, name);
  }
  printer() {
    this.open(
      'Drucker: kein Papier. Natürlich.',
      `<h2>„PC LOAD LETTER“</h2><p>Niemand weiß, warum der Drucker Englisch spricht. Du entdeckst Papier im Fach darunter.</p><button class="primary" id="fix-printer">Papier nachlegen</button>`,
    );
    this.uiClick('#fix-printer', () => {
      this.audio.play('print');
      this.sim.change('happy', 3);
      this.close();
      this.toast('Drucker gerettet.', 'Das Büro betrachtet dich für 30 Sekunden als IT-Abteilung.');
    });
  }
  lounge() {
    if (this.sim.level < 5)
      return this.toast('Senior Lounge · ab Level 5', 'Gute Arbeit öffnet diese Tür.');
    this.sim.change('energy', 20);
    this.sim.change('happy', 10);
    this.timedAction('Ein Moment in der Senior Lounge', '+20 Energie · +10 Zufriedenheit', 3);
  }
  partner() {
    this.world.teleport(34, 4.5);
    this.world.target.set(34, 1.25, 4.5);
    this.world.camera.position.set(34, 2.7, 6.3);
    this.world.camera.lookAt(this.world.target);
    this.world.yaw = 0;
    this.world.distance = 4.2;
    this.toast(
      this.sim.level < 7 ? 'Büro · Lukas Fleischmann' : 'Dein Partnerbüro',
      'E · Mit Lukas sprechen.',
    );
  }
  client() {
    const t = this.sim.task('meeting');
    if (!t)
      return this.toast(
        'Retail Lab · Kundenbüro',
        'Für einen Termin benötigst du einen aktiven BBE-Kundenauftrag ab Level 4.',
      );
    if (t.progress.includes('met'))
      return this.toast('Meeting abgeschlossen.', 'Bitte Ergebnisse am BBE-Arbeitsplatz abgeben.');
    this.minigames.meeting(t);
  }
  upgrades() {
    const opts = [
      ['plant', 'Kleine Schreibtischpflanze', 12, 1, 'Ein bisschen Grün zwischen grauen Zellen.'],
      ['mouse', 'Präzisionsmaus', 18, 2, 'Weniger Handgelenk. Mehr Storyline.'],
      ['monitor', 'Zweiter Monitor', 65, 3, 'Für Excel und die wirklich finale Folie.'],
      ['chair', 'Ergonomischer Bürostuhl', 90, 4, 'Sitzende Tätigkeit, aufsteigende Karriere.'],
      ['award', 'Persönlicher Consulting-Award', 150, 5, 'Glänzt auch ohne Management Summary.'],
    ];
    this.open(
      'Dein Platz wächst mit dir',
      `<p>Jede Verbesserung bringt +10 Zufriedenheit und +5 Fokus. Karriere-Upgrades erscheinen zusätzlich automatisch.</p><div class="two-col">${opts.map(([id, name, price, min, desc]) => `<article class="card"><span class="tag">AB LEVEL ${min}</span><h3>${name}</h3><p>${desc}</p><strong style="color:var(--accent)">${euro(price)}</strong><button class="primary" data-upgrade="${id}" ${this.sim.s.upgrades.includes(id) || this.sim.level < min || this.sim.s.money < price ? 'disabled' : ''}>${this.sim.s.upgrades.includes(id) ? 'Steht auf deinem Schreibtisch' : this.sim.level < min ? 'Noch nicht freigeschaltet' : 'Kaufen & aufstellen'}</button></article>`).join('')}</div>`,
      { pause: true },
    );
    document.querySelectorAll('[data-upgrade]').forEach(
      (b) =>
        (b.onclick = () => {
          if (this.sim.upgrade(b.dataset.upgrade)) {
            this.world.makeWorkstation();
            this.audio.play('success');
            this.upgrades();
          }
        }),
    );
  }
  phone(page = 'home', navigation = 'push') {
    if (page === 'map') return this.extras.map.open();
    const activePage = showPhone(this, page, navigation);
    if (!activePage) return;
    this.phonePage = activePage;
    document.querySelectorAll('[data-route]').forEach(
      (b) =>
        (b.onclick = () => {
          const r = RESTAURANTS.find((x) => x.id === b.dataset.route);
          this.waypoint = { name: r.name, x: r.x + (r.x < 0 ? 2 : -2), z: r.z };
          this.phone('map');
        }),
    );
    document.querySelectorAll('[data-focus-task]').forEach(
      (b) =>
        (b.onclick = () => {
          const i = this.sim.s.active.findIndex((t) => t.id === Number(b.dataset.focusTask));
          if (i >= 0) {
            const t = this.sim.s.active.splice(i, 1)[0];
            this.sim.s.active.unshift(t);
            this.toast('Auftrag angeheftet', t.title);
            this.close();
          }
        }),
    );
    document.querySelectorAll('[data-city-route]').forEach(
      (b) =>
        (b.onclick = () => {
          const p = [...CITY_STOPS, ...HELIPADS].find((p) => p.id === b.dataset.cityRoute);
          this.waypoint = { name: p.name, x: p.x, z: p.z };
          this.close();
        }),
    );
    this.uiClick('#map-home', () => {
      this.waypoint = { name: 'BBE Handelsberatung', ...CITY_LAYOUT.hq };
      this.close();
    });
    this.uiClick('#map-remove', () => {
      this.waypoint = null;
      this.phone('map');
    });
    this.uiClick('#map-recover', () => this.transition('office'));
    this.uiClick('#phone-desk', () => {
      this.waypoint = { name: 'BBE Handelsberatung', ...CITY_LAYOUT.hq };
      this.close();
    });
    this.uiClick('#phone-courier', () => {
      if (this.sim.s.courier.active) {
        this.waypoint = {
          name: 'Kunde · Dachtermin',
          x: COURIER_DESTINATION.x,
          z: COURIER_DESTINATION.z,
        };
        this.phone('map');
        return;
      }
      if (this.world.zone !== 'office' || this.world.player.position.x > 44) {
        this.toast(
          'Der Koffer wartet bei der BBE.',
          'In der IT bei Benjamin im Westflügel übernehmen.',
        );
        return;
      }
      this.arcade.immersion.courier.brief();
    });
    this.drawMap($('#large-map'), false);
  }
  phoneContent(page) {
    const s = this.sim.s;
    if (page === 'mail')
      return `<h3>BBE Mail <span class="tag">${s.mail.length}</span></h3>${s.mail.map((m) => `<article class="mail-item"><small>${m.time}</small><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p></article>`).join('')}`;
    if (page === 'tasks')
      return `<h3 class="mission-list-heading">Stories</h3><div class="mission-list">${this.fireStory.entryCard()}${this.workshop.entryCard()}<button id="phone-courier" class="mission-row mission-open" aria-label="Eilauftrag · Koffer · ${s.courier.active ? 'Karte' : 'Öffnen'}"><span class="mission-row-title">Eilauftrag · Koffer</span><span aria-hidden="true">↗</span></button></div><h3 class="mission-list-heading">BBE-Aufträge</h3><div class="mission-list">${s.active.map((t) => `<button class="mission-row bbe-task-row" data-focus-task="${t.id}" aria-label="${esc(t.title)} · Anheften" title="Anheften"><span class="mission-row-title">${esc(t.title)}</span><span class="mission-row-icon" aria-hidden="true">↗</span></button>`).join('') || '<p class="muted mission-empty">Keine offenen Aufträge.</p>'}</div><button id="phone-desk" class="mission-row mission-open mission-home"><span class="mission-row-title">BBE-Computer</span><span aria-hidden="true">↗</span></button>`;
    if (page === 'map')
      return `<h3>Dein München</h3><div class="hint-inline"><strong>Vom BBE-Ausgang aus:</strong> links 20 m zur Augustenstraße mit Restaurants · rechts 100 m zum Zugang Königsplatz. Dahinter führt der goldene Fußweg über den Karolinenplatz zur Frauenkirche.</div><canvas id="large-map" width="900" height="780" class="large-map" aria-label="Stadtkarte mit BBE und Restaurants"></canvas><div class="map-legend"><span>BBE / Ziel</span><span>Restaurants</span><span>Du</span></div><div class="toolbar"><button class="primary" id="map-home">BBE als Ziel</button><button id="map-remove">Ziel entfernen</button></div><div class="city-routes">${[...HELIPADS, ...CITY_STOPS].map((p) => `<button class="small" data-city-route="${p.id}">${p.name}</button>`).join('')}</div><p class="muted" style="font-size:.8rem">Goldene Linie: Fußweg ab BBE · Goldene Punkte: Sehenswürdigkeiten · H: Landeplätze · Blaue Quadrate: Fahrräder.</p><p class="muted" style="font-size:.8rem">Verdichteter, frei interpretierter Stadtplan. Kein Navigationsplan für das echte München.</p><button class="small ghost" id="map-recover">Festgesteckt? Zurück ins BBE-Büro</button>`;
    if (page === 'bank')
      return `<div class="eyebrow">DEIN KONTO</div><div class="reward" style="font-size:2.8rem">${euro(s.money)}</div><div class="two-col"><div class="card"><small>Eingenommen</small><h3>${euro(s.earnings)}</h3></div><div class="card"><small>Ausgegeben</small><h3>${euro(s.spent)}</h3></div></div><div class="divider"></div><h3>Kontobewegungen</h3>${s.ledger.map((l) => `<div class="mail-item"><small style="color:${l.amount >= 0 ? 'var(--mint)' : '#dfb597'}">${l.amount > 0 ? '+' : ''}${euro(l.amount)}</small><b style="font-size:.85rem">${esc(l.label)}</b><p>Tag ${l.day} · ${l.time}</p></div>`).join('') || '<p class="muted">Deine erste Gehaltsbuchung wartet.</p>'}`;
    if (page === 'restaurants')
      return `<h3>Entdecke die Augustenstraße</h3>${RESTAURANTS.map((r) => `<article class="card" style="margin-bottom:12px;border-left:3px solid ${r.color}"><span class="tag">${s.visits.includes(r.id) ? 'BEREITS GENOSSEN' : 'NOCH AUF DER LISTE'}</span><h3>${r.name}</h3><p>${r.address} · ${r.kind}</p><div class="card-footer"><small>Spielgerichte ab ${euro(Math.min(...r.foods.map((f) => f.price)))}</small><button class="small" data-route="${r.id}">Ziel markieren</button></div></article>`).join('')}`;
    if (page === 'stats') {
      const next = CAREERS[this.sim.level],
        prev = CAREERS[this.sim.level - 1],
        pct = next ? clamp(((s.xp - prev.xp) / (next.xp - prev.xp)) * 100) : 100;
      return `<div class="eyebrow">DEINE BBE-KARRIERE · LEVEL ${this.sim.level}</div><h2>${this.sim.career.name}</h2><p>${this.sim.career.perk}</p><div class="progress-track"><span style="width:${pct}%"></span></div><p style="margin-top:9px;font-size:.85rem" class="muted">${s.xp} XP ${next ? `/ ${next.xp} XP · Nächste Stufe: ${next.name}` : '· Partner Material'}</p><div class="two-col"><article class="card"><h3>Dein Tag in Zahlen</h3>${[
        ['hunger', 'Sättigung'],
        ['energy', 'Energie'],
        ['happy', 'Zufriedenheit'],
        ['focus', 'Fokus'],
        ['rep', 'BBE Reputation'],
        ['caffeine', 'Koffein-Level'],
        ['health', 'Gesundheit'],
        ['bladder', 'Blase'],
      ]
        .map(
          ([k, l]) =>
            `<div class="input-row" style="grid-template-columns:1fr auto"><span>${l}</span><strong>${Math.round(s[k])} %</strong></div>`,
        )
        .join(
          '',
        )}</article>${this.extras.inventory()}<article class="card"><h3>Dein Rucksack</h3><p>${s.inventory.length} / 30 Pfandflaschen<br>Pfandwert: <strong>${euro(s.inventory.reduce((a, b) => a + b, 0) / 100)}</strong></p>${[8, 15, 25].map((v) => `<p>${s.inventory.filter((x) => x === v).length} × ${euro(v / 100)}</p>`).join('')}<div class="divider"></div><p>${s.completed} BBE-Aufträge erledigt<br>${s.returned} Flaschen abgegeben<br>${s.visits.length} / ${RESTAURANTS.length} Restaurants besucht<br>${s.coffeeToday} Kaffee heute</p><div class="divider"></div><p>${s.knockouts} K. o. im Arcade-Modus<br>${euro(s.chaosCash)} Cash eingesammelt<br>${Math.round(s.driven)} Meter gefahren<br>${Math.round(s.cycled)} Meter geradelt<br>${Math.round(s.flown)} Meter geflogen · ${s.heliLandings} Landungen<br>${s.cityVisits.length} / 5 Münchner Orte entdeckt<br>${s.birdRefills} Mal Dr. Dip nachgefüllt<br>${s.courierCompleted} Eilkoffer geliefert · ${s.vaults} Hindernisse überwunden<br>${s.escapes} Fahndungen entkommen · ${s.propsThrown} Gegenstände geworfen<br>${s.toiletUses} WC-Besuche · Bestwert ${s.wcBest} %</p>${this.sim.task('lunch')?.progress.includes('picked') ? '<span class="tag gold">BBE Meeting-Lunch im Gepäck</span>' : ''}</article></div><div class="divider"></div><h3>Dein Karriereweg</h3>${CAREERS.map((c, i) => `<div class="input-row" style="grid-template-columns:1fr auto"><span style="color:${i < this.sim.level ? 'var(--accent)' : 'var(--muted)'}">${i + 1} · ${c.name}</span><small>${c.xp} XP · ${c.slots} Projekte</small></div>`).join('')}`;
    }
    return `<h3>Kleine Triumphe, große Geschichten</h3><div class="two-col">${ACHIEVEMENTS.map(([id, name, desc]) => `<article class="card achievement ${s.achievements.includes(id) ? 'unlocked' : ''}"><div class="badge">${s.achievements.includes(id) ? '✦' : '◇'}</div><h3>${name}</h3><p>${desc}</p><span class="tag">${s.achievements.includes(id) ? 'FREIGESCHALTET' : 'NOCH OFFEN'}</span></article>`).join('')}</div>`;
  }
  drawMap(canvas, mini) {
    if (!canvas) return;
    if (
      this.world.zone === 'office' &&
      (this.fireStory?.running ||
        inIT(this.world.player.position) ||
        this.world.player.position.x < -13.5)
    ) {
      this.fireStory.drawOfficeMap(canvas, mini);
      return;
    }
    const c = canvas.getContext('2d'),
      W = canvas.width,
      H = canvas.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#1b3740';
    c.fillRect(0, 0, W, H);
    const city = this.world.zone === 'city',
      px = city
        ? this.world.player.position.x
        : ['restaurant', 'brewery', 'home', 'zitronengras'].includes(this.world.zone)
          ? this.world.currentRestaurant.x
          : CITY_LAYOUT.hq.x,
      pz = city
        ? this.world.player.position.z
        : ['restaurant', 'brewery', 'home', 'zitronengras'].includes(this.world.zone)
          ? this.world.currentRestaurant.z
          : CITY_LAYOUT.hq.z;
    const scale = mini ? 2.1 : Math.min(W / 720, H / 630),
      centerX = mini ? px : 100,
      centerZ = mini ? pz : 70;
    const X = (x) => W / 2 + (x - centerX) * scale,
      Z = (z) => H / 2 + (z - centerZ) * scale;
    const rect = (x, z, w, h, color) => {
      c.fillStyle = color;
      c.fillRect(X(x - w / 2), Z(z - h / 2), w * scale, h * scale);
    };
    for (const b of this.world.cityBlocks || []) rect(b.x, b.z, b.w, b.d, '#355057');
    for (const b of this.world.expansionBlocks || []) rect(b.x, b.z, b.w, b.d, '#34515a');
    for (const road of STREET_ROADS) rect(road.x, road.z, road.w, road.d, '#152c35');
    for (const ring of CIRCULAR_STREETS) {
      c.beginPath();
      c.arc(
        X(ring.x),
        Z(ring.z),
        ((ring.innerRadius + ring.outerRadius) / 2) * scale,
        0,
        Math.PI * 2,
      );
      c.lineWidth = (ring.outerRadius - ring.innerRadius) * scale;
      c.strokeStyle = '#152c35';
      c.stroke();
      c.beginPath();
      c.arc(X(ring.x), Z(ring.z), ring.islandRadius * scale, 0, Math.PI * 2);
      c.fillStyle = '#52654c';
      c.fill();
    }
    this.arcade?.expansion.drawMap(c, { X, Z, scale, mini, surfaces: false });
    c.strokeStyle = '#cba96c';
    c.lineWidth = mini ? 1.5 : 2;
    c.setLineDash([4, 4]);
    for (const route of Object.values(CITY_WALKS)) {
      c.beginPath();
      route.forEach((p, i) => (i ? c.lineTo(X(p.x), Z(p.z)) : c.moveTo(X(p.x), Z(p.z))));
      c.stroke();
    }
    c.setLineDash([]);
    c.strokeStyle = '#a5b1a343';
    c.setLineDash([4, 8]);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(X(0), Z(-175));
    c.lineTo(X(0), Z(135));
    c.stroke();
    c.setLineDash([]);
    c.font = mini ? '19px Arial' : '18px Arial';
    c.textBaseline = 'middle';
    if (!mini) {
      c.save();
      c.translate(X(4), Z(-137));
      c.rotate(Math.PI / 2);
      c.fillStyle = '#a3b7b6';
      c.fillText('AUGUSTENSTRASSE', 0, 0);
      c.restore();
      c.fillStyle = '#a3b7b6';
      c.font = '16px Arial';
      c.fillText('BRIENNER STRASSE', X(-141), Z(40));
      c.fillText('GABELSBERGERSTRASSE', X(28), Z(-43));
    }
    for (const r of RESTAURANTS) {
      c.fillStyle = this.sim.s.visits.includes(r.id) ? '#99cbb1' : '#779e94';
      c.beginPath();
      c.arc(X(r.x), Z(r.z), mini ? 4 : 7, 0, Math.PI * 2);
      c.fill();
      if (!mini) {
        c.font = '600 18px Arial';
        c.textAlign = r.x < 0 ? 'right' : 'left';
        c.fillStyle = '#d5e1d6';
        c.fillText(r.name, X(r.x + (r.x < 0 ? -7 : 7)), Z(r.z));
        c.textAlign = 'left';
      }
    }
    c.fillStyle = '#e4bd76';
    c.fillRect(X(CITY_LAYOUT.hq.x) - 6, Z(CITY_LAYOUT.hq.z) - 6, 12, 12);
    if (!mini) {
      c.font = 'bold 20px Arial';
      c.fillText('BBE HQ', X(CITY_LAYOUT.hq.x + 4), Z(53));
      c.fillStyle = '#bacac4';
      c.font = '17px Arial';
      c.fillText('Pfand', X(20), Z(29));
      c.fillText('Kundenbüro', X(40), Z(-28));
    }
    this.arcade?.immersion.drawMap(c, { X, Z, scale, mini });
    if (this.waypoint) {
      c.strokeStyle = '#ecc575';
      c.lineWidth = 2;
      c.setLineDash([5, 6]);
      c.beginPath();
      c.moveTo(X(px), Z(pz));
      c.lineTo(X(this.waypoint.x), Z(this.waypoint.z));
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.arc(X(this.waypoint.x), Z(this.waypoint.z), 12, 0, Math.PI * 2);
      c.stroke();
    }
    c.save();
    c.translate(X(px), Z(pz));
    c.rotate(-this.world.player.rotation.y);
    c.fillStyle = '#f3eee0';
    c.shadowColor = '#fff8';
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(0, 8);
    c.lineTo(-6, -7);
    c.lineTo(0, -4);
    c.lineTo(6, -7);
    c.closePath();
    c.fill();
    c.restore();
  }
  settings() {
    this.open(
      'Eine kurze Pause',
      `<div class="settings-list"><div class="setting-row"><div><strong>Dein Spielstand</strong><p>Automatisch alle 20 Sekunden. Gespeichert in diesem Browser.</p></div><button id="settings-save">Jetzt speichern</button></div><div class="setting-row"><div><strong>Atmosphäre & Geräusche</strong><p>Tastaturen, Schritte, Straße und viel zu viel Kaffee.</p></div><button id="audio-toggle">${this.audio.enabled ? 'Ton an' : 'Ton aus'}</button></div><div class="setting-row"><div><strong>Grafikqualität</strong><p>Fotografische Materialien, weiche Schatten und adaptive Auflösung. Innenräume mit Ambient Occlusion.</p></div><button id="quality-toggle">${this.world.lowQuality ? 'Sparmodus' : 'Hohe Qualität'}</button></div><div class="setting-row"><div><strong>Steuerung</strong><p>WASD bewegen · Shift sprinten · Maus bewegen: frei umsehen · Alt halten: HUD bedienen<br>E interagieren · Tab Stats · M Karte · J Aufgaben · P Smartphone<br>Scrollen: Kameraabstand · Esc: Schließen / Pause</p></div></div><div class="toolbar"><button class="primary" id="resume">Weiterspielen</button><button id="export-save">Spielstand exportieren</button><button id="import-save">Spielstand importieren</button><button id="sources">Orte & Mitwirkende</button><button id="reset-game" class="danger ghost">Neues Spiel</button><input type="file" id="save-file" accept="application/json" hidden></div></div>`,
      { pause: true },
    );
    this.uiClick('#resume', () => this.close());
    this.uiClick('#settings-save', () => {
      if (this.sim.save()) this.toast('Spiel gespeichert.');
    });
    this.uiClick('#audio-toggle', () => {
      $('#audio-toggle').textContent = this.audio.toggle() ? 'Ton an' : 'Ton aus';
    });
    this.arcade.addSettings();
    const soundButton = document.createElement('button');
    soundButton.id = 'audio-studio';
    soundButton.textContent = 'Soundstudio · Stimmen & Mix';
    document.querySelector('.settings-list .toolbar').prepend(soundButton);
    soundButton.onclick = () => openAudioSettings(this);
    this.uiClick('#quality-toggle', () => {
      this.slowTime = 0;
      this.world.setQuality(!this.world.lowQuality);
      $('#quality-toggle').textContent = this.world.lowQuality ? 'Sparmodus' : 'Hohe Qualität';
    });
    this.uiClick('#export-save', () => {
      const u = URL.createObjectURL(new Blob([this.sim.export()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = u;
      a.download = 'bbe-munich-spielstand.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    });
    this.uiClick('#import-save', () => $('#save-file').click());
    $('#save-file').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2_000_000) return this.toast('Diese Spielstand-Datei ist zu groß.');
      const ok = this.sim.import(await f.text());
      this.toast(ok ? 'Spielstand geladen.' : 'Die Datei ist kein gültiger BBE-Spielstand.');
      if (ok) {
        this.origin.cancel();
        this.world.makeWorkstation();
        this.transition('office');
      }
    };
    this.uiClick('#sources', () => this.sources());
    this.uiClick('#reset-game', () => this.resetConfirm());
  }
  resetConfirm() {
    this.open(
      'Eine neue Karriere beginnen?',
      `<p>Dein Spielstand in diesem Browser wird ersetzt. Über die Pause kannst du ihn vorher exportieren.</p><div class="toolbar"><button id="reset-cancel" class="primary">Zurück</button><button id="reset-confirm" class="danger">Spielstand ersetzen & neu starten</button></div>`,
      { pause: true },
    );
    this.uiClick('#reset-cancel', () => this.settings());
    this.uiClick('#reset-confirm', () => {
      this.origin.cancel();
      this.sim.reset();
      this.world.makeWorkstation();
      this.transition('office');
      this.toast('Montag, 08:17.', 'Guten Morgen. Neue Aufgaben verfügbar.');
    });
  }
  sources() {
    this.open(
      'München, mit etwas dichterer Storyline',
      `<p><strong>BBE Handelsberatung: Munich Consulting Simulator</strong> ist eine fiktive, unabhängige Spielinterpretation. Die BBE ist das Hauptquartier. Menschen, Dialoge, Büroräume, Marktwerte, Preise und Abläufe wurden für das Spiel erfunden.</p><p>Restaurantnamen und Adressen basieren auf veröffentlichten Ortsangaben. Die vier Zitronengras-Gerichte orientieren sich an der veröffentlichten Speisekarte (Stand 14.10.2025); Zubereitung, Preise und der Standort neben Dogtown sind Spieladaptionen. Stadtplan und Entfernungen sind verdichtet und frei interpretiert. Die Innenräume bilden keine tatsächlichen Geschäftsräume ab.</p><p>Original-Logo: <a href="https://www.bbe.de/static/images/bbe-logo.svg" target="_blank" rel="noopener noreferrer">BBE Handelsberatung GmbH</a>, unveränderte SVG vom offiziellen Webauftritt. Die Verwendung macht das Spiel nicht zu einem offiziellen BBE-Produkt. Helikopter, Landeplätze und Arcade-Ereignisse sind erfunden.</p><ul class="source-list">${CITY_STOPS.map((p) => `<li><a href="${p.source}" target="_blank" rel="noopener noreferrer">${p.name} · Ortsquelle</a></li>`).join('')}<li><a href="https://www.bbe.de/de/kontakt/" target="_blank" rel="noopener noreferrer">BBE Handelsberatung · Brienner Straße 45</a></li>${RESTAURANTS.map((r) => `<li><a href="${r.source}" target="_blank" rel="noopener noreferrer">${r.name} · ${r.address}</a></li>`).join('')}</ul><div class="divider"></div><p><a href="https://threejs.org/" target="_blank" rel="noopener noreferrer">Three.js</a> · 3D-Darstellung · MIT-Lizenz<br><a href="https://pmndrs.github.io/cannon-es/" target="_blank" rel="noopener noreferrer">Cannon-es</a> · Kollisionen und Physik · MIT-Lizenz</p><p class="muted">Prozedurale 3D-Modelle, PBR-Materialien, Umgebungsreflexionen, Ambient Occlusion, Kontakt- und Sonnenschatten. Echte lizenzierte Geräuschaufnahmen, gestaltete Effekte, 254 deutsche Sprechzeilen, drei Radiosongs und fünf eigene Story-Kompositionen. Kein Konto, keine In-App-Käufe. Spielstände bleiben lokal.</p><p>Audioaufnahmen: Kenney, rubberduck, unicaegames, looneybits, domasx2, IgnasD und Ylmir (CC0). Kitchen Ambience, SFX: <a href="https://opengameart.org/content/kitchen-ambience-sfx" target="_blank" rel="noopener noreferrer">DavidW</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Fliesen- und Wasserschritte: swuing, ceberation, EminYILDIRIM; bearbeitet von congusbongus, <a href="https://opengameart.org/content/footsteps-on-different-surfaces" target="_blank" rel="noopener noreferrer">Quelle</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>. Aufnahmen gekürzt, gefiltert und komprimiert; Wasser-/Kaffeeeffekte aus DavidWs Aufnahme gestaltet. Verkehrsaufnahme dient als allgemeine Stadtatmosphäre.</p><p>Dialoge und Musik wurden eigens für das fiktive Spiel geschrieben. Stimmen: lokal erzeugte deutsche Windows-Sprachsynthese (Hedda, Katja, Stefan), keine menschlichen Studioaufnahmen oder nachgeahmten realen Personen.</p>`,
      { pause: true },
    );
  }
  error(title, body, error) {
    window.__bbeBoot?.dismiss?.();
    console.error(error);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="loading-error"><div><h1>${esc(title)}</h1><p>${esc(body)}</p><details><summary>Technische Details</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(error?.stack || error?.message || error)}</pre></details><br><button onclick="location.reload()">Erneut versuchen</button></div></div>`,
    );
  }
}
window.addEventListener('error', (e) => {
  console.error('BBE', e.message);
});
export const game = new Game();
// Read-only diagnostics for reproducible support and validation.
window.bbeStatus = () => ({
  zone: game.world?.zone,
  started: game.started,
  workshop: game.workshop?.status,
  fire: game.fireStory?.status,
  extras: game.extras?.status,
  mouse: { locked: !!game.mouseControls?.locked, available: !game.mouseControls?.unavailable },
  camera: { yaw: game.world?.yaw, pitch: game.world?.pitch, distance: game.world?.distance },
  renderedFrames: game.world?.renderer.info.render.frame,
  postprocessing: !!game.world?.composer && !game.world?.lowQuality,
  position: game.world?.player.position.toArray(),
  driving: !!game.arcade?.vehicle,
  vehicleType: game.arcade?.vehicle?.type,
  birdWater: game.sim.s.birdWater,
  debris: game.arcade?.expansion.pieces.length,
  cityVisits: game.sim.s.cityVisits,
  immersion: {
    wanted: game.arcade?.immersion.life.level,
    phase: game.arcade?.immersion.life.phase,
    motion: game.arcade?.immersion.motion.action?.type,
    props: game.arcade?.immersion.physics.items.length,
    wetness: game.arcade?.immersion.weather.wet,
    courier: game.sim.s.courier,
  },
  speed: game.arcade?.speed,
  knockouts: game.sim.s.knockouts,
  toiletUses: game.sim.s.toiletUses,
  level: game.sim.level,
  active: game.sim.s.active.length,
  objects: game.world?.renderer.info.render.calls,
  save: game.sim.saved,
  audio: game.audio.status,
});
