import * as THREE from 'three';
import { box, label } from './world.js';
import { buildBossSet, storyActor, animateStoryActor } from './workshop-sets.js';
import { EXPANSION_LINES } from './expansion-voices.js';
import {
  CAMPAIGN_MISSIONS,
  CAMPAIGN_TASKS,
  CAMPAIGN_LINES,
  CAMPAIGN_SCENES,
  RESEARCH_SHOPS,
} from './bbe-campaign-data.js';
import {
  normalizeCampaign,
  campaignUnlocked,
  campaignVariant,
  startCampaign,
  campaignAction,
  tickCampaign,
  finishCampaign,
} from './bbe-campaign-state.js';
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const minute = (n) =>
  `${Math.floor(Math.max(0, n) / 60)}:${String(Math.floor(Math.max(0, n) % 60)).padStart(2, '0')}`;
const meta = (id) => ({ ...CAMPAIGN_LINES.find((l) => l.id === id), ...EXPANSION_LINES[id] });
const mission = (id) => CAMPAIGN_MISSIONS.find((m) => m.id === id);
const circuitNames = { server: 'Server', screen: 'Präsentation', network: 'Netzwerk' };
const priorityNames = {
  decision: 'Entscheidung zuerst',
  risks: 'Risiken zuerst',
  numbers: 'Zahlen zuerst',
};
export class BBECampaign {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    game.sim.s.bbeCampaign = normalizeCampaign(game.sim.s.bbeCampaign);
    this.enabled = false;
    this.current = null;
    this.loading = false;
    this.token = 0;
    this.voiceToken = 0;
    this.voice = null;
    this.panel = null;
    this.panelClock = 0;
    this.autosave = 0;
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.08, 80);
    this.size = new THREE.Vector2();
    this.eye = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.items = [];
    this.pins = [];
    this.selectedCable = null;
    this.greeting = false;
    this.installWorld();
    this.installUI();
    window.addEventListener('keydown', (e) => this.key(e), true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause(true);
        this.checkpoint();
      }
    });
    window.addEventListener('blur', () => {
      if (this.current) this.pause(true);
    });
    window.addEventListener('beforeunload', () => this.checkpoint());
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-campaign-open]')) this.openJournal();
    });
    this.syncWorld();
  }
  get state() {
    return this.g.sim.s.bbeCampaign;
  }
  get active() {
    return !!this.state.active;
  }
  get cinematic() {
    return !!this.current || this.loading;
  }
  get status() {
    return {
      active: this.active,
      enabled: this.enabled,
      cinematic: this.cinematic,
      ...this.state.active,
      completed: [...this.state.completed],
      best: { ...this.state.best },
      panel: this.panel?.kind || null,
    };
  }
  installUI() {
    this.hud = document.createElement('div');
    this.hud.id = 'campaign-hud';
    this.hud.hidden = true;
    this.hud.innerHTML =
      '<button id="campaign-status-button" aria-label="Kampagne pausieren"><span id="campaign-chapter"></span><b id="campaign-goal"></b></button><span id="campaign-timer"></span><div class="campaign-meter"><i></i></div>';
    $('ui').append(this.hud);
    $('campaign-status-button').onclick = () => this.openJournal();
    this.nightVeil = document.createElement('div');
    this.nightVeil.className = 'campaign-night-veil';
    this.nightVeil.hidden = true;
    document.body.append(this.nightVeil);
    this.caption = document.createElement('div');
    this.caption.className = 'campaign-world-caption';
    this.caption.hidden = true;
    this.caption.setAttribute('role', 'status');
    document.body.append(this.caption);
  }
  addInteraction(zone, id, title, x, z, data, radius = 1.65) {
    this.w.interact(zone, 'campaign-' + id, title, x, z, { kind: 'bbe-campaign', data, radius });
    const list = this.w.zoneData[zone].interactions,
      item = list.pop();
    list.unshift(item);
    item.campaignZone = zone;
    this.items.push(item);
    return item;
  }
  installWorld() {
    const g = new THREE.Group();
    g.name = 'BBE · Nur noch eine kleine Änderung';
    g.userData.dynamic = true;
    this.w.groups.office.add(g);
    this.props = g;
    for (const m of CAMPAIGN_MISSIONS) {
      const prop = new THREE.Group();
      prop.name = 'Kampagnenstart · ' + m.title;
      prop.position.set(m.x, 0, m.z);
      g.add(prop);
      box(prop, 0, 0.025, 0, 0.42, 0.05, 0.34, '#263b47');
      box(prop, 0, 0.48, 0, 0.065, 0.9, 0.065, '#506571');
      const screen = box(prop, 0, 0.99, 0, 0.47, 0.31, 0.05, '#173d4b');
      screen.rotation.x = -0.15;
      label(prop, String(m.chapter).padStart(2, '0') + ' · BBE', 0, 1, 0.036, 0.43, 0.25, {
        bg: '#183849',
        fg: m.color,
      });
      const pin = label(prop, m.short, 0, 1.57, 0, 1.9, 0.26, { bg: '#203842', fg: m.color });
      pin.material.depthWrite = false;
      this.pins.push({ m, prop, pin });
      this.addInteraction('office', 'start-' + m.id, m.short, m.x, m.z, { mission: m.id });
    }
    for (const [id, tasks] of Object.entries(CAMPAIGN_TASKS))
      for (const t of tasks)
        this.addInteraction('office', id + '-' + t.id, t.label, t.x, t.z, {
          mission: id,
          task: t.id,
        });
    for (const shop of RESEARCH_SHOPS)
      this.addInteraction(
        'city',
        'research-' + shop.id,
        shop.name + ' · Recherche',
        shop.x,
        shop.z,
        { mission: 'research', shop: shop.id },
        2.2,
      );
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.022, 5, 28),
      new THREE.MeshBasicMaterial({
        color: '#b8e8d7',
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.marker.userData.dynamic = true;
    this.w.scene.add(this.marker);
    this.emergency = new THREE.PointLight('#adcfff', 0, 8, 2);
    this.emergency.position.set(-32, 1.9, 4);
    this.w.groups.office.add(this.emergency);
    this.awards = new THREE.Group();
    this.awards.name = 'BBE · Projektwand und Pitch-Trophäe';
    this.awards.userData.dynamic = true;
    g.add(this.awards);
    this.projectPlaques = [];
    for (let i = 0; i < 4; i++) {
      const plaque = new THREE.Group();
      plaque.position.set(13.26, 2.12, 5.55 + i * 0.76);
      plaque.rotation.y = -Math.PI / 2;
      box(plaque, 0, 0, 0, 0.65, 0.9, 0.06, '#9f855c');
      label(plaque, ['BEREIT', 'INSIGHT', 'GERETTET', 'GEWONNEN'][i], 0, 0.11, 0.039, 0.57, 0.67, {
        bg: '#e8e0ca',
        fg: '#234c56',
        sub: 'BBE · KAPITEL ' + (i + 1),
      });
      this.awards.add(plaque);
      this.projectPlaques.push(plaque);
    }
    this.trophy = new THREE.Group();
    this.trophy.position.set(-7.6, 1.245, 7);
    this.awards.add(this.trophy);
    box(this.trophy, 0, 0.07, 0, 0.32, 0.14, 0.24, '#253c44');
    const gold = new THREE.MeshStandardMaterial({
      color: '#d6ad56',
      metalness: 0.82,
      roughness: 0.22,
    });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.055, 0.22, 16), gold);
    cup.position.y = 0.34;
    cup.castShadow = true;
    this.trophy.add(cup);
    box(this.trophy, 0, 0.19, 0, 0.05, 0.16, 0.05, gold);
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16), gold);
      h.position.set(side * 0.16, 0.32, 0);
      this.trophy.add(h);
    }
    label(this.trophy, 'PITCH PROFI', 0, 0.065, 0.126, 0.29, 0.095, {
      bg: '#253c44',
      fg: '#e7cc84',
    });
  }
  syncWorld() {
    const a = this.state.active;
    for (const item of this.items) {
      const d = item.data;
      item.storyAway =
        d.task || d.shop
          ? !this.enabled ||
            a?.id !== d.mission ||
            a.phase !== 'play' ||
            a.tasks.includes(d.task || d.shop)
          : false;
    }
    for (const p of this.pins) {
      p.pin.visible = !this.cinematic;
      p.pin.material.opacity = campaignUnlocked(this.state, p.m.id) ? 1 : 0.45;
      p.pin.material.transparent = true;
    }
    this.projectPlaques.forEach(
      (p, i) => (p.visible = this.state.completed.includes(CAMPAIGN_MISSIONS[i].id)),
    );
    this.trophy.visible = this.state.completed.includes('pitch');
  }
  entryCard() {
    return '<button class="mission-row mission-open" data-campaign-open><span class="mission-row-title">Nur noch eine kleine Änderung</span><span>4 Kapitel ↗</span></button>';
  }
  blocked() {
    return !!(
      this.g.origin?.active ||
      this.g.workshop?.active ||
      this.g.fireStory?.active ||
      this.g.quizssoir?.active ||
      this.g.sim.s.courier?.active ||
      this.g.extras?.intro?.current
    );
  }
  interact(item) {
    if (item?.kind !== 'bbe-campaign') return false;
    if (this.g.cinematic || this.g.busy || this.g.modal) return true;
    const d = item.data;
    if (d.task) this.openTask(d.task);
    else if (d.shop) this.openShop(d.shop);
    else if (
      d.mission === 'research' &&
      this.state.active?.id === 'research' &&
      this.state.active.phase === 'play' &&
      ['dogtown', 'zitronengras'].every((id) => this.state.active.tasks.includes(id))
    ) {
      this.enabled = true;
      this.openReport();
    } else this.start(d.mission);
    return true;
  }
  start(id) {
    const m = mission(id);
    if (
      !m ||
      this.w.zone !== 'office' ||
      Math.hypot(this.w.player.position.x - m.x, this.w.player.position.z - m.z) > 2.5
    ) {
      this.g.toast('Startpunkt im BBE-Büro', m?.short || 'Projektterminal');
      return;
    }
    if (this.blocked()) {
      this.g.toast('Zuerst die laufende Story beenden.');
      return;
    }
    const result = startCampaign(this.state, id);
    if (!result.ok) {
      this.g.toast(
        result.reason === 'locked'
          ? 'Vorheriges Kapitel abschließen.'
          : 'Zuerst das laufende Kapitel beenden.',
      );
      return;
    }
    this.enabled = true;
    this.closePanel();
    this.checkpoint();
    if (['intro', 'outro'].includes(this.state.active.phase))
      this.playScene(this.state.active.phase);
    else if (this.state.active.phase === 'failed') this.showFailure();
    else {
      this.syncWorld();
      this.updateHUD();
      if (id === 'pitch') this.openPitch();
    }
  }
  objective() {
    const a = this.state.active;
    if (!a) return null;
    if (a.id === 'meeting' || a.id === 'night') {
      const t = CAMPAIGN_TASKS[a.id].find((t) => !a.tasks.includes(t.id));
      return t && { ...t, zone: 'office' };
    }
    if (a.id === 'research') {
      const shop = RESEARCH_SHOPS.find((s) => !a.tasks.includes(s.id));
      if (shop) return { ...shop, label: shop.name + ' untersuchen', zone: 'city' };
      return { ...mission('research'), label: 'Bericht im BBE-Büro', zone: 'office' };
    }
    return {
      ...mission('pitch'),
      label: 'Kunden-Pitch · ' + Math.min(5, a.step + 1) + '/5',
      zone: 'office',
    };
  }
  updateHUD() {
    const a = this.state.active,
      goal = this.objective();
    this.hud.hidden = !this.enabled || !a || this.cinematic || !this.g.started;
    const night = !!(
      this.enabled &&
      a?.id === 'night' &&
      a.phase === 'play' &&
      this.w.zone === 'office' &&
      !this.cinematic
    );
    this.nightVeil.hidden = !night;
    this.emergency.intensity = night ? 5 : 0;
    const manual = this.manualMarker > 0 && this.manualTarget && this.w.zone === 'office';
    this.marker.visible = !!(
      !this.cinematic &&
      !this.panel &&
      (manual || (this.enabled && a?.phase === 'play' && goal && this.w.zone === goal.zone))
    );
    if (this.marker.visible) {
      const target = manual ? this.manualTarget : goal;
      this.marker.position.set(target.x, 0.045, target.z);
    }
    if (!a || !goal) return;
    const m = mission(a.id),
      progress = a.id === 'pitch' ? a.step / 5 : a.tasks.length / (a.id === 'research' ? 3 : 4);
    $('campaign-chapter').textContent = `BBE · ${m.chapter}/4`;
    $('campaign-goal').textContent = goal.label || m.short;
    $('campaign-timer').textContent = m.seconds ? minute(a.remaining) : `${a.tasks.length}/3`;
    $('campaign-timer').classList.toggle('urgent', m.seconds > 0 && a.remaining < 45);
    if ($('campaign-panel-timer'))
      $('campaign-panel-timer').textContent = m.seconds
        ? minute(a.remaining)
        : 'RECHERCHE · OHNE ZEITDRUCK';
    this.hud.querySelector('.campaign-meter i').style.transform = `scaleX(${progress})`;
    if (this.manualWaypoint && this.manualMarker > 0 && this.w.zone === 'city') {
      this.g.waypoint = this.manualWaypoint;
      return;
    }
    if (goal.zone === 'city' && this.w.zone === 'city')
      this.g.waypoint = { x: goal.x, z: goal.z, name: goal.label, campaign: true };
    else if (this.g.waypoint?.campaign) this.g.waypoint = null;
  }
  beforeTransition(zone) {
    const a = this.state.active;
    if (this.enabled && a && a.id !== 'research' && a.phase === 'play' && zone !== 'office') {
      this.openJournal();
      return false;
    }
    return true;
  }
  checkpoint() {
    if (this.active) this.g.sim.save();
  }
  openJournal() {
    if (this.cinematic) return;
    this.closePanel();
    const a = this.state.active;
    const cards = CAMPAIGN_MISSIONS.map(
      (m) =>
        `<button class="campaign-chapter-card ${this.state.completed.includes(m.id) ? 'done' : ''}" data-locate="${m.id}" ${campaignUnlocked(this.state, m.id) ? '' : 'disabled'}><span>${String(m.chapter).padStart(2, '0')}</span><b>${esc(m.short)}</b><small>${this.state.completed.includes(m.id) ? 'Bestwert ' + this.state.best[m.id] + ' %' : campaignUnlocked(this.state, m.id) ? 'Start im Büro' : 'Gesperrt'}</small></button>`,
    ).join('');
    this.showPanel(
      'journal',
      'Nur noch eine kleine Änderung',
      `<div class="campaign-chapters">${cards}</div>${a ? '<div class="campaign-toolbar"><button id="campaign-resume" class="primary">Fortsetzen</button><button id="campaign-abandon">Kapitel beenden</button></div>' : ''}`,
    );
    document.querySelectorAll('[data-locate]').forEach(
      (b) =>
        (b.onclick = () => {
          const m = mission(b.dataset.locate);
          this.closePanel();
          this.g.toast(m.short, 'Projektterminal im BBE-Büro · Kapitel ' + m.chapter);
          if (this.w.zone === 'office') {
            this.marker.position.set(m.x, 0.045, m.z);
            this.marker.visible = true;
            this.manualMarker = 8;
            this.manualTarget = m;
          } else {
            this.g.waypoint = { x: 31, z: 45.2, name: 'BBE · ' + m.short, campaign: true };
            this.manualWaypoint = this.g.waypoint;
            this.manualMarker = 8;
          }
        }),
    );
    if (a) {
      $('campaign-resume').onclick = () => {
        this.closePanel();
        if (!this.enabled) {
          this.g.toast('Am Projektterminal im BBE-Büro fortsetzen.');
          return;
        }
        if (['intro', 'outro'].includes(a.phase)) this.playScene(a.phase);
        else if (a.phase === 'failed') this.showFailure();
        else if (a.id === 'pitch') this.openPitch();
        this.syncWorld();
      };
      $('campaign-abandon').onclick = () => {
        this.state.active = null;
        this.enabled = false;
        this.closePanel();
        this.cleanup();
        this.g.sim.save();
        this.g.toast('Kapitel beendet.', 'Abgeschlossene Kapitel bleiben erhalten.');
      };
    }
  }
  showPanel(kind, title, body) {
    this.panel = null;
    this.g.open(
      title,
      `<div class="campaign-panel" data-campaign-panel="${kind}">${!['journal', 'failed'].includes(kind) ? '<div class="campaign-panel-tools"><span id="campaign-panel-timer"></span><button id="campaign-panel-pause">Pause · Esc</button></div>' : ''}${body}<div class="campaign-feedback" role="status"></div><button class="campaign-back" id="campaign-back">Zurück</button></div>`,
      {
        eyebrow: 'BBE · NUR NOCH EINE KLEINE ÄNDERUNG',
        pause: true,
        locked: true,
        onClose: () => {
          this.panel = null;
          this.stopVoice();
        },
      },
    );
    this.panel = { kind };
    this.panelClock = 0;
    $('campaign-back').onclick = () => this.closePanel();
    const badge = document.querySelector('.paused-badge');
    if (badge && !['journal', 'failed'].includes(kind)) badge.textContent = 'AUFTRAG LÄUFT';
    if ($('campaign-panel-pause')) $('campaign-panel-pause').onclick = () => this.openJournal();
    this.updateHUD();
  }
  closePanel() {
    this.panel = null;
    this.panelClock = 0;
    this.selectedCable = null;
    if (document.querySelector('[data-campaign-panel]')) {
      if (this.g.modal) this.g.modal.locked = false;
      this.g.close();
    }
  }
  feedback(text, bad = false) {
    const el = document.querySelector('.campaign-feedback');
    if (el) {
      el.textContent = text;
      el.classList.toggle('bad', bad);
    }
    this.g.audio.play(bad ? 'error' : 'click');
  }
  act(action, { keep = false } = {}) {
    const result = campaignAction(this.state, action);
    this.checkpoint();
    this.syncWorld();
    if (!result.ok) {
      const texts = {
        dependencies: 'Zuerst die markierte Aufgabe erledigen.',
        cable: 'Stecker und Anschluss passen noch nicht.',
        count: 'Noch einmal auf die fertigen Bestellungen achten.',
        source: 'Das Gespräch ist eine Aussage, keine eigene Messung.',
        backup: 'Freigabe und Prüfsumme müssen beide stimmen.',
        sequence: 'Reihenfolge prüfen. Noch einmal von vorn.',
        pitch: 'Prüfe deine Notizen und die gezeigten Zahlen.',
      };
      this.feedback(texts[result.reason] || 'Noch nicht passend. Prüfe den Hinweis.', true);
      return result;
    }
    if (result.complete) {
      this.closePanel();
      this.playScene('outro');
    } else if (!keep) {
      this.closePanel();
      this.updateHUD();
    }
    return result;
  }
  choices(values, attribute = 'answer') {
    return `<div class="campaign-choices">${values.map(([id, title, detail]) => `<button data-${attribute}="${esc(id)}"><b>${esc(title)}</b>${detail ? '<span>' + esc(detail) + '</span>' : ''}</button>`).join('')}</div>`;
  }
  bindChoices(fn, attribute = 'answer') {
    document
      .querySelectorAll('[data-' + attribute + ']')
      .forEach((b) => (b.onclick = () => fn(b.dataset[attribute], b)));
  }
  openTask(task) {
    const a = this.state.active;
    if (!this.enabled || !a || a.phase !== 'play') return;
    const v = campaignVariant(this.state);
    if (a.id === 'meeting' && task === 'brief') {
      this.showPanel(
        'brief',
        'Was braucht der Kunde?',
        `<div class="campaign-mail"><span>CLARA · KUNDIN</span><strong>${{ decision: 'Wir müssen heute entscheiden, ob wir den Pilot starten.', risks: 'Bevor wir investieren, möchte ich die Risiken verstehen.', numbers: 'Bitte beginnen Sie mit den belastbaren Kennzahlen.' }[v.priority]}</strong></div>` +
          this.choices(Object.entries(priorityNames).map(([id, title]) => [id, title])),
      );
      this.bindChoices((answer) => this.act({ type: 'brief', answer }));
    } else if (a.id === 'meeting' && task === 'papers') {
      this.showPanel(
        'papers',
        'Die richtige Unterlage',
        this.choices([
          ['entwurf', 'Analyse_final_v8.pdf', 'Entwurf · Zahlenstand gestern'],
          [
            'freigegeben',
            'Analyse_Kundenfassung.pdf',
            'Heute · freigegeben · ohne interne Honorare',
          ],
          ['intern', 'Analyse_Partner_intern.pdf', 'Intern · inklusive Kalkulation'],
        ]),
      );
      this.bindChoices((answer) => this.act({ type: 'papers', answer }));
    } else if (a.id === 'meeting' && task === 'av') this.openAV();
    else if (a.id === 'meeting' && task === 'seats') {
      if (!['brief', 'papers', 'av'].every((t) => a.tasks.includes(t))) {
        this.g.toast('Kundenwunsch, Unterlagen und Beamer zuerst.');
        return;
      }
      this.showPanel(
        'seats',
        'Die erste Folie',
        '<div class="campaign-agenda"><span>BEGRÜSSUNG →</span><strong>?</strong><span>→ DISKUSSION → ENTSCHEIDUNG</span></div>' +
          this.choices(Object.entries(priorityNames).map(([id, title]) => [id, title])),
      );
      this.bindChoices((answer) => this.act({ type: 'seats', answer }));
    } else if (a.id === 'night') this.openNightTask(task);
  }
  openAV() {
    const a = this.state.active,
      connected = (id) => a.cable.includes(id);
    this.showPanel(
      'av',
      'Bild. Ton. Strom.',
      `<p class="campaign-one-line">Stecker ziehen oder anklicken → Anschluss</p><div class="campaign-patchbay"><div class="campaign-plugs">${[
        ['HDMI', 'screen'],
        ['USB', 'sound'],
        ['Netzteil', 'power'],
      ]
        .map(
          ([name, id]) =>
            `<button draggable="true" data-plug="${name}" ${connected(id) ? 'disabled' : ''}>${name}<span>${connected(id) ? '✓' : '●'}</span></button>`,
        )
        .join(
          '',
        )}</div><svg viewBox="0 0 120 160" aria-hidden="true">${a.cable.map((id) => `<path d="M0 ${24 + ['screen', 'sound', 'power'].indexOf(id) * 55} C55 20 55 140 120 ${24 + ['screen', 'sound', 'power'].indexOf(id) * 55}"/>`).join('')}</svg><div class="campaign-ports">${[
        ['screen', 'Beamer · HDMI'],
        ['sound', 'Konferenzton · USB'],
        ['power', 'Dock · 20 V'],
      ]
        .map(
          ([id, title]) =>
            `<button data-port="${id}" ${connected(id) ? 'disabled' : ''}>${title}<span>${connected(id) ? '✓' : '○'}</span></button>`,
        )
        .join('')}</div></div>`,
    );
    const connect = (target) => {
      if (!this.selectedCable) return this.feedback('Zuerst einen Stecker wählen.');
      const r = this.act({ type: 'cable', answer: this.selectedCable, target }, { keep: true });
      if (r.ok && !r.complete) {
        if (a.cable.length === 3) {
          this.closePanel();
          this.updateHUD();
        } else this.openAV();
      }
    };
    document.querySelectorAll('[data-plug]').forEach((b) => {
      b.onclick = () => {
        this.selectedCable = b.dataset.plug;
        document
          .querySelectorAll('[data-plug]')
          .forEach((x) => x.classList.toggle('selected', x === b));
      };
      b.ondragstart = (e) => {
        this.selectedCable = b.dataset.plug;
        e.dataTransfer.setData('text/plain', this.selectedCable);
      };
    });
    document.querySelectorAll('[data-port]').forEach((b) => {
      b.onclick = () => connect(b.dataset.port);
      b.ondragover = (e) => e.preventDefault();
      b.ondrop = (e) => {
        e.preventDefault();
        connect(b.dataset.port);
      };
    });
  }
  openShop(id) {
    const a = this.state.active,
      shop = RESEARCH_SHOPS.find((s) => s.id === id);
    if (!shop || !this.enabled || a?.id !== 'research' || a.phase !== 'play') return;
    if (a.tasks.includes(id)) {
      this.g.toast('Bereits dokumentiert.');
      return;
    }
    this.showPanel(
      'shop',
      shop.name + ' · Recherche',
      `<div class="campaign-shop-hero"><span>${id === 'dogtown' ? 'BURRITO' : 'THAI CURRY'}</span><b>${shop.price.toFixed(2).replace('.', ',')} €</b><small>Spielsortiment · Mittagsservice</small></div>` +
        this.choices([
          ['observe', 'Service beobachten', 'Eigene kleine Stichprobe'],
          ['talk', 'Freundlich nachfragen', 'Hinweis vom Team'],
        ]),
    );
    this.bindChoices((answer) => {
      this.act({ type: 'approach', shop: id, answer }, { keep: true });
      if (answer === 'observe') this.openObservation(shop);
      else this.openInterview(shop);
    });
  }
  openObservation(shop) {
    const a = this.state.active,
      served = shop.served + a.variant,
      total = shop.order + a.variant;
    this.showPanel(
      'observe',
      shop.name + ' · Service zählen',
      `<div class="campaign-observation"><div class="campaign-service-counter"><span>KASSE</span><b>${total} Bestellungen</b><span>AUSGABE</span></div><div class="campaign-queue">${Array.from({ length: total }, (_, i) => `<span class="campaign-guest" data-guest="${i}" style="--i:${i}"><i></i><b>${i + 1}</b></span>`).join('')}</div><div class="campaign-observe-track"><i></i></div></div><p class="campaign-one-line">Wie viele Bestellungen werden fertig?</p><div id="campaign-observe-answers" hidden>${this.choices([served - 1, served, served + 1].map((n) => [String(n), String(n) + ' Bestellungen']))}</div>`,
    );
    Object.assign(this.panel, { shop, served, duration: 8 + total * 0.55 });
    this.speak('campaign_research_observe');
    this.bindChoices((answer) => {
      if (this.panelClock < this.panel.duration) return;
      const r = this.act({ type: 'observation', shop: shop.id, answer });
      if (r.ok)
        this.g.toast(
          'Beobachtung dokumentiert',
          shop.name + ' · ' + served + ' von ' + total + ' Bestellungen',
        );
    });
  }
  openInterview(shop) {
    const id = 'campaign_' + shop.id + '_ask',
      line = meta(id);
    this.showPanel(
      'interview',
      shop.name + ' · Gespräch',
      `<div class="campaign-mail"><span>${esc(line.speaker)}</span><strong>${esc(line.text)}</strong></div><p class="campaign-one-line">Wie kommt dieser Hinweis in den Bericht?</p>` +
        this.choices([
          ['proof', 'Bewiesene Ursache'],
          ['statement', 'Aussage des Teams'],
          ['measured', 'Eigene Messung'],
        ]),
    );
    this.speak(id);
    this.bindChoices((answer) => {
      const r = this.act({ type: 'interview', shop: shop.id, answer });
      if (r.ok) this.speak('campaign_research_talk');
    });
  }
  openReport() {
    const a = this.state.active;
    if (!['dogtown', 'zitronengras'].every((id) => a.tasks.includes(id))) return;
    this.showPanel(
      'report',
      'Vom Hinweis zum Pilot',
      `<div class="campaign-research-table">${RESEARCH_SHOPS.map((s) => `<article><b>${s.name}</b><strong>${s.price.toFixed(2).replace('.', ',')} €</strong><span>${this.state.choices.methods[s.id] === 'observe' ? 'Beobachtung · ' + (s.served + a.variant) + '/' + (s.order + a.variant) + ' fertig' : 'Interview · ' + (s.id === 'dogtown' ? 'Vorbestellung entlastet' : 'Sonderwünsche bremsen')}</span></article>`).join('')}</div><p class="campaign-one-line">Welche Richtung willst du beim Pitch vertreten?</p>` +
        this.choices([
          ['pilot', 'Vorbestellung testen', 'Ein kleiner messbarer Pilot'],
          ['service', 'Ausgabe verbessern', 'Standardablauf und Sonderwünsche trennen'],
          ['price', 'Preisangebot testen', 'Begrenzter Test, Deckungsbeitrag messen'],
        ]),
    );
    this.bindChoices((answer) => this.act({ type: 'report', answer }));
  }
  openNightTask(task) {
    const a = this.state.active,
      v = campaignVariant(this.state);
    if (task === 'diagnose') {
      this.showPanel(
        'diagnose',
        'Die Störung eingrenzen',
        `<div class="campaign-terminal"><span>BENJAMIN · SYSTEMCHECK</span><code>${v.incident === 'adapter' ? 'NETZSPANNUNG: OK<br>SERVER: USV AKTIV<br>DOCK: 0 V<br>NETZTEIL: GETRENNT' : 'NETZSPANNUNG: OK<br>LAST: 132 %<br>MEHRFACHLEISTE: AUSGELÖST<br>SERVER: USV AKTIV'}</code></div>` +
          this.choices([
            ['adapter', 'Dock-Netzteil fehlt'],
            ['overload', 'Steckdosenleiste überlastet'],
            ['internet', 'Internet ausgefallen'],
          ]),
      );
      this.bindChoices((answer) => this.act({ type: 'diagnose', answer }));
    } else if (task === 'power') {
      if (!a.tasks.includes('diagnose')) return this.g.toast('Zuerst Benjamins Diagnose prüfen.');
      this.showPanel(
        'power',
        'Notstrom · Startfolge',
        `<div class="campaign-sequence">${v.fuse.map((id, i) => `<span class="${i < a.circuits ? 'done' : ''}">${i + 1} · ${circuitNames[id]}</span>`).join('')}</div><div class="campaign-switches">${['network', 'screen', 'server'].map((id) => `<button data-circuit="${id}"><i></i><b>${circuitNames[id]}</b></button>`).join('')}</div>`,
      );
      this.bindChoices((answer) => {
        const r = this.act({ type: 'circuit', answer }, { keep: true });
        if (r.ok && a.circuits === 3) {
          this.closePanel();
          this.speak('campaign_night_restored');
        } else {
          this.openNightTask('power');
          if (!r.ok) this.feedback('Startfolge zurückgesetzt.', true);
        }
      }, 'circuit');
    } else if (task === 'backup') {
      if (!a.tasks.includes('power')) return this.g.toast('Zuerst den Notstrom einschalten.');
      this.showPanel(
        'backup',
        'Welche Sicherung ist belastbar?',
        '<div class="campaign-terminal"><span>ERWARTETE PRÜFSUMME</span><code>BBE-8A42 · 18:42 · KUNDENSTAND HEUTE</code></div>' +
          this.choices([
            ['late', 'final_final_wirklich.pptx', '19:04 · unvollständig · BBE-0000'],
            ['reviewed', 'Kundenfassung_freigegeben.pptx', '18:42 · freigegeben · BBE-8A42'],
            ['old', 'backup_sicher_final.pptx', 'Gestern · freigegeben · BBE-19C3'],
          ]),
      );
      this.bindChoices((answer) => this.act({ type: 'backup', answer }));
    } else if (task === 'restore') {
      if (!a.tasks.includes('backup')) return this.g.toast('Zuerst die geprüfte Sicherung holen.');
      this.showPanel(
        'restore',
        'Die Storyline wiederherstellen',
        `<div class="campaign-sequence">${['Beobachtung', 'Erkenntnis', 'Empfehlung'].map((t, i) => `<span class="${i < a.restore ? 'done' : ''}">${i < a.restore ? t : '?'}</span>`).join('')}</div><p class="campaign-one-line">Drei Folien. Eine logische Reihenfolge.</p>` +
          this.choices([
            [
              'action',
              {
                pilot: 'Vorbestellung im Pilot testen',
                service: 'Ausgabeablauf im Pilot testen',
                price: 'Preisangebot im Pilot testen',
              }[this.state.choices.recommendation] || 'Vorbestellung im Pilot testen',
            ],
            ['evidence', 'Service und Teamhinweise dokumentiert'],
            ['insight', 'Abläufe beeinflussen die Wartezeit'],
          ]),
      );
      this.bindChoices((answer) => {
        const r = this.act({ type: 'restore', answer }, { keep: true });
        if (!r.complete) {
          this.openNightTask('restore');
          if (!r.ok) this.feedback('Erst Beleg, dann Deutung, dann Handlung.', true);
        }
      });
    }
  }
  openPitch() {
    const a = this.state.active;
    if (a?.id !== 'pitch' || a.phase !== 'play') return;
    const v = campaignVariant(this.state),
      method = this.state.choices.recommendation || 'pilot';
    const prompts = [
      [
        'Ein Einstieg, der zum Kunden passt',
        `<p class="campaign-client-note">Kundenwunsch aus Kapitel 1: <b>${esc(priorityNames[this.state.choices.priority] || priorityNames.decision)}</b></p>`,
        Object.entries(priorityNames).map(([id, title]) => [id, title]),
      ],
      [
        'Welches Diagramm erklärt den Effekt?',
        `<div class="campaign-chart"><div><span>Umsatzindex</span><i style="--value:${v.current}%"></i><b>${v.current}</b></div><div><span>Käufeindex</span><i style="--value:${v.countCurrent}%"></i><b>${v.countCurrent}</b></div><small>Vorperiode jeweils 100</small></div>`,
        [
          ['total', 'Umsatz allein'],
          ['basket', 'Durchschnittsbon = Umsatz ÷ Käufe'],
          ['visitors', 'Besucher ohne Kassenbezug'],
        ],
      ],
      [
        'Neue Zahlen. Klare Antwort.',
        `<div class="campaign-equation"><span>Umsatz<br><b>+${v.current - 100} %</b></span><span>Käufe<br><b>−${100 - v.countCurrent} %</b></span><span>Durchschnittsbon<br><b>?</b></span></div><p class="campaign-one-line">Bon-Faktor = Umsatzindex ÷ Käufeindex</p>`,
        [v.lift - 5, v.lift, v.lift + 5].map((n) => [String(n), '+' + n + ' %']),
      ],
      [
        'Wie sicher ist Ihre Aussage?',
        `<div class="campaign-research-table">${RESEARCH_SHOPS.map((s) => `<article><b>${s.name}</b><span>${this.state.choices.methods[s.id] === 'observe' ? 'Eigene kleine Stichprobe' : 'Aussage des Teams'}</span></article>`).join('')}</div>`,
        [
          ['proof', 'Die Ursache ist bewiesen'],
          ['sample', 'Zwei kleine Stichproben – größer prüfen'],
          ['mixed', 'Beobachtungen und Aussagen – getrennt prüfen'],
        ],
      ],
      [
        'Die Entscheidung',
        `<div class="campaign-mail"><span>DEIN BERICHT</span><strong>${{ pilot: 'Vorbestellung im Pilot testen', service: 'Ausgabe und Sonderwünsche trennen', price: 'Begrenzten Preisversuch prüfen' }[method]}</strong></div>`,
        [
          ['pilot', 'Vorbestellung testen', 'Wartezeit und Wiederbesuch messen'],
          ['service-test', 'Ablauf testen', 'Ausgabezeit vor / nach dem Test messen'],
          ['price-test', 'Preisangebot testen', 'Absatz und Deckungsbeitrag gemeinsam messen'],
        ],
      ],
    ];
    const [title, visual, choices] = prompts[a.step];
    this.showPanel(
      'pitch',
      title,
      `<div class="campaign-pitch-header"><span>CLARA · KUNDIN</span><b>${a.step + 1} / 5</b></div>${visual}${this.choices(choices)}`,
    );
    if (a.step === 2) this.speak('campaign_pitch_change');
    this.bindChoices((answer) => {
      const r = this.act({ type: 'pitch', answer }, { keep: true });
      if (r.ok && !r.complete) this.openPitch();
    });
  }
  showFailure() {
    this.stopVoice();
    this.speak('campaign_retry');
    this.showPanel(
      'failed',
      'Noch eine kleine Generalprobe',
      '<div class="campaign-retry-art">↺</div><p class="campaign-one-line">Erledigte Aufgaben bleiben gespeichert.</p><button id="campaign-retry" class="primary">Mit frischer Zeit fortsetzen</button>',
    );
    $('campaign-retry').onclick = () => {
      campaignAction(this.state, { type: 'retry' });
      this.closePanel();
      this.checkpoint();
      this.syncWorld();
      if (this.state.active.id === 'pitch') this.openPitch();
    };
  }
  async speak(id) {
    this.stopVoice();
    const token = ++this.voiceToken,
      l = meta(id);
    if (!l?.text) return;
    this.caption.innerHTML = `<span>${esc(l.speaker)}</span><b>${esc(l.text)}</b>`;
    this.caption.hidden = !this.g.sim.s.audioSubtitles || this.cinematic;
    this.captionRemaining = l.duration || Math.max(3, l.text.length / 15);
    try {
      const buffer = await this.g.audio.bank?.get(l.asset);
      if (token !== this.voiceToken || document.hidden) return;
      this.g.audio.voices?.stop();
      this.voice = this.g.audio.emit?.(buffer, { bus: 'dialogue', volume: 0.92 });
      this.captionRemaining = buffer?.duration || this.captionRemaining;
    } catch {
      /* Captions remain available after a transient audio failure. */
    }
  }
  stopVoice() {
    ++this.voiceToken;
    this.voice?.stop(0.06);
    this.voice = null;
    this.captionRemaining = 0;
    if (this.caption) this.caption.hidden = true;
  }
  async playScene(kind) {
    if (this.cinematic || !this.state.active) return;
    this.closePanel();
    this.stopVoice();
    const a = this.state.active,
      m = mission(a.id),
      token = ++this.token;
    this.loading = true;
    this.pendingPaused = document.hidden;
    this.pendingKind = kind;
    this.g.open(
      m.short,
      '<div class="campaign-scene-loading"><i></i></div><button id="campaign-loading-skip">Überspringen · Enter</button>',
      { pause: true, locked: true },
    );
    $('campaign-loading-skip').onclick = () => this.finishScene();
    try {
      const lines = CAMPAIGN_SCENES[a.id][kind].map(meta);
      this.g.audio.update(0, this.w, false);
      await this.g.audio.bank?.preload([
        ...lines.map((l) => l.asset).filter(Boolean),
        'story_underscore',
      ]);
      if (token !== this.token) return;
      const set = this.set || (this.set = this.makeSet());
      set.actors.Tobias.visible = a.id !== 'night' && a.id !== 'pitch';
      set.actors.Benjamin.visible = a.id === 'night';
      set.actors.clara.visible = a.id === 'pitch';
      set.actors.lukas.visible = a.id !== 'night';
      set.scene.background.set(a.id === 'night' ? '#17283b' : '#a9bec3');
      set.scene.traverse((o) => {
        if (o.isHemisphereLight) o.intensity = a.id === 'night' ? 0.8 : 2;
        if (o.isDirectionalLight) {
          o.color.set(a.id === 'night' ? '#8fbbef' : '#ffe3b3');
          o.intensity = a.id === 'night' ? 1.7 : 3.8;
        }
      });
      set.emergency.intensity = a.id === 'night' ? 3 : 0;
      set.suitcase.visible = false;
      for (const [id, props] of Object.entries(set.chapterProps)) props.visible = id === a.id;
      let time = 0.75;
      const segments = lines.map((line) => {
        const buffer = this.g.audio.bank?.buffers?.get(line.asset),
          duration = buffer?.duration || line.duration || Math.max(3, line.text.length / 14),
          s = { line, start: time, voiceEnd: time + duration, end: time + duration + 0.45 };
        time = s.end;
        return s;
      });
      this.current = {
        id: a.id,
        kind,
        set,
        segments,
        duration: time + 0.7,
        elapsed: 0,
        index: -1,
        paused: this.pendingPaused,
        shadowAuto: this.w.renderer.shadowMap.autoUpdate,
        previousMix: this.g.audio.cinematicMix,
        target: new THREE.Vector3(0, 1.1, -1),
      };
      this.loading = false;
      this.pendingKind = null;
      this.g.audio.voices?.stop();
      this.g.audio.cinematicMix = { owner: this, musicDuck: 0.15 };
      document.body.classList.add('story-cinematic', 'campaign-cinematic');
      this.updateHUD();
      $('modal-root').innerHTML =
        `<section class="campaign-film" role="dialog" aria-label="${esc(m.title)}"><div class="campaign-film-bar"><span>BBE STORIES · ${m.chapter}/4</span><div><button id="campaign-film-pause">Pause · Esc</button><button id="campaign-film-skip">Überspringen · Enter</button></div></div><div class="campaign-film-title"><small>NUR NOCH EINE KLEINE ÄNDERUNG</small><h1>${esc(m.title)}</h1></div><div id="campaign-film-paused" hidden>PAUSE</div><div class="campaign-subtitles" id="campaign-film-subtitle"><span></span><p></p></div><div class="campaign-film-progress"><i></i></div></section>`;
      $('campaign-film-pause').onclick = () => this.pause(!this.current.paused);
      $('campaign-film-skip').onclick = () => this.finishScene();
      this.startBed();
    } catch (error) {
      console.warn('BBE campaign scene', error);
      if (token === this.token) this.finishScene();
    }
  }
  makeSet() {
    const set = buildBossSet({ nameplate: 'BBE · PROJEKTTEAM' });
    for (const role of ['Benjamin', 'clara']) {
      const actor = storyActor(role);
      actor.position.set(1.42, -0.28, 0.95);
      actor.rotation.y = -2.7;
      actor.userData.baseY = -0.28;
      actor.userData.storyPose = 'seated';
      set.actors[role] = actor;
      set.scene.add(actor);
    }
    label(set.scene, 'NUR NOCH EINE KLEINE ÄNDERUNG', 0, 3.43, -5.14, 4.8, 0.23, {
      bg: '#213e4b',
      fg: '#dcd6bc',
    });
    set.emergency = new THREE.PointLight('#f5bc75', 0, 10, 2);
    set.emergency.position.set(0, 1.8, -2);
    set.scene.add(set.emergency);
    set.chapterProps = this.buildChapterProps(set);
    return set;
  }
  buildChapterProps(set) {
    const groups = Object.fromEntries(
      CAMPAIGN_MISSIONS.map((m) => {
        const g = new THREE.Group();
        g.name = m.short + ' · Kulisse';
        set.scene.add(g);
        return [m.id, g];
      }),
    );
    // A map on the research desk; the service locations are physical pinned locations.
    const research = groups.research;
    box(research, 0.25, 0.952, -1.22, 1.55, 0.02, 0.94, '#dfd7bc');
    box(research, 0.25, 0.968, -1.22, 0.1, 0.016, 0.87, '#728a83');
    box(research, 0.25, 0.97, -1.16, 1.48, 0.017, 0.09, '#728a83');
    for (let i = 0; i < 7; i++)
      for (const side of [-1, 1])
        box(
          research,
          0.25 + side * 0.29,
          1.003,
          -1.56 + i * 0.12,
          0.24,
          0.08,
          0.09,
          ['#abb5a1', '#baae98', '#979f96'][i % 3],
        );
    for (const z of [-1.4, -1.17]) {
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#c88858' }),
      );
      pin.position.set(0.52, 1.1, z);
      research.add(pin);
    }
    label(research, 'AUGUSTENSTRASSE', 0, 2.2, -5.02, 3.8, 0.62, {
      bg: '#254d52',
      fg: '#e8dcbe',
      sub: 'BEOBACHTEN · NACHFRAGEN · EINORDNEN',
    });
    // IT racks and warm emergency lamps give the blackout its own readable location.
    const night = groups.night;
    for (const x of [-3.9, -2.9, 3.8]) {
      box(night, x, 1.1, -4.6, 0.82, 2.2, 0.7, '#243f4b');
      for (let i = 0; i < 7; i++) {
        box(night, x, 0.24 + i * 0.27, -4.21, 0.68, 0.19, 0.035, '#526574');
        box(
          night,
          x + 0.24,
          0.25 + i * 0.27,
          -4.18,
          0.04,
          0.035,
          0.015,
          i % 3 ? '#a9e6bc' : '#ecc173',
        );
      }
    }
    label(night, 'BENJAMIN · IT', 0, 2.6, -5.02, 4.6, 0.9, {
      bg: '#203a4d',
      fg: '#d9e5e4',
      sub: 'NOTSTROM · WIR BLEIBEN DRAN',
    });
    box(night, 0.95, 1.01, -1.2, 0.15, 0.2, 0.15, '#e3be77');
    // The pitch has a client-facing chart wall instead of the project map.
    const pitch = groups.pitch;
    box(pitch, 0, 2.45, -5.01, 4.7, 1.85, 0.07, '#152e3c');
    label(pitch, 'EINE KLARE EMPFEHLUNG', 0, 2.96, -4.955, 4.3, 0.44, {
      bg: '#152e3c',
      fg: '#ebd89e',
    });
    for (let i = 0; i < 5; i++) {
      const h = 0.25 + i * 0.13;
      box(
        pitch,
        -1.5 + i * 0.73,
        1.78 + h / 2,
        -4.94,
        0.4,
        h,
        0.035,
        i === 4 ? '#d8bb7c' : '#84b4a9',
      );
    }
    label(pitch, 'PILOT · MESSEN · ENTSCHEIDEN', 0, 1.7, -4.94, 4, 0.2, {
      bg: '#152e3c',
      fg: '#c4dfd6',
    });
    const meeting = groups.meeting;
    box(meeting, 0.2, 0.98, -1.2, 0.58, 0.1, 0.35, '#dce0d7');
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.09, 16),
      new THREE.MeshStandardMaterial({
        color: '#79bbd9',
        emissive: '#4d7796',
        emissiveIntensity: 0.4,
      }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.35, 0.99, -0.99);
    meeting.add(lens);
    label(meeting, 'KUNDE IM ANFLUG', 0, 2.05, -5.02, 3.7, 0.42, { bg: '#26464e', fg: '#e1cc95' });
    return groups;
  }
  startBed() {
    const m = this.current;
    if (!m || m.paused || !this.g.sim.s.music) return;
    const b = this.g.audio.bank?.buffers?.get('story_underscore');
    m.bed = this.g.audio.emit?.(b, {
      bus: 'music',
      volume: 0.24,
      loop: true,
      offset: m.elapsed % 35.122,
      fade: 0.45,
    });
  }
  pause(value) {
    if (this.loading) {
      this.pendingPaused = value;
      return;
    }
    const m = this.current;
    if (!m) {
      if (value) this.stopVoice();
      return;
    }
    if (m.paused === value) return;
    m.paused = value;
    m.voice?.stop(0.06);
    m.bed?.stop(0.12);
    this.g.audio.cinematicVoice = false;
    if (!value) {
      const part = m.segments[m.index];
      if (part && m.elapsed < part.voiceEnd) {
        const buffer = this.g.audio.bank?.buffers?.get(part.line.asset);
        m.voice = this.g.audio.emit?.(buffer, {
          bus: 'dialogue',
          volume: 0.94,
          offset: Math.max(0, m.elapsed - part.start),
        });
      }
      this.startBed();
    }
    if ($('campaign-film-paused')) $('campaign-film-paused').hidden = !value;
    if ($('campaign-film-pause'))
      $('campaign-film-pause').textContent = value ? 'Fortsetzen · Esc' : 'Pause · Esc';
  }
  render(dt) {
    const m = this.current;
    if (!m) {
      if (this.loading) this.w.update(0, true);
      return;
    }
    this.w.renderer.getSize(this.size);
    if (m.paused && m.drawn && m.width === this.size.x && m.height === this.size.y) return;
    if (!m.paused) m.elapsed += Math.min(0.25, dt);
    if (m.elapsed >= m.duration) {
      this.finishScene();
      return;
    }
    const index = m.segments.findIndex((s) => m.elapsed >= s.start && m.elapsed < s.end),
      segment = m.segments[index];
    if (index >= 0 && index !== m.index && !m.paused) {
      m.index = index;
      m.voice?.stop(0.04);
      const l = segment.line,
        el = $('campaign-film-subtitle');
      el.querySelector('span').textContent = l.speaker;
      el.querySelector('p').textContent = l.text;
      m.voice = this.g.audio.emit?.(this.g.audio.bank?.buffers?.get(l.asset), {
        bus: 'dialogue',
        volume: 0.94,
      });
    }
    const speaking = !m.paused && segment && m.elapsed < segment.voiceEnd;
    this.g.audio.cinematicVoice = !!speaking;
    $('campaign-film-subtitle').hidden = !this.g.sim.s.audioSubtitles || !speaking;
    for (const [role, actor] of Object.entries(m.set.actors))
      if (actor.visible)
        animateStoryActor(actor, m.elapsed, !!speaking && role === segment.line.actor, 'seated');
    const actor = m.set.actors[segment?.line.actor] || m.set.actors.player;
    const angle = { meeting: 1, research: -1, night: 0.8, pitch: -0.8 }[m.id];
    if (m.elapsed < 3 || m.elapsed > m.duration - 1.3) {
      this.look.set(0, 1.05, -1.1);
      this.eye.set(angle * (4.3 - m.elapsed * 0.006), m.id === 'night' ? 1.9 : 2.5, 4.7);
    } else {
      actor.getWorldPosition(this.look);
      this.look.y += 1.3;
      this.eye
        .copy(this.look)
        .add(
          new THREE.Vector3(
            angle * (0.65 + Math.sin(m.elapsed * 0.09) * 0.15),
            0.23,
            m.id === 'pitch' ? 2.55 : 2.8,
          ).applyAxisAngle(new THREE.Vector3(0, 1, 0), actor.rotation.y),
        );
    }
    if (!m.framed) {
      this.camera.position.copy(this.eye);
      m.target.copy(this.look);
      m.framed = true;
    } else if (!m.paused) {
      this.camera.position.lerp(this.eye, 1 - Math.exp(-dt * 2));
      m.target.lerp(this.look, 1 - Math.exp(-dt * 2.4));
    }
    const r = this.w.renderer;
    r.getSize(this.size);
    this.camera.aspect = this.size.x / Math.max(1, this.size.y);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(m.target);
    r.setRenderTarget(null);
    r.shadowMap.autoUpdate = true;
    r.shadowMap.needsUpdate = true;
    m.set.scene.environment = this.w.scene.environment;
    m.set.scene.environmentIntensity = m.id === 'night' ? 0.2 : 0.46;
    r.render(m.set.scene, this.camera);
    m.drawn = true;
    m.width = this.size.x;
    m.height = this.size.y;
    document.querySelector('.campaign-film-progress i').style.transform =
      `scaleX(${m.elapsed / m.duration})`;
    document.querySelector('.campaign-film-title').classList.toggle('faded', m.elapsed > 4);
  }
  finishScene() {
    if (!this.current && !this.loading) return;
    const m = this.current,
      kind = m?.kind || this.pendingKind;
    this.current = null;
    this.loading = false;
    this.pendingKind = null;
    ++this.token;
    m?.voice?.stop(0.06);
    m?.bed?.stop(0.2);
    this.g.audio.cinematicVoice = false;
    if (m) {
      this.g.audio.cinematicMix = m.previousMix;
      this.w.renderer.shadowMap.autoUpdate = m.shadowAuto;
      this.w.renderer.shadowMap.needsUpdate = true;
      this.w.shadowZone = null;
    }
    document.body.classList.remove('story-cinematic', 'campaign-cinematic');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    this.w.keys.clear();
    if (!this.state.active) {
      this.cleanup();
      return;
    }
    if (kind === 'intro') {
      campaignAction(this.state, { type: 'begin' });
      this.checkpoint();
      this.syncWorld();
      this.updateHUD();
      if (this.state.active.id === 'pitch') this.openPitch();
    } else {
      const result = finishCampaign(this.g.sim);
      this.enabled = false;
      this.cleanup();
      this.syncWorld();
      if (result.ok) {
        this.w.makeWorkstation();
        this.g.sim.emit('mission-complete', mission(result.id).short, { token: result });
        this.g.toast(
          mission(result.id).short + ' · ' + result.score + ' %',
          result.paid
            ? '+' + result.paid + ' € · +' + result.xp + ' XP · +' + result.rep + ' REP'
            : 'Wiederholung abgeschlossen · Bestwert gespeichert',
          true,
        );
      }
    }
  }
  cleanup() {
    this.stopVoice();
    this.manualMarker = 0;
    this.manualTarget = null;
    this.manualWaypoint = null;
    this.marker.visible = false;
    this.hud.hidden = true;
    this.nightVeil.hidden = true;
    this.emergency.intensity = 0;
    if (this.g.waypoint?.campaign) this.g.waypoint = null;
    this.syncWorld();
  }
  onSaveLoaded() {
    // Cancel asynchronous playback without advancing the newly imported mission state.
    ++this.token;
    const m = this.current;
    this.current = null;
    this.loading = false;
    this.pendingKind = null;
    this.enabled = false;
    m?.voice?.stop(0.06);
    m?.bed?.stop(0.1);
    this.g.audio.cinematicVoice = false;
    if (m) {
      this.g.audio.cinematicMix = m.previousMix;
      this.w.renderer.shadowMap.autoUpdate = m.shadowAuto;
      this.w.renderer.shadowMap.needsUpdate = true;
      this.w.shadowZone = null;
    }
    this.closePanel();
    if (m || this.g.modal?.title === mission(this.state.active?.id)?.short) {
      if (this.g.modal) this.g.modal.locked = false;
      this.g.close();
    }
    document.body.classList.remove('story-cinematic', 'campaign-cinematic');
    this.g.sim.s.bbeCampaign = normalizeCampaign(this.g.sim.s.bbeCampaign);
    this.greeting = false;
    this.cleanup();
  }
  colleagueGreeting() {
    if (!this.state.completed.includes('pitch')) return false;
    this.speak('campaign_office_greeting');
    return true;
  }
  key(e) {
    if (this.cinematic) {
      if (['Escape', 'Enter', 'Space'].includes(e.code)) {
        if (e.code === 'Enter' && e.target?.tagName === 'BUTTON') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) e.code === 'Escape' ? this.pause(!this.current?.paused) : this.finishScene();
      }
      return;
    }
    if (this.panel && e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (this.panel.kind === 'journal') this.closePanel();
      else this.openJournal();
    }
  }
  update(dt, paused = false) {
    if (!this.g.started || document.hidden) return;
    this.autosave += dt;
    if (this.captionRemaining > 0 && !this.cinematic) {
      this.captionRemaining -= dt;
      if (this.captionRemaining <= 0) this.caption.hidden = true;
    }
    if (this.manualMarker > 0) {
      this.manualMarker -= dt;
      if (this.manualMarker <= 0) this.marker.visible = false;
    }
    const a = this.state.active;
    if (this.enabled && a && !this.cinematic) {
      const missionPanel = this.panel && !['journal', 'failed'].includes(this.panel.kind),
        ticking = !this.g.busy && (!paused || !!missionPanel);
      const result = tickCampaign(this.state, dt, { paused: !ticking });
      if (result.failed) this.showFailure();
      if (a.id === 'meeting' && a.phase === 'play' && a.remaining < 85 && !a.hurry && !this.panel) {
        a.hurry = true;
        this.speak('campaign_meeting_hurry');
      }
      if (this.panel?.kind === 'observe') {
        this.panelClock += dt;
        const p = this.panel,
          ratio = Math.min(1, this.panelClock / p.duration),
          bar = document.querySelector('.campaign-observe-track i');
        if (bar) bar.style.transform = `scaleX(${ratio})`;
        document.querySelectorAll('[data-guest]').forEach((b) => {
          const n = Number(b.dataset.guest);
          b.classList.toggle('served', n < p.served && this.panelClock > 1.5 + n * 1.1);
        });
        if (ratio >= 1 && $('campaign-observe-answers'))
          $('campaign-observe-answers').hidden = false;
      }
      this.updateHUD();
      if (this.autosave > 10) {
        this.autosave = 0;
        this.checkpoint();
      }
    } else if (!this.manualMarker) this.updateHUD();
    if (
      this.state.completed.includes('pitch') &&
      !this.greeting &&
      !this.g.modal &&
      this.w.zone === 'office' &&
      this.g.started &&
      !this.g.cinematic
    ) {
      this.greeting = true;
      this.speak('campaign_office_greeting');
    }
  }
}
