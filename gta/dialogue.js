import { VOICE_LINES } from './voice-lines.js';

const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const names = {
  benjamin: 'Benjamin · IT',
  lukas: 'Lukas Fleischmann',
  clara: 'Clara · Auftraggeberin',
  officer: 'Polizei · Funk',
  player: 'Du',
  passerby: 'Passant',
  cyclist: 'Radfahrer',
  diner: 'Gast',
  bus_driver: 'Busfahrer',
  taxi_driver: 'Taxifahrer',
  seen: 'SEEN · Service',
  bao: 'MAMMA BAO · Service',
  palm: 'PALMTREECLUB · Service',
  gyoza: 'GYOZA BAR · Service',
  wirt: 'Wirtshaus · Service',
  mentors: 'MENTOR’S · Service',
};
const roles = { Lena: 'Projektleitung', Tobias: 'Research', Mara: 'Consulting', Jan: 'Partner' };
export class DialogueDirector {
  constructor(audio) {
    this.audio = audio;
    this.current = null;
    this.token = 0;
    this.queue = [];
    this.cooldowns = new Map();
    this.lastLines = new Map();
    this.nextAmbient = 10;
    this.arrival = null;
    this.heard = new Set();
  }
  mount() {
    if (this.caption?.isConnected) return;
    this.caption = document.createElement('div');
    this.caption.className = 'voice-caption';
    this.caption.id = 'voice-caption';
    this.caption.hidden = true;
    this.caption.setAttribute('role', 'status');
    this.caption.setAttribute('aria-live', 'polite');
    document.body.append(this.caption);
  }
  actorFor(n) {
    if (!n) return 'player';
    if (n.name) return n.name.split(' ·')[0];
    if (n.cycle) return 'cyclist';
    if (this.audio.world?.zone === 'restaurant')
      return n.audioRole === 'diner' || n.pose === 'eat'
        ? 'diner'
        : this.audio.world.currentRestaurant.id;
    return 'passerby';
  }
  resolve(actor, event, lineId) {
    if (lineId) return VOICE_LINES.find((l) => l.id === lineId);
    let candidates = VOICE_LINES.filter(
      (l) => l.actor.toLowerCase() === actor.toLowerCase() && l.event === event,
    );
    if (!candidates.length && ['hit', 'down', 'recover', 'near_miss'].includes(event))
      candidates = VOICE_LINES.filter((l) => l.actor === 'passerby' && l.event === event);
    const key = actor + ':' + event,
      previous = this.lastLines.get(key);
    const options = candidates.filter((l) => l.id !== previous);
    const line = (options.length ? options : candidates)[
      Math.floor(Math.random() * (options.length || candidates.length))
    ];
    if (line) this.lastLines.set(key, line.id);
    return line;
  }
  async say(actor, event, options = {}) {
    const a = this.audio;
    if (!a.ready || !a.enabled || (!a.active && !options.preview)) return false;
    const line = this.resolve(actor, event, options.id);
    if (!line) return false;
    const priority = options.priority ?? (event === 'ambient' ? 0 : 2),
      now = a.ctx.currentTime;
    const cooldownKey = options.npc?.arcadeId || actor;
    if (!options.force && now < (this.cooldowns.get(cooldownKey) || 0)) return false;
    if (this.current && this.current.priority >= priority && !options.force) return false;
    this.stop(false);
    const token = ++this.token;
    this.current = { line, priority, preview: !!options.preview, loading: true, ends: now + 15 };
    const buffer = await a.bank.get('voice_' + line.id);
    if (token !== this.token || !a.enabled || (!a.active && !options.preview)) return false;
    const pos = options.npc?.mesh.position || options.position;
    const duration = buffer?.duration || line.duration || Math.max(3, line.text.length / 13);
    const follow = options.npc
      ? () => ({ x: options.npc.mesh.position.x, y: 1.55, z: options.npc.mesh.position.z })
      : undefined;
    const h = buffer
      ? a.emit(buffer, {
          bus: 'dialogue',
          volume: options.ambient ? 0.65 : 0.94,
          position: pos ? { x: pos.x ?? pos[0], y: 1.55, z: pos.z ?? pos[2] } : undefined,
          follow,
          refDistance: options.ambient ? 2 : 3,
          lowpass: options.ambient ? 6200 : 16000,
        })
      : null;
    this.current = {
      line,
      priority,
      preview: !!options.preview,
      handle: h,
      ends: a.ctx.currentTime + duration,
      loading: false,
    };
    this.cooldowns.set(cooldownKey, a.ctx.currentTime + duration + (options.ambient ? 25 : 2));
    this.heard.add(line.id);
    this.mount();
    const slot =
      document.getElementById('audio-preview-slot') ||
      document.getElementById('dialogue-voice-slot');
    this.caption.classList.toggle('inline', !!slot);
    (slot || document.body).append(this.caption);
    this.caption.innerHTML = `<span class="voice-speaker">${esc(names[actor] || actor)}${options.ambient ? '<i>in der Nähe</i>' : ''}</span><span class="voice-text">${esc(line.text)}</span>`;
    this.caption.hidden = a.sim?.s.audioSubtitles === false;
    return true;
  }
  npc(n, event, options = {}) {
    return this.say(this.actorFor(n), event, { npc: n, ...options });
  }
  stop(clearQueue = true) {
    this.token++;
    this.current?.handle?.stop(0.06);
    this.current = null;
    if (clearQueue) {
      this.queue = [];
      this.arrival = null;
    }
    if (this.caption) this.caption.hidden = true;
  }
  sequence(lines) {
    this.stop();
    this.queue = lines;
    this.tick();
  }
  tick() {
    const now = this.audio.ctx?.currentTime || 0;
    if (this.current && now > this.current.ends) this.stop(false);
    if (!this.current && this.queue.length) {
      const next = this.queue.shift();
      this.say(next.actor, next.event || 'greet', { ...next, force: true, priority: 4 });
    }
    if (this.caption && this.current)
      this.caption.hidden = this.audio.sim?.s.audioSubtitles === false || !this.audio.enabled;
  }
  arrive(world) {
    const actor =
      world.zone === 'restaurant'
        ? world.currentRestaurant.id
        : world.zone === 'office'
          ? 'player'
          : null;
    if (actor) this.arrival = { actor, time: this.audio.time + 1.2 };
  }
  update(dt, world) {
    const t = this.audio.time;
    if (this.arrival && t >= this.arrival.time) {
      const actor = this.arrival.actor;
      this.arrival = null;
      const npc = world.zone === 'restaurant' ? world.zoneData.restaurant.npcs[0] : undefined;
      this.say(actor, 'greet', { npc });
    }
    if (
      this.current ||
      t < this.nextAmbient ||
      world.gameplay?.vehicle ||
      world.gameplay?.game.modal ||
      world.gameplay?.game.busy
    )
      return;
    this.nextAmbient = t + 13 + Math.random() * 12;
    const p = world.player.position;
    const candidates = world.zoneData[world.zone].npcs.filter(
      (n) =>
        !n.down &&
        Math.hypot(n.mesh.position.x - p.x, n.mesh.position.z - p.z) < 10 &&
        this.audible(n.mesh.position),
    );
    candidates.sort(
      (a, b) => a.mesh.position.distanceToSquared(p) - b.mesh.position.distanceToSquared(p),
    );
    if (!candidates.length) return;
    const n = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
    const actor = this.actorFor(n);
    const event =
      world.sim.s.weather === 'Regen' && actor === 'passerby'
        ? 'rain'
        : VOICE_LINES.some((l) => l.actor === actor && l.event === 'greet' && this.heard.has(l.id))
          ? 'ambient'
          : 'greet';
    this.npc(n, this.resolve(actor, event) ? event : 'ambient', { ambient: true, priority: 0 });
  }
  audible(pos) {
    const world = this.audio.world,
      p = world.player.position;
    // Sample standing-height rays through collision boxes; desks don't block speech.
    for (const body of world.zoneData[world.zone].physics.bodies) {
      if (body.mass || Math.abs(body.position.y - 1.5) > 2.5) continue;
      for (const shape of body.shapes) {
        const e = shape.halfExtents;
        if (!e || body.position.y + e.y < 1.5 || body.position.y - e.y > 1.5) continue;
        const yaw = 2 * Math.atan2(body.quaternion.y, body.quaternion.w),
          c = Math.cos(yaw),
          s = Math.sin(yaw);
        for (let f = 0.1; f < 1; f += 0.1) {
          const x = p.x + (pos.x - p.x) * f - body.position.x,
            z = p.z + (pos.z - p.z) * f - body.position.z;
          if (Math.abs(x * c - z * s) < e.x && Math.abs(x * s + z * c) < e.z) return false;
        }
      }
    }
    return true;
  }
  nearMiss() {
    const w = this.audio.world;
    if (!w || w.zone !== 'city') return;
    const n = w.zoneData.city.npcs.find(
      (n) => !n.down && n.mesh.position.distanceTo(w.player.position) < 9,
    );
    if (n) this.npc(n, 'near_miss');
  }
  openConversation(game, fullName) {
    const actor = fullName.split(' ·')[0],
      stem = actor.toLowerCase();
    const npc = game.world.zoneData.office.npcs.find((n) => n.name === fullName);
    const greeting = this.resolve(actor, 'greet');
    game.open(
      `${actor} · BBE Handelsberatung`,
      `<section class="dialogue-card"><div class="dialogue-person"><div class="dialogue-avatar">${esc(actor[0])}</div><div><span class="eyebrow">BBE HANDELSBERATUNG</span><h2>${esc(actor)}</h2><p>${esc(roles[actor] || 'Team')}</p></div><span class="dialogue-badge">IM GESPRÄCH</span></div><blockquote id="dialogue-answer">${esc(greeting.text)}</blockquote><div id="dialogue-voice-slot"></div><p class="dialogue-question">Was liegt an?</p><div class="dialogue-choices">${[
        ['work', 'Zum aktuellen Auftrag', 'Eine klare Frage spart drei Abstimmungen.'],
        ['coffee', 'Zeit für eine Kaffeepause?', 'Networking mit Crema.'],
        ['success', 'Die Folie kam gut an.', 'Erfolg darf kurz ausgesprochen werden.'],
        ['failure', 'Die Zahlen passen nicht.', 'Lieber jetzt fragen als später erklären.'],
      ]
        .map(
          ([key, title, sub]) =>
            `<button data-dialogue="${key}"><strong>${title}</strong><small>${sub}</small><span>↗</span></button>`,
        )
        .join(
          '',
        )}</div><div class="toolbar"><button id="dialogue-followup">Und was ist dein bester Rat?</button><button class="primary" id="colleague-thanks">Danke. Ich mache es managementtauglich.</button></div></section>`,
      { onClose: () => this.stop() },
    );
    this.say(actor, 'greet', { npc, force: true, priority: 4 });
    document.querySelectorAll('[data-dialogue]').forEach(
      (button) =>
        (button.onclick = () => {
          const topic = button.dataset.dialogue;
          const answer = VOICE_LINES.find((l) => l.id === `${stem}_dialog_${topic}`);
          document.getElementById('dialogue-answer').textContent = answer.text;
          document
            .querySelectorAll('[data-dialogue]')
            .forEach((b) => b.classList.toggle('selected', b === button));
          this.sequence([
            { actor: 'player', id: 'player_ask_' + topic },
            { actor, id: answer.id, npc },
          ]);
        }),
    );
    document.getElementById('dialogue-followup').onclick = () => {
      const line = VOICE_LINES.find((l) => l.id === `${stem}_dialog_followup`);
      document.getElementById('dialogue-answer').textContent = line.text;
      this.sequence([{ actor, id: line.id, npc }]);
    };
    document.getElementById('colleague-thanks').onclick = () => {
      game.sim.change('happy', 3);
      game.close();
      this.say(actor, 'greet', { id: `${stem}_dialog_goodbye`, npc, force: true, priority: 4 });
    };
  }
}
