/** Touch is an input mode, never a claim that no hardware keyboard is connected. */
export function isMobileTouchDevice(nav, win) {
  const touch = nav.maxTouchPoints > 0 || win.matchMedia?.('(pointer: coarse)').matches;
  return !!(touch && (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(nav.userAgent || '') ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)));
}

export function joystickVector(dx, dy, radius) {
  const distance = Math.hypot(dx, dy);
  if (!distance || radius <= 0 || distance / radius <= 0.12) return { forward: 0, side: 0 };
  const strength = Math.min(1, (distance / radius - 0.12) / 0.88);
  return { forward: -dy / distance * strength, side: dx / distance * strength };
}

/** Preserve the existing digital axes exactly; use analog only without movement keys. */
export function movementAxes(world) {
  const keys = world.keys;
  const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const digital = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((code) => keys.has(code));
  return digital ? { forward, side } : (world.touchMovement || { forward: 0, side: 0 });
}

export class MobileControls {
  constructor(game, environment = {}) {
    this.game = game;
    this.world = game.world;
    this.win = environment.window || window;
    this.doc = environment.document || document;
    this.eligible = isMobileTouchDevice(this.win.navigator, this.win);
    this.mode = 'touch';
    this.pointers = new Map();
    this.listeners = [];
    this.world.touchMovement = { forward: 0, side: 0 };
    if (!this.eligible) return;
    this.doc.body.classList.add('mobile-input');
    this.root = this.doc.createElement('div');
    this.root.id = 'mobile-controls';
    this.root.hidden = true;
    this.root.innerHTML = `<div id="mobile-joystick" role="group" aria-label="Bewegen: Joystick ziehen"><span class="joystick-knob"></span><span class="joystick-label">BEWEGEN</span></div><div id="mobile-actions" role="group" aria-label="Spielaktionen"></div><span class="mobile-look-hint">Zum Umsehen im Bild wischen</span>`;
    this.toggle = this.doc.createElement('button');
    this.toggle.id = 'mobile-input-toggle';
    this.toggle.type = 'button';
    this.toggle.title = 'Tastaturnutzung blendet Touch aus. Eine unbenutzte externe Tastatur ist nicht sicher erkennbar.';
    this.doc.getElementById('ui').append(this.root, this.toggle);
    this.stick = this.root.querySelector('#mobile-joystick');
    this.knob = this.root.querySelector('.joystick-knob');
    this.actions = this.root.querySelector('#mobile-actions');
    this.listen(this.toggle, 'click', () => this.setMode(this.mode === 'touch' ? 'keyboard' : 'touch'));
    this.listen(this.stick, 'pointerdown', (event) => this.startStick(event));
    this.listen(this.actions, 'pointerdown', (event) => this.startAction(event));
    // Native click remains available for assistive technology; pointer clicks were handled above.
    this.listen(this.actions, 'click', (event) => {
      if (event.detail || !this.canPlay()) return;
      const button = event.target.closest('button');
      if (button && !button.disabled) this.pulse(button.dataset.code);
    });
    this.listen(this.win, 'pointermove', (event) => this.move(event), { passive: false });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.listen(this.win, name, (event) => this.end(event.pointerId));
    this.listen(this.win, 'keydown', (event) => {
      if (event.isTrusted && !event.metaKey && !event.ctrlKey && !event.altKey && event.key !== 'Unidentified') this.setMode('keyboard');
    }, true);
    for (const name of ['blur', 'pagehide', 'orientationchange', 'resize'])
      this.listen(this.win, name, () => this.reset());
    this.listen(this.win.screen?.orientation, 'change', () => this.reset());
    this.listen(this.doc, 'visibilitychange', () => { if (this.doc.hidden) this.reset(); });
    this.listen(this.root, 'contextmenu', (event) => event.preventDefault());
    this.update();
  }
  listen(target, name, fn, options) {
    target?.addEventListener(name, fn, options);
    this.listeners.push(() => target?.removeEventListener(name, fn, options));
  }
  canPlay() {
    const g = this.game;
    return g.started && !g.modal && !g.busy && !g.cinematic && !g.workshop?.cinematic &&
      !g.photoMode?.active && !g.blast?.active && !g.coffeePitch?.blocksMovement && !this.doc.hidden;
  }
  setMode(mode) {
    if (!this.eligible || this.mode === mode) return;
    this.reset();
    this.mode = mode;
    this.update();
  }
  key(code, down) {
    if (!code) return;
    if (down) this.world.keys.add(code);
    else this.world.keys.delete(code);
    // Reuse the game's action owners, including courier/B ordering and all guards.
    const event = new this.win.KeyboardEvent(down ? 'keydown' : 'keyup', {
      code, key: code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true,
    });
    this.win.dispatchEvent(event);
  }
  pulse(code) {
    this.key(code, true);
    this.key(code, false);
    this.update();
  }
  capture(event, data) {
    event.preventDefault();
    this.pointers.set(event.pointerId, { ...data, target: event.currentTarget });
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { this.end(event.pointerId); return false; }
    return true;
  }
  startStick(event) {
    if (event.pointerType !== 'touch' || this.mode !== 'touch' || !this.canPlay() ||
      [...this.pointers.values()].some((p) => p.stick)) return;
    const rect = this.stick.getBoundingClientRect();
    if (this.capture(event, { stick: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * 0.34 })) this.move(event);
  }
  move(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer?.stick) return;
    if (!this.canPlay()) { this.reset(); return; }
    event.preventDefault();
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    this.world.touchMovement = joystickVector(dx, dy, pointer.radius);
    const scale = Math.min(1, pointer.radius / (Math.hypot(dx, dy) || 1));
    this.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }
  startAction(event) {
    const button = event.target.closest('button');
    if (event.pointerType !== 'touch' || !button || button.disabled || this.mode !== 'touch' || !this.canPlay()) return;
    const code = button.dataset.code;
    if (!this.capture(event, { code, button })) return;
    button.classList.add('is-held');
    // Keep only sustained actions held. Others fire once per deliberate touch.
    if (button.dataset.hold === 'true') this.key(code, true);
    else this.pulse(code);
  }
  end(id) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    this.pointers.delete(id);
    if (pointer.stick) {
      this.world.touchMovement = { forward: 0, side: 0 };
      this.knob.style.transform = '';
    } else if (![...this.pointers.values()].some((p) => p.code === pointer.code)) {
      this.key(pointer.code, false);
      pointer.button.classList.remove('is-held');
    }
    if (pointer.target.hasPointerCapture?.(id)) pointer.target.releasePointerCapture(id);
  }
  reset() {
    for (const id of [...this.pointers.keys()]) this.end(id);
    this.world.touchMovement = { forward: 0, side: 0 };
    this.world.dragging = false;
  }
  buttons() {
    const g = this.game, a = g.arcade, type = a.vehicle?.type;
    const held = a.immersion?.physics.held;
    const courier = a.immersion?.courier;
    const list = [['KeyE', held ? 'Ablegen' : type ? 'Aussteigen' : g.world.nearest?.kind === 'vehicle' ? 'Einsteigen' : 'Benutzen', false, !g.world.nearest && !held && !type], ['KeyM', 'Karte']];
    if (type === 'helicopter') {
      list.push(['Space', 'Steigen', true], ['KeyC', 'Sinken', true], ['ShiftLeft', 'Schneller', true]);
      if (g.sim.s.courier.active) list.push(['KeyQ', courier?.lowered ? 'Winde ein' : 'Winde aus'], ['KeyX', courier?.hooked ? 'Lösen' : 'Einhängen']);
    }
    else if (type) {
      list.push(['Space', 'Bremse', true], ['KeyH', type === 'bike' ? 'Klingel' : 'Hupe'], ['KeyL', 'Licht']);
      if (type === 'bike') list.push(['ShiftLeft', 'Sprint', true], ['KeyF', 'Feuern', true], ['KeyT', 'Nachladen']);
    } else {
      list.push(['ShiftLeft', 'Sprint', true], ['Space', 'Springen'], ['KeyF', 'Schlagen']);
      if (held || this.world.zone === 'city') list.push(['KeyG', held ? 'Werfen' : 'Greifen']);
      if (g.sim.s.courier.active && g.sim.s.courier.mode === 'carry') list.push(['KeyB', 'Koffer ablegen']);
      else if (!g.sim.s.courier.active && this.world.zone === 'city' && g.extras?.fire.state.bombs > 0) list.push(['KeyB', 'Burrito']);
    }
    return list;
  }
  update() {
    if (!this.eligible) return;
    const playable = this.canPlay();
    const visible = playable && this.mode === 'touch';
    const context = this.game.arcade.vehicle;
    if ((this.visible && !visible) || this.context !== context || this.zone !== this.world.zone) this.reset();
    this.visible = visible;
    this.context = context;
    this.zone = this.world.zone;
    this.root.hidden = !visible;
    this.toggle.hidden = !playable;
    this.toggle.textContent = this.mode === 'touch' ? 'Touch aus' : 'Touch an';
    this.toggle.setAttribute('aria-label', this.mode === 'touch' ? 'Touchsteuerung ausblenden' : 'Touchsteuerung einblenden');
    this.toggle.setAttribute('aria-pressed', String(this.mode === 'touch'));
    this.doc.body.classList.toggle('touch-playing', visible);
    if (!visible) return;
    const buttons = this.buttons();
    const signature = JSON.stringify(buttons);
    if (this.signature === signature) return;
    this.signature = signature;
    const wanted = new Set(buttons.map(([code]) => code));
    for (const [id, pointer] of this.pointers) if (pointer.code && !wanted.has(pointer.code)) this.end(id);
    // Preserve captured button elements when nearby interactions change labels.
    for (const button of [...this.actions.children]) if (!wanted.has(button.dataset.code)) button.remove();
    for (const [code, label, hold = false, disabled = false] of buttons) {
      let button = this.actions.querySelector(`[data-code="${code}"]`);
      if (!button) { button = this.doc.createElement('button'); button.type = 'button'; button.dataset.code = code; this.actions.append(button); }
      button.textContent = label;
      button.dataset.hold = String(hold);
      button.disabled = disabled;
      button.setAttribute('aria-label', label);
    }
  }
  destroy() {
    this.reset();
    this.listeners.forEach((remove) => remove());
    this.root?.remove(); this.toggle?.remove();
    this.doc.body.classList.remove('mobile-input', 'touch-playing');
  }
}
