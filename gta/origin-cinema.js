import * as THREE from 'three';
import { ORIGIN_LINES } from './origin-lines.js';
import { cinematicSet, animateKitchen } from './origin-models.js';
import { buildBossSet, animateStoryActor } from './workshop-sets.js';
export const ORIGIN_TITLES = {
  home: ['PROLOG', 'Vom Wok zum Workshop'],
  kitchen: ['01 · ZITRONENGRAS', 'Service beginnt im Kopf.'],
  offer: ['02 · EIN TISCH VERÄNDERT ALLES', 'Ein Angebot. Kein Pitch.'],
  arrival: ['03 · BBE HANDELSBERATUNG', 'Dein nächstes Kapitel.'],
};
export function originTimeline(kind) {
  let t = 1.2;
  const segments = ORIGIN_LINES.filter((l) => l.key.startsWith(kind + '_')).map((line) => {
    const part = { line, start: t, voiceEnd: t + line.duration, end: t + line.duration + 0.45 };
    t = part.end;
    return part;
  });
  return { segments, duration: t + 1.4 };
}
const $ = (id) => document.getElementById(id);
export class OriginCinema {
  constructor(story) {
    this.story = story;
    this.g = story.g;
    this.w = story.w;
    this.current = null;
    this.token = 0;
    this.sets = {};
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.08, 100);
    this.size = new THREE.Vector2();
    this.look = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.current && !this.loading) return;
        if (e.code === 'Enter' && e.target?.tagName === 'BUTTON') return;
        if (e.code === 'Escape' || e.code === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) {
            if (e.code === 'Escape') this.pause(!this.current?.paused);
            else this.finish();
          }
        } else if (!['Tab', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(true);
    });
  }
  async play(kind, done) {
    if (this.current || this.loading) return;
    const token = ++this.token;
    this.loading = true;
    this.pendingPaused = document.hidden;
    this.pendingDone = done;
    this.g.open(
      ORIGIN_TITLES[kind][1],
      '<div class="origin-preparing">Die Szene wird vorbereitet …</div><button id="origin-loading-skip">Überspringen · Enter</button>',
      { pause: true, locked: true },
    );
    $('origin-loading-skip').onclick = () => this.finish();
    this.g.audio.update(0, this.w, false);
    try {
      const timeline = originTimeline(kind);
      await this.g.audio.bank?.preload([
        ...timeline.segments.map((s) => s.line.asset),
        'story_underscore',
      ]);
      if (token !== this.token) return;
      const set = (this.sets[kind] ??= kind === 'arrival' ? buildBossSet() : cinematicSet(kind));
      await this.w.renderer.compileAsync?.(set.scene, this.camera);
      if (token !== this.token) return;
      if (set.actors.lukas) set.actors.lukas.visible = ['offer', 'arrival'].includes(kind);
      if (kind === 'arrival' && set.actors.Tobias) set.actors.Tobias.visible = false;
      this.current = {
        kind,
        set,
        ...timeline,
        elapsed: 0,
        index: -1,
        paused: document.hidden || this.pendingPaused,
        done,
        sounds: [],
        shadowAuto: this.w.renderer.shadowMap.autoUpdate,
        previousMix: this.g.audio.cinematicMix,
      };
      this.loading = false;
      this.pendingDone = null;
      this.g.audio.voices.stop();
      this.g.audio.cinematicMix = { owner: this };
      this.g.arcade.music.current?.handle?.gain?.gain?.setTargetAtTime(
        0,
        this.g.audio.ctx?.currentTime || 0,
        0.08,
      );
      document.body.classList.add('story-cinematic', 'origin-cinematic');
      $('modal-root').innerHTML =
        '<section class="origin-film" role="dialog" aria-modal="true" aria-label="' +
        ORIGIN_TITLES[kind][1] +
        '"><header><div class="origin-title"><small>' +
        ORIGIN_TITLES[kind][0] +
        '</small><h1>' +
        ORIGIN_TITLES[kind][1] +
        '</h1></div><div><button id="origin-pause">Pause · Esc</button><button id="origin-skip">Überspringen · Enter</button></div></header><div class="origin-paused" id="origin-paused" hidden>PAUSE</div><div class="origin-subtitle" id="origin-subtitle"><b id="origin-speaker"></b><p id="origin-line"></p></div><footer><i id="origin-progress"></i></footer></section>';
      $('origin-pause').onclick = () => this.pause(!this.current?.paused);
      $('origin-skip').onclick = () => this.finish();
      $('origin-skip').focus?.();
      this.bed();
      this.render(0);
    } catch (error) {
      if (token !== this.token) return;
      const failed = this.current;
      failed?.voice?.stop(0.06);
      failed?.bed?.stop(0.1);
      if (failed) {
        this.w.renderer.shadowMap.autoUpdate = failed.shadowAuto;
        this.w.renderer.shadowMap.needsUpdate = true;
        this.w.shadowZone = null;
      }
      this.pendingDone = null;
      this.loading = false;
      this.current = null;
      if (this.g.modal) this.g.modal.locked = false;
      this.g.close();
      document.body.classList.remove('story-cinematic', 'origin-cinematic');
      this.g.audio.cinematicVoice = false;
      this.g.audio.cinematicMix = null;
      this.g.open(
        'Szene erneut laden',
        '<p>Dein Speicherpunkt ist gesichert.</p><button id="origin-retry" class="primary">Erneut versuchen</button>',
        { pause: true, locked: true },
      );
      $('origin-retry').onclick = () => {
        this.g.modal.locked = false;
        this.g.close();
        this.play(kind, done);
      };
      console.error('Origin cinematic', error);
    }
  }
  bed() {
    const m = this.current;
    if (!m || m.paused || !this.g.sim.s.music) return;
    const b = this.g.audio.bank?.buffers?.get('story_underscore');
    m.bed = this.g.audio.emit?.(b, {
      bus: 'music',
      volume: 0.38,
      loop: true,
      offset: m.elapsed % 35.122,
      fade: 0.6,
    });
  }
  pause(value) {
    if (this.loading) {
      this.pendingPaused = value;
      return;
    }
    const m = this.current;
    if (!m || m.paused === value) return;
    m.paused = value;
    m.voice?.stop(0.06);
    m.bed?.stop(0.15);
    this.g.audio.cinematicVoice = false;
    if (!value) {
      const seg = m.segments[m.index];
      if (seg && m.elapsed < seg.voiceEnd) {
        m.elapsed = seg.start;
        m.index = -1;
      }
      this.bed();
    }
    if ($('origin-paused')) $('origin-paused').hidden = !value;
    if ($('origin-pause'))
      $('origin-pause').textContent = value ? 'Fortsetzen · Esc' : 'Pause · Esc';
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    this.w.renderer.getSize(this.size);
    if (m.paused && m.drawn && m.width === this.size.x && m.height === this.size.y) return;
    if (!m.paused) m.elapsed += dt;
    if (m.elapsed >= m.duration) {
      this.finish();
      return;
    }
    const index = m.segments.findIndex((s) => m.elapsed >= s.start && m.elapsed < s.end);
    const segment = m.segments[index];
    if (index >= 0 && index !== m.index && !m.paused) {
      m.index = index;
      m.voice?.stop(0.04);
      const l = segment.line;
      $('origin-speaker').textContent = l.speaker;
      $('origin-line').textContent = l.text;
      const buffer = this.g.audio.bank?.buffers?.get(l.asset);
      m.voice = this.g.audio.emit?.(buffer, { bus: 'dialogue', volume: 0.93 });
    }
    const speaking = !m.paused && segment && m.elapsed < segment.voiceEnd;
    this.g.audio.cinematicVoice = !!speaking;
    $('origin-subtitle').hidden = !this.g.sim.s.audioSubtitles || !speaking;
    for (const [role, actor] of Object.entries(m.set.actors))
      animateStoryActor(
        actor,
        m.elapsed,
        !!speaking && role === segment.line.actor,
        actor.userData.storyPose || 'walk',
      );
    if (m.set.wok)
      animateKitchen(m.set, m.elapsed, { phase: 'sear', step: 3, heat: 40, stir: false });
    const actor =
      (m.kind === 'home' ? m.set.actors.player : m.set.actors[segment?.line.actor]) ||
      m.set.actors.player;
    const wide = m.elapsed < 4.8 || m.elapsed > m.duration - 2;
    if (wide) {
      this.look.set(m.kind === 'home' ? -1 : 0, 1.2, m.kind === 'arrival' ? -1.3 : -0.6);
      this.eye.set(m.kind === 'home' ? 4.8 : 5, 3.1, 6 - m.elapsed * 0.005);
    } else {
      actor.getWorldPosition(this.look);
      this.look.y += 1.35;
      this.eye
        .copy(this.look)
        .add(
          new THREE.Vector3(Math.sin(m.elapsed * 0.12) * 0.25 + 1.1, 0.38, 3.3).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            actor.rotation.y,
          ),
        );
    }
    if (!m.framed) {
      this.camera.position.copy(this.eye);
      m.target = this.look.clone();
      m.framed = true;
    } else {
      this.camera.position.lerp(this.eye, 1 - Math.exp(-dt * 1.8));
      m.target.lerp(this.look, 1 - Math.exp(-dt * 2.1));
    }
    this.w.renderer.getSize(this.size);
    this.camera.aspect = this.size.x / Math.max(1, this.size.y);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(m.target);
    this.w.renderer.shadowMap.autoUpdate = true;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.renderer.setRenderTarget(null);
    m.set.scene.environment = this.w.scene?.environment || null;
    m.set.scene.environmentIntensity = 0.46;
    this.w.renderer.render(m.set.scene, this.camera);
    m.drawn = true;
    m.width = this.size.x;
    m.height = this.size.y;
    $('origin-progress').style.transform = 'scaleX(' + m.elapsed / m.duration + ')';
    document.querySelector('.origin-title')?.classList.toggle('faded', m.elapsed > 7);
  }
  finish() {
    if (!this.current && this.loading) {
      const done = this.pendingDone;
      this.pendingDone = null;
      this.loading = false;
      ++this.token;
      if (this.g.modal) this.g.modal.locked = false;
      this.g.close();
      done?.();
      return;
    }
    const m = this.current;
    if (!m) return;
    this.current = null;
    ++this.token;
    m.voice?.stop(0.06);
    m.bed?.stop(0.3);
    this.g.audio.cinematicVoice = false;
    this.g.audio.cinematicMix = m.previousMix;
    this.w.renderer.shadowMap.autoUpdate = m.shadowAuto;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.shadowZone = null;
    this.w.keys.clear();
    document.body.classList.remove('story-cinematic', 'origin-cinematic');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    m.done?.();
  }
}
