import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {holidayAt,createHolidaySpecial} from '../holiday.js';
import {createBirthdayParty} from '../birthday.js';
import {installHolidayDom} from './holiday-dom.js';

const christmasStart=Date.parse('2026-12-23T23:00:00.000Z');
const christmasEnd=Date.parse('2026-12-25T23:00:00.000Z');
const newyearStart=Date.parse('2026-12-30T23:00:00.000Z');
const newyearEnd=Date.parse('2027-01-01T23:00:00.000Z');
const moments=[
 ['2025-12-24T12:00:00Z',null],['2025-12-31T12:00:00Z',null],['2026-01-01T12:00:00Z',null],
 ['2026-12-23T22:59:59.999Z',null],['2026-12-23T23:00:00.000Z','christmas'],
 ['2026-12-23T23:00:00.001Z','christmas'],['2026-12-24T12:00:00Z','christmas'],
 ['2026-12-24T22:59:59.999Z','christmas'],['2026-12-24T23:00:00.000Z','christmas'],
 ['2026-12-25T12:00:00Z','christmas'],['2026-12-25T22:59:59.999Z','christmas'],
 ['2026-12-25T23:00:00.000Z',null],['2026-12-25T23:00:00.001Z',null],
 ['2026-12-26T12:00:00Z',null],['2026-12-30T22:59:59.999Z',null],
 ['2026-12-30T23:00:00.000Z','newyear'],['2026-12-30T23:00:00.001Z','newyear'],
 ['2026-12-31T12:00:00Z','newyear'],['2026-12-31T22:59:59.999Z','newyear'],
 ['2026-12-31T23:00:00.000Z','newyear'],['2027-01-01T12:00:00Z','newyear'],
 ['2027-01-01T22:59:59.999Z','newyear'],['2027-01-01T23:00:00.000Z',null],
 ['2027-01-01T23:00:00.001Z',null],['2027-01-02T12:00:00Z',null],
 ['2027-12-24T12:00:00Z',null],['2027-12-31T12:00:00Z',null],['2028-01-01T12:00:00Z',null],
];

test('seasonal specials last exactly the requested two Germany dates, with no annual recurrence',()=>{
 for(const [iso,expected] of moments)assert.equal(holidayAt(Date.parse(iso))?.id??null,expected,iso);
 assert.equal(christmasEnd-christmasStart,48*60*60*1000);
 assert.equal(newyearEnd-newyearStart,48*60*60*1000);
});

test('Germany holiday dates do not depend on the viewer timezone, including either side of the date line',()=>{
 const moduleUrl=new URL('../holiday.js',import.meta.url).href;
 const script=`import {holidayAt} from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify(${JSON.stringify(moments.map(([iso])=>iso))}.map(iso=>holidayAt(Date.parse(iso))?.id??null)));`;
 for(const timezone of ['UTC','Europe/Berlin','America/Los_Angeles','America/Sao_Paulo','Asia/Kathmandu','Australia/Adelaide','Pacific/Kiritimati','Pacific/Pago_Pago']){
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',env:{...process.env,TZ:timezone}});
  assert.equal(result.status,0,`${timezone}: ${result.stderr}`);
  assert.deepEqual(JSON.parse(result.stdout),moments.map(([,expected])=>expected),timezone);
 }
});

test('invalid, unsupported and out-of-range selected instants never activate a holiday',()=>{
 for(const ms of [NaN,Infinity,-Infinity,undefined,null,'2026-12-24',new Date(NaN),{},8.64e15+1,-8.64e15-1]){
  assert.equal(holidayAt(ms),null,`${String(ms)}`);
 }
 for(const ms of [0,8.64e15,-8.64e15])assert.equal(holidayAt(ms),null);
});

