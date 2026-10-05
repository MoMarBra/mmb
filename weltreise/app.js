import {ports,legs,startTime,endTime,deriveState,positionAt,sampleLeg,routeForTime,interiorWaterways} from './engine.js';
import {clamp,fmt,inputValue,parseWallTime,project,pathData,countdownParts} from './ui-utils.js';
const $=id=>document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
const el=(tag,attrs={})=>{const node=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let preview=null,playing=false,playSpeed=86400,lastFrame=performance.now(),now=Date.now(),selectedMonth=null,lastPortKey='',lastMapKey='',lastSecond=-1,landReady=false;
let currentState=deriveState(now);
let scale=1,center=[500,250],drag=null;
const dialog=$('settings-dialog');
const months=[['2026-10','Okt'],['2026-11','Nov'],['2026-12','Dez'],['2027-01','Jan'],['2027-02','Feb']];
const dateOptions={day:'numeric',month:'long'};
const shortDate={day:'2-digit',month:'2-digit'};
const timeOptions={hour:'2-digit',minute:'2-digit',hourCycle:'h23'};
function timeText(time,zone){return fmt(time,zone,timeOptions);}
function portDate(port){return port.arrival??port.departure;}
function dateTime(time,zone){return `${fmt(time,zone,dateOptions)} · ${timeText(time,zone)} Uhr`;}
function journeyDay(ms){return clamp(Math.floor((ms-startTime)/86400000)+1,1,126);}
function statePort(s){return s.port??s.nextPort??ports[0];}
function normalizeState(s){
 const phase=s.phase;const active=s.port??s.currentPort??null;
 const leg=s.leg??null;
 const next=s.nextPort??(leg?.to?.index!==undefined?leg.to:typeof leg?.to==='number'?ports[leg.to]:null);
 return {...s,port:active,nextPort:next,position:s.position??positionAt(now),progress:s.progress??clamp((now-startTime)/(endTime-startTime))};
}
function setPreview(ms){if(!Number.isFinite(ms))return;preview=ms;now=ms;lastSecond=-1;render(true);}
function render(force=false){
 now=preview??Date.now();const second=Math.floor(now/1000);if(!force&&second===lastSecond)return;lastSecond=second;
 currentState=normalizeState(deriveState(now));const s=currentState;const pre=now<startTime;const done=now>=endTime;
 const part=countdownParts((pre?startTime:done?endTime:endTime)-now);
 for(const key of ['days','hours','minutes','seconds'])$('cd-'+key).textContent=key==='days'?String(part[key]):String(part[key]).padStart(2,'0');
 $('countdown-label').textContent=pre?'Die Reise beginnt in':done?'Einmal um die Welt. Wieder zu Hause.':'Bis zur Rückkehr nach Hamburg';
 $('countdown').setAttribute('aria-label',pre?'Countdown bis zur Abfahrt':'Countdown bis zur Rückkehr');
 const progress=clamp((now-startTime)/(endTime-startTime));
 $('journey-caption').textContent=pre?'Hamburg · Abfahrt 19:30 Uhr Ortszeit':done?'126 Tage · so viele neue Horizonte':`Reisetag ${journeyDay(now)} von 126`;
 $('journey-percent').textContent=Math.floor(progress*100)+' %';$('journey-progress').style.width=progress*100+'%';
 $('mode-pill').classList.toggle('preview',preview!==null);$('mode-pill').innerHTML=`<i></i> ${preview!==null?(playing?'Vorschau läuft':'Vorschau'):'Live-Zeit'}`;
 let title,eyebrow,subtitle,chip,nextName,nextTime,nextZone,nextLabel;
 if(pre){title='Start in Hamburg';eyebrow='BEREIT FÜR DIE GROSSE REISE';subtitle=dateTime(startTime,ports[0].timezone);chip='Vorfreude';nextName='Leinen los!';nextTime=startTime;nextZone=ports[0].timezone;nextLabel='Nächster Moment';}
 else if(done){title='Zurück in Hamburg';eyebrow='EINMAL UM DIE WELT';subtitle='Die Weltreise ist angekommen.';chip='Angekommen';nextName='Willkommen zurück';nextTime=endTime;nextZone=ports.at(-1).timezone;nextLabel='Ankunft in Hamburg';}
 else if(s.port){title=s.port.name;eyebrow='IM HAFEN';subtitle=s.port.country+' · Zeit zum Entdecken';chip='Land in Sicht';nextName='Weiter geht’s';nextTime=s.port.departure;nextZone=s.port.timezone;nextLabel='Nächste Abfahrt';}
 else{const from=s.leg?.from?.name?s.leg.from:ports[s.leg?.fromIndex??s.leg?.index??0];const to=s.nextPort??ports[(from?.index??0)+1];title=`Kurs auf ${to.name}`;eyebrow='AUF SEE';subtitle=`${from?.name??'Unterwegs'} → ${to.name}`;chip='Unterwegs';nextName=to.name;nextTime=to.arrival;nextZone=to.timezone;nextLabel='Nächster Hafen';}
 $('status-title').textContent=title;$('status-eyebrow').textContent=eyebrow;$('status-subtitle').textContent=subtitle;$('status-chip').textContent=chip;
 $('next-label').textContent=nextLabel;$('next-name').textContent=nextName;$('next-time').textContent=dateTime(nextTime,nextZone);$('next-zone').textContent='Hafen-Ortszeit · '+fmt(nextTime,nextZone,{timeZoneName:'short'}).split(' ').at(-1);
 const clockPort=pre?ports[0]:done?ports.at(-1):statePort(s);
 $('clock-label').textContent=(preview!==null?'Vorschau: ':'Jetzt in ')+clockPort.name;
 $('local-clock').textContent=fmt(now,clockPort.timezone,{...timeOptions,second:'2-digit'});$('local-date').textContent=fmt(now,clockPort.timezone,{weekday:'short',day:'numeric',month:'long'});
 $('clock-zone').textContent=clockPort.timezone+(s.port||pre||done?'':' · nächster Hafen');
 const coord=Array.isArray(s.position)?s.position:s.position?.coord??s.position?.coordinates;
 if(coord){const p=project(coord);$('ship-marker').setAttribute('transform',`translate(${p[0]},${p[1]}) rotate(${s.heading??0})`);}
 renderRoute(s);
 const key=`${s.phase}-${s.port?.id??''}-${s.nextPort?.id??''}`;
 if(!selectedMonth)selectedMonth=inputValue(pre?startTime:done?endTime:now,'Europe/Berlin').slice(0,7);
 if(key!==lastPortKey||force){renderItinerary();lastPortKey=key;}
 if(dialog.open&&document.activeElement!==$('journey-slider'))$('journey-slider').value=Math.round(progress*10000);
 $('slider-label').textContent=fmt(now,'Europe/Berlin',{...dateOptions,year:'numeric'});
 $('toggle-playback').textContent=playing?'Ⅱ Pausieren':'▶ Abspielen';
}
function legPath(leg){return leg.samples??leg.path??leg.coordinates??[];}
function renderRoute(s){
 if(!landReady)return;
 const key=`${s.leg?.index??'-'}-${Math.floor(now/60000)}-${s.port?.index??'-'}`;
 if(key===lastMapKey)return;lastMapKey=key;
 const g=$('route-progress');g.replaceChildren();
 for(const line of routeForTime(now,true,35))g.append(el('path',{d:pathData(line),class:'route-path done'}));
 $('port-dots').querySelectorAll('circle').forEach((dot,i)=>dot.setAttribute('class','port-dot'+(now>=(ports[i].arrival??ports[i].departure)?' visited':'')+(s.port?.index===i?' current':'')));
}
async function initMap(){
 try{const response=await fetch('./assets/land.json');if(!response.ok)throw Error('map');const land=await response.json();
 const group=$('map-land');for(const poly of land){const d=poly.map((p,i)=>{const [x,y]=project(p);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join('')+'Z';group.append(el('path',{d}));}
 for(const waterway of interiorWaterways)$('map-waterways').append(el('path',{d:pathData(sampleLeg({path:waterway},15)),fill:'none',stroke:'#eaf4fa','stroke-width':2.6,'stroke-linejoin':'round','stroke-linecap':'round'}));
 for(const [name,lon,lat,kind]of [['NORDAMERIKA',-105,43,''],['SÜDAMERIKA',-56,-15,''],['EUROPA',19,54,''],['AFRIKA',21,9,''],['ASIEN',94,45,''],['AUSTRALIEN',135,-24,''],['ATLANTIK',-30,18,'ocean'],['PAZIFIK',-135,0,'ocean'],['INDISCHER OZEAN',78,-13,'ocean']]){const [x,y]=project([lon,lat]);const t=el('text',{x,y,class:kind});t.textContent=name;$('map-labels').append(t);}
 for(const leg of legs)$('route-base').append(el('path',{d:pathData(sampleLeg(leg,35)),class:'route-path'}));
 for(const port of ports){const [cx,cy]=project(port.coord);const c=el('circle',{cx,cy,r:2.7,class:'port-dot'});const title=el('title');title.textContent=port.name;c.append(title);$('port-dots').append(c);}
 landReady=true;$('map-loading').hidden=true;lastMapKey='';render(true);
 }catch(e){$('map-loading').textContent='Die Karte konnte nicht geladen werden. Countdown und Reiseplan bleiben verfügbar.';$('map-loading').classList.add('map-error');console.error('Map failed',e);}
}
function renderItinerary(){
 const focusedMonth=document.activeElement?.dataset?.month;
 const current=currentState.port??currentState.nextPort;
 $('month-tabs').innerHTML=months.map(([m,l])=>`<button type="button" data-month="${m}" class="${selectedMonth===m?'active':''}" aria-pressed="${selectedMonth===m}">${l}<span class="hidden"> ${m.slice(0,4)}</span></button>`).join('');
 if(focusedMonth)$('month-tabs').querySelector(`[data-month="${focusedMonth}"]`)?.focus({preventScroll:true});
 const list=ports.filter(p=>(p.arrivalDate??p.departureDate).slice(0,7)===selectedMonth || (p.departureDate?.slice(0,7)===selectedMonth&&p.arrivalDate?.slice(0,7)!==selectedMonth));
 $('itinerary-list').innerHTML=list.map(p=>{
 const date=portDate(p),arr=p.arrival,dep=p.departure,isCurrent=current?.id===p.id,visited=(dep??arr)<now;
 const overnight=p.overnight;
 const showDates=arr&&dep&&inputValue(arr,p.timezone).slice(0,10)!==inputValue(dep,p.timezone).slice(0,10);
 const line=(type,t)=>t===null?'':`<span><i>${type==='Ankunft'?'↘':'↗'}</i> ${type} <b>${showDates?fmt(t,p.timezone,shortDate)+' · ':''}${timeText(t,p.timezone)}</b></span>`;
 return `<article class="port-row ${isCurrent?'current':''} ${visited?'visited':''}" id="port-${p.id}"><div class="port-day"><strong>${fmt(date,p.timezone,{day:'2-digit'})}</strong><span>${fmt(date,p.timezone,{month:'short'})}</span></div><i class="timeline-dot" aria-hidden="true"></i><div class="port-details"><h3>${escape(p.name)}${isCurrent?`<span class="port-tag">${currentState.port?'Hier':now<startTime?'Start':'Als Nächstes'}</span>`:''}</h3><p>${escape(p.country)}${overnight?' · Über Nacht':''}</p><div class="port-times">${line('Ankunft',arr)}${line('Abfahrt',dep)}</div><div class="port-detail-zone">${escape(p.timezone)}</div></div><button type="button" data-port="${p.index}" aria-label="${escape(p.name)} in der Vorschau ansehen" title="Diesen Stopp ansehen">↗</button></article>`;
 }).join('');
}
$('month-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-month]');if(b){selectedMonth=b.dataset.month;renderItinerary();}});
$('itinerary-list').addEventListener('click',e=>{const b=e.target.closest('[data-port]');if(b){playing=false;const p=ports[+b.dataset.port];setPreview(p.arrival??p.departure-1);$('map-heading').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}});
$('jump-current').addEventListener('click',()=>{const p=currentState.port??currentState.nextPort??ports.at(-1);selectedMonth=(p.arrivalDate??p.departureDate).slice(0,7);renderItinerary();$('port-'+p.id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});});
function updateMapTransform(){$('map-canvas').classList.toggle('zoomed',scale>1);const x=500-center[0]*scale,y=250-center[1]*scale;$('map-scene').setAttribute('transform',`translate(${x},${y}) scale(${scale})`);$('map-labels').style.opacity=scale>2.5?'.4':'1';}
function zoom(factor){scale=clamp(scale*factor,1,7);if(scale===1)center=[500,250];updateMapTransform();}
$('zoom-in').addEventListener('click',()=>zoom(1.6));$('zoom-out').addEventListener('click',()=>zoom(1/1.6));$('fit-map').addEventListener('click',()=>{scale=1;center=[500,250];updateMapTransform();});
$('locate-ship').addEventListener('click',()=>{const p=currentState.position;const coord=Array.isArray(p)?p:p?.coord??p?.coordinates;if(coord){center=project(coord);scale=3.3;updateMapTransform();}});
const canvas=$('map-canvas');
canvas.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0)return;drag={x:e.clientX,y:e.clientY,center:[...center],active:false};if(e.pointerType==='mouse')canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.active&&Math.abs(dx)<5&&Math.abs(dy)<5)return;if(!drag.active&&e.pointerType!=='mouse'&&Math.abs(dy)>Math.abs(dx)&&scale===1){drag=null;return;}drag.active=true;canvas.classList.add('dragging');const r=canvas.getBoundingClientRect();const units=Math.min(r.width/1000,r.height/500)*scale;center=[clamp(drag.center[0]-dx/units,0,1000),clamp(drag.center[1]-dy/units,0,500)];updateMapTransform();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;canvas.classList.remove('dragging');});
canvas.addEventListener('keydown',e=>{const move=30/scale;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Home'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')zoom(1.6);else if(e.key==='-')zoom(1/1.6);else if(e.key==='Home')$('fit-map').click();else{center[0]+=e.key==='ArrowLeft'?-move:e.key==='ArrowRight'?move:0;center[1]+=e.key==='ArrowUp'?-move:e.key==='ArrowDown'?move:0;updateMapTransform();}}});
$('settings-trigger').addEventListener('click',()=>{$('preview-datetime').value=inputValue(preview??Date.now(),$('preview-zone').value);$('preview-error').textContent='';dialog.showModal();render(true);});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('preview-zone').addEventListener('change',()=>{$('preview-error').textContent='';});
$('apply-preview').addEventListener('click',()=>{try{const ms=parseWallTime($('preview-datetime').value,$('preview-zone').value);if($('preview-datetime').value<$('preview-datetime').min||$('preview-datetime').value>$('preview-datetime').max)throw Error('Bitte ein Datum zwischen Oktober 2026 und März 2027 wählen.');playing=false;$('preview-error').textContent='';setPreview(ms);dialog.close();}catch(e){$('preview-error').textContent=e.message;}});
$('journey-slider').addEventListener('input',()=>{playing=false;setPreview(startTime+(endTime-startTime)*(+$('journey-slider').value/10000));$('preview-datetime').value=inputValue(now,$('preview-zone').value);});
$('toggle-playback').addEventListener('click',()=>{if(playing){playing=false;}else{if(preview===null||preview<startTime||preview>=endTime)preview=startTime;playing=true;lastFrame=performance.now();}render(true);});
$('playback-speed').addEventListener('change',()=>{playSpeed=+$('playback-speed').value;});
$('reset-live').addEventListener('click',()=>{preview=null;playing=false;lastSecond=-1;selectedMonth=null;render(true);$('preview-datetime').value=inputValue(now,$('preview-zone').value);dialog.close();});
function frame(timestamp){const dt=Math.min(timestamp-lastFrame,250);lastFrame=timestamp;if(playing){preview=Math.min(endTime,preview+dt*playSpeed);if(preview>=endTime)playing=false;render();}requestAnimationFrame(frame);}
// The next port clock avoids inventing a ship timezone while at sea.
$('stat-ports').textContent=new Set(ports.map(p=>p.name)).size;
render(true);initMap();setInterval(()=>{if(!playing)render();},250);requestAnimationFrame(frame);
