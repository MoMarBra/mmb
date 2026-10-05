import test from 'node:test';
import assert from 'node:assert/strict';
import {clockPair,utcOffset} from '../clocks.js';
import {deriveState,ports,startTime,endTime} from '../engine.js';
import {shipMesh,projectVertex,projectedFaces,createShipModel} from '../ship-model.js';

const pair=(iso,preview=true)=>{const t=Date.parse(iso);return clockPair(t,deriveState(t),preview);};
test('Germany clock crosses autumn DST at the exact UTC instant',()=>{
 const a=pair('2026-10-25T00:59:59Z'),b=pair('2026-10-25T01:00:00Z');
 assert.equal(a.germany.time,'02:59:59');assert.equal(a.germany.offset,'UTC+02:00');
 assert.equal(b.germany.time,'02:00:00');assert.equal(b.germany.offset,'UTC+01:00');
 assert.equal(utcOffset(Date.parse('2027-03-28T00:59:59Z'),'Europe/Berlin'),'UTC+01:00');
 assert.equal(utcOffset(Date.parse('2027-03-28T01:00:00Z'),'Europe/Berlin'),'UTC+02:00');
});
test('Hamburg before and after the trip uses local Berlin civil time',()=>{
 for(const t of [startTime-1,endTime,endTime+86400000]){
  const c=clockPair(t,deriveState(t),false);assert.equal(c.local.time,c.germany.time);assert.equal(c.local.zone,'Europe/Berlin');assert.equal(c.atSea,false);assert.match(c.local.label,/Ortszeit · Hamburg/);assert.match(c.mode,/Jetzt/);
 }
});
test('port clocks include fractional UTC offsets and explicit simulation mode',()=>{
 const port=ports.find(p=>p.id==='adelaide'),c=clockPair(port.arrival,deriveState(port.arrival),true);
 assert.equal(c.local.time,'07:00:00');assert.equal(c.local.offset,'UTC+10:30');assert.equal(c.germany.time,'21:30:00');
 assert.match(c.local.date,/06\.01\.2027/);assert.match(c.germany.date,/05\.01\.2027/);assert.match(c.mode,/Simulation/);
 assert.equal(c.local.epoch,c.germany.epoch);assert.equal(c.atSea,false);
});
test('civil date-line crossing names next-port reference, never claims onboard time',()=>{
 const cook=ports.find(p=>p.id==='aitutaki');
 const inPort=clockPair(cook.departure-1,deriveState(cook.departure-1));
 const atSea=clockPair(cook.departure,deriveState(cook.departure));
 assert.equal(inPort.local.zone,'Pacific/Rarotonga');assert.equal(atSea.local.zone,'Pacific/Tongatapu');
 assert.equal(inPort.local.offset,'UTC-10:00');assert.equal(atSea.local.offset,'UTC+13:00');
 assert.match(atSea.local.label,/Nächster Hafen/);assert.match(atSea.note,/tatsächliche Bordzeit kann abweichen/);
 assert.equal(atSea.local.epoch,atSea.germany.epoch);assert.notEqual(inPort.local.date,atSea.local.date);
});
test('every port and sea leg clock follows one selected instant through live and preview',()=>{
 for(const p of ports)for(const epoch of [p.arrival,p.departure])if(epoch!==null){
  for(const preview of [false,true]){const c=clockPair(epoch,deriveState(epoch),preview);assert.equal(c.local.epoch,epoch);assert.equal(c.germany.epoch,epoch);assert.match(c.local.time,/^\d\d:\d\d:\d\d$/);assert.match(c.local.offset,/^UTC[+-]\d\d:\d\d$/);assert.equal(c.isPreview,preview);}
 }
});
test('real low-poly XYZ mesh has volumetric hull, decks, funnel and perspective',()=>{
 assert.ok(shipMesh.length>100&&shipMesh.length<300);
 const vertices=shipMesh.flatMap(f=>f.points),extent=i=>Math.max(...vertices.map(v=>v[i]))-Math.min(...vertices.map(v=>v[i]));
 assert.ok(extent(0)>4);assert.ok(extent(1)>.8);assert.ok(extent(2)>1);
 assert.notDeepEqual(projectVertex([1,.5,.7],0),projectVertex([1,.5,.7],Math.PI/4));
 for(let angle=0;angle<Math.PI*2;angle+=.1)for(const face of projectedFaces(angle))for(const p of face.points){assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[0])<1&&Math.abs(p[1])<1);}
});
function fallbackHarness(){
 const listeners={};const canvas={dataset:{},addEventListener:(event,fn)=>listeners[event]=fn,getContext:()=>null};
 const fallback={style:{},children:[],ownerDocument:{createElementNS:()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;}})},replaceChildren(...children){this.children=children;}};
 return {canvas,fallback,listeners};
}
test('no-WebGL fallback projects the same model and remains rotatable',()=>{
 const {canvas,fallback,listeners}=fallbackHarness(),model=createShipModel(canvas,fallback);
 assert.equal(canvas.hidden,true);assert.equal(canvas.dataset.renderer,'svg-3d');assert.equal(fallback.style.display,'block');assert.equal(fallback.children.length,shipMesh.length);
 const first=fallback.children.map(f=>f.attrs.points).join(';');model.rotate();assert.notEqual(fallback.children.map(f=>f.attrs.points).join(';'),first);
 let prevented=false;listeners.webglcontextlost({preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(fallback.children.length,shipMesh.length);
});

test('WebGL path submits XYZ colored triangles with depth, perspective and fitted rotation',()=>{
 const {canvas,fallback}=fallbackHarness(),calls=[];
 const gl={getShaderParameter:()=>true,getProgramParameter:()=>true,isContextLost:()=>false,getAttribLocation:(_,name)=>name==='position'?0:1,getUniformLocation:(_,name)=>name,
 createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({})};
 for(const name of ['shaderSource','compileShader','attachShader','linkProgram','deleteShader','bindBuffer','bufferData','useProgram','enableVertexAttribArray','vertexAttribPointer','enable','clearColor','viewport','clear','uniform1f','drawArrays'])gl[name]=(...args)=>calls.push([name,...args]);
 Object.assign(gl,{VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,DEPTH_TEST:8,COLOR_BUFFER_BIT:16,DEPTH_BUFFER_BIT:32,TRIANGLES:9});
 canvas.getContext=()=>gl;const model=createShipModel(canvas,fallback);
 assert.equal(canvas.dataset.renderer,'webgl');assert.equal(canvas.dataset.rendererReason,'depth-renderer');assert.equal(canvas.hidden,false);assert.equal(fallback.style.display,'none');
 assert.ok(calls.some(c=>c[0]==='enable'&&c[1]===gl.DEPTH_TEST));assert.ok(calls.some(c=>c[0]==='drawArrays'&&c[3]>1000));
 assert.ok(calls.some(c=>c[0]==='shaderSource'&&c[2].includes('7.-depth')));
 model.rotate();assert.ok(calls.filter(c=>c[0]==='uniform1f'&&c[1]==='yaw').length===2);
});
