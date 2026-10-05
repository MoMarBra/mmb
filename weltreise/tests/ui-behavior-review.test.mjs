import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../engine.js';
import * as utils from '../ui-utils.js';
import * as clocks from '../clocks.js';
import * as ship from '../ship-model.js';
import * as portLabels from '../port-labels.js';

const base = new URL('../', import.meta.url);
class Element {
  constructor(id='', tagName='div') { Object.assign(this,{id,tagName,children:[],attrs:{},listeners:{},style:{},dataset:{},textContent:'',innerHTML:'',value:'',hidden:false,open:false});
    const classes=new Set(); this.classList={add:(x)=>classes.add(x),remove:(x)=>classes.delete(x),contains:(x)=>classes.has(x),toggle:(x,value)=>{const set=value??!classes.has(x);set?classes.add(x):classes.delete(x);return set;}};
  }
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)]);}
  querySelector(selector){const m=selector.match(/^\[data-month="([^"]+)"\]$/);return m?this.children.find(c=>c.dataset.month===m[1])??null:null;}
  focus(options){this.focusOptions=options;if(this.ownerDocument)this.ownerDocument.activeElement=this;}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  fire(name,e={}){for(const fn of this.listeners[name]??[])fn({target:this,preventDefault(){},...e});}
  click(){this.fire('click');}
  showModal(){this.open=true;}
  close(){this.open=false;this.fire('close');}
  getBoundingClientRect(){return {left:0,top:0,right:350,bottom:300,width:350,height:300};}
  closest(selector){return selector==='[data-month]'&&this.dataset.month?this:null;}
  setPointerCapture(){}
  scrollIntoView(options){this.scrollOptions=options;}
}
async function boot({landFails=false}={}) {
  const html=fs.readFileSync(new URL('index.html',base),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  elements['preview-datetime'].min='2026-10-01T00:00';elements['preview-datetime'].max='2027-03-01T23:59';
  elements['preview-zone'].value='Europe/Berlin'; elements['journey-slider'].value='0';elements['playback-speed'].value='86400';
  let clock=Date.parse('2026-10-05T15:00:00Z'),time=100;const raf=[],intervals=[],errors=[];
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const sandbox={...engine,...utils,...clocks,...ship,...portLabels,console:{error:(...a)=>errors.push(a)},Date:FakeDate,Intl,Number,Math,Set,Map,Array,Object,String,Error,Promise,
    document:{getElementById:id=>elements[id]??null,createElementNS:(_,tag)=>new Element('',tag),activeElement:null},
    performance:{now:()=>time},requestAnimationFrame:fn=>raf.push(fn),setInterval:fn=>intervals.push(fn),matchMedia:()=>({matches:false}),
    fetch:async()=>({ok:!landFails,json:async()=>JSON.parse(fs.readFileSync(new URL('assets/land.json',base),'utf8'))})};
  for(const element of Object.values(elements))element.ownerDocument=sandbox.document;
  // Model replacement month buttons and the browser's focus loss on removal.
  let monthMarkup='';
  Object.defineProperty(elements['month-tabs'],'innerHTML',{
    get(){return monthMarkup;},set(markup){
      if(this.children.includes(sandbox.document.activeElement))sandbox.document.activeElement=null;
      monthMarkup=markup;
      this.children=[...markup.matchAll(/<button[^>]*data-month="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>/g)].map(match=>{
        const button=new Element('','button');button.dataset.month=match[1];button.setAttribute('aria-pressed',match[2]);button.ownerDocument=sandbox.document;return button;
      });
    }
  });
  vm.createContext(sandbox);
  const source=fs.readFileSync(new URL('app.js',base),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source+`\n globalThis.__review={setPreview,render,frame,getState:()=>({preview,playing,now,selectedMonth,currentState,scale,center,landReady})};`,sandbox);
  await new Promise(setImmediate);
  return {elements,sandbox,errors,intervals,api:sandbox.__review,advance:ms=>{time+=ms;clock+=ms;const fn=raf.shift();fn(time);},setClock:ms=>clock=ms,fire:(id,event='click',extra={})=>elements[id].fire(event,extra)};
}

test('Hamburg exact start/end and countdown',()=>{
  assert.equal(new Date(engine.startTime).toISOString(),'2026-10-18T17:30:00.000Z');
  assert.equal(new Date(engine.endTime).toISOString(),'2027-02-21T07:00:00.000Z');
  assert.equal(utils.inputValue(engine.startTime,'Europe/Berlin'),'2026-10-18T19:30');
  assert.equal(utils.inputValue(engine.endTime,'Europe/Berlin'),'2027-02-21T08:00');
  assert.deepEqual(utils.countdownParts(engine.endTime-engine.startTime),{days:125,hours:13,minutes:30,seconds:0});
  assert.deepEqual(utils.countdownParts(-1),{days:0,hours:0,minutes:0,seconds:0});
});
test('DST repeated/nonexistent and invalid civil dates reject',()=>{
  assert.throws(()=>utils.parseWallTime('2026-10-25T02:30','Europe/Berlin'),/zweimal/);
  assert.throws(()=>utils.parseWallTime('2027-03-28T02:30','Europe/Berlin'),/existiert nicht/);
  assert.throws(()=>utils.parseWallTime('2026-02-30T10:00','UTC'));
  assert.equal(utils.parseWallTime('2026-10-25T01:30','Europe/Berlin'),Date.parse('2026-10-24T23:30Z'));
  assert.equal(utils.parseWallTime('2026-10-25T03:30','Europe/Berlin'),Date.parse('2026-10-25T02:30Z'));
});
test('all schedule wall times round-trip in their IANA timezone',()=>{
  for(const port of engine.ports)for(const kind of ['arrival','departure']){if(port[kind]==null)continue;
    assert.equal(utils.parseWallTime(utils.inputValue(port[kind],port.timezone),port.timezone),port[kind],`${port.id} ${kind}`);
  }
});
test('route SVG paths never draw a cross-world chord',()=>{
  for(const leg of engine.legs)for(const line of utils.splitAtDateline(engine.sampleLeg(leg,35))){
    for(let i=1;i<line.length;i++)assert.ok(Math.abs(line[i][0]-line[i-1][0])<=180,`leg ${leg.index}`);
  }
  for(const line of engine.routeForTime(engine.endTime,true,35)) {
    const path=utils.pathData(line);assert.ok(!/NaN|Infinity/.test(path));
    let prev=null; for(const match of path.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){const xy=[+match[2],+match[3]];if(match[1]==='L'&&prev)assert.ok(Math.abs(xy[0]-prev[0])<500);prev=xy;}
  }
});
test('startup, map load, accessible month buttons and actual distinct ports',async()=>{
  const h=await boot();assert.equal(h.errors.length,0);assert.equal(h.api.getState().landReady,true);
  assert.equal(h.elements['status-title'].textContent,'Start in Hamburg');assert.equal(h.elements['journey-percent'].textContent,'0 %');
  assert.equal(h.elements['stat-ports'].textContent,43);assert.equal(h.elements['port-dots'].children.length,44);
  assert.equal(h.elements['route-base'].children.length,43);assert.ok(h.elements['month-tabs'].innerHTML.includes('aria-pressed="true"'));
});
test('map fetch failure leaves countdown and itinerary usable',async()=>{
  const h=await boot({landFails:true});assert.equal(h.errors.length,1);assert.ok(h.elements['map-loading'].textContent.includes('konnte nicht geladen'));
  assert.equal(h.elements['status-title'].textContent,'Start in Hamburg');assert.ok(h.elements['itinerary-list'].innerHTML.includes('Hamburg'));
});
test('all port boundary and sea states render without missing labels',async()=>{
  const h=await boot();const times=[engine.startTime-1,engine.endTime,engine.endTime+1];
  for(const p of engine.ports)for(const kind of ['arrival','departure'])if(p[kind]!=null)times.push(p[kind]-1,p[kind],p[kind]+1);
  for(const l of engine.legs)times.push((l.start+l.end)/2);
  for(const ms of times){h.api.setPreview(ms);for(const id of ['status-title','next-name','next-time','local-clock','clock-zone'])assert.ok(h.elements[id].textContent&&!/undefined|NaN/.test(h.elements[id].textContent),`${id} ${ms}`);}
  assert.equal(h.errors.length,0);
});
test('settings apply switches exact input instant and reset returns live',async()=>{
  const h=await boot();h.fire('settings-trigger');assert.equal(h.elements['settings-dialog'].open,true);
  h.elements['preview-datetime'].value='2026-10-18T19:30';h.fire('apply-preview');
  assert.equal(h.api.getState().preview,engine.startTime);assert.equal(h.elements['settings-dialog'].open,false);assert.equal(h.elements['status-eyebrow'].textContent,'AUF SEE');
  assert.equal(h.elements['cd-days'].textContent,'125');assert.equal(h.elements['cd-hours'].textContent,'13');assert.equal(h.elements['cd-minutes'].textContent,'30');
  h.fire('settings-trigger');h.fire('reset-live');assert.equal(h.api.getState().preview,null);assert.equal(h.api.getState().playing,false);assert.equal(h.elements['settings-dialog'].open,false);assert.equal(h.elements['status-title'].textContent,'Start in Hamburg');
});
test('ambiguous datetime reports an error without closing dialog or applying',async()=>{
  const h=await boot();h.fire('settings-trigger');h.elements['preview-datetime'].value='2026-10-25T02:30';h.fire('apply-preview');
  assert.equal(h.api.getState().preview,null);assert.equal(h.elements['settings-dialog'].open,true);assert.ok(h.elements['preview-error'].textContent.includes('zweimal'));
  h.elements['preview-zone'].value='UTC';h.fire('preview-zone','change');h.elements['preview-datetime'].value='2026-10-25T01:30';h.fire('apply-preview');
  assert.equal(h.api.getState().preview,Date.parse('2026-10-25T01:30Z'));
});
test('slider endpoints, play/pause, exact finish and replay',async()=>{
  const h=await boot();h.fire('settings-trigger');h.elements['journey-slider'].value='10000';h.fire('journey-slider','input');
  assert.equal(h.api.getState().preview,engine.endTime);assert.equal(h.elements['status-title'].textContent,'Zurück in Hamburg');assert.equal(h.elements['journey-percent'].textContent,'100 %');
  h.fire('toggle-playback');assert.equal(h.api.getState().playing,true);assert.equal(h.api.getState().preview,engine.startTime);
  h.advance(100);assert.equal(h.api.getState().preview,engine.startTime+8640000);
  h.fire('toggle-playback');const paused=h.api.getState().preview;h.advance(100);assert.equal(h.api.getState().preview,paused);
  h.api.setPreview(engine.endTime-100);h.fire('toggle-playback');h.advance(100);assert.equal(h.api.getState().preview,engine.endTime);assert.equal(h.api.getState().playing,false);
});
test('port preview, selected month and jump current actions',async()=>{
  const h=await boot();const p=engine.ports.find(x=>x.arrivalDate?.startsWith('2027-01'));
  h.fire('month-tabs','click',{target:{closest:()=>({dataset:{month:'2027-01'}})}});assert.equal(h.api.getState().selectedMonth,'2027-01');
  h.fire('itinerary-list','click',{target:{closest:()=>({dataset:{port:String(p.index)}})}});assert.equal(h.api.getState().preview,p.arrival);assert.equal(h.elements['status-title'].textContent,p.name);
  h.fire('jump-current');assert.equal(h.api.getState().selectedMonth,'2027-01');
});
test('map zoom limits, locate, fit and keyboard return home',async()=>{
  const h=await boot();for(let i=0;i<15;i++)h.fire('zoom-in');assert.equal(h.api.getState().scale,7);
  h.fire('locate-ship');assert.equal(h.api.getState().scale,3.3);
  h.fire('map-canvas','keydown',{key:'Home'});assert.equal(h.api.getState().scale,1);assert.deepEqual(Array.from(h.api.getState().center),[500,250]);
  for(let i=0;i<15;i++)h.fire('zoom-out');assert.equal(h.api.getState().scale,1);
});

test('timezone selection preserves an entered unapplied date',async()=>{
  const h=await boot();h.fire('settings-trigger');h.elements['preview-datetime'].value='2027-01-20T12:15';
  h.elements['preview-zone'].value='UTC';h.fire('preview-zone','change');assert.equal(h.elements['preview-datetime'].value,'2027-01-20T12:15');
  h.fire('apply-preview');assert.equal(h.api.getState().preview,Date.parse('2027-01-20T12:15Z'));
});
test('zoomed class enables touch map dragging before gesture starts',async()=>{
  const h=await boot();h.fire('zoom-in');assert.equal(h.elements['map-canvas'].classList.contains('zoomed'),true);
  h.fire('fit-map');assert.equal(h.elements['map-canvas'].classList.contains('zoomed'),false);
});

test('Cape Town midnight departure is explicitly labeled on February 1',async()=>{
  const h=await boot();const p=engine.ports.find(p=>p.timezone==='Africa/Johannesburg'&&p.departureTime==='24:00');assert.ok(p);
  h.api.setPreview(p.arrival);h.fire('jump-current');
  assert.ok(h.elements['itinerary-list'].innerHTML.includes('01.02. · 00:00'));
});

test('preview bounds apply to chosen-zone wall dates, including midnight Hamburg',async()=>{
  const h=await boot();
  for(const value of ['2026-10-01T00:00','2026-10-01T01:59','2027-03-01T23:59']){
    h.fire('settings-trigger');h.elements['preview-datetime'].value=value;h.fire('apply-preview');
    assert.equal(h.elements['preview-error'].textContent,'');assert.equal(h.elements['settings-dialog'].open,false);
    assert.equal(utils.inputValue(h.api.getState().preview,'Europe/Berlin'),value);
  }
  for(const value of ['2026-09-30T23:59','2027-03-02T00:00']){
    h.fire('settings-trigger');const prior=h.api.getState().preview;h.elements['preview-datetime'].value=value;h.fire('apply-preview');
    assert.ok(h.elements['preview-error'].textContent);assert.equal(h.elements['settings-dialog'].open,true);assert.equal(h.api.getState().preview,prior);
  }
});

test('month button keeps keyboard focus after replacement without scrolling',async()=>{
  const h=await boot();const tabs=h.elements['month-tabs'];
  const oldButton=tabs.querySelector('[data-month="2026-11"]');assert.ok(oldButton);oldButton.focus();
  h.fire('month-tabs','click',{target:oldButton});
  const newButton=tabs.querySelector('[data-month="2026-11"]');assert.notEqual(newButton,oldButton);
  assert.equal(h.sandbox.document.activeElement,newButton);assert.equal(newButton.getAttribute('aria-pressed'),'true');assert.equal(newButton.focusOptions.preventScroll,true);
  h.api.render(true);const refreshed=tabs.querySelector('[data-month="2026-11"]');
  assert.equal(h.sandbox.document.activeElement,refreshed);assert.equal(refreshed.focusOptions.preventScroll,true);
  h.elements['preview-datetime'].focus();h.api.render(true);assert.equal(h.sandbox.document.activeElement,h.elements['preview-datetime']);
});

test('two visible clocks switch together between live, simulation, playback and reset',async()=>{
 const h=await boot();assert.equal(h.elements['local-clock'].textContent,'17:00:00');assert.equal(h.elements['germany-clock'].textContent,'17:00:00');
 assert.match(h.elements['clocks-mode'].textContent,/Jetzt/);
 h.api.setPreview(Date.parse('2027-01-06T01:00:00Z'));assert.equal(h.elements['local-clock'].textContent,'11:30:00');assert.equal(h.elements['germany-clock'].textContent,'02:00:00');assert.match(h.elements['clocks-mode'].textContent,/Simulation/);
 h.fire('toggle-playback');h.advance(100);assert.notEqual(h.elements['local-clock'].textContent,'11:30:00');assert.notEqual(h.elements['germany-clock'].textContent,'02:00:00');
 h.fire('reset-live');assert.match(h.elements['clocks-mode'].textContent,/Jetzt/);assert.equal(h.elements['local-clock'].textContent,h.elements['germany-clock'].textContent);
});
test('3D model remains available without WebGL and map marker follows route without zoom growth',async()=>{
 const h=await boot();assert.equal(h.elements['ship-model'].dataset.renderer,'svg-3d');assert.ok(h.elements['ship-fallback'].children.length>100);
 const before=h.elements['ship-fallback'].children[0].attrs.points;h.fire('rotate-ship');assert.notEqual(h.elements['ship-fallback'].children[0].attrs.points,before);
 const marker=h.elements['ship-marker'],start=marker.attrs.transform;
 h.api.setPreview((engine.startTime+engine.legs[0].end)/2);assert.notEqual(marker.attrs.transform,start);
 const size=()=>Number(marker.attrs.transform.match(/scale\(([^)]+)\)/)[1]),initial=size();h.fire('zoom-in');assert.ok(Math.abs(size()*h.api.getState().scale-initial)<1e-10);
});
