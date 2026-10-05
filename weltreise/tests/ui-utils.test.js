import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWallTime,inputValue,countdownParts,pathData,splitAtDateline} from '../ui-utils.js';
import {startTime,endTime,ports,deriveState} from '../engine.js';
test('Countdown starts from actual Hamburg departure and clamps after return',()=>{
 assert.deepEqual(countdownParts(90061000),{days:1,hours:1,minutes:1,seconds:1});
 assert.deepEqual(countdownParts(-1),{days:0,hours:0,minutes:0,seconds:0});
 assert.equal(startTime,Date.parse('2026-10-18T17:30:00Z'));
 assert.equal(endTime,Date.parse('2027-02-21T07:00:00Z'));
 assert.equal(deriveState(Date.parse('2026-10-05T15:30Z')).phase,'precruise');
});
test('Settings parse uses explicit IANA zone rather than host system zone',()=>{
 assert.equal(parseWallTime('2026-10-18T19:30','Europe/Berlin'),startTime);
 assert.equal(parseWallTime('2027-02-21T08:00','Europe/Berlin'),endTime);
 assert.equal(parseWallTime('2026-12-21T08:00','Pacific/Tongatapu'),Date.parse('2026-12-20T19:00Z'));
 assert.equal(parseWallTime('2026-12-31T08:30','Australia/Sydney'),Date.parse('2026-12-30T21:30Z'));
 assert.equal(inputValue(startTime,'UTC'),'2026-10-18T17:30');
});
test('Settings rejects invalid and ambiguous clock readings',()=>{
 assert.throws(()=>parseWallTime('2026-10-25T02:30','Europe/Berlin'),/zweimal/);
 assert.throws(()=>parseWallTime('2027-03-28T02:30','Europe/Berlin'),/existiert nicht/);
 assert.throws(()=>parseWallTime('2027-02-30T08:00','UTC'),/existiert nicht/);
 assert.throws(()=>parseWallTime('','UTC'),/vollständiges/);
});
test('Dateline crossings produce short edge segments rather than world-spanning lines',()=>{
 for(const pts of [[[179,-20],[-179,-21]],[[-179,-20],[179,-21]]]){
  const lines=splitAtDateline(pts);assert.equal(lines.length,2);
  for(const line of lines)for(let i=1;i<line.length;i++)assert.ok(Math.abs(line[i][0]-line[i-1][0])<=180);
  assert.equal((pathData(pts).match(/M/g)||[]).length,2);
 }
});
test('All source port calls retain explicit IANA zones and stable date data',()=>{
 assert.equal(ports.length,44);
 for(const p of ports){assert.ok(p.timezone);for(const k of ['arrival','departure'])if(p[k]!==null){assert.equal(parseWallTime(inputValue(p[k],p.timezone),p.timezone),p[k],p.name+' '+k);}}
});
