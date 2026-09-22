import * as THREE from 'three';
import { QuizState, QUIZ_LADDER } from './quiz-state.js';
import { QuizStage, installQuizssoir } from './quiz-stage.js';
import { QuizAudio, QUIZ_SHOW_INTRO_SHOTS } from './quiz-audio.js';
import { QUIZ_LINES, QUIZ_HOST_VARIANTS } from './quiz-lines.js';
import { QUIZ_ART } from './quiz-art.js';

export const QUIZ_HOST_VOLUME = 0.27;
const formatter = new Intl.NumberFormat('de-DE');
const money = (n) => formatter.format(n || 0) + ' €';
const letters = ['A', 'B', 'C', 'D'];
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const $ = (id) => document.getElementById(id);
const activeRound = (phase) => !['idle', 'finished'].includes(phase);

/** One modal/film owner. Simulation, pointer lock and the shared audio mix resume together. */
export class Quizssoir {
  constructor(game) {
    this.g = game;
    this.w = game.world;
    this.fixture = installQuizssoir(this.w);
    this.state = new QuizState(game.sim.s.quizssoir);
    this.current = null;
    this.stage = null;
    this.audio = new QuizAudio(game.audio);
    this.voiceToken = 0;
    this.hostVariation = new Map();
    this.ray = new THREE.Raycaster();
    this.cursor = new THREE.Vector2();
    this.w.canvas?.addEventListener('click', (e) => this.clickFixture(e));
    window.addEventListener('keydown', (e) => this.key(e), true);
    window.addEventListener('resize', () => this.layoutUI());
    document.addEventListener('visibilitychange', () => {
      if (this.current && document.hidden) this.pause(true);
    });
    window.addEventListener('blur', () => {
      if (this.current) this.pause(true);
    });
    window.addEventListener('beforeunload', () => {
      if (this.current) this.save();
    });
  }
  get active() {
    return !!this.current;
  }
  nearby() {
    const p = this.w.player.position,
      a = this.fixture.anchor;
    return (
      this.g.started && this.w.zone === 'office' && p.y < 2 && Math.hypot(p.x - a.x, p.z - a.z) < 2
    );
  }
  interact(item) {
    if (item?.kind !== 'quizssoir') return false;
    if (this.nearby()) this.brief();
    return true;
  }
  clickFixture(e) {
    if (e.button || !this.nearby() || this.g.modal || this.g.busy || this.g.cinematic) return;
    const r = this.w.canvas.getBoundingClientRect();
    if (document.pointerLockElement === this.w.canvas) this.cursor.set(0, 0);
    else
      this.cursor.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
    this.ray.setFromCamera(this.cursor, this.w.camera);
    if (this.ray.intersectObject(this.fixture.root, true).length) this.brief();
  }
  prepareStage() {
    this.stage ??= new QuizStage(this.w, { fixture: this.fixture });
    if (!this.stage.warmed) {
      this.stage.warmed = true;
      this.stage.scene.environment = this.w.scene?.environment || null;
      this.w.renderer.compileAsync?.(this.stage.scene, this.stage.camera)?.catch(() => {});
    }
  }
  brief() {
    if (!this.nearby() || this.g.busy || this.g.cinematic) return false;
    this.g.audio.start();
    this.audio.preloadIntro();
    this.prepareStage();
    this.state = new QuizState(this.g.sim.s.quizssoir);
    const v = this.state.view(),
      resume = activeRound(v.phase);
    this.g.open(
      'Quizssoir',
      `<div class="quiz-brief" style="--quiz-backdrop:url('${QUIZ_ART.backdrop.url}')"><img class="quiz-logo quiz-brief-logo" src="${QUIZ_ART.logo.url}" alt="QUIZSSOIR" width="1536" height="1024"><span class="quiz-kicker">DIE BBE QUIZNACHT</span><h3>Eine stille Minute.<br>Eine große Million.</h3><p>15 Fragen. Drei Joker. Du und dein Halbwissen.</p><div class="quiz-brief-stats"><span>500 € / 16.000 €<small>Sicherheitsstufen</small></span><span>${money(v.bestWin)}<small>Dein Bestgewinn</small></span></div><button class="primary" id="quiz-start">${resume ? 'Runde fortsetzen' : 'Platz nehmen'} <span>↗</span></button><small>Quizgewinne sind Spielgeld. Wiederholungen zahlen nur einen höheren Bestgewinn aus.</small></div>`,
      { pause: true, eyebrow: 'BBE · WC · QUIZSSOIR' },
    );
    $('quiz-start').onclick = () => this.start();
    return true;
  }
  start() {
    if (this.current || !this.nearby() || this.g.busy || this.g.cinematic) return false;
    this.g.audio.start();
    const before = this.state.view();
    if (!activeRound(before.phase)) this.state.start();
    this.prepareStage();
    const v = this.state.view();
    this.current = {
      phase: v.phase,
      elapsed: 0,
      clock: 0,
      paused: false,
      hint: null,
      previousMix: this.g.audio.cinematicMix,
      previousVoice: this.g.audio.cinematicVoice,
      yaw: this.w.yaw,
      pitch: this.w.pitch,
      distance: this.w.distance,
      position: this.w.player.position.clone(),
      playerVisible: this.w.player.visible,
      shadowAuto: this.w.renderer.shadowMap.autoUpdate,
      shadowZone: this.w.shadowZone,
      exposure: this.w.renderer.toneMappingExposure,
    };
    this.g.open('Quizssoir', '', { pause: true, locked: true, onClose: () => this.cleanup() });
    document.body.classList.add('story-cinematic', 'quiz-open');
    this.g.audio.voices?.stop();
    this.g.audio.cinematicMix = { owner: this, musicDuck: 1 };
    this.g.arcade.music.current?.handle?.stop?.(0.12);
    this.g.arcade.music.current = null;
    this.g.audio.update(0, this.w, false);
    this.w.keys.clear();
    this.audio.start();
    this.shell();
    this.phaseEntered({ resume: activeRound(before.phase) });
    this.save();
    this.render(0);
    return true;
  }
  save() {
    this.g.sim.s.quizssoir = this.state.serialize();
    this.g.sim.save();
  }
  shell() {
    $('modal-root').innerHTML =
      `<section class="quiz-show" role="dialog" aria-modal="true" aria-label="Quizssoir">
      <div class="quiz-film-shade"></div><div class="quiz-cut" id="quiz-cut"></div>
      <header class="quiz-header"><div class="quiz-wordmark"><img class="quiz-logo quiz-header-logo" src="${QUIZ_ART.logo.url}" alt="QUIZSSOIR" width="1536" height="1024"></div><div class="quiz-top-actions"><button id="quiz-ladder-toggle" aria-expanded="false">Gewinnleiter</button><button id="quiz-sound" aria-label="Quiz-Ton umschalten"></button><button id="quiz-pause">Pause <kbd>Esc</kbd></button></div></header>
      <div class="quiz-opening" id="quiz-opening"><span class="quiz-kicker">PRÄSENTIERT VON DER STILLEN ABTEILUNG</span><h1><img class="quiz-logo quiz-title-logo" src="${QUIZ_ART.logo.url}" alt="QUIZSSOIR" width="1536" height="1024"></h1><p>Hier zählt, was im Kopf bleibt.</p><button id="quiz-skip">An die Frage <span>↗</span></button></div>
      <aside class="quiz-ladder" id="quiz-ladder" aria-label="Gewinnleiter"><div class="quiz-ladder-head">DEIN WEG ZUR MILLION</div><ol>${[
        ...QUIZ_LADDER,
      ]
        .map((value, i) => ({ value, i }))
        .reverse()
        .map(
          ({ value, i }) =>
            `<li id="quiz-rung-${i + 1}" data-safe="${i === 4 || i === 9}"><span>${String(i + 1).padStart(2, '0')}</span><b>${money(value)}</b><i aria-hidden="true">◆</i></li>`,
        )
        .join(
          '',
        )}</ol><div class="quiz-secured"><small>SICHER</small><b id="quiz-secured">0 €</b></div></aside>
      <div class="quiz-host" id="quiz-host" aria-live="polite"><span>LUKAS FLEISCHMANN</span><p id="quiz-host-line"></p></div>
      <div id="quiz-question-lead" class="quiz-question-lead" role="status" tabindex="-1" hidden><span id="quiz-lead-round"></span><strong id="quiz-lead-prize"></strong><i aria-hidden="true"><b id="quiz-lead-progress"></b></i></div><section class="quiz-board" id="quiz-board"><div class="quiz-board-top"><span id="quiz-round"></span><span id="quiz-category"></span><strong id="quiz-prize"></strong></div><h2 id="quiz-heading"></h2><div class="quiz-answers" id="quiz-answers">${letters.map((l, i) => `<button class="quiz-answer" id="quiz-answer-${i}" data-answer="${i}"><span>${l}:</span><b></b><i></i></button>`).join('')}</div><div class="quiz-tools"><div class="quiz-jokers"><button id="quiz-fifty" aria-label="50 zu 50 Joker"><b>50:50</b><small>JOKER</small></button><button id="quiz-audience" aria-label="Publikumsjoker"><b>▂▆▃▅</b><small>PUBLIKUM</small></button><button id="quiz-phone" aria-label="Telefonjoker Benjamin"><b>☎</b><small>BENJAMIN</small></button></div><div class="quiz-decision"><button id="quiz-walk">Mitnehmen</button><button id="quiz-lock" class="quiz-primary" disabled>Antwort wählen</button><button id="quiz-next" class="quiz-primary" hidden>Weiter <span>↗</span></button></div></div><div id="quiz-reveal-copy" class="quiz-reveal-copy" role="status"></div></section>
      <section class="quiz-joker-card" id="quiz-joker-card" hidden aria-label="Joker-Ergebnis"><button id="quiz-dismiss-hint" aria-label="Joker-Ergebnis schließen">×</button><div id="quiz-hint"></div></section>
      <section class="quiz-finale" id="quiz-finale" hidden><span class="quiz-kicker" id="quiz-result-kicker"></span><h2 id="quiz-result-title"></h2><strong id="quiz-result-prize"></strong><p id="quiz-result-line"></p><small id="quiz-result-payment"></small><button class="quiz-primary" id="quiz-return">Zurück ins BBE-Büro <span>↗</span></button></section>
      <section class="quiz-pause-panel" id="quiz-pause-panel" hidden role="dialog" aria-label="Quiz pausiert"><span class="quiz-kicker">DEIN WISSEN LÄUFT NICHT WEG</span><h2>Kurze Denkpause.</h2><button class="quiz-primary" id="quiz-resume">Weiterspielen</button><button id="quiz-save-exit">Speichern & zurück zur Toilette</button></section>
      <footer class="quiz-footer"><span>BBE QUIZ CLUB</span><span>A–D wählen · Enter einloggen · Esc Pause</span><span id="quiz-step-label">LIVE AUS DER STILLEN ABTEILUNG</span></footer>
    </section>`;
    for (let i = 0; i < 4; i++) $('quiz-answer-' + i).onclick = () => this.select(i);
    $('quiz-lock').onclick = () =>
      this.state.view().phase === 'locked' ? this.resolveAnswer() : this.lock();
    $('quiz-next').onclick = () => this.next();
    $('quiz-walk').onclick = () => this.walkAway();
    for (const id of ['fifty', 'audience', 'phone']) $('quiz-' + id).onclick = () => this.joker(id);
    $('quiz-pause').onclick = () => this.pause(!this.current?.paused);
    $('quiz-resume').onclick = () => this.pause(false);
    $('quiz-save-exit').onclick = () => this.finish();
    $('quiz-return').onclick = () => this.finish();
    $('quiz-skip').onclick = () => this.skipIntro();
    $('quiz-dismiss-hint').onclick = () => {
      this.current.hint = null;
      this.draw();
    };
    $('quiz-ladder-toggle').onclick = () => {
      const open = $('quiz-ladder').classList.toggle('is-open');
      $('quiz-ladder-toggle').setAttribute('aria-expanded', String(open));
    };
    $('quiz-sound').onclick = () => {
      this.g.audio.toggle();
      this.draw();
    };
  }
  phaseEntered(options = {}) {
    const m = this.current,
      v = this.state.view();
    if (!m) return;
    m.phase = v.phase;
    m.elapsed = 0;
    m.hint = null;
    m.confirmWalk = false;
    m.resumeVoice = null;
    m.pendingVoice = null;
    m.welcomeSpoken = false;
    m.canResolve = false;
    m.reactionCompleteAt = null;
    m.reactionDuration = 3.5;
    m.questionReady = v.phase !== 'question';
    this.stopVoice();
    const tier = Math.max(0, v.level - 1);
    if (v.phase === 'intro') {
      this.audio.cue('intro', tier);
      // Let the complete Main Theme introduce the studio before the host speaks.
    }
    if (v.phase === 'question') {
      this.audio.cue('question', tier, options);
      m.pendingVoice = 'question_' + v.question.id;
    }
    if (v.phase === 'locked') {
      this.audio.cue('lock', tier);
      this.speak('lock');
    }
    if (v.phase === 'reveal') {
      const safe = [5, 10].includes(v.level) && v.reveal.correct;
      const million = v.reveal.correct && v.level === 15;
      this.audio.cue(
        million ? 'million' : v.reveal.correct ? (safe ? 'safety' : 'correct') : 'wrong',
        tier,
      );
      this.speak(million ? 'million' : safe ? 'safety' : v.reveal.correct ? 'correct' : 'wrong');
      m.reactionDuration = m.voiceLine?.duration || 3.5;
    }
    if (v.phase === 'finished') {
      m.paid = this.state.claimReward();
      if (m.paid > 0) {
        this.g.sim.transaction(m.paid, 'Quizssoir · Bestgewinn');
        this.g.sim.change('happy', 8);
        this.g.sim.emit('mission-complete', 'Quizssoir', {
          id: 'quizssoir-' + this.state.view().bestPaid,
        });
      }
      this.g.sim.s.bladder = Math.max(0, this.g.sim.s.bladder - 25);
      this.audio.cue('finale', tier, { outcome: v.outcome });
      if (v.outcome === 'walk-away') this.speak('exit');
    }
    this.draw();
    this.focusAction();
    this.save();
  }
  layoutUI() {
    if (!this.current) return;
    const board = $('quiz-board'),
      show = document.querySelector('.quiz-show');
    if (board && !board.hidden && show)
      show.style.setProperty(
        '--quiz-board-clearance',
        Math.max(270, innerHeight - board.getBoundingClientRect().top + 18) + 'px',
      );
  }
  focusAction() {
    const v = this.state.view();
    const id =
      v.phase === 'intro'
        ? 'quiz-skip'
        : v.phase === 'reveal'
          ? 'quiz-next'
          : v.phase === 'finished'
            ? 'quiz-return'
            : v.phase === 'question'
              ? 'quiz-answer-' + (v.selection ?? [0, 1, 2, 3].find((i) => !v.hidden.includes(i)))
              : null;
    if (v.phase === 'question' && !this.current?.questionReady) $('quiz-question-lead')?.focus?.();
    else if (id) $(id)?.focus?.();
  }
  select(index) {
    if (!this.current?.questionReady || this.current.paused || !this.state.select(index)) return;
    this.current.hint = null;
    $('quiz-answer-' + index)?.focus?.();
    this.audio.cue('select', Math.max(0, this.state.view().level - 1));
    this.draw();
    this.save();
  }
  lock() {
    if (!this.current?.questionReady || this.current.paused || !this.state.lock()) return;
    this.phaseEntered();
  }
  resolveAnswer() {
    if (
      !this.current ||
      this.current.paused ||
      this.audio.presentationTime < 3.2 ||
      !this.state.reveal()
    )
      return;
    this.phaseEntered();
  }
  next() {
    if (!this.current || this.current.paused || !this.state.next()) return;
    this.phaseEntered();
  }
  skipIntro() {
    if (!this.current || this.current.paused || !this.state.begin()) return;
    this.phaseEntered();
  }
  walkAway() {
    if (!this.current?.questionReady || this.current.paused || !this.state.view().can.walkAway)
      return;
    if (!this.current.confirmWalk) {
      this.current.confirmWalk = true;
      $('quiz-walk').textContent = money(this.state.view().won) + ' wirklich mitnehmen?';
      return;
    }
    this.current.confirmWalk = false;
    if (this.state.walkAway()) this.phaseEntered();
  }
  joker(kind) {
    if (!this.current?.questionReady || this.current.paused) return;
    const result = this.state.useJoker(kind);
    if (!result) return;
    this.current.hint = kind;
    this.audio.cue('joker', Math.max(0, this.state.view().level - 1));
    this.speak(kind === 'phone' ? 'telephone' : kind === 'audience' ? 'audience' : 'fifty');
    this.draw();
    this.save();
  }
  draw() {
    const m = this.current;
    if (!m) return;
    const v = this.state.view(),
      lead = v.phase === 'question' && !m.questionReady,
      question = lead ? null : v.question;
    m.view = v;
    queueMicrotask(() => this.layoutUI());
    const show = document.querySelector('.quiz-show');
    if (show) show.dataset.phase = lead ? 'question-lead' : v.phase;
    $('quiz-opening').hidden = v.phase !== 'intro';
    $('quiz-board').hidden = lead || !['question', 'locked', 'reveal'].includes(v.phase);
    $('quiz-question-lead').hidden = !lead;
    $('quiz-lead-round').textContent = 'FRAGE ' + String(v.level).padStart(2, '0');
    $('quiz-lead-prize').textContent = money(QUIZ_LADDER[v.level - 1]);
    $('quiz-ladder').hidden = v.phase === 'intro' || v.phase === 'finished';
    $('quiz-finale').hidden = v.phase !== 'finished';
    $('quiz-pause-panel').hidden = !m.paused;
    for (const child of document.querySelector('.quiz-show')?.children || [])
      child.inert = m.paused && child.id !== 'quiz-pause-panel';
    $('quiz-pause').textContent = m.paused ? 'Fortsetzen · Esc' : 'Pause · Esc';
    $('quiz-sound').textContent = this.g.audio.enabled ? 'Ton an' : 'Ton aus';
    $('quiz-sound').setAttribute('aria-pressed', String(this.g.audio.enabled));
    $('quiz-secured').textContent = money(v.safe);
    $('quiz-step-label').textContent = lead
      ? 'DIE NÄCHSTE FRAGE'
      : v.phase === 'locked'
        ? 'ANTWORT EINGELOGGT'
        : 'LIVE AUS DER STILLEN ABTEILUNG';
    for (let i = 1; i <= 15; i++) {
      const rung = $('quiz-rung-' + i);
      rung.classList.toggle('is-current', i === v.level);
      rung.classList.toggle('is-earned', QUIZ_LADDER[i - 1] <= v.won);
      if (i === v.level) rung.setAttribute('aria-current', 'step');
      else rung.removeAttribute('aria-current');
    }
    if (!question) {
      for (const id of ['quiz-heading', 'quiz-round', 'quiz-category', 'quiz-prize'])
        $(id).textContent = '';
      for (let i = 0; i < 4; i++) {
        const button = $('quiz-answer-' + i);
        button.querySelector('b').textContent = '';
        button.querySelector('i').textContent = '';
        button.disabled = true;
      }
    }
    if (question) {
      $('quiz-round').textContent = 'FRAGE ' + String(v.level).padStart(2, '0') + ' / 15';
      $('quiz-category').textContent = question.category;
      $('quiz-prize').textContent = money(QUIZ_LADDER[v.level - 1]);
      $('quiz-heading').textContent = question.text;
      for (let i = 0; i < 4; i++) {
        const b = $('quiz-answer-' + i),
          hidden = v.hidden.includes(i),
          correct = v.reveal?.correctIndex === i;
        b.querySelector('b').textContent = hidden ? '—' : question.answers[i];
        b.querySelector('i').textContent =
          v.phase === 'reveal' && correct
            ? '✓'
            : v.phase === 'reveal' && v.selection === i
              ? '×'
              : '';
        b.disabled = !v.can.select || hidden || m.paused;
        b.classList.toggle('is-eliminated', hidden);
        b.classList.toggle('is-selected', v.selection === i && v.phase !== 'reveal');
        b.classList.toggle('is-locked', v.selection === i && v.phase === 'locked');
        b.classList.toggle('is-correct', v.phase === 'reveal' && correct);
        b.classList.toggle('is-wrong', v.phase === 'reveal' && v.selection === i && !correct);
        b.setAttribute('aria-pressed', String(v.selection === i));
      }
    }
    $('quiz-lock').hidden = v.phase === 'reveal';
    $('quiz-lock').disabled =
      lead || (v.phase === 'locked' ? !m.canResolve : !v.can.lock) || m.paused;
    $('quiz-lock').textContent =
      v.phase === 'locked'
        ? m.canResolve
          ? 'Antwort auflösen ↗'
          : 'Eingeloggt …'
        : v.selection === null
          ? 'Antwort wählen'
          : letters[v.selection] + ' einloggen';
    $('quiz-next').hidden = v.phase !== 'reveal';
    $('quiz-next').textContent =
      v.reveal?.correct && v.level < 15 ? 'Nächste Frage ↗' : 'Zum Ergebnis ↗';
    $('quiz-next').disabled = m.paused;
    $('quiz-walk').disabled = lead || !v.can.walkAway || m.paused;
    if (!m.confirmWalk) $('quiz-walk').textContent = money(v.won) + ' mitnehmen';
    for (const kind of ['fifty', 'audience', 'phone']) {
      $('quiz-' + kind).disabled = lead || !v.jokers[kind] || !v.can.select || m.paused;
      $('quiz-' + kind).classList.toggle('is-used', !v.jokers[kind]);
    }
    $('quiz-reveal-copy').textContent =
      v.phase === 'reveal'
        ? (v.reveal.correct ? 'Richtig. ' : 'Leider falsch. ') + v.reveal.explanation
        : '';
    $('quiz-joker-card').hidden = !m.hint || v.phase !== 'question';
    if (m.hint === 'audience' && v.hints.audience)
      $('quiz-hint').innerHTML =
        '<span class="quiz-kicker">DAS PUBLIKUM HAT ABGESTIMMT</span><h3>Die Abteilung sagt …</h3><div class="quiz-votes">' +
        v.hints.audience
          .map(
            (n, i) =>
              `<div><strong>${n} %</strong><div><i style="height:${n}%"></i></div><b>${letters[i]}</b></div>`,
          )
          .join('') +
        '</div><small>Eine Meinung. Keine Gewährleistung.</small>';
    if (m.hint === 'phone' && v.hints.phone)
      $('quiz-hint').innerHTML =
        `<span class="quiz-kicker">TELEFONJOKER · IT</span><h3>Benjamin ist dran.</h3><p>${esc(v.hints.phone.line)}</p><strong class="quiz-phone-pick">Tendenz: ${letters[v.hints.phone.pick]}</strong><small>Immer da fürs Team. Meistens auch richtig.</small>`;
    if (m.hint === 'fifty')
      $('quiz-hint').innerHTML =
        '<span class="quiz-kicker">50:50</span><h3>Zwei Optionen.<br>Eine Storyline.</h3><p>Zwei falsche Antworten sind weg.</p>';
    if (v.phase === 'finished') {
      $('quiz-result-kicker').textContent =
        v.outcome === 'win'
          ? 'ALLE 15 FRAGEN RICHTIG'
          : v.outcome === 'wrong'
            ? 'DIE RUNDE IST VORBEI'
            : 'GUT BERATEN. GUT AUSGESTIEGEN.';
      $('quiz-result-title').textContent =
        v.outcome === 'win'
          ? 'Millionär der stillen Abteilung.'
          : v.payout
            ? 'Dein Wissen zahlt sich aus.'
            : 'Das war eine Lernkurve.';
      $('quiz-result-prize').textContent = money(v.payout);
      $('quiz-result-line').textContent =
        v.outcome === 'win'
          ? 'Bitte den Business Case danach noch einmal durchspülen.'
          : v.outcome === 'wrong'
            ? 'Die wichtigste Erkenntnis: Beim nächsten Mal weißt du es.'
            : 'Gewinn gesichert. Gegen jede weitere kleine Änderung.';
      $('quiz-result-payment').textContent =
        'Neu aufs Konto: ' + money(m.paid) + ' · Bestgewinn: ' + money(this.state.view().bestWin);
    }
  }
  speak(key, offset = 0, resolved = false) {
    this.stopVoice();
    const variants = QUIZ_HOST_VARIANTS[key];
    if (variants && !resolved) {
      const index = this.hostVariation.get(key) ?? Math.floor(Math.random() * variants.length);
      this.hostVariation.set(key, (index + 1) % variants.length);
      key = variants[index];
    }
    const line = QUIZ_LINES[key];
    if (!line || !this.current) return;
    const token = this.voiceToken,
      session = this.current;
    session.voiceLine = line;
    session.voiceKey = key;
    session.voiceOffset = offset;
    session.voiceStartedAt = null;
    session.voiceStatus = 'loading';
    session.voiceRequestedAt = session.clock;
    $('quiz-host-line').textContent = line.text;
    $('quiz-host').hidden = !this.g.sim.s.audioSubtitles;
    this.g.audio.bank
      ?.get(line.asset)
      .then((buffer) => {
        if (token !== this.voiceToken || this.current !== session || session.paused) return;
        if (!buffer || !this.g.audio.enabled) {
          session.voiceStatus = 'silent';
          return;
        }
        session.voice = this.g.audio.emit(buffer, {
          bus: 'dialogue',
          volume: QUIZ_HOST_VOLUME,
          offset,
        });
        session.voiceStatus = session.voice ? 'playing' : 'silent';
        session.voiceStartedAt = session.voice ? this.g.audio.ctx.currentTime : null;
        session.voiceUntil = session.clock + Math.max(0, buffer.duration - offset);
      })
      .catch(() => {
        if (token === this.voiceToken && this.current === session) session.voiceStatus = 'silent';
      });
  }
  stopVoice() {
    ++this.voiceToken;
    this.current?.voice?.stop(0.035);
    if (this.current) {
      this.current.voice = null;
      this.current.voiceUntil = 0;
      this.current.voiceLine = null;
      this.current.voiceKey = null;
      this.current.voiceStartedAt = null;
      this.current.voiceOffset = 0;
      this.current.voiceStatus = 'idle';
    }
    this.g.audio.cinematicVoice = false;
    if ($('quiz-host')) $('quiz-host').hidden = true;
  }
  pause(value) {
    const m = this.current;
    if (!m || m.paused === value) return;
    if (
      value &&
      m.voiceLine &&
      (m.voiceStartedAt === null ||
        (m.voice && !m.voice.ended && !m.voice.stopped && m.clock < m.voiceUntil))
    ) {
      m.resumeVoice = {
        key: m.voiceKey,
        offset:
          m.voiceOffset +
          (m.voiceStartedAt === null
            ? 0
            : Math.max(0, this.g.audio.ctx.currentTime - m.voiceStartedAt)),
      };
    }
    m.paused = value;
    this.stopVoice();
    this.audio.pause(value);
    if (!value && m.resumeVoice) {
      const voice = m.resumeVoice;
      m.resumeVoice = null;
      this.speak(voice.key, voice.offset, true);
    }
    this.w.keys.clear();
    this.draw();
    this.save();
    if (value) $('quiz-resume').focus?.();
    else this.focusAction();
  }
  key(e) {
    if (!this.current) return;
    if (e.code === 'Tab') {
      if (this.current.paused) {
        const first = $('quiz-resume'),
          last = $('quiz-save-exit');
        if (e.shiftKey && e.target !== last) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && e.target !== first) {
          e.preventDefault();
          first.focus();
        }
      } else this.g.trapFocus(e);
      e.stopImmediatePropagation();
      return;
    }
    if (/^(Shift|Control|Alt)/.test(e.code)) return;
    if (
      ['Enter', 'Space'].includes(e.code) &&
      e.target?.tagName === 'BUTTON' &&
      e.target.offsetParent !== null &&
      !e.target.disabled &&
      !e.target.id?.startsWith('quiz-answer-')
    )
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Escape') {
      this.pause(!this.current.paused);
      return;
    }
    if (this.current.paused) {
      if (e.code === 'Enter') this.pause(false);
      return;
    }
    const v = this.state.view();
    if (v.phase === 'intro' && ['Enter', 'Space'].includes(e.code)) this.skipIntro();
    else if (v.phase === 'question') {
      const index = ['KeyA', 'KeyB', 'KeyC', 'KeyD'].indexOf(e.code);
      if (index >= 0) this.select(index);
      else if (/^Digit[1-4]$/.test(e.code)) this.select(Number(e.code.at(-1)) - 1);
      else if (
        ['Enter', 'Space'].includes(e.code) &&
        e.target?.id?.startsWith('quiz-answer-') &&
        v.selection !== Number(e.target.dataset.answer)
      )
        this.select(Number(e.target.dataset.answer));
      else if (e.code === 'Enter') this.lock();
      else if (e.code === 'F1') this.joker('fifty');
      else if (e.code === 'F2') this.joker('audience');
      else if (e.code === 'F3') this.joker('phone');
    } else if (v.phase === 'locked' && e.code === 'Enter') this.resolveAnswer();
    else if (v.phase === 'reveal' && ['Enter', 'Space'].includes(e.code)) this.next();
    else if (v.phase === 'finished' && e.code === 'Enter') this.finish();
  }
  render(dt) {
    const m = this.current;
    if (!m) return;
    if (document.hidden) {
      this.pause(true);
      return;
    }
    dt = m.paused ? 0 : Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
    m.elapsed += dt;
    m.clock += dt;
    let v = m.view || this.state.view();
    this.audio.update(dt, { paused: m.paused, phase: v.phase, tier: Math.max(0, v.level - 1) });
    if (v.phase === 'intro' || v.phase === 'locked') m.elapsed = this.audio.presentationTime;
    if (v.phase === 'intro' && m.elapsed >= this.audio.introDuration) {
      this.state.begin();
      this.phaseEntered();
      v = this.state.view();
    }
    if (v.phase === 'locked' && m.elapsed >= this.audio.lockDuration) {
      this.state.reveal();
      this.phaseEntered();
      v = this.state.view();
    }
    if (v.phase === 'reveal' && !m.paused) {
      const ended = m.voice?.ended && !m.voice.stopped;
      const fallback =
        (!m.voice || m.voice.stopped) &&
        m.elapsed >= m.reactionDuration &&
        (m.voiceStatus !== 'loading' || m.clock - m.voiceRequestedAt >= 3);
      if (ended || fallback) {
        m.reactionCompleteAt ??= m.clock + 0.2;
        if (m.clock >= m.reactionCompleteAt) {
          this.next();
          v = this.state.view();
        }
      } else m.reactionCompleteAt = null;
    }
    if (v.phase === 'locked' && !m.canResolve && m.elapsed >= 3.2) {
      m.canResolve = true;
      this.draw();
    }
    const introShot =
      v.phase === 'intro'
        ? QUIZ_SHOW_INTRO_SHOTS.find((s) => m.elapsed < s.end) || QUIZ_SHOW_INTRO_SHOTS.at(-1)
        : null;
    if (!m.paused && introShot?.welcome && !m.welcomeSpoken) {
      m.welcomeSpoken = true;
      this.speak('intro');
    }
    if (!m.paused && v.phase === 'question' && !m.questionReady && this.audio.leadRemaining <= 0) {
      m.questionReady = true;
      m.elapsed = 0;
      this.draw();
      this.focusAction();
    }
    if (v.phase === 'question' && !m.questionReady) {
      const total = this.audio.plan[0]?.duration || 1;
      $('quiz-lead-progress').style.transform =
        'scaleX(' + Math.min(1, this.audio.presentationTime / total) + ')';
    }
    if (
      !m.paused &&
      m.pendingVoice &&
      this.audio.leadRemaining <= 0 &&
      (!m.voice || m.voice.ended || m.voice.stopped)
    ) {
      const line = m.pendingVoice;
      m.pendingVoice = null;
      this.speak(line);
    }
    const speaking = !!(
      m.voice &&
      !m.voice.ended &&
      !m.voice.stopped &&
      m.clock < m.voiceUntil &&
      !m.paused &&
      this.g.audio.enabled
    );
    this.g.audio.cinematicVoice = speaking;
    if ($('quiz-host'))
      $('quiz-host').hidden =
        !speaking || !this.g.sim.s.audioSubtitles || m.voiceKey?.startsWith('question_');
    const shot = this.stage.render(
      {
        phase:
          v.phase === 'question' && !m.questionReady
            ? 'question-lead'
            : v.phase === 'finished'
              ? v.outcome === 'win'
                ? 'win'
                : v.outcome === 'wrong'
                  ? 'lose'
                  : 'result'
              : v.phase,
        leadProgress:
          v.phase === 'question' && !m.questionReady
            ? this.audio.presentationTime / (this.audio.plan[0]?.duration || 1)
            : 0,
        level: Math.max(0, v.level - 1),
        correct: v.reveal?.correct,
        speaking,
        paused: m.paused,
        introShot: introShot?.shot,
        introProgress: introShot
          ? Math.max(0, Math.min(1, (m.elapsed - introShot.at) / (introShot.end - introShot.at)))
          : 0,
      },
      m.elapsed,
      dt,
    );
    if ($('quiz-cut')) $('quiz-cut').style.opacity = String(shot?.fade || 0);
    $('quiz-opening')?.classList.toggle('is-portal', v.phase === 'intro' && !introShot?.title);
  }
  cleanup() {
    const m = this.current;
    if (!m) return;
    this.save();
    this.stopVoice();
    this.audio.stop();
    this.current = null;
    this.g.audio.cinematicMix = m.previousMix;
    this.g.audio.cinematicVoice = m.previousVoice || false;
    this.g.audio.applyMix?.();
    this.w.yaw = m.yaw;
    this.w.pitch = m.pitch;
    this.w.distance = m.distance;
    this.w.player.visible = m.playerVisible;
    this.w.renderer.toneMappingExposure = m.exposure;
    this.w.renderer.shadowMap.autoUpdate = m.shadowAuto;
    this.w.renderer.shadowMap.needsUpdate = true;
    this.w.shadowZone = null;
    this.w.remasterPerformance?.sync();
    document.body.classList.remove('story-cinematic', 'quiz-open');
    this.w.keys.clear();
  }
  finish() {
    if (!this.current) return;
    this.cleanup();
    if (this.g.modal) {
      this.g.modal.locked = false;
      this.g.modal.onClose = null;
    }
    this.g.close();
  }
}
