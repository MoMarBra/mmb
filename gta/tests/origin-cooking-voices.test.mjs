import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORIGIN_LINES } from '../origin-lines.js';
import { measuredVoiceLine } from '../voice-timing.js';
// The candidate can be a source overlay; the assembled game has origin-state beside it.
const stateUrl = new URL('../origin-state.js', import.meta.url);
const { CookingRound, completeShift, freshOriginStory, RECIPES } = await import(
  fs.existsSync(stateUrl) ? stateUrl : new URL('../../../qa-source/origin-state.js', import.meta.url)
);
const source = fs.readFileSync(new URL('../origin-cooking.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\n/gm, '');
const prelude = `const CookingRound=${CookingRound.toString()}; const RECIPES=${JSON.stringify(RECIPES)};
const ORIGIN_LINES=${JSON.stringify(ORIGIN_LINES)}; const measuredVoiceLine=${measuredVoiceLine.toString()};
const FOOD_ART={}; const insideWok=()=>true; class QuickWokView { draw(){} }\n`;
const { OriginCooking } = await import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { id, hidden: true, textContent: '', innerHTML: '', style: {}, disabled: false,
    classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, focus() {},
  });
  return elements.get(id);
};
const windowListeners = new Map();
globalThis.window = { addEventListener(name, callback) { windowListeners.set(name, callback); } };
globalThis.document = { hidden: false, getElementById: element, addEventListener() {}, body: { classList: { add() {}, remove() {} } } };
let assertions = 0;
const check = (value, label) => { assert.ok(value, label); assertions++; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function harness(level = 0, muted = false) {
  elements.clear();
  const emitted = [], requested = [], completed = [], transactions = [];
  const buffers = new Map(ORIGIN_LINES.filter(l => l.key.startsWith('shift')).map(l => [l.asset, { duration: l.duration + 2, asset: l.asset }]));
  const state = { ...freshOriginStory(), phase: 'shifts', level };
  const sim = { s: { originStory: state, audioSubtitles: true }, save() {}, transaction(amount, label) { transactions.push({ amount, label }); } };
  const audio = { ready: true, enabled: !muted, ctx: { currentTime: 100, state: 'running' }, voices: { stop() {} }, update() {},
    bank: { buffers, async preload() {}, async get(id) { requested.push(id); return buffers.get(id) || null; } },
    emit(buffer, options = {}) {
      if (!buffer) return null;
      const handle = { buffer, ...options, startedAt: this.ctx.currentTime, stopped: false, ended: false, stop() { this.stopped = true; } };
      emitted.push(handle); return handle;
    },
  };
  const g = { sim, audio, arcade: { music: {} }, modal: null, open() { this.modal = { locked: true }; }, close() { this.modal = null; }, toast() {} };
  const story = { g, w: {}, active: true, state, stopVoice() { audio.cinematicVoice = false; }, shiftComplete(round) { completed.push(completeShift(sim, round)); } };
  const cooking = new OriginCooking(story);
  let wall = 100;
  cooking.voiceTime = () => wall;
  const step = (dt = .1, audioDt = dt) => {
    wall += dt;
    if (audio.ctx.state === 'running') audio.ctx.currentTime += audioDt;
    for (const h of emitted) if (!h.stopped && audio.ctx.currentTime >= h.startedAt + h.buffer.duration - (h.offset || 0)) h.ended = true;
    cooking.render(dt);
  };
  const advance = (seconds, audioMoves = true) => { for (let n = 0; n < Math.ceil(seconds / .1); n++) step(.1, audioMoves ? .1 : 0); };
  const until = (predicate, limit = 80) => { for (let n = 0; n < limit * 10 && !predicate(); n++) step(); check(predicate(), 'bounded controller progression reaches expected state'); };
  const voices = () => emitted.filter(h => h.bus === 'dialogue');
  return { cooking, story, audio, emitted, requested, completed, transactions, step, advance, until, voices, jump(seconds) { wall += seconds; cooking.render(.1); } };
}

// All twelve existing lines become reachable via unchanged real CookingRound rules.
for (let level = 0; level < 4; level++) {
  const h = harness(level), { cooking: c, audio, voices, until, advance } = h;
  await c.start(level);
  check(c.current?.voice.line.key === `shift${level + 1}_support`, 'each round opens with its matching support line');
  check(voices().length === 1 && !element('cook-dialogue').hidden, 'support emits once with visible caption');
  check(element('cook-line').textContent === c.current.voice.line.text, 'caption preserves approved script exactly');
  const owner = c.current; await c.start(level);
  check(c.current === owner && voices().length === 1, 'duplicate start cannot repeat support');
  if (level === 0) {
    let unlocks = 0; audio.unlockOnInput = e => { if (e.isTrusted) unlocks++; };
    windowListeners.get('keydown')({ code: 'Enter', isTrusted: true, target: { tagName: 'BUTTON' } });
    check(unlocks === 1, 'captured cooking input reaches the audio unlock before native button handling');
    advance(1);
    const old = c.current.voice.handle;
    c.pause(true);
    const offset = c.current.voice.offset, elapsed = c.current.elapsed;
    check(old.stopped && offset > .9 && offset < 1.1 && element('cook-dialogue').hidden, 'pause stops owned recording and stores actual audio offset');
    advance(20);
    check(c.current.elapsed === elapsed && c.current.voice.offset === offset, 'pause freezes gameplay and caption progress');
    c.pause(false);
    check(c.current.voice.handle !== old && c.current.voice.handle.offset === offset, 'resume continues measured recording from owned offset');
    check(!element('cook-dialogue').hidden && voices().filter(v => !v.stopped && !v.ended).length === 1, 'resume exposes caption with only one live recording');
  }
  until(() => !c.current.voice);
  c.choose(0); c.choose(1); c.choose(2);
  until(() => c.current.round.phase === 'failed');
  c.sync(); c.sync(); c.render(0);
  check(c.current.voice?.line.key === `shift${level + 1}_fail`, 'real burned round uses its matching failure recording');
  check(c.current.voiceQueue.length === 0 && !c.current.resultVoiceDone, 'repeated result sync does not queue duplicate failure');
  until(() => c.current.resultVoiceDone);
  check(h.transactions.length === 0 && h.completed.length === 0, 'failure neither awards nor advances');
  element('cook-retry').onclick(); await flush();
  check(c.current?.round.level === level && c.current.voice.line.key === `shift${level + 1}_support`, 'actual Retry starts a fresh matching support cue');
  c.choose(0); c.choose(1); c.choose(2); c.keys.add('Space');
  until(() => c.current.round.phase === 'done'); c.render(0);
  check(c.current.voice?.line.key === `shift${level + 1}_success`, 'real held-stir success plays its matching success recording');
  const resultHandle = c.current.voice.handle;
  check(c.current.voice.duration === resultHandle.buffer.duration, 'decoded recording duration wins over metadata');
  advance(12, false);
  check(!!c.current && !resultHandle.stopped && h.transactions.length === 0, 'result cannot auto-advance at 1.25s or wall time while recorded audio is unfinished');
  until(() => !c.current);
  check(h.completed.length === 1 && h.transactions.length === 1 && h.transactions[0].amount === RECIPES[level].reward, 'completion preserves exact once-only round reward');
  c.finish(true);
  check(h.transactions.length === 1 && h.story.state.level === level + 1, 'repeated finish cannot repeat progression or payment');
  const expected = [`shift${level + 1}_support`, `shift${level + 1}_fail`, `shift${level + 1}_success`].map(key => ORIGIN_LINES.find(l => l.key === key).asset);
  check(expected.every(asset => voices().some(h => h.buffer.asset === asset)), 'support/failure/success audio assets are all reached');
}

// Fast terminal states queue their response after support instead of overlapping it.
{
  const h = harness(), c = h.cooking; await c.start(0);
  const support = c.current.voice.handle;
  c.current.round.phase = 'failed'; c.sync(); c.sync(); c.render(0);
  check(c.current.voice.kind === 'support' && c.current.voiceQueue.length === 1, 'result queues behind a still-playing support line');
  check(h.voices().length === 1 && !support.stopped, 'queued result does not truncate support');
  h.until(() => c.current.voice?.kind === 'fail');
  check(support.ended && h.voices().filter(h => !h.stopped && !h.ended).length === 1, 'response begins only after previous recording ended');
  c.finish(false); check(h.voices().every(h => h.stopped || h.ended), 'close stops all cooking narration');
}

// Muted and missing clips retain readable, bounded, pause-aware captions.
{
  const h = harness(0, true), c = h.cooking; await c.start(0);
  check(c.current.voice.status === 'silent' && !h.requested.length && !h.voices().length, 'muted support neither downloads nor emits');
  check(!element('cook-dialogue').hidden, 'muted support still captions');
  h.story.g.sim.s.audioSubtitles = false; c.render(0); check(element('cook-dialogue').hidden, 'subtitle-off hides cooking caption');
  h.story.g.sim.s.audioSubtitles = true; c.render(0); check(!element('cook-dialogue').hidden, 'subtitle-on restores owned caption');
  h.advance(1); const elapsed = c.current.voice.elapsed; c.pause(true); h.advance(30); c.pause(false);
  check(c.current.voice.elapsed === elapsed, 'silent caption resumes remaining duration after pause');
  h.audio.enabled = true; c.render(0); check(!h.voices().length, 'unmuting does not restart an old silent line');
  h.until(() => !c.current.voice); c.finish(false);
}
{
  const h = harness(), c = h.cooking; h.audio.bank.buffers.clear(); h.audio.bank.get = async () => { throw Error('offline'); };
  await c.start(0); await flush();
  check(c.current.voice.status === 'silent' && !h.voices().length && !element('cook-dialogue').hidden, 'failed fetch falls back to matching caption');
  h.until(() => !c.current.voice);
  c.choose(0); c.choose(1); c.choose(2); c.keys.add('Space');
  h.until(() => c.current.round.phase === 'done'); c.render(0); await flush();
  check(c.current.voice.kind === 'success' && c.current.voice.status === 'silent', 'missing result asset preserves success caption');
  const duration = c.current.voice.duration; h.advance(duration - .3);
  check(!!c.current && !h.completed.length, 'silent success waits metadata duration');
  h.until(() => !c.current); check(h.completed.length === 1, 'silent fallback eventually advances without trapping result');
}

{
  const h = harness(0, true); await h.cooking.start(0);
  h.jump(20);
  check(!h.cooking.current.voice, 'silent captions remain wall-time bounded under throttled rendering');
  h.cooking.finish(false);
}

// Loading ownership is invalidated on timeout, close, retry and pause.
{
  const h = harness(), c = h.cooking, pending = deferred();
  h.audio.bank.buffers.clear(); h.audio.bank.get = () => pending.promise;
  await c.start(0); check(c.current.voice.status === 'loading', 'missing cached cue enters loading ownership');
  h.advance(20); check(!c.current.voice && !h.voices().length, 'loading caption has a bounded fallback deadline');
  pending.resolve({ duration: 10, asset: 'late' }); await flush();
  check(!c.current.voice && !h.voices().length, 'late load cannot resurrect expired caption/audio'); c.finish(false);
}
{
  const h = harness(), c = h.cooking, pending = deferred();
  h.audio.bank.buffers.clear(); h.audio.bank.get = () => pending.promise;
  await c.start(0); c.finish(false); pending.resolve({ duration: 10, asset: 'late' }); await flush();
  check(!c.current && !h.voices().length && element('cook-dialogue').hidden, 'close invalidates a pending load');
}
{
  const h = harness(), c = h.cooking, old = deferred(), fresh = deferred(); let calls = 0;
  h.audio.bank.buffers.clear(); h.audio.bank.get = () => (++calls === 1 ? old.promise : fresh.promise);
  await c.start(0); c.current.round.phase = 'failed'; c.sync(); element('cook-retry').onclick(); await flush();
  old.resolve({ duration: 10, asset: 'old' }); await flush();
  check(!h.voices().length && c.current.round.phase === 'prep', 'retry rejects the previous attempt pending narration');
  fresh.resolve({ duration: 7, asset: 'fresh' }); await flush();
  check(h.voices().length === 1 && h.voices()[0].buffer.asset === 'fresh', 'only fresh retry owns playback'); c.finish(false);
}
{
  const h = harness(), c = h.cooking, pending = deferred();
  h.audio.bank.buffers.clear(); h.audio.bank.get = () => pending.promise;
  await c.start(0); c.pause(true); pending.resolve({ duration: 7, asset: 'paused' }); await flush();
  check(!h.voices().length && c.current.voice.status === 'paused', 'load finishing while paused cannot emit');
  c.pause(false); await flush();
  check(h.voices().length === 1 && c.current.voice.status === 'playing', 'resume reacquires pending line once'); c.finish(false);
}
{
  const h = harness(), c = h.cooking; await c.start(0); h.advance(1);
  const old = c.current.voice.handle; h.audio.enabled = false; c.render(0);
  check(old.stopped && c.current.voice.status === 'silent' && !element('cook-dialogue').hidden, 'mid-line mute stops audio but retains remaining caption');
  const offset = c.current.voice.offset; h.audio.enabled = true; c.render(0);
  check(h.voices().length === 1 && c.current.voice.offset === offset, 'unmute never restarts interrupted cooking line');
  h.until(() => !c.current.voice); c.finish(false);
}
console.log(JSON.stringify({ passed: true, assertions, scope: 'Production OriginCooking and CookingRound rules with deterministic Web Audio/DOM. Covers all 12 cue paths, real burn/retry/held-stir success, exact reward, measured result gating, no overlap, pause offsets, subtitle/mute settings, and stale/failed loads. Browser layout and subjective audio remain separate.' }, null, 2));
