import test from 'node:test';
import assert from 'node:assert/strict';
import {ports,legs,startTime,endTime,deriveState} from '../engine.js';
import {countdownView,countdownParts} from '../ui-utils.js';

const view=ms=>countdownView(deriveState(ms));
test('countdown model preserves the predeparture view and clamps completion',()=>{
 for(const ms of [startTime-86400000,startTime-1]){
  const v=view(ms);assert.equal(v.primary.label,'Die Reise beginnt in');assert.equal(v.primary.ariaLabel,'Countdown bis zur Abfahrt');assert.equal(v.home.visible,false);assert.deepEqual(v.primary.parts,countdownParts(startTime-ms));
 }
 for(const ms of [endTime,endTime+1,endTime+365*86400000]){
  const v=view(ms);assert.equal(v.primary.label,'Einmal um die Welt. Wieder zu Hause.');assert.equal(v.home.visible,true);assert.equal(v.home.label,'Wieder in Hamburg');assert.deepEqual(v.primary.parts,{days:0,hours:0,minutes:0,seconds:0});assert.deepEqual(v.home.parts,v.primary.parts);
 }
});
test('all overnight stays keep the departure target across local midnight',()=>{
 for(const port of ports.filter(p=>p.overnight))for(const ms of [port.arrival,(port.arrival+port.departure)/2,port.departure-1]){
  const v=view(ms);assert.equal(v.primary.label,`Ablegen in ${port.name}`);assert.deepEqual(v.primary.parts,countdownParts(port.departure-ms));assert.deepEqual(v.home.parts,countdownParts(endTime-ms));
 }
 const cape=ports.find(p=>p.id==='cape-town');assert.equal(new Date(cape.departure).toISOString(),'2027-01-31T22:00:00.000Z');assert.match(view(cape.departure).primary.label,/^Ankunft in/);
});
test('DST and the westward date line use elapsed UTC time for both countdowns',()=>{
 const before=Date.parse('2026-10-25T00:59:59Z'),after=before+1000;
 assert.deepEqual(view(before).primary.parts,countdownParts(deriveState(before).nextEventTime-before));
 assert.deepEqual(view(after).primary.parts,countdownParts(deriveState(before).nextEventTime-after));
 const leg=legs.find(l=>l.from.id==='aitutaki');assert.ok(leg);
 assert.equal((leg.end-leg.start)/3600000,61);assert.deepEqual(view(leg.start).primary.parts,{days:2,hours:13,minutes:0,seconds:0});
 for(const ms of [leg.start,leg.end-1,leg.end]){const v=view(ms);assert.deepEqual(v.home.parts,countdownParts(endTime-ms));}
});
