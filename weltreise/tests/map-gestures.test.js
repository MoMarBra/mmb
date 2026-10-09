import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../engine.js';
import * as utils from '../ui-utils.js';
import * as clocks from '../clocks.js';
import * as ship from '../ship-model.js';
import * as labels from '../port-labels.js';
import * as birthday from '../birthday.js';
import * as holiday from '../holiday.js';
import {installBirthdayDom} from './birthday-dom.js';
import {installHolidayDom} from './holiday-dom.js';

const base=new URL('../',import.meta.url);
class Element {
 constructor(id='',tagName='div'){
  Object.assign(this,{id,tagName,attrs:{},children:[],listeners:{},style:{},dataset:{},value:'',textContent:'',innerHTML:'',hidden:false,open:false,captured:new Set()});
  const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,v)=>{const on=v??!classes.has(x);on?classes.add(x):classes.delete(x);return on;}};
 }
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)]);}
 querySelector(){return null;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name,values={}){const e={target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...values};for(const fn of this.listeners[name]??[])fn(e);return e;}
 click(){return this.fire('click');}
 closest(selector){return selector==='button'&&this.tagName==='button'?this:null;}
 getBoundingClientRect(){return this.rect??{left:0,top:0,width:1000,height:500,right:1000,bottom:500};}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);this.fire('lostpointercapture',{pointerId:id});}
 showModal(){this.open=true;}
 close(){this.open=false;}
 scrollIntoView(){}
}
function boot(rect){
 const html=readFileSync(new URL('index.html',base),'utf8');
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
 elements['preview-zone'].value='Europe/Berlin';
 if(rect)elements['map-canvas'].rect=rect;
 const document=new Element();Object.assign(document,{getElementById:id=>elements[id],createElementNS:(_,tag)=>{const node=new Element('',tag);node.ownerDocument=document;return node;},activeElement:null});
 installBirthdayDom(document,elements);
 installHolidayDom(document,elements);
 for(const node of Object.values(elements))node.ownerDocument=document;
 const windowEvents=new Element();
 const sandbox={...engine,...utils,...clocks,...ship,...labels,...birthday,...holiday,document,console,Date,Intl,Number,Math,Set,Map,Array,Object,String,Error,Promise,
  performance:{now:()=>0},requestAnimationFrame(){},setInterval(){},matchMedia:()=>({matches:false}),fetch:()=>new Promise(()=>{}),
  addEventListener:(name,fn)=>windowEvents.addEventListener(name,fn)};
 vm.createContext(sandbox);
 const source=readFileSync(new URL('app.js',base),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(source+'\nglobalThis.mapReview={read:()=>({scale,center,drag,pointers:mapPointers.size}),clearMapGesture,setPreview};',sandbox);
 const canvas=elements['map-canvas'];
 const pointer=(type,id,x,y,extra={})=>canvas.fire(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,...extra});
 const read=()=>JSON.parse(JSON.stringify(sandbox.mapReview.read()));
 return {elements,canvas,pointer,read,document,windowEvents,preview:ms=>sandbox.mapReview.setPreview(ms),click:id=>elements[id].click(),key:key=>canvas.fire('keydown',{key})};
}
function close(actual,expected,message=''){assert.ok(Math.abs(actual-expected)<1e-8,`${message}: ${actual} != ${expected}`);}
function sameState(h,state){close(h.read().scale,state.scale);h.read().center.forEach((x,i)=>close(x,state.center[i]));}
function pointUnder(h,x,y){const r=h.canvas.getBoundingClientRect(),u=Math.min(r.width/1000,r.height/500)||1,s=h.read();return [s.center[0]+(x-r.left-r.width/2)/u/s.scale,s.center[1]+(y-r.top-r.height/2)/u/s.scale];}
function startPinch(h){h.pointer('pointerdown',1,400,250);h.pointer('pointerdown',2,600,250);h.pointer('pointermove',1,300,250);h.pointer('pointermove',2,700,250);}

