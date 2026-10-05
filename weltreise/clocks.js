import {fmt} from './ui-utils.js';

const timeOptions={hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'};
const dateOptions={weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'};
const offsetCache=new Map();
/** IANA offset at the selected instant, including DST and half-hour zones. */
export function utcOffset(epoch,zone){
 if(!offsetCache.has(zone))offsetCache.set(zone,new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}));
 const name=offsetCache.get(zone).formatToParts(epoch).find(p=>p.type==='timeZoneName').value;
 return name==='GMT'?'UTC+00:00':name.replace('GMT','UTC');
}
function clock(epoch,zone,label){return {epoch,zone,label,time:fmt(epoch,zone,timeOptions),date:fmt(epoch,zone,dateOptions),offset:utcOffset(epoch,zone)};}
/** Both clocks share one instant. At sea we deliberately use a named port reference,
 * never a guessed or purported actual onboard timezone. */
export function clockPair(epoch,state,isPreview=false){
 const port=state.port??state.nextPort;
 const atSea=state.phase==='sea';
 return {
  mode:isPreview?'Simulation · gewählte Zeit':'Jetzt · aktuelle Zeit',
  local:clock(epoch,port.timezone,`${atSea?'Nächster Hafen':'Ortszeit'} · ${port.name}`),
  germany:clock(epoch,'Europe/Berlin','Deutschland'),
  note:atSea?`Auf See: Ortszeit von ${port.name} als Referenz. Die tatsächliche Bordzeit kann abweichen.`:'Beide Uhren zeigen denselben Moment. Sommerzeit wird automatisch berücksichtigt.',
  atSea,isPreview
 };
}
