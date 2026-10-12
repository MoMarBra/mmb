import { CookingRound } from './origin-state.js';
import { ORIGIN_LINES } from './origin-lines.js';
import { measuredVoiceLine } from './voice-timing.js';
import { FOOD_ART } from './food-art.js';
import { QuickWokView, insideWok } from './quick-wok-view.js';
const $ = (id) => document.getElementById(id);
const INGREDIENT_ART = {
  Huhn: 'chicken',
  Gemüse: 'vegetables',
  Currypaste: 'curry',
  Garnelen: 'shrimp',
  Reisbandnudeln: 'noodles',
  Tofu: 'tofu',
  'Bambus + Morcheln': 'mushrooms',
  Paprika: 'pepper',
  Ente: 'duck',
};
export class OriginCooking {
  constructor(story) {
    this.story = story;
    this.g = story.g;
    this.w = story.w;
    this.current = null;
    this.token = 0;
    this.voiceToken = 0;
    this.keys = new Set();
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.current) return;
        this.g.audio.unlockOnInput?.(e);
        if (this.current.paused && e.code === 'Tab') {
          e.preventDefault();
          e.stopImmediatePropagation();
          $('cook-resume').focus?.();
          return;
        }
        if (e.code === 'Tab') return;
        if (
          e.code === 'Space' &&
          e.target?.tagName === 'BUTTON' &&
          (this.current.paused || this.current.round.phase === 'failed')
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat && !e.target.disabled) e.target.click?.();
          return;
        }
        if (e.code === 'Enter' && e.target?.tagName === 'BUTTON') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.code === 'Escape' && !e.repeat) this.pause(!this.current.paused);
        if (this.current.paused) return;
        if (e.code === 'Space') this.keys.add('Space');
        if (!e.repeat && /^Digit[123]$/.test(e.code)) this.choose(Number(e.code.at(-1)) - 1);
      },
      true,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.pause(true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(true);
    });
  }
  async start(level) {
    if (this.current || this.loading) return;
    this.loading = true;
    const token = ++this.token;
    this.pendingPaused = document.hidden;
    try {
      this.g.open(
        'Zitronengras',
        '<div class="wok-loading" aria-label="Küche wird vorbereitet"></div>',
        { pause: true, locked: true },
      );
      this.g.audio.update(0, this.w, false);
      await this.g.audio.bank?.preload([
        'origin_wok_sizzle_1_7_0',
        'origin_wok_toss_1_7_0',
        'origin_sauce_pour_1_7_0',
        'chop',
        'pot_01',
      ]);
      if (token !== this.token) return;
      this.current = {
        round: new CookingRound(level),
        elapsed: 0,
        paused: document.hidden || this.pendingPaused,
        stir: false,
        drops: [],
        resultTime: 0,
        voice: null,
        voiceQueue: [],
        resultVoiceQueued: false,
        resultVoiceDone: false,
      };
      this.loading = false;
      this.keys.clear();
      this.story.stopVoice();
      this.g.audio.voices.stop();
      this.g.arcade.music.current?.handle?.gain?.gain?.setTargetAtTime(
        0,
        this.g.audio.ctx?.currentTime || 0,
        0.08,
      );
      document.body.classList.add('story-cinematic', 'origin-cooking');
      const r = this.current.round;
      $('modal-root').innerHTML =
        `<section class="quick-wok" role="dialog" aria-modal="true" aria-label="Zitronengras – Kochrunde"><div class="wok-stage" id="wok-stage"><canvas id="wok-canvas" aria-hidden="true"></canvas><header class="wok-heading"><small>ZITRONENGRAS <span>• QUICK WOK</span></small><h1>${r.recipe.name}</h1><div class="wok-rounds" aria-label="Runde ${r.level + 1} von 4">${[0, 1, 2, 3].map((i) => `<i class="${i < r.level ? 'complete' : i === r.level ? 'current' : ''}">${i < r.level ? '✓' : i + 1}</i>`).join('')}</div></header><div class="wok-actions"><button id="cook-pause" aria-label="Pause">Ⅱ</button><button id="cook-leave" aria-label="Kochrunde verlassen">×</button></div><div class="wok-trays">${r.recipe.ingredients.map((name, i) => `<button class="wok-tray" id="cook-pick-${i}" aria-label="${name} in den Wok geben"><span class="wok-food">${FOOD_ART[INGREDIENT_ART[name]]}</span><span class="wok-food-name">${name === 'Huhn' ? 'Hähnchen' : name === 'Reisbandnudeln' ? 'Nudeln' : name}<kbd>${i + 1}</kbd></span><span class="wok-check" aria-hidden="true">✓</span></button>`).join('')}</div><div class="wok-hint" id="cook-hint" role="status">Zutaten in den Wok ziehen</div><div class="wok-meter"><span id="cook-time"></span><div><i id="cook-doneness"></i></div></div><button class="wok-stir" id="cook-stir" disabled><kbd>LEERTASTE</kbd><span>Rühren halten</span></button><div class="wok-result" id="cook-result" hidden><span class="wok-stars" id="cook-stars">✦ ✦ ✦</span><strong id="cook-score"></strong><small id="cook-reward"></small><button id="cook-retry" hidden>Neu versuchen</button></div><div class="origin-paused" id="cook-paused" hidden><b>PAUSE</b><button id="cook-resume">Weiterkochen</button></div></div><div id="cook-dialogue" class="wok-dialogue" role="status" aria-live="polite" aria-atomic="true" hidden><b id="cook-speaker"></b><p id="cook-line"></p></div><div id="wok-ghost" class="wok-ghost" hidden aria-hidden="true"></div></section>`;
      this.view = new QuickWokView($('wok-canvas'));
      for (let i = 0; i < 3; i++) this.bindIngredient($('cook-pick-' + i), i);
      const stir = $('cook-stir');
      stir.onpointerdown = (e) => {
        if (this.current?.paused || this.current?.round.phase !== 'sear' || e.button > 0) return;
        e.preventDefault();
        stir.setPointerCapture?.(e.pointerId);
        this.current.stir = true;
      };
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        stir.addEventListener(event, () => {
          if (this.current) this.current.stir = false;
        });
      $('cook-pause').onclick = () => this.pause(!this.current?.paused);
      $('cook-resume').onclick = () => this.pause(false);
      $('cook-leave').onclick = () => this.finish(false);
      $('cook-retry').onclick = () => {
        const level = this.current?.round.level;
        this.finish(false);
        this.start(level);
      };
      this.queueVoice('support');
      this.sync();
      this.render(0);
      $('cook-paused').hidden = !this.current.paused;
    } catch (error) {
      if (token !== this.token) return;
      this.clearDrag();
      this.current?.loop?.stop(0.1);
      this.stopVoice();
      this.current = null;
      this.loading = false;
      this.view = null;
      this.keys.clear();
      this.story.stopVoice();
      document.body.classList.remove('story-cinematic', 'origin-cooking');
      if (this.g.modal) this.g.modal.locked = false;
      this.g.close();
      this.g.toast('Die Küche konnte nicht geladen werden.', 'E · Am Wok erneut versuchen.');
      console.error('Cooking preparation', error);
    }
  }
  bindIngredient(button, index) {
    button.onpointerdown = (e) => {
      const m = this.current;
      if (
        !m ||
        m.paused ||
        m.round.phase !== 'prep' ||
        m.round.added.includes(this.options()[index]) ||
        this.drag ||
        e.button > 0
      )
        return;
      e.preventDefault();
      button.setPointerCapture?.(e.pointerId);
      this.drag = { index, pointerId: e.pointerId, button };
      button.classList.add('dragging');
      const ghost = $('wok-ghost');
      ghost.innerHTML = FOOD_ART[INGREDIENT_ART[this.options()[index]]];
      ghost.hidden = false;
      this.moveDrag(e);
    };
    button.onpointermove = (e) => this.moveDrag(e);
    button.onpointerup = (e) => {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      const rect = $('wok-canvas').getBoundingClientRect(),
        hit = insideWok(e.clientX, e.clientY, rect),
        i = this.drag.index;
      this.clearDrag();
      if (hit) this.choose(i);
    };
    for (const event of ['pointercancel', 'lostpointercapture'])
      button.addEventListener(event, (e) => {
        if (e.pointerId === this.drag?.pointerId) this.clearDrag();
      });
    // Enter, assistive technology and keyboard-generated click remain usable; physical clicks must drag.
    button.onclick = (e) => {
      if (e.detail === 0) this.choose(index);
    };
  }
  moveDrag(e) {
    if (!this.drag || this.drag.pointerId !== e.pointerId) return;
    $('wok-ghost').style.transform =
      `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-60%) rotate(-8deg)`;
    const hit = insideWok(e.clientX, e.clientY, $('wok-canvas').getBoundingClientRect());
    if (this.current) this.current.hover = hit;
  }
  clearDrag() {
    const d = this.drag;
    this.drag = null;
    d?.button.classList.remove('dragging');
    if (d)
      try {
        d.button.releasePointerCapture?.(d.pointerId);
      } catch {}
    if ($('wok-ghost')) $('wok-ghost').hidden = true;
    if (this.current) this.current.hover = false;
  }
  options() {
    return this.current?.round.recipe.ingredients || [];
  }
  choose(index) {
    const m = this.current;
    if (!m || m.paused) return;
    if (m.round.select(this.options()[index])) {
      this.effect(index === 2 ? 'origin_sauce_pour_1_7_0' : 'chop', 0.4);
      m.drops.push({ index, age: 0 });
      this.sync();
    }
  }
  effect(id, volume) {
    this.g.audio.emit?.(this.g.audio.bank?.buffers?.get(id), { bus: 'ui', volume });
  }
  voiceTime() {
    return (globalThis.performance?.now?.() ?? Date.now()) / 1000;
  }
  queueVoice(kind) {
    const m = this.current;
    if (!m) return;
    const line = ORIGIN_LINES.find((entry) => entry.key === `shift${m.round.level + 1}_${kind}`);
    if (line) m.voiceQueue.push({ line, kind });
    else if (kind !== 'support') m.resultVoiceDone = true;
  }
  startVoice(entry) {
    const m = this.current;
    if (!m || m.paused) return;
    const line = measuredVoiceLine(entry.line, this.g.audio.bank);
    const voice = { ...entry, line, duration: line.duration, offset: 0, elapsed: 0,
      lastTick: this.voiceTime(), status: 'loading', handle: null };
    m.voice = voice;
    $('cook-speaker').textContent = line.speaker;
    $('cook-line').textContent = line.text;
    this.loadVoice(voice);
  }
  async loadVoice(voice) {
    const m = this.current, audio = this.g.audio, token = ++this.voiceToken;
    if (!m || m.voice !== voice || m.paused) return;
    voice.status = 'loading';
    const canLoad = audio.ready && audio.enabled && !voice.muted;
    if (!canLoad) {
      voice.muted = true;
      voice.status = 'silent';
      return;
    }
    let buffer;
    try {
      buffer = audio.bank?.buffers?.get(voice.line.asset) ||
        await audio.bank?.get(voice.line.asset, { priority: true });
    } catch { /* The existing caption is the bounded fallback. */ }
    if (token !== this.voiceToken || this.current !== m || m.voice !== voice || m.paused) return;
    const measured = buffer?.duration;
    if (Number.isFinite(measured) && measured > 0) voice.duration = measured;
    voice.offset = Math.min(voice.offset, voice.duration);
    if (buffer && audio.enabled && !voice.muted && voice.offset < voice.duration) {
      try {
        voice.handle = audio.emit(buffer, { bus: 'dialogue', volume: 0.93, offset: voice.offset });
      } catch { /* A closed/unavailable context keeps the caption fallback. */ }
      if (voice.handle) {
        voice.elapsed = 0;
        voice.lastTick = this.voiceTime();
      }
    }
    voice.status = voice.handle ? 'playing' : 'silent';
  }
  stopVoice(clearQueue = true) {
    this.voiceToken++;
    const m = this.current;
    m?.voice?.handle?.stop(0);
    if (m) {
      m.voice = null;
      if (clearQueue) m.voiceQueue = [];
    }
    if ($('cook-dialogue')) $('cook-dialogue').hidden = true;
    this.g.audio.cinematicVoice = false;
  }
  pauseVoice() {
    const voice = this.current?.voice;
    if (!voice) return;
    this.voiceToken++;
    voice.pausedStatus = voice.status;
    voice.elapsed += Math.max(0, this.voiceTime() - voice.lastTick);
    if (voice.handle) {
      voice.offset = Math.min(voice.duration, voice.offset +
        Math.max(0, this.g.audio.ctx.currentTime - voice.handle.startedAt));
      voice.elapsed = 0;
      voice.handle.stop(0);
      voice.handle = null;
    }
    voice.status = 'paused';
  }
  resumeVoice() {
    const voice = this.current?.voice;
    if (!voice || voice.status !== 'paused') return;
    voice.lastTick = this.voiceTime();
    if (voice.pausedStatus === 'silent') voice.status = 'silent';
    else this.loadVoice(voice);
  }
  updateVoice() {
    const m = this.current;
    if (!m) return;
    if (!m.paused && !m.voice && m.voiceQueue.length) this.startVoice(m.voiceQueue.shift());
    const voice = m.voice, audio = this.g.audio;
    if (voice && !m.paused) {
      const now = this.voiceTime();
      if (!audio.enabled && ['playing', 'loading'].includes(voice.status)) {
        this.voiceToken++;
        if (voice.handle) {
          voice.offset = Math.min(voice.duration, voice.offset +
            Math.max(0, audio.ctx.currentTime - voice.handle.startedAt));
          voice.handle.stop(0);
          voice.handle = null;
          voice.elapsed = 0;
          voice.lastTick = now;
        }
        voice.muted = true;
        voice.status = 'silent';
      }
      voice.elapsed += Math.max(0, now - voice.lastTick);
      voice.lastTick = now;
      const remaining = Math.max(0, voice.duration - voice.offset);
      // Audio completion owns live recordings, even through context interruptions.
      // Missing/muted/loading lines use a bounded, pause-aware caption clock.
      const finished = voice.status === 'playing'
        ? voice.handle.ended || voice.handle.stopped
        : voice.elapsed >= (voice.status === 'loading' ? Math.max(3, remaining) : remaining);
      if (finished) {
        if (voice.kind !== 'support') m.resultVoiceDone = true;
        this.stopVoice(false);
      }
    }
    audio.cinematicVoice = !!m.voice && !m.paused;
    $('cook-dialogue').hidden = !m.voice || m.paused || this.g.sim.s.audioSubtitles === false;
  }
  pause(value) {
    if (this.loading) {
      this.pendingPaused = value;
      return;
    }
    const m = this.current;
    if (!m || m.paused === value) return;
    m.paused = value;
    if (value) this.pauseVoice();
    else this.resumeVoice();
    this.updateVoice();
    m.stir = false;
    this.keys.clear();
    this.clearDrag();
    m.loop?.stop(0.1);
    m.loop = null;
    if (value) this.story.stopVoice();
    $('cook-paused').hidden = !value;
    $('cook-pause').setAttribute('aria-label', value ? 'Fortsetzen' : 'Pause');
    if (value) $('cook-resume').focus?.();
    else (this.current.round.phase === 'sear' ? $('cook-stir') : $('cook-pause')).focus?.();
  }
  sync() {
    const m = this.current;
    if (!m) return;
    const r = m.round;
    this.options().forEach((name, i) => {
      const b = $('cook-pick-' + i);
      b.disabled = r.added.includes(name);
      b.classList.toggle('used', b.disabled);
    });
    $('cook-stir').disabled = r.phase !== 'sear';
    $('cook-hint').textContent = {
      prep: 'Zutaten in den Wok ziehen',
      sear: 'Leertaste halten',
      serve: 'Service!',
      done: '',
      failed: 'Neue Pfanne. Neues Glück.',
    }[r.phase];
    if (['done', 'failed'].includes(r.phase)) {
      if (!m.resultVoiceQueued) {
        m.resultVoiceQueued = true;
        this.queueVoice(r.passed ? 'success' : 'fail');
      }
      m.loop?.stop(0.12);
      m.loop = null;
      $('cook-result').hidden = false;
      $('cook-score').textContent = r.passed ? Math.round(r.score) + ' / 100' : 'Knapp daneben';
      $('cook-stars').textContent = r.passed
        ? r.score >= 95
          ? '✦ ✦ ✦'
          : r.score >= 80
            ? '✦ ✦'
            : '✦'
        : '↻';
      $('cook-reward').textContent = r.passed
        ? this.story.active && !this.story.state.paid[r.level]
          ? '+' + r.recipe.reward + ' €'
          : 'Training geschafft'
        : '';
      $('cook-retry').hidden = r.passed;
      if (!r.passed) $('cook-retry').focus?.();
    }
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    const r = m.round,
      stir = !m.paused && (m.stir || this.keys.has('Space'));
    this.updateVoice();
    if (!m.paused) {
      m.elapsed += dt;
      m.drops.forEach((d) => (d.age += dt));
      m.drops = m.drops.filter((d) => d.age < 0.6);
      const old = r.phase;
      r.tick(dt, stir);
      if (old !== r.phase) {
        this.sync();
        if (r.phase === 'serve') this.effect('pot_01', 0.5);
      }
      if (r.phase === 'sear') {
        if (!m.loop)
          m.loop = this.g.audio.emit?.(this.g.audio.bank?.buffers?.get('origin_wok_sizzle_1_7_0'), {
            bus: 'ui',
            volume: 0.4,
            loop: true,
            fade: 0.15,
          });
        if (stir && m.elapsed > (m.nextToss || 0)) {
          this.effect('origin_wok_toss_1_7_0', 0.28);
          m.nextToss = m.elapsed + 1.3;
        }
      }
      if (r.phase === 'done' && r.passed) {
        m.resultTime += dt;
        if (m.resultTime >= 1.25 && m.resultVoiceDone && !m.voice && !m.voiceQueue.length) {
          this.finish(true);
          return;
        }
      }
    }
    $('cook-stir').classList.toggle('stirring', stir && r.phase === 'sear');
    $('cook-doneness').style.width = r.cooked + '%';
    $('cook-time').textContent =
      r.step && !['done', 'failed'].includes(r.phase)
        ? Math.max(0, Math.ceil(r.deadline - r.elapsed)) + 's'
        : '';
    $('cook-hint').classList.toggle('wok-warning', r.phase === 'sear' && r.dry > 1.5);
    if (r.phase === 'sear')
      $('cook-hint').textContent = r.dry > 1.5 ? 'Rühren!' : 'Leertaste halten';
    this.view.draw(m, stir);
  }
  finish(pass) {
    const m = this.current;
    if (!m) return;
    this.clearDrag();
    this.stopVoice();
    this.current = null;
    this.view = null;
    this.keys.clear();
    m.loop?.stop(0.1);
    this.story.stopVoice();
    document.body.classList.remove('story-cinematic', 'origin-cooking');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    if (pass && m.round.passed) this.story.shiftComplete(m.round);
  }
}
