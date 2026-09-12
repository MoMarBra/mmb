import * as THREE from 'three';
import { WORKSHOP_LINES } from './workshop-lines.js';
import { buildBossSet, buildWorkshopSet, animateStoryActor } from './workshop-sets.js';

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export class WorkshopCinema {
  constructor(story) {
    this.story = story;
    this.g = story.g;
    this.w = story.w;
    this.sets = {};
    this.current = null;
    this.token = 0;
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1200);
  }
  async play(kind, done, result = null) {
    if (this.current || this.loading) return;
    this.loading = true;
    const g = this.g;
    try {
      const token = ++this.token;
      const prefix = {
        intro: 'intro_',
        handoff: 'handoff_',
        workshop: 'workshop_',
        success: 'success_',
      }[kind];
      const lines = WORKSHOP_LINES.filter((l) => l.key.startsWith(prefix));
      g.open(
        'Workshop · Szene wird vorbereitet',
        '<div class="story-loading"><span>BBE STORIES</span><h2>Nur noch kurz zum Marienplatz.</h2><p>Die nächste Szene wird vorbereitet …</p></div>',
        { pause: true, locked: true },
      );
      g.world.keys.clear();
      g.world.dragging = false;
      // Prime the audio zone before a preview voice starts; a zone change clears old voices.
      g.audio.update(0, this.w, false);
      await g.audio.bank?.preload([
        ...lines.map((l) => 'voice_' + l.id),
        kind === 'success' ? 'story_success' : 'story_underscore',
      ]);
      if (token !== this.token) return;
      const set =
        kind === 'handoff'
          ? this.story.handoffSet()
          : kind === 'intro'
            ? (this.sets.boss ??= buildBossSet())
            : (this.sets.workshop ??= buildWorkshopSet());
      let start = 0;
      const pause =
        kind === 'intro' ? (30 - lines.reduce((n, l) => n + l.duration, 0)) / lines.length : 0.8;
      const segments = lines.map((line) => {
        const segment = { line, start, end: start + line.duration + pause };
        start = segment.end;
        return segment;
      });
      const duration = kind === 'success' ? 7.5 : kind === 'intro' ? 30 : start + 0.7;
      const movie = {
        kind,
        set,
        segments,
        duration,
        elapsed: 0,
        index: -1,
        paused: false,
        done,
        result,
        voice: null,
        bed: null,
        restored: false,
        playerVisible: this.w.player.visible,
        shadowVisible: this.w.playerShadow.visible,
        shadowAuto: this.w.renderer.shadowMap.autoUpdate,
        shadowNeeds: this.w.renderer.shadowMap.needsUpdate,
      };
      this.current = movie;
      this.loading = false;
      if (kind === 'handoff') {
        this.w.player.visible = false;
        this.w.playerShadow.visible = false;
        this.story.companion.visible = false;
        this.story.case.visible = false;
        this.story.client.visible = false;
        set.group.visible = true;
      }
      g.audio.voices.stop();
      g.arcade.music.current?.handle?.gain.gain.setTargetAtTime(
        0,
        g.audio.ctx?.currentTime || 0,
        0.1,
      );
      document.body.classList.add('story-cinematic');
      const titles = {
        intro: ['01 · BBE HANDELSBERATUNG', 'Im Büro von Lukas Fleischmann'],
        handoff: ['02 · MARIENPLATZ', 'Persönlich geliefert.'],
        workshop: ['03 · SPÄTER AM ABEND', 'Frauenkirche · fiktiver Workshopraum'],
        success: ['BBE STORIES', 'Nur noch kurz zum Marienplatz.'],
      };
      document.getElementById('modal-root').innerHTML =
        `<section class="story-film ${kind === 'success' ? 'story-film-success' : ''}" role="dialog" aria-modal="true" aria-labelledby="story-film-title"><header><div><span>${titles[kind][0]}</span><h2 id="story-film-title">${titles[kind][1]}</h2></div><div class="story-film-buttons"><button id="story-pause">Pause · Esc</button><button id="story-skip">${kind === 'success' ? 'Weiterspielen' : 'Sequenz überspringen'} · Enter</button></div></header><div id="story-paused" hidden>PAUSE</div>${kind === 'intro' ? '<div class="story-title-card"><small>BBE STORIES · KAPITEL 01</small><h1>Nur noch kurz<br>zum Marienplatz.</h1></div>' : ''}${kind === 'success' ? `<div class="story-mission-passed"><span>MISSION BESTANDEN</span><h1>Nur noch kurz.</h1><strong>${result?.paid ? '+180 € &nbsp; · &nbsp; +70 XP &nbsp; · &nbsp; RESPEKT +6' : 'WIEDERHOLUNG ABGESCHLOSSEN'}</strong><p>Der Koffer ist da. Die Storyline auch.</p></div>` : ''}<div class="story-subtitles" role="status" aria-live="polite"><span id="story-speaker"></span><p id="story-line"></p></div><footer><span>BBE · MUNICH CONSULTING SIMULATOR</span><div class="story-film-progress"><i></i></div><span id="story-film-time"></span></footer></section>`;
      document.getElementById('story-skip').onclick = () => this.finish();
      document.getElementById('story-pause').onclick = () => this.pause(!movie.paused);
      document.getElementById('story-skip').focus({ preventScroll: true });
      this.startBed(movie);
    } catch (error) {
      this.loading = false;
      if (this.current) {
        this.current.done = null;
        this.finish();
      } else {
        if (g.modal) g.modal.locked = false;
        g.close();
        document.body.classList.remove('story-cinematic');
      }
      console.error('Workshop scene preparation', error);
      this.story.enabled = false;
      g.toast(
        'Die Szene konnte nicht vorbereitet werden.',
        'Dein Fortschritt ist gespeichert. Unter J → BBE Stories kannst du erneut fortsetzen.',
      );
    }
  }
  startBed(m) {
    if (!this.g.sim.s.music) return;
    const generation = (m.bedGeneration = (m.bedGeneration || 0) + 1);
    this.g.audio
      .sample(m.kind === 'success' ? 'story_success' : 'story_underscore', {
        bus: 'music',
        volume: m.kind === 'success' ? 0.75 : 0.95,
        loop: m.kind !== 'success',
        offset: m.kind === 'success' ? Math.min(m.elapsed, 7.49) : m.elapsed % 35.122,
      })
      .then((h) => {
        if (this.current === m && !m.paused && m.bedGeneration === generation) m.bed = h;
        else h?.stop(0.08);
      });
  }
  pause(value) {
    const m = this.current;
    if (!m || m.paused === value) return;
    m.paused = value;
    this.g.audio.voices.stop();
    m.bedGeneration = (m.bedGeneration || 0) + 1;
    m.bed?.stop(0.08);
    m.bed = null;
    if (!value) {
      m.elapsed = m.segments[m.index]?.start ?? m.elapsed;
      m.index = -1;
      this.startBed(m);
    }
    const badge = document.getElementById('story-paused');
    if (badge) badge.hidden = !value;
    const b = document.getElementById('story-pause');
    if (b) b.textContent = value ? 'Fortsetzen · Esc' : 'Pause · Esc';
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    if (!m.paused) m.elapsed = Math.min(m.duration, m.elapsed + dt);
    if (m.elapsed >= m.duration) {
      this.finish();
      return;
    }
    const index = m.segments.findIndex((s) => m.elapsed >= s.start && m.elapsed < s.end);
    if (index >= 0 && index !== m.index && !m.paused) {
      m.index = index;
      const l = m.segments[index].line;
      document.getElementById('story-speaker').textContent = l.speaker;
      document.getElementById('story-line').textContent = l.text;
      document.querySelector('.story-subtitles').hidden = !this.g.sim.s.audioSubtitles;
      this.story.remember(l.key);
      this.g.audio.voices.say(l.actor, 'workshop.story', {
        id: l.id,
        preview: true,
        force: true,
        priority: 10,
      });
    }
    const segment = m.segments[m.index],
      speaking = segment && m.elapsed < segment.start + segment.line.duration && !m.paused;
    for (const [role, actor] of Object.entries(m.set.actors))
      animateStoryActor(
        actor,
        m.elapsed,
        speaking && role === segment?.line.actor,
        actor.userData.storyPose || (role.startsWith('guest') ? 'work' : 'walk'),
      );
    if (m.kind === 'workshop') {
      m.set.screen.material.emissiveIntensity = m.elapsed > 8 ? 0.32 : 0.025;
      m.set.chart.visible = m.elapsed > 9;
      if (m.elapsed > 28)
        for (const [role, actor] of Object.entries(m.set.actors))
          if (role.startsWith('guest')) {
            actor.userData.rig.rightArm.rotation.x = -0.6;
            actor.userData.rig.rightFore.rotation.x = -0.8;
          }
    }
    if (m.kind === 'handoff') this.story.animateHandoff(m.elapsed, m.duration);
    const size = this.w.renderer.getSize(new THREE.Vector2());
    this.camera.aspect = size.x / size.y;
    this.camera.updateProjectionMatrix();
    const active = m.set.actors[segment?.line.actor] || m.set.actors.lukas || m.set.actors.player;
    const look = new THREE.Vector3(),
      desired = new THREE.Vector3();
    if (m.kind === 'success' || m.elapsed < (m.kind === 'intro' ? 4 : 3)) {
      if (m.kind === 'intro') {
        look.set(0, 1.2, -1.3);
        desired.set(4.8 - m.elapsed * 0.08, 3, 5.4);
      } else if (m.kind === 'handoff') {
        look.set(356, 1.1, 301);
        desired.set(366 - m.elapsed * 0.05, 4.1, 310);
      } else {
        look.set(0, 1.7, -3.5);
        desired.set(3.7, 3.2, 5.3 - m.elapsed * 0.018);
      }
    } else {
      active.updateWorldMatrix(true, false);
      active.getWorldPosition(look);
      look.y += 1.35;
      const direction = active.getWorldDirection(new THREE.Vector3());
      const side = new THREE.Vector3(direction.z, 0, -direction.x);
      desired
        .copy(look)
        .addScaledVector(direction, m.kind === 'workshop' ? 3.5 : 2.7)
        .addScaledVector(side, 0.75 + Math.sin(m.elapsed * 0.12) * 0.16);
      desired.y += 0.35;
    }
    this.camera.position.copy(desired);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    if (m.kind === 'handoff') {
      this.w.visibilityFrustum.setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(
          this.camera.projectionMatrix,
          this.camera.matrixWorldInverse,
        ),
      );
      this.w.updateCrowd();
      this.g.arcade.updateVehicleBatches();
    }
    const renderer = this.w.renderer;
    renderer.setRenderTarget(null);
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    renderer.render(m.set.scene, this.camera);
    document.querySelector('.story-film-progress i').style.transform =
      `scaleX(${m.elapsed / m.duration})`;
    document.getElementById('story-film-time').textContent =
      `${Math.floor(m.elapsed)} / ${Math.ceil(m.duration)} s`;
  }
  finish() {
    const m = this.current;
    if (!m || m.restored) return;
    m.restored = true;
    this.current = null;
    this.token++;
    this.g.audio.voices.stop();
    m.bed?.stop(0.25);
    if (m.kind === 'handoff') m.set.group.visible = false;
    this.w.player.visible = m.playerVisible;
    this.w.playerShadow.visible = m.shadowVisible;
    this.w.renderer.shadowMap.autoUpdate = m.shadowAuto;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.shadowZone = null;
    this.w.keys.clear();
    this.w.dragging = false;
    document.body.classList.remove('story-cinematic');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    m.done?.();
  }
}
