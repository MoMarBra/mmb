import { BlastEngine, freshBlast, normalizeBlast, recordBlastResult } from './blast-state.js';
import { BLAST_LEVELS, BLAST_BOARD } from './blast-levels.js';
import { BlastAudio } from './blast-audio.js';

const W = 720,
  H = 760;
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const number = (n) => Math.round(n || 0).toLocaleString('de-DE');
const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
const colors = {
  orange: '#ffab52',
  blue: '#64c9ff',
  green: '#72ffca',
  purple: '#c5a0ff',
  gold: '#ffe09a',
};

// Board silhouettes use the real level positions; decorative and generated only on selection.
const preview = (level) =>
  '<svg class="blast-level-preview" viewBox="28 120 664 540" aria-hidden="true" focusable="false">' +
  level.pegs
    .map(
      (peg) =>
        '<circle cx="' + peg.x + '" cy="' + peg.y + '" r="15" fill="' + colors[peg.kind] + '"/>',
    )
    .join('') +
  '</svg>';

/** A paused-world arcade cabinet: one canvas, one owned sound layer, no private RAF. */
export class BBEBlast {
  constructor(game) {
    this.g = game;
    this.current = null;
    this.audio = new BlastAudio(game.audio);
    this.keys = new Set();
    this.reducedMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
    window.addEventListener('keydown', (e) => this.key(e), true);
    window.addEventListener(
      'keyup',
      (e) => {
        if (this.active) {
          this.keys.delete(e.code);
          if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }
      },
      true,
    );
    window.addEventListener('blur', () => {
      if (this.active) this.pause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (this.active && document.hidden) this.pause(true);
    });
  }
  get active() {
    return !!this.current;
  }
  get save() {
    return normalizeBlast(this.g.sim.s.bbeBlast || freshBlast());
  }
  open() {
    if (this.active || this.g.cinematic || this.g.busy || !this.g.started) return false;
    this.current = {
      engine: null,
      mode: 'levels',
      paused: false,
      angle: 0,
      particles: [],
      rings: [],
      popups: [],
      trail: [],
      clock: 0,
      fever: 0,
      paid: false,
      keys: this.keys,
    };
    this.g.open('BBE Blast', '', { pause: true, locked: true, onClose: () => this.cleanup() });
    document.body.classList.add('bbe-blast-open');
    this.g.audio.voices?.stop();
    this.audio.start();
    this.shell();
    this.showLevels();
    return true;
  }
  shell() {
    $('modal-root').innerHTML =
      `<section class="blast-app" role="dialog" aria-modal="true" aria-label="BBE Blast"><header class="blast-header"><div class="blast-logo"><span>BBE</span><b>BLAST<span>✦</span></b></div><div class="blast-top"><span id="blast-level-label">ARCADE · OFFICE EDITION</span><button id="blast-sound" aria-label="Arcade-Ton umschalten">♫</button><button id="blast-pause" aria-label="Spiel pausieren">Ⅱ</button><button id="blast-exit" aria-label="BBE Blast schließen">×</button></div></header><div class="blast-game"><div class="blast-scorebar"><div><small>PUNKTE</small><b id="blast-score">0</b></div><div id="blast-combo" aria-live="polite"></div><div><small>ORANGE</small><b id="blast-targets">—</b></div><div><small>BÄLLE</small><b id="blast-balls">—</b></div></div><div class="blast-stage"><canvas id="blast-canvas" width="720" height="760" tabindex="0" aria-label="BBE Blast Spielfeld. Mit links und rechts zielen und mit Leertaste schießen."></canvas><div id="blast-fever" class="blast-fever" hidden><small>ALLE ORANGEN GETROFFEN</small><b>BIG<br>BBE ENERGY.</b></div><div id="blast-entry" class="blast-entry">BUSINESS. BUT BOUNCY.</div></div><footer class="blast-footer"><span id="blast-hint">Zielen · Klicken oder Leertaste</span><button id="blast-levels-button">10 LEVELS ↗</button></footer></div><section id="blast-panel" class="blast-panel" hidden></section></section>`;
    this.canvas = $('blast-canvas');
    this.canvasWidth = null;
    this.canvasHeight = null;
    this.ctx = this.canvas.getContext('2d');
    this.pegGradients = new Map();
    this.hudKey = null;
    $('blast-pause').onclick = () => this.pause(!this.current?.paused);
    $('blast-exit').onclick = () => this.close();
    $('blast-sound').onclick = () => {
      this.g.audio.toggle();
      this.refresh();
    };
    $('blast-levels-button').onclick = () => this.showLevels(true);
    this.canvas.onpointermove = (e) => {
      if (this.current?.mode === 'play' && !this.current.paused) this.aim(e);
    };
    this.canvas.onpointerdown = (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      this.canvas.focus();
      this.canvas.setPointerCapture?.(e.pointerId);
      this.aim(e);
      this.dragging = true;
    };
    this.canvas.onpointerup = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.aim(e);
      this.shoot();
    };
    this.canvas.onpointercancel = () => {
      this.dragging = false;
    };
    this.refresh();
  }
  levelProgress(index) {
    const s = this.save;
    const entry = s.bests?.[index] || {};
    return {
      unlocked: index === 0 || index < (s.unlocked || s.unlockedLevels || 1),
      score: entry.score || entry.bestScore || s.highscores?.[index] || 0,
      stars: entry.stars || s.stars?.[index] || 0,
    };
  }
  showLevels(confirm = false) {
    const c = this.current;
    if (!c) return;
    if (confirm && c.mode === 'play' && c.engine && !['won', 'lost'].includes(c.engine.phase)) {
      this.pause(true);
      $('blast-panel').innerHTML =
        '<small>RUNDE VERLASSEN?</small><h2>Neuer Spielplan.</h2><p>Diese laufende Runde wird nicht gespeichert.</p><button class="blast-primary" id="blast-keep">Weiterspielen</button><button id="blast-confirm-levels">Level auswählen</button>';
      $('blast-keep').onclick = () => this.pause(false);
      $('blast-confirm-levels').onclick = () => this.showLevels();
      return;
    }
    c.mode = 'levels';
    c.paused = false;
    this.keys.clear();
    this.audio.pause(true);
    $('blast-panel').hidden = false;
    $('blast-panel').innerHTML =
      `<div class="blast-select"><div class="blast-select-heading"><small>DEINE NÄCHSTE KLEINE ESKALATION</small><h1>Weniger Folien.<br>Mehr Treffer.</h1><p>Orange abräumen. Grün löst den Blast aus.</p></div><div class="blast-level-grid">${BLAST_LEVELS.map(
        (level, i) => {
          const p = this.levelProgress(i);
          return `<button class="blast-level" data-blast-level="${i}" ${p.unlocked ? '' : 'disabled'}><span>${String(i + 1).padStart(2, '0')}</span>${preview(level)}<b>${esc(level.title)}</b><i aria-label="${p.stars} von 3 Sternen">${p.unlocked ? stars(p.stars) : 'GESPERRT'}</i><small>${p.score ? number(p.score) + ' BEST' : '—'}</small></button>`;
        },
      ).join(
        '',
      )}</div><span class="blast-select-note">← → zielen · Leertaste schießen · Orange zählt.</span></div>`;
    document.querySelectorAll('[data-blast-level]').forEach((el) => {
      el.onclick = () => this.startLevel(Number(el.dataset.blastLevel));
    });
    document.querySelector('#blast-panel button:not(:disabled)')?.focus();
    this.refresh();
  }
  startLevel(index) {
    if (
      !this.current ||
      !Number.isInteger(index) ||
      !this.levelProgress(index).unlocked ||
      !BLAST_LEVELS[index]
    )
      return false;
    const c = this.current;
    c.engine = new BlastEngine(index);
    c.mode = 'play';
    c.paused = false;
    c.angle = 0;
    c.particles = [];
    c.rings = [];
    c.popups = [];
    c.trail = [];
    c.fever = 0;
    c.paid = false;
    c.victory = null;
    c.resultWait = 0;
    c.entryAt = c.clock;
    c.aimPath = null;
    c.pathKey = null;
    this.keys.clear();
    this.pegGradients.clear();
    $('blast-panel').hidden = true;
    $('blast-entry').hidden = false;
    this.audio.pause(false);
    this.canvas.focus();
    this.refresh();
    return true;
  }
  aim(e) {
    const c = this.current;
    if (!c || c.paused || c.mode !== 'play') return;
    const rect = this.canvas.getBoundingClientRect(),
      x = ((e.clientX - rect.left) / rect.width) * W,
      y = ((e.clientY - rect.top) / rect.height) * H;
    c.angle = clamp(Math.atan2(x - W / 2, Math.max(18, y - BLAST_BOARD.launcher.y)), -1.25, 1.25);
  }
  shoot() {
    const c = this.current;
    if (!c || c.paused || c.mode !== 'play' || !c.engine) return false;
    return c.engine.shoot(c.angle);
  }
  pause(value = true) {
    const c = this.current;
    if (!c || c.mode !== 'play' || c.paused === value) return;
    c.paused = value;
    this.keys.clear();
    this.dragging = false;
    this.audio.pause(value);
    $('blast-panel').hidden = !value;
    if (value) {
      $('blast-panel').innerHTML =
        '<div class="blast-pause-card"><small>KEIN MEETING. NUR PAUSE.</small><h2>Kurz durchatmen.</h2><button class="blast-primary" id="blast-resume">Weiterspielen</button><button id="blast-retry">Level neu starten</button><button id="blast-back">Levelauswahl</button><button id="blast-leave">Zurück ins Büro</button></div>';
      $('blast-resume').onclick = () => this.pause(false);
      $('blast-retry').onclick = () => this.startLevel(c.engine.levelIndex);
      $('blast-back').onclick = () => this.showLevels();
      $('blast-leave').onclick = () => this.close();
      $('blast-resume').focus();
    } else this.canvas.focus();
    this.refresh();
  }
  key(e) {
    if (!this.active) return;
    if (e.code === 'Tab') {
      this.g.trapFocus?.(e);
      e.stopImmediatePropagation();
      return;
    }
    if (['Escape', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter'].includes(e.code)) {
      if (['Space', 'Enter'].includes(e.code) && e.target?.tagName === 'BUTTON') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        if (!e.repeat) this.pause(!this.current.paused);
        return;
      }
      if (this.current.mode !== 'play' || this.current.paused) return;
      this.keys.add(e.code);
      if (['Space', 'Enter'].includes(e.code) && !e.repeat) this.shoot();
    }
  }
  event(event) {
    const c = this.current;
    this.audio.event(event);
    if (event.type === 'hit') {
      const color = colors[event.kind] || colors.blue;
      const count = this.reducedMotion ? 3 : 12;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        c.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(a) * (65 + i * 8),
          vy: Math.sin(a) * (65 + i * 8),
          life: 0.55,
          max: 0.55,
          color,
        });
      }
      c.rings.push({ x: event.x, y: event.y, r: 10, life: 0.42, max: 0.42, color });
      c.popups.push({
        x: event.x,
        y: event.y,
        text: '+' + number(event.points),
        life: 0.9,
        max: 0.9,
        color,
      });
    }
    if (event.type === 'blast') {
      c.fever = Math.max(c.fever, 0.6);
      c.rings.push({
        x: event.x || W / 2,
        y: event.y || H / 2,
        r: 24,
        life: 0.8,
        max: 0.8,
        color: colors.green,
      });
    }
    if (event.type === 'bonus')
      c.popups.push({
        x: W / 2,
        y: 115,
        text: 'BONUS · +1 BALL',
        life: 1.3,
        max: 1.3,
        color: colors.gold,
      });
    if (event.type === 'catch')
      c.popups.push({
        x: event.x || W / 2,
        y: 695,
        text: 'BALL GERETTET',
        life: 1.3,
        max: 1.3,
        color: colors.green,
      });
    if (event.type === 'win') {
      this.commitVictory();
      c.fever = 1;
      c.resultWait = 1.8;
    }
    if (event.type === 'lose') c.resultWait = 0.6;
    if (event.type === 'shot') c.trail = [];
    c.particles = c.particles.slice(-100);
    c.rings = c.rings.slice(-12);
    c.popups = c.popups.slice(-12);
  }
  update(dt = 0) {
    const c = this.current;
    if (!c) return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    if (document.hidden) {
      this.pause(true);
      return;
    }
    if (!c.paused) {
      c.clock += dt;
      if (c.mode === 'play') {
        const direction =
          (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) -
          (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
        c.angle = clamp(c.angle + direction * dt * 1.25, -1.25, 1.25);
        c.engine.update(dt);
        for (const e of c.engine.drainEvents()) this.event(e);
        if (c.engine.ball) {
          c.trail.push({ x: c.engine.ball.x, y: c.engine.ball.y });
          if (c.trail.length > 14) c.trail.shift();
        } else c.trail = [];
        if (['won', 'lost'].includes(c.engine.phase)) {
          c.resultWait = Math.max(0, (c.resultWait || 0) - dt);
          if (c.resultWait === 0) this.result();
        }
      }
      for (const p of c.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 110 * dt;
      }
      for (const p of c.rings) {
        p.life -= dt;
        p.r += dt * 120;
      }
      for (const p of c.popups) {
        p.life -= dt;
        p.y -= dt * 30;
      }
      c.particles = c.particles.filter((p) => p.life > 0);
      c.rings = c.rings.filter((p) => p.life > 0);
      c.popups = c.popups.filter((p) => p.life > 0);
      c.fever = Math.max(0, c.fever - dt * 0.7);
    }
    this.audio.update(c.paused ? 0 : dt);
    this.resizeCanvas();
    this.refresh();
    this.draw();
  }
  // Commit at the win event, before the celebration can be skipped or the tab reloaded.
  commitVictory() {
    const c = this.current;
    if (!c || c.engine?.phase !== 'won') return null;
    if (c.paid) return c.victory;
    const e = c.engine;
    const earnedStars = e.stars;
    const result = recordBlastResult(this.save, e.levelIndex, {
      score: e.score,
      stars: earnedStars,
    });
    c.paid = true;
    c.victory = {
      reward: result.reward || 0,
      firstClear: !!result.firstClear,
      stars: earnedStars,
    };
    this.g.sim.s.bbeBlast = result.save;
    if (c.victory.reward > 0)
      this.g.sim.transaction(c.victory.reward, 'BBE Blast · ' + BLAST_LEVELS[e.levelIndex].title);
    if (c.victory.firstClear) {
      const previousLevel = this.g.sim.level;
      this.g.sim.s.xp += 12;
      this.g.sim.checkAchievements();
      if (this.g.sim.level > previousLevel)
        this.g.sim.emit('promotion', 'Beförderung: ' + this.g.sim.career.name + '!', {
          level: this.g.sim.level,
          perk: this.g.sim.career.perk,
        });
    }
    this.g.sim.save();
    return c.victory;
  }
  result() {
    const c = this.current;
    if (!c || c.mode !== 'play') return;
    const e = c.engine,
      won = e.phase === 'won';
    const victory = won ? this.commitVictory() : null;
    const reward = victory?.reward || 0;
    const earnedStars = victory?.stars || 0;
    c.mode = 'result';
    c.paused = false;
    $('blast-panel').hidden = false;
    $('blast-panel').innerHTML =
      `<div class="blast-result"><small>${won ? 'BUSINESS CASE: EXPLODIERT.' : 'NOCH EINE KLEINE RUNDE?'}</small><h2>${won ? 'Level cleared.' : 'Fast im Ziel.'}</h2><div class="blast-result-stars">${won ? stars(earnedStars) : '↻'}</div><strong>${number(e.score)}</strong><p>${won ? (reward ? '+' + number(reward) + ' € · +12 XP' : 'Bestleistung gespeichert.') : (e.remaining || 0) + ' orange Ziele übrig.'}</p>${won && e.levelIndex < BLAST_LEVELS.length - 1 ? '<button class="blast-primary" id="blast-next">Nächstes Level ↗</button>' : ''}<button id="blast-again">Noch einmal</button><button id="blast-result-levels">Levelauswahl</button><button id="blast-result-exit">Zurück ins Büro</button></div>`;
    $('blast-next')?.addEventListener('click', () => this.startLevel(e.levelIndex + 1));
    $('blast-again').onclick = () => this.startLevel(e.levelIndex);
    $('blast-result-levels').onclick = () => this.showLevels();
    $('blast-result-exit').onclick = () => this.close();
    document.querySelector('#blast-panel button')?.focus();
  }
  refresh() {
    const c = this.current;
    if (!c) return;
    const e = c.engine;
    const entryVisible = c.mode === 'play' && c.clock - (c.entryAt || 0) <= 0.8;
    const key = [
      c.mode,
      c.paused,
      entryVisible,
      e?.levelIndex,
      e?.score,
      e?.remaining,
      e?.balls,
      e?.combo,
      e?.phase,
      this.g.audio.enabled,
    ].join('|');
    if (key === this.hudKey) return;
    this.hudKey = key;
    $('blast-score').textContent = number(e?.score);
    $('blast-targets').textContent = e?.remaining ?? '—';
    $('blast-balls').textContent = e?.balls ?? '—';
    $('blast-combo').textContent = e?.combo > 1 ? '×' + e.combo + ' COMBO' : '';
    $('blast-level-label').textContent = e
      ? 'LEVEL ' +
        String(e.levelIndex + 1).padStart(2, '0') +
        ' · ' +
        BLAST_LEVELS[e.levelIndex].title
      : 'ARCADE · OFFICE EDITION';
    $('blast-pause').disabled = c.mode !== 'play';
    $('blast-sound').setAttribute('aria-pressed', String(this.g.audio.enabled));
    $('blast-sound').textContent = this.g.audio.enabled ? '♫' : '♪';
    $('blast-entry').hidden = c.mode !== 'play' || c.clock - (c.entryAt || 0) > 0.8;
    $('blast-fever').hidden = !(e?.phase === 'won' && c.mode === 'play');
    $('blast-hint').textContent =
      e?.phase === 'shot'
        ? 'Jeder Abpraller zählt.'
        : c.paused
          ? 'Runde pausiert'
          : '← → zielen · Klicken / Leertaste';
  }
  resizeCanvas() {
    if (!this.canvas) return;
    const stage = this.canvas.parentElement;
    const width = Math.min(stage.clientWidth, (stage.clientHeight * W) / H),
      height = (width * H) / W;
    if (width !== this.canvasWidth || height !== this.canvasHeight) {
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
    }
  }
  draw() {
    const c = this.current,
      ctx = this.ctx;
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#081b35');
    bg.addColorStop(0.55, '#071122');
    bg.addColorStop(1, '#142443');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = '#98c5ef09';
    ctx.lineWidth = 1;
    for (let y = 80; y < H; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let x = 0; x < W; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.font = '900 130px Arial';
    ctx.fillStyle = '#bfe1ff04';
    ctx.textAlign = 'center';
    ctx.fillText('BBE', W / 2, 470);
    ctx.restore();
    const e = c.engine;
    if (!e) return;
    // Stable, clean neon borders; no full-frame flashes or expensive blur passes.
    ctx.strokeStyle = '#83b9d961';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BLAST_BOARD.left, BLAST_BOARD.top);
    ctx.lineTo(BLAST_BOARD.left, H - 45);
    ctx.moveTo(BLAST_BOARD.right, BLAST_BOARD.top);
    ctx.lineTo(BLAST_BOARD.right, H - 45);
    ctx.stroke();
    if (e.phase === 'aim' && c.mode === 'play') {
      const pathKey = Math.round(c.angle * 250) + ':' + e.shots;
      if (c.pathKey !== pathKey && (!c.aimPath || c.clock - c.pathAt >= 0.05)) {
        c.aimPath = e.getAimPath(c.angle) || [];
        c.pathAt = c.clock;
        c.pathKey = pathKey;
      }
      const path = c.aimPath || [];
      ctx.strokeStyle = '#dfeef660';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(BLAST_BOARD.launcher.x, BLAST_BOARD.launcher.y);
    ctx.rotate(-c.angle);
    ctx.fillStyle = '#729db0';
    ctx.fillRect(-10, 4, 20, 37);
    ctx.fillStyle = '#ffe6af';
    ctx.fillRect(-5, 6, 10, 30);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(BLAST_BOARD.launcher.x, BLAST_BOARD.launcher.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#132943';
    ctx.fill();
    ctx.strokeStyle = '#91b3cc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(BLAST_BOARD.launcher.x, BLAST_BOARD.launcher.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();
    for (const peg of e.pegs) {
      const color = colors[peg.kind] || colors.blue;
      ctx.globalAlpha = peg.hit ? 0.22 : 1;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      const key = peg.id + ':' + !!peg.hit;
      let gradient = this.pegGradients.get(key);
      if (!gradient) {
        gradient = ctx.createRadialGradient(
          peg.x - peg.r * 0.3,
          peg.y - peg.r * 0.4,
          1,
          peg.x,
          peg.y,
          peg.r,
        );
        gradient.addColorStop(0, peg.hit ? '#293442' : '#e7f9ff');
        gradient.addColorStop(0.35, color);
        gradient.addColorStop(1, peg.hit ? '#15202f' : '#214361');
        this.pegGradients.set(key, gradient);
      }
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = peg.kind === 'orange' ? 2.3 : 1.3;
      ctx.stroke();
      if (peg.kind === 'green' && !peg.hit) {
        ctx.strokeStyle = '#0c594e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(peg.x - 4, peg.y);
        ctx.lineTo(peg.x + 4, peg.y);
        ctx.moveTo(peg.x, peg.y - 4);
        ctx.lineTo(peg.x, peg.y + 4);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (e.bucket) {
      const b = e.bucket;
      ctx.fillStyle = '#16394d';
      ctx.fillRect(b.x - b.width / 2, b.y, b.width, 18);
      ctx.strokeStyle = '#72ffca';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.width / 2, b.y - 18);
      ctx.lineTo(b.x - b.width / 2, b.y + 17);
      ctx.lineTo(b.x + b.width / 2, b.y + 17);
      ctx.lineTo(b.x + b.width / 2, b.y - 18);
      ctx.stroke();
      ctx.fillStyle = '#90ddc4';
      ctx.font = '700 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('+1 BALL', b.x, b.y + 12);
    }
    if (!this.reducedMotion)
      c.trail.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + (i / c.trail.length) * 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220,241,255,' + (i / c.trail.length) * 0.28 + ')';
        ctx.fill();
      });
    if (e.ball) {
      ctx.beginPath();
      ctx.arc(e.ball.x, e.ball.y, e.ball.r || 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff4d5';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const p of c.particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const p of c.rings) {
      ctx.globalAlpha = p.life / p.max;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '800 18px Arial';
    ctx.textAlign = 'center';
    for (const p of c.popups) {
      ctx.globalAlpha = Math.min(1, p.life / 0.2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    if (c.fever > 0) {
      ctx.strokeStyle = 'rgba(255,185,76,' + c.fever * 0.6 + ')';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, W - 8, H - 8);
    }
  }
  cleanup() {
    if (!this.current) return;
    this.audio.close();
    this.keys.clear();
    this.current = null;
    this.dragging = false;
    document.body.classList.remove('bbe-blast-open');
    this.canvas = null;
    this.ctx = null;
    this.g.world.keys.clear();
  }
  close() {
    if (!this.current) return;
    this.cleanup();
    if (this.g.modal) {
      this.g.modal.locked = false;
      this.g.modal.onClose = null;
    }
    this.g.close();
  }
}
