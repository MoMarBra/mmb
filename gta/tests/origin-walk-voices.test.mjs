import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORIGIN_LINES } from '../origin-lines.js';
import { PROFESSIONAL_VOICE_ASSETS } from '../professional-voice-assets.js';
import { measuredVoiceLine } from '../voice-timing.js';
const stateUrl = new URL('../origin-state.js', import.meta.url);
const { ORIGIN_ROUTE } = await import(fs.existsSync(stateUrl) ? stateUrl : new URL('../../../qa-source/origin-state.js', import.meta.url));
const source = fs.readFileSync(new URL('../origin-story.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\n/gm, '');
const prelude = `const ORIGIN_LINES=${JSON.stringify(ORIGIN_LINES)}, ORIGIN_ROUTE=${JSON.stringify(ORIGIN_ROUTE)};
const measuredVoiceLine=${measuredVoiceLine.toString()}; const animateHuman=()=>{}, animateKitchen=()=>{};\n`;
const { OriginStory } = await import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));
globalThis.document = { hidden: false, getElementById: () => null };
let assertions = 0;
const check = (value, note) => { assert.ok(value, note); assertions++; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const lineFor = key => ORIGIN_LINES.find(l => l.key === key);
function harness({ muted = false, missing = false } = {}) {
  document.hidden = false;
  let wall = 100, arrivals = 0;
  const handles = [], requests = [], buffers = new Map();
  const audio = { ready: true, enabled: !muted, ctx: { currentTime: 10, state: 'running' }, cinematicVoice: false,
    voices: { stop() {} }, sample() { throw Error('explicit story speech must bypass expiring sample()'); },
    bank: { buffers, async get(id, options) { requests.push({ id, options }); return missing ? null : { asset: id, duration: PROFESSIONAL_VOICE_ASSETS[id]?.duration || 4 }; } },
    emit(buffer, options) {
      const handle = { buffer, ...options, startedAt: this.ctx.currentTime, ended: false, stopped: false,
        stop() { this.stopped = true; }, end() { this.ended = true; options.onEnded?.(); },
      };
      handles.push(handle); return handle;
    },
  };
  const world = { zone: 'city', player: { position: { ...ORIGIN_ROUTE[0] } }, pedestrianNav: { move() { return 0; } } };
  const g = { audio, world, cinematic: false, started: true, modal: null,
    sim: { s: { audioSubtitles: true, originStory: { phase: 'escort', route: 0 } }, save() {} }, arcade: { vehicle: null },
  };
  const story = Object.assign(Object.create(OriginStory.prototype), {
    g, w: world, enabled: true, clock: 0, voiceToken: 0, walkLine: 4, nextWalkLine: Infinity,
    walkTalk: { hidden: true, innerHTML: '' }, escort: { position: { ...ORIGIN_ROUTE[0] }, visible: true }, escortNav: {},
    voiceTime: () => wall,
    arrive() { arrivals++; this.g.sim.s.originStory.phase = 'arrival'; },
  });
  const step = (seconds, { audioSeconds = seconds, paused = false } = {}) => {
    wall += seconds;
    if (audio.ctx.state === 'running') audio.ctx.currentTime += audioSeconds;
    for (const handle of handles) if (!handle.stopped && !handle.ended && audio.ctx.currentTime >= handle.startedAt + handle.buffer.duration - (handle.offset || 0)) handle.end();
    story.update(Math.min(seconds, .08), paused);
  };
  return { story, audio, world, handles, requests, step, counts: () => ({ arrivals }), wall: () => wall };
}

// Concrete regression: two-second foreground loads must not hit sample's 1.5s cutoff.
for (const key of ['walk_01', 'walk_02', 'walk_03', 'walk_04']) {
  const h = harness(), { story, audio, handles, step } = h, pending = deferred();
  audio.bank.get = (id, options) => { h.requests.push({ id, options }); return pending.promise; };
  const saying = story.say(key);
  check(story.voiceUntil > 0 && story.voiceSession.status === 'loading' && !story.walkTalk.hidden, key + ' immediately owns route gate and caption while loading');
  step(2);
  const duration = PROFESSIONAL_VOICE_ASSETS[lineFor(key).asset].duration;
  pending.resolve({ asset: lineFor(key).asset, duration });
  check(await saying === true && handles.length === 1 && story.voice === handles[0], key + ' delayed valid buffer plays instead of expiring after 1.5s');
  check(h.requests[0].options.priority === true, key + ' requests foreground loading');
  check(story.voiceSession.duration === duration && Math.abs(story.voiceUntil - story.clock - duration) < 1e-9, key + ' owner uses loaded recording duration');
  step(.1); audio.ctx.state = 'suspended'; step(duration + 30);
  check(story.voice === handles[0] && !handles[0].stopped && story.voiceUntil > 0 && !story.walkTalk.hidden, key + ' live suspended recording survives elapsed wall/metadata deadlines');
  audio.ctx.state = 'running'; step(duration);
  check(!story.voiceSession && !story.voiceUntil && handles[0].ended && !handles[0].stopped, key + ' natural audio completion releases owner without artificial stop');
}

// Real city rendering can delay a short walking asset far beyond its clip duration.
{
  const h = harness(), pending = deferred(); h.audio.bank.get = () => pending.promise;
  const saying = h.story.say('walk_01');
  h.step(12.875);
  check(h.story.voiceSession?.status === 'loading' && h.story.voiceUntil > 0,
    'short walking line retains ownership through a 12.875-second real-browser load delay');
  pending.resolve({ duration: 3.76 }); await saying;
  check(h.handles.length === 1 && h.story.voiceSession.status === 'playing' && h.story.voiceSession.elapsed === 0,
    'slow valid buffer receives its whole measured playback duration after loading');
  h.step(3.75);
  check(h.story.voice === h.handles[0] && !h.handles[0].stopped,
    'slow load time is not subtracted from audible line duration');
  h.step(.02);
  check(!h.story.voiceSession && h.handles[0].ended && !h.handles[0].stopped,
    'slow-loaded walking line releases ownership on natural audio end');
}
{
  const h = harness(); h.audio.bank.get = () => new Promise(() => {});
  h.story.say('walk_01'); h.step(14.99);
  check(h.story.voiceSession?.status === 'loading' && h.story.voiceUntil > 0,
    'never-resolving request retains the full 15-second pending-load allowance');
  h.story.update(0, true); h.step(60, { paused: true });
  check(h.story.voiceSession?.paused && h.story.voiceUntil > 0,
    'semantic pause freezes the pending-load allowance');
  h.story.update(0, false); h.step(.02);
  check(!h.story.voiceSession && !h.story.voiceUntil && h.story.walkTalk.hidden && !h.handles.length,
    'never-resolving request expires after 15 active seconds without emitting');
}

// Arbitrary measured durations are handled without relying on the current manifest matching.
{
  const h = harness(), { story, audio, handles, step } = h;
  audio.bank.get = async () => ({ duration: 20 }); await story.say('walk_02');
  step(9);
  check(story.voice === handles[0] && !handles[0].stopped, 'a longer decoded fixture is never cut by registry duration');
  step(12); check(!story.voiceUntil && handles[0].ended, 'long decoded fixture ends naturally');
}

// Pause and visibility preserve the current sentence and resume its measured offset.
{
  const h = harness(), { story, audio, handles, step } = h;
  await story.say('walk_02'); step(1.25);
  const old = story.voice; story.update(0, true);
  check(old.stopped && !story.voice && story.voiceSession.paused && story.voiceUntil > 0, 'pause stops audio but retains route ownership');
  const offset = story.voiceSession.offset, elapsed = story.voiceSession.elapsed, gameClock = story.clock;
  check(Math.abs(offset - 1.25) < 1e-9 && story.walkTalk.hidden, 'pause records actual audible offset and hides caption');
  step(60, { paused: true });
  check(story.voiceSession.offset === offset && story.voiceSession.elapsed === elapsed && story.clock === gameClock, 'paused clocks do not expire owned line');
  story.update(0, false); await flush();
  check(story.voice !== old && Math.abs(story.voice.offset - offset) < 1e-9 && !story.walkTalk.hidden, 'resume continues the same sentence at its audio offset');
  check(handles.filter(h => !h.stopped && !h.ended).length === 1, 'pause resume never overlaps source handles');
  old.onEnded(); check(!!story.voiceSession, 'late ended callback from paused source cannot cancel resumed owner');
  document.hidden = true; story.pauseVoice(); step(40, { paused: true });
  check(story.voiceSession.paused && story.voiceUntil > 0, 'hidden-tab pause preserves current line and gate');
  document.hidden = false; story.update(0, false); await flush();
  check(!!story.voice && !story.voiceSession.paused, 'visible resumed frame reacquires its line once');
  story.stopVoice();
}

// Muted/missing/loading captions are bounded independently of AudioContext and freeze on pause.
{
  const h = harness({ muted: true }), { story, audio, step } = h;
  await story.say('walk_02');
  check(!h.requests.length && !h.handles.length && !story.walkTalk.hidden && story.voiceSession.status === 'silent', 'muted explicit story line captions without fetch or audio');
  story.g.sim.s.audioSubtitles = false; story.update(0, false); check(story.walkTalk.hidden, 'subtitle-off hides owned story caption');
  story.g.sim.s.audioSubtitles = true; story.update(0, false); check(!story.walkTalk.hidden, 'subtitle-on restores owned story caption');
  step(1); story.update(0, true); const elapsed = story.voiceSession.elapsed;
  step(60, { paused: true }); story.update(0, false);
  check(story.voiceSession.elapsed === elapsed, 'silent story caption retains remaining time across pause');
  audio.enabled = true; story.update(0, false);
  check(!h.handles.length && !h.requests.length, 'unmute does not replay an old silent story line');
  audio.ctx.state = 'suspended'; step(lineFor('walk_02').duration);
  check(!story.voiceSession && !story.voiceUntil && story.walkTalk.hidden, 'silent caption expires on bounded wall clock with suspended audio');
}
{
  const h = harness({ missing: true }); await h.story.say('walk_01');
  check(h.story.voiceSession.status === 'silent' && !h.story.walkTalk.hidden, 'missing audio retains exact caption fallback');
  h.step(lineFor('walk_01').duration + .01);
  check(!h.story.voiceUntil && !h.story.voiceSession, 'missing audio eventually releases route progression');
}
{
  const h = harness(), p = deferred(); h.audio.bank.get = () => p.promise;
  const saying = h.story.say('walk_02'); h.step(20);
  check(!h.story.voiceSession && !h.story.voiceUntil, 'loading fallback has a bounded caption deadline');
  p.resolve({ duration: 7 }); await saying;
  check(!h.handles.length && !h.story.voiceSession, 'buffer arriving after fallback expiry cannot replay old speech');
}
{
  const h = harness(), p = deferred(); h.audio.bank.get = () => p.promise;
  const saying = h.story.say('walk_02'); h.audio.enabled = false; h.story.update(0, false);
  h.audio.enabled = true; p.resolve({ duration: 7 }); await saying;
  check(!h.handles.length && h.story.voiceSession.status === 'silent', 'mute/unmute while loading invalidates pending audible playback');
  h.story.stopVoice();
}
{
  const h = harness(); await h.story.say('walk_02'); h.step(1);
  const old = h.story.voice; h.audio.ctx.state = 'suspended'; h.step(30);
  h.audio.enabled = false; h.story.update(0, false);
  const remaining = h.story.voiceSession.duration - h.story.voiceSession.offset;
  check(old.stopped && !h.story.voice && h.story.voiceSession.status === 'silent' && !h.story.walkTalk.hidden, 'muting interrupted live voice retains a rebased remaining caption');
  h.step(remaining - .01); check(!!h.story.voiceSession, 'muted interrupted caption preserves remaining audio duration');
  h.step(.02); check(!h.story.voiceSession, 'muted interrupted caption completes exactly once');
}

// Every async continuation proves its story, phase, zone and request ownership again.
for (const change of ['stop', 'zone', 'phase', 'save', 'enabled', 'cinematic']) {
  const h = harness(), p = deferred(); h.audio.bank.get = () => p.promise;
  const saying = h.story.say('walk_02');
  if (change === 'stop') h.story.stopVoice();
  if (change === 'zone') h.world.zone = 'office';
  if (change === 'phase') h.story.state.phase = 'arrival';
  if (change === 'save') h.story.g.sim.s.originStory = { ...h.story.state };
  if (change === 'enabled') h.story.enabled = false;
  if (change === 'cinematic') h.story.g.cinematic = true;
  p.resolve({ duration: 7 }); await saying;
  check(!h.handles.length && !h.story.voiceSession && !h.story.voiceUntil, change + ' rejects stale pending story speech');
}
{
  const h = harness(), old = deferred(), fresh = deferred(); let n = 0;
  h.audio.bank.get = () => (++n === 1 ? old.promise : fresh.promise);
  const first = h.story.say('walk_01'), second = h.story.say('walk_02');
  old.resolve({ duration: 3 }); await first;
  check(!h.handles.length && h.story.voiceSession.line.key === 'walk_02', 'newer requested line retains loading ownership');
  fresh.resolve({ duration: 7 }); await second;
  check(h.handles.length === 1 && h.story.voiceSession.line.key === 'walk_02', 'only newest request emits'); h.story.stopVoice();
}
{
  const h = harness(), p = deferred(); h.audio.bank.get = () => p.promise;
  const saying = h.story.say('walk_02'); h.story.update(0, true);
  p.resolve({ duration: 7 }); await saying;
  check(!h.handles.length && h.story.voiceSession.paused && h.story.voiceUntil > 0, 'pending buffer finishing during pause cannot emit or clear gate');
  h.story.update(0, false); await flush();
  check(h.handles.length === 1 && !h.story.voiceSession.paused, 'unpaused owner reacquires loaded line exactly once'); h.story.stopVoice();
}

// Production escort sequencing and final arrival gate still wait for every owned line.
{
  const h = harness(), { story, world, step } = h;
  story.state.route = ORIGIN_ROUTE.length - 1;
  world.player.position = { ...ORIGIN_ROUTE.at(-1) }; story.escort.position = { ...ORIGIN_ROUTE.at(-1) };
  story.walkLine = 0; story.nextWalkLine = 0;
  for (let n = 1; n <= 4; n++) {
    story.update(0, false); await flush();
    if (!story.voiceSession) { story.clock = story.nextWalkLine; story.update(0, false); await flush(); }
    check(story.voiceSession?.line.key === 'walk_0' + n && story.walkLine === n, 'escort starts walking sentence ' + n + ' once');
    check(!story.canArrive() && !h.counts().arrivals, 'arrival is blocked while walking sentence ' + n + ' owns playback');
    const handle = story.voice; h.audio.ctx.state = 'suspended'; step(30);
    check(story.voice === handle && !h.counts().arrivals, 'suspended sentence cannot advance escort conversation or arrival');
    h.audio.ctx.state = 'running'; handle.end();
    if (n < 4) {
      story.update(0, false); check(!story.voiceSession && story.walkLine === n, 'natural completion preserves inter-sentence gap');
      story.clock = story.nextWalkLine;
    }
  }
  check(story.canArrive(), 'fourth natural completion releases canArrive guard');
  story.update(0, false);
  check(h.counts().arrivals === 1 && story.state.phase === 'arrival', 'arrival starts once after all four recordings naturally complete');
  story.update(0, false); check(h.counts().arrivals === 1, 'arrival cannot double-trigger after phase transition');
}
console.log(JSON.stringify({ passed: true, assertions, scope: 'Production OriginStory methods with deterministic DOM/WebAudio, using final professional asset metadata. Covers all four >1.5s delayed loads, live context suspension, measured playback, pause offsets, mute/subtitle/missing fallback, stale ownership, and exact escort/arrival ordering. No warm-duration mismatch is assumed; browser/listening checks are separate.' }, null, 2));
