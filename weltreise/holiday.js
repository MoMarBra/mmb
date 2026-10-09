// Specials share the trip's effective instant and the Germany clock's civil date.
// These are specific voyage dates, deliberately not annually recurring holidays.
const germanyDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
export function holidayAt(ms){
 if(!Number.isFinite(ms)||Math.abs(ms)>8.64e15)return null;
 const p=Object.fromEntries(germanyDate.formatToParts(ms).map(part=>[part.type,part.value]));
 const date=`${p.year}-${p.month}-${p.day}`;
 if(date==='2026-12-24'||date==='2026-12-25')return {id:'christmas',eyebrow:'Ein kleines Fest auf großer Reise',title:'Weihnachten.\nMit Meerblick.',message:'Warme Lichter, weite Horizonte.\nUnd ein bisschen Weihnachtszauber an Bord.',date:'24. & 25. Dezember 2026'};
 if(date==='2026-12-31')return {id:'newyear',eyebrow:'Der schönste Kurs: nach vorn',title:'Auf ein\nneues Jahr.',message:'Ein Glas auf all die wunderbaren Momente.\nUnd auf die, die noch vor euch liegen.',date:'31. Dezember 2026 · Silvester'};
 if(date==='2027-01-01')return {id:'newyear',eyebrow:'365 neue Tage. Unendlich viele Horizonte.',title:'Hallo,\n2027.',message:'Ein neues Jahr beginnt. Die Reise geht weiter.\nAuf Glück, Leichtigkeit und ganz viel Meer.',date:'1. Januar 2027 · Frohes neues Jahr'};
 return null;
}
const christmasArt=`<svg viewBox="0 0 360 340" fill="none" aria-hidden="true"><defs><radialGradient id="holiday-bauble" cx=".29" cy=".21" r=".82"><stop stop-color="#faf2d9"/><stop offset=".28" stop-color="#d7bd80"/><stop offset=".72" stop-color="#af873f"/><stop offset="1" stop-color="#765925"/></radialGradient><radialGradient id="holiday-pearl" cx=".32" cy=".22" r=".83"><stop stop-color="#fff"/><stop offset=".53" stop-color="#f3ebe0"/><stop offset="1" stop-color="#c9b8a1"/></radialGradient><linearGradient id="holiday-green" x2="1" y2="1"><stop stop-color="#789886"/><stop offset="1" stop-color="#264d41"/></linearGradient></defs><ellipse cx="192" cy="304" rx="119" ry="13" fill="#846738" opacity=".08"/><g stroke="#537765" stroke-width="2" stroke-linecap="round"><path d="M298 4C276 30 257 47 215 64M284 21l22 2m-35 11 20 6m-35 6 17 8m-33-1 11 9M284 21l-3-17m-10 30-8-18m-8 30-10-15m-6 22-12-15"/><path d="M39 93C59 107 69 119 83 149M50 103l-1 14m11-5-1 16m9-4 1 16M50 103l14-1m-4 10 15 1m-7 11 14 3" opacity=".6"/></g><path d="M184 0v91M275 0v161" stroke="#af9155" stroke-width="1"/><g class="holiday-ornament"><circle cx="183" cy="200" r="87" fill="url(#holiday-bauble)"/><path d="M169 113v-16q14-11 28 0v16" fill="#bfa36b"/><path d="M168 99h30m-25 3v10m8-12v12m8-12v12" stroke="#846934"/><path d="M146 139c-24 8-34 31-33 53" stroke="#fff9e5" stroke-width="8" stroke-linecap="round" opacity=".32"/><circle cx="183" cy="200" r="65" stroke="#fff8dd" stroke-width=".75" opacity=".5"/><path d="m183 157 8 28 28-9-18 24 23 18-29-3-12 28-10-28-30 3 23-18-18-24 27 9z" fill="#fff7da" opacity=".75"/><circle cx="183" cy="200" r="5" fill="#c4a061"/><path d="M141 251q42 21 84 0" stroke="#e8d3a2" opacity=".65"/></g><g class="holiday-pearl"><circle cx="275" cy="227" r="52" fill="url(#holiday-pearl)"/><path d="M266 175v-12h18v12" fill="#bca272"/><path d="M266 167h18" stroke="#907748"/><path d="M246 192c-11 8-17 17-17 29" stroke="white" stroke-width="5" stroke-linecap="round" opacity=".7"/><path d="m269 210 7 12 14 2-10 10 2 14-12-7-13 6 3-14-9-11 14-1z" stroke="#bba06d" stroke-width="1"/></g><g fill="#b29a60"><path d="m88 44 3 10 10 3-10 3-3 10-3-10-10-3 10-3z"/><path d="m315 115 2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/><circle cx="100" cy="259" r="2"/><circle cx="306" cy="67" r="2"/><circle cx="69" cy="194" r="1.5"/></g></svg>`;
const newyearArt=`<svg viewBox="0 0 360 340" fill="none" aria-hidden="true"><defs><linearGradient id="holiday-champagne" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe8ae" stop-opacity=".82"/><stop offset="1" stop-color="#c49951" stop-opacity=".35"/></linearGradient><linearGradient id="holiday-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/></linearGradient></defs><text x="180" y="86" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="76" font-weight="200" letter-spacing="8" fill="#eed9a9">2027</text><ellipse cx="182" cy="307" rx="104" ry="9" fill="#edcd8e" opacity=".08"/><g transform="rotate(-15 164 184)"><path d="M131 124h53l-6 66q-3 24-20 25-17-1-21-25z" fill="url(#holiday-glass)" stroke="#fff3d6" stroke-opacity=".65" stroke-width="1.5"/><path d="M137 158h41l-4 31q-3 21-16 22-13-1-17-22z" fill="url(#holiday-champagne)"/><path d="M158 215v75m-26 0h52m-43-155 3 47" stroke="#fff3d6" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/><g fill="#fff2d1" class="holiday-bubbles"><circle cx="152" cy="178" r="2"/><circle cx="165" cy="191" r="1.5"/><circle cx="163" cy="166" r="1"/></g></g><g transform="rotate(15 217 184)"><path d="M190 124h53l-6 66q-3 24-20 25-17-1-21-25z" fill="url(#holiday-glass)" stroke="#fff3d6" stroke-opacity=".65" stroke-width="1.5"/><path d="M196 158h41l-4 31q-3 21-16 22-13-1-17-22z" fill="url(#holiday-champagne)"/><path d="M217 215v75m-26 0h52m-43-155 3 47" stroke="#fff3d6" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/><g fill="#fff2d1" class="holiday-bubbles"><circle cx="211" cy="187" r="2"/><circle cx="225" cy="176" r="1.5"/><circle cx="216" cy="164" r="1"/></g></g><g stroke="#ddbe7f" stroke-linecap="round"><path d="M179 111v-9m10 12 5-8m-26 7-5-8M77 150v-16m-8 8h16M295 240v-12m-6 6h12"/><path d="m68 240 4 4m226-94 4-4M93 102l3-5m183 11 3 5" opacity=".5"/></g><g fill="#edcc87"><circle cx="95" cy="210" r="1.6"/><circle cx="282" cy="193" r="2"/><circle cx="120" cy="292" r="1"/><circle cx="307" cy="101" r="1.4"/></g></svg>`;
function node(doc,tag,className){const n=doc.createElement(tag);n.className=className;return n;}
function firework(doc,index){
 const burst=node(doc,'span',`holiday-firework firework-${index}`);
 burst.style.cssText=`--delay:-${index*3.3}s;`;
 for(let i=0;i<12;i++){const ray=node(doc,'i','holiday-firework-ray');ray.style.cssText=`--angle:${i*30}deg;`;burst.append(ray);}
 return burst;
}
function makeAtmosphere(doc,id){
 const layer=node(doc,'div',`holiday-atmosphere holiday-atmosphere-${id}`);layer.setAttribute('aria-hidden','true');
 if(id==='christmas'){
  for(let i=0;i<18;i++){
   const snow=node(doc,'i','holiday-snow');
   snow.style.cssText=`--x:${(i*43+7)%100}%;--size:${2+i%3}px;--fall:${18+i%7*2}s;--delay:-${i*2.7}s;--drift:${i%2?30:-30}px;--rest:${(i*23+9)%100}%;`;
   layer.append(snow);
  }
 }else for(let i=0;i<3;i++)layer.append(firework(doc,i));
 return layer;
}
export function createHolidaySpecial(doc){
 let active=null,layer=null,lastTitle='';
 const card=doc.getElementById('holiday-card'),art=doc.getElementById('holiday-art'),ship=doc.getElementById('holiday-ship-decoration');
 function clear(){
  layer?.remove();layer=null;active=null;lastTitle='';
  doc.body.classList.remove('holiday-christmas');doc.body.classList.remove('holiday-newyear');
  card.hidden=true;art.replaceChildren();
  if(ship){ship.hidden=true;ship.replaceChildren();}
 }
 return {
  update(ms){
   const next=holidayAt(ms);
   if(!next){if(active)clear();return;}
   if(next.id!==active){
    clear();active=next.id;doc.body.classList.add(`holiday-${active}`);card.hidden=false;
    art.innerHTML=active==='christmas'?christmasArt:newyearArt;
    if(ship){ship.hidden=false;ship.textContent=active==='christmas'?'✧  ·  ✧  ·  ✧':'✧  2027  ✧';}
    layer=makeAtmosphere(doc,active);doc.body.append(layer);
   }
   // Midnight on New Year's Day changes the greeting without restarting the decoration.
   if(next.title===lastTitle)return;lastTitle=next.title;
   for(const key of ['eyebrow','title','message','date'])doc.getElementById(`holiday-${key}`).textContent=next[key];
  },
  destroy:clear
 };
}