test('seasonal decorations preserve pinch, pan and map controls through repeated theme changes',()=>{
 const h=boot();
 for(const [ms,theme] of [[Date.parse('2026-12-24T12:00:00Z'),'christmas'],[Date.parse('2026-12-31T12:00:00Z'),'newyear'],[Date.parse('2026-12-25T12:00:00Z'),'christmas']]){
  h.preview(ms);assert.equal(h.document.body.classList.contains(`holiday-${theme}`),true);
  h.click('fit-map');startPinch(h);close(h.read().scale,2);
  h.pointer('pointercancel',1,300,250);h.pointer('pointercancel',2,700,250);assert.equal(h.read().pointers,0);
  h.click('zoom-in');assert.ok(h.read().scale>2);h.key('Home');close(h.read().scale,1);
  const before=h.read();h.pointer('pointerdown',1,500,250);h.pointer('pointermove',1,530,280);
  close(h.read().center[0],before.center[0]-30);close(h.read().center[1],before.center[1]-30);
  h.pointer('pointerup',1,530,280);assert.equal(h.read().pointers,0);
  assert.equal(h.document.body.querySelectorAll('.holiday-atmosphere').length,1);
 }
 h.preview(Date.parse('2027-01-02T12:00:00Z'));assert.equal(h.document.body.querySelectorAll('.holiday-atmosphere').length,0);
});

test('two-finger zoom preserves its moving focal point across SVG letterboxing',()=>{
 for(const rect of [{left:0,top:0,width:1000,height:500},{left:40,top:100,width:390,height:300},{left:60,top:25,width:1400,height:400}]){
  const h=boot(rect),x=rect.left+rect.width*.47,y=rect.top+rect.height*.43,offset=rect.width*.1;
  const anchor=pointUnder(h,x,y);
  h.pointer('pointerdown',1,x-offset,y);h.pointer('pointerdown',2,x+offset,y);
  h.pointer('pointermove',1,x-offset*2+10,y+8);h.pointer('pointermove',2,x+offset*2+10,y+8);
  close(h.read().scale,2);pointUnder(h,x+10,y+8).forEach((v,i)=>close(v,anchor[i],'focal anchor'));
  assert.equal(h.canvas.captured.size,2);assert.equal(h.canvas.classList.contains('dragging'),true);
 }
});

test('moving both fingers together pans without changing the final zoom',()=>{
 const h=boot();h.click('zoom-in');const before=h.read();
 h.pointer('pointerdown',1,350,250);h.pointer('pointerdown',2,650,250);
 h.pointer('pointermove',1,390,270);h.pointer('pointermove',2,690,270);
 close(h.read().scale,before.scale);close(h.read().center[0],500-40/1.6);close(h.read().center[1],250-20/1.6);
});

test('one-finger touch pans both axes and retains the small-movement threshold',()=>{
 const h=boot(),before=h.read();h.pointer('pointerdown',1,500,250);h.pointer('pointermove',1,502,253);sameState(h,before);
 const move=h.pointer('pointermove',1,500,275);assert.equal(move.defaultPrevented,true);close(h.read().center[1],225);
 h.pointer('pointermove',1,525,275);close(h.read().center[0],475);h.pointer('pointerup',1,525,275);
 assert.equal(h.read().pointers,0);assert.equal(h.canvas.captured.size,0);assert.equal(h.canvas.classList.contains('dragging'),false);
});

test('either lifted finger can leave a seamless one-finger pan after pinching',()=>{
 for(const lifted of [1,2]){
  const h=boot();startPinch(h);const before=h.read(),remaining=lifted===1?2:1,x=remaining===1?300:700;
  h.pointer('pointerup',lifted,lifted===1?300:700,250);sameState(h,before);
  assert.equal(h.read().pointers,1);assert.equal(h.read().drag.kind,'pan');
  h.pointer('pointermove',remaining,x+2,251);close(h.read().center[0],before.center[0]-1);close(h.read().center[1],before.center[1]-.5);
  h.pointer('pointermove',remaining,x+40,270);close(h.read().center[0],before.center[0]-20);close(h.read().center[1],before.center[1]-10);
  h.pointer('pointerup',remaining,x+40,270);const end=h.read();h.pointer('pointermove',remaining,900,400);sameState(h,end);
 }
});