function assertTheme(document,elements,id){
 for(const theme of ['christmas','newyear'])assert.equal(document.body.classList.contains(`holiday-${theme}`),id===theme,theme);
 assert.equal(elements['holiday-card'].hidden,id===null);
 assert.equal(elements['holiday-ship-decoration'].hidden,id===null);
 const layers=document.body.querySelectorAll('.holiday-atmosphere');assert.equal(layers.length,id===null?0:1);
 if(id!==null){
  assert.equal(layers[0].getAttribute('aria-hidden'),'true');
  for(const key of ['holiday-eyebrow','holiday-title','holiday-message','holiday-date'])assert.ok(elements[key].textContent.trim(),`${id}: ${key}`);
  assert.match(elements['holiday-date'].textContent,/2026|2027/);
  assert.ok(elements['holiday-art'].children.length>0);
 }else{
  assert.equal(elements['holiday-art'].children.length,0);
  assert.equal(elements['holiday-ship-decoration'].children.length,0);
  assert.equal(elements['holiday-art'].innerHTML,'');
  assert.equal(elements['holiday-ship-decoration'].textContent,'');
 }
}

test('each holiday enters once and preserves every generated node across both dates and repeated ticks',()=>{
 const {document,elements}=installHolidayDom(),special=createHolidaySpecial(document);
 const initialNodes=document.body.querySelectorAll('*').length;
 for(const [start,end,id] of [[christmasStart,christmasEnd,'christmas'],[newyearStart,newyearEnd,'newyear']]){
  special.update(start-1);assertTheme(document,elements,null);
  special.update(start);assertTheme(document,elements,id);
  const layer=document.body.querySelectorAll('.holiday-atmosphere')[0];
  const generated=[...layer.querySelectorAll('*'),...elements['holiday-art'].children,...elements['holiday-ship-decoration'].children];
  const allNodes=document.body.querySelectorAll('*');
  for(const ms of [start,start+1000,start+86400000,end-1])for(let i=0;i<20;i++){
   special.update(ms);assertTheme(document,elements,id);
   assert.equal(document.body.querySelectorAll('.holiday-atmosphere')[0],layer);
   assert.deepEqual(document.body.querySelectorAll('*'),allNodes);
  }
  special.update(end);assertTheme(document,elements,null);
  assert.equal(document.body.querySelectorAll('*').length,initialNodes);assert.equal(layer.parentNode,null);
  assert.ok(generated.every(node=>!document.body.querySelectorAll('*').includes(node)));
 }
});

test('Germany New Year midnight changes the greeting while keeping the same artwork and atmosphere',()=>{
 const {document,elements}=installHolidayDom(),special=createHolidaySpecial(document);
 const midnight=Date.parse('2026-12-31T23:00:00Z');special.update(midnight-1);
 const title=elements['holiday-title'].textContent,date=elements['holiday-date'].textContent;
 const nodes=document.body.querySelectorAll('*');special.update(midnight);
 assertTheme(document,elements,'newyear');assert.notEqual(elements['holiday-title'].textContent,title);
 assert.notEqual(elements['holiday-date'].textContent,date);assert.match(elements['holiday-title'].textContent,/2027/);
 assert.deepEqual(document.body.querySelectorAll('*'),nodes);
 special.update(midnight-1);assert.equal(elements['holiday-title'].textContent,title);assert.equal(elements['holiday-date'].textContent,date);
 assert.deepEqual(document.body.querySelectorAll('*'),nodes);
});

test('repeated birthday, Christmas, New Year and ordinary previews fully replace and remove decorations',()=>{
 const {document,elements}=installHolidayDom(),special=createHolidaySpecial(document),birthday=createBirthdayParty(document);
 const initialNodes=document.body.querySelectorAll('*').length;
 for(let i=0;i<8;i++){
  const sequence=i%2
   ? [[newyearStart,'newyear'],[christmasStart,'christmas'],[Date.parse('2026-11-22T12:00:00Z'),'birthday'],[newyearEnd,null]]
   : [[Date.parse('2026-11-22T12:00:00Z'),'birthday'],[christmasStart,'christmas'],[newyearStart,'newyear'],[newyearEnd,null]];
  for(const [ms,id] of sequence){
   birthday.update(ms);special.update(ms);assertTheme(document,elements,id==='birthday'?null:id);
   assert.equal(document.body.classList.contains('birthday-party'),id==='birthday');
   assert.equal(elements['birthday-card'].hidden,id!=='birthday');
   assert.equal(document.body.querySelectorAll('.birthday-atmosphere').length,id==='birthday'?1:0);
   if(id===null)assert.equal(document.body.querySelectorAll('*').length,initialNodes);
  }
 }
 special.update(christmasStart);special.update(NaN);assertTheme(document,elements,null);
 special.update(newyearStart);special.destroy();assertTheme(document,elements,null);
 special.destroy();birthday.destroy();assertTheme(document,elements,null);
 assert.equal(document.body.querySelectorAll('*').length,initialNodes);
});

