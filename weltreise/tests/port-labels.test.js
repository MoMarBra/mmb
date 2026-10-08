import test from 'node:test';
import assert from 'node:assert/strict';
import {ports,deriveState,startTime} from '../engine.js';
import {project} from '../ui-utils.js';
import {layoutPortLabels} from '../port-labels.js';

test('small harbor labels avoid each other and controls in a 393px mobile map',()=>{
 const rect={width:353,height:300},labels=layoutPortLabels(ports,project,[500,250],1,rect,deriveState(startTime-1));
 assert.ok(labels.length>=6);assert.ok(labels.some(p=>p.name==='Hamburg'));
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
  const a=labels[i].box,b=labels[j].box;assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
 }
 assert.equal(labels.filter(p=>p.name==='Hamburg').length,1);
 for(const p of labels){assert.ok(p.box.x>=0&&p.box.x+p.box.width<rect.width);assert.ok(p.fontSize*.353>=8.49);}
});
test('zoomed labels keep readable screen size and active harbor stays prioritized',()=>{
 const port=ports.find(p=>p.id==='sydney'),rect={width:353,height:300},state=deriveState(port.arrival);
 for(const scale of [1,3.3,7]){
  const labels=layoutPortLabels(ports,project,project(port.coord),scale,rect,state),active=labels.find(p=>p.port.id===port.id);
  assert.ok(active);assert.equal(active.active,true);assert.ok(Math.abs(active.fontSize*.353*scale-(scale>2?9.5:8.5))<1e-8);
 }
});
test('hidden or zero-width map safely omits labels',()=>{
 assert.deepEqual(layoutPortLabels(ports,project,[500,250],1,{width:0,height:0},deriveState(startTime)),[]);
});


test('enlarged hull keeps harbor names clear at mobile and desktop zoom levels',()=>{
 for(const width of [320,393,960])for(const scale of [1,3.3,7]){
  const rect={width,height:width<600?300:465},position=ports[0].coord,center=project(position),markerPixels=width<600?60:72;
  const state={port:ports[0],position,markerPixels};
  const labels=layoutPortLabels(ports,project,center,scale,rect,state);
  assert.ok(labels.some(l=>l.port.id===ports[0].id));
  const box={x:width/2-markerPixels/2,y:rect.height/2-markerPixels/2,width:markerPixels,height:markerPixels};
  for(const l of labels)assert.ok(l.box.x>=box.x+box.width||l.box.x+l.box.width<=box.x||l.box.y>=box.y+box.height||l.box.y+l.box.height<=box.y);
 }
});
