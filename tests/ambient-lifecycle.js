import { Ambient } from '../src/ambient.ts';
import { VERSION } from '../src/version.ts';
const run=document.querySelector('#run'),result=document.querySelector('#result'),preview=document.querySelector('.preview');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const once=(target,type)=>new Promise((resolve,reject)=>{const expired=setTimeout(()=>{target.removeEventListener(type,received);reject(Error(type+' timed out'));},5000);function received(event){clearTimeout(expired);resolve(event);}target.addEventListener(type,received,{once:true});});
const colorURL=color=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${color}"/></svg>`);
run.onclick=async()=>{
 run.disabled=true;result.textContent='検証中';const canvas=document.createElement('canvas'),fallback=document.createElement('div');preview.replaceChildren(fallback,canvas);let ambient;
 try{
  ambient=new Ambient(canvas,fallback);ambient.setFlowSpeed(0);ambient.setActive(true);
  const gl=canvas.getContext('webgl'),extension=gl?.getExtension('WEBGL_lose_context');assert(gl&&extension,'WebGL recovery extension unavailable');
  const pixel=()=>{ambient.setActive(true);const value=new Uint8Array(4);gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,value);return [...value];};
  const baseline=pixel();
  const waitColor=async red=>{const deadline=performance.now()+5000;while(performance.now()<deadline){const value=pixel();if(red?value[0]>value[2]+10&&value[0]>value[1]+10:value[2]>value[0]+10&&value[2]>value[1]+10)return value;await delay(40);}throw Error('Latest artwork did not reach the restored GPU texture');};
  ambient.setArtwork(colorURL('#ff0000'));await waitColor(true);
  const pixels=[];
  for(let cycle=0;cycle<6;cycle++){
   const lost=once(canvas,'webglcontextlost');extension.loseContext();const event=await lost;assert(event.defaultPrevented&&canvas.hidden,'Lost context must stop and reveal the fallback');
   const red=!!(cycle%2);ambient.setArtwork(colorURL(red?'#ff0000':'#0000ff'));
   // Restoration is allowed after the browser finishes dispatching the lost event.
   await delay(100);
   const restored=once(canvas,'webglcontextrestored');extension.restoreContext();await restored;assert(!canvas.hidden,'Restored renderer must be visible');pixels.push(await waitColor(red));
   result.textContent=`${cycle+1}/6 recovered`;
  }
  ambient.setArtwork('');const neutral=pixel();assert(neutral.every((value,index)=>Math.abs(value-baseline[index])<=1),'Clearing artwork must restore the initial neutral texture');
  ambient.destroy();assert(gl.isContextLost(),'Destroy must release the owned context');
  result.textContent=JSON.stringify({version:VERSION,recoveredContexts:6,latestArtworkPixels:pixels,neutralBefore:baseline,neutralAfter:neutral,latestArtworkRestored:true,neutralTextureRestored:true,contextReleasedAfterDestroy:true},null,2);
 }catch(error){result.textContent='FAIL: '+(error.stack||error);}
 finally{ambient?.destroy();run.disabled=false;}
};
