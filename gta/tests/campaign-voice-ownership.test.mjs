import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EXPANSION_LINES } from '../expansion-voices.js';

// Exercise production ownership methods without constructing the unrelated 3D campaign.
const source = fs.readFileSync(new URL('../bbe-campaign.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '');
const prelude = `const CAMPAIGN_LINES=[]; const EXPANSION_LINES=${JSON.stringify(EXPANSION_LINES)};\n`;
const { BBECampaign } = await import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));
// Use the actual modal transition method while stubbing its DOM/render peripherals.
const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const openStart = main.indexOf('  open(\n');
const openSource = main.slice(openStart, main.indexOf('\n  close() {', openStart));
const modalRoot = { innerHTML: '', contains() { return true; } };
const GameModal = new Function('$', 'return class GameModal {' + openSource + '\n}')(
  selector => selector === '#modal-root' ? modalRoot : null,
);
globalThis.document = { hidden: false, activeElement: null };
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions++; };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness() {
  document.hidden = false;
  const pending = [], emitted = [];
  const officeHandle = { stopped: false, stop() { this.stopped = true; } };
  const voices = { token: 7, current: { id: 'office', handle: officeHandle }, stops: 0,
    caption: { hidden: false, innerHTML: 'Benjamin · current office reply' },
    stop() { this.stops++; this.token++; this.current?.handle?.stop(); this.current = null; } };
  const audio = { voices, bank: { get(asset) { const job = deferred(); pending.push({ ...job, asset }); return job.promise; } },
    emit(buffer, options) { const handle = { buffer, options, stopped: false, stop() { this.stopped = true; } }; emitted.push(handle); return handle; } };
  const c = Object.create(BBECampaign.prototype);
  Object.assign(c, { g: { audio, modal: null, started: true, world: { keys: new Set() },
      open: GameModal.prototype.open, cancelTimedAction() {}, updateTaskDeadline() {},
      sim: { s: { audioSubtitles: true, bbeCampaign: { completed: ['pitch'] } } } },
    w: { zone: 'office' }, current: null, loading: false, voiceToken: 0, voice: null,
    caption: { innerHTML: '', hidden: true }, captionRemaining: 0,
    autosave: 0, greeting: true, enabled: false, updateHUD() {} });
  return { c, audio, voices, officeHandle, pending, emitted };
}
const id = 'campaign_office_greeting';
const buffer = { duration: 9.25 };

// The reported missing-asset path must never stop an office reply, even unchanged ownership.
for (const newer of [false, true]) {
  const h = harness(), request = h.c.speak(id);
  if (newer) h.voices.token++;
  h.pending[0].resolve(null); await request;
  check(h.voices.stops === 0 && !h.officeHandle.stopped, 'delayed null preserves ' + (newer ? 'newer' : 'existing') + ' office speech');
  check(h.emitted.length === 0 && h.c.voice === null, 'missing clip never emits or claims an audio handle');
  check(newer ? h.c.caption.hidden && h.c.captionRemaining === 0
    : !h.c.caption.hidden && h.c.captionRemaining === EXPANSION_LINES[id].duration,
    newer ? 'new dialogue clears stale campaign fallback' : 'still-owned missing clip retains script-duration caption fallback');
}

// A decoded late clip also loses ownership when another dialogue, panel, or zone takes over.
for (const [label, change] of [
  ['new office voice', h => { h.voices.token++; h.voices.current.id = 'benjamin_support'; }],
  ['new office voice already ended', h => { h.voices.token += 2; h.voices.current = null; }],
  ['new modal', h => { h.c.g.modal = { title: 'Benjamin' }; }],
  ['closed modal', h => { h.c.g.modal = null; }],
  ['changed zone', h => { h.c.w.zone = 'city'; }],
  ['replaced director', h => { h.audio.voices = { token: h.voices.token, stop() { throw Error('Must not stop replacement director'); } }; }],
]) {
  const h = harness();
  if (label === 'closed modal') h.c.g.modal = { title: 'Campaign panel' };
  const request = h.c.speak(id); change(h); h.pending[0].resolve(buffer); await request;
  check(h.voices.stops === 0 && !h.officeHandle.stopped, label + ' is not cancelled by a late campaign fetch');
  check(h.emitted.length === 0 && h.c.voice === null, label + ' prevents stale campaign playback');
  check(h.c.caption.hidden && h.c.captionRemaining === 0 && !h.c.voiceCaptionOwner,
    label + ' also clears stale campaign caption ownership');
}

// An unchanged campaign panel still owns its requested line, with decoded caption length.
{
  const h = harness(); h.c.g.modal = { title: 'Research interview' };
  const request = h.c.speak('campaign_research_observe');
  check(h.c.caption.innerHTML.includes(EXPANSION_LINES.campaign_research_observe.text), 'campaign panel keeps exact approved caption');
  h.pending[0].resolve(buffer); await request;
  check(h.voices.stops === 1 && h.officeHandle.stopped, 'valid same-owner campaign playback retains dialogue handoff');
  check(h.emitted.length === 1 && h.c.voice === h.emitted[0] && h.c.voice.options.bus === 'dialogue', 'valid campaign clip emits once on the existing bus');
  check(h.c.captionRemaining === buffer.duration, 'valid decoded clip preserves measured caption duration');
  h.c.update(0, true);
  check(!h.c.caption.hidden && h.c.voiceCaptionOwner.dialogueToken === h.voices.token && !h.c.voice.stopped,
    'campaign handoff refreshes its own director token and survives a paused-panel update');
}

