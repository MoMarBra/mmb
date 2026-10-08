import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {isBirthdayMoment,createBirthdayParty} from '../birthday.js';
import {installBirthdayDom} from './birthday-dom.js';

const start=Date.parse('2026-11-21T23:00:00.000Z');
const end=Date.parse('2026-11-23T23:00:00.000Z');
const moments=[
 ['2025-11-22T12:00:00Z',false],
 ['2026-11-21T12:00:00Z',false],
 ['2026-11-21T22:59:59.999Z',false],
 ['2026-11-21T23:00:00.000Z',true],
 ['2026-11-21T23:00:00.001Z',true],
 ['2026-11-22T12:00:00Z',true],
 ['2026-11-22T22:59:59.999Z',true],
 ['2026-11-22T23:00:00.000Z',true],
 ['2026-11-23T12:00:00Z',true],
 ['2026-11-23T22:59:59.999Z',true],
 ['2026-11-23T23:00:00.000Z',false],
 ['2026-11-23T23:00:00.001Z',false],
 ['2026-11-24T12:00:00Z',false],
 ['2027-11-22T12:00:00Z',false],
];

test('birthday lasts exactly November 22 and 23, 2026 in Germany, including millisecond boundaries',()=>{
 for(const [iso,expected] of moments)assert.equal(isBirthdayMoment(Date.parse(iso)),expected,iso);
 assert.equal(end-start,48*60*60*1000);
});

test('birthday dates are independent of the viewer device timezone, including either side of the date line',()=>{
 const moduleUrl=new URL('../birthday.js',import.meta.url).href;
 const script=`import {isBirthdayMoment} from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify(${JSON.stringify(moments.map(([iso])=>iso))}.map(iso=>isBirthdayMoment(Date.parse(iso)))));`;
 for(const timezone of ['UTC','Europe/Berlin','America/Los_Angeles','America/Sao_Paulo','Asia/Kathmandu','Australia/Adelaide','Pacific/Kiritimati','Pacific/Pago_Pago']){
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',env:{...process.env,TZ:timezone}});
  assert.equal(result.status,0,`${timezone}: ${result.stderr}`);
  assert.deepEqual(JSON.parse(result.stdout),moments.map(([,expected])=>expected),timezone);
 }
});

test('invalid or non-finite selected instants do not activate a party',()=>{
 for(const ms of [NaN,Infinity,-Infinity,undefined,null,'2026-11-22'])assert.equal(isBirthdayMoment(ms),false);
});

function assertInactive(document,elements){
 assert.equal(document.body.classList.contains('birthday-party'),false);
 assert.equal(elements['birthday-card'].hidden,true);
 assert.equal(elements['birthday-ship-pennants'].hidden,true);
 assert.equal(elements['birthday-balloons'].children.length,0);
 assert.equal(document.body.querySelectorAll('.birthday-atmosphere').length,0);
}
function assertActive(document,elements){
 assert.equal(document.body.classList.contains('birthday-party'),true);
 assert.equal(elements['birthday-card'].hidden,false);
 assert.equal(elements['birthday-ship-pennants'].hidden,false);
 assert.equal(elements['birthday-balloons'].children.length,18);
 assert.equal(document.body.querySelectorAll('.birthday-float').length,24);
 assert.equal(document.body.querySelectorAll('.party-light').length,3);
 assert.equal(document.body.querySelectorAll('.birthday-spark').length,30);
 const layers=document.body.querySelectorAll('.birthday-atmosphere');assert.equal(layers.length,1);
 assert.equal(layers[0].getAttribute('aria-hidden'),'true');
}

