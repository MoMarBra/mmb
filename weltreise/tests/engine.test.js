import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../engine.js';
const epsilon=1e-7;
const samePosition=(a,b)=>assert.ok(e.distanceKm(a,b)<epsilon,`positions differ: ${a} and ${b}`);

test('all 44 port calls match chronological UTC, local schedule and route endpoints',()=>{
 assert.equal(e.ports.length,44);assert.equal(e.legs.length,43);
 for(const p of e.ports){
  if(p.arrival!==null)assert.equal(e.localTimeToEpoch(p.arrivalDate,p.arrivalTime,p.timezone),p.arrival,p.id+' arrival timezone');
  if(p.departure!==null)assert.equal(e.localTimeToEpoch(p.departureDate,p.departureTime,p.timezone),p.departure,p.id+' departure timezone');
  if(p.arrival!==null&&p.departure!==null)assert.ok(p.arrival<p.departure);
 }
 for(const l of e.legs){assert.ok(l.start<l.end);assert.equal(l.start,l.from.departure);assert.equal(l.end,l.to.arrival);samePosition(l.path[0],l.from.coord);samePosition(l.path.at(-1),l.to.coord);assert.ok(l.distanceKm>0);assert.ok(l.speedKnots>0&&l.speedKnots<24);}
});

test('every port arrival and departure: exact instant and ±1 millisecond',()=>{
 for(const p of e.ports){
  if(p.arrival!==null){
   const before=e.deriveState(p.arrival-1),exact=e.deriveState(p.arrival),after=e.deriveState(p.arrival+1);
   assert.equal(before.phase,'sea',p.id+' before arrival');
   assert.equal(exact.phase,p.index===43?'complete':'port',p.id+' at arrival');
   assert.equal(after.phase,exact.phase,p.id+' after arrival');
   assert.equal(exact.port.id,p.id);samePosition(exact.position,p.coord);
   assert.ok(e.distanceKm(before.position,p.coord)<1e-4,p.id+' continuity arrival');
  }
  if(p.departure!==null){
   const before=e.deriveState(p.departure-1),exact=e.deriveState(p.departure),after=e.deriveState(p.departure+1);
   assert.equal(before.phase,p.index===0?'precruise':'port',p.id+' before departure');
   assert.equal(exact.phase,'sea',p.id+' at departure');assert.equal(after.phase,'sea');
   assert.equal(exact.leg.from.id,p.id);samePosition(exact.position,p.coord);assert.equal(exact.legProgress,0);
   assert.ok(e.distanceKm(after.position,p.coord)<1e-4,p.id+' continuity departure');
  }
 }
});

test('today, departure and final arrival states clamp safely',()=>{
 assert.equal(e.deriveState(Date.parse('2026-10-05T15:00:00Z')).phase,'precruise');
 assert.equal(new Date(e.startTime).toISOString(),'2026-10-18T17:30:00.000Z');
 assert.equal(new Date(e.endTime).toISOString(),'2027-02-21T07:00:00.000Z');
 assert.equal(e.deriveState(e.endTime).progress,1);assert.equal(e.deriveState(e.endTime).remainingMs,0);
 assert.equal(e.deriveState(e.endTime+365*e.DAY_MS).phase,'complete');
 assert.equal(e.deriveState(e.startTime-e.DAY_MS).progress,0);
 assert.throws(()=>e.deriveState(NaN),RangeError);
});

test('DST, half-hour offsets, overnight stays and Cape Town 24:00',()=>{
 const p=id=>e.ports.find(p=>p.id===id);
 assert.equal(e.localTimeToEpoch('2026-10-18','19:30','Europe/Berlin'),Date.parse('2026-10-18T17:30Z'));
 assert.equal(e.localTimeToEpoch('2027-02-21','08:00','Europe/Berlin'),Date.parse('2027-02-21T07:00Z'));
 assert.equal(p('adelaide').arrival,Date.parse('2027-01-05T20:30Z'));
 assert.equal(p('suva').arrival,Date.parse('2026-12-22T20:00Z'));
 assert.equal(p('cape-town').departure,Date.parse('2027-01-31T22:00Z'));
 assert.equal(e.localTimeToEpoch('2027-01-31','24:00','Africa/Johannesburg'),e.localTimeToEpoch('2027-02-01','00:00','Africa/Johannesburg'));
 for(const id of ['rio-de-janeiro','san-antonio','tahiti','sydney','port-louis','gqeberha'])assert.equal(e.deriveState((p(id).arrival+p(id).departure)/2).phase,'port');
 assert.throws(()=>e.localTimeToEpoch('2026-10-25','02:30','Europe/Berlin'),/ambiguous/);
 assert.throws(()=>e.localTimeToEpoch('2026-03-29','02:30','Europe/Berlin'),/does not exist/);
 assert.throws(()=>e.localTimeToEpoch('2027-02-30','08:00','Europe/Berlin'),RangeError);
 assert.throws(()=>e.localTimeToEpoch('2027-01-31','24:01','Africa/Johannesburg'),RangeError);
});