test('an absent optional ship decoration does not block cards or atmosphere cleanup',()=>{
 const {document,elements}=installHolidayDom();elements['holiday-ship-decoration'].remove();delete elements['holiday-ship-decoration'];
 const special=createHolidaySpecial(document);
 for(const ms of [christmasStart,newyearStart]){
  special.update(ms);assert.equal(elements['holiday-card'].hidden,false);
  assert.equal(document.body.querySelectorAll('.holiday-atmosphere').length,1);
 }
 special.destroy();assert.equal(elements['holiday-card'].hidden,true);assert.equal(document.body.querySelectorAll('.holiday-atmosphere').length,0);
});

test('seasonal controllers use the existing render instant without introducing loops or timers',()=>{
 const source=readFileSync(new URL('../holiday.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:requestAnimationFrame|setInterval|setTimeout|addEventListener)\s*\(/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/holidaySpecial\.update\(now\)/);
 assert.equal([...app.matchAll(/\bsetInterval\s*\(/g)].length,1);
 assert.equal([...app.matchAll(/\brequestAnimationFrame\s*\(/g)].length,2);
});

test('holiday decorations stay bounded and non-interactive with visible static reduced-motion alternatives',()=>{
 const css=readFileSync(new URL('../holiday.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(css,/#holiday-card\[hidden\],\s*#holiday-ship-decoration\[hidden\]\s*\{\s*display\s*:\s*none;/);
 for(const selector of ['holiday-art','holiday-lights','holiday-ship-decoration','holiday-atmosphere']){
  assert.match(css,new RegExp(`\\.${selector}\\s*\\{[^}]*pointer-events\\s*:\\s*none;`));
 }
 assert.match(css,/\.holiday-atmosphere\s*\{[^}]*overflow\s*:\s*hidden;[^}]*contain\s*:\s*strict;/);
 assert.match(css,/\.holiday-atmosphere \*\s*\{\s*pointer-events\s*:\s*none;/);
 const reduced=css.slice(css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/));
 assert.match(reduced,/\.holiday-art \*,\s*\.holiday-atmosphere \*\s*\{\s*animation\s*:\s*none\s*!important;/);
 assert.match(reduced,/\.holiday-snow\s*\{[^}]*top\s*:\s*var\(--rest\)/);
 assert.match(reduced,/\.holiday-firework\s*\{[^}]*opacity\s*:\s*\.2;[^}]*transform\s*:\s*scale\(\.65\)/);
 assert.match(css,/\.holiday-firework\s*\{[^}]*animation\s*:\s*holiday-firework-bloom\s+10s/);
 assert.match(html,/<section[^>]*id="holiday-card"[^>]*aria-labelledby="holiday-title"[^>]*hidden>/);
 for(const id of ['holiday-art','holiday-ship-decoration'])assert.match(html,new RegExp(`id="${id}"[^>]*aria-hidden="true"`));
 assert.match(html,/class="holiday-clock-note">[^<]*Deutschland-Zeit/);
 assert.doesNotMatch(html,/<audio\b/i);
 const {document}=installHolidayDom(),special=createHolidaySpecial(document);
 special.update(christmasStart);const snow=document.body.querySelectorAll('.holiday-snow');assert.ok(snow.length>0&&snow.length<=24);
 for(const flake of snow)assert.ok(Number(flake.style.cssText.match(/--fall:([\d.]+)s/)[1])>=18);
 special.update(newyearStart);const fireworks=document.body.querySelectorAll('.holiday-firework');assert.ok(fireworks.length>0&&fireworks.length<=3);
 for(const firework of fireworks)assert.ok(firework.querySelectorAll('.holiday-firework-ray').length<=12);
});
