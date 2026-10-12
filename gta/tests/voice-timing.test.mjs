import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { measuredVoiceLine, quizIntroVoiceFinished } from '../voice-timing.js';
import { ORIGIN_LINES } from '../origin-lines.js';
import { FIRE_LINES } from '../fire-lines.js';

// Import only the inspected pure timeline portion; Three/WebGL is not needed for timing maths.
async function timeline(file, className) {
  const url = new URL('../' + file, import.meta.url);
  let source = fs.readFileSync(url, 'utf8').split('export class ' + className)[0];
  source = source.replace(/^import .*;\n/gm, '');
  source = `const ORIGIN_LINES = ${JSON.stringify(ORIGIN_LINES)};\nconst FIRE_LINES = ${JSON.stringify(FIRE_LINES)};\n` + source;
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const { originTimeline } = await timeline('origin-cinema.js', 'OriginCinema');
const { fireTimeline } = await timeline('fire-cinema.js', 'FireCinema');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
for (const factor of [0.5, 1, 2, 4]) {
  const origins = ORIGIN_LINES.map(l => ({ ...l, duration: l.duration * factor }));
  for (const kind of ['home','kitchen','offer','arrival']) {
    const t = originTimeline(kind, origins);
    check(t.segments.length > 0, 'origin scene has dialogue: ' + kind);
    for (let i = 0; i < t.segments.length; i++) {
      const s = t.segments[i];
      check(s.voiceEnd > s.start, 'positive origin speech');
      check(s.end > s.voiceEnd, 'origin pause retained');
      if (i) check(s.start >= t.segments[i-1].voiceEnd, 'origin no overlap');
    }
    check(t.duration > t.segments.at(-1).voiceEnd, 'origin no final truncation');
  }
  const fires = FIRE_LINES.map(l => ({ ...l, duration: l.duration * factor }));
  for (const kind of ['intro','rescue','success','failure']) {
    const t = fireTimeline(kind, fires);
    for (let i = 0; i < t.segments.length; i++) {
      const s = t.segments[i];
      check(s.voiceEnd > s.start, 'positive fire speech');
      if (i) check(s.start >= t.segments[i-1].voiceEnd, 'fire no overlap');
    }
    check(t.duration > t.segments.at(-1).voiceEnd, 'fire no final truncation');
    if (kind === 'rescue') {
      check(t.markers.pickup >= t.markers.landing + 1.5, 'landing before pickup');
      check(t.markers.sprayStart >= t.markers.pickup + 0.7, 'pickup before spray');
      check(t.markers.sprayEnd >= t.markers.sprayStart + 0.7, 'positive spray');
      check(t.duration >= t.markers.sprayEnd + 2, 'spray ends before scene');
    }
  }
}
const sample={id:'test',text:'Hallo',duration:2};
check(measuredVoiceLine(sample,{buffers:new Map([['voice_test',{duration:9}]])}).duration===9,'decoded duration wins');
check(measuredVoiceLine(sample,{buffers:new Map()}).duration===2,'metadata fallback');
check(measuredVoiceLine(sample,{buffers:new Map([['voice_test',{duration:NaN}]])}).duration===2,'invalid decoded fallback');
check(measuredVoiceLine({...sample,duration:undefined}).duration>0,'text fallback');
check(sample.duration===2,'source not mutated');
check(!quizIntroVoiceFinished({welcomeSpoken:false}),'intro cannot exit before host starts');
check(!quizIntroVoiceFinished({welcomeSpoken:true,clock:10,voiceStatus:'playing',voiceUntil:20,voice:{ended:false,stopped:false}}),'long host speech holds cut');
check(!quizIntroVoiceFinished({welcomeSpoken:true,clock:20.07,voiceStatus:'playing',voiceUntil:20,voice:{ended:false,stopped:false}}),'live speech is not cut by frame clock');
check(quizIntroVoiceFinished({welcomeSpoken:true,clock:10,voiceStatus:'playing',voiceUntil:20,voice:{ended:true,stopped:false}}),'onended releases cut');
check(quizIntroVoiceFinished({welcomeSpoken:true,voiceStatus:'silent'}),'missing/muted speech does not trap');
check(!quizIntroVoiceFinished({welcomeSpoken:true,clock:2,voiceStatus:'loading',voiceRequestedAt:0}),'wait for in-flight host clip');
check(quizIntroVoiceFinished({welcomeSpoken:true,clock:3.01,voiceStatus:'loading',voiceRequestedAt:0}),'bounded loading fallback');
console.log(JSON.stringify({passed:true,assertions:checks,scales:[0.5,1,2,4],scope:'Pure duration/timeline and intro-gate tests only; audiovisual review still required'},null,2));
