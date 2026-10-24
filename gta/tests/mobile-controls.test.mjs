import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMobileTouchDevice, joystickVector, movementAxes, MobileControls } from '../mobile-controls.js';

const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} ≈ ${expected}`);

test('the joystick ignores resting-finger jitter and releases to neutral', () => {
  for (const [x, y] of [[0, 0], [1, -1], [5, 0], [0, 5]]) {
    const axes = joystickVector(x, y, 50);
    near(axes.forward, 0, 'forward within deadzone');
    near(axes.side, 0, 'side within deadzone');
  }
});

test('the joystick provides proportional motion, camera-relative directions and a circular limit', () => {
  const slow = joystickVector(0, -25, 50);
  const full = joystickVector(0, -50, 50);
  assert.ok(slow.forward > 0 && slow.forward < full.forward);
  near(slow.side, 0, 'straight forward');
  near(full.forward, 1, 'full forward');
  near(joystickVector(0, 50, 50).forward, -1, 'backward');
  near(joystickVector(-50, 0, 50).side, -1, 'left');
  near(joystickVector(50, 0, 50).side, 1, 'right');
  const diagonal = joystickVector(500, -500, 50);
  near(Math.hypot(diagonal.forward, diagonal.side), 1, 'outside drag stays in circular limit');
  near(diagonal.forward, diagonal.side, 'diagonal is balanced');
  const outside = joystickVector(500, 0, 50);
  near(outside.side, 1, 'dragging beyond joystick retains full input until release');
});

test('keyboard-only movement retains all WASD, arrow and opposite-key combinations', () => {
  const bindings = [
    ['KeyW', 'forward', 1], ['ArrowUp', 'forward', 1],
    ['KeyS', 'forward', -1], ['ArrowDown', 'forward', -1],
    ['KeyA', 'side', -1], ['ArrowLeft', 'side', -1],
    ['KeyD', 'side', 1], ['ArrowRight', 'side', 1],
  ];
  assert.deepEqual(movementAxes({ keys: new Set() }), { forward: 0, side: 0 });
  for (const [key, axis, value] of bindings) {
    const actual = movementAxes({ keys: new Set([key]) });
    assert.equal(actual[axis], value, key);
    assert.equal(actual[axis === 'forward' ? 'side' : 'forward'], 0, key + ' other axis');
  }
  assert.deepEqual(movementAxes({ keys: new Set(['KeyW', 'KeyD']) }), { forward: 1, side: 1 });
  assert.deepEqual(movementAxes({ keys: new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD']) }), { forward: 0, side: 0 });
  assert.deepEqual(movementAxes({ keys: new Set(['KeyW', 'ArrowUp']) }), { forward: 1, side: 0 });
});

test('analog values survive unchanged while actual directional keyboard use takes priority', () => {
  const touchMovement = { forward: 0.35, side: -0.2 };
  assert.deepEqual(movementAxes({ keys: new Set(), touchMovement }), touchMovement);
  assert.deepEqual(movementAxes({ keys: new Set(['ShiftLeft']), touchMovement }), touchMovement);
  assert.deepEqual(movementAxes({ keys: new Set(['KeyW', 'KeyD']), touchMovement }), { forward: 1, side: 1 });
  assert.deepEqual(movementAxes({ keys: new Set(['KeyW', 'KeyS']), touchMovement }), { forward: 0, side: 0 });
});

const deviceWindow = (coarse = true) => ({
  matchMedia: (query) => ({ matches: query.includes('coarse') ? coarse : false }),
});

test('mobile eligibility requires actual touch capability and excludes normal desktops', () => {
  assert.equal(isMobileTouchDevice({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' }, deviceWindow()), true);
  assert.equal(isMobileTouchDevice({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel)', platform: 'Linux armv8l' }, deviceWindow()), true);
  assert.equal(isMobileTouchDevice({ maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone' }, deviceWindow(false)), false);
  assert.equal(isMobileTouchDevice({ maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel' }, deviceWindow(false)), false);
  assert.equal(isMobileTouchDevice({ maxTouchPoints: 10, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', userAgentData: { mobile: false } }, deviceWindow(false)), false);
});

// Minimal DOM seam: exercise the real controller and event ownership without WebGL.
class Target {
  constructor() { this.events = new Map(); }
  addEventListener(name, callback) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.events.get(name)?.delete(callback); }
  dispatchEvent(event) {
    event.currentTarget = this;
    for (const callback of [...(this.events.get(event.type) || [])]) callback(event);
    return !event.defaultPrevented;
  }
}

class Classes {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  toggle(value, force) {
    const show = force === undefined ? !this.values.has(value) : force;
    if (show) this.add(value); else this.remove(value);
    return show;
  }
  contains(value) { return this.values.has(value); }
}

class Element extends Target {
  constructor(tagName = 'div') {
    super();
    Object.assign(this, { tagName: tagName.toUpperCase(), children: [], dataset: {}, style: {}, attributes: {}, classList: new Classes(), captures: new Set() });
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute(name, value) { this.attributes[name] = value; }
  set innerHTML(value) {
    this.markup = value;
    if (value.includes('mobile-joystick')) {
      const stick = new Element(); stick.id = 'mobile-joystick';
      const knob = new Element('span'); knob.classList.add('joystick-knob');
      const actions = new Element(); actions.id = 'mobile-actions';
      stick.append(knob); this.append(stick, actions);
    }
  }
  querySelector(selector) {
    for (const child of this.children) {
      if ((selector.startsWith('#') && child.id === selector.slice(1)) ||
        (selector.startsWith('.') && child.classList.contains(selector.slice(1))) ||
        (selector.startsWith('[data-code=') && child.dataset.code === selector.match(/"([^"]+)"/)[1])) return child;
      const descendant = child.querySelector(selector);
      if (descendant) return descendant;
    }
    return null;
  }
  closest(selector) { return selector === 'button' && this.tagName === 'BUTTON' ? this : this.parent?.closest(selector); }
  getBoundingClientRect() { return { left: 20, top: 200, width: 150, height: 150 }; }
  setPointerCapture(id) { if (this.captureFailure) throw Error('capture unavailable'); this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}

class KeyEvent {
  constructor(type, init) { Object.assign(this, { type, isTrusted: false, defaultPrevented: false }, init); }
  preventDefault() { this.defaultPrevented = true; }
}

function harness(mobile = true) {
  const win = new Target();
  Object.assign(win, deviceWindow(mobile), {
    navigator: mobile
      ? { maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone' }
      : { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel' },
    screen: { orientation: new Target() }, KeyboardEvent: KeyEvent,
  });
  const doc = new Target(), ui = new Element();
  Object.assign(doc, { hidden: false, body: new Element('body'), createElement: tag => new Element(tag), getElementById: id => id === 'ui' ? ui : null });
  const game = {
    started: true, modal: null, busy: false, cinematic: false,
    world: { keys: new Set(), zone: 'office', nearest: { kind: 'desk' }, dragging: false },
    arcade: { vehicle: null, immersion: { physics: { held: null }, courier: { lowered: false, hooked: false } } },
    sim: { s: { courier: { active: false, mode: 'carry' } } },
    extras: { fire: { state: { bombs: 0 } } },
  };
  const controller = new MobileControls(game, { window: win, document: doc });
  const keys = [];
  win.addEventListener('keydown', event => keys.push(['down', event.code]));
  win.addEventListener('keyup', event => keys.push(['up', event.code]));
  const pointer = (id, currentTarget, extra = {}) => ({
    type: 'pointerdown', pointerId: id, pointerType: 'touch', currentTarget,
    target: currentTarget, clientX: 95, clientY: 225, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, ...extra,
  });
  const stick = id => controller.startStick(pointer(id, controller.stick));
  const action = (id, code) => {
    const button = controller.actions.querySelector(`[data-code="${code}"]`);
    assert.ok(button, `context offers ${code}`);
    controller.startAction(pointer(id, controller.actions, { target: button }));
    return button;
  };
  return { controller, game, win, doc, ui, keys, pointer, stick, action };
}

test('mobile multitouch owns movement and action independently, with release outside the pad', () => {
  const h = harness();
  assert.equal(h.controller.root.hidden, false);
  h.stick(1);
  const forward = h.game.world.touchMovement.forward;
  assert.ok(forward > 0);
  h.action(2, 'ShiftLeft');
  assert.equal(h.controller.pointers.size, 2);
  assert.equal(h.game.world.keys.has('ShiftLeft'), true);
  h.action(3, 'Space');
  assert.equal(h.game.world.touchMovement.forward, forward, 'jump leaves first finger steering');
  assert.equal(h.game.world.keys.has('Space'), false, 'jump is a pulse');
  h.win.dispatchEvent({ type: 'pointerup', pointerId: 3, clientX: 900, clientY: 900 });
  h.win.dispatchEvent({ type: 'pointerup', pointerId: 1, clientX: -100, clientY: -100 });
  assert.deepEqual(h.game.world.touchMovement, { forward: 0, side: 0 });
  assert.equal(h.game.world.keys.has('ShiftLeft'), true, 'other finger is still held');
  h.win.dispatchEvent({ type: 'lostpointercapture', pointerId: 2 });
  assert.equal(h.controller.pointers.size, 0);
  assert.equal(h.game.world.keys.size, 0);
  assert.equal(h.controller.actions.captures.size, 0);
  assert.equal(h.controller.mode, 'touch', 'synthetic action keys never switch input mode');
  h.controller.destroy();
});

test('only one finger owns the joystick; capture failure and cancel release their own input', () => {
  const h = harness();
  h.stick(1); h.stick(2);
  assert.equal(h.controller.pointers.size, 1);
  h.win.dispatchEvent({ type: 'pointercancel', pointerId: 1 });
  assert.deepEqual(h.game.world.touchMovement, { forward: 0, side: 0 });
  h.controller.stick.captureFailure = true;
  h.stick(3);
  assert.equal(h.controller.pointers.size, 0);
  assert.deepEqual(h.game.world.touchMovement, { forward: 0, side: 0 });
  h.controller.destroy();
});

test('all browser interruptions release every touch action and movement', () => {
  for (const interruption of ['blur', 'pagehide', 'orientationchange', 'resize', 'screen-orientation', 'hidden']) {
    const h = harness();
    h.stick(1); h.action(2, 'ShiftLeft');
    h.game.world.dragging = true;
    if (interruption === 'hidden') { h.doc.hidden = true; h.doc.dispatchEvent({ type: 'visibilitychange' }); }
    else if (interruption === 'screen-orientation') h.win.screen.orientation.dispatchEvent({ type: 'change' });
    else h.win.dispatchEvent({ type: interruption });
    assert.deepEqual(h.game.world.touchMovement, { forward: 0, side: 0 }, interruption);
    assert.equal(h.game.world.keys.size, 0, interruption);
    assert.equal(h.controller.pointers.size, 0, interruption);
    assert.equal(h.game.world.dragging, false, interruption);
    h.controller.destroy();
  }
});

test('vehicle and zone changes clear holds and offer actions belonging to the actual vehicle', () => {
  const h = harness();
  h.stick(1); h.action(2, 'ShiftLeft');
  h.game.arcade.vehicle = { type: 'car' };
  h.game.world.nearest = { kind: 'vehicle-exit' };
  h.controller.update();
  assert.equal(h.controller.pointers.size, 0);
  assert.equal(h.game.world.keys.size, 0);
  assert.equal(h.controller.actions.querySelector('[data-code="Space"]').textContent, 'Bremse');
  assert.equal(h.controller.actions.querySelector('[data-code="KeyH"]').textContent, 'Hupe');
  assert.equal(h.controller.actions.querySelector('[data-code="KeyF"]'), null);
  h.action(3, 'Space');
  h.game.arcade.vehicle = { type: 'helicopter' };
  h.controller.update();
  assert.equal(h.game.world.keys.size, 0, 'car brake cannot become an unintended ascent');
  assert.equal(h.controller.actions.querySelector('[data-code="Space"]').textContent, 'Steigen');
  h.action(4, 'Space'); h.action(5, 'KeyC');
  assert.ok(h.game.world.keys.has('Space') && h.game.world.keys.has('KeyC'));
  h.game.world.zone = 'city'; h.controller.update();
  assert.equal(h.game.world.keys.size, 0, 'zone transition releases lift controls');
  h.game.arcade.vehicle = { type: 'bike' }; h.controller.update();
  assert.equal(h.controller.actions.querySelector('[data-code="KeyF"]').textContent, 'Feuern');
  assert.equal(h.controller.actions.querySelector('[data-code="KeyT"]').textContent, 'Nachladen');
  assert.equal(h.controller.actions.querySelector('[data-code="KeyH"]').textContent, 'Klingel');
  h.controller.destroy();
});

test('holding a prop enables Ablegen without a nearest interaction and exposes Werfen indoors', () => {
  const h = harness();
  const button = code => h.controller.actions.querySelector(`[data-code="${code}"]`);
  assert.equal(button('KeyG'), null, 'ordinary office play does not offer inapplicable Greifen');
  h.game.world.nearest = null;
  h.controller.update();
  assert.equal(button('KeyE').textContent, 'Benutzen');
  assert.equal(button('KeyE').disabled, true, 'Benutzen without any target is disabled');
  h.action(1, 'KeyE');
  assert.equal(h.keys.length, 0, 'disabled action never reaches the game action owners');
  h.stick(2);
  const motion = { ...h.game.world.touchMovement };
  h.game.arcade.immersion.physics.held = { id: 'chair' };
  h.controller.update();
  assert.equal(button('KeyE').textContent, 'Ablegen');
  assert.equal(button('KeyE').disabled, false, 'held prop can be put down without a nearest interaction');
  assert.equal(button('KeyG').textContent, 'Werfen');
  assert.deepEqual(h.game.world.touchMovement, motion, 'nearby interaction changes preserve an active joystick');
  h.action(3, 'KeyE');
  assert.deepEqual(h.keys.slice(-2), [['down', 'KeyE'], ['up', 'KeyE']], 'Ablegen invokes the existing E owner once');
  h.game.arcade.immersion.physics.held = null;
  h.controller.update();
  assert.equal(button('KeyE').disabled, true);
  assert.equal(button('KeyG'), null);
  h.game.world.zone = 'city';
  h.controller.update();
  assert.equal(button('KeyG').textContent, 'Greifen', 'street props can be picked up in the city');
  h.game.world.nearest = { kind: 'vehicle' };
  h.controller.update();
  assert.equal(button('KeyE').textContent, 'Einsteigen');
  assert.equal(button('KeyE').disabled, false);
  h.controller.destroy();
});

test('courier and Burrito buttons respect mission ownership, carried case and available inventory', () => {
  const h = harness();
  const button = () => h.controller.actions.querySelector('[data-code="KeyB"]');
  assert.equal(button(), null, 'no office bomb or case action without a mission');
  h.game.world.zone = 'city';
  h.controller.update();
  assert.equal(button(), null, 'empty bomb inventory provides no Burrito action');
  h.game.extras.fire.state.bombs = 2;
  h.controller.update();
  assert.equal(button().textContent, 'Burrito');
  h.game.sim.s.courier.active = true;
  h.game.sim.s.courier.mode = 'ground';
  h.controller.update();
  assert.equal(button(), null, 'active courier reserves B even with bombs in inventory');
  h.game.sim.s.courier.mode = 'carry';
  h.controller.update();
  assert.equal(button().textContent, 'Koffer ablegen');
  h.action(1, 'KeyB');
  assert.deepEqual(h.keys.slice(-2), [['down', 'KeyB'], ['up', 'KeyB']], 'case drop routes through B ownership');
  h.game.sim.s.courier.mode = 'winch';
  h.controller.update();
  assert.equal(button(), null, 'a case on the winch is not labelled as carried');
  h.game.sim.s.courier.active = false;
  h.game.extras.fire.state.bombs = 0;
  h.controller.update();
  assert.equal(button(), null, 'consuming inventory removes the stale action');
  h.controller.destroy();
});

test('helicopter winch actions appear only for a courier mission and name their next actual action', () => {
  const h = harness();
  const button = code => h.controller.actions.querySelector(`[data-code="${code}"]`);
  h.game.arcade.vehicle = { type: 'helicopter' };
  h.game.world.nearest = null;
  h.controller.update();
  assert.equal(button('KeyE').textContent, 'Aussteigen');
  assert.equal(button('KeyE').disabled, false, 'vehicle exit keeps its existing game guards even without a nearest object');
  assert.equal(button('KeyQ'), null);
  assert.equal(button('KeyX'), null);
  h.game.sim.s.courier.active = true;
  h.controller.update();
  assert.equal(button('KeyQ').textContent, 'Winde aus');
  assert.equal(button('KeyX').textContent, 'Einhängen');
  h.game.arcade.immersion.courier.lowered = true;
  h.game.arcade.immersion.courier.hooked = true;
  h.controller.update();
  assert.equal(button('KeyQ').textContent, 'Winde ein');
  assert.equal(button('KeyX').textContent, 'Lösen');
  h.game.sim.s.courier.active = false;
  h.controller.update();
  assert.equal(button('KeyQ'), null, 'mission completion removes the winch action');
  assert.equal(button('KeyX'), null, 'mission completion removes the attach action');
  h.controller.destroy();
});

test('menus and busy scenes clear touches; actual keyboard use hides touch with a manual return', () => {
  const h = harness();
  for (const blocked of ['modal', 'busy', 'cinematic']) {
    h.stick(1); h.action(2, 'ShiftLeft');
    h.game[blocked] = true; h.controller.update();
    assert.equal(h.controller.root.hidden, true, blocked);
    assert.equal(h.controller.pointers.size, 0, blocked);
    assert.equal(h.game.world.keys.size, 0, blocked);
    h.game[blocked] = false; h.controller.update();
  }
  h.stick(1); h.action(2, 'ShiftLeft');
  h.win.dispatchEvent({ type: 'keydown', code: 'KeyW', key: 'w', isTrusted: true });
  assert.equal(h.controller.mode, 'keyboard');
  assert.equal(h.controller.root.hidden, true);
  assert.equal(h.controller.toggle.hidden, false, 'manual fallback remains accessible');
  assert.equal(h.controller.pointers.size, 0);
  assert.equal(h.game.world.keys.size, 0);
  h.controller.toggle.dispatchEvent({ type: 'click' });
  assert.equal(h.controller.mode, 'touch');
  assert.equal(h.controller.root.hidden, false);
  h.stick(7);
  assert.ok(h.game.world.touchMovement.forward > 0, 'touch works after external keyboard use');
  h.controller.destroy();
  assert.equal(h.ui.children.length, 0);
  assert.equal(h.doc.body.classList.contains('mobile-input'), false);
});

test('normal desktop remains free of mobile UI and new input listeners', () => {
  const h = harness(false);
  assert.equal(h.controller.eligible, false);
  assert.equal(h.ui.children.length, 0);
  assert.equal(h.controller.listeners.length, 0);
  assert.equal(h.doc.body.classList.contains('mobile-input'), false);
  h.controller.update(); h.controller.destroy();
  assert.equal(h.ui.children.length, 0);
});
