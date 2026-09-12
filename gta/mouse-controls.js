/** Owns browser pointer lock. Gameplay, menus and movies keep their existing owners. */
export class MouseControls {
  constructor(game, environment = {}) {
    this.game = game;
    this.world = game.world;
    this.canvas = this.world.canvas;
    this.doc = environment.document || document;
    this.win = environment.window || window;
    this.defer = environment.defer || ((callback) => queueMicrotask(callback));
    this.now = environment.now || (() => performance.now());
    this.fine = this.win.matchMedia?.('(any-pointer: fine)')?.matches ?? true;
    this.desired = false;
    this.revision = 0;
    this.pending = false;
    this.wasLocked = false;
    this.uiHeld = false;
    this.escapeUntil = 0;
    this.unavailable = typeof this.canvas.requestPointerLock !== 'function';
    this.listeners = [];
    this.world.mouseControls = this;
    this.hint = this.doc.createElement('button');
    this.hint.id = 'mouse-capture-hint';
    this.hint.type = 'button';
    this.hint.hidden = true;
    this.hint.setAttribute('aria-label', 'Maussteuerung im Spiel aktivieren');
    this.doc.getElementById('ui')?.append(this.hint);
    this.listen(this.hint, 'click', () => this.request());
    this.listen(this.canvas, 'pointerdown', (event) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
      if (event.button === 0 && !this.uiHeld && this.canPlay()) this.request();
    });
    this.listen(this.doc, 'pointerlockchange', () => this.changed());
    this.listen(this.doc, 'pointerlockerror', () => this.failed());
    this.listen(this.win, 'keydown', (event) => this.keydown(event), true);
    this.listen(
      this.win,
      'keyup',
      (event) => {
        if (['AltLeft', 'AltRight'].includes(event.code) && this.uiHeld) {
          event.preventDefault();
          this.uiHeld = false;
          this.resume();
        }
      },
      true,
    );
    this.listen(this.win, 'blur', () => {
      this.uiHeld = false;
      this.release();
    });
    this.listen(this.win, 'focus', () => this.update());
    this.listen(this.doc, 'visibilitychange', () => {
      if (this.doc.hidden) {
        this.uiHeld = false;
        this.release();
      }
      this.update();
    });
  }
  listen(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    this.listeners.push(() => target.removeEventListener(name, handler, options));
  }
  get locked() {
    return this.doc.pointerLockElement === this.canvas;
  }
  canPlay() {
    return (
      this.game.started &&
      !this.game.modal &&
      !(this.game.cinematic || this.game.workshop?.cinematic) &&
      !this.doc.hidden &&
      (this.doc.hasFocus?.() ?? true)
    );
  }
  canLook() {
    return this.canPlay() && !this.game.busy && !this.uiHeld;
  }
  resetInput() {
    this.world.keys.clear();
    this.world.dragging = false;
    this.world.cameraLookUntil = 0;
  }
  resume() {
    const revision = ++this.revision;
    this.desired = true;
    // close() can synchronously be followed by another menu or story chapter.
    this.defer(() => {
      if (revision !== this.revision) return;
      if (!this.canPlay() || this.uiHeld) {
        this.desired = false;
        this.update();
        return;
      }
      this.request();
    });
  }
  request() {
    if (!this.fine || !this.canPlay() || this.uiHeld || this.unavailable) {
      this.update();
      return;
    }
    this.desired = true;
    if (this.locked || this.pending || this.expectedRelease) return;
    this.pending = true;
    try {
      // Plain pointer lock is compatible with both promise and legacy void APIs.
      const result = this.canvas.requestPointerLock();
      result?.then?.(
        () => this.changed(),
        (error) => this.failed(error),
      );
    } catch (error) {
      this.failed(error);
    }
  }
  failed(error) {
    if (this.locked) return;
    this.pending = false;
    if (error?.name === 'NotSupportedError') this.unavailable = true;
    this.update();
    // No timer retries: a browser may require a new click after its Escape gesture.
  }
  release() {
    this.revision++;
    this.desired = false;
    this.resetInput();
    if (this.locked) {
      this.expectedRelease = true;
      this.doc.exitPointerLock?.();
    }
    this.update();
  }
  changed() {
    const owned = this.locked,
      previous = this.wasLocked;
    this.wasLocked = owned;
    this.pending = false;
    if (owned) {
      // A request can resolve after a menu, focus change or a movie has opened.
      if (!this.desired || !this.canPlay() || this.uiHeld) {
        this.release();
        return;
      }
      this.world.dragging = false;
      this.canvas.focus?.({ preventScroll: true });
    } else {
      const expected = this.expectedRelease;
      this.expectedRelease = false;
      this.resetInput();
      if (previous && !expected && this.canPlay() && this.desired) {
        this.desired = false;
        this.escapeUntil = this.now() + 250;
        if (!this.game.busy) this.game.settings();
      } else if (expected && this.desired && this.canPlay() && !this.uiHeld) this.resume();
    }
    this.update();
  }
  keydown(event) {
    if (event.code === 'Escape' || event.key === 'Escape') {
      // Holding Escape must not reopen/close a menu after native key repeat starts.
      if (event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (this.locked || this.now() < this.escapeUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat || this.now() < this.escapeUntil) return;
        this.escapeUntil = this.now() + 250;
        this.release();
        if (
          !this.game.modal &&
          !this.game.busy &&
          !(this.game.cinematic || this.game.workshop?.cinematic)
        )
          this.game.settings();
      }
      return;
    }
    if (['AltLeft', 'AltRight'].includes(event.code) && this.canPlay()) {
      event.preventDefault();
      if (event.repeat) return;
      this.uiHeld = true;
      this.release();
    }
  }
  update() {
    const visible = this.fine && this.canPlay() && !this.locked && !this.game.busy;
    if (this.hint.hidden === visible) this.hint.hidden = !visible;
    const label = this.uiHeld
      ? 'HUD bedienen · Alt loslassen zum Umsehen'
      : this.unavailable
        ? 'Maus ziehen zum Umsehen · P Smartphone'
        : 'Ins Spiel klicken · Maus aktivieren';
    if (this.hint.textContent !== label) this.hint.textContent = label;
    if (this.lastLocked !== this.locked) {
      this.lastLocked = this.locked;
      this.doc.body.classList.toggle('mouse-locked', this.lastLocked);
    }
    if (this.lastHint !== visible) {
      this.lastHint = visible;
      this.doc.body.classList.toggle('mouse-unlocked', visible);
    }
  }
  dispose() {
    this.release();
    this.listeners.forEach((remove) => remove());
    this.hint.remove();
    this.world.mouseControls = null;
  }
}
