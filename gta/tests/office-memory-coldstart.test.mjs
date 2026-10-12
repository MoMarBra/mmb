import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOICE_LINES } from '../voice-lines.js';
import { OFFICE_MEMORIES, freshOfficeMemory } from '../office-memory-state.js';

// Use the shipped controllers, replacing only imports and browser I/O seams.
async function load(file, prelude) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '');
  return import('data:text/javascript;base64,' + Buffer.from(prelude + '\n' + source).toString('base64'));
}
const backgroundIds = Array.from({ length: 14 }, (_, i) => 'background_' + i);
const fixtures = Object.fromEntries([...backgroundIds, ...OFFICE_MEMORIES.map(e => 'voice_' + e.voiceId)]
  .map(id => [id, { path: id }]));
const { AudioBank } = await load('audio-bank.js', `const AUDIO_ASSETS=${JSON.stringify(fixtures)};`);
const { DialogueDirector } = await load('dialogue.js', `const VOICE_LINES=${JSON.stringify(VOICE_LINES)}; const mountColleagueConversation=()=>false;`);
const stateModule = new URL('../office-memory-state.js', import.meta.url).href;
const { OfficeMemory } = await load('office-memory.js', `import { normalizeOfficeMemory, reconcileOfficeMemory, nextMemoryNotice, acknowledgeMemory, officeMemoryMask } from ${JSON.stringify(stateModule)};`);
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const sample = (duration = 5) => ({ duration, length: 10, numberOfChannels: 2 });
const response = (status = 200) => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => new ArrayBuffer(4) });
const element = () => ({ hidden: true, isConnected: true, innerHTML: '', classList: { toggle() {} }, setAttribute() {} });
const original = { fetch: globalThis.fetch, now: Date.now, document: globalThis.document };
let clock = 100000;
Date.now = () => clock;
globalThis.document = { hidden: false, getElementById: () => null, createElement: element, body: { append() {} } };
function harness(ids = ['workshop']) {
  const emitted = [], toasts = [];
  let saves = 0, refuseEmission = false;
  const audio = {
    ready: true, enabled: true, active: true, ctx: { currentTime: 10, state: 'running' },
    bank: { buffers: new Map(), get: async () => sample() },
    emit(buffer, options) {
      if (refuseEmission) return null;
      const handle = { ended: false, stopped: false, stop() { this.stopped = true; } };
      emitted.push({ buffer, options, handle });
      return handle;
    },
  };
  const game = {
    audio, started: true, worldTransitionUntil: 0,
    sim: { s: { officeMemory: { ...freshOfficeMemory(), unlocked: [...ids] }, audioSubtitles: true }, listeners: [], save() { saves++; } },
    world: { zone: 'office', player: { position: { x: -8, z: 1 } } },
    toast(...args) { toasts.push(args); },
  };
  audio.sim = game.sim;
  const voices = audio.voices = new DialogueDirector(audio);
  voices.captionTime = () => clock / 1000;
  const memory = new OfficeMemory(game, null, { now: () => clock, hidden: () => globalThis.document.hidden });
  return {
    game, audio, voices, memory, emitted, toasts,
    counts: () => ({ saves }), refuse: () => { refuseEmission = true; },
    advance(ms) { clock += ms; audio.ctx.currentTime += ms / 1000; },
    trigger() { memory.update(); clock += 2501; memory.update(); },
  };
}
try {
  // All six real update/presentDefault paths pass queued ambience on cold start.
  {
    const h = harness(OFFICE_MEMORIES.map(entry => entry.id));
    const started = [], gates = new Map(), allJobs = [];
    globalThis.fetch = id => {
      started.push(id);
      const gate = deferred(); gates.set(id, gate);
      return gate.promise;
    };
    const bank = h.audio.bank = new AudioBank({ decodeAudioData: async () => sample() });
    for (const id of backgroundIds) allJobs.push(bank.get(id));
    const firstId = 'voice_' + OFFICE_MEMORIES[0].voiceId;
    const originalPending = bank.get(firstId);
    allJobs.push(originalPending);
    check(bank.loading === 4 && bank.queue.length === 11, 'cold bank starts four loads with a deep background queue');
    check(bank.queue.at(-1).id === firstId, 'unrequested memory preload begins at the background tail');
    h.trigger();
    check(bank.pending.get(firstId) === originalPending && bank.queue[0].id === firstId && bank.queue[0].priority,
      'earned memory promotes the existing pending promise ahead of startup ambience');
    check(h.voices.current.priority === 0 && h.voices.current.loading, 'memory keeps low dialogue arbitration priority while its requested asset is promoted');
    check(!h.game.sim.s.officeMemory.noticed.length && !h.toasts.length, 'queued memory is neither acknowledged nor toasted');
    for (const [index, entry] of OFFICE_MEMORIES.entries()) {
      const voiceId = 'voice_' + entry.voiceId;
      if (index) {
        h.voices.current.handle.ended = true; h.voices.tick();
        h.advance(90001); h.memory.update();
        check(bank.queue[0].id === voiceId && bank.queue[0].priority, entry.id + ': next requested notice takes foreground loading priority');
      }
      const background = [...gates.keys()].find(id => id.startsWith('background_'));
      gates.get(background).resolve(response()); gates.delete(background);
      await flush();
      check(started.at(-1) === voiceId && bank.loading === 4, entry.id + ': first freed slot loads memory without exceeding four active loads');
      check(!h.game.sim.s.officeMemory.noticed.includes(entry.id), entry.id + ': beginning the fetch does not consume the notice');
      gates.get(voiceId).resolve(response()); gates.delete(voiceId);
      await flush();
      check(h.emitted.length === index + 1 && h.voices.current?.line.id === entry.voiceId, entry.id + ': exact memory line emits once');
      check(h.game.sim.s.officeMemory.noticed.includes(entry.id) && h.memory.presenting === null, entry.id + ': successful playback releases presentation and acknowledges the exact notice');
      check(h.toasts.length === index + 1 && h.toasts.at(-1)[0] === entry.title, entry.id + ': exact title is toasted once');
      check(h.emitted.at(-1).options.volume === 0.65 && h.emitted.at(-1).options.refDistance === 2 && h.emitted.at(-1).options.lowpass === 6200,
        entry.id + ': quiet nearby acoustic settings are unchanged');
      check(h.voices.current.priority === 0, entry.id + ': ambient arbitration remains non-interrupting');
      check(h.memory.nextNoticeAt === clock + 90000, entry.id + ': successful notice retains normal ninety-second pacing');
    }
    while (bank.pending.size) {
      for (const [id, gate] of gates) { gate.resolve(response()); gates.delete(id); }
      await flush();
    }
    await Promise.all(allJobs);
    check(bank.decoded.size === 20 && bank.bytes === 20 * 80 && bank.loading === 0, 'all background and memory jobs finish with unchanged dedup/cache accounting');
    h.voices.stop(); h.advance(180000); h.memory.update(); await flush();
    check(h.emitted.length === 6 && h.toasts.length === 6 && h.game.sim.s.officeMemory.noticed.length === 6, 'six notices remain exactly-once after the queue is drained');
    h.memory.dispose();
  }
  // Playback arbitration and acoustic intent are independent of fetch priority.
  {
    const h = harness(), requests = [];
    h.audio.bank.get = async (id, options) => { requests.push({ id, options }); return sample(); };
    await h.voices.say('player', 'ambient', { id: 'office_memory_workshop', force: true });
    check(requests.at(-1).options.priority === false, 'genuine ambient event stays background even when a line ID is explicit');
    await h.voices.say('player', 'greet', { id: 'office_memory_workshop', ambient: true, force: true });
    check(requests.at(-1).options.priority === false, 'nearby automatic greeting remains background priority');
    await h.voices.say('player', 'greet', { id: 'office_memory_workshop', force: true, preview: true });
    check(requests.at(-1).options.priority === true, 'ordinary explicit preview remains foreground');
    const owner = h.voices.current, count = requests.length;
    check(!await h.voices.say('player', 'office_memory', { id: 'office_memory_workshop', ambient: true, priority: 0 }), 'memory cannot interrupt a higher-priority current owner');
    check(h.voices.current === owner && requests.length === count, 'rejected memory neither replaces the owner nor queues a download');
    h.memory.dispose(); h.voices.stop();
  }
  // Network, codec, source-cap and mute failures never silently consume a voice.
  for (const failure of ['network', 'decode', 'source-cap', 'muted-loading']) {
    const h = harness(), pending = deferred();
    const bank = h.audio.bank = new AudioBank({ decodeAudioData: async () => {
      if (failure === 'decode') throw Error('bad codec');
      return sample();
    } });
    globalThis.fetch = () => pending.promise;
    h.trigger();
    if (failure === 'source-cap') h.refuse();
    if (failure === 'muted-loading') { h.audio.enabled = false; h.voices.mute(); h.audio.enabled = true; }
    if (failure === 'network') pending.reject(TypeError('offline')); else pending.resolve(response());
    await flush();
    check(!h.game.sim.s.officeMemory.noticed.length && !h.toasts.length, failure + ': no success or acknowledgement without an emitted memory');
    check(h.memory.presenting === null && h.voices.current === null, failure + ': failed owner is released for retry');
    check(!h.voices.heard.has('office_memory_workshop') && !h.voices.cooldowns.has('player'), failure + ': failure does not mark heard or start actor cooldown');
    check(bank.loading === 0 && bank.pending.size === 0, failure + ': bank slot and pending job settle');
    if (failure === 'network') {
      h.advance(bank.retryDelay); globalThis.fetch = async () => response(); h.memory.update(); await flush();
      check(h.emitted.length === 1 && h.game.sim.s.officeMemory.noticed[0] === 'workshop', 'transient failure retries through ordinary memory update after bank backoff');
    }
    if (failure === 'source-cap') {
      h.advance(1000); h.memory.update(); await flush();
      check(!h.toasts.length && !h.game.sim.s.officeMemory.noticed.length, 'source-cap retry cannot be mistaken for terminal asset failure');
    }
    h.memory.dispose(); h.voices.stop();
  }
  // Terminal failures progress via readable text only on a NEW eligible update.
  for (const terminal of ['404', 'decode', 'attempt-limit']) {
    const h = harness(['workshop', 'fire']);
    let requests = 0;
    const bank = h.audio.bank = new AudioBank({ decodeAudioData: async () => {
      if (terminal === 'decode' && requests === 1) throw Error('invalid codec');
      return sample();
    } });
    globalThis.fetch = async id => {
      requests++;
      if (id === 'voice_office_memory_workshop') {
        if (terminal === '404') return response(404);
        if (terminal === 'attempt-limit') throw TypeError('offline');
      }
      return response();
    };
    h.trigger(); await flush();
    check(!h.toasts.length && !h.game.sim.s.officeMemory.noticed.length && !h.memory.presenting,
      terminal + ': failed asynchronous attempt never consumes or displays a fallback');
    if (terminal === 'attempt-limit') {
      h.advance(500); h.memory.update(); await flush();
      check(requests === 1 && !h.toasts.length && !h.game.sim.s.officeMemory.noticed.length,
        'transient backoff is not terminal and never consumes a notice');
      h.advance(500); h.memory.update(); await flush();
      check(requests === 2 && !h.toasts.length, 'second eligible transient attempt retries without text fallback');
      h.advance(2000); h.memory.update(); await flush();
      check(requests === 3 && bank.retryState.get('voice_office_memory_workshop').attempts === bank.maxAttempts && !h.toasts.length,
        'exhausted third attempt still does not fallback from its async result');
    }
    const attempts = requests;
    h.advance(500); h.memory.update(); await flush();
    check(requests === attempts && !h.emitted.length && h.toasts.length === 1, terminal + ': fresh eligible update displays one text fallback without another failed fetch');
    check(h.toasts[0][0] === OFFICE_MEMORIES[0].title && h.toasts[0][1] === OFFICE_MEMORIES[0].line,
      terminal + ': fallback contains the complete matching title and readable line');
    check(h.game.sim.s.officeMemory.noticed.join(',') === 'workshop' && !h.voices.heard.has('office_memory_workshop'),
      terminal + ': notice is acknowledged as displayed, never marked as an emitted voice');
    check(h.memory.nextNoticeAt === clock + 90000 && !h.memory.presenting && !h.voices.current,
      terminal + ': fallback releases ownership and retains ninety-second notice spacing');
    h.advance(1000); h.memory.update(); await flush();
    check(h.toasts.length === 1 && requests === attempts, terminal + ': fallback does not repeat or skip the pacing window');
    h.advance(89001); h.memory.update(); await flush();
    check(h.emitted.length === 1 && h.voices.current?.line.id === 'office_memory_fire' && h.game.sim.s.officeMemory.noticed.join(',') === 'workshop,fire',
      terminal + ': later healthy memory progresses normally after the failed first clip');
    check(h.toasts.length === 2 && h.toasts[1].length === 1, terminal + ': later notice uses its usual voiced title-only toast');
    h.memory.dispose(); h.voices.stop();
  }
  for (const evidence of ['missing-state', 'pending', 'cached']) {
    const h = harness(), gate = deferred(), assetId = 'voice_office_memory_workshop';
    const bank = h.audio.bank = new AudioBank({ decodeAudioData: async () => sample() });
    globalThis.fetch = () => gate.promise;
    let active;
    if (evidence === 'pending') active = bank.get(assetId);
    bank.failures.add(assetId);
    if (evidence !== 'missing-state') bank.retryState.set(assetId, { retryable: false, attempts: 1, nextAt: clock });
    if (evidence === 'cached') bank.buffers.set(assetId, sample());
    h.trigger(); await flush();
    check(!h.toasts.some(toast => toast.length === 2), evidence + ': partial or contradicted failure evidence does not enable text fallback');
    if (evidence === 'pending') {
      check(h.voices.current?.loading && !h.game.sim.s.officeMemory.noticed.length, 'an existing in-flight job must settle before any fallback decision');
      gate.resolve(response()); await active; await flush();
      check(h.emitted.length === 1 && h.game.sim.s.officeMemory.noticed[0] === 'workshop', 'an in-flight recovery is allowed to become normal playback');
    }
    if (evidence === 'cached') check(h.emitted.length === 1 && h.toasts[0].length === 1, 'usable cached audio wins over stale failure bookkeeping');
    h.memory.dispose(); h.voices.stop();
  }
  for (const stale of ['cancelled', 'superseded', 'new-save', 'disposed']) {
    const h = harness(), pending = deferred();
    const bank = h.audio.bank = new AudioBank({ decodeAudioData: async () => sample() });
    globalThis.fetch = () => pending.promise;
    h.trigger();
    let replacement = null;
    if (stale === 'cancelled') h.voices.stop();
    if (stale === 'superseded') {
      bank.buffers.set('voice_lena_greet', sample());
      await h.voices.say('Lena', 'greet', { id: 'lena_greet', force: true, priority: 4 });
      replacement = h.voices.current;
    }
    if (stale === 'new-save') {
      h.game.sim.s = { ...h.game.sim.s, officeMemory: { ...freshOfficeMemory(), unlocked: ['workshop'] } };
      h.memory.sync();
    }
    if (stale === 'disposed') h.memory.dispose();
    pending.resolve(response(404)); await flush();
    check(bank.failures.has('voice_office_memory_workshop') && bank.retryState.get('voice_office_memory_workshop').retryable === false,
      stale + ': abandoned bank request may independently establish a permanent failure');
    check(!h.toasts.length && !h.game.sim.s.officeMemory.noticed.length && !h.memory.presenting && h.voices.current === replacement,
      stale + ': old cancelled terminal result cannot display text, consume a notice or replace a newer voice');
    if (replacement) {
      h.advance(1000); h.memory.update(); await flush();
      check(!h.toasts.length && h.voices.current === replacement, 'newer active owner blocks even a later terminal-fallback update');
    }
    h.memory.dispose(); h.voices.stop();
  }
  for (const stale of ['cancelled', 'superseded', 'new-save', 'disposed', 'load-deadline']) {
    const h = harness(), pending = deferred();
    h.audio.bank.get = () => pending.promise;
    h.trigger();
    let replacement = null;
    if (stale === 'cancelled') h.voices.stop();
    if (stale === 'superseded') {
      h.audio.bank.get = async () => sample();
      await h.voices.say('Lena', 'greet', { id: 'lena_greet', force: true, priority: 4 });
      replacement = h.voices.current;
    }
    if (stale === 'new-save') {
      h.game.sim.s = { ...h.game.sim.s, officeMemory: { ...freshOfficeMemory(), unlocked: ['workshop'] } };
      h.memory.sync();
    }
    if (stale === 'disposed') h.memory.dispose();
    if (stale === 'load-deadline') { h.advance(15001); h.voices.tick(); }
    pending.resolve(sample()); await flush();
    check(!h.game.sim.s.officeMemory.noticed.length && !h.toasts.length, stale + ': late result cannot consume a notice');
    check(h.memory.presenting === null && h.voices.current === replacement, stale + ': stale completion cannot replace the newer owner');
    check(h.emitted.length === (replacement ? 1 : 0), stale + ': stale clip is never emitted');
    h.memory.dispose(); h.voices.stop();
  }
  // Context changes while decoding must not commit a one-shot notice.
  for (const blocker of ['hidden', 'left-office', 'modal']) {
    const h = harness(), pending = deferred();
    h.audio.bank.get = () => pending.promise;
    h.trigger();
    if (blocker === 'hidden') globalThis.document.hidden = true;
    if (blocker === 'left-office') h.game.world.zone = 'city';
    if (blocker === 'modal') h.game.modal = {};
    pending.resolve(sample()); await flush();
    check(!h.game.sim.s.officeMemory.noticed.length && !h.toasts.length && !h.memory.presenting, blocker + ': final readiness check rejects acknowledgement');
    check(!h.voices.current && h.emitted[0]?.handle.stopped, blocker + ': exact now-ineligible voice is stopped');
    globalThis.document.hidden = false; h.memory.dispose();
  }
  // Intentionally muted/unavailable audio preserves the controller's text fallback.
  for (const unavailable of ['muted', 'not-ready']) {
    const h = harness();
    if (unavailable === 'muted') h.audio.enabled = false; else h.audio.ready = false;
    let requests = 0; h.audio.bank.get = async () => { requests++; return sample(); };
    h.trigger(); await flush();
    check(h.game.sim.s.officeMemory.noticed[0] === 'workshop' && h.toasts.length === 1 && h.toasts[0].length === 2,
      unavailable + ': explicit controller text fallback still acknowledges matching notice');
    check(!requests && !h.emitted.length, unavailable + ': text fallback does not fetch or pretend to emit');
    h.memory.dispose();
  }
  console.log(JSON.stringify({ passed: true, assertions: checks, scope: 'Actual OfficeMemory + DialogueDirector + AudioBank with deterministic fetch/DOM/Web Audio seams. Six cold-start notices, queued promotion/dedup/concurrency, ambience preservation, failed/source-capped/muted audio, bounded loading owner, stale save/voice/disposal, context rechecks and text fallback. Actual browser playback is a separate check.' }, null, 2));
} finally {
  globalThis.fetch = original.fetch;
  Date.now = original.now;
  globalThis.document = original.document;
}