test('cancellation and lost capture remove only that pointer, with no stale gesture',()=>{
 for(const event of ['pointercancel','lostpointercapture']){
  const h=boot();startPinch(h);h.pointer(event,1,300,250);const before=h.read();
  h.pointer('pointermove',1,900,400);sameState(h,before);assert.equal(h.read().pointers,1);
  h.pointer('pointermove',2,720,250);close(h.read().center[0],before.center[0]-10);
  h.pointer(event,2,720,250);assert.equal(h.read().pointers,0);assert.equal(h.read().drag,null);assert.equal(h.canvas.captured.size,0);
  h.pointer('pointerdown',3,500,250);h.pointer('pointermove',3,520,250);close(h.read().center[0],before.center[0]-20);
 }
});

test('window blur and hidden-tab interruption release every pointer',()=>{
 for(const interrupt of [h=>h.windowEvents.fire('blur'),h=>{h.document.hidden=true;h.document.fire('visibilitychange');}]){
  const h=boot();startPinch(h);const before=h.read();interrupt(h);
  assert.equal(h.read().pointers,0);assert.equal(h.read().drag,null);assert.equal(h.canvas.captured.size,0);assert.equal(h.canvas.classList.contains('dragging'),false);
  h.pointer('pointermove',1,20,20);h.pointer('pointermove',2,950,490);sameState(h,before);
 }
});

test('pinch scale stays between 1 and 7 and every center stays inside map bounds',()=>{
 const h=boot();h.pointer('pointerdown',1,499,250);h.pointer('pointerdown',2,501,250);
 h.pointer('pointermove',1,-10000,-10000);h.pointer('pointermove',2,10000,10000);assert.equal(h.read().scale,7);
 for(const [x,y]of [[10000,10000],[-10000,-10000],[0,0]]){
  h.pointer('pointermove',1,x,y);h.pointer('pointermove',2,x,y);
  const s=h.read();assert.ok(s.scale>=1&&s.scale<=7);assert.ok(s.center[0]>=0&&s.center[0]<=1000);assert.ok(s.center[1]>=0&&s.center[1]<=500);
 }
 assert.equal(h.read().scale,1);assert.doesNotMatch(h.elements['map-scene'].attrs.transform,/NaN|Infinity/);
});

test('coincident starting fingers establish a usable baseline without sudden zoom',()=>{
 const h=boot();h.pointer('pointerdown',1,400,250);h.pointer('pointerdown',2,400,250);
 h.pointer('pointermove',2,500,250);assert.equal(h.read().scale,1);
 h.pointer('pointermove',2,600,250);assert.equal(h.read().scale,2);
 assert.doesNotMatch(h.elements['map-scene'].attrs.transform,/NaN|Infinity/);
});

test('third finger is inert until taking over a released active pointer',()=>{
 const h=boot();startPinch(h);const before=h.read();
 h.pointer('pointerdown',3,500,350);h.pointer('pointermove',3,600,400);sameState(h,before);
 h.pointer('pointerup',1,300,250);sameState(h,before);assert.equal(h.read().drag.kind,'pinch');
 h.pointer('pointermove',3,500,450);assert.notEqual(h.read().scale,before.scale);
 h.pointer('pointerup',2,700,250);assert.equal(h.read().drag.kind,'pan');h.pointer('pointerup',3,500,450);assert.equal(h.read().pointers,0);
});

test('repeated pinch-in, pinch-out and interrupted gestures start from current state',()=>{
 const h=boot();
 for(let i=0;i<12;i++){
  h.click('fit-map');startPinch(h);close(h.read().scale,2);h.pointer('pointerup',1,300,250);h.pointer('pointerup',2,700,250);
  h.pointer('pointerdown',1,300,250);h.pointer('pointerdown',2,700,250);h.pointer('pointermove',1,400,250);h.pointer('pointermove',2,600,250);close(h.read().scale,1);
  h.pointer(i%2?'pointercancel':'pointerup',1,400,250);h.pointer('pointerup',2,600,250);assert.equal(h.read().pointers,0);
  assert.doesNotMatch(h.elements['map-scene'].attrs.transform,/NaN|Infinity/);
 }
});

