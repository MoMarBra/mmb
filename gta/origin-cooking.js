import { ORIGIN_LINES } from './origin-lines.js';
import * as THREE from 'three';
import { CookingRound } from './origin-state.js';
import { cinematicSet, animateKitchen } from './origin-models.js';
const $ = (id) => document.getElementById(id);
export class OriginCooking {
  constructor(story) {
    this.story = story;
    this.g = story.g;
    this.w = story.w;
    this.current = null;
    this.token = 0;
    this.keys = new Set();
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.08, 80);
    this.size = new THREE.Vector2();
    this.target = new THREE.Vector3();
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.current) return;
        if (e.code === 'Tab') return;
        if (
          ['Enter', 'Space'].includes(e.code) &&
          e.target?.tagName === 'BUTTON' &&
          e.target.id !== 'cook-stir'
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.code === 'Escape' && !e.repeat) this.pause(!this.current.paused);
        if (e.code === 'Enter' && !e.repeat) this.serve();
        if (['Space', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code))
          this.keys.add(e.code);
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
    const token = (this.token = (this.token || 0) + 1);
    this.pendingPaused = document.hidden;
    try {
      this.g.open(
        'Zitronengras',
        '<div class="origin-preparing">Die Küche wird vorbereitet …</div>',
        { pause: true, locked: true },
      );
      this.g.audio.update(0, this.w, false);
      await this.g.audio.bank?.preload([
        ...ORIGIN_LINES.filter((l) => l.key.startsWith('shift' + (level + 1) + '_')).map(
          (l) => l.asset,
        ),
        'origin_wok_sizzle_1_7_0',
        'origin_wok_toss_1_7_0',
        'origin_sauce_pour_1_7_0',
        'chop',
        'pot_01',
        'story_underscore',
      ]);
      if (token !== this.token) return;
      this.set ??= cinematicSet('kitchen');
      await this.w.renderer.compileAsync?.(this.set.scene, this.camera);
      if (token !== this.token) return;
      for (const a of Object.values(this.set.actors)) a.visible = false;
      this.current = {
        round: new CookingRound(level),
        elapsed: 0,
        paused: document.hidden || this.pendingPaused,
        stir: false,
        pour: 0,
        done: false,
        shadowAuto: this.w.renderer.shadowMap.autoUpdate,
      };
      this.loading = false;
      this.g.audio.voices.stop();
      this.keys.clear();
      this.g.arcade.music.current?.handle?.gain?.gain?.setTargetAtTime(
        0,
        this.g.audio.ctx?.currentTime || 0,
        0.08,
      );
      document.body.classList.add('story-cinematic', 'origin-cooking');
      $('modal-root').innerHTML =
        '<section class="cook-film" role="dialog" aria-modal="true" aria-label="Kochschicht"><header><div><small id="cook-level"></small><h1 id="cook-name"></h1><p id="cook-chapter"></p></div><div><button id="cook-pause">Pause · Esc</button><button id="cook-leave">Schicht verlassen</button></div></header><aside class="cook-order"><small>BON · <span id="cook-step"></span></small><strong id="cook-target"></strong><div class="cook-track"><i id="cook-doneness"></i></div><span id="cook-time"></span></aside><div class="cook-dashboard"><p id="cook-dialogue" hidden></p><div id="cook-feedback" role="status"></div><div id="cook-choices"></div><div id="cook-sear"><label for="cook-power">HITZE <b id="cook-temperature"></b></label><div class="cook-heat"><span id="cook-safe"></span><i id="cook-needle"></i></div><input id="cook-power" type="range" min="0" max="100" value="55" aria-label="Herdleistung"><div class="cook-tools"><button id="cook-stir">Rühren halten · Leertaste</button><button class="primary" id="cook-serve">Anrichten · Enter</button></div><small>A / D · Hitze &nbsp; | &nbsp; Regelmäßig rühren</small></div><div id="cook-result" hidden></div></div><div class="origin-paused" id="cook-paused" hidden><b>PAUSE</b><button id="cook-resume">Weiterkochen</button></div></section>';
      const r = this.current.round;
      $('cook-level').textContent = 'SERVICE ' + (level + 1) + ' / 4';
      $('cook-name').textContent = r.recipe.name;
      $('cook-chapter').textContent = r.recipe.subtitle;
      $('cook-safe').style.left = r.recipe.ideal[0] + '%';
      $('cook-safe').style.width = r.recipe.ideal[1] - r.recipe.ideal[0] + '%';
      $('cook-power').oninput = (e) => {
        if (!this.current?.paused) this.current.round.power = Number(e.target.value);
      };
      const stir = $('cook-stir');
      stir.onpointerdown = (e) => {
        if (!this.current?.paused) {
          e.preventDefault();
          stir.setPointerCapture?.(e.pointerId);
          this.current.stir = true;
        }
      };
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        stir.addEventListener(event, () => {
          if (this.current) this.current.stir = false;
        });
      $('cook-pause').onclick = () => this.pause(!this.current?.paused);
      $('cook-resume').onclick = () => this.pause(false);
      $('cook-leave').onclick = () => this.finish(false);
      $('cook-serve').onclick = () => this.serve();
      if (!this.current.paused) this.story.say('shift' + (level + 1) + '_support', true);
      this.sync();
      this.render(0);
      $('cook-paused').hidden = !this.current.paused;
    } catch (error) {
      if (token !== this.token) return;
      const failed = this.current;
      failed?.loop?.stop(0.1);
      if (failed) {
        this.w.renderer.shadowMap.autoUpdate = failed.shadowAuto;
        this.w.renderer.shadowMap.needsUpdate = true;
        this.w.shadowZone = null;
      }
      this.loading = false;
      this.current = null;
      this.story.stopVoice();
      document.body.classList.remove('story-cinematic', 'origin-cooking');
      if (this.g.modal) this.g.modal.locked = false;
      this.g.close();
      this.g.toast('Die Küche konnte nicht geladen werden.', 'E · Am Wok erneut versuchen.');
      console.error('Cooking preparation', error);
    }
  }
  pause(value) {
    if (this.loading) {
      this.pendingPaused = value;
      return;
    }
    if (!this.current) return;
    this.current.paused = value;
    this.current.stir = false;
    this.keys.clear();
    this.current.loop?.stop(0.1);
    this.current.loop = null;
    if (value) this.story.stopVoice();
    $('cook-paused').hidden = !value;
    $('cook-pause').textContent = value ? 'Fortsetzen · Esc' : 'Pause · Esc';
  }
  options() {
    const r = this.current?.round;
    if (!r) return [];
    const a = r.phase === 'prep' ? r.recipe.ingredients : r.recipe.garnish;
    return [a[1], a[2], a[0]];
  }
  choose(i) {
    const m = this.current;
    if (!m || m.paused) return;
    const old = m.round.phase;
    const good = m.round.select(this.options()[i]);
    if (good) {
      this.effect('chop', 0.24);
      if (old === 'plate') m.pour = 1.4;
    }
    this.sync();
  }
  effect(id, volume) {
    const b = this.g.audio.bank?.buffers?.get(id);
    this.g.audio.emit?.(b, { bus: 'ui', volume });
  }
  serve() {
    const m = this.current;
    if (!m || m.paused) return;
    const before = m.round.phase;
    if (m.round.finishSear()) {
      m.pour = 1.8;
      this.effect('origin_sauce_pour_1_7_0', 0.65);
    }
    if (before === 'sear') this.sync();
  }
  sync() {
    const m = this.current;
    if (!m) return;
    const r = m.round;
    $('cook-step').textContent = {
      prep: 'MISE EN PLACE',
      sear: 'AM WOK',
      plate: 'ANRICHTEN',
      done: 'SERVICE',
      failed: 'NEUER VERSUCH',
    }[r.phase];
    $('cook-feedback').textContent = r.feedback;
    $('cook-sear').hidden = r.phase !== 'sear';
    const choices = $('cook-choices');
    choices.hidden = !['prep', 'plate'].includes(r.phase);
    choices.innerHTML = choices.hidden
      ? ''
      : this.options()
          .map(
            (item, i) =>
              '<button id="cook-pick-' + i + '"><kbd>' + (i + 1) + '</kbd> ' + item + '</button>',
          )
          .join('');
    for (let i = 0; i < 3; i++)
      if ($('cook-pick-' + i)) $('cook-pick-' + i).onclick = () => this.choose(i);
    $('cook-target').textContent =
      r.phase === 'prep'
        ? 'Als Nächstes: ' + r.recipe.ingredients[r.step]
        : r.phase === 'plate'
          ? 'Jetzt: ' + r.recipe.garnish[r.plate]
          : 'Gargrad ' + Math.round(r.cooked) + ' / ' + r.recipe.target;
    if (['done', 'failed'].includes(r.phase) && !m.done) {
      m.done = true;
      m.loop?.stop(0.2);
      m.loop = null;
      this.story.say('shift' + (r.level + 1) + (r.passed ? '_success' : '_fail'), true);
      const result = $('cook-result');
      result.hidden = false;
      result.innerHTML =
        '<h2>' +
        (r.passed ? 'Service geschafft.' : 'Neue Pfanne. Neues Glück.') +
        '</h2><p>' +
        Math.round(r.score) +
        ' / 100 · ' +
        (r.passed
          ? this.story.active && !this.story.state.paid[r.level]
            ? '+' + r.recipe.reward + ' €'
            : 'Training / Wiederholung'
          : 'Ziel: 65 Punkte') +
        '</p><button class="primary" id="cook-next">' +
        (r.passed ? (r.level === 3 ? 'Zum letzten Gast' : 'Nächster Service') : 'Noch einmal') +
        '</button>';
      $('cook-next').onclick = () => {
        const level = r.level,
          pass = r.passed;
        this.finish(pass);
        if (!pass) this.start(level);
      };
      $('cook-next').focus?.();
    }
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    this.w.renderer.getSize(this.size);
    if (m.paused && m.drawn && m.width === this.size.x && m.height === this.size.y) return;
    const r = m.round;
    if (!m.paused) {
      m.elapsed += dt;
      m.pour = Math.max(0, m.pour - dt);
      const dir =
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      if (dir) {
        r.power = Math.max(0, Math.min(100, r.power + dir * dt * 35));
        $('cook-power').value = r.power;
      }
      const stirring = m.stir || this.keys.has('Space');
      if (stirring && !m.wasStirring && m.elapsed > (m.nextToss || 0) && r.phase === 'sear') {
        this.effect('origin_wok_toss_1_7_0', 0.65);
        m.nextToss = m.elapsed + 0.9;
      }
      m.wasStirring = stirring;
      const old = r.phase;
      r.tick(dt, m.stir || this.keys.has('Space'));
      if (old !== r.phase) this.sync();
      if (r.phase === 'sear' && !m.loop) {
        const b = this.g.audio.bank?.buffers?.get('origin_wok_sizzle_1_7_0');
        m.loop = this.g.audio.emit?.(b, { bus: 'ui', volume: 0.7, loop: true, fade: 0.2 });
      }
    }
    animateKitchen(this.set, m.elapsed, {
      ...r,
      stir: !m.paused && (m.stir || this.keys.has('Space')),
      pour: m.pour,
    });
    const plate = ['plate', 'done'].includes(r.phase),
      target = this.target.set(plate ? -0.6 : -2, 1.3, -2.8);
    this.camera.position.set(plate ? 2 : 1.4, 4.2, 1.3);
    this.camera.lookAt(target);
    this.w.renderer.getSize(this.size);
    this.camera.aspect = this.size.x / Math.max(1, this.size.y);
    this.camera.updateProjectionMatrix();
    this.w.renderer.shadowMap.autoUpdate = true;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.renderer.setRenderTarget(null);
    this.w.renderer.render(this.set.scene, this.camera);
    m.drawn = true;
    m.width = this.size.x;
    m.height = this.size.y;
    $('cook-temperature').textContent = Math.round(r.heat) + '%';
    $('cook-needle').style.left = r.heat + '%';
    $('cook-doneness').style.width = Math.min(100, r.cooked) + '%';
    $('cook-doneness').classList.toggle('danger', r.burn > 12);
    if (r.phase === 'sear') {
      $('cook-target').textContent = 'Gargrad ' + Math.round(r.cooked) + ' / ' + r.recipe.target;
      $('cook-time').textContent =
        Math.ceil(r.recipe.deadline - r.elapsed) +
        ' s · ' +
        (r.dry > 3 ? 'Rühren!' : r.burn > 12 ? 'Hitze reduzieren!' : 'Pfanne unter Kontrolle');
      $('cook-feedback').textContent = r.feedback;
    }
  }
  finish(pass) {
    const m = this.current;
    if (!m) return;
    this.current = null;
    this.keys.clear();
    m.loop?.stop(0.1);
    this.story.stopVoice();
    this.w.renderer.shadowMap.autoUpdate = m.shadowAuto;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.shadowZone = null;
    document.body.classList.remove('story-cinematic', 'origin-cooking');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    if (pass) this.story.shiftComplete(m.round);
  }
}
