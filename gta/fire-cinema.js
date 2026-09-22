import * as THREE from 'three';
import { FIRE_LINES } from './fire-lines.js';
import { buildFireSet, updateFireSet } from './fire-sets.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
const smooth = (a, b, t) => {
  const x = clamp((t - a) / Math.max(0.001, b - a));
  return x * x * (3 - 2 * x);
};
const TITLES = {
  intro: ['02 · BBE HANDELSBERATUNG', 'Ticket in Flammen.'],
  rescue: ['INTERNAL IT · ESKALATIONSSTUFE HIMMLISCH', 'Benjamin übernimmt.'],
  success: ['BBE STORIES · KAPITEL 02', 'Ticket geschlossen.'],
  failure: ['BBE STORIES · KAPITEL 02', 'Das Ticket bleibt offen.'],
};

/** Real voice lengths own the edit. No fixed ending may truncate the last line. */
export function fireTimeline(kind, allLines = FIRE_LINES) {
  if (!TITLES[kind]) throw new Error(`Unknown fire cinematic: ${kind}`);
  const lines = allLines.filter((line) => line.key.startsWith(kind + '_'));
  if (!lines.length) throw new Error(`Missing fire dialogue: ${kind}`);
  let cursor = kind === 'intro' ? 2 : kind === 'rescue' ? 1.2 : 0.65;
  const segments = lines.map((line) => {
    if (kind === 'rescue' && line.key === 'rescue_03') cursor = Math.max(cursor, 10.2);
    const duration = Math.max(
      0.5,
      Number.isFinite(line.duration) ? line.duration : line.text.length / 13,
    );
    const segment = {
      line,
      start: cursor,
      voiceEnd: cursor + duration,
      end: cursor + duration + (kind === 'intro' ? 0.2 : 0.5),
    };
    cursor = segment.end;
    return segment;
  });
  const start = (key) => segments.find((segment) => segment.line.key === key)?.start;
  const markers =
    kind === 'rescue'
      ? {
          landing: start('rescue_03') ?? 11,
          pickup: start('rescue_04') ?? 18,
          sprayStart: (start('rescue_05') ?? 23) + 0.3,
          sprayEnd: (start('rescue_06') ?? 29) - 0.25,
        }
      : {};
  if (kind === 'rescue') {
    // Bad external metadata must never produce backwards motion or a zero-length spray.
    markers.pickup = Math.max(markers.landing + 1.5, markers.pickup);
    markers.sprayStart = Math.max(markers.pickup + 0.7, markers.sprayStart);
    markers.sprayEnd = Math.max(markers.sprayStart + 0.7, markers.sprayEnd);
    markers.angelStart = Math.max(0, markers.landing - 9);
  }
  return {
    segments,
    markers,
    duration: Math.max(
      cursor + 1.1,
      kind === 'rescue' ? markers.sprayEnd + 2 : kind === 'success' ? 7 : 0,
    ),
  };
}

