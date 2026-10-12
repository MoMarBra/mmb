import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUIZ_LINES, QUIZ_HOST_VARIANTS } from '../quiz-lines.js';
import { measuredVoiceLine, quizIntroVoiceFinished, quizVoiceFinished } from '../voice-timing.js';

// Exercise production controller methods with lightweight DOM/audio/stage fixtures.
// Shot fixtures preserve the intentional distinction: short intros have no welcome cue.
const nodes = new Map();
const node = (id) => {
  if (!nodes.has(id))
    nodes.set(id, { hidden: true, style: {}, focus() {}, classList: { toggle() {} } });
  return nodes.get(id);
};
globalThis.document = { hidden: false, getElementById: node };
const source = fs.readFileSync(new URL('../quizssoir.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');
const prelude = `
const QUIZ_LINES = ${JSON.stringify(QUIZ_LINES)};
const QUIZ_HOST_VARIANTS = ${JSON.stringify(QUIZ_HOST_VARIANTS)};
const measuredVoiceLine = ${measuredVoiceLine.toString()};
const quizVoiceFinished = ${quizVoiceFinished.toString()};
const quizIntroVoiceFinished = ${quizIntroVoiceFinished.toString()};
const QUIZ_SHORT_INTRO_SHOTS = [{at:0,end:5,shot:'duo'}];
const QUIZ_SHOW_INTRO_SHOTS = [{at:0,end:34.22,shot:'host'},{at:34.22,end:45.22,shot:'duo',welcome:true}];
`;
const { Quizssoir } = await import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\n//# sourceURL=quiz-voice-controller-fixture.js').toString('base64'));
let assertions = 0;
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  assertions++;
};
const near = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: ${actual} vs ${expected}`);
  assertions++;
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function harness({ phase = 'intro', shortIntro = false, mode = 'classic', enabled = true } = {}) {
  const view = { phase, mode, level: 1, reveal: { correct: true } };
  const m = {
    phase, view, shortIntro, elapsed: 0, clock: 0, paused: false,
    welcomeSpoken: false, reactionDuration: 3.5, questionReady: true,
  };
  const calls = { begins: 0, reveals: 0, next: 0, emissions: 0 };
  const audio = {
    enabled, ctx: { currentTime: 0, state: 'running' }, start() {},
    bank: { buffers: new Map(), get: async () => ({ duration: 20 }) },
    emit(buffer, options) {
      calls.emissions++;
      return { ended: false, stopped: false, offset: options.offset, stop() { this.stopped = true; } };
    },
  };
  const c = Object.assign(Object.create(Quizssoir.prototype), {
    current: m, g: { sim: { s: { audioSubtitles: true } }, audio },
    voiceToken: 0, hostVariation: new Map(), w: { keys: new Set() },
    audio: {
      presentationTime: 0, introDuration: shortIntro ? 5 : 45.22, lockDuration: 4.2,
      leadRemaining: 1, update(dt) { this.presentationTime += dt; }, pause() {},
    },
    stage: { render(options) { calls.speaking = options.speaking; return {}; } },
    state: {
      view: () => view,
      reveal() { calls.reveals++; view.phase = 'reveal'; },
    },
    finishEntrance() { calls.begins++; view.phase = 'question'; },
    phaseEntered() { m.phase = view.phase; m.questionReady = true; m.elapsed = 0; this.stopVoice(); },
    next() { calls.next++; view.phase = 'question'; this.phaseEntered(); },
    draw() {}, save() {}, focusAction() {},
  });
  const tick = (seconds) => { for (let i = 0; i < Math.round(seconds * 10); i++) c.render(0.1); };
  return { c, m, audio, view, calls, tick };
}

// Intentional no-welcome intros finish in both returning Classic and Coffee modes.
for (const mode of ['classic', 'coffee']) {
  const h = harness({ shortIntro: true, mode });
  h.tick(6);
  equal(h.calls.begins, 1, `${mode} short intro begins once`);
  equal(h.m.welcomeSpoken, false, `${mode} short intro needs no spoken welcome`);
}
equal(quizIntroVoiceFinished({ shortIntro: false, welcomeSpoken: false }), false, 'full replay still requires welcome');
equal(quizIntroVoiceFinished({ shortIntro: true, welcomeSpoken: true, voiceStatus: 'playing', voice: { ended: false, stopped: false }, clock: 50, voiceUntil: 2 }), false, 'a started voice remains gated even on a short intro');

// A visible AudioContext interruption consumes no speech despite continuing RAF.
for (const phase of ['intro', 'locked', 'reveal']) {
  const h = harness({ phase });
  h.m.welcomeSpoken = true;
  h.c.speak('intro');
  await flush();
  const handle = h.m.voice;
  h.c.audio.presentationTime = 46;
  h.c.audio.update = () => {};
  h.audio.ctx.state = 'interrupted';
  h.tick(25);
  equal(h.view.phase, phase, `${phase} waits for actual live voice end`);
  equal(handle.stopped, false, `${phase} never cuts interrupted speech`);
  equal(node('quiz-host').hidden, false, `${phase} retains interrupted voice caption`);
  equal(h.calls.speaking, false, `${phase} does not animate inaudible speech`);
  handle.ended = true;
  h.tick(0.5);
  equal(phase === 'intro' ? h.calls.begins : phase === 'locked' ? h.calls.reveals : h.calls.next, 1, `${phase} proceeds after onended`);
}

// Muted clips use decoded duration; missing/rejected clips use script duration.
for (const kind of ['muted', 'missing', 'rejected', 'no-handle']) {
  const h = harness({ phase: 'question', enabled: kind !== 'muted' });
  if (kind === 'missing') h.audio.bank.get = async () => null;
  if (kind === 'rejected') h.audio.bank.get = async () => { throw Error('test failure'); };
  if (kind === 'no-handle') h.audio.emit = () => null;
  h.c.speak('intro');
  await flush();
  equal(h.m.voiceStatus, 'silent', `${kind} uses silent lifetime`);
  const duration = ['muted', 'no-handle'].includes(kind) ? 20 : QUIZ_LINES.intro.duration;
  near(h.m.voiceUntil, duration, `${kind} uses measured/script duration`);
  h.c.render(0.1);
  equal(node('quiz-host').hidden, false, `${kind} caption remains readable`);
  h.m.clock = duration - 0.05;
  h.c.render(0);
  equal(node('quiz-host').hidden, false, `${kind} caption lasts through its reading time`);
  h.c.render(0.1);
  equal(node('quiz-host').hidden, true, `${kind} caption ends at bounded time`);
}

// Silent captions resume only their remaining measured time; completed captions stay done.
{
  const h = harness({ phase: 'question', enabled: false });
  h.c.speak('intro'); await flush();
  h.m.clock = 7;
  h.c.pause(true);
  near(h.m.resumeVoice.offset, 7, 'silent pause retains caption progress');
  near(h.m.resumeVoice.duration, 20, 'silent pause retains measured duration');
  h.tick(30);
  near(h.m.clock, 7, 'paused caption clock stays frozen');
  equal(node('quiz-host').hidden, true, 'pause hides the caption behind pause UI');
  h.c.pause(false); await flush();
  near(h.m.voiceUntil - h.m.clock, 13, 'silent resume keeps only unread remainder');
  h.c.render(0);
  equal(node('quiz-host').hidden, false, 'silent resume restores caption');
  h.m.clock = h.m.voiceUntil + 0.1;
  h.c.pause(true);
  equal(h.m.resumeVoice, null, 'finished silent caption is not replayed');
}

// Audio resumption uses AudioContext progress, including a delayed buffer reacquire.
{
  const h = harness({ phase: 'intro' });
  h.m.welcomeSpoken = true;
  h.m.clock = 10; h.audio.ctx.currentTime = 100;
  h.c.speak('intro'); await flush();
  h.m.clock = 17; h.audio.ctx.currentTime = 107;
  h.c.pause(true);
  near(h.m.resumeVoice.offset, 7, 'audible pause retains audio offset');
  h.audio.ctx.currentTime = 120;
  const d = deferred(); h.audio.bank.get = () => d.promise;
  h.c.pause(false);
  near(h.m.voiceUntil - h.m.clock, 13, 'reload retains prior measured duration');
  h.m.clock = 19; h.audio.ctx.currentTime = 122;
  d.resolve({ duration: 20 }); await flush();
  near(h.m.voiceOffset, 7, 'reacquired audio starts at correct offset');
  near(h.m.voiceUntil - h.m.clock, 13, 'reacquired audio has full remaining duration');
  near(h.m.voiceStartedAt, 122, 'audio start timestamp refreshed');
}

// Failed/loading clips remain bounded, without racing away before readable captions end.
{
  const h = harness({ phase: 'intro' });
  h.m.welcomeSpoken = true;
  h.c.audio.presentationTime = 46;
  h.c.audio.update = () => {};
  const d = deferred(); h.audio.bank.get = () => d.promise;
  h.c.speak('intro');
  h.tick(3.2);
  equal(h.calls.begins, 0, 'loading fallback preserves full caption reading time');
  h.tick(3);
  equal(h.calls.begins, 1, 'never-resolving voice cannot trap intro');
  d.resolve({ duration: 20 }); await flush();
  equal(h.calls.emissions, 0, 'timed-out stale voice cannot emit after transition');
}

// Silent automatic lock/reveal wait for caption completion too; explicit controls are unchanged.
for (const phase of ['locked', 'reveal']) {
  const h = harness({ phase, enabled: false });
  h.c.audio.presentationTime = 46;
  h.c.speak('intro'); await flush();
  h.tick(5);
  equal(h.view.phase, phase, `${phase} does not cut long silent captions`);
  h.tick(16);
  equal(phase === 'locked' ? h.calls.reveals : h.calls.next, 1, `${phase} finishes after caption lifetime`);
}

// A global mute during playback retains captions; the subtitle preference still wins.
{
  const h = harness({ phase: 'question' });
  h.c.speak('intro'); await flush();
  const handle = h.m.voice;
  h.audio.enabled = false;
  h.c.render(0.1);
  equal(node('quiz-host').hidden, false, 'mid-clip mute preserves caption');
  equal(h.calls.speaking, false, 'mid-clip mute stops mouth animation');
  h.c.g.sim.s.audioSubtitles = false;
  h.c.render(0.1);
  equal(node('quiz-host').hidden, true, 'explicit subtitles-off is respected');
  h.c.g.sim.s.audioSubtitles = true;
  h.audio.enabled = true;
  h.c.render(0.1);
  equal(h.m.voice, handle, 'unmute keeps the existing voice handle');
  equal(node('quiz-host').hidden, false, 'caption returns when enabled');
  handle.ended = true;
  h.c.render(0.1);
  equal(node('quiz-host').hidden, true, 'ended voice hides caption');
}

// Pausing a pending fetch invalidates it; resuming starts one fresh request at offset zero.
{
  const h = harness({ phase: 'question' });
  const old = deferred();
  h.audio.bank.get = () => old.promise;
  h.c.speak('intro');
  h.m.clock = 2;
  h.c.pause(true);
  near(h.m.resumeVoice.offset, 0, 'loading pause does not skip unheard speech');
  const resumed = deferred();
  h.audio.bank.get = () => resumed.promise;
  h.c.pause(false);
  old.resolve({ duration: 20 }); await flush();
  equal(h.calls.emissions, 0, 'pre-pause fetch is stale after resume');
  resumed.resolve({ duration: 20 }); await flush();
  equal(h.calls.emissions, 1, 'resumed fetch emits exactly once');
}
console.log(JSON.stringify({ passed: true, assertions, scope: 'Production Quizssoir speak/pause/render and voice completion helpers with mocked DOM, audio handles and short/full shot fixtures; no browser or subjective listening.' }, null, 2));