test('party enters once, stays stable across both dates, and removes generated decoration on exit',()=>{
 const {document,elements}=installBirthdayDom(),party=createBirthdayParty(document);
 const initialNodes=document.body.querySelectorAll('*').length;
 party.update(start-1);assertInactive(document,elements);
 party.update(start);assertActive(document,elements);
 const layer=document.body.querySelectorAll('.birthday-atmosphere')[0],balloons=elements['birthday-balloons'].children.slice();
 const activeNodes=document.body.querySelectorAll('*').length;
 for(const ms of [start,start+1000,start+86400000,end-1]){
  for(let i=0;i<20;i++)party.update(ms);
  assertActive(document,elements);assert.equal(document.body.querySelectorAll('*').length,activeNodes);
  assert.equal(document.body.querySelectorAll('.birthday-atmosphere')[0],layer);
  assert.deepEqual(elements['birthday-balloons'].children,balloons);
 }
 party.update(end);assertInactive(document,elements);
 assert.equal(document.body.querySelectorAll('*').length,initialNodes);assert.equal(layer.parentNode,null);
 assert.ok(balloons.every(node=>node.parentNode===null));
});

test('repeated preview entry, reverse scrubbing, cancellation and destruction leave no duplicate nodes',()=>{
 const {document,elements}=installBirthdayDom(),party=createBirthdayParty(document);
 const initialNodes=document.body.querySelectorAll('*').length;
 for(let i=0;i<12;i++){
  party.update(i%2?end-1:start);assertActive(document,elements);
  party.update(i%2?start-1:end);assertInactive(document,elements);
  assert.equal(document.body.querySelectorAll('*').length,initialNodes);
 }
 party.update(start);party.update(NaN);assertInactive(document,elements);
 party.update(start);party.destroy();assertInactive(document,elements);
 party.destroy();assertInactive(document,elements);
 assert.equal(document.body.querySelectorAll('*').length,initialNodes);
});

test('a missing optional ship decoration does not block the birthday card or cleanup',()=>{
 const {document,elements}=installBirthdayDom();elements['birthday-ship-pennants'].remove();delete elements['birthday-ship-pennants'];
 const party=createBirthdayParty(document);party.update(start);
 assert.equal(elements['birthday-card'].hidden,false);assert.equal(document.body.querySelectorAll('.birthday-atmosphere').length,1);
 party.destroy();assert.equal(elements['birthday-card'].hidden,true);assert.equal(document.body.querySelectorAll('.birthday-atmosphere').length,0);
});

test('birthday decoration is non-interactive and reduced motion keeps a static, visible celebration',()=>{
 const css=readFileSync(new URL('../birthday.css',import.meta.url),'utf8');
 const source=readFileSync(new URL('../birthday.js',import.meta.url),'utf8');
 assert.match(css,/#birthday-card\[hidden\],#birthday-ship-pennants\[hidden\]\s*\{\s*display:none;/);
 for(const selector of ['birthday-atmosphere','birthday-balloons','birthday-ship-pennants'])
  assert.match(css,new RegExp(`\\.${selector}\\s*\\{[^}]*pointer-events:none;`));
 assert.match(css,/\.birthday-atmosphere \*\s*\{\s*pointer-events:none;/);
 const reduced=css.slice(css.indexOf('@media(prefers-reduced-motion:reduce)'));
 assert.match(reduced,/\.birthday-card \*,\s*\.birthday-atmosphere \*\s*\{\s*animation:none!important;/);
 for(const selector of ['birthday-balloon','birthday-float'])
  assert.match(reduced,new RegExp(`\\.${selector}\\s*\\{[^}]*top:var\\(--rest\\);bottom:auto;transform:rotate\\(var\\(--tilt\\)\\)`));
 assert.doesNotMatch(source,/requestAnimationFrame|setInterval|setTimeout|addEventListener/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<section[^>]*id="birthday-card"[^>]*aria-labelledby="birthday-title"[^>]*hidden>/);
 assert.match(html,/<h2 id="birthday-title">Happy birthday<span>Sanni<\/span><\/h2>/);
 assert.match(html,/id="birthday-balloons" aria-hidden="true"/);
});
