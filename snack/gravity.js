import {WHEEL,POINTER_OUTLINE} from './wheel-geometry.js';
export const FIRST_DROP_DURATION=800;
export const COLLAPSE_PAUSE=3000;
export const GROUP_DROP_AT=FIRST_DROP_DURATION+COLLAPSE_PAUSE;
export const COLLAPSE_DURATION=5000;
const TAU=Math.PI*2;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const noise=(seed)=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n)};
const extentY=piece=>Math.abs(Math.sin(piece.angle))*piece.width/2+Math.abs(Math.cos(piece.angle))*piece.height/2;
const fallGravity=(piece,flight)=>Math.max(600,2*Math.max(0,piece.floor-piece.startY-Math.min(piece.width,piece.height)/2)/(flight*flight));

// One sector drops, followed by three still seconds and one simultaneous gravity fall.
// Gravity scales with the actual distance so every viewport settles within five seconds.
export function makeDebris(rect,index,origin,viewport){
  const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  const piece={width:rect.width,height:rect.height,x,y,startX:x,startY:y,angle:0,
    vx:0,vy:0,omega:(noise(index+4)-.5)*1.5,
    release:GROUP_DROP_AT/1000,
    floor:viewport.height-12-(index%4)*2,landed:false,settled:false,index};
  piece.gravity=fallGravity(piece,.86);return piece;
}
export function advanceDebris(piece,from,to,viewport){
  if(piece.settled||to<=piece.release)return piece;
  const gravity=piece.gravity;
  for(let time=Math.max(from,piece.release);time<to;){
    const next=Math.min(to,time+1/120),dt=next-Math.max(time,piece.release);time=next;
    if(dt<=0)continue;
    piece.vy+=gravity*dt;piece.x+=piece.vx*dt;piece.y+=piece.vy*dt;piece.angle+=piece.omega*dt;
    const ey=extentY(piece);
    if(piece.y+ey>=piece.floor){
      piece.y=piece.floor-ey;piece.landed=true;
      piece.vy=Math.abs(piece.vy)<125?0:-Math.abs(piece.vy)*.04;
      piece.vx=0;piece.omega=0;
      if(!piece.vy&&!piece.vx&&!piece.omega){piece.settled=true;break}
    }
  }
  return piece;
}

function intersect(a,b){
  const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top),right=Math.min(a.right,b.right),bottom=Math.min(a.bottom,b.bottom);
  return right>left&&bottom>top?{left,top,right,bottom,width:right-left,height:bottom-top}:null;
}
function visibleBounds(element,win){
  if(element.closest('[hidden]'))return null;
  const style=win.getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden')return null;
  const raw=element.getBoundingClientRect();if(!raw.width||!raw.height)return null;
  let visible=intersect(raw,{left:0,top:0,right:win.innerWidth,bottom:win.innerHeight});
  for(let parent=element.parentElement;parent&&visible;parent=parent.parentElement){
    const css=win.getComputedStyle(parent);if(css.display==='none'||css.visibility==='hidden')return null;
    if(/hidden|clip|auto|scroll/.test(css.overflowX+' '+css.overflowY)){
      const r=parent.getBoundingClientRect(),clip={left:0,top:0,right:win.innerWidth,bottom:win.innerHeight};
      if(/hidden|clip|auto|scroll/.test(css.overflowX)){clip.left=r.left;clip.right=r.right}
      if(/hidden|clip|auto|scroll/.test(css.overflowY)){clip.top=r.top;clip.bottom=r.bottom}
      visible=intersect(visible,clip);
    }
  }
  return visible?{raw,visible}:null;
}
function frozenClone(element,win,backgroundOnly=false){
  const clone=element.cloneNode(!backgroundOnly),originals=[element,...(backgroundOnly?[]:element.querySelectorAll('*'))],copies=[clone,...clone.querySelectorAll('*')];
  for(let i=0;i<copies.length;i++){
    const source=originals[i],copy=copies[i],css=win.getComputedStyle(source);
    for(let p=0;p<css.length;p++){const name=css[p];copy.style.setProperty(name,css.getPropertyValue(name))}
    for(const attribute of [...copy.attributes])if(attribute.name==='id'||attribute.name==='for'||attribute.name==='name'||attribute.name==='autofocus'||attribute.name==='tabindex'||attribute.name.startsWith('aria-')||attribute.name.startsWith('on'))copy.removeAttribute(attribute.name);
    if('value' in source)copy.value=source.value;
    copy.style.setProperty('animation','none','important');copy.style.setProperty('transition','none','important');
  }
  return clone;
}
function rectangleTriangles(width,height,cols,rows){
  const polygons=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=col*width/cols,y=row*height/rows,w=width/cols,h=height/rows;
    polygons.push([[x,y],[x+w,y],[x,y+h]],[[x+w,y],[x+w,y+h],[x,y+h]]);
  }
  return polygons;
}
function boundsOf(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);return{left,top,right,bottom,width:right-left,height:bottom-top}}

