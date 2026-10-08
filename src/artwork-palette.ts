/** Travel along the shorter hue arc with a smooth ease. */
export function hueAt(from: number, to: number, progress: number): number {
 const distance=((to-from+540)%360)-180,t=Math.min(1,Math.max(0,progress));
 return (from+distance*t*t*(3-2*t)+360)%360;
}
export const defaultPalette = ['#090e17','#214451','#10171e','#3d3530'];
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const hex=(channels:number[])=>'#'+channels.map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
/** Distinct, significant color clusters; single-color images use the house palette. */
export function artworkPalette(pixels: Uint8ClampedArray): string[] {
 const bins=new Map<number,{sum:number[];count:number}>();let total=0;
 for(let i=0;i<pixels.length;i+=4){
  if(pixels[i+3]<128)continue;
  const c=[pixels[i],pixels[i+1],pixels[i+2]];
  if(Math.max(...c)<24||Math.max(...c)-Math.min(...c)<20)continue;
  total++;const key=(c[0]>>6)*16+(c[1]>>6)*4+(c[2]>>6);
  const bin=bins.get(key)??{sum:[0,0,0],count:0};bin.count++;c.forEach((v,j)=>bin.sum[j]+=v);bins.set(key,bin);
 }
 const chosen:number[][]=[];
 for(const bin of [...bins.values()].sort((a,b)=>b.count-a.count)){
  if(bin.count<total*.05)continue;
  const c=bin.sum.map(v=>v/bin.count/255);
  if(chosen.every(other=>Math.hypot(...c.map((v,j)=>v/Math.max(...c)-other[j]/Math.max(...other)))>.35))chosen.push(c);
  if(chosen.length===3)break;
 }
 if(chosen.length<2)return [...defaultPalette];
 const dim=(c:number[],peak:number)=>hex(c.map(v=>v*peak/Math.max(...c)));
 return [dim(chosen[0],.09),dim(chosen[0],.3),dim(chosen[1],.24),dim(chosen[2]??chosen[1],.19)];
}
function hsl(c:number[]){
 const hi=Math.max(...c),lo=Math.min(...c),d=hi-lo,l=(hi+lo)/2;
 const h=d===0?0:((hi===c[0]?(c[1]-c[2])/d:hi===c[1]?(c[2]-c[0])/d+2:(c[0]-c[1])/d+4)*60+360)%360;
 return [h,d===0?0:d/(1-Math.abs(2*l-1)),l];
}
/** Short hue paths keep opposing colors from fading through a muddy RGB average. */
export function paletteAt(from:string[],to:string[],progress:number):string[]{
 const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t);
 if(t===0)return [...from];if(t===1)return [...to];
 return to.map((color,i)=>{
  const a=hsl(rgb(from[i])),b=hsl(rgb(color));
  if(a[1]<.01)a[0]=b[0];if(b[1]<.01)b[0]=a[0];
  const h=hueAt(a[0],b[0],t)/60,s=a[1]+(b[1]-a[1])*ease,l=a[2]+(b[2]-a[2])*ease;
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2;
  const channels=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return hex(channels.map(v=>v+m));
 });
}
