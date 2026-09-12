import {snackColor,snackLabelColor} from './colors.js';
import {WHEEL,POINTER_OUTLINE,insidePointer} from './wheel-geometry.js';
const SIZE=1000,CENTER=500,SCALE=SIZE/(2*WHEEL.half),RADIUS=WHEEL.segmentRadius*SCALE,TAU=Math.PI*2;
const circle=(ctx,r)=>{ctx.beginPath();ctx.arc(0,0,r,0,TAU)};
function drawFrame(ctx){
  const outer=WHEEL.frameRadius*SCALE,inner=WHEEL.goldInner*SCALE;
  const gold=ctx.createLinearGradient(-outer,-outer,outer,outer);gold.addColorStop(0,'#fff0ad');gold.addColorStop(.24,'#f4c747');gold.addColorStop(.54,'#b78324');gold.addColorStop(.77,'#ffdb70');gold.addColorStop(1,'#c99a36');
  ctx.fillStyle=gold;ctx.beginPath();ctx.arc(0,0,outer,0,TAU);ctx.arc(0,0,inner,0,TAU,true);ctx.fill();
  const burgundy=ctx.createLinearGradient(0,-outer,0,outer);burgundy.addColorStop(0,'#8b2940');burgundy.addColorStop(.5,'#501627');burgundy.addColorStop(1,'#702136');
  ctx.fillStyle=burgundy;ctx.beginPath();ctx.arc(0,0,inner+1,0,TAU);ctx.arc(0,0,RADIUS,0,TAU,true);ctx.fill();
  for(const [r,width,color] of [[outer-1,2,'#ffe59d'],[inner,2,'#e6b84f'],[RADIUS,3,'#fff0b0']]){circle(ctx,r);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke()}
  for(let i=0;i<WHEEL.bulbs;i++){
    const a=Math.PI/2-(i+.5)*TAU/WHEEL.bulbs;ctx.save();ctx.translate(Math.cos(a)*WHEEL.bulbRadius*SCALE,-Math.sin(a)*WHEEL.bulbRadius*SCALE);
    const glow=ctx.createRadialGradient(0,0,0,0,0,16);glow.addColorStop(0,'#fff9df99');glow.addColorStop(1,'#fff9df00');ctx.fillStyle=glow;circle(ctx,16);ctx.fill();
    ctx.fillStyle='#c38f32';circle(ctx,10);ctx.fill();ctx.fillStyle='#fff9e6';circle(ctx,.038*SCALE);ctx.fill();ctx.restore();
  }
}
function drawHub(ctx){
  const r=WHEEL.hubRadius*SCALE,gold=ctx.createLinearGradient(-r,-r,r,r);gold.addColorStop(0,'#fff0af');gold.addColorStop(.5,'#e6b640');gold.addColorStop(1,'#9d6c1e');
  ctx.fillStyle=gold;circle(ctx,r);ctx.fill();ctx.fillStyle='#fff0bf';circle(ctx,r*.68);ctx.fill();ctx.fillStyle='#ba242b';circle(ctx,.074*SCALE);ctx.fill();
}
function drawPointer(ctx){
  ctx.save();ctx.shadowColor='#0006';ctx.shadowBlur=10;ctx.shadowOffsetY=5;
  ctx.beginPath();POINTER_OUTLINE.forEach(([x,y],i)=>i?ctx.lineTo(x*SCALE,-y*SCALE):ctx.moveTo(x*SCALE,-y*SCALE));ctx.closePath();
  const red=ctx.createLinearGradient(-.14*SCALE,-2.32*SCALE,.14*SCALE,-1.67*SCALE);red.addColorStop(0,'#ff7771');red.addColorStop(.35,'#ec3546');red.addColorStop(1,'#b3122b');ctx.fillStyle=red;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineWidth=2;ctx.strokeStyle='#ff9b8299';ctx.stroke();
  ctx.translate(0,-2.15*SCALE);const glow=ctx.createRadialGradient(0,0,0,0,0,20);glow.addColorStop(0,'#fff8eccc');glow.addColorStop(1,'#fff8ec00');ctx.fillStyle=glow;circle(ctx,20);ctx.fill();ctx.fillStyle='#fff9e9';circle(ctx,.05*SCALE);ctx.fill();ctx.restore();
}
export function drawFallback(canvas,snacks,rotation=0,selectedId=null,explosion=0){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  canvas.width=SIZE;canvas.height=SIZE;ctx.clearRect(0,0,SIZE,SIZE);
  ctx.save();ctx.translate(CENTER,CENTER);ctx.globalAlpha=Math.max(0,1-explosion);
  ctx.shadowColor='#0005';ctx.shadowBlur=28;ctx.shadowOffsetY=10;
  if(!explosion){ctx.fillStyle='#371525';circle(ctx,WHEEL.frameRadius*SCALE);ctx.fill()}
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const step=Math.PI*2/Math.max(snacks.length,1);
  snacks.forEach((snack,index)=>{
    const angle=rotation+index*step-Math.PI/2-step/2,color=snackColor(snack);
    ctx.save();if(explosion){const spread=1-(1-explosion)**2;ctx.translate(Math.cos(angle+step/2)*RADIUS*spread*1.8,Math.sin(angle+step/2)*RADIUS*spread*1.8);ctx.scale(1-spread*.25,1-spread*.25)}
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,RADIUS,angle+.0015,angle+step-.0015);ctx.closePath();ctx.fillStyle=color;ctx.fill();
    if(snack.id===selectedId){ctx.fillStyle='#ffffff20';ctx.fill()}
    ctx.save();ctx.rotate(angle+step/2);ctx.font='600 33px -apple-system, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=snackLabelColor(snack);
    const labelWidth=WHEEL.labelWidth*SCALE*.94;
    const lines=[''];for(const word of snack.name.trim().split(/\s+/)){const n=lines.length-1;if(ctx.measureText((lines[n]+' '+word).trim()).width>labelWidth&&lines[n])lines.push(word);else lines[n]=(lines[n]+' '+word).trim()}
    if(lines.length>3)lines.splice(2,lines.length-2,lines.slice(2).join(' '));
    lines.forEach((line,i)=>ctx.fillText(line,WHEEL.labelRadius*SCALE,(i-(lines.length-1)/2)*34,labelWidth));ctx.restore();ctx.restore();
  });
  if(!explosion){drawFrame(ctx);drawHub(ctx);drawPointer(ctx)}ctx.restore();
}
export function fallbackPick(canvas,event,snacks,rotation){
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height||!snacks.length)return null;
  const x=(event.clientX-rect.left)/rect.width*SIZE-CENTER,y=(event.clientY-rect.top)/rect.height*SIZE-CENTER,radius=Math.hypot(x,y);
  if(radius<WHEEL.hubRadius*SCALE||radius>RADIUS||insidePointer(x/SCALE,-y/SCALE))return null;
  const angle=((Math.atan2(y,x)+Math.PI/2-rotation+Math.PI/snacks.length)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
  return snacks[Math.floor(angle/(Math.PI*2/snacks.length))]?.id??null;
}
