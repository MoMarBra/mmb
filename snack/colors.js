// A gentle enamel finish derived from each stored code; database values stay untouched.
const FALLBACK='#6aa5ff',cache=new Map(),INK='#060606',WHITE='#ffffff';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const luminance=hex=>rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);

export function snackColor(snack){
  let hex=typeof snack?.color==='string'?snack.color.trim().toLowerCase():'';
  if(!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(hex))hex=FALLBACK;
  if(hex.length===4)hex='#'+[...hex.slice(1)].map(c=>c+c).join('');
  if(cache.has(hex))return cache.get(hex);
  const [r,g,b]=rgb(hex),high=Math.max(r,g,b),low=Math.min(r,g,b),delta=high-low,sourceLight=(high+low)/2;
  let hue=0,saturation=0;
  if(delta){
    saturation=delta/(1-Math.abs(2*sourceLight-1));
    hue=(high===r?(g-b)/delta+(g<b?6:0):high===g?(b-r)/delta+2:(r-g)/delta+4)/6;
  }
  // Keep the original hue and most saturation; gently bring extremes into one finish.
  const light=clamp(.5+(sourceLight-.5)*.78,.34,.78),sat=Math.min(.88,saturation*.94);
  const chroma=(1-Math.abs(2*light-1))*sat,x=chroma*(1-Math.abs((hue*6)%2-1)),m=light-chroma/2;
  const channels=[[chroma,x,0],[x,chroma,0],[0,chroma,x],[0,x,chroma],[x,0,chroma],[chroma,0,x]][Math.min(5,Math.floor(hue*6))];
  const color='#'+channels.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
  cache.set(hex,color);return color;
}

export function snackLabelColor(snack){
  const light=luminance(snackColor(snack));
  return(light+.05)/(luminance(INK)+.05)>=1.05/(light+.05)?INK:WHITE;
}
