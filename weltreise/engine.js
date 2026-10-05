import { portData } from './ports.js';
import { legWaypoints, corridorNotes } from './routes.js';
export { passages } from './passages.js';
export { interiorWaterways } from './routes.js';

export const EARTH_RADIUS_KM = 6371.0088;
export const HOUR_MS = 3600000;
export const DAY_MS = 24 * HOUR_MS;
export const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
export const wrapLongitude = lon => ((lon + 180) % 360 + 360) % 360 - 180;
export const shortestLongitudeDelta = (from, to) => wrapLongitude(to - from);
const rad = x => x * Math.PI / 180;
const deg = x => x * 180 / Math.PI;

export function distanceKm(a, b) {
  const lat1 = rad(a[1]), lat2 = rad(b[1]);
  const dlat = lat2 - lat1, dlon = rad(shortestLongitudeDelta(a[0], b[0]));
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(clamp(h)), Math.sqrt(clamp(1 - h)));
}
export function initialBearing(a, b) {
  const l1=rad(a[1]), l2=rad(b[1]), dl=rad(shortestLongitudeDelta(a[0],b[0]));
  return (deg(Math.atan2(Math.sin(dl)*Math.cos(l2),Math.cos(l1)*Math.sin(l2)-Math.sin(l1)*Math.cos(l2)*Math.cos(dl)))+360)%360;
}
/** Distance-weighted spherical interpolation along the short great-circle arc. */
export function geodesicInterpolate(a, b, fraction) {
  const t=clamp(fraction);
  if(t===0)return [...a];
  if(t===1)return [...b];
  const l1=rad(a[0]), p1=rad(a[1]), l2=rad(b[0]), p2=rad(b[1]);
  const angular=distanceKm(a,b)/EARTH_RADIUS_KM;
  if(angular<1e-12)return [...a];
  const sin=Math.sin(angular), A=Math.sin((1-t)*angular)/sin, B=Math.sin(t*angular)/sin;
  const x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2);
  const y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2);
  const z=A*Math.sin(p1)+B*Math.sin(p2);
  return [wrapLongitude(deg(Math.atan2(y,x))),deg(Math.atan2(z,Math.hypot(x,y)))];
}

const formatterCache = new Map();
function zonedParts(time, timezone) {
  if(!formatterCache.has(timezone))formatterCache.set(timezone,new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  const parts={};
  for(const p of formatterCache.get(timezone).formatToParts(time))if(p.type!=='literal')parts[p.type]=Number(p.value);
  return parts;
}
/** Convert explicit civil port-local date/time with IANA DST; 24:00 means next-day 00:00. */
export function localTimeToEpoch(date, time, timezone) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new RangeError('Use YYYY-MM-DD and HH:MM');
  const [year,month,day]=date.split('-').map(Number), [hour,minute]=time.split(':').map(Number);
  if(hour>24||minute>59||(hour===24&&minute!==0))throw new RangeError('Invalid local time');
  const midnight=Date.UTC(year,month-1,day), dateCheck=new Date(midnight);
  if(dateCheck.getUTCFullYear()!==year||dateCheck.getUTCMonth()!==month-1||dateCheck.getUTCDate()!==day)throw new RangeError('Invalid date');
  const nominal=midnight+(hour*60+minute)*60000;
  // Collect the distinct UTC offsets around this civil day, then verify each
  // candidate. This rejects spring gaps and autumn folds rather than choosing
  // an arbitrary occurrence of a repeated local time.
  const offsets=new Set();
  for(let h=-36;h<=36;h+=6){
    const instant=nominal+h*HOUR_MS,p=zonedParts(instant,timezone);
    offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-instant);
  }
  const matches=[];
  for(const offset of offsets){
    const candidate=nominal-offset,p=zonedParts(candidate,timezone);
    if(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)===nominal)matches.push(candidate);
  }
  if(matches.length===1)return matches[0];
  throw new RangeError(matches.length?'Local time is ambiguous in this timezone':'Local time does not exist in this timezone');
}
export function formatPortTime(epoch, portOrTimezone, options = {}) {
  const timezone=typeof portOrTimezone==='string'?portOrTimezone:portOrTimezone.timezone;
  return new Intl.DateTimeFormat('de-DE',{timeZone:timezone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...options}).format(epoch);
}

