let animation=0;
export function celebrate(canvas,{reduced=false,color='#6aa5ff'}={}){
  cancelAnimationFrame(animation);const ctx=canvas.getContext('2d');if(!ctx)return;const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(reduced)return;
  const colors=['#6aa5ff','#ffd166','#ed9279','#82b1ff','#e6edff',color];
  const particles=Array.from({length:330},(_,i)=>{const side=i%2,angle=(side?Math.PI:0)+(Math.random()-.5)*1.3,speed=7+Math.random()*13;return{x:side?w+10:-10,y:h*(.22+Math.random()*.45),vx:Math.cos(angle)*speed,vy:-8-Math.random()*13,spin:(Math.random()-.5)*.24,rotation:Math.random()*Math.PI,w:5+Math.random()*7,h:4+Math.random()*8,color:colors[i%colors.length],drag:.988,delay:Math.random()*420}});
  const start=performance.now();let previous=start;
  function frame(t){const elapsed=t-start,dt=Math.min((t-previous)/16.667,2.5);previous=t;ctx.clearRect(0,0,w,h);for(const p of particles){if(elapsed<p.delay)continue;p.vx*=Math.pow(p.drag,dt);p.vy+=.17*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.globalAlpha=Math.min(1,Math.max(0,(4700-elapsed)/900));ctx.fillStyle=p.color;ctx.scale(1,Math.cos(p.rotation*.7));ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()}if(elapsed<4700)animation=requestAnimationFrame(frame);else ctx.clearRect(0,0,w,h)}animation=requestAnimationFrame(frame);
}
