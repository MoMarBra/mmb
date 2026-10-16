import {portData} from './ports.js';
import {deriveState,routeForTime,routeLines} from './engine.js';
import {drawShipSvg} from './ship-model.js?v=de3bab32a7a4';
import {chartCatalog,chartKey} from './nautical-data.js';

const $=id=>document.getElementById(id);
const stops=portData.filter((p,i,a)=>a.findIndex(x=>x.name===p.name)===i);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer nofollow">${safe(label)} ↗</a>`;
const latLng=coord=>[coord[1],coord[0]];
let enabled=false,map=null,selected=stops[0],state=deriveState(Date.now()),activeLayer=null,activeKey='',requestId=0;
let roads=null,land=null,ship=null,doneRoute=null,lastRouteTime=null,initializing=null,lastHeading=null;
const choose=$('chart-port');
for(const [i,p] of stops.entries()){const o=document.createElement('option');o.value=p.id;o.textContent=`${String(i+1).padStart(2,'0')} · ${p.name}${chartCatalog[chartKey(p.id)].layer?' · Seekarte':''}`;choose.append(o);}
function status(text,kind='info'){$('chart-state').textContent=text;$('chart-state').dataset.kind=kind;}
function badge(text,kind='info'){const b=$('chart-map-badge');b.textContent=text;b.dataset.kind=kind;b.hidden=!enabled;}
function describe(p){
 selected=p;choose.value=p.id;const c=chartCatalog[chartKey(p.id)];
 $('chart-port-name').textContent=p.name;$('chart-count').textContent=`${stops.indexOf(p)+1} / ${stops.length} Häfen · ${Object.values(chartCatalog).filter(x=>x.layer).length} mit Originalebene`;
 $('chart-prev').disabled=stops.indexOf(p)===0;$('chart-next').disabled=stops.indexOf(p)===stops.length-1;
 $('chart-provider').textContent=c.provider;
 $('chart-kind').textContent=c.layer?.type==='wms'?'Amtlicher ENC-Kartendienst':c.layer?.type==='image'?'Registrierte Originalkarte':'Originalkarte nur extern';
 $('chart-kind').classList.toggle('is-unavailable',!c.layer);
 $('chart-description').textContent=c.description??(c.layer?'Die Originalkarte liegt geografisch korrekt direkt auf derselben Reisekarte.':'Hier ist keine frei einbindbare amtliche Originalebene verfügbar. Die normale Orientierungskarte ist keine Seekarte.');
 $('chart-metadata').innerHTML=[['Karte / ENC',c.number],['Räumliche Abdeckung',c.coverage],['Maßstab / Detailtiefe',c.scale],['Ausgabe / Berichtigung',c.edition]].map(([k,v])=>`<div><dt>${safe(k)}</dt><dd>${safe(v??'Nicht verifiziert; amtliche Quelle prüfen')}</dd></div>`).join('');
 $('chart-license').textContent=c.license;
 const links=[[c.source,'Amtliche Originalquelle'],[c.licenseUrl,'Nutzungsbedingungen'],[c.purchaseUrl,'Bezug / Lizenz'],[c.layer?.original,'Originaldatei'],...(c.extraSources??[]).map((u,i)=>[u,`Weitere Quelle ${i+1}`])];
 $('chart-source-links').innerHTML=links.filter(([u],i,a)=>u&&a.findIndex(([v])=>u===v)===i).map(([u,l])=>link(u,l)).join(' · ');
 $('chart-notice').textContent=c.notice??'Nur zur Reiseansicht. Nicht zur Navigation geeignet. Hafenmarkierung und Schiffsposition sind Näherungen.';
 $('chart-updated').textContent='Quellen geprüft am 16.10.2026. Ausgabedatum ist nicht gleich letzter Berichtigungsstand.';
}
function currentPort(){const p=state.port??state.currentPort??state.nextPort??stops[0];return stops.find(x=>x.name===p.name)??stops[0];}
function clearLayer(){requestId++;if(activeLayer){map.removeLayer(activeLayer);activeLayer=null;}activeKey='';$('chart-loading').hidden=true;}
function nearest(){const center=map.getCenter();let best=null,distance=Infinity;for(const p of stops){const d=map.distance(center,latLng(p.coord));if(d<distance){best=p;distance=d;}}return {port:best,distance};}
function updateOverlay(force=false){
 if(!map)return;
 const close=nearest();if(map.getZoom()>=6&&close.distance<150000&&close.port.id!==selected.id)describe(close.port);
 const base=chartCatalog[chartKey(selected.id)],center=map.getCenter(),detail=base.layer?.detail;
 const inDetail=detail&&map.getZoom()>=detail.minZoom&&center.lng>=detail.bounds[0]&&center.lng<=detail.bounds[2]&&center.lat>=detail.bounds[1]&&center.lat<=detail.bounds[3];
 const c=inDetail?{...base,layer:{...base.layer,...detail}}:base;
 if(!enabled){clearLayer();$('chart-map-badge').hidden=true;return;}
 if(map.getZoom()<9||close.distance>60000){clearLayer();badge('Seekartenmodus · In einen Reisehafen hineinzoomen');status('Hafen auswählen oder näher hineinzoomen. Der Schalter verändert weder Ausschnitt noch Zoom.');return;}
 if(!c.layer){clearLayer();badge(`${selected.name} · Nur Orientierung, keine Seekarte`,'warning');status(c.blocker??'Amtliches Original nur über die verlinkte Quelle beziehungsweise nach gesonderter Lizenz erhältlich.','warning');return;}
 const b=c.layer.bounds;
 if(b&&(center.lng<b[0]||center.lng>b[2]||center.lat<b[1]||center.lat>b[3])){clearLayer();badge(`${selected.name} · Außerhalb des geprüften Kartenausschnitts`,'warning');status('Hier bleibt die normale Orientierungskarte sichtbar. „Zum Hafen“ öffnet den geprüften Originalausschnitt.','warning');return;}
 const detailed=map.getZoom()>=(c.layer.detailMinZoom??0);const key=chartKey(selected.id)+(inDetail?':inset':'')+(detailed?':detail':':overview');if(activeKey===key&&!force)return;
 clearLayer();activeKey=key;const ticket=requestId,L=globalThis.L,l=c.layer;let tileErrors=0;
 badge(`${selected.name} · Originalkarte wird geladen`);status('Amtliche Seekartenebene wird geladen …');$('chart-loading').hidden=false;
 const bounds=l.bounds?[[l.bounds[1],l.bounds[0]],[l.bounds[3],l.bounds[2]]]:undefined;
 if(l.type==='wms')activeLayer=L.tileLayer.wms(l.url,{layers:l.layers,version:l.version??'1.3.0',format:'image/png',transparent:false,uppercase:true,minZoom:9,maxZoom:18,bounds,noWrap:true,attribution:safe(c.attribution),updateWhenIdle:true,keepBuffer:1,zIndex:3,...l.params});
 else if(l.type==='image')activeLayer=L.imageOverlay(!detailed&&l.preview?l.preview:l.url,bounds,{pane:'chart-raster',attribution:safe(c.attribution),alt:`${c.provider}: ${c.number}. Nicht zur Navigation.`});
 else return;
 const loaded=()=>{if(ticket!==requestId)return;if(tileErrors){failed(false);return;}$('chart-loading').hidden=true;badge(`${selected.name} · Amtliche Originalkarte${l.type==='image'?' · Stand '+(l.date??'2022'):''}`);status(l.type==='image'?`${l.label??'Georeferenziertes Originalblatt'} · nicht laufend berichtigt · nur Reiseansicht`:'Amtliche ENC-Darstellung · Detailgrad folgt dem Zoom · nur Reiseansicht','ok');};
 const failed=(count=true)=>{if(ticket!==requestId)return;if(count)tileErrors++;$('chart-loading').hidden=true;badge(`${selected.name} · Seekartendienst gestört`,'error');status('Die Originalebene konnte nicht vollständig geladen werden. Darunter bleibt die normale Orientierungskarte sichtbar. Erneut laden oder amtliche Quelle öffnen.','error');};
 activeLayer.on(l.type==='wms'?'tileload':'load',loaded);activeLayer.on(l.type==='wms'?'tileerror':'error',failed);activeLayer.addTo(map);
 setTimeout(()=>{if(ticket===requestId&&!$('chart-loading').hidden){$('chart-loading').hidden=true;badge(`${selected.name} · Seekarte antwortet noch nicht`,'warning');status('Der amtliche Dienst antwortet langsam. Die verlinkte Originalquelle bleibt verfügbar.','warning');}},15000);
}
function updateBase(){
 if(!map)return;const detail=map.getZoom()>=7;
 if(detail&&!map.hasLayer(roads))roads.addTo(map);
 if(!detail&&map.hasLayer(roads))map.removeLayer(roads);
 // Local Natural Earth remains underneath as a network-independent fallback.
 if(roads)roads.setZIndex(1);if(activeLayer?.setZIndex)activeLayer.setZIndex(3);
}
function updateJourney(){
 if(!map)return;const coord=Array.isArray(state.position)?state.position:state.position?.coord;if(coord)ship.setLatLng(latLng(coord));
 const heading=Math.round((state.heading??0)/3)*3;
 if(heading!==lastHeading){const svg=ship.getElement()?.querySelector('svg');if(svg)drawShipSvg(svg,{yaw:(heading-90)*Math.PI/180,pitch:1.18,aspect:1});lastHeading=heading;}
 const second=Math.floor(state.now/1000);if(second!==lastRouteTime){doneRoute.setLatLngs(routeForTime(state.now,true,35).map(line=>line.map(latLng)));lastRouteTime=second;}
}
async function initialize(){
 if(map)return map;if(initializing)return initializing;
 initializing=(async()=>{
  if(!globalThis.L)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./assets/vendor/leaflet.js';script.onload=resolve;script.onerror=()=>reject(Error('Die geografische Karte konnte nicht geladen werden. Die bisherige Weltkarte bleibt verfügbar.'));document.head.append(script);});
  const L=globalThis.L;$('nautical-map').hidden=false;
  map=L.map('nautical-map',{minZoom:1,maxZoom:18,zoomControl:false,attributionControl:true,worldCopyJump:false,maxBounds:[[-85,-200],[85,200]],maxBoundsViscosity:.7,preferCanvas:true,scrollWheelZoom:true});
  map.createPane('land-base').style.zIndex='190';map.createPane('chart-raster').style.zIndex='300';
  map.attributionControl.setPrefix(false);map.setView([5,0],1,{animate:false});
  L.control.scale({imperial:false,maxWidth:90,position:'bottomleft'}).addTo(map);
  const data=await fetch('./assets/land.json').then(r=>{if(!r.ok)throw Error('Kartengrundlage nicht erreichbar');return r.json();});
  land=L.polygon(data.map(poly=>poly.map(latLng)),{pane:'land-base',stroke:true,color:'#c1d5dd',weight:.65,fillColor:'#dbe8ed',fillOpacity:1,interactive:false,attribution:'<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>'}).addTo(map);
  roads=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,minZoom:7,noWrap:true,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · Orientierung, keine Seekarte',referrerPolicy:'strict-origin-when-cross-origin',updateWhenIdle:true,keepBuffer:1,zIndex:1});
  roads.on('tileerror',()=>{if(!activeLayer&&enabled)status('Die Orientierungskarte ist gerade nicht erreichbar. Die Originalquellen bleiben unten verfügbar.','warning');});
  L.polyline(routeLines.map(line=>line.map(latLng)),{color:'#91aebc',weight:1.4,dashArray:'4 5',opacity:.65,interactive:false}).addTo(map);
  doneRoute=L.polyline([],{color:'#348aaf',weight:2.2,opacity:.85,interactive:false}).addTo(map);
  for(const p of stops){const has=Boolean(chartCatalog[chartKey(p.id)].layer);L.circleMarker(latLng(p.coord),{radius:4,color:'#56869a',weight:1.2,fillColor:has?'#43756b':'#fff',fillOpacity:1}).addTo(map).bindTooltip(p.name,{direction:'top',className:'port-map-label'}).on('click',()=>goToPort(p));}
  ship=L.marker(latLng(state.position),{icon:L.divIcon({className:'map-ship-icon',iconSize:[92,92],iconAnchor:[46,46],html:'<svg viewBox="-50 -50 100 100" aria-label="Geschätzte Schiffsposition"></svg>'}),zIndexOffset:1000,title:'AIDAsol · geschätzte Position',keyboard:true}).addTo(map).bindTooltip('AIDAsol · Fahrplansimulation, kein AIS');
  $('map-canvas').classList.add('geo-ready');$('map-canvas').setAttribute('tabindex','-1');map.invalidateSize({pan:false});map.fitBounds([[-58,-180],[67,180]],{padding:[10,10],animate:false});
  map.on('moveend zoomend',()=>{updateBase();updateOverlay();});
  new ResizeObserver(()=>map.invalidateSize({pan:false})).observe($('map-canvas'));
  for(const [id,fn]of [['zoom-in',()=>map.zoomIn()],['zoom-out',()=>map.zoomOut()],['fit-map',()=>map.fitBounds([[-58,-180],[67,180]],{padding:[10,10],animate:false})],['locate-ship',()=>map.setView(latLng(state.position),Math.max(6,map.getZoom()),{animate:false})]])$(id).addEventListener('click',e=>{e.stopImmediatePropagation();fn();},true);
  updateJourney();updateBase();updateOverlay();return map;
 })().catch(error=>{if(map){map.remove();map=null;}$('nautical-map').hidden=true;$('map-canvas').classList.remove('geo-ready');$('map-canvas').setAttribute('tabindex','0');status(error.message,'error');initializing=null;throw error;});return initializing;
}
function goToPort(p){describe(p);if(map)map.setView(latLng(p.coord),chartCatalog[chartKey(p.id)].zoom??13,{animate:false});}
function toggle(){
 enabled=!enabled;$('nautical-toggle').setAttribute('aria-pressed',String(enabled));$('nautical-toggle').classList.toggle('active',enabled);$('nautical-view').hidden=!enabled;
 // Deliberately no setView, fitBounds, panTo, map destruction or scrolling here.
 // Both modes share the exact same map and geographic viewport.
 if(map)updateOverlay();else initialize().catch(()=>{});
}
$('nautical-toggle').addEventListener('click',toggle);
choose.addEventListener('change',()=>goToPort(stops.find(p=>p.id===choose.value)));
$('chart-prev').addEventListener('click',()=>goToPort(stops[Math.max(0,stops.indexOf(selected)-1)]));
$('chart-next').addEventListener('click',()=>goToPort(stops[Math.min(stops.length-1,stops.indexOf(selected)+1)]));
$('chart-current').addEventListener('click',()=>goToPort(currentPort()));$('chart-fit').addEventListener('click',()=>goToPort(selected));$('chart-retry').addEventListener('click',()=>{if(map)updateOverlay(true);else initialize().catch(()=>{});});
globalThis.addEventListener('journey:state',e=>{state=e.detail;updateJourney();});
globalThis.addEventListener('journey:port',e=>goToPort(stops.find(x=>x.name===e.detail.name)??stops[0]));
describe(currentPort());initialize().catch(()=>{});
