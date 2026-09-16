import {pointerCrossings} from './motion.js';
import {WARP_DURATION} from './warp.js';
import {FIRST_DROP_DURATION,COLLAPSE_DURATION,GROUP_DROP_AT} from './gravity.js';
const FILES={click:'./assets/sounds/wheel-click.wav',horn:'./assets/sounds/party-horn.wav',spoke:'./assets/sounds/spoke-drop.wav',collapse:'./assets/sounds/collapse-fall.wav',warp:'./assets/sounds/warp.wav'};
export class WheelSound{
  constructor({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,fetcher=globalThis.fetch?.bind(globalThis),muted=false,clock=()=>performance.now()}={}){
    this.clock=clock;this.Context=AudioContext;this.muted=muted;this.context=null;this.buffers={};this.voices=new Set();this.visible=true;this.spin=null;this.clicksScheduled=false;
    // Fetch silently; AudioContext itself is only opened by a user gesture.
    this.files=AudioContext&&fetcher?Promise.all(Object.entries(FILES).map(async([name,url])=>{
      try{const response=await fetcher(url);if(!response.ok)return null;return[name,await response.arrayBuffer()]}catch{return null}
    })):Promise.resolve([]);
  }
  unlock(){
    if(!this.Context)return Promise.resolve();
    try{
      if(!this.context){
        this.context=new this.Context();this.master=this.context.createGain();this.master.gain.value=.65;this.master.connect(this.context.destination);
        this.files.then(files=>Promise.all(files.filter(Boolean).map(async([name,bytes])=>{try{this.buffers[name]=await this.context.decodeAudioData(bytes)}catch{}}))).catch(()=>{});
      }
      return this.context.state==='suspended'?Promise.resolve(this.context.resume()).catch(()=>{}):Promise.resolve();
    }catch{this.context=null;return Promise.resolve()}
  }
  setMuted(value){this.muted=!!value;if(this.muted)this.quiet();else this.unlock()}
  quiet(){this.stopVoices();this.clicksScheduled=false}
  setVisible(value){this.visible=!!value;if(!this.visible)this.quiet()}
  stopVoices(kind){
    for(const voice of [...this.voices])if(!kind||voice.kind===kind){try{voice.node.stop()}catch{}voice.gain.disconnect();this.voices.delete(voice)}
  }
  playBuffer(buffer,time,volume,kind,rate=1){
    const ctx=this.context;if(!ctx||!buffer||this.muted||!this.visible||ctx.state!=='running')return;
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);
    const voice={node:source,gain,kind};this.voices.add(voice);source.onended=()=>{gain.disconnect();this.voices.delete(voice)};source.start(time);
  }
  synth(kind,time,volume=1){
    const ctx=this.context;if(!ctx||this.muted||!this.visible||ctx.state!=='running')return;
    // Immediate fallback avoids a late result if a sound has not decoded yet.
    if(!this.synthetic)this.synthetic={};
    if(!this.synthetic[kind]){
      const length=kind==='click'?.028:kind==='horn'?.75:kind==='spoke'?FIRST_DROP_DURATION/1000:kind==='collapse'?(COLLAPSE_DURATION-GROUP_DROP_AT)/1000:kind==='warp'?WARP_DURATION/1000:.65,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),data=buffer.getChannelData(0);let phase=0,seed=41,low=0;
      for(let i=0;i<data.length;i++){
        const t=i/ctx.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
        const attack=Math.min(1,t/.003),release=Math.min(1,(length-t)/.035);
        if(kind==='warp'){const p=t/length,envelope=Math.sin(Math.PI*p)**1.5;low+=(.035+p*.18)*(noise-low);phase+=Math.PI*2*(44+95*p*p)/ctx.sampleRate;const arrival=Math.exp(-(((t-3.12)/.12)**2));data[i]=(low*.4+Math.sin(phase)*.07)*envelope+(low*.2+Math.sin(t*Math.PI*2*52)*.08)*arrival}
        else if(kind==='spoke'){low+=.15*(noise-low);const hit=Math.max(0,t-.54),impact=t>=.54?Math.exp(-hit*30):0;data[i]=(noise*.13*Math.exp(-t*65)+(Math.sin(hit*Math.PI*2*240)*.12+low*.10)*impact)*attack*release}
        else if(kind==='collapse'){low+=.065*(noise-low);const fall=Math.sin(Math.PI*t/length),impact=Math.exp(-(((t-.73)/.19)**2));data[i]=(low*(.2*fall+.6*impact)+Math.sin(t*Math.PI*2*68)*(.09*Math.exp(-t*18)+.18*impact))*attack*release}
        else if(kind==='horn'){const frequency=t<.12?196:t<.25?261.625:329.625;phase+=Math.PI*2*frequency/ctx.sampleRate;data[i]=(.30*Math.sin(phase)+.12*Math.sin(phase*2)+.06*Math.sin(phase*3))*attack*release}
        else if(kind==='click'){const onset=Math.min(1,t/.0004);data[i]=(Math.sin(t*2*Math.PI*1900)*.38+Math.sin(t*2*Math.PI*3270)*.20+noise*.12)*Math.exp(-t*260)*onset*release}
        else{low+=.08*(noise-low);data[i]=(low*.9+Math.sin(t*2*Math.PI*(70-t*45))*.22)*Math.exp(-t*6)*attack*release}
      }
      this.synthetic[kind]=buffer;
    }
    this.playBuffer(this.synthetic[kind],time,volume,kind);
  }
  startSpin({start,target,count,duration,startedAt=this.clock()}){
    this.quiet();this.spin={startedAt,crossings:pointerCrossings(start,target,count,duration)};
    this.updateSpin();
  }
  updateSpin(){
    const ctx=this.context;if(!this.spin||this.clicksScheduled||!ctx||this.muted||!this.visible||ctx.state!=='running')return;
    const elapsed=Math.max(0,this.clock()-this.spin.startedAt),audioNow=ctx.currentTime;
    // Each pin is scheduled once on the audio clock, using the wheel's exact trajectory.
    // After mute/backgrounding, discard past crossings instead of replaying a backlog.
    for(const crossing of this.spin.crossings){
      if(crossing.time<=elapsed)continue;
      const when=audioNow+(crossing.time-elapsed)/1000;
      if(this.buffers.click)this.playBuffer(this.buffers.click,when,.75,'click');else this.synth('click',when,.75);
    }
    this.clicksScheduled=true;
  }
  finishSpin(){this.spin=null;this.stopVoices('click');this.clicksScheduled=false;this.play('horn')}
  cancelSpin(){this.spin=null;this.quiet()}
  setCollapsePhase(phase){this.stopVoices('spoke');this.stopVoices('collapse');if(phase==='spoke'||phase==='collapse')this.play(phase)}
  play(kind){const ctx=this.context;if(!ctx)return;if(this.buffers[kind])this.playBuffer(this.buffers[kind],ctx.currentTime,.85,kind);else this.synth(kind,ctx.currentTime,.85)}
  dispose(){this.cancelSpin();this.context?.close()?.catch(()=>{})}
}
