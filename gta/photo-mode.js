import * as THREE from 'three';
import { updateChaseCamera } from './office-hotpath.js';
import { renderGameScene } from './scene-matrix-scheduler.js';
import { shouldUseRemasterAO } from './remaster-performance.js';
import { capturePhotoView, updatePhotoView, restorePhotoView } from './photo-view-resources.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const icons = {
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/>',
  grid: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]}</svg>`;

/** A quiet photo may observe a normal job, never take ownership of another activity. */
export function photoUnavailable(game, document = globalThis.document, now = performance.now()) {
  const w = game.world, a = game.arcade, s = game.sim?.s;
  if (!game.started || !w || !s || !game.modal?.phone || !game.modal.pause || game.modal.locked || document?.hidden)
    return 'Handy im Spiel öffnen.';
  if (game.busy || game.currentTimedAction || game.cinematic || game.extras?.intro?.current ||
      (game.workshop?.enabled && game.workshop?.active) || game.workshop?.boarding ||
      game.fireStory?.running || (game.fireStory?.enabled && game.fireStory?.active) ||
      game.origin?.active || (game.campaign?.enabled && game.campaign?.active) || game.campaign?.panel || s.courier?.active ||
      game.quizssoir?.active || game.blast?.active || game.coffeePitch?.holding ||
      game.missionPassed?.active || game.missionPassed?.queue?.length ||
      game.extras?.brewery?.session || game.extras?.brewery?.drink ||
      a?.immersion?.motion?.action || a?.immersion?.physics?.held || a?.punchTime > 0 ||
      s.wanted > 0 || a?.heat > 0 || s.extras?.drunk > 0 ||
      now < (game.worldTransitionUntil || 0)) return 'Nach der laufenden Aktion verfügbar.';
  const car = a?.vehicle;
  if (car && (!['car', 'taxi', 'van'].includes(car.type) || car.exploded ||
      Math.abs(a.speed || 0) > .05 || Math.abs(car.speed || 0) > .05 || car.mesh.position.y > .5))
    return 'Zum Fotografieren kurz anhalten.';
  const velocity = w.zoneData[w.zone]?.body?.velocity;
  if (velocity && (Math.abs(velocity.y) > .1 || (!car && Math.hypot(velocity.x, velocity.z) > .1)))
    return 'Einen Moment ruhig stehen.';
  if (game.audio?.voices?.current || game.audio?.voices?.queue?.length || game.audio?.voices?.arrival)
    return 'Nach dem Gespräch verfügbar.';
  return '';
}

function copyFrame(canvas, document) {
  if (!canvas.width || !canvas.height) throw Error('Die Bildfläche ist noch nicht bereit.');
  const copy = document.createElement('canvas');
  copy.width = canvas.width; copy.height = canvas.height;
  const ctx = copy.getContext('2d');
  if (!ctx) throw Error('Das Foto konnte nicht vorbereitet werden.');
  // Must be synchronous with the WebGL draw: preserveDrawingBuffer stays false.
  ctx.drawImage(canvas, 0, 0);
  return copy;
}

function mountControls(mode, session) {
  const doc = mode.doc, panel = doc.querySelector('#modal-root .phone-device'), shade = panel?.parentElement;
  if (!panel || !shade) throw Error('Das Handy ist nicht mehr geöffnet.');
  const previous = { inert: panel.inert, display: panel.style.display };
  const root = doc.createElement('section'); root.className = 'photo-view';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'photo-title');
  root.innerHTML = `<div class="photo-surface" aria-label="Bild drehen: ziehen; Abstand ändern: Mausrad"></div>
    <div class="photo-thirds" hidden aria-hidden="true"></div>
    <header class="photo-top"><button type="button" data-photo-back aria-label="Zurück zum Handy">${icon('back')}</button><h2 id="photo-title">Kamera</h2><button type="button" data-photo-grid aria-label="Drittelraster" aria-pressed="false">${icon('grid')}</button></header>
    <footer class="photo-bottom"><div class="photo-lenses" aria-label="Bildausschnitt"><button type="button" data-photo-fov="66">Weit</button><button type="button" data-photo-fov="53">Normal</button><button type="button" data-photo-fov="35">Porträt</button></div>
    <div class="photo-adjust"><label>Abstand<input type="range" data-photo-distance min="2" max="10" step="0.1" aria-label="Kameraabstand"></label><label>Ausschnitt<input type="range" data-photo-zoom min="30" max="75" step="1" aria-label="Blickwinkel"></label></div>
    <button type="button" class="photo-shutter" data-photo-capture aria-label="Foto als PNG herunterladen">${icon('camera')}</button><p class="photo-status" role="status" aria-live="polite"></p><small>Ziehen · Bild drehen &nbsp; Esc · Zurück</small></footer>`;
  shade.append(root); panel.inert = true; panel.style.display = 'none'; shade.classList.add('photo-shade');
  const q = selector => root.querySelector(selector), surface = q('.photo-surface');
  const listeners = [];
  const on = (node, type, fn, options) => {
    node.addEventListener(type, fn, options); listeners.push(() => node.removeEventListener(type, fn, options));
  };
  let drag = null;
  const stopDrag = () => {
    const previous = drag; drag = null;
    if (previous && surface.hasPointerCapture?.(previous.id)) surface.releasePointerCapture(previous.id);
  };
  on(surface, 'pointerdown', e => {
    if (drag || e.button !== 0) return;
    e.preventDefault(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    surface.setPointerCapture?.(e.pointerId);
  });
  on(surface, 'pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    mode.orbit(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) on(surface, name, stopDrag);
  on(surface, 'wheel', e => { e.preventDefault(); mode.adjust({ distance: session.orbit.distance + e.deltaY * .003 }); }, { passive: false });
  on(q('[data-photo-back]'), 'click', () => mode.cancel());
  on(q('[data-photo-grid]'), 'click', e => {
    const button = e.currentTarget, value = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(value)); q('.photo-thirds').hidden = !value;
  });
  on(q('[data-photo-capture]'), 'click', () => { void mode.capture(); });
  for (const button of root.querySelectorAll('[data-photo-fov]'))
    on(button, 'click', () => mode.adjust({ fov: Number(button.dataset.photoFov) }));
  on(q('[data-photo-distance]'), 'input', e => mode.adjust({ distance: Number(e.target.value) }));
  on(q('[data-photo-zoom]'), 'input', e => mode.adjust({ fov: Number(e.target.value) }));
  on(mode.win, 'keydown', e => {
    if (!mode.current(session) || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) mode.cancel();
    }
    // The actual paused phone modal owns all other game actions. Native Tab and
    // range keyboard controls continue to work through Game.trapFocus().
  }, true);
  on(mode.win, 'blur', stopDrag);
  on(doc, 'visibilitychange', () => { stopDrag(); mode.visibilityChanged(); });
  on(mode.win, 'resize', () => { session.dirty = true; });
  on(session.world.canvas, 'webglcontextlost', () => { mode.cancel({ render: false }); });
  q('[data-photo-back]').focus({ preventScroll: true });
  return {
    update() {
      q('[data-photo-distance]').value = session.orbit.distance;
      q('[data-photo-zoom]').value = session.fov;
      for (const button of root.querySelectorAll('[data-photo-fov]'))
        button.setAttribute('aria-pressed', String(Number(button.dataset.photoFov) === session.fov));
    },
    progress(value, message) {
      q('[data-photo-capture]').disabled = value;
      if (message !== undefined) q('.photo-status').textContent = message;
    },
    dispose() {
      stopDrag(); for (const remove of listeners) remove(); root.remove();
      panel.inert = previous.inert; panel.style.display = previous.display; shade.classList.remove('photo-shade');
    },
  };
}

/** One transient owner; no clock, save, audio, quality or gameplay mutations. */
export class PhotoMode {
  constructor(game, environment = {}) {
    this.g = game;
    this.doc = environment.document || globalThis.document;
    this.win = environment.window || globalThis.window;
    this.now = environment.now || (() => performance.now());
    this.draw = environment.draw || ((world) => renderGameScene(world, world.scene, world.camera, { ao: shouldUseRemasterAO(world), dt: 0 }));
    this.mount = environment.mount || mountControls;
    this.copy = environment.copy || ((canvas) => copyFrame(canvas, this.doc));
    this.urls = environment.URL || globalThis.URL;
    this.defer = environment.defer || ((fn) => setTimeout(fn, 1000));
    this.download = environment.download || ((url, filename) => {
      const anchor = this.doc.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    });
    this.pending = null; this.session = null; this.generation = 0; this.disposed = false;
    this.objectURLs = new Set();
  }
  get active() { return !!this.session; }
  unavailable() { return this.disposed ? 'Kamera nicht verfügbar.' : photoUnavailable(this.g, this.doc, this.now()); }
  canRequest() { return !this.pending && !this.active && !this.unavailable(); }
  request() {
    const notice = this.doc.querySelector?.('[data-photo-notice]');
    if (!this.canRequest()) {
      if (notice) notice.textContent = this.unavailable();
      return false;
    }
    if (notice) notice.textContent = '';
    this.pending = { owner: this.g.sim.s, world: this.g.world, modal: this.g.modal };
    return true;
  }
  /** Called at END of one normal paused frame. Phone music preview/audio gating
   * has already settled; this module never calls play/stop/mix/save/clock APIs. */
  arm() {
    const pending = this.pending; this.pending = null;
    if (!pending || this.disposed || this.unavailable() || pending.owner !== this.g.sim.s ||
        pending.world !== this.g.world || pending.modal !== this.g.modal) return false;
    const w = pending.world, camera = w.camera;
    const s = this.session = {
      ...pending, camera, zone: w.zone, restaurant: w.currentRestaurant,
      generation: ++this.generation, dirty: true, cameraDirty: false, fov: camera.fov,
      previousFocus: this.doc.activeElement, exporting: false, exportEpoch: 0,
      view: capturePhotoView(w, this.g.arcade),
      restore: { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov,
        farLODs: (w.cars || []).map(car => [car, car.farLOD]) },
      orbit: { ray: new THREE.Raycaster(), camera, target: w.target.clone(),
        yaw: w.yaw, pitch: w.pitch, distance: clamp(w.distance, 2, 10), pose: w.pose },
    };
    try {
      s.controls = this.mount(this, s); s.controls.update();
      w.keys.clear(); this.g.mouseControls?.release();
      return true;
    } catch (error) {
      this.cancel({ render: false });
      this.g.toast?.('Kamera nicht verfügbar.', error.message);
      return false;
    }
  }
  current(s = this.session) {
    return !!s && s === this.session && s.generation === this.generation && !this.disposed &&
      s.owner === this.g.sim.s && s.world === this.g.world && s.camera === this.g.world.camera &&
      s.modal === this.g.modal && s.world.zone === s.zone && s.world.currentRestaurant === s.restaurant;
  }
  visibilityChanged() {
    const s = this.session; if (!s) return;
    // Once hidden, an in-flight export stays invalid even if the tab becomes
    // visible again before native toBlob returns. Keep the photo pause itself.
    if (this.doc.hidden) s.exportEpoch++;
    else s.dirty = true;
  }
  orbit(dx, dy) {
    const s = this.session;
    if (!this.current(s) || !Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
    s.orbit.yaw -= dx * .004; s.orbit.pitch = clamp(s.orbit.pitch + dy * .003, -.08, .8);
    s.dirty = s.cameraDirty = true;
  }
  adjust({ distance, fov } = {}) {
    const s = this.session; if (!this.current(s)) return;
    let changed = false;
    if (Number.isFinite(distance)) { const next = clamp(distance, 2, 10); changed ||= next !== s.orbit.distance; s.orbit.distance = next; }
    if (Number.isFinite(fov)) { const next = clamp(fov, 30, 75); changed ||= next !== s.fov; s.fov = next; }
    if (changed) { s.dirty = s.cameraDirty = true; s.controls.update(); }
  }
  projection(w) {
    const camera = w.camera;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const uniforms = w.ssao?.ssaoMaterial?.uniforms;
    uniforms?.cameraProjectionMatrix?.value.copy(camera.projectionMatrix);
    uniforms?.cameraInverseProjectionMatrix?.value.copy(camera.projectionMatrixInverse);
    w.visibilityFrustum ||= new THREE.Frustum();
    w.visibilityProjection ||= new THREE.Matrix4();
    w.visibilitySphere ||= new THREE.Sphere();
    w.visibilityFrustum.setFromProjectionMatrix(w.visibilityProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    w.updateCrowd(); this.g.arcade.updateVehicleBatches();
  }
  render(s) {
    if (s.cameraDirty) {
      updateChaseCamera(s.orbit, s.world.zoneData[s.zone].body, s.world.zoneData[s.zone], Infinity, 0, false);
      s.camera.fov = s.fov;
    }
    this.projection(s.world);
    s.world.renderer.shadowMap.needsUpdate = true;
    updatePhotoView(s.world, this.g.arcade, s.view);
    this.draw(s.world);
    s.dirty = s.cameraDirty = false;
  }
  /** main.frame takes this branch before every simulation/animation/controller. */
  frame() {
    const s = this.session; if (!s) return false;
    if (!this.current(s) || (!this.doc.hidden && this.unavailable())) { this.cancel({ render: false }); return false; }
    if (this.doc.hidden || !s.dirty) return true;
    try { this.render(s); }
    catch (error) { this.cancel({ render: false }); this.g.toast?.('Fotoansicht geschlossen.', error.message); }
    return this.active;
  }
  async capture() {
    const s = this.session;
    if (!this.current(s) || s.exporting || this.unavailable()) return false;
    s.exporting = true; s.controls.progress(true, '');
    const exportEpoch = s.exportEpoch;
    let copy;
    try {
      this.render(s);
      if (!this.current(s) || this.unavailable() || s.exportEpoch !== exportEpoch) return false;
      copy = this.copy(s.world.canvas);
      const blob = await new Promise((resolve, reject) => {
        try { copy.toBlob(resolve, 'image/png'); } catch (error) { reject(error); }
      });
      if (!this.current(s) || this.unavailable() || s.exportEpoch !== exportEpoch) return false;
      if (!blob || blob.type !== 'image/png' || !blob.size) throw Error('Das Foto konnte nicht gespeichert werden.');
      const url = this.urls.createObjectURL(blob); this.objectURLs.add(url);
      try { this.download(url, 'BBE-Muenchen-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png'); }
      catch (error) { this.revoke(url); throw error; }
      // This callback releases only its URL, even after a later owner/reset.
      this.defer(() => this.revoke(url));
      if (this.current(s)) s.controls.progress(false, 'PNG heruntergeladen.');
      return true;
    } catch (error) {
      if (this.current(s)) s.controls.progress(false, error.message || 'Foto nicht möglich.');
      return false;
    } finally {
      if (copy) { copy.width = 0; copy.height = 0; }
      if (this.current(s)) { s.exporting = false; s.controls.progress(false); }
    }
  }
  revoke(url) { if (this.objectURLs.delete(url)) this.urls.revokeObjectURL(url); }
  cancel({ render = true } = {}) {
    this.pending = null;
    const s = this.session; if (!s) return;
    const owned = this.current(s); this.session = null; this.generation++;
    try { s.controls?.dispose(); } catch { /* Still restore owned render resources if DOM cleanup fails. */ }
    if (!owned) return;
    const camera = s.camera;
    camera.position.copy(s.restore.position); camera.quaternion.copy(s.restore.quaternion); camera.fov = s.restore.fov;
    for (const [car, lod] of s.restore.farLODs) car.farLOD = lod;
    let projectionReady = false;
    try { this.projection(s.world); projectionReady = true; }
    catch { /* The view snapshot still needs cleanup even if rebuilding batches failed. */ }
    try { restorePhotoView(s.world, this.g.arcade, s.view, { refreshReflection: projectionReady && render && !this.doc.hidden }); }
    catch { projectionReady = false; /* The helper restores positions/invalidates its cache in finally. */ }
    try {
      s.world.renderer.shadowMap.needsUpdate = true;
      if (projectionReady && render && !this.doc.hidden && !s.world.renderer.getContext().isContextLost()) this.draw(s.world);
    } catch { /* Cleanup must not prevent a new modal, transition or context recovery. */ }
    s.world.keys.clear();
    if (s.previousFocus?.isConnected) s.previousFocus.focus({ preventScroll: true });
  }
  dispose() {
    this.cancel({ render: false }); this.disposed = true;
    for (const url of [...this.objectURLs]) this.revoke(url);
  }
}
