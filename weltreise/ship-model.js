/* Small procedural 3D mesh, no library, texture download or animation loop.
 * WebGL uses real XYZ vertices, perspective and a depth buffer. The SVG fallback
 * projects and depth-sorts the same faces, and also supplies the route marker. */
const WHITE=[.96,.98,1],BLUE=[.04,.35,.57],DECK=[.70,.82,.85],YELLOW=[1,.74,.12],RED=[.90,.16,.22];
const faces=[];
const add=(points,color)=>faces.push({points,color});
function extrude(outline,bottom,top,color,bottomScale=1){
 const low=outline.map(([x,y])=>[x*bottomScale,y*bottomScale,bottom]);
 const high=outline.map(([x,y])=>[x,y,top]);
 add(high,color);add([...low].reverse(),color);
 outline.forEach((_,i)=>{const j=(i+1)%outline.length;add([low[i],low[j],high[j],high[i]],color);});
}
function box(x,y,z,l,w,h,color){extrude([[x-l/2,y-w/2],[x+l/2,y-w/2],[x+l/2,y+w/2],[x-l/2,y+w/2]],z,z+h,color);}
const hull=[[-2.02,-.34],[1.22,-.42],[1.79,-.29],[2.20,0],[1.79,.29],[1.22,.42],[-2.02,.34],[-2.14,.19],[-2.14,-.19]];
extrude(hull,-.18,.14,WHITE,.84);
extrude(hull,.14,.20,BLUE);
extrude(hull,.20,.31,WHITE);
box(-.17,0,.31,3.34,.71,.14,DECK);
for(let floor=0;floor<3;floor++){
 const z=.43+floor*.13,length=2.98-floor*.22;
 box(-.2,0,z,length,.64-floor*.035,.10,WHITE);
 box(-.2,0,z+.04,length+.015,.65-floor*.035,.037,BLUE);
 box(-.2,0,z+.10,length+.06,.67-floor*.035,.024,WHITE);
}
box(.91,0,.70,.46,.76,.10,WHITE); // bridge wings
box(.94,0,.77,.41,.73,.045,BLUE);
box(-.67,0,.86,.47,.30,.27,YELLOW);
box(-.67,0,1.13,.49,.32,.04,BLUE);
box(.42,0,.86,.028,.028,.31,WHITE); // mast
box(.42,0,1.08,.025,.26,.025,WHITE);
box(-1.16,0,.83,.40,.22,.025,[.12,.72,.84]); // pool
for(const side of [-1,1])for(let i=0;i<5;i++)box(-1.28+i*.44,side*.375,.34,.28,.115,.105,YELLOW); // lifeboats
// Discreet red bow detail on both sides of the stylized ship.
for(const side of [-1,1])add([[1.67,side*.32,.21],[1.93,side*.18,.21],[1.82,side*.255,.27]],RED);
export const shipMesh=faces;
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function shaded(face){
 const n=cross(subtract(face.points[1],face.points[0]),subtract(face.points[2],face.points[0])),len=Math.hypot(...n)||1;
 const light=.70+.30*Math.max(0,(-.30*n[0]-.40*n[1]+.86*n[2])/len);
 return face.color.map(v=>Math.min(1,v*light));
}
export function projectVertex([x,y,z],yaw=-.45,pitch=.55,aspect=2){
 const u=x*Math.cos(yaw)-y*Math.sin(yaw),v=x*Math.sin(yaw)+y*Math.cos(yaw),h=z-.40;
 const depth=v*Math.cos(pitch)+h*Math.sin(pitch),w=7-depth;
 return [u*2.75/w,(h*Math.cos(pitch)-v*Math.sin(pitch))*2.75*aspect/w,depth];
}
export function fitScale(yaw=-.45,pitch=.55,aspect=2){
 let extent=0;for(const face of faces)for(const vertex of face.points){const p=projectVertex(vertex,yaw,pitch,aspect);extent=Math.max(extent,Math.abs(p[0]),Math.abs(p[1]));}
 return Math.min(1,.91/extent);
}
export function projectedFaces(yaw=-.45,pitch=.55,aspect=2){
 const zoom=fitScale(yaw,pitch,aspect);
 return faces.map(face=>({points:face.points.map(p=>{const v=projectVertex(p,yaw,pitch,aspect);return [v[0]*zoom,v[1]*zoom,v[2]];}),color:shaded(face)}))
 .sort((a,b)=>a.points.reduce((s,p)=>s+p[2],0)/a.points.length-b.points.reduce((s,p)=>s+p[2],0)/b.points.length);
}
export function drawShipSvg(target,{yaw=-.45,pitch=.55,aspect=2}={}){
 const doc=target.ownerDocument,ns='http://www.w3.org/2000/svg';
 const nodes=projectedFaces(yaw,pitch,aspect).map(face=>{
  const polygon=doc.createElementNS(ns,'polygon');
  polygon.setAttribute('points',face.points.map(p=>`${(p[0]*50).toFixed(2)},${(-p[1]*50).toFixed(2)}`).join(' '));
  const color=`rgb(${face.color.map(v=>Math.round(v*255)).join(',')})`;
  polygon.setAttribute('fill',color);polygon.setAttribute('stroke',color);polygon.setAttribute('stroke-width','.18');return polygon;
 });
 target.replaceChildren(...nodes);
}
export function createShipModel(canvas,fallback){
 let yaw=-.45,gl=null,program=null,buffer=null,count=0;
 function init(){
  try{
   gl=canvas.getContext?.('webgl',{alpha:true,antialias:true,depth:true,powerPreference:'low-power',preserveDrawingBuffer:false});
   if(!gl)return false;
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Ship shader');return shader;};
   const vert=compile(gl.VERTEX_SHADER,`attribute vec3 position; attribute vec3 color; varying vec3 tint; uniform float yaw; uniform float zoom; void main(){float c=cos(yaw),s=sin(yaw);float x=position.x*c-position.y*s,y=position.x*s+position.y*c,z=position.z-.40;float depth=y*cos(.55)+z*sin(.55);gl_Position=vec4(x*2.75*zoom,(z*cos(.55)-y*sin(.55))*5.5*zoom,-depth/8.,7.-depth);tint=color;}`);
   const frag=compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 tint; void main(){gl_FragColor=vec4(tint,1.);}');
   program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Ship program');
   const vertices=[];for(const face of faces){const color=shaded(face);for(let i=1;i<face.points.length-1;i++)for(const p of [face.points[0],face.points[i],face.points[i+1]])vertices.push(...p,...color);}
   count=vertices.length/6;buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
   gl.useProgram(program);for(const [name,offset]of [['position',0],['color',12]]){const index=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,3,gl.FLOAT,false,24,offset);}
   gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);return true;
  }catch{gl=null;return false;}
 }
 function draw(){
  if(gl&&!gl.isContextLost()){
   // Fixed small backing buffer is enough even on a high-DPI phone.
   canvas.width=320;canvas.height=160;gl.viewport(0,0,320,160);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.uniform1f(gl.getUniformLocation(program,'yaw'),yaw);gl.uniform1f(gl.getUniformLocation(program,'zoom'),fitScale(yaw));gl.drawArrays(gl.TRIANGLES,0,count);
   canvas.hidden=false;fallback.style.display='none';canvas.dataset.renderer='webgl';
  }else{canvas.hidden=true;fallback.style.display='block';drawShipSvg(fallback,{yaw});canvas.dataset.renderer='svg-3d';}
 }
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();gl=null;draw();});
 canvas.addEventListener('webglcontextrestored',()=>{init();draw();});
 init();draw();
 return {rotate(){yaw+=Math.PI/4;draw();},getYaw:()=>yaw};
}
