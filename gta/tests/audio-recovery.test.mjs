import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOICE_LINES } from '../voice-lines.js';

// Exercise the actual controllers, with deterministic network, Web Audio and DOM
// seams. Import substitution keeps this focused test independent of WebGL/assets.
const fixtures = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => [id, { path: id }]));
async function load(file, prelude) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '');
  return import('data:text/javascript;base64,' + Buffer.from(prelude + '\n' + source).toString('base64'));
}
const { AudioBank } = await load('audio-bank.js', `const AUDIO_ASSETS=${JSON.stringify(fixtures)};`);
const { DialogueDirector } = await load('dialogue.js', `const VOICE_LINES=${JSON.stringify(VOICE_LINES)}; const mountColleagueConversation=()=>false;`);
const { Soundscape } = await load('audio-engine.js', 'const LOOP_REQUEST_METHODS={};');
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const sample = (duration = 4, length = 10, numberOfChannels = 2) => ({ duration, length, numberOfChannels });
const response = (status = 200) => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => new ArrayBuffer(4) });
const original = { fetch: globalThis.fetch, now: Date.now, document: globalThis.document, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
let clock = 100000;
Date.now = () => clock;
globalThis.document = { getElementById: () => null };
try {
  // Every transient category recovers on the next eligible request, never on a timer.
  for (const failure of ['network', 'body', 408, 429, 500, 503]) {
    let requests = 0;
    const buffer = sample();
    const bank = new AudioBank({ decodeAudioData: async () => buffer });
    globalThis.fetch = async () => {
      requests++;
      if (requests > 1) return response();
      if (failure === 'network') throw TypeError('offline');
      if (failure === 'body') return { ...response(), arrayBuffer: async () => { throw TypeError('connection lost'); } };
      return response(failure);
    };
    check(await bank.get('a') === null, `${failure}: initial failure resolves silently`);
    check(bank.pending.size === 0 && bank.loading === 0, `${failure}: failed slot is released before caller resumes`);
    check(await bank.get('a') === null && requests === 1, `${failure}: cooldown blocks immediate retry`);
    clock += bank.retryDelay;
    await flush();
    check(requests === 1, `${failure}: elapsed cooldown does not initiate a fetch`);
    check(await bank.get('a') === buffer && requests === 2, `${failure}: requested retry recovers`);
    check(!bank.failures.has('a') && !bank.retryState.has('a'), `${failure}: recovery clears failure state`);
    check(bank.bytes === 80 && bank.status.decoded === 1, `${failure}: retry is counted once in cache`);
  }

  // Timeout abort is retryable; the only timer is the bounded active-fetch timeout.
  {
    let timer, cleared = 0, requests = 0;
    globalThis.setTimeout = (fn, delay) => { check(delay === 15000, 'fetch timeout remains 15 seconds'); timer = fn; return 1; };
    globalThis.clearTimeout = () => { cleared++; };
    globalThis.fetch = async (_url, { signal }) => {
      requests++;
      if (requests > 1) return response();
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(Error('aborted'), { name: 'AbortError' }))));
    };
    const bank = new AudioBank({ decodeAudioData: async () => sample() });
    const first = bank.get('a'); timer();
    check(await first === null && cleared === 1, 'aborted fetch releases its timer');
    clock += bank.retryDelay;
    check(!!await bank.get('a') && requests === 2, 'timeout can recover on next request');
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
  }

  // Three attempts total, exponential cooldown, and explicit Retry reset compatibility.
  {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return response(503); };
    const bank = new AudioBank({ decodeAudioData: async () => sample() });
    await bank.get('a'); clock += 1000; await bank.get('a');
    clock += 1999; await bank.get('a');
    check(requests === 2, 'second failure waits the full doubled cooldown');
    clock++; await bank.get('a'); clock += 1000000;
    await Promise.all(Array.from({ length: 25 }, () => bank.get('a')));
    check(requests === 3 && bank.retryState.get('a').attempts === 3, 'automatic attempts remain capped under repeated callers');
    bank.failures.delete('a'); globalThis.fetch = async () => { requests++; return response(); };
    check(!!await bank.get('a') && requests === 4, 'existing explicit Retry controls can reset exhausted failures');
  }

  // Permanent HTTP and decode failures remain stopped rather than redownloading.
  for (const failure of [400, 401, 403, 404, 410, 'decode', 'embedded']) {
    let requests = 0, decodes = 0;
    globalThis.fetch = async () => { requests++; return response(typeof failure === 'number' ? failure : 200); };
    const bank = new AudioBank({ decodeAudioData: async () => { decodes++; if (failure === 'decode') throw Error('invalid codec'); return sample(); } });
    if (failure === 'embedded') bank.embedded = { a: '*' };
    check(await bank.get('a') === null, `${failure}: permanent failure resolves silently`);
    clock += 100000;
    await bank.get('a');
    check(requests === (failure === 'embedded' ? 0 : 1), `${failure}: no automatic retry for permanent failure`);
    check(bank.retryState.get('a').retryable === false && bank.bytes === 0, `${failure}: cache stays empty`);
    if (failure === 'decode') check(decodes === 1, 'invalid audio is not decoded repeatedly');
  }

  {
    let requests = 0;
    const retry = deferred();
    globalThis.fetch = async () => { requests++; return requests === 1 ? response(503) : retry.promise; };
    const bank = new AudioBank({ decodeAudioData: async () => sample() });
    check(bank.limit === 64 * 1024 * 1024, 'default decoded cache remains 64 MiB');
    check(await bank.get('unknown') === null && requests === 0, 'unknown IDs never download or acquire failure state');
    await bank.get('a'); clock += bank.retryDelay;
    const first = bank.get('a'), second = bank.get('a', { priority: true });
    check(first === second && requests === 2, 'eligible retry is shared by simultaneous callers');
    retry.resolve(response()); await Promise.all([first, second]);
    check(bank.bytes === 80 && bank.status.cached === 1 && !bank.failures.size, 'shared recovery caches only one decoded buffer');
  }

  // Four active loads, pending identity/dedup, priority promotion and LRU accounting.
  {
    const gates = new Map(), started = [];
    globalThis.fetch = id => { started.push(id); const d = deferred(); gates.set(id, d); return d.promise; };
    const bank = new AudioBank({ decodeAudioData: async () => sample() });
    const a = bank.get('a'), jobs = ['b', 'c', 'd', 'e', 'f'].map(id => bank.get(id));
    check(bank.get('a', { priority: true }) === a && started.length === 4, 'concurrent callers share one active promise');
    check(bank.get('f', { priority: true }) === jobs[4], 'queued priority request retains promise identity');
    check(bank.queue[0].id === 'f' && bank.loading === 4, 'foreground request moves ahead without exceeding four loads');
    gates.get('a').resolve(response()); await a;
    check(started[4] === 'f' && bank.loading === 4, 'released slot starts the prioritized asset');
    for (const id of ['b', 'c', 'd', 'f']) gates.get(id).resolve(response());
    await flush(); gates.get('e').resolve(response()); await Promise.all(jobs);
    check(started.length === 6 && bank.bytes === 480 && bank.pending.size === 0, 'deduplicated loads retain exact cache bytes');
    const bytes = bank.bytes; await bank.get('a');
    check(bank.bytes === bytes && [...bank.buffers.keys()].at(-1) === 'a', 'cache hit updates recency without duplicate accounting');
    bank.limit = 160;
    const g = bank.get('g'); gates.get('g').resolve(response()); await g;
    check(bank.bytes === 160 && bank.buffers.size === 2 && bank.buffers.has('a'), 'LRU eviction retains recent buffers and exact budget');
    const b = bank.get('b'); gates.get('b').resolve(response()); await b;
    check(bank.bytes === 160 && bank.status.decoded === 7, 'redecoding an evicted buffer does not inflate unique count');
  }

  // Real bank recovery and a cancelled caller cannot resurrect its old dialogue.
  const element = () => ({ hidden: true, isConnected: true, innerHTML: '', classList: { toggle() {} }, setAttribute() {} });
  globalThis.document = { getElementById: () => null, createElement: element, body: { append() {} } };
  const line = VOICE_LINES.find(line => line.id === 'lena_greet');
  const second = VOICE_LINES.find(line => line.id === 'tobias_greet');
  function harness() {
    let wall = 50, fetches = 0, emissions = 0, stops = 0, starts = 0, saves = 0;
    const audio = Object.assign(Object.create(Soundscape.prototype), {
      ready: true, enabled: true, active: true, ctx: { currentTime: 10, state: 'running' },
      sim: { s: { audioEnabled: true, audioSubtitles: true }, save() { saves++; } },
      bank: { buffers: new Map(), async get() { fetches++; return sample(8); } },
      emit() { emissions++; return { stop() { stops++; } }; },
      start() { starts++; }, applyMix() {}, sceneGate: { gain: { setTargetAtTime() {} } },
    });
    const voices = audio.voices = new DialogueDirector(audio);
    voices.captionTime = () => wall;
    return { audio, voices, advance(seconds) { wall += seconds; if (audio.ctx.state === 'running') audio.ctx.currentTime += seconds; }, counts: () => ({ fetches, emissions, stops, starts, saves }) };
  }
  {
    const { audio, voices, counts } = harness();
    let requests = 0;
    const failedRequest = deferred();
    globalThis.fetch = async () => { requests++; return requests === 1 ? failedRequest.promise : response(); };
    const bank = new AudioBank({ decodeAudioData: async () => sample(6.5) });
    audio.bank = { buffers: bank.buffers, get: () => bank.get('a') };
    const abandoned = voices.say('Lena', 'greet', { id: line.id });
    voices.stop(); failedRequest.reject(TypeError('offline'));
    check(await abandoned === false && !voices.current && counts().emissions === 0, 'failed bank request cannot resurrect a closed dialogue');
    clock += bank.retryDelay;
    check(await voices.say('Lena', 'greet', { id: line.id }), 'new dialogue retries the recovered bank request');
    check(requests === 2 && counts().emissions === 1 && voices.current.ends === 16.5, 'only the fresh owner emits recovered measured audio');
    voices.stop();
  }
  {
    const { audio, voices } = harness();
    const requests = [];
    audio.bank.get = async (id, options) => { requests.push({ id, options }); return sample(); };
    await voices.say('Lena', 'ambient', { id: line.id, force: true });
    check(requests.at(-1).options.priority === false, 'ambient event keeps background download priority');
    await voices.say('Lena', 'greet', { id: line.id, force: true, ambient: true });
    check(requests.at(-1).options.priority === false, 'proximity ambient greeting keeps background priority');
    await voices.say('Lena', 'greet', { id: line.id, force: true, preview: true });
    check(requests.at(-1).options.priority === true, 'explicit office/preview dialogue requests foreground priority');
    voices.stop();
  }
  {
    const { audio, voices, counts } = harness();
    const gates = new Map(), started = [];
    globalThis.fetch = id => { started.push(id); const d = deferred(); gates.set(id, d); return d.promise; };
    const bank = new AudioBank({ decodeAudioData: async () => sample(6) });
    const jobs = new Map(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => [id, bank.get(id)]));
    audio.bank = { buffers: bank.buffers, get: (_id, options) => bank.get('f', options) };
    const saying = voices.say('Lena', 'greet', { id: line.id, force: true });
    check(bank.queue.map(j => j.id).join(',') === 'f,e,g', 'explicit dialogue promotes its existing queued asset ahead of startup preloads');
    check(bank.loading === 4 && bank.pending.get('f') === jobs.get('f'), 'foreground promotion preserves active slot cap and pending deduplication');
    gates.get('a').resolve(response()); await jobs.get('a');
    check(started[4] === 'f', 'next freed slot loads explicit speech before queued background audio');
    gates.get('f').resolve(response()); await saying;
    check(voices.current?.line.id === line.id && counts().emissions === 1, 'promoted dialogue keeps caption/voice ownership and emits once');
    for (const id of ['b', 'c', 'd']) gates.get(id).resolve(response());
    await flush();
    for (const id of ['e', 'g']) gates.get(id).resolve(response());
    await Promise.all(jobs.values());
    check(bank.pending.size === 0 && bank.bytes === 560, 'promotion leaves background completion and cache accounting unchanged');
    voices.stop();
  }
  {
    const { audio, voices, counts, advance } = harness();
    audio.enabled = false; audio.ctx.state = 'suspended';
    check(await voices.say('Lena', 'greet', { id: line.id }), 'muted explicit dialogue starts');
    check(voices.caption.innerHTML.includes(line.text) && !voices.caption.hidden, 'muted caption shows matching line');
    check(counts().fetches === 0 && counts().emissions === 0, 'text-only line neither fetches nor emits');
    check(voices.current.ends === 10 + line.duration, 'text-only duration comes from metadata');
    advance(line.duration - 0.01); voices.tick(); check(!!voices.current, 'suspended caption remains until its full duration');
    advance(0.02); voices.tick(); check(!voices.current && voices.caption.hidden, 'suspended caption expires on bounded fallback clock');
    advance(3); check(await voices.say('Lena', 'greet', { id: line.id }), 'suspended mute does not freeze actor cooldown');
    voices.stop();
    check(!await voices.say('Lena', 'ambient', { ambient: true, force: true }), 'muted ambient chatter stays suppressed');
  }
  {
    const { audio, voices, counts } = harness();
    audio.enabled = false;
    audio.bank.buffers.set('voice_' + line.id, sample(9.25));
    await voices.say('Lena', 'greet', { id: line.id, offset: 1.25 });
    check(voices.current.ends === 18 && counts().fetches === 0, 'cached measured duration and offset win without fetching');
    audio.sim.s.audioSubtitles = false; voices.tick(); check(voices.caption.hidden, 'subtitle-off remains respected while muted');
    audio.sim.s.audioSubtitles = true; voices.tick(); check(!voices.caption.hidden, 'subtitle-on restores active muted caption');
    voices.stop(); check(!voices.current && voices.caption.hidden, 'close cancels muted caption');
  }
  {
    const { audio, voices, counts, advance } = harness();
    await voices.say('Lena', 'greet', { id: line.id });
    const owner = voices.current;
    voices.queue.push({ actor: 'Tobias', id: second.id });
    check(audio.toggle() === false && voices.current === owner, 'global mute preserves current caption owner');
    check(counts().stops === 1 && !voices.current.handle && !voices.caption.hidden, 'mute stops the audible handle without hiding subtitle');
    check(voices.queue.length === 1 && audio.sim.s.audioEnabled === false, 'mute preserves queue and persists setting');
    audio.toggle(); voices.tick();
    check(counts().emissions === 1 && counts().starts === 1, 'unmuting never replays the old line');
    advance(8.01); voices.tick(); await flush();
    check(voices.current?.line.id === second.id && counts().emissions === 2, 'next queued line starts normally after old caption finishes');
    audio.setActive(false);
    check(!voices.current && !voices.queue.length && voices.caption.hidden, 'gameplay pause cancels ordinary speech and queue');
  }
  {
    const { audio, voices, counts, advance } = harness();
    await voices.say('Lena', 'greet', { id: line.id });
    advance(2);
    audio.ctx.state = 'suspended';
    advance(30); voices.tick();
    check(!!voices.current && counts().stops === 0, 'suspended live line retains ownership beyond its original caption deadline');
    const remaining = voices.current.ends - audio.ctx.currentTime;
    audio.toggle(); voices.tick();
    check(!!voices.current && !voices.caption.hidden, 'muting an interrupted live line retains its remaining caption');
    check(Math.abs(voices.current.captionEnds - voices.captionTime() - remaining) < 1e-9, 'mute rebases silent caption deadline to remaining audio duration');
    advance(remaining - .01); voices.tick();
    check(!!voices.current, 'rebased interrupted caption remains for full remaining duration');
    advance(.02); voices.tick();
    check(!voices.current && voices.caption.hidden && counts().stops === 1, 'rebased interrupted caption expires once without replay');
  }
  {
    const { audio, voices, advance } = harness();
    const pending = deferred(); audio.bank.get = () => pending.promise;
    const saying = voices.say('Lena', 'greet', { id: line.id });
    const loadingDeadline = voices.current.captionEnds;
    advance(4); audio.toggle();
    check(voices.current.loading && voices.current.captionEnds === loadingDeadline, 'mute does not extend a loading fallback deadline');
    voices.stop(); pending.resolve(null); await saying;
    await voices.say('Lena', 'greet', { id: line.id });
    const silentDeadline = voices.current.captionEnds;
    advance(1); voices.mute();
    check(!voices.current.handle && voices.current.captionEnds === silentDeadline, 'repeated mute does not extend an already silent caption');
    voices.stop();
  }
  {
    const { audio, voices, counts } = harness();
    const world = { zone: 'office' };
    audio.time = 0;
    voices.nextAmbient = 1000;
    voices.arrive(world);
    check(voices.arrival?.actor === 'player' && voices.arrival.time === 1.2, 'office arrival schedules its normal delayed greeting');
    const queued = { actor: 'Tobias', id: second.id, preview: true };
    voices.queue.push(queued);
    audio.toggle();
    check(!voices.arrival && !voices.current, 'mute clears delayed arrival even without an active owner');
    check(voices.queue.length === 1 && voices.queue[0] === queued, 'clearing automatic arrival preserves the explicit queue');
    audio.time = 60; audio.toggle(); voices.update(60, world); await flush();
    check(!voices.current && counts().fetches === 0 && counts().emissions === 0, 'unmuting much later does not play the old arrival greeting');
    voices.tick(); await flush();
    check(voices.current?.line.id === second.id && counts().emissions === 1, 'explicit queued dialogue still starts after arrival cancellation');
    voices.stop();
  }
  {
    const { audio, voices, counts, advance } = harness();
    const pending = deferred(); audio.bank.get = () => pending.promise;
    const saying = voices.say('Lena', 'greet', { id: line.id });
    audio.toggle(); audio.toggle(); pending.resolve(sample(7));
    check(await saying && counts().emissions === 0, 'mute/unmute during download cannot emit an old request');
    check(!voices.caption.hidden && voices.current.line.id === line.id, 'pending muted line still completes as a matching caption');
    advance(7.01); voices.tick(); check(!voices.current, 'silent pending result has bounded caption time');
  }
  {
    const { audio, voices, counts } = harness();
    const pending = deferred(); audio.bank.get = () => pending.promise;
    const saying = voices.say('Lena', 'greet', { id: line.id });
    voices.stop(); pending.resolve(sample());
    check(await saying === false && !voices.current && counts().emissions === 0, 'closed loading request cannot resurrect speech or caption');
    const older = deferred(), newer = deferred(); let calls = 0;
    audio.bank.get = () => (++calls === 1 ? older.promise : newer.promise);
    const oldSay = voices.say('Lena', 'greet', { id: line.id, force: true });
    const newSay = voices.say('Tobias', 'greet', { id: second.id, force: true });
    older.resolve(sample()); check(await oldSay === false && counts().emissions === 0, 'superseded request cannot steal the current owner');
    newer.resolve(sample()); check(await newSay && voices.current.line.id === second.id, 'newer request retains ownership');
    const late = deferred(); audio.bank.get = () => late.promise;
    const lateSay = voices.say('Lena', 'greet', { id: line.id, force: true });
    voices.tick(); check(voices.caption.hidden, 'loading replacement does not redisplay the previous caption');
    voices.stop(); late.resolve(sample()); await lateSay;
  }
  {
    const { audio, voices, advance } = harness();
    audio.enabled = false; audio.active = false; audio.ctx.state = 'suspended';
    check(!await voices.say('Lena', 'greet', { id: line.id }), 'inactive gameplay rejects non-preview dialogue');
    voices.sequence([{ actor: 'Lena', id: line.id, preview: true }, { actor: 'Tobias', id: second.id, preview: true }]);
    check(voices.current?.preview && voices.current.line.id === line.id, 'office preview sequence runs while inactive and muted');
    audio.setActive(false); check(!!voices.current, 'preview survives paused gameplay');
    advance(line.duration + 0.01); voices.tick();
    check(voices.current?.line.id === second.id && !voices.caption.hidden, 'muted office sequence advances with suspended context');
    voices.stop(); advance(100); voices.tick();
    check(!voices.current && !voices.queue.length && voices.caption.hidden, 'office close prevents later queued caption');
  }
  {
    const { audio, voices, counts, advance } = harness();
    audio.ctx.state = 'suspended';
    const pending = deferred(); audio.bank.get = () => pending.promise;
    const saying = voices.say('Lena', 'greet', { id: line.id });
    advance(15.01); voices.tick(); pending.resolve(sample());
    check(await saying === false && counts().emissions === 0, 'suspended context does not trap loading or accept its stale result');
    audio.bank.get = async () => sample(5);
    await voices.say('Lena', 'greet', { id: line.id, force: true });
    advance(30); voices.tick();
    check(!!voices.current && counts().stops === 0 && !voices.caption.hidden, 'suspended audible handle is not truncated by wall time');
    audio.ctx.state = 'running'; advance(4); voices.tick();
    check(!!voices.current && counts().stops === 0, 'resumed audio retains its remaining playback time');
    advance(1.01); voices.tick();
    check(!voices.current && counts().stops === 1, 'resumed audio finishes on its audio clock');
    await voices.say('Lena', 'greet', { id: line.id, force: true });
    voices.current.handle.ended = true; voices.tick();
    check(!voices.current, 'ended handle releases caption ownership');
  }
  // Actual office menu wiring must remain audible while its world/modal is paused.
  for (const [actor, role] of [['Lena', 'Projektleitung'], ['Tobias', 'Research'], ['Mara', 'Consulting'], ['Jan', 'Partner']]) {
    const { audio, voices, counts } = harness();
    const fullName = actor + ' · ' + role, stem = actor.toLowerCase();
    const nodes = new Map(['dialogue-answer', 'dialogue-followup', 'colleague-thanks'].map(id => [id, { ...element(), textContent: '' }]));
    const choices = ['work', 'coffee', 'success', 'failure'].map(topic => ({ ...element(), dataset: { dialogue: topic } }));
    globalThis.document = { getElementById: id => nodes.get(id) || null, querySelectorAll: () => choices, createElement: element, body: { append() {} } };
    const npc = { name: fullName, mesh: { position: { x: 1, z: 1 } } };
    const game = {
      world: { zoneData: { office: { npcs: [npc] } } }, modal: null,
      open(_title, _html, options) { this.modal = options; audio.setActive(!options.pause); },
      close() { this.modal?.onClose?.(); this.modal = null; },
    };
    voices.openConversation(game, fullName); await flush();
    check(game.modal.pause === true && audio.active === false, actor + ' office menu explicitly pauses world/audio gameplay');
    check(voices.current?.line.actor === actor && voices.current.preview && !!voices.current.handle, actor + ' fallback greeting remains owned and audible during paused menu');
    for (const button of choices) {
      button.onclick(); await flush();
      check(voices.current?.line.id === 'player_ask_' + button.dataset.dialogue && voices.current.preview, actor + ' topic player question uses paused-menu preview ownership');
      check(voices.queue.length === 1 && voices.queue[0].preview === true, actor + ' queued topic answer preserves preview ownership');
      voices.current.handle.ended = true; voices.tick(); await flush();
      check(voices.current?.line.id === stem + '_dialog_' + button.dataset.dialogue && voices.current.preview && !!voices.current.handle, actor + ' topic answer plays while world remains paused');
    }
    nodes.get('dialogue-followup').onclick(); await flush();
    check(voices.current?.line.id === stem + '_dialog_followup' && voices.current.preview && !!voices.current.handle, actor + ' follow-up plays in paused office menu');
    const old = voices.current.handle, beforeStops = counts().stops;
    nodes.get('colleague-thanks').onclick(); await flush();
    check(!game.modal && counts().stops > beforeStops && voices.current?.handle !== old && voices.current?.line.id === stem + '_dialog_goodbye' && voices.current.preview, actor + ' explicit thanks cancels old owner and preserves goodbye before next world frame');
    voices.stop();
    const pending = deferred(); audio.bank.get = () => pending.promise;
    voices.openConversation(game, fullName);
    const before = counts().emissions; game.close(); pending.resolve(sample()); await flush();
    check(!voices.current && !voices.queue.length && counts().emissions === before && voices.caption.hidden, actor + ' closing paused conversation rejects late greeting audio/caption');
  }
  console.log(JSON.stringify({ passed: true, assertions: checks, scope: 'Actual AudioBank, DialogueDirector and Soundscape methods with mocked fetch/AudioContext/DOM. Covers retry recovery/backoff/caps/permanent errors, concurrency/LRU, mute/subtitles, ownership, preview queues, silent suspended-clock deadlines and interrupted live playback. Browser integration and listening are separate checks.' }, null, 2));
} finally {
  globalThis.fetch = original.fetch;
  Date.now = original.now;
  globalThis.document = original.document;
  globalThis.setTimeout = original.setTimeout;
  globalThis.clearTimeout = original.clearTimeout;
}
