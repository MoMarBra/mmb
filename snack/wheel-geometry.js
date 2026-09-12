// Shared dimensions keep the Blender asset, fallback clicks and falling fragments aligned.
export const WHEEL=Object.freeze({half:2.45,segmentRadius:1.83,innerRadius:.135,frameRadius:2.166,goldInner:1.98,bulbRadius:2.073,bulbs:20,hubRadius:.17,labelRadius:1.12,labelWidth:1.30});
export const POINTER_OUTLINE=Object.freeze([[0,1.67],[.105,1.88],[.134,1.96],...Array.from({length:17},(_,i)=>[.14*Math.cos(i*Math.PI/16),2.18+.14*Math.sin(i*Math.PI/16)]),[-.134,1.96],[-.105,1.88]]);
export function insidePointer(x,y){
  let inside=false;
  for(let i=0,j=POINTER_OUTLINE.length-1;i<POINTER_OUTLINE.length;j=i++){
    const [xi,yi]=POINTER_OUTLINE[i],[xj,yj]=POINTER_OUTLINE[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
