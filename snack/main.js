import {config} from './config.js';
import {RatingStore,SupabaseAdapter,LocalAdapter,spinTarget,sampleWinner,normalizeAngle} from './store.js';
import {drawFallback,fallbackPick} from './wheel-fallback.js';
import {celebrate} from './confetti.js';
import {animateSpin,HubEasterEgg} from './motion.js';
import {WheelSound} from './sound.js';
import {createGravityCollapse} from './gravity.js';
import {snackColor} from './colors.js';
import {createWarpTransit} from './warp.js';
const $=id=>document.getElementById(id);
const store=new RatingStore(config.mode==='supabase'?new SupabaseAdapter(config):new LocalAdapter());
const ui={tab:'wheel',personId:null,selectedId:null,selection:null,spinning:false,exploding:false,explosionProgress:0,explosionId:0,collapse:null,rotation:0,expanded:false,mineQuery:'',mineFilter:'all',rankingQuery:'',personQuery:'',wheelSignature:'',wheel3d:null};
try{ui.personId=localStorage.getItem('snack-person-v2')}catch{}
let soundMuted=false;try{soundMuted=localStorage.getItem('snack-sound-muted')==='1'}catch{}
const sounds=new WheelSound({muted:soundMuted});let wobbleAnimation=null;
const format=(v,d=1)=>Number(v).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const initials=name=>name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
function renderWheelGlow(){
  const count=store.snacks.length,stage=$('wheel-stage');
  const stops=store.snacks.map((snack,i)=>`${snackColor(snack)} ${i*360/count}deg ${(i+1)*360/count}deg`);
  stage.style.setProperty('--wheel-glow',count?`conic-gradient(from ${-180/count}deg, ${stops.join(', ')})`:'none');
  stage.style.setProperty('--wheel-glow-rotation',`${ui.rotation}rad`);
}
function iconStar(){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d','m12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z');s.append(p);return s}
const avatar=p=>node('span','avatar',initials(p.name));
const announce=text=>{$('announcement').textContent=text};
function preserveFocus(fn){const a=document.activeElement,id=a?.id;fn();if(id){const b=$(id);if(b&&b!==a)b.focus({preventScroll:true});else if(!b&&id.startsWith('star-mine-'))$(`mine-filter-${ui.mineFilter}`)?.focus({preventScroll:true})}}
function showError(message){$('global-error').hidden=false;$('global-error').querySelector('span').textContent=message}
function selectRestaurant(id,source='direct'){
  if(ui.spinning||ui.exploding)return;const s=store.snacks.find(s=>s.id===String(id));if(!s)return;
  const origin=document.activeElement;ui.detailReturnFocus=origin?.id&&!origin.closest('#restaurant-detail')?origin.id:'spin';ui.selectedId=s.id;ui.selection=source;ui.expanded=false;if(ui.tab!=='wheel')switchTab('wheel',false);
  renderDetail();renderChips();ui.wheel3d?.select(s.id);drawFallback($('wheel-fallback'),store.snacks,ui.rotation,s.id);announce(`${s.name} ausgewählt. Bewertungen werden angezeigt.`);
  $('detail-title').focus({preventScroll:true});
}
function saveRating(pid,sid,v){if(ui.exploding)return;try{store.setRating(pid,sid,v)}catch(e){showError(e.message)}}
function ratingWidget(person,snack,context){
  const wrap=node('div','rating-wrapper'),control=node('div','rating-control'),group=node('div','star-group');group.setAttribute('role','radiogroup');group.setAttribute('aria-label',`${snack.name} bewerten als ${person.name}`);
  const value=store.get(person.id,snack.id),status=store.status(person.id,snack.id),buttons=[];
  const paint=val=>buttons.forEach((b,i)=>b.classList.toggle('is-lit',i<val));
  for(let v=1;v<=5;v++){
    const b=node('button','star-button');b.type='button';b.id=`star-${context}-${person.id}-${snack.id}-${v}`;b.append(iconStar());b.setAttribute('role','radio');b.setAttribute('aria-label',`${v} ${v===1?'Stern':'Sterne'}`);b.setAttribute('aria-checked',String(v===value));b.tabIndex=v===(value||1)?0:-1;b.disabled=store.loading||ui.exploding;b.title=`${v} ${v===1?'Stern':'Sterne'}`;
    b.addEventListener('pointerenter',()=>paint(v));b.addEventListener('click',()=>saveRating(person.id,snack.id,v));
    b.addEventListener('keydown',e=>{const delta=['ArrowRight','ArrowUp'].includes(e.key)?1:['ArrowLeft','ArrowDown'].includes(e.key)?-1:0;if(!delta&&!['Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?1:e.key==='End'?5:(v-1+delta+5)%5+1;saveRating(person.id,snack.id,next);$(`star-${context}-${person.id}-${snack.id}-${next}`)?.focus({preventScroll:true})});group.append(b);buttons.push(b);
  }
  paint(value);group.addEventListener('pointerleave',()=>paint(value));control.append(group,node('span','rating-note',value?`${value} / 5`:'Noch offen'));wrap.append(control);
  const message=status.state==='pending'?'Wird gespeichert …':status.state==='error'?'Nicht gespeichert':status.state==='saved'?(config.mode==='supabase'?'Gespeichert':'Lokal gespeichert'):'';
  const line=node('span','rating-status'+(status.state==='error'?' is-error':''),message);
  if(status.state==='error'){const retry=node('button','text-button inline-retry','Erneut versuchen');retry.type='button';retry.id=`retry-${context}-${person.id}-${snack.id}`;retry.addEventListener('click',()=>saveRating(person.id,snack.id,store.get(person.id,snack.id)));line.append(document.createTextNode(' · '),retry)}wrap.append(line);return wrap;
}
function renderDetail(){
  const snack=store.restaurantStats().find(s=>s.id===ui.selectedId);$('restaurant-detail').setAttribute('aria-busy',String(store.loading));$('restaurant-detail').hidden=!snack;
  if(!snack){$('detail-title').textContent=store.loading?'Einen Moment …':'Keine Restaurants';$('detail-score').textContent='–';$('detail-count').textContent='';$('detail-rank').hidden=true;$('detail-stars').replaceChildren();$('quick-rating').replaceChildren();$('community-list').replaceChildren();$('toggle-community').hidden=true;return}
  $('selection-label').textContent=ui.selection==='winner'?'Gewinner':'Bewertungen';$('detail-title').textContent=snack.name;$('detail-rank').textContent=snack.rank?`Rang ${snack.rank}`:'Noch unbewertet';$('detail-rank').hidden=false;
  $('detail-score').textContent=snack.count?format(snack.average):'–';$('detail-stars').textContent='★★★★★';$('detail-stars').style.setProperty('--rating',`${snack.average/5*100}%`);$('detail-count').textContent=snack.count?`aus ${snack.count} ${snack.count===1?'Bewertung':'Bewertungen'}`:'Noch keine Bewertungen';
  const quick=$('quick-rating');quick.replaceChildren();const me=store.people.find(p=>p.id===ui.personId),head=node('div','your-rating-head');head.append(node('span','','Deine Bewertung'));const choose=node('button','text-button',me?me.name:'Person wählen');choose.id='quick-choose-person';choose.addEventListener('click',openPersonDialog);head.append(choose);quick.append(head);
  if(me)quick.append(ratingWidget(me,snack,'quick'));else{const b=node('button','choose-rating-prompt');b.id='choose-rating-prompt';b.setAttribute('aria-label',`${snack.name} bewerten: zuerst deinen Namen wählen`);for(let i=0;i<5;i++)b.append(iconStar());b.addEventListener('click',openPersonDialog);quick.append(b)}
  const people=store.people.map(p=>({...p,stars:store.get(p.id,snack.id)})).sort((a,b)=>b.stars-a.stars||a.name.localeCompare(b.name,'de'));$('community-count').textContent=`${snack.count} / ${store.people.length}`;
  const list=$('community-list');list.replaceChildren();list.classList.toggle('expanded',ui.expanded);const visible=ui.expanded?people:people.slice(0,4);
  if(!visible.length)list.append(node('p','muted','Noch niemand in der Runde.'));
  visible.forEach(p=>{const row=node('div','community-row'+(!p.stars?' unrated':'')),score=node('span','community-score',p.stars?'★'.repeat(p.stars):'Noch offen');if(p.stars)score.append(node('span','',`${p.stars}/5`));score.setAttribute('aria-label',p.stars?`${p.stars} von 5 Sternen`:'Noch nicht bewertet');row.append(avatar(p),node('span','person-label',p.name+(p.id===ui.personId?' (du)':'')),score);list.append(row)});
  $('toggle-community').hidden=people.length<=4;$('toggle-community').textContent=ui.expanded?'Weniger anzeigen':`Alle ${people.length} Personen anzeigen`;$('toggle-community').setAttribute('aria-expanded',String(ui.expanded));
}
function renderChips(){const box=$('restaurant-chips');box.replaceChildren();const stats=store.restaurantStats();store.snacks.forEach((s,i)=>{const b=node('button','restaurant-chip');b.id=`restaurant-${s.id}`;b.type='button';b.style.setProperty('--chip-color',snackColor(s));b.setAttribute('aria-pressed',String(s.id===ui.selectedId));b.disabled=ui.spinning||ui.exploding;const stat=stats.find(t=>t.id===s.id);b.append(node('span','dot'),node('span','',s.name),node('span','chip-score',stat.count?format(stat.average):'–'));b.addEventListener('click',()=>selectRestaurant(s.id));box.append(b)})}
function renderMine(){
  const root=$('mine-content');root.replaceChildren();const me=store.people.find(p=>p.id===ui.personId);$('mine-change-person').textContent=me?'Person wechseln':'Person wählen';
  if(!me){const empty=node('div','empty-state');const b=node('button','primary-button','Person wählen');b.id='mine-choose-person';b.addEventListener('click',openPersonDialog);empty.append(b);root.append(empty);return}
  const stats=store.personStats(me.id),summary=node('div','my-summary'),copy=node('div');copy.append(node('h2','',me.name),node('p','',`${stats.count} von ${store.snacks.length} Restaurants bewertet`));summary.append(avatar(me),copy);const avg=node('div','my-average',stats.count?format(stats.average,2):'–');avg.append(node('small','',' / 5'));avg.setAttribute('aria-label',`Dein Durchschnitt: ${stats.count?format(stats.average,2):'noch keine Bewertung'}`);summary.append(avg);root.append(summary);
  const toolbar=node('div','list-toolbar'),label=node('label','search-field'),search=node('input');search.type='search';search.id='mine-search';search.placeholder='Restaurant suchen';search.setAttribute('aria-label','Restaurant in deinen Bewertungen suchen');search.value=ui.mineQuery;search.addEventListener('input',()=>{ui.mineQuery=search.value;renderMineRows()});label.append(search);toolbar.append(label);
  const filters=node('div','filter-buttons');filters.setAttribute('aria-label','Bewertungen filtern');[['all','Alle'],['unrated','Noch offen'],['rated','Bewertet']].forEach(([value,text])=>{const b=node('button','',text);b.id=`mine-filter-${value}`;b.setAttribute('aria-pressed',String(ui.mineFilter===value));b.addEventListener('click',()=>{ui.mineFilter=value;preserveFocus(renderMine)});filters.append(b)});toolbar.append(filters);const list=node('div','my-ratings-list');list.id='my-ratings-list';root.append(toolbar,list);renderMineRows();
}
function renderMineRows(){
  const box=$('my-ratings-list'),me=store.people.find(p=>p.id===ui.personId);if(!box||!me)return;box.replaceChildren();const snacks=store.snacks.filter(s=>s.name.toLocaleLowerCase('de').includes(ui.mineQuery.toLocaleLowerCase('de'))&&(ui.mineFilter==='all'||(ui.mineFilter==='rated'?store.get(me.id,s.id)>0:!store.get(me.id,s.id))));
  if(!snacks.length){box.append(node('p','list-empty',ui.mineFilter==='unrated'&&!ui.mineQuery?'Alles bewertet.':'Keine passenden Restaurants.'));return}
  snacks.forEach((s,i)=>{const row=node('div','my-rating-row'),mini=node('span','restaurant-mini',initials(s.name));mini.style.setProperty('--chip-color',snackColor(s));const name=node('button','restaurant-label',s.name);name.id=`mine-restaurant-${s.id}`;name.addEventListener('click',()=>selectRestaurant(s.id,'ranking'));row.append(mini,name,ratingWidget(me,s,'mine'));box.append(row)});
}
function renderRanking(){
  $('ranking-count').textContent=`${store.people.length} Personen · ${store.ratings.size} Bewertungen`;const box=$('ranking-list');box.replaceChildren();const stats=store.restaurantStats().filter(s=>s.name.toLocaleLowerCase('de').includes(ui.rankingQuery.toLocaleLowerCase('de')));
  if(!stats.length){box.append(node('p','list-empty','Keine passenden Restaurants.'));return}
  stats.forEach((s,i)=>{const row=node('button','ranking-row');row.id=`ranking-${s.id}`;row.setAttribute('aria-label',`${s.rank?'Rang '+s.rank+'. ':''}${s.name}, ${s.count?format(s.average,2)+' von 5':'unbewertet'}, ${s.count} Bewertungen. Details anzeigen.`);const mini=node('span','restaurant-mini',initials(s.name));mini.style.setProperty('--chip-color',snackColor(s));const score=node('span','ranking-score',s.count?format(s.average,2):'–');score.append(node('span','','/ 5'));row.append(node('span','ranking-position',s.rank?String(s.rank).padStart(2,'0'):'–'),mini,node('span','restaurant-label',s.name),node('span','ranking-votes',`${s.count} ${s.count===1?'Bewertung':'Bewertungen'}`),score);row.addEventListener('click',()=>selectRestaurant(s.id,'ranking'));box.append(row)});
}
function renderPersonOptions(){const box=$('person-options');box.replaceChildren();const people=store.people.filter(p=>p.name.toLocaleLowerCase('de').includes(ui.personQuery.toLocaleLowerCase('de')));if(!people.length){box.append(node('p','list-empty','Kein passender Name gefunden.'));return}people.forEach(p=>{const b=node('button','person-option');b.id=`person-${p.id}`;b.setAttribute('aria-pressed',String(p.id===ui.personId));const stats=store.personStats(p.id);b.append(avatar(p),node('span','',p.name),node('span','person-meta',p.id===ui.personId?'Ausgewählt':`${stats.count} Bewertungen`));b.addEventListener('click',()=>{ui.personId=p.id;try{localStorage.setItem('snack-person-v2',p.id)}catch{}$('person-dialog').close();renderAll();announce(`Du bewertest als ${p.name}.`);if(ui.tab==='mine')$('mine-search')?.focus();else $('quick-choose-person')?.focus({preventScroll:true})});box.append(b)})}
function openPersonDialog(){if(ui.exploding||!store.loaded||!store.people.length)return;ui.personQuery='';$('person-search').value='';renderPersonOptions();$('person-dialog').showModal();$('person-search').focus()}
function switchTab(name,focusTab=true){if(ui.exploding||!['wheel','mine','ranking'].includes(name))return;ui.tab=name;for(const key of ['wheel','mine','ranking']){const selected=key===name;$(`view-${key}`).hidden=!selected;$(`tab-${key}`).setAttribute('aria-selected',String(selected));$(`tab-${key}`).tabIndex=selected?0:-1}if(name==='mine')renderMine();if(name==='ranking')renderRanking();if(focusTab)$(`tab-${name}`).focus();if(name==='wheel')ui.wheel3d?.resize()}
function renderStatus(){
  document.body.classList.toggle('loading',store.loading);$('refresh').disabled=store.loading||ui.spinning||ui.exploding;$('spin').disabled=store.loading||ui.spinning||ui.exploding||!store.snacks.length;$('wheel-hub').disabled=$('spin').disabled;$('spin').querySelector('span').textContent=ui.spinning?'Dreht …':'Drehen';$('choose-person').disabled=!store.people.length||ui.exploding;$('mine-change-person').disabled=!store.people.length||ui.exploding;document.querySelectorAll('[data-tab]').forEach(b=>b.disabled=ui.exploding);
  $('data-mode').textContent=config.mode==='supabase'?'Gemeinsame Restaurantliste':'Lokale Vorschau';$('restaurant-count').textContent=`${store.snacks.length} Restaurants`;$('people-count').textContent=`${store.people.length} Personen`;
  const failed=store.failures.length,saved=[...store.statuses.values()].some(s=>s.state==='saved');$('save-status').textContent=store.loading?'Daten werden geladen …':failed?`${failed} ${failed===1?'Bewertung nicht':'Bewertungen nicht'} gespeichert`:store.pending?'Wird gespeichert …':store.error?'Laden fehlgeschlagen':saved?(config.mode==='supabase'?'Alle Änderungen gespeichert':'Lokal gespeichert'):(store.loaded?'Aktuell':'');$('save-status').classList.toggle('is-error',!!failed||!!store.error);$('retry-save').hidden=!failed;if(store.error)showError(store.error);else $('global-error').hidden=true;
}
function renderAll(){
  if(ui.personId&&!store.people.some(p=>p.id===ui.personId)&&store.loaded){ui.personId=null;try{localStorage.removeItem('snack-person-v2')}catch{}}
  if(!store.snacks.some(s=>s.id===ui.selectedId)){ui.selectedId=null;ui.selection=null}
  const me=store.people.find(p=>p.id===ui.personId);$('my-name').textContent=me?me.name:'Dein Name';$('my-avatar').textContent=me?initials(me.name):'?';
  preserveFocus(()=>{renderDetail();renderChips();renderMine();renderRanking();renderStatus();if($('person-dialog').open)renderPersonOptions()});
  const signature=JSON.stringify(store.snacks);if(signature!==ui.wheelSignature){ui.wheelSignature=signature;renderWheelGlow();drawFallback($('wheel-fallback'),store.snacks,ui.rotation,ui.selectedId);ui.wheel3d?.setSnacks(store.snacks);ui.wheel3d?.select(ui.selectedId)}
}
async function load(){if(ui.exploding)return;try{await store.load()}catch{}}
async function spin(){
  if(ui.spinning||ui.exploding||store.loading||!store.snacks.length)return;
  const audioReady=sounds.unlock();wobbleAnimation?.cancel();ui.spinning=true;ui.expanded=false;ui.selectedId=null;ui.selection=null;renderDetail();ui.wheel3d?.select(null);renderStatus();renderChips();ui.wheel3d?.setInteractive(false);
  const index=sampleWinner(store.snacks.length),snack=store.snacks[index],start=ui.rotation,target=spinTarget(start,index,store.snacks.length,4+Math.floor(Math.random()*3)),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,duration=reduced?0:3900+Math.random()*600;
  let resumeTimer;await Promise.race([audioReady,new Promise(resolve=>resumeTimer=setTimeout(resolve,150))]);clearTimeout(resumeTimer);
  const startedAt=performance.now();sounds.startSpin({start,target,count:store.snacks.length,duration,startedAt});
  await animateSpin({start,target,duration,now:()=>startedAt,onFrame(angle){
    ui.rotation=angle;$('wheel-stage').style.setProperty('--wheel-glow-rotation',`${angle}rad`);if(ui.wheel3d)ui.wheel3d.rotate(angle);else drawFallback($('wheel-fallback'),store.snacks,angle,null);
    sounds.updateSpin();
  },onStop(){sounds.finishSpin()}});
  ui.rotation=normalizeAngle(target);$('wheel-stage').style.setProperty('--wheel-glow-rotation',`${ui.rotation}rad`);ui.wheel3d?.rotate(ui.rotation);ui.spinning=false;ui.wheel3d?.setInteractive(true);selectRestaurant(snack.id,'winner');renderStatus();celebrate($('confetti'),{reduced,color:snackColor(snack)});announce(`Gewonnen: ${snack.name}. ${$('detail-count').textContent}.`);
}
function wobbleWheel(taps){
  wobbleAnimation?.cancel();const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,amount=1+taps*.45;
  const frames=reduced?[{opacity:.8},{opacity:1}]:[{transform:'rotate(0deg)'},{transform:`rotate(${-amount}deg)`,offset:.18},{transform:`rotate(${amount*.75}deg)`,offset:.42},{transform:`rotate(${-amount*.35}deg)`,offset:.7},{transform:'rotate(0deg)'}];
  wobbleAnimation=$('wheel-stage').animate?.(frames,{duration:reduced?160:460,easing:'ease-out'});
}
async function explodeWheel(){
  const explosionId=++ui.explosionId,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  wobbleAnimation?.cancel();ui.collapse?.restore();let snapshot=$('wheel-fallback');
  if(!reduced)try{snapshot=ui.wheel3d?.snapshot()||snapshot}catch{}
  ui.collapse=createGravityCollapse({root:document.querySelector('.app-shell'),wheelCanvas:snapshot,wheelRect:$('wheel-stage').getBoundingClientRect(),snacks:store.snacks,rotation:ui.rotation,reduced});
  ui.exploding=true;document.body.classList.add('egg-active');renderAll();ui.wheel3d?.setInteractive(false);sounds.cancelSpin();sounds.play('explosion');
  const collapse=ui.collapse;
  await animateSpin({start:0,target:1,duration:collapse.duration,isCurrent:()=>ui.exploding&&ui.explosionId===explosionId,onFrame(_,progress){collapse.frame(progress*collapse.duration)},onStop(){}});
}

const egg=new HubEasterEgg({canTap:()=>!ui.spinning&&!ui.exploding&&!store.loading&&store.snacks.length>0,wobble:wobbleWheel,explode:explodeWheel,
  async beforeLeave(){await store.drain();if(store.failures.length)return false;return true},
  async transit(){
    const warp=createWarpTransit({reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,backdrop:ui.collapse?.element});ui.warp=warp;
    await warp.play({onStart:()=>sounds.play('warp')});
    // Keep the final dark frame until navigation; restore owns cancellation and cleanup.
  },
  restore(){wobbleAnimation?.cancel();ui.warp?.restore();ui.warp=null;sounds.stopVoices('warp');ui.collapse?.restore();ui.collapse=null;ui.exploding=false;ui.explosionProgress=0;document.body.classList.remove('egg-active');ui.wheel3d?.explode(0);ui.wheel3d?.setInteractive(true);ui.wheel3d?.select(ui.selectedId);drawFallback($('wheel-fallback'),store.snacks,ui.rotation,ui.selectedId);renderAll();if(store.failures.length)showError('Bitte die ungespeicherten Bewertungen zuerst erneut speichern.');$('wheel-hub').focus({preventScroll:true})}
});
$('wheel-hub').addEventListener('click',event=>{event.stopPropagation();sounds.unlock();egg.tap()});
function renderSound(){const button=$('sound-toggle');button.setAttribute('aria-pressed',String(!sounds.muted));button.setAttribute('aria-label',sounds.muted?'Ton einschalten':'Ton ausschalten');button.title=button.getAttribute('aria-label')}
$('sound-toggle').addEventListener('click',()=>{sounds.setMuted(!sounds.muted);try{localStorage.setItem('snack-sound-muted',sounds.muted?'1':'0')}catch{}renderSound()});renderSound();
document.addEventListener('visibilitychange',()=>{sounds.setVisible(!document.hidden);if(document.hidden&&egg.busy)egg.reset()});
window.addEventListener('pagehide',()=>{sounds.setVisible(false);if(egg.busy)egg.reset()});
window.addEventListener('pageshow',event=>{sounds.setVisible(!document.hidden);if(event.persisted&&egg.busy)egg.reset()});

function closeDetail(){if(ui.exploding)return;ui.selectedId=null;ui.selection=null;renderDetail();renderChips();ui.wheel3d?.select(null);drawFallback($('wheel-fallback'),store.snacks,ui.rotation,null);const origin=$(ui.detailReturnFocus);(origin&&!origin.closest('[hidden]')&&!origin.closest('#restaurant-detail')?origin:$('spin')).focus({preventScroll:true})}
$('close-detail').addEventListener('click',closeDetail);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.tab==='wheel'&&!$('person-dialog').open&&!$('restaurant-detail').hidden){e.preventDefault();closeDetail()}});
store.subscribe(renderAll);
$('refresh').addEventListener('click',load);$('retry-load').addEventListener('click',load);$('retry-save').addEventListener('click',()=>store.retryFailed());$('spin').addEventListener('click',spin);
$('choose-person').addEventListener('click',openPersonDialog);$('mine-change-person').addEventListener('click',openPersonDialog);$('close-person-dialog').addEventListener('click',()=>$('person-dialog').close());
$('person-dialog').addEventListener('click',e=>{if(e.target===$('person-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$('person-search').addEventListener('input',e=>{ui.personQuery=e.target.value;renderPersonOptions()});$('ranking-search').addEventListener('input',e=>{ui.rankingQuery=e.target.value;renderRanking()});$('toggle-community').addEventListener('click',()=>{ui.expanded=!ui.expanded;renderDetail()});
document.querySelectorAll('[data-tab]').forEach(button=>{button.addEventListener('click',()=>switchTab(button.dataset.tab));button.addEventListener('keydown',e=>{const tabs=['wheel','mine','ranking'],i=tabs.indexOf(ui.tab);let next;if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();switchTab(tabs[next])}})});
$('wheel-fallback').addEventListener('click',e=>{const id=fallbackPick($('wheel-fallback'),e,store.snacks,ui.rotation);if(id)selectRestaurant(id)});
window.addEventListener('beforeunload',e=>{if(store.pending||store.failures.length){e.preventDefault();e.returnValue=''}});window.addEventListener('online',()=>{if(store.failures.length)store.retryFailed()});
$('wheel-3d').addEventListener('wheel-context-lost',()=>{ui.wheel3d=null;drawFallback($('wheel-fallback'),store.snacks,ui.rotation,ui.selectedId,ui.explosionProgress)});
await load();
try{const {createWheel}=await import('./wheel3d.js');ui.wheel3d=await createWheel($('wheel-3d'),store.snacks,id=>selectRestaurant(id));ui.wheel3d.rotate(ui.rotation);ui.wheel3d.select(ui.selectedId);ui.wheel3d.setInteractive(!ui.spinning&&!ui.exploding);if(ui.exploding)ui.wheel3d.explode(ui.explosionProgress);$('wheel-fallback').hidden=true}catch(error){$('wheel-3d').hidden=true;drawFallback($('wheel-fallback'),store.snacks,ui.rotation,ui.selectedId,ui.explosionProgress);console.info('2D-Rad aktiv:',error.message)}
