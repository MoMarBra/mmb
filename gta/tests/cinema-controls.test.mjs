import assert from 'node:assert/strict';
import fs from 'node:fs';
const listeners=new Map(),elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:'',style:{},focus(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);};
globalThis.window={addEventListener(k,f){listeners.set(k,f);},removeEventListener(){}};
globalThis.document={hidden:false,body:{classList:{add(){},remove(){}}},getElementById:element,addEventListener(k,f){listeners.set(k,f);},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}};
const renderStubs = `class Vector { set(x,y,z){Object.assign(this,{x,y,z});return this;} copy(){return this;} add(){return this;} lerp(){return this;} clone(){return new Vector();} applyAxisAngle(){return this;} }
const THREE={PerspectiveCamera:class { constructor(){this.position=new Vector();} updateProjectionMatrix(){} lookAt(){} },Vector2:Vector,Vector3:Vector};
const renderGameScene=()=>{}, updateFireSet=()=>{}, animateStoryActor=()=>{}, animateKitchen=()=>{};\n`;
async function load(file){let s=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import .*;\n/gm,'');return import('data:text/javascript;base64,'+Buffer.from(renderStubs+s).toString('base64'));}
const {OriginCinema}=await load('origin-cinema.js'),{FireCinema}=await load('fire-cinema.js');
let assertions=0;const check=(v,msg)=>{assert.ok(v,msg);assertions++;};
for(const Class of [OriginCinema,FireCinema]){
 let unlocks=0; const story={g:{audio:{unlockOnInput(){unlocks++;}}},w:{}},c=new Class(story);if(Class===FireCinema)c.bindControls();
 c.current={paused:false};let pauses=0,finishes=0;c.pause=()=>pauses++;c.finish=()=>finishes++;
 const handler=listeners.get('keydown');
 for(const code of ['Enter','Space']){
  let prevented=false,stopped=false;handler({code,key:code,target:{tagName:'BUTTON',offsetParent:{},disabled:false},preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  check(!prevented&&stopped&&pauses===0&&finishes===0,Class.name+' native '+code+' activation preserved');
 }
 handler({code:'Enter',target:{tagName:'DIV'},preventDefault(){},stopImmediatePropagation(){}});check(finishes===1,Class.name+' global Enter still skips');check(unlocks===3,Class.name+' forwards real inputs to audio unlock');
}
{
 const c=new OriginCinema({g:{audio:{}},w:{}});c.loading=true;c.pendingPaused=false;const handler=listeners.get('keydown');
 const escape=()=>handler({code:'Escape',target:{tagName:'DIV'},preventDefault(){},stopImmediatePropagation(){}});
 escape();check(c.pendingPaused===true,'first Escape pauses preparation');escape();check(c.pendingPaused===false,'second Escape resumes preparation');
 c.updatePauseUI(true);check(!element('origin-paused').hidden&&element('origin-pause').textContent.includes('Fortsetzen'),'paused initial UI is visible and labelled Resume');
 c.updatePauseUI(false);check(element('origin-paused').hidden&&element('origin-pause').textContent.startsWith('Pause'),'resumed UI reflects state');
}
// Bare context interruption must pause before elapsed/index can replace an unheard line.
// Keep the real render, pause, and keyboard paths; only scene drawing is stubbed.
function movieHarness(Class, state = 'running', enabled = true, ready = true) {
 const spoken=[], handles=[]; let finishes=0;
 const handle=()=>{const h={stopped:false,stop(){this.stopped=true;}};handles.push(h);return h;};
 const audio={ready,enabled,ctx:{state},bank:{buffers:new Map()},
  unlockOnInput(){this.ctx.state='running';},emit(){spoken.push('origin');return handle();},
  voices:{stop(){for(const h of handles)h.stop();},say(){spoken.push('fire');return true;}}};
 const w={keys:new Set(),renderer:{getSize(size){size.x=960;size.y=600;},shadowMap:{},setRenderTarget(){}}};
 const c=new Class({g:{audio,sim:{s:{music:false,audioSubtitles:true}}},w,remember(){}});
 if(Class===FireCinema)c.bindControls();
 const line={actor:'player',speaker:'Test',text:'Test sentence',asset:'test',id:'test',key:'test'};
 const m=c.current={kind:Class===OriginCinema?'home':'intro',paused:false,elapsed:1.5,index:0,duration:5,
  segments:[{start:1,voiceEnd:3,end:3.2,line},{start:3.2,voiceEnd:4.5,end:4.7,line}],
  voice:handle(),bed:handle(),sounds:new Map(Class===FireCinema?[['bed',{handle:handle()}]]:[]),soundGeneration:0,
  set:{actors:{},scene:{}},markers:{},drawn:true,width:960,height:600,frameDrawn:true};
 c.ui={speaker:element('speaker'),line:element('line'),subtitles:element('subtitles'),progress:element('progress'),time:element('time')};
 c.frameCamera=()=>{};c.syncSounds=()=>{};c.finish=()=>finishes++;
 return {c,m,audio,spoken,handles,finished:()=>finishes};
}
for(const Class of [OriginCinema,FireCinema]) {
 for(const state of ['suspended','interrupted']) {
  const {c,m,audio,spoken,handles,finished}=movieHarness(Class,state);
  c.render(.25);
  check(m.paused&&m.elapsed===1.5&&m.index===0&&!finished(),Class.name+' '+state+' pauses before timeline advances');
  check(handles.every(h=>h.stopped),Class.name+' '+state+' releases interrupted audio ownership');
  const prefix=Class===OriginCinema?'origin':'fire';
  check(!element(prefix+'-paused').hidden&&element(prefix+'-pause').textContent.includes('Fortsetzen'),Class.name+' '+state+' exposes native Resume');
  for(let i=0;i<40;i++)c.render(.25);
  check(m.elapsed===1.5&&!spoken.length&&!finished(),Class.name+' '+state+' cannot replace dialogue or finish while interrupted');
  audio.ctx.state='running';c.render(.1);
  check(m.paused&&m.elapsed===1.5,Class.name+' waits for intentional Resume after audio recovers');
  // Escape follows the real key handler and its existing sentence replay rule.
  listeners.get('keydown')({code:'Escape',key:'Escape',target:{tagName:'DIV'},preventDefault(){},stopImmediatePropagation(){}});
  check(!m.paused&&m.elapsed===1&&m.index===-1,Class.name+' native Resume rewinds only interrupted sentence');
  c.render(.1);
  check(m.index===0&&spoken.length===1,Class.name+' resumed sentence emits once');
 }
 for(const [state,enabled,ready,label] of [
  ['suspended',false,true,'muted suspended'],['interrupted',false,true,'muted interrupted'],
  ['suspended',true,false,'unavailable audio'],['running',true,true,'normal running'],
 ]) {
  const {c,m,finished}=movieHarness(Class,state,enabled,ready);
  for(let i=0;i<20&&!finished();i++)c.render(.25);
  check(!m.paused&&finished()===1,Class.name+' '+label+' retains normal timeline progression');
 }
 {
  const {c,m}=movieHarness(Class,'suspended');
  m.elapsed=3.1;c.render(.1);c.g.audio.ctx.state='running';c.pause(false);
  check(m.elapsed===3.1&&m.index===0,Class.name+' trailing silence resumes without replaying completed sentence');
 }
}
// Browser regression: a Resume click can precede AudioContext.resume resolution.
// Re-render during that pending promise, rather than making unlock synchronous.
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
for(const Class of [OriginCinema,FireCinema]) {
 for(const state of ['suspended','interrupted']) {
  const {c,m,audio,spoken}=movieHarness(Class,state),pending=deferred();let calls=0;
  audio.ctx.resume=()=>{calls++;return pending.promise;};
  c.render(.25);c.pause(false);
  check(m.paused&&m.elapsed===1.5&&m.index===0&&calls===1,Class.name+' '+state+' Resume waits for actual context recovery');
  for(let i=0;i<4;i++){c.pause(false);c.render(.25);}
  check(m.paused&&m.elapsed===1.5&&calls===1&&!spoken.length,Class.name+' repeated pending Resume clicks neither advance nor duplicate requests');
  audio.ctx.state='running';pending.resolve();await flush();
  check(!m.paused&&m.elapsed===1&&m.index===-1&&!m.resumeRequest,Class.name+' resolved Resume replays only the interrupted sentence');
  c.render(.1);c.render(.1);
  check(m.index===0&&spoken.length===1,Class.name+' resumed render emits exactly once after async recovery');
 }
 for(const cancellation of ['pause','hidden','skip','replay']) {
  const {c,m,audio,spoken}=movieHarness(Class,'suspended'),pending=deferred();
  audio.ctx.resume=()=>pending.promise;c.render(.1);c.pause(false);
  if(cancellation==='pause')c.pause(true);
  if(cancellation==='hidden') {
   document.hidden=true;listeners.get('visibilitychange')();document.hidden=false;
  }
  if(['skip','replay'].includes(cancellation)) {
   c.g.close=()=>{};Class.prototype.finish.call(c);
   check(!c.current,Class.name+' actual Skip clears movie during pending Resume');
   if(cancellation==='replay')c.current={...m,paused:true,resumeRequest:null,elapsed:0,index:-1};
  }
  audio.ctx.state='running';pending.resolve();await flush();
  check(m.paused&&m.elapsed===1.5&&!spoken.length,Class.name+' '+cancellation+' invalidates late Resume continuation');
  if(cancellation==='skip')check(!c.current,Class.name+' late Resume cannot resurrect skipped movie');
  if(cancellation==='replay')check(c.current!==m&&c.current.paused&&c.current.elapsed===0,Class.name+' late Resume cannot unpause replay owner');
 }
 for(const failure of ['reject','throw','still-suspended']) {
  const {c,m,audio}=movieHarness(Class,'suspended');c.render(.1);
  audio.ctx.resume=()=>{if(failure==='throw')throw Error('blocked');return failure==='reject'?Promise.reject(Error('blocked')):Promise.resolve();};
  c.pause(false);await flush();
  check(m.paused&&m.elapsed===1.5&&!m.resumeRequest,Class.name+' '+failure+' leaves recoverable paused controls');
  audio.ctx.resume=()=>{audio.ctx.state='running';return Promise.resolve();};
  c.pause(false);await flush();
  check(!m.paused&&m.elapsed===1,Class.name+' successful retry after '+failure+' resumes once');
 }
 for(const fallback of ['muted','unavailable','no-context']) {
  const {c,m,audio}=movieHarness(Class,'running');let calls=0;
  c.pause(true);audio.ctx.state='suspended';audio.ctx.resume=()=>{calls++;return Promise.resolve();};
  if(fallback==='muted')audio.enabled=false;
  if(fallback==='unavailable')audio.ready=false;
  if(fallback==='no-context')audio.ctx=undefined;
  c.pause(false);
  check(!m.paused&&m.elapsed===1&&calls===0,Class.name+' '+fallback+' Resume keeps existing caption-only fallback');
 }
 {
  const {c,m,audio}=movieHarness(Class,'suspended'),pending=deferred();
  audio.ctx.resume=()=>pending.promise;c.render(.1);c.pause(false);
  audio.enabled=false;c.pause(false);
  check(!m.paused&&!m.resumeRequest,Class.name+' muting permits explicit caption-only Resume while old request waits');
  c.pause(true);audio.ctx.state='running';pending.resolve();await flush();
  check(m.paused,Class.name+' obsolete muted Resume cannot override a newer pause');
 }
}
console.log(JSON.stringify({passed:true,assertions,scope:'Actual cinema keyboard handlers, pause UI, bare context interruptions, asynchronous Resume races/cancellation/retry, sentence replay and muted/unavailable-audio progression; real DOM button clicks covered by browser suite.'},null,2));
