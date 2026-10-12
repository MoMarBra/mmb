import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ORIGIN_LINES } from '../origin-lines.js';
import { FIRE_LINES } from '../fire-lines.js';
import { QUIZ_LINES, QUIZ_HOST_VARIANTS } from '../quiz-lines.js';
import { measuredVoiceLine, quizIntroVoiceFinished, quizVoiceFinished } from '../voice-timing.js';
const elements=new Map();
globalThis.document={hidden:false,body:{classList:{add(){},remove(){}}},getElementById(id){if(!elements.has(id))elements.set(id,{hidden:false,style:{},focus(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);}};
async function load(file){
 let source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const prelude=`const ORIGIN_LINES=${JSON.stringify(ORIGIN_LINES)}, FIRE_LINES=${JSON.stringify(FIRE_LINES)}, QUIZ_LINES=${JSON.stringify(QUIZ_LINES)}, QUIZ_HOST_VARIANTS=${JSON.stringify(QUIZ_HOST_VARIANTS)};\nconst measuredVoiceLine=${measuredVoiceLine.toString()}, quizIntroVoiceFinished=${quizIntroVoiceFinished.toString()}, quizVoiceFinished=${quizVoiceFinished.toString()};\nconst cinematicSet=()=>({actors:{}}), buildBossSet=cinematicSet, buildFireSet=cinematicSet;\n`;
 return import('data:text/javascript;base64,'+Buffer.from(prelude+source).toString('base64'));
}
const {OriginCinema}=await load('origin-cinema.js'),{FireCinema}=await load('fire-cinema.js'),{Quizssoir}=await load('quizssoir.js');
let assertions=0;const check=(ok,note)=>{assert.ok(ok,note);assertions++;};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function harness(Class){
 let stopped=0,closed=0,toasts=0;
 const w={keys:new Set(),renderer:{shadowMap:{autoUpdate:true},compileAsync:async()=>{}},shadowZone:'office'};
 const g={modal:{locked:true},sim:{s:{music:false}},arcade:{music:{}},open(){this.modal={locked:true};},close(){closed++;},toast(){toasts++;},audio:{update(){},voices:{stop(){stopped++;}},bank:{buffers:new Map(),preload:async()=>{}},ctx:{currentTime:0}}};
 const c=Object.assign(Object.create(Class.prototype),{g,w,story:{remember(){}},token:0,current:null,loading:false,pending:null,sets:{},controls:[],render(){},bindControls(){},resetInput(){w.keys.clear();},ensureEffectsBus(){}});
 return{c,g,w,counts:()=>({stopped,closed,toasts})};
}
for(const [Class,kind] of [[OriginCinema,'home'],[FireCinema,'intro']]){
 const {c,g}=harness(Class);const d=deferred();g.audio.bank.preload=()=>d.promise;let done=0;
 const running=c.play(kind,()=>done++);check(c.loading,'loading state entered');
 c.finish();c.finish();check(done===1,'skip completion callback once');
 d.resolve();await running;check(!c.current&&!c.loading,'late preload cannot resurrect skipped scene');
 const id=Class===OriginCinema?'origin_home_01_1_7_0':'voice_fire_intro_01';g.audio.bank.preload=async()=>{};g.audio.bank.buffers.set(id,{duration:12.25});
 await c.play(kind,()=>done++);check(!!c.current,'scene can be opened again after skip');
 check(c.current.segments[0].line.duration===12.25,'reopened scene uses decoded duration');
 const active=c.current;await c.play(kind,()=>done++);check(c.current===active,'repeated play does not replace active scene');
 active.index=0;active.elapsed=active.segments[0].start+1;
 c.pause(true);check(active.paused,'pause enters state');c.pause(false);check(!active.paused&&active.elapsed===active.segments[0].start&&active.index===-1,'resume replays interrupted sentence using measured segment');
 active.index=0;active.elapsed=active.segments[0].voiceEnd+0.1;const elapsed=active.elapsed;c.pause(true);c.pause(false);check(active.elapsed===elapsed,'trailing pause does not replay completed sentence');
 c.finish();c.finish();check(done===2,'active finish completion once');check(!c.current,'active scene released');
}
// Failure followed by retry must keep save progression pending until successful completion.
{
 const {c,g}=harness(OriginCinema);let done=0;g.audio.bank.preload=async()=>{throw Error('expected test failure');};
 const savedError=console.error;console.error=()=>{};await c.play('home',()=>done++);console.error=savedError;
 check(!c.current&&!c.loading&&done===0,'failed loading does not advance origin story');
 check(typeof document.getElementById('origin-retry').onclick==='function','retry action is exposed');
 g.audio.bank.preload=async()=>{};document.getElementById('origin-retry').onclick();await new Promise(r=>setTimeout(r,0));
 check(!!c.current,'retry creates a new scene');c.finish();check(done===1,'retry completes exactly once');
}
// Quiz asset fetch completing after Stop must not emit an orphaned voice.
{
 const {c,g}=harness(Quizssoir);c.voiceToken=0;c.hostVariation=new Map();c.current={clock:0};let emissions=0;
 const d=deferred();g.audio.bank.get=()=>d.promise;g.audio.enabled=true;g.audio.emit=()=>{emissions++;return{};};
 c.speak('intro');check(c.current.voiceStatus==='loading','quiz voice begins loading');c.stopVoice();d.resolve({duration:10});await Promise.resolve();
 check(emissions===0,'stale quiz fetch cannot play after stop');
}
console.log(JSON.stringify({passed:true,assertions,scope:'Mocked actual controller methods: skip while loading, late preload, duplicate play/finish, replay after skip, measured-duration pause/resume, origin retry, stale quiz fetch. No WebGL rendering or subjective listening.'},null,2));