export const ports = portData.map(p => Object.freeze({...p,coord:Object.freeze([...p.coord])}));
export const itinerary = ports;
export const startTime = ports[0].departure;
export const endTime = ports.at(-1).arrival;
export const durationMs = endTime-startTime;
export const scheduleAssumptions = Object.freeze({
  position:'Simulation aus Fahrplan und vereinfachten Wasserwegen. Keine Live-AIS-Position.',
  times:'Fahrplanzeiten als lokale Hafenzeit interpretiert; die Vorlage nennt keine Zeitzonen-Konvention. UTC-Werte basieren auf IANA-Zeitzonen einschließlich Sommerzeit.',
  route:'Annähernde See-, Fluss- und Fjordkorridore; kein bestätigter Navigationskurs, keine Garantie für Fahrwasser, Tiefgang oder Liegeplatz.',
  speed:'Je Hafen-zu-Hafen-Etappe konstante Geschwindigkeit entlang der gezeichneten Strecke; keine Abbildung von Strömung, Wetter, Lotsenfahrt oder Manövern.',
  passages:'Passagetage aus dem Fahrplan, genaue Passagezeiten nicht angegeben. Simulierte Passagezeiten können abweichen.',
  returnEquator:'Rückweg: Fahrplan 08.02.2027, Übersichtskarte 09.02.2027. Der Fahrplan hat Vorrang.',
  dateline:'Zivile Datumsgrenze zwischen Aitutaki und Tonga; geometrischer 180°-Kartenumbruch erst zwischen Tonga und Suva.',
  source:'Vom Nutzer bereitgestellter AIDA-Fahrplan und die zugehörige Übersichtskarte; Routenfolge mit der offiziellen AIDA-Routenseite abgeglichen.',
  officialRouteUrl:'https://aida.de/route/weltreise-2026/HAMC6005',
  reviewedOn:'2026-10-05'
});

export const legs = ports.slice(0,-1).map((from,index)=>{
  const to=ports[index+1], path=[from.coord,...legWaypoints[index],to.coord].map(p=>[...p]);
  const cumulativeKm=[0];
  for(let i=1;i<path.length;i++)cumulativeKm.push(cumulativeKm.at(-1)+distanceKm(path[i-1],path[i]));
  const length=cumulativeKm.at(-1), start=from.departure, end=to.arrival;
  return {index,id:`${from.id}--${to.id}`,from,to,fromIndex:index,toIndex:index+1,start,end,path,cumulativeKm,distanceKm:length,durationMs:end-start,speedKmh:length/((end-start)/HOUR_MS),speedKnots:length/1.852/((end-start)/HOUR_MS),corridor:corridorNotes[index]??'Offener Ozean und Hafenzufahrt',approximate:true};
});
export const totalDistanceKm = legs.reduce((n,l)=>n+l.distanceKm,0);
let distanceBefore=0;
for(const leg of legs){leg.distanceBeforeKm=distanceBefore;distanceBefore+=leg.distanceKm;}

export function positionOnLeg(legOrIndex, fraction) {
  const leg=typeof legOrIndex==='number'?legs[legOrIndex]:legOrIndex;
  const progress=clamp(fraction), target=progress*leg.distanceKm;
  let segment=0;
  while(segment<leg.path.length-2&&leg.cumulativeKm[segment+1]<=target)segment++;
  const span=leg.cumulativeKm[segment+1]-leg.cumulativeKm[segment];
  const segmentProgress=span?clamp((target-leg.cumulativeKm[segment])/span):0;
  const position=geodesicInterpolate(leg.path[segment],leg.path[segment+1],segmentProgress);
  return {position,heading:initialBearing(position,leg.path[segment+1]),segmentIndex:segment,segmentProgress,distanceKm:target,progress};
}

