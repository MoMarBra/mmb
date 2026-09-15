import { MISSION_PASSED_ART, RESPECT_ART } from './mission-passed-art.js';
export const MISSION_PASSED_SOUND = 'mission_passed_1_6_6';

/** Session-only completion queue. Never owns rewards, input, pause or a game save. */
export class MissionPassed {
  constructor(game) {
    this.g = game;
    this.queue = [];
    this.seen = new Set();
    this.tokens = new WeakSet();
    this.active = null;
    this.buffer = null;
    this.loadState = 'idle';
    this.loadAttempts = 0;
    this.element = document.createElement('div');
    this.element.className = 'mission-passed-overlay';
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.innerHTML =
      '<div class="mission-passed-scrim"></div><div class="mission-passed-copy" aria-hidden="true"><div class="mission-passed-title">' +
      MISSION_PASSED_ART +
      '</div><div class="mission-passed-respect">' +
      RESPECT_ART +
      '</div></div><span class="mission-passed-accessible">Mission passed + Respect</span>';
    document.body.append(this.element);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
  }
  enqueue({ id, token } = {}) {
    if (id && this.seen.has(id)) return;
    if (token && this.tokens.has(token)) return;
    if (id) this.seen.add(id);
    if (token) this.tokens.add(token);
    // Retry transient failures only on a new completion, never in a frame-by-frame loop.
    if (this.loadState === 'failed' && this.loadAttempts < 3) {
      this.loadState = 'idle';
      this.g.audio.bank?.failures?.delete(MISSION_PASSED_SOUND);
    }
    this.queue.push({ queuedAt: performance.now() });
    this.prepare();
  }
  prepare() {
    if (this.loadState !== 'idle' || !this.g.audio.bank) return;
    this.loadState = 'loading';
    this.loadAttempts++;
    this.loading = Promise.resolve()
      .then(() => this.g.audio.bank.get(MISSION_PASSED_SOUND))
      .then((buffer) => {
        this.buffer = buffer;
        this.loadState = buffer ? 'ready' : 'failed';
      })
      .catch(() => {
        this.loadState = 'failed';
      });
  }
  setMix(value) {
    if (this.g.audio.missionPassedMix === value) return;
    this.g.audio.missionPassedMix = value;
    this.g.audio.applyMix?.();
  }
  elapsed() {
    const a = this.active;
    return a ? a.offset + (a.running ? (performance.now() - a.startedAt) / 1000 : 0) : 0;
  }
  pause() {
    const a = this.active;
    if (a?.running) {
      a.offset = this.elapsed();
      a.running = false;
      a.handle?.stop(0.025);
      a.handle = null;
    }
    this.element.hidden = true;
    this.setMix(false);
  }
  finish() {
    this.pause();
    this.active = null;
  }
  update(renderedWorld) {
    const g = this.g;
    // A film can finish inside render(): wait for a genuinely rendered gameplay frame.
    if (
      !renderedWorld ||
      !g.started ||
      g.modal ||
      g.cinematic ||
      g.busy ||
      document.hidden ||
      performance.now() < (g.worldTransitionUntil || 0)
    ) {
      this.pause();
      return;
    }
    if (!this.active && this.queue.length) {
      this.prepare();
      if (this.loadState === 'loading' && performance.now() - this.queue[0].queuedAt < 8000) return;
      const buffer = this.loadState === 'ready' ? this.buffer : null;
      this.active = { offset: 0, running: false, buffer, duration: buffer?.duration || 9.36 };
      this.queue.shift();
    }
    const a = this.active;
    if (!a) return;
    // Context suspension must not let the picture finish while its sound is stopped.
    if (a.buffer && g.audio.enabled && g.audio.ctx?.state !== 'running') {
      this.pause();
      return;
    }
    if (this.elapsed() >= a.duration) {
      this.finish();
      return;
    }
    if (!a.running) {
      if (a.buffer) {
        a.handle = g.audio.emit(a.buffer, {
          bus: 'ui',
          volume: 1.25,
          offset: a.offset,
          fade: 0.008,
        });
        if (!a.handle) return; // Retry on the next rendered frame if all audio voices are occupied.
      }
      a.startedAt = performance.now();
      a.running = true;
      this.element.hidden = false;
      this.setMix(true);
    }
    const age = this.elapsed();
    const fade = Math.min(1, age / 0.18, Math.max(0, (a.duration - age) / 0.7));
    this.element.style.opacity = String(fade);
    this.element.style.setProperty('--mission-reveal', String(Math.max(0, 1 - age / 0.3)));
  }
}
