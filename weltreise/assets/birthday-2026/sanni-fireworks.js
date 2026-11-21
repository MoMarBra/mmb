/* Continuous coda for the portrait birthday film. No external assets. */
const TAU=Math.PI*2;
const colors=['239,193,125','250,157,183','138,194,255','255,230,176','167,140,241','237,218,185'];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=(a,b,t)=>{const v=clamp((t-a)/(b-a));return v*v*(3-2*v)};
function rng(s){return ()=>((s=Math.imul(1664525,s)+1013904223|0)>>>0)/4294967296}
export function startFireworks(canvas,{reduced=false,audio=null,startAt=20.42}={}){
 const W=720,H=1280;canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return ()=>{};
 const gradient=(x,y,r,stops)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [p,c]of stops)g.addColorStop(p,c);return g};
 const tick=performance.now();let raf=0,closed=false,lastPaint=-Infinity;
 let next=Math.ceil((startAt-5.47)/.73);
 const nodes=new Set();
 const send=(bang,wait)=>{
   if(!audio||audio.state!=='running')return;
   const rate=audio.sampleRate,len=Math.ceil(rate*.66),b=audio.createBuffer(2,len,rate),r=rng(17211+bang*673);
   for(let ch=0;ch<2;ch++){
     const d=b.getChannelData(ch);let low=0,prev=0;
     for(let i=0;i<len;i++){const t=i/rate,n=r()*2-1;low+=.06*(n-low);const rise=Math.min(1,t/.006); const env=Math.exp(-t*10.5)*rise;
       const boom=(Math.sin(TAU*(52+bang%7)*t)*.15+(low*.13+(n-prev)*.12)*Math.exp(-t*6))*env;
       const crack=(t>.09&&r()>.946?(n-prev)*.10*Math.exp(-t*4):0);prev=n;
       d[i]=(boom+crack)*(.90+.09*Math.sin(bang+ch*1.28));}
   }
   const src=audio.createBufferSource();src.buffer=b;src.connect(audio.destination);nodes.add(src);
   src.onended=()=>{nodes.delete(src);src.disconnect()};src.start(audio.currentTime+Math.max(0,wait));
 };
 const paint=now=>{
   if(closed)return;const t=startAt+(now-tick)/1000;
   while(5.47+next*.73<t+.085){const cue=5.47+next*.73;if(cue>=t-.085)send(next,cue-t);next++}
   if(now-lastPaint>(reduced?90:16)){
     lastPaint=now;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);sparkEvents(t);
   }
   raf=requestAnimationFrame(paint);
 };
function sparkEvents(t){
  if(t<5.00)return;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';
  const absolute=(t-5.0),n=Math.floor(absolute/.73);
  for(let i=Math.max(0,n-6);i<=n;i++){
    const R=rng(412971+i*9277),dt=absolute-i*.73,fx=(.08+.84*R())*W,fy=(.075+.36*R())*H,size=56+105*R(),rgb=colors[i%colors.length];
    const at=.47,life=dt-at;if(life<0){
      const p=dt/at,Y=H*.57-(H*.57-fy)*p;
      ctx.strokeStyle='rgba('+rgb+','+(.44+.25*p)+')';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(fx,Y+23);ctx.lineTo(fx,Y);ctx.stroke();continue;
    }
    if(life>3.3)continue;const a=(1-ease(.43,3.3,life))*ease(-.08,.12,life),rr=size*(1-Math.exp(-life*1.22));const count=i%4===0?130:95;
    if(life<.24){const g=gradient(fx,fy,15+life*38,[[0,'rgba(255,243,215,'+(a*.65)+')'],[1,'rgba('+rgb+',0)']]);ctx.fillStyle=g;ctx.fillRect(fx-28,fy-28,56,56);}
    for(let k=0;k<count;k++){const ang=(k+.5*R())/count*TAU,r=(.50+R()*.67)*rr,fall=10.67+22.67*R(),dx=Math.cos(ang),dy=Math.sin(ang);
      const XX=fx+dx*r,YY=fy+dy*r+life*life*fall*.48,l=(.05+R()*.14)*rr/(1+life*.63),tailX=XX-dx*l,tailY=YY-dy*l-life*fall*.085;
      const f=clamp(a*2.04*(.48+.52*R())*(.68+.32*Math.sin(i+k*4.1+life*16)**2));
      ctx.strokeStyle='rgba('+rgb+','+f+')';ctx.lineWidth=.70+R()*1.47;ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(XX,YY);ctx.stroke();if(k%2===0){ctx.lineWidth*=3.2;ctx.strokeStyle='rgba('+rgb+','+(f*.16)+')';ctx.stroke();}
      if(k%5===0){ctx.fillStyle='rgba(255,242,222,'+f+')';ctx.fillRect(XX-.90,YY-.90,1.8,1.8)}
    }
  }
  ctx.restore();
}

 paint(tick);
 return ()=>{closed=true;cancelAnimationFrame(raf);for(const s of nodes){try{s.stop()}catch{}s.disconnect()}nodes.clear();};
}
