// The celebration follows the same effective instant as the trip and Germany clock.
// Explicit civil dates avoid device-timezone differences and accidental annual repeats.
const birthdayDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
export function isBirthdayMoment(ms){
 if(!Number.isFinite(ms)||Math.abs(ms)>8.64e15)return false;
 const parts=Object.fromEntries(birthdayDate.formatToParts(ms).map(p=>[p.type,p.value]));
 return parts.year==='2026'&&parts.month==='11'&&(parts.day==='22'||parts.day==='23');
}
const colors=['rose','gold','lilac','sky','pearl'];
function node(doc,tag,className){const n=doc.createElement(tag);n.className=className;return n;}
function balloons(doc,count,className){
 const fragment=doc.createDocumentFragment();
 for(let i=0;i<count;i++){
  const balloon=node(doc,'span',`${className} balloon-${colors[i%colors.length]}`);
  balloon.style.cssText=`--i:${i};--x:${(i*37+5)%100}%;--size:${30+(i*13)%35}px;--rise:${19+(i*7)%16}s;--delay:-${(i*11)%34}s;--sway:${(i%2?1:-1)*(12+i%4*8)}px;--tilt:${(i%2?1:-1)*(5+i%9)}deg;--rest:${8+(i*17)%80}%;`;
  balloon.append(node(doc,'i','balloon-shine'),node(doc,'i','balloon-string'));
  fragment.append(balloon);
 }
 return fragment;
}
export function createBirthdayParty(doc){
 let active=false,layer=null;
 const card=doc.getElementById('birthday-card');
 const ship=doc.getElementById('birthday-ship-pennants');
 function clear(){
  layer?.remove();layer=null;active=false;
  doc.body.classList.remove('birthday-party');card.hidden=true;
  doc.getElementById('birthday-balloons').replaceChildren();
  if(ship)ship.hidden=true;
 }
 return {
  update(ms){
   const next=isBirthdayMoment(ms);if(next===active)return;
   if(!next){clear();return;}
   active=true;doc.body.classList.add('birthday-party');card.hidden=false;if(ship)ship.hidden=false;
   doc.getElementById('birthday-balloons').append(balloons(doc,18,'birthday-balloon'));
   layer=node(doc,'div','birthday-atmosphere');layer.setAttribute('aria-hidden','true');
   const lights=node(doc,'div','birthday-party-lights');
   for(let i=0;i<3;i++)lights.append(node(doc,'i',`party-light light-${i}`));
   layer.append(lights,balloons(doc,24,'birthday-float'));
   const stars=node(doc,'div','birthday-stars');
   for(let i=0;i<30;i++){
    const star=node(doc,'i',`birthday-spark ${i%3?'':'spark-diamond'}`);
    star.style.cssText=`left:${(i*43+9)%100}%;top:${(i*29+3)%100}%;--delay:-${i%9}s;--tilt:${i*23}deg;`;
    stars.append(star);
   }
   layer.append(stars);doc.body.append(layer);
  },
  destroy:clear
 };
}
