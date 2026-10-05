/* Screen-sized harbor labels: more fit as the map is zoomed, never a wall of text. */
const landmarks=new Set(['hamburg-start','rio-de-janeiro','san-antonio','easter-island','suva','sydney','port-louis','cape-town']);
const shortNames={'fremantle':'Perth · Fremantle','east-london':'East London','gqeberha':'Port Elizabeth'};
const cached=new WeakMap();
const overlaps=(a,b)=>a.x<b.x+b.width+5&&a.x+a.width+5>b.x&&a.y<b.y+b.height+4&&a.y+a.height+4>b.y;
export function layoutPortLabels(ports,project,center,scale,rect,state){
 const unit=Math.min(rect.width/1000,rect.height/500),factor=unit*scale;
 if(!(factor>0))return [];
 const active=state.port?.id,next=state.nextPort?.id;
 const priority=p=>p.id===active?0:p.id===next?1:landmarks.has(p.id)?2:3;
 const unique=new Map();for(const p of ports){const key=p.name;if(!unique.has(key)||priority(p)<priority(unique.get(key)))unique.set(key,p);}
 const candidates=[...unique.values()].sort((a,b)=>priority(a)-priority(b)||a.index-b.index);
 const placed=[];
 for(const port of candidates){
  const [x,y]=project(port.coord),sx=rect.width/2+(x-center[0])*factor,sy=rect.height/2+(y-center[1])*factor;
  if(sx<0||sx>rect.width||sy<0||sy>rect.height)continue;
  const name=shortNames[port.id]??port.name,font=scale>2?9.5:8.5,width=name.length*font*.58+4,height=font+3;
  const offsets=[[7,-height-3],[7,5],[-width-7,-height-3],[-width-7,5]];
  // Map controls occupy the lower corners. Avoid text underneath them.
  const occupied=[{x:0,y:rect.height-62,width:61,height:62},{x:rect.width-60,y:rect.height-105,width:60,height:105},...placed.map(p=>p.box)];
  for(const [dx,dy]of offsets){const box={x:sx+dx,y:sy+dy,width,height};
   if(box.x<4||box.y<4||box.x+width>rect.width-4||box.y+height>rect.height-15||occupied.some(b=>overlaps(box,b)))continue;
   placed.push({port,name,x:x+dx/factor,y:y+(dy+font)/factor,fontSize:font/factor,box,active:port.id===active||port.id===next});break;
  }
 }
 return placed;
}
export function renderPortLabels(group,ports,project,center,scale,rect,state){
 const key=[center[0],center[1],scale,rect.width,rect.height,state.port?.id,state.nextPort?.id].join('|');
 if(cached.get(group)===key)return;cached.set(group,key);
 const doc=group.ownerDocument;
 const nodes=layoutPortLabels(ports,project,center,scale,rect,state).map(label=>{
  const text=doc.createElementNS('http://www.w3.org/2000/svg','text');text.textContent=label.name;
  for(const [name,value]of Object.entries({x:label.x,y:label.y,'font-size':label.fontSize,class:'port-label'+(label.active?' active':'')}))text.setAttribute(name,value);
  return text;
 });
 group.replaceChildren(...nodes);
}
