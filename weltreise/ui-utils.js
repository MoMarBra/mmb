export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const fmtCache=new Map();
export function fmt(date,zone,options){
 if(date==null||!Number.isFinite(+date))return '–';
 const key=zone+JSON.stringify(options);if(!fmtCache.has(key))fmtCache.set(key,new Intl.DateTimeFormat('de-DE',{timeZone:zone,...options}));
 return fmtCache.get(key).format(new Date(date));
}
export function inputValue(epoch,zone){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch));
 const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}`;
}
// Find every matching instant: reject nonexistent / ambiguous DST wall times rather than silently shifting.
export function parseWallTime(value,zone){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Bitte ein vollständiges Datum mit Uhrzeit eingeben.');
 const naive=Date.parse(value+':00Z');if(!Number.isFinite(naive))throw Error('Dieses Datum ist ungültig.');
 const candidates=[];
 for(let offset=-14*60;offset<=14*60;offset+=15){const time=naive-offset*60000;if(inputValue(time,zone)===value)candidates.push(time);}
 if(!candidates.length)throw Error('Diese Ortszeit existiert nicht. Bitte Sommerzeitwechsel oder Datum prüfen.');
 if(candidates.length>1)throw Error('Diese Uhrzeit kommt beim Zeitwechsel zweimal vor. Bitte UTC auswählen.');
 return candidates[0];
}
export function splitAtDateline(coords){
 const lines=[];let line=[];
 for(const point of coords){const p=[((point[0]+180)%360+360)%360-180,point[1]];
 if(line.length){const prev=line.at(-1);if(Math.abs(p[0]-prev[0])>180){const adjusted=p[0]+(p[0]<prev[0]?360:-360);const edge=prev[0]>0?180:-180;const t=(edge-prev[0])/(adjusted-prev[0]);const lat=prev[1]+t*(p[1]-prev[1]);line.push([edge,lat]);lines.push(line);line=[[-edge,lat]];}}
 line.push(p);
 }if(line.length)lines.push(line);return lines;
}
export const project=([lon,lat])=>[(lon+180)*1000/360,(84-lat)*1000/360];
export function pathData(coords){return splitAtDateline(coords).map(line=>line.map((point,i)=>{const [x,y]=project(point);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join('')).join('');}
export function countdownParts(milliseconds){let seconds=Math.max(0,Math.floor(milliseconds/1000));const days=Math.floor(seconds/86400);seconds%=86400;const hours=Math.floor(seconds/3600);seconds%=3600;const minutes=Math.floor(seconds/60);return {days,hours,minutes,seconds:seconds%60};}
