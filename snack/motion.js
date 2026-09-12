// Shared easing keeps the visible wheel and the pointer-click schedule identical.
export const spinEase=progress=>1-(1-progress)**2;
export const inverseSpinEase=distance=>1-Math.sqrt(1-distance);
export function pointerCrossings(start,target,count,duration){
  if(!Number.isInteger(count)||count<1||!Number.isFinite(start)||!Number.isFinite(target)||target<=start||!Number.isFinite(duration)||duration<=0)return[];
  const step=Math.PI*2/count,crossings=[];
  // Sector zero starts centered under the pointer: pins are half a segment away.
  const first=Math.floor(start/step+.5+1e-10)+1,last=Math.floor(target/step+.5+1e-10);
  for(let pin=first;pin<=last;pin++){
    const angle=(pin-.5)*step,distance=Math.min(1,Math.max(0,(angle-start)/(target-start)));
    crossings.push({angle,time:inverseSpinEase(distance)*duration});
  }
  return crossings;
}
// The result callback runs only after the exact final angle has been rendered.
export function animateSpin({start,target,duration,onFrame,onStop,isCurrent=()=>true,now=()=>performance.now(),raf=requestAnimationFrame}){
  const began=now();
  return new Promise(resolve=>{
    function frame(time){
      if(!isCurrent()){resolve(null);return}
      const progress=duration>0?Math.max(0,Math.min(1,(time-began)/duration)):1;
      const angle=progress===1?target:start+(target-start)*spinEase(progress);
      onFrame(angle,progress);
      if(progress<1)raf(frame);else{onStop();resolve(target)}
    }
    raf(frame);
  });
}
export const GTA_URL='https://brandauer.group/gta';
export class HubEasterEgg{
  constructor({canTap=()=>true,wobble,explode,beforeLeave=async()=>true,transit=async()=>{},navigate=url=>location.assign(url),restore=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),delay=900}){
    Object.assign(this,{canTap,wobble,explode,beforeLeave,transit,navigate,restore,wait,delay});this.taps=0;this.busy=false;this.epoch=0;this.completion=Promise.resolve();
  }
  tap(){
    if(this.busy||!this.canTap())return false;
    this.taps++;
    if(this.taps<7){this.wobble(this.taps);return true}
    this.busy=true;this.completion=this.leave(++this.epoch);return true;
  }
  async leave(epoch){
    try{
      await this.explode();if(epoch!==this.epoch)return;
      await this.wait(this.delay);if(epoch!==this.epoch)return;
      const ready=await this.beforeLeave();if(epoch!==this.epoch)return;
      if(!ready){this.reset();return}
      await this.transit();if(epoch!==this.epoch)return;
      this.navigate(GTA_URL);
    }catch{if(epoch===this.epoch)this.reset()}
  }
  reset(){this.epoch++;this.taps=0;this.busy=false;this.restore()}
}