export function createGravityCollapse({root,wheelCanvas,wheelRect,snacks,rotation=0,reduced=false,onPhase=()=>{},win=root.ownerDocument.defaultView}){
  if(reduced)return{duration:0,frame(){},restore(){},count:0};
  const document=root.ownerDocument,viewport={width:win.innerWidth,height:win.innerHeight},origin={x:wheelRect.left+wheelRect.width/2,y:wheelRect.top+wheelRect.height/2};
  const overlay=document.createElement('div');overlay.className='gravity-overlay';overlay.setAttribute('aria-hidden','true');overlay.setAttribute('inert','');
  const floor=document.createElement('div');floor.className='gravity-floor';overlay.append(floor);
  const fragments=[];let restored=false,previous=0,phase=null;
  function addFragment(rect,content,points,kind='ui',part=0){
    if(rect.width<.5||rect.height<.5)return;
    const holder=document.createElement('div');holder.className='gravity-piece';holder.style.width=`${rect.width}px`;holder.style.height=`${rect.height}px`;
    if(points)holder.style.clipPath=`polygon(${points.map(p=>`${p[0]}px ${p[1]}px`).join(',')})`;
    holder.append(content);overlay.append(holder);fragments.push({element:holder,kind,part,...makeDebris(rect,fragments.length,origin,viewport)});
  }
  function addElement(element,backgroundOnly=false){
    const bounds=visibleBounds(element,win);if(!bounds)return;
    const {raw,visible}=bounds,template=frozenClone(element,win,backgroundOnly),cols=Math.min(4,Math.max(1,Math.ceil(visible.width/135))),rows=Math.min(4,Math.max(1,Math.ceil(visible.height/100)));
    for(const polygon of rectangleTriangles(visible.width,visible.height,cols,rows)){
      const cell=boundsOf(polygon),clone=template.cloneNode(true),rect={left:visible.left+cell.left,top:visible.top+cell.top,width:cell.width,height:cell.height};
      Object.assign(clone.style,{position:'absolute',left:`${raw.left-rect.left}px`,top:`${raw.top-rect.top}px`,right:'auto',bottom:'auto',margin:'0',width:`${raw.width}px`,height:`${raw.height}px`,minWidth:'0',maxWidth:'none',transform:'none',transformOrigin:'center',visibility:'visible',opacity:'1'});
      addFragment(rect,clone,polygon.map(p=>[p[0]-cell.left,p[1]-cell.top]));
    }
  }
  function addWheelPolygon(points,excludePointer=false,kind='sector',part=0){
    if(!wheelCanvas?.width||!wheelCanvas?.height)return;
    const bounds=boundsOf(points),canvas=document.createElement('canvas'),ratio=Math.min(2,win.devicePixelRatio||1);
    canvas.width=Math.ceil(bounds.width*ratio);canvas.height=Math.ceil(bounds.height*ratio);const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.scale(ratio,ratio);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0]-bounds.left,p[1]-bounds.top):ctx.moveTo(p[0]-bounds.left,p[1]-bounds.top));ctx.closePath();ctx.clip();
    ctx.drawImage(wheelCanvas,0,0,wheelCanvas.width,wheelCanvas.height,-bounds.left,-bounds.top,wheelRect.width,wheelRect.height);
    if(excludePointer){
      ctx.globalCompositeOperation='destination-out';ctx.beginPath();
      POINTER_OUTLINE.forEach(([x,y],i)=>{const px=wheelRect.width/2+x*wheelRect.height/(2*WHEEL.half)-bounds.left,py=wheelRect.height/2-y*wheelRect.height/(2*WHEEL.half)-bounds.top;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});
      ctx.closePath();ctx.fill();ctx.globalCompositeOperation='source-over';
    }
    canvas.style.width=`${bounds.width}px`;canvas.style.height=`${bounds.height}px`;
    addFragment({left:wheelRect.left+bounds.left,top:wheelRect.top+bounds.top,width:bounds.width,height:bounds.height},canvas,null,kind,part);
  }
  // Capture everything before applying hidden/inert or re-rendering the live UI.
  const selectors=['.wordmark','.header-actions > button','.tabs > button','.wheel-question','#spin','.restaurant-chip','footer > span:not([hidden])','footer > button:not([hidden])','#global-error'];
  for(const selector of selectors)root.querySelectorAll(selector).forEach(element=>addElement(element));
  const detail=root.querySelector('#restaurant-detail');
  if(detail&&visibleBounds(detail,win)){
    addElement(detail,true);
    detail.querySelectorAll('.detail-topline,#detail-title,.rating-summary,.your-rating,.community-heading,.community-row,#toggle-community').forEach(element=>addElement(element));
  }
  try{
    const center=[wheelRect.width/2,wheelRect.height/2],scale=wheelRect.height/(2*WHEEL.half),count=Math.max(1,snacks.length),step=TAU/count;
    const annulus=(start,angle,inner,outer,arcs)=>{
      const points=[];
      for(let j=0;j<=arcs;j++){const a=start+angle*j/arcs;points.push([center[0]+Math.cos(a)*outer*scale,center[1]+Math.sin(a)*outer*scale])}
      for(let j=arcs;j>=0;j--){const a=start+angle*j/arcs;points.push([center[0]+Math.cos(a)*inner*scale,center[1]+Math.sin(a)*inner*scale])}
      return points;
    };
    for(let i=0;i<count;i++){
      const angle=rotation+i*step-Math.PI/2-step/2;
      addWheelPolygon(annulus(angle,step,WHEEL.hubRadius,WHEEL.segmentRadius,Math.max(6,Math.ceil(60/count))),true,'sector',i);
    }
    for(let i=0;i<WHEEL.bulbs;i++)addWheelPolygon(annulus(i*TAU/WHEEL.bulbs-Math.PI/2,TAU/WHEEL.bulbs,WHEEL.segmentRadius,WHEEL.frameRadius+.005,8),true,'rim',i);
    addWheelPolygon(POINTER_OUTLINE.map(([x,y])=>[center[0]+x*scale,center[1]-y*scale]),false,'pointer');
    addWheelPolygon(Array.from({length:40},(_,i)=>[center[0]+Math.cos(i*TAU/40)*WHEEL.hubRadius*scale,center[1]+Math.sin(i*TAU/40)*WHEEL.hubRadius*scale]),false,'hub');
  }catch{ /* Other page fragments still fall if a browser cannot copy its canvas. */ }
  const sectors=fragments.filter(fragment=>fragment.kind==='sector');
  const first=sectors.reduce((lowest,fragment)=>!lowest||fragment.startY>lowest.startY?fragment:lowest,null);
  if(first){
    first.release=.05;first.omega=.16;first.gravity=fallGravity(first,.54);
  }
  const oldInert=root.getAttribute('inert'),oldAria=root.getAttribute('aria-hidden'),hadClass=document.body.classList.contains('gravity-active');
  root.setAttribute('inert','');root.setAttribute('aria-hidden','true');document.body.append(overlay);document.body.classList.add('gravity-active');
  function frame(milliseconds,notify=true){
    if(restored)return;
    const elapsed=Math.max(previous*1000,clamp(milliseconds,0,COLLAPSE_DURATION)),seconds=elapsed/1000;
    for(const fragment of fragments){
      if(fragment.settled&&fragment.transform)continue;
      if(seconds<=fragment.release&&fragment.transform)continue;
      advanceDebris(fragment,previous,Math.max(previous,seconds),viewport);
      const transform=`translate3d(${fragment.x-fragment.width/2}px,${fragment.y-fragment.height/2}px,0) rotate(${fragment.angle}rad)`;
      if(transform!==fragment.transform){fragment.element.style.transform=transform;fragment.transform=transform}
    }
    const opacity=String(clamp((elapsed-100)/500,0,1));if(floor.style.opacity!==opacity)floor.style.opacity=opacity;
    previous=Math.max(previous,seconds);
    if(notify){
      const next=elapsed>=COLLAPSE_DURATION?'done':elapsed>=GROUP_DROP_AT?'collapse':elapsed>=FIRST_DROP_DURATION?'pause':'spoke';
      if(next!==phase){phase=next;try{onPhase(next)}catch{/* Missing sound must never interrupt the fall. */}}
    }
  }
  frame(0,false);
  return{duration:COLLAPSE_DURATION,count:fragments.length,element:overlay,frame,restore(){
    if(restored)return;restored=true;overlay.remove();if(!hadClass)document.body.classList.remove('gravity-active');
    if(oldInert===null)root.removeAttribute('inert');else root.setAttribute('inert',oldInert);
    if(oldAria===null)root.removeAttribute('aria-hidden');else root.setAttribute('aria-hidden',oldAria);
  }};
}