export class FireCinema {
  constructor(story) {
    this.story = story;
    this.g = story.g;
    this.w = story.w;
    this.sets = {};
    this.current = null;
    this.loading = false;
    this.pending = null;
    this.token = 0;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.08, 80);
    this.size = new THREE.Vector2();
    this.look = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.controls = [];
  }
  resetInput() {
    this.w.keys.clear();
    this.w.dragging = false;
    this.w.cameraLookUntil = 0;
  }
  bindControls() {
    if (this.controls.length) return;
    const listen = (target, type, fn, options = true) => {
      target.addEventListener(type, fn, options);
      this.controls.push(() => target.removeEventListener(type, fn, options));
    };
    listen(window, 'keydown', (event) => {
      if (!this.current && !this.loading) return;
      // Keep browser/system shortcuts; all unmodified gameplay keys stay inside the movie.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      const movie = this.current || this.pending;
      if (event.code === 'Escape' || event.key === 'Escape') this.pause(!movie.paused);
      else if (event.code === 'Enter' || event.key === 'Enter') this.finish();
      else if (event.code === 'Tab' || event.key === 'Tab') {
        const buttons = [
          ...document.querySelectorAll(
            '.fire-film button:not([disabled]), .fire-loading button:not([disabled])',
          ),
        ];
        if (buttons.length) {
          const i = buttons.indexOf(document.activeElement);
          const next =
            i < 0
              ? event.shiftKey
                ? buttons.length - 1
                : 0
              : (i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
          buttons[next].focus({ preventScroll: true });
        }
      }
    });
    listen(window, 'keyup', (event) => {
      if (this.current || this.loading) {
        event.stopImmediatePropagation();
        this.resetInput();
      }
    });
    const blockWorldPointer = (event) => {
      if ((!this.current && !this.loading) || event.target?.closest?.('.fire-film, .fire-loading'))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for (const type of [
      'pointerdown',
      'pointermove',
      'mousedown',
      'mousemove',
      'wheel',
      'contextmenu',
    ])
      listen(window, type, blockWorldPointer, { capture: true, passive: false });
    const suspend = () => {
      const movie = this.current || this.pending;
      if (movie && !movie.paused) {
        this.pause(true);
        movie.autoPaused = true;
      }
    };
    listen(window, 'blur', (event) => {
      // Capturing blur also sees descendant focus changes during our own DOM rebuild.
      if (event.target === window) suspend();
    });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) suspend();
    });
    // On return, deliberately keep the frame paused until an explicit user action.
  }
  async play(kind, done, result = null) {
    if (this.current || this.loading) return;
    const token = ++this.token;
    const pending = (this.pending = { kind, done, result, paused: false, restored: false, token });
    this.loading = true;
    try {
      const timeline = fireTimeline(kind);
      this.bindControls();
      this.g.open(
        'BBE Stories · Ticket in Flammen',
        '<div class="fire-loading"><small>BBE STORIES · KAPITEL 02</small><h2>Ticket in Flammen.</h2><p>Bild und Ton werden vorbereitet …</p><div><button id="fire-pause">Pause · Esc</button><button id="fire-skip">Sequenz überspringen · Enter</button></div><span id="fire-paused" hidden>PAUSE</span></div>',
        { pause: true, locked: true },
      );
      this.resetInput();
      this.attachButtons(pending);
      // Set the zone before preview dialogue starts; zone changes otherwise cancel voices.
      this.g.audio.update(0, this.w, false);
      await this.g.audio.bank?.preload([
        ...timeline.segments.map((s) => 'voice_' + s.line.id),
        'fire_tension',
        'fire_angel',
        'fire_complete',
        'fire_crackle',
        'fire_extinguish',
      ]);
      if (token !== this.token || this.pending !== pending) return;
      const set = (this.sets[kind] ??= buildFireSet(kind));
      const movie = {
        ...pending,
        ...timeline,
        set,
        elapsed: 0,
        index: -1,
        restored: false,
        sounds: new Map(),
        soundGeneration: 0,
        shadowAuto: this.w.renderer.shadowMap.autoUpdate,
        radio: this.g.arcade?.music?.current?.handle || null,
        radioGain: this.g.arcade?.music?.current?.handle?.gain?.gain?.value,
      };
      this.current = movie;
      this.pending = null;
      this.loading = false;
      this.g.audio.voices.stop();
      movie.radio?.gain?.gain?.setTargetAtTime(0, this.g.audio.ctx?.currentTime || 0, 0.15);
      document.body.classList.add('story-cinematic', 'fire-cinematic');
      const [chapter, title] = TITLES[kind];
      const money = Number.isFinite(result?.money) ? result.money : 90;
      const xp = Number.isFinite(result?.xp) ? result.xp : 45;
      const rep = Number.isFinite(result?.rep) ? result.rep : 4;
      const reward = result?.paid
        ? `+${money.toLocaleString('de-DE')} € <b>·</b> +${xp} XP <b>·</b> REPUTATION +${rep}`
        : 'WIEDERHOLUNG ABGESCHLOSSEN';
      document.getElementById('modal-root').innerHTML =
        `<section class="fire-film fire-film-${kind}" role="dialog" aria-modal="true" aria-labelledby="fire-title"><header><div><small>${chapter}</small><h2 id="fire-title">${title}</h2></div><nav aria-label="Filmsteuerung"><button id="fire-pause">Pause · Esc</button><button id="fire-skip">${kind === 'success' ? 'Weiterspielen' : 'Überspringen'} · Enter</button></nav></header><div id="fire-paused" hidden><small>PAUSE</small><p>Das Ticket kann kurz warten.</p></div>${kind === 'intro' ? '<div id="fire-title-card"><small>BBE STORIES · KAPITEL 02</small><h1>Ticket<br>in Flammen.</h1><p>Eine kleine technische Rückfrage.</p></div>' : ''}${kind === 'success' ? `<div class="fire-result"><span class="fire-result-line"></span><small>MISSION BESTANDEN</small><h1>Ticket geschlossen.</h1><strong>${reward}</strong><p>Team gerettet. Laptop eskaliert. Benjamin geliefert.</p></div>` : kind === 'failure' ? '<div class="fire-result fire-result-failure"><small>ESKALATION NICHT ABGESCHLOSSEN</small><h1>Ein heißes Ticket.</h1><p>Die IT ist bereit für einen zweiten Versuch.</p></div>' : ''}<div id="fire-subtitles" role="status" aria-live="polite"><span id="fire-speaker"></span><p id="fire-line"></p></div><footer><span>BBE · MUNICH CONSULTING SIMULATOR</span><div class="fire-progress"><i id="fire-progress"></i></div><span id="fire-time"></span></footer></section>`;
      this.ui = {
        speaker: document.getElementById('fire-speaker'),
        line: document.getElementById('fire-line'),
        subtitles: document.getElementById('fire-subtitles'),
        progress: document.getElementById('fire-progress'),
        time: document.getElementById('fire-time'),
        title: document.getElementById('fire-title-card'),
      };
      this.attachButtons(movie);
      this.updatePauseUI(movie);
      this.ensureEffectsBus();
      this.render(0);
    } catch (error) {
      if (token !== this.token) return;
      if (this.current) this.current.done = null;
      else if (this.pending) this.pending.done = null;
      this.finish();
      console.error('Fire scene preparation', error);
      this.g.toast(
        'Die Szene konnte nicht vorbereitet werden.',
        'Dein Spielstand bleibt erhalten. Du kannst das Kapitel erneut öffnen.',
      );
    }
  }
  attachButtons(movie) {
    const skip = document.getElementById('fire-skip'),
      pause = document.getElementById('fire-pause');
    skip.onclick = () => this.finish();
    pause.onclick = () => this.pause(!movie.paused);
    pause.focus({ preventScroll: true });
  }
  ensureEffectsBus() {
    const audio = this.g.audio;
    if (!audio.buses || !audio.ctx?.createGain || !audio.master) return;
    if (!audio.buses.fireCinemaEffects) {
      audio.buses.fireCinemaEffects = audio.ctx.createGain();
      audio.buses.fireCinemaEffects.connect(audio.master);
    }
    const gain = this.g.sim.s.audioEffects ?? 0.8;
    if (this.effectsVolume !== gain) {
      this.effectsVolume = gain;
      audio.buses.fireCinemaEffects.gain.setTargetAtTime(clamp(gain), audio.ctx.currentTime, 0.08);
    }
  }
  stopSounds(movie) {
    movie.soundGeneration++;
    for (const slot of movie.sounds.values()) {
      slot.cancelled = true;
      slot.handle?.stop(0.1);
    }
    movie.sounds.clear();
  }
  sound(movie, key, id, options, active) {
    const previous = movie.sounds.get(key);
    if (!active) {
      if (previous) {
        previous.cancelled = true;
        previous.handle?.stop(0.18);
        movie.sounds.delete(key);
      }
      return;
    }
    if (previous) return;
    const slot = { cancelled: false, handle: null, generation: movie.soundGeneration };
    movie.sounds.set(key, slot);
    Promise.resolve(this.g.audio.sample(id, options))
      .then((handle) => {
        if (
          this.current !== movie ||
          movie.paused ||
          slot.cancelled ||
          movie.soundGeneration !== slot.generation
        )
          handle?.stop(0.06);
        else slot.handle = handle;
      })
      .catch(() => {
        /* Captions and animation remain playable if a single audio asset fails. */
      });
  }
  syncSounds(movie) {
    if (movie.paused) return;
    const t = movie.elapsed,
      markers = movie.markers,
      enabled = this.g.sim.s.audioEnabled !== false;
    const music = enabled && this.g.sim.s.music !== false;
    this.ensureEffectsBus();
    const bus = this.g.audio.buses?.fireCinemaEffects ? 'fireCinemaEffects' : 'effects';
    const angel = movie.kind === 'rescue' && t >= markers.angelStart && t < markers.landing;
    this.sound(
      movie,
      'bed',
      'fire_tension',
      { bus: 'music', volume: 0.78, loop: true, offset: t % 16, fade: 0.2 },
      music && (movie.kind === 'intro' || movie.kind === 'failure'),
    );
    this.sound(
      movie,
      'angel',
      'fire_angel',
      { bus: 'music', volume: 0.7, offset: Math.max(0, t - (markers.angelStart || 0)), fade: 0.1 },
      music && angel,
    );
    this.sound(
      movie,
      'complete',
      'fire_complete',
      { bus: 'music', volume: 0.72, offset: Math.min(t, 4.95) },
      music && movie.kind === 'success' && t < 5,
    );
    this.sound(
      movie,
      'crackle',
      'fire_crackle',
      { bus, volume: 0.3, loop: true, offset: t % 8, fade: 0.1 },
      enabled && movie.kind !== 'success' && (movie.kind !== 'rescue' || t < markers.sprayEnd),
    );
    this.sound(
      movie,
      'spray',
      'fire_extinguish',
      {
        bus,
        volume: 0.46,
        loop: true,
        offset: Math.max(0, t - (markers.sprayStart || 0)) % 4,
        fade: 0.06,
      },
      enabled && movie.kind === 'rescue' && t >= markers.sprayStart && t < markers.sprayEnd,
    );
  }
  updatePauseUI(movie) {
    const badge = document.getElementById('fire-paused'),
      button = document.getElementById('fire-pause');
    if (badge) badge.hidden = !movie.paused;
    if (button) button.textContent = movie.paused ? 'Fortsetzen · Esc' : 'Pause · Esc';
  }
  pause(value) {
    const movie = this.current || this.pending;
    if (!movie || movie.paused === !!value) return;
    movie.paused = !!value;
    movie.autoPaused = false;
    this.resetInput();
    this.g.audio.voices.stop();
    if (this.current) {
      this.stopSounds(movie);
      if (!value) {
        const segment = movie.segments[movie.index];
        // Replay just the interrupted sentence; do not rewind during its trailing pause.
        if (segment && movie.elapsed < segment.voiceEnd) {
          movie.elapsed = segment.start;
          movie.index = -1;
        }
      }
    }
    this.updatePauseUI(movie);
  }
  frameCamera(movie, segment) {
    const t = movie.elapsed,
      kind = movie.kind,
      set = movie.set;
    const look = this.look,
      pos = this.desired;
    let fov = 42;
    if (kind === 'intro' && t < 7) {
      const u = smooth(0, 7, t);
      pos.set(5 - u * 1.7, 2.9 - u * 0.7, 5.2 - u * 1.4);
      look.set(0, 1.12, -0.1);
    } else if (kind === 'intro' && (segment?.line.actor === 'player' || movie.index === 2)) {
      pos.set(1.22, 1.47, 1.55);
      look.set(0, 1.19, -0.04);
      fov = 38;
    } else if (kind === 'rescue' && t < movie.markers.landing) {
      const y = set.actors.benjamin.position.y;
      const u = smooth(0, movie.markers.landing, t);
      pos.set(5.4 - u * 0.4, 3.0 + (1 - u) * 1.8, 6.4);
      look.set(1.55, Math.max(1.25, y + 1.1), 0.8);
      fov = 47;
    } else if (
      kind === 'rescue' &&
      t >= movie.markers.sprayStart - 0.6 &&
      t < movie.markers.sprayEnd + 1
    ) {
      pos.set(3.7, 2.15, 3.8);
      look.set(0.7, 1.12, 0.45);
      fov = 42;
    } else if (kind === 'success' || kind === 'failure') {
      pos.set(5.0 - t * 0.017, 2.75, 5.4);
      look.set(0.7, 1.1, -0.2);
      fov = 43;
    } else {
      const actor = set.actors[segment?.line.actor] || set.actors.lukas;
      look.copy(actor.position);
      look.y += 1.33;
      // Every speaker stays framed from the open front of the set; no camera crosses a wall.
      pos.copy(look).add(new THREE.Vector3(1.25, 0.38, 3.0));
      if (segment?.line.actor === 'benjamin') pos.set(look.x - 2.8, look.y + 0.32, look.z + 1.9);
      fov = 39;
    }
    const shot =
      kind === 'rescue' && t < movie.markers.landing
        ? 'descent'
        : kind === 'rescue' && t >= movie.markers.sprayStart - 0.6 && t < movie.markers.sprayEnd + 1
          ? 'spray'
          : kind === 'intro' && t < 7
            ? 'opening'
            : `${kind}:${movie.index}`;
    // Deliberate cuts on dialogue beats, then an almost imperceptible stable dolly.
    if (movie.shot !== shot) {
      movie.shot = shot;
      movie.shotTime = t;
    }
    pos.x += Math.sin((t - movie.shotTime) * 0.13) * 0.045;
    this.camera.position.copy(pos);
    this.camera.fov = fov;
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  render(dt) {
    const movie = this.current;
    if (!movie) return;
    if (document.hidden && !movie.paused) this.pause(true);
    if (!movie.paused) movie.elapsed = Math.min(movie.duration, movie.elapsed + clamp(dt, 0, 0.25));
    if (movie.elapsed >= movie.duration) {
      this.finish();
      return;
    }
    const index = movie.segments.findIndex(
      (s) => movie.elapsed >= s.start && movie.elapsed < s.end,
    );
    if (index >= 0 && movie.index !== index && !movie.paused) {
      movie.index = index;
      const line = movie.segments[index].line;
      this.ui.speaker.textContent = line.speaker;
      this.ui.line.textContent = line.text;
      this.story.remember(line.key);
      Promise.resolve(
        this.g.audio.voices.say(line.actor, 'fire.story', {
          id: line.id,
          preview: true,
          force: true,
          priority: 12,
        }),
      ).catch(() => {});
    }
    const segment = movie.segments[index];
    const speaking =
      !movie.paused && segment && movie.elapsed < segment.voiceEnd ? segment.line.actor : null;
    if (!movie.paused || !movie.frameDrawn) {
      updateFireSet(movie.set, movie.elapsed, { markers: movie.markers, speaking });
      movie.frameDrawn = true;
    }
    this.w.renderer.getSize(this.size);
    this.camera.aspect = Math.max(0.1, this.size.x / Math.max(1, this.size.y));
    this.frameCamera(movie, segment);
    this.syncSounds(movie);
    const renderer = this.w.renderer;
    renderer.setRenderTarget(null);
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    movie.set.scene.environment = this.w.scene?.environment || null;
    movie.set.scene.environmentIntensity = 0.46;
    renderer.render(movie.set.scene, this.camera);
    this.ui.subtitles.hidden = this.g.sim.s.audioSubtitles === false || !segment;
    this.ui.progress.style.transform = `scaleX(${movie.elapsed / movie.duration})`;
    const time = `${Math.floor(movie.elapsed)} / ${Math.ceil(movie.duration)} s`;
    if (this.ui.time.textContent !== time) this.ui.time.textContent = time;
    if (this.ui.title) {
      const opacity = smooth(0.35, 1, movie.elapsed) * (1 - smooth(3.6, 4.7, movie.elapsed));
      this.ui.title.style.opacity = opacity;
      this.ui.title.style.transform = `translateY(${(1 - opacity) * 8}px)`;
    }
  }
  finish() {
    const movie = this.current || this.pending;
    if (!movie || movie.restored) return;
    movie.restored = true;
    this.token++;
    this.current = null;
    this.pending = null;
    this.loading = false;
    this.g.audio.voices.stop();
    if (movie.sounds) this.stopSounds(movie);
    if (movie.shadowAuto !== undefined) this.w.renderer.shadowMap.autoUpdate = movie.shadowAuto;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.shadowZone = null;
    this.resetInput();
    if (movie.radio && !movie.radio.stopped && Number.isFinite(movie.radioGain))
      movie.radio.gain.gain.setTargetAtTime(
        movie.radioGain,
        this.g.audio.ctx?.currentTime || 0,
        0.3,
      );
    for (const remove of this.controls.splice(0)) remove();
    document.body.classList.remove('story-cinematic', 'fire-cinematic');
    if (this.g.modal) this.g.modal.locked = false;
    this.g.close();
    this.ui = null;
    movie.done?.();
  }
}
