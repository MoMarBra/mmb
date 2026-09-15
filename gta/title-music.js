export const TITLE_INTRO_MUSIC = 'intro_theme_1_6_1';
export const TITLE_MENU_MUSIC = 'title_menu_1_6_7';
export const TITLE_MENU_GAIN = 0.16;
export const TITLE_MENU_LOOP = { start: 0.2, end: 136.9 };

/** Owns the same score source after the film releases its camera, then the quiet menu loop. */
export class TitleMusic {
  constructor(game) {
    this.g = game;
    this.current = null;
    for (const event of ['pointerdown', 'pointerup', 'keydown'])
      window.addEventListener(
        event,
        () => {
          if (this.current) this.unlock();
        },
        true,
      );
    document.addEventListener('visibilitychange', () => {
      if (this.current && !document.hidden) this.unlock();
    });
  }
  adopt({ handle = null, buffer = null, offset = 0, clock = null } = {}) {
    this.stop();
    if (this.g.started) {
      handle?.stop(0.15);
      return;
    }
    const s = (this.current = {
      phase: 'tail',
      tail: buffer,
      menu: null,
      offset,
      tailHandle: handle && !handle.stopped && !handle.ended ? handle : null,
      tailStartedAt: clock?.contextTime ?? handle?.startedAt ?? this.g.audio.ctx?.currentTime ?? 0,
      tailStartOffset: clock?.offset ?? handle?.offset ?? offset,
      menuHandle: null,
      attempts: {},
      retryAt: {},
      pending: new Map(),
    });
    this.g.audio.titleMix = { enabled: true, volume: 0.44 };
    this.g.audio.start();
    this.g.audio.applyMix?.();
    if (s.tailHandle) this.bindTail(s);
    this.request(s, TITLE_MENU_MUSIC, 'menu');
    this.update();
  }
  unlock() {
    const s = this.current,
      a = this.g.audio;
    if (!s || this.g.started) return;
    a.start();
    a.ctx
      ?.resume?.()
      ?.then(() => {
        if (this.current === s) this.update();
      })
      .catch(() => {});
    this.update();
  }
  request(s, id, key) {
    const a = this.g.audio;
    if (
      this.current !== s ||
      s[key] ||
      s.pending.has(id) ||
      !a.bank ||
      (s.attempts[id] || 0) >= 3 ||
      performance.now() < (s.retryAt[id] || 0)
    )
      return;
    s.attempts[id] = (s.attempts[id] || 0) + 1;
    s.retryAt[id] = performance.now() + 4000;
    a.bank.failures?.delete(id);
    const promise = Promise.resolve()
      .then(() => (this.current === s ? a.bank.get(id) : null))
      .then((buffer) => {
        if (this.current === s && buffer) s[key] = buffer;
      })
      .catch(() => {})
      .finally(() => {
        s.pending.delete(id);
        if (this.current === s) this.update();
      });
    s.pending.set(id, promise);
  }
  bindTail(s) {
    const h = s.tailHandle;
    h.onEnded = () => {
      if (this.current !== s || s.tailHandle !== h || this.g.started) return;
      s.tailHandle = null;
      s.tail = null;
      s.phase = 'menu';
      this.update();
    };
  }
  startMenu(s, when) {
    if (!s.menu || s.menuHandle) return;
    const a = this.g.audio;
    const h = a.emit(s.menu, {
      bus: 'music',
      loop: true,
      volume: TITLE_MENU_GAIN,
      fade: 0.6,
      when,
    });
    if (!h) return;
    if (h.source) {
      h.source.loopStart = Math.min(TITLE_MENU_LOOP.start, s.menu.duration / 4);
      h.source.loopEnd = Math.min(TITLE_MENU_LOOP.end, s.menu.duration);
    }
    s.menuHandle = h;
    s.menuStartsAt = h.startedAt ?? Math.max(a.ctx.currentTime, when || 0);
  }
  update() {
    const s = this.current,
      a = this.g.audio;
    if (!s) return;
    if (this.g.started || this.g.extras?.intro.current) {
      this.stop();
      return;
    }
    this.request(s, TITLE_MENU_MUSIC, 'menu');
    if (s.phase === 'tail') {
      this.request(s, TITLE_INTRO_MUSIC, 'tail');
      if (!s.tail && !s.pending.has(TITLE_INTRO_MUSIC) && s.attempts[TITLE_INTRO_MUSIC] >= 3)
        s.phase = 'menu';
    }
    if (!a.ready || a.ctx?.state !== 'running' || document.hidden) return;
    if (s.phase === 'tail' && !s.tailHandle && s.tail) {
      if (s.offset >= s.tail.duration) {
        s.phase = 'menu';
        s.tail = null;
      } else {
        s.tailStartedAt = a.ctx.currentTime;
        s.tailStartOffset = s.offset;
        s.tailHandle = a.emit(s.tail, { bus: 'music', volume: 0.9, offset: s.offset, fade: 0.025 });
        if (s.tailHandle) {
          s.tailStartedAt = s.tailHandle.startedAt ?? s.tailStartedAt;
          this.bindTail(s);
        }
      }
    }
    if (s.phase === 'tail' && s.tailHandle && s.tail) {
      // Schedule on the audio clock, after the complete score, even when the next frame is late.
      this.startMenu(s, s.tailStartedAt + s.tail.duration - s.tailStartOffset);
    } else if (s.phase === 'menu') this.startMenu(s, a.ctx.currentTime);
  }
  stop(fade = 0.15) {
    const s = this.current;
    this.current = null; // Invalidate late decodes and onEnded before stopping any source.
    s?.tailHandle?.stop(fade);
    s?.menuHandle?.stop(fade);
    if (this.g.audio.titleMix) {
      this.g.audio.titleMix = null;
      this.g.audio.applyMix?.();
    }
  }
}
