export const WARP_DURATION=3800;
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x)};
const TAU=Math.PI*2;

export function createWarpTransit({document=globalThis.document,win=document.defaultView,reduced=false}={}){
  const canvas=document.createElement('canvas');canvas.id='warp-transit';canvas.setAttribute('aria-hidden','true');canvas.setAttribute('inert','');
  const ctx=canvas.getContext('2d');
  if(!ctx)return{duration:0,frame(){},play:async()=>true,restore(){}};
  let width=0,height=0,ratio=1,removed=false,animation=0,settle=null,promise=null;
  const duration=reduced?180:WARP_DURATION;
  let seed=78233;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const stars=Array.from({length:720},()=>{
    const a=random()*TAU,r=.07+Math.sqrt(random())*2.7;
    return{x:Math.cos(a)*r,y:Math.sin(a)*r,z:random()*4,weight:.25+random()*.75,tint:random()};
  });
  function resize(){
    width=Math.max(1,win.innerWidth);height=Math.max(1,win.innerHeight);ratio=Math.min(1.5,win.devicePixelRatio||1);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  function frame(milliseconds){
    if(removed)return;
    const p=clamp(milliseconds/duration);
    ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    if(reduced){ctx.fillStyle=`rgba(2,4,12,${smooth(0,1,p)})`;ctx.fillRect(0,0,width,height);return}
    const fade=smooth(0,.19,p),exit=smooth(.87,1,p),light=(1-exit)*fade;
    ctx.fillStyle=`rgba(2,5,15,${fade})`;ctx.fillRect(0,0,width,height);
    const cx=width*(.5+.006*Math.sin(p*2.3)),cy=height*(.47+.008*Math.sin(p*1.8)),span=Math.min(width,height),focal=span*.84;
    const acceleration=smooth(.14,.78,p),distance=.17*p+17*p*p*p;
    const atmosphere=ctx.createRadialGradient(cx,cy,0,cx,cy,span*.8);
    atmosphere.addColorStop(0,`rgba(38,95,151,${.40*light})`);atmosphere.addColorStop(.28,`rgba(25,51,103,${.20*light})`);atmosphere.addColorStop(1,'rgba(3,8,25,0)');
    ctx.fillStyle=atmosphere;ctx.fillRect(0,0,width,height);
    ctx.globalCompositeOperation='screen';ctx.lineCap='round';
    for(const star of stars){
      const z=((star.z-distance)%4+4)%4+.19,tail=z+.007+acceleration*acceleration*.9;
      const x=cx+star.x*focal/z,y=cy+star.y*focal/z,tx=cx+star.x*focal/tail,ty=cy+star.y*focal/tail;
      if((x<0&&tx<0)||(x>width&&tx>width)||(y<0&&ty<0)||(y>height&&ty>height))continue;
      const alpha=light*(.18+.8*star.weight)*smooth(4.19,3.4,z),lineWidth=(.55+star.weight*.95)*Math.min(1.8,1/z);
      const color=star.tint<.14?'141,192,255':star.tint>.94?'255,226,202':'219,238,255';
      const trail=ctx.createLinearGradient(tx,ty,x,y);trail.addColorStop(0,`rgba(${color},0)`);trail.addColorStop(.75,`rgba(${color},${alpha*.45})`);trail.addColorStop(1,`rgba(${color},${alpha})`);
      ctx.strokeStyle=trail;ctx.lineWidth=lineWidth;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();
      if(star.weight>.88){ctx.globalAlpha=.10*acceleration;ctx.lineWidth=lineWidth*7;ctx.stroke();ctx.globalAlpha=1}
      ctx.fillStyle=`rgba(${color},${alpha*.9})`;ctx.beginPath();ctx.arc(x,y,Math.max(.55,lineWidth*.55),0,TAU);ctx.fill();
    }
    // One continuous aperture expands past the camera; no cuts or flashing rings.
    const passage=smooth(.4,.95,p),radius=span*.028*Math.exp(passage*4.3),presence=smooth(.24,.48,p)*(1-smooth(.83,.95,p))*light;
    if(presence>.001){
      const halo=ctx.createRadialGradient(cx,cy,radius*.65,cx,cy,radius*1.32);
      halo.addColorStop(0,'rgba(60,121,207,0)');halo.addColorStop(.44,`rgba(63,153,224,${presence*.18})`);halo.addColorStop(.52,`rgba(174,221,255,${presence*.40})`);halo.addColorStop(.62,`rgba(99,152,234,${presence*.13})`);halo.addColorStop(1,'rgba(32,55,105,0)');
      ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
      ctx.save();ctx.translate(cx,cy);ctx.scale(1,.94);ctx.rotate(p*.12);
      ctx.strokeStyle=`rgba(181,227,255,${presence*.64})`;ctx.lineWidth=Math.max(.8,radius*.004);ctx.shadowColor='#88cfff';ctx.shadowBlur=12*ratio;
      ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke();ctx.restore();
    }
    const arrival=Math.exp(-(((p-.821)/.053)**2))*light;
    if(arrival>.001){
      const wash=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.hypot(width,height)*.65);
      wash.addColorStop(0,`rgba(202,231,255,${arrival*.19})`);wash.addColorStop(.45,`rgba(93,151,217,${arrival*.10})`);wash.addColorStop(1,'rgba(20,34,70,0)');ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
    }
    ctx.globalCompositeOperation='source-over';
    if(exit){ctx.fillStyle=`rgba(2,4,12,${exit})`;ctx.fillRect(0,0,width,height)}
  }
  resize();document.body.append(canvas);win.addEventListener('resize',resize);
  return{duration,frame,
    play({onStart=()=>{}}={}){
      if(removed)return Promise.resolve(false);if(promise)return promise;
      promise=new Promise(resolve=>{
        settle=resolve;let began=null;
        const draw=time=>{
          if(removed)return;
          try{
            const first=began===null;if(first)began=time;
            const elapsed=Math.min(duration,Math.max(0,time-began));frame(elapsed);
            if(first&&!reduced){try{onStart()}catch{/* Sound is optional; the passage still completes. */}}
            if(removed)return;
            if(elapsed<duration)animation=win.requestAnimationFrame(draw);else{settle=null;resolve(true)}
          }catch{this.restore()}
        };
        animation=win.requestAnimationFrame(draw);
      });return promise;
    },
    restore(){if(removed)return;removed=true;win.cancelAnimationFrame(animation);win.removeEventListener('resize',resize);canvas.remove();settle?.(false);settle=null}
  };
}