/** At arrival: in port. At departure: at sea. At final arrival: complete. */
export function deriveState(input = Date.now()) {
  const now=input instanceof Date?input.getTime():Number(input);
  if(!Number.isFinite(now))throw new RangeError('A finite epoch in milliseconds is required');
  const progress=clamp((now-startTime)/durationMs), remainingMs=Math.max(0,endTime-now);
  const base={now,progress,remainingMs,journeyRemainingMs:remainingMs,daysElapsed:clamp((now-startTime)/DAY_MS,0,durationMs/DAY_MS),day:now<startTime?0:Math.min(126,Math.floor((Math.min(now,endTime)-startTime)/DAY_MS)+1),totalCalls:ports.length,uniquePorts:43,approximate:true};
  if(now<startTime)return {...base,phase:'precruise',port:ports[0],currentPort:ports[0],nextPort:ports[0],leg:null,position:[...ports[0].coord],heading:0,legProgress:0,visitedCount:0,nextEventTime:startTime,eventRemainingMs:startTime-now,distanceTravelledKm:0,distanceProgress:0,remainingDistanceKm:totalDistanceKm,speedKnots:0};
  if(now>=endTime)return {...base,phase:'complete',port:ports.at(-1),currentPort:ports.at(-1),nextPort:null,leg:null,position:[...ports.at(-1).coord],heading:0,legProgress:1,visitedCount:ports.length,nextEventTime:null,eventRemainingMs:0,distanceTravelledKm:totalDistanceKm,distanceProgress:1,remainingDistanceKm:0,speedKnots:0};
  for(let i=0;i<legs.length;i++){
    const leg=legs[i];
    if(now>=leg.start&&now<leg.end){
      const legProgress=(now-leg.start)/(leg.end-leg.start),p=positionOnLeg(leg,legProgress),travelled=leg.distanceBeforeKm+p.distanceKm;
      return {...base,phase:'sea',port:null,currentPort:null,previousPort:leg.from,nextPort:leg.to,leg,position:p.position,heading:p.heading,legProgress,visitedCount:i+1,nextEventTime:leg.end,eventRemainingMs:leg.end-now,distanceTravelledKm:travelled,distanceProgress:travelled/totalDistanceKm,remainingDistanceKm:totalDistanceKm-travelled,speedKnots:leg.speedKnots};
    }
    const port=leg.to;
    if(now>=port.arrival&&now<port.departure){
      const travelled=leg.distanceBeforeKm+leg.distanceKm;
      return {...base,phase:'port',port,currentPort:port,nextPort:ports[i+2]??null,leg:null,position:[...port.coord],heading:0,legProgress:0,visitedCount:i+2,nextEventTime:port.departure,eventRemainingMs:port.departure-now,distanceTravelledKm:travelled,distanceProgress:travelled/totalDistanceKm,remainingDistanceKm:totalDistanceKm-travelled,speedKnots:0};
    }
  }
  throw new Error('Schedule gap: every instant between start and end must belong to a sea leg or port stay');
}
export const positionAt = now => deriveState(now).position;

/** Densify to a maximum great-circle segment length; coordinate order stays [lon,lat]. */
export function sampleLeg(legOrIndex, maxStepKm = 40) {
  if(!(maxStepKm>0))throw new RangeError('maxStepKm must be positive');
  const leg=typeof legOrIndex==='number'?legs[legOrIndex]:legOrIndex, result=[[...leg.path[0]]];
  for(let i=1;i<leg.path.length;i++){
    const count=Math.max(1,Math.ceil(distanceKm(leg.path[i-1],leg.path[i])/maxStepKm));
    for(let j=1;j<=count;j++)result.push(geodesicInterpolate(leg.path[i-1],leg.path[i],j/count));
  }
  return result;
}
export function unwrapCoordinates(coords) {
  if(!coords.length)return [];
  const out=[[...coords[0]]];
  for(let i=1;i<coords.length;i++)out.push([out[i-1][0]+shortestLongitudeDelta(out[i-1][0],coords[i][0]),coords[i][1]]);
  return out;
}
/** Split world-map lines at ±180° so an SVG/Canvas never draws across the entire map. */
export function splitAtDateline(coords) {
  if(!coords.length)return [];
  const lines=[[[wrapLongitude(coords[0][0]),coords[0][1]]]];
  for(let i=1;i<coords.length;i++){
    const a=lines.at(-1).at(-1), b=[wrapLongitude(coords[i][0]),coords[i][1]];
    const delta=b[0]-a[0];
    if(Math.abs(delta)>180){
      const unwrapped=a[0]+shortestLongitudeDelta(a[0],b[0]),edge=delta>180?-180:180;
      const t=(edge-a[0])/(unwrapped-a[0]),lat=a[1]+(b[1]-a[1])*t;
      lines.at(-1).push([edge,lat]);lines.push([[-edge,lat],b]);
    }else lines.at(-1).push(b);
  }
  return lines.filter(l=>l.length>1);
}
export function routeForTime(now=Date.now(), completed=true, maxStepKm=40) {
  const state=deriveState(now), result=[];
  for(const leg of legs){
    if(completed&&now<leg.start)break;
    if(!completed&&now>=leg.end)continue;
    let path=sampleLeg(leg,maxStepKm);
    if(state.phase==='sea'&&state.leg.index===leg.index){
      const p=positionOnLeg(leg,state.legProgress);
      const partial=completed?[...leg.path.slice(0,p.segmentIndex+1),p.position]:[p.position,...leg.path.slice(p.segmentIndex+1)];
      path=sampleLeg({path:partial},maxStepKm);
    }
    result.push(...splitAtDateline(path));
  }
  return result;
}
export function makeRouteGeoJSON(maxStepKm=40) {
  return {type:'FeatureCollection',features:legs.map(leg=>({type:'Feature',properties:{id:leg.id,index:leg.index,from:leg.from.name,to:leg.to.name,start:leg.start,end:leg.end,distanceKm:leg.distanceKm,approximate:true},geometry:{type:'MultiLineString',coordinates:splitAtDateline(sampleLeg(leg,maxStepKm))}}))};
}
export const routeGeoJSON = makeRouteGeoJSON();
export const routeLines = routeGeoJSON.features.flatMap(f=>f.geometry.coordinates);