// Explicit colleagueGreeting remains valid from an already-open colleague panel.
{
  const h = harness(); h.c.g.modal = { title: 'Colleague conversation' };
  check(h.c.colleagueGreeting() === true && h.pending[0].asset === id, 'eligible manual colleagueGreeting remains reachable');
  h.pending[0].resolve(buffer); await flush();
  check(h.emitted.length === 1 && h.voices.stops === 1, 'same-owner manual colleagueGreeting still plays');
  h.c.update(0, true);
  check(!h.c.caption.hidden && !h.c.voice.stopped, 'manual greeting keeps its valid caption owner');
  h.c.g.sim.s.bbeCampaign.completed = [];
  check(h.c.colleagueGreeting() === false && h.pending.length === 1, 'manual greeting unlock rule is unchanged');
}

// Controller cancellation, visibility and request replacement retain their original guards.
for (const label of ['stopVoice', 'hidden']) {
  const h = harness(), request = h.c.speak(id);
  if (label === 'stopVoice') h.c.stopVoice(); else document.hidden = true;
  h.pending[0].resolve(buffer); await request;
  check(!h.emitted.length && !h.voices.stops, label + ' invalidates pending speech without affecting shared dialogue');
}
{
  const h = harness(), old = h.c.speak(id), fresh = h.c.speak('campaign_research_talk');
  h.pending[1].resolve(buffer); await fresh;
  const owned = h.c.voice;
  h.pending[0].resolve(buffer); await old;
  check(h.emitted.length === 1 && h.voices.stops === 1 && h.c.voice === owned && !owned.stopped, 'old campaign load cannot replace its newer campaign line');
  check(!h.c.caption.hidden && h.c.caption.innerHTML.includes(EXPANSION_LINES.campaign_research_talk.text),
    'old completion cannot hide the newer campaign caption');
}
{
  const h = harness(), request = h.c.speak(id);
  h.pending[0].reject(Error('offline')); await request;
  check(!h.voices.stops && !h.emitted.length && !h.c.caption.hidden && h.c.captionRemaining > 0, 'rejected fetch keeps readable captions and leaves shared dialogue alone');
}
{
  const h = harness(); h.c.g.sim.s.audioSubtitles = false;
  const request = h.c.speak(id); h.pending[0].resolve(null); await request;
  check(h.c.caption.hidden, 'caption fallback preserves subtitles-off preference');
}

// Actual Game.open takeover must hide stale campaign captions on the next frame,
// without waiting for its pending asset, a countdown, or the new dialogue to end.
for (const resolveValue of [null, buffer]) {
  const h = harness(), request = h.c.speak(id), oldToken = h.c.voiceToken;
  h.c.g.open('Benjamin · IT', '<div>New office conversation</div>', { pause: true });
  h.voices.token++;
  h.voices.current.id = 'benjamin_support';
  h.voices.caption.innerHTML = 'Benjamin · new support line';
  h.c.update(0, true);
  check(h.c.g.modal.pause && h.c.caption.hidden && !h.c.voiceCaptionOwner && h.c.voiceToken > oldToken,
    'actual paused-modal transition immediately invalidates pending campaign caption');
  check(h.voices.stops === 0 && !h.officeHandle.stopped && !h.voices.caption.hidden &&
    h.voices.caption.innerHTML === 'Benjamin · new support line', 'new office voice and caption survive campaign-only cleanup');
  h.pending[0].resolve(resolveValue); await request;
  check(h.emitted.length === 0 && h.c.caption.hidden && h.voices.stops === 0,
    'late null/valid campaign buffer cannot resurrect caption or cancel new office voice');
}

// Ownership checks also retire an already-playing campaign line or a failed-load
// caption, and never stop a newer shared director during those cleanups.
for (const kind of ['playing', 'missing', 'rejected']) {
  const h = harness(), request = h.c.speak(id);
  if (kind === 'rejected') h.pending[0].reject(Error('offline'));
  else h.pending[0].resolve(kind === 'playing' ? buffer : null);
  await request;
  const campaignHandle = h.c.voice, stops = h.voices.stops;
  const newer = { stopped: false, stop() { this.stopped = true; } };
  h.voices.token++; h.voices.current = { id: 'benjamin_support', handle: newer };
  h.voices.caption.hidden = false; h.voices.caption.innerHTML = 'Benjamin · owned caption';
  h.c.update(0, false);
  check(h.c.caption.hidden && !h.c.voice && !h.c.voiceCaptionOwner && h.c.captionRemaining === 0,
    kind + ' campaign presentation clears when dialogue ownership changes');
  check((!campaignHandle || campaignHandle.stopped) && h.voices.stops === stops && !newer.stopped &&
    !h.voices.caption.hidden && h.voices.caption.innerHTML === 'Benjamin · owned caption',
    kind + ' cleanup stops only its own handle and leaves the new global caption untouched');
}
{
  const h = harness(), request = h.c.speak(id);
  h.c.g.open('New panel', '', { pause: true });
  h.pending[0].reject(Error('late offline')); await request;
  check(h.c.caption.hidden && !h.c.voiceCaptionOwner && !h.voices.stops,
    'late rejected fetch cleans up a lost caption owner before another update');
}
console.log(JSON.stringify({ passed: true, assertions,
  scope: 'Production BBECampaign speech/caption ownership and Game.open modal transitions: delayed null/valid/rejected fetches, director/modal/zone replacement, valid panel/manual greeting, exact campaign-only cleanup and preservation of newer office captions. No campaign rules, scene rendering or browser execution.' }, null, 2));