test('westward civil dateline and geometric antimeridian are distinct and continuous',()=>{
 const civil=e.legs[19],map=e.legs[20];
 assert.equal((civil.end-civil.start)/e.HOUR_MS,61); // 17 Dec 20:00 UTC−10 → 21 Dec 08:00 UTC+13
 assert.equal(civil.from.timezone,'Pacific/Rarotonga');assert.equal(civil.to.timezone,'Pacific/Tongatapu');
 const midpoint=e.geodesicInterpolate([-179,-20],[179,-20],0.5);
 assert.ok(Math.abs(midpoint[0])>179.99);assert.ok(e.distanceKm([-179,-20],[179,-20])<220);
 const points=e.sampleLeg(map,10),unwrapped=e.unwrapCoordinates(points),lines=e.splitAtDateline(points);
 assert.equal(lines.length,2);assert.ok(unwrapped.at(-1)[0]<unwrapped[0][0]);
 for(const line of lines)for(let i=1;i<line.length;i++)assert.ok(Math.abs(line[i][0]-line[i-1][0])<=180);
 for(let t=0;t<=1;t+=.01){const s=e.deriveState(map.start+(map.end-map.start)*t);assert.ok(Math.abs(s.position[0])>170);}
});

test('distance-weighted interpolation gives constant speed for all sea legs',()=>{
 for(const leg of e.legs){
  for(const f of [0,.01,.25,.5,.75,.99,1]){
   const state=e.positionOnLeg(leg,f);assert.ok(Math.abs(state.distanceKm-leg.distanceKm*f)<epsilon);
   assert.ok(Number.isFinite(state.position[0])&&Number.isFinite(state.position[1]));
   if(f<1){const instant=e.deriveState(leg.start+(leg.end-leg.start)*f);assert.equal(instant.leg.index,leg.index);samePosition(instant.position,state.position);}
  }
  samePosition(e.positionOnLeg(leg,0).position,leg.from.coord);samePosition(e.positionOnLeg(leg,1).position,leg.to.coord);
 }
});

test('no time gaps and monotone journey/distance progress across 15-minute samples',()=>{
 let prevTime=0,prevDistance=0;
 for(let t=e.startTime;t<=e.endTime;t+=15*60000){const s=e.deriveState(t);assert.ok(s.progress>=prevTime);assert.ok(s.distanceProgress>=prevDistance-1e-12);assert.ok(s.visitedCount>=1&&s.visitedCount<=44);prevTime=s.progress;prevDistance=s.distanceProgress;}
});

test('rendered routes and partial route endpoints share the same geodesic model',()=>{
 assert.equal(e.routeForTime(e.startTime-1,true).length,0);assert.equal(e.routeForTime(e.endTime,false).length,0);
 assert.equal(e.routeGeoJSON.features.length,43);
 for(const leg of e.legs){
  const now=leg.start+(leg.end-leg.start)*.417,state=e.deriveState(now);
  samePosition(e.routeForTime(now,true).at(-1).at(-1),state.position);
  samePosition(e.routeForTime(now,false)[0][0],state.position);
  for(const line of e.splitAtDateline(e.sampleLeg(leg,40)))for(let i=1;i<line.length;i++)assert.ok(Math.abs(line[i][0]-line[i-1][0])<180);
 }
});

test('mandatory ocean detours exist instead of continent-crossing chords',()=>{
 assert.ok(e.legs[12].path.some(p=>p[1]<-56)); // Cape Horn
 assert.ok(e.legs[30].path.some(p=>p[0]>120&&p[0]<135&&p[1]<-35)); // Southern Australia
 assert.ok(e.legs[33].path.some(p=>p[0]>43&&p[0]<48&&p[1]<-26)); // Madagascar
 assert.ok(e.legs[36].path.some(p=>p[0]>18&&p[0]<21&&p[1]<-34.8)); // Agulhas
 assert.ok(e.legs[21].path.some(p=>p[0]<177.1&&p[1]<-18)); // Fiji round island
 assert.ok(e.legs[24].path.some(p=>p[0]>167&&p[1]<-22.5)); // New Caledonia around southern end
 assert.ok(e.legs[3].path.some(p=>p[0]<-54)); // Amazon all the way to Santarem
 assert.ok(e.legs[0].path.length>30); // Elbe and Channel
});