test('map buttons and non-primary mouse buttons never start map gestures',()=>{
 const h=boot(),before=h.read(),button=new Element('zoom-in','button');
 h.pointer('pointerdown',1,500,250,{target:button});h.pointer('pointerdown',2,500,250,{pointerType:'mouse',button:2});
 h.pointer('pointermove',1,900,450);h.pointer('pointermove',2,900,450);sameState(h,before);assert.equal(h.read().pointers,0);assert.equal(h.canvas.captured.size,0);
});

test('mouse drag, keyboard zoom, keyboard pan bounds and Home remain available',()=>{
 const h=boot();h.click('zoom-in');h.pointer('pointerdown',1,500,250,{pointerType:'mouse'});
 h.pointer('pointermove',99,100,100,{pointerType:'mouse'});close(h.read().center[0],500);
 h.pointer('pointermove',1,540,270,{pointerType:'mouse'});close(h.read().center[0],475);close(h.read().center[1],237.5);
 h.pointer('pointerup',1,540,270,{pointerType:'mouse'});assert.equal(h.canvas.captured.size,0);
 assert.equal(h.key('+').defaultPrevented,true);close(h.read().scale,2.56);h.key('-');close(h.read().scale,1.6);h.key('=');close(h.read().scale,2.56);
 for(let i=0;i<100;i++){h.key('ArrowLeft');h.key('ArrowUp');}assert.deepEqual(h.read().center,[0,0]);
 for(let i=0;i<200;i++){h.key('ArrowRight');h.key('ArrowDown');}assert.deepEqual(h.read().center,[1000,500]);
 h.key('Home');assert.equal(h.read().scale,1);assert.deepEqual(h.read().center,[500,250]);assert.equal(h.key('Tab').defaultPrevented,false);
});

test('map controls interrupt a gesture so stale finger moves cannot undo the chosen view',()=>{
 for(const change of [h=>h.click('fit-map'),h=>h.click('zoom-in'),h=>h.click('zoom-out'),h=>h.click('locate-ship'),h=>h.key('ArrowLeft'),h=>h.key('Home')]){
  const h=boot();startPinch(h);change(h);const chosen=h.read();assert.equal(chosen.pointers,0);assert.equal(h.canvas.captured.size,0);
  h.pointer('pointermove',1,100,50);h.pointer('pointermove',2,900,450);sameState(h,chosen);
 }
});

test('pinching keeps the ship marker at its existing constant screen size',()=>{
 const h=boot(),marker=h.elements['ship-marker'],size=()=>+marker.attrs.transform.match(/scale\(([^)]+)\)/)[1],before=size();
 startPinch(h);close(size()*h.read().scale,before);
});

test('map touch handling prevents native page pinch zoom without restricting the viewport',()=>{
 const h=boot();assert.equal(h.pointer('pointerdown',1,400,250).defaultPrevented,true);h.pointer('pointerdown',2,600,250);
 assert.equal(h.pointer('pointermove',2,700,250).defaultPrevented,true);
 const css=readFileSync(new URL('style.css',base),'utf8'),html=readFileSync(new URL('index.html',base),'utf8');
 assert.match(css,/\.map-canvas\s*\{[^}]*touch-action:\s*none\b/);
 assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});


test('larger ship marker stays screen-sized through zoom, reset and layout changes',()=>{
 for(const width of [280,350,599,600,958]){
  const rect={left:0,top:0,width,height:width<600?300:465},h=boot(rect);
  const screenSize=()=>Number(h.elements['ship-marker'].attrs.transform.match(/scale\(([^)]+)\)/)[1])*100*Math.min(rect.width/1000,rect.height/500)*h.read().scale;
  const expected=width<600?92:116;close(screenSize(),expected);
  for(let i=0;i<8;i++){h.click('zoom-in');close(screenSize(),expected);}
  h.click('locate-ship');close(screenSize(),expected);
  h.click('fit-map');close(screenSize(),expected);
  rect.width=800;h.click('fit-map');close(screenSize(),116);
 }
});

