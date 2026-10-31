import { Materials } from '../src/materials.ts';
import { Atmosphere } from '../src/atmosphere.ts';
import { SiteTheme } from '../src/site-theme.ts';
import { NativeTransport } from '../src/native-transport.ts';
import { SoundCloudAdapter } from '../src/adapter.ts';
import { defaultSettings } from '../src/types.ts';
import { VERSION } from '../src/version.ts';
const run=document.querySelector('#run'),result=document.querySelector('#result');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(test,message)=>{const deadline=performance.now()+10000;while(performance.now()<deadline){if(test())return;await delay(30);}throw Error(message);};
const once=(target,type)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{target.removeEventListener(type,listener);reject(Error(type+' timed out'));},10000);function listener(event){clearTimeout(timer);resolve(event);}target.addEventListener(type,listener,{once:true});});
run.onclick=async()=>{
 run.disabled=true;result.textContent='検証中';let materials,atmosphere,theme,transport,adapter;const allContexts=new Set(),verified=[];
 try{
  materials=new Materials(document.querySelector('#metal'),document.querySelector('#heat'));materials.setArtwork('fixture');materials.setActive(true);materials.setLevel(.3,.1);
  atmosphere=new Atmosphere(document.querySelector('#background'),document.querySelector('#console'),document.querySelector('#seek'));atmosphere.setActive(true);atmosphere.setLevel(.3,.1);
  theme=new SiteTheme();theme.setPreferences({...defaultSettings,modernSoundCloud:true,siteArtwork:false});theme.setEnabled(true);
  adapter=new SoundCloudAdapter();transport=new NativeTransport(adapter,()=>{},()=>{});transport.setEnabled(true);
  const groups=[['cover metal','#metal',1],['cover heat','#heat',2],['player background','#background',1],['console smoke','#console',1],['player seek','#seek',1],['native metal','[data-soundsky-metal]',1],['native seek','[data-soundsky-seek]',1],['site background','[data-soundsky-site-shader]',1]];
  const canvases=selector=>[...document.querySelector(selector)?.querySelectorAll('canvas')||[]];
  const ready=selector=>canvases(selector).every(canvas=>canvas.width>1&&canvas.height>1&&canvas.parentElement.paperShaderMount);
  const collect=()=>{for(const canvas of document.querySelectorAll('canvas')){const context=canvas.getContext('webgl2');if(context)allContexts.add(context);}};
  const playing=value=>{materials.setPlaying(value);atmosphere.setPlaying(value);const play=document.querySelector('.playControl');play.classList.toggle('playing',value);play.title=value?'Pause current':'Play current';transport.sync(adapter.read());};
  playing(true);await wait(()=>document.querySelectorAll('canvas').length===9&&groups.every(([,selector,count])=>canvases(selector).length===count&&ready(selector)),'All nine production shaders must initialize');collect();
  for(const [name,selector,count]of groups){
   playing(true);await delay(120);
   const old=canvases(selector),extensions=old.map(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context'));assert(extensions.every(Boolean),'GPU loss extension unavailable');
   const lost=old.map(canvas=>once(canvas,'webglcontextlost'));extensions.forEach(extension=>extension.loseContext());const events=await Promise.all(lost);assert(events.every(event=>event.defaultPrevented),name+': loss must be handled');
   playing(false);if(name==='site background')theme.setPalette(['#ff0000','#ff0000','#ff0000','#ff0000']);
   const lostPhases=old.map(canvas=>canvas.parentElement.paperShaderMount.getCurrentFrame());
   await delay(100);assert(old.every((canvas,index)=>canvas.parentElement.paperShaderMount.getCurrentFrame()===lostPhases[index]),name+': lost surface animation did not stop; before='+lostPhases+' after='+old.map(canvas=>canvas.parentElement.paperShaderMount.getCurrentFrame()));
   const restored=old.map(canvas=>once(canvas,'webglcontextrestored'));extensions.forEach(extension=>extension.restoreContext());await Promise.all(restored);
   await wait(()=>canvases(selector).length===count&&canvases(selector).every(canvas=>!old.includes(canvas))&&ready(selector),name+': old GPU resources were not recreated');collect();
   const current=canvases(selector),phases=[];
   for(const canvas of current){
    const mount=canvas.parentElement.paperShaderMount;mount.setFrame(mount.getCurrentFrame());const gl=canvas.getContext('webgl2'),pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    assert(gl.getError()===gl.NO_ERROR,name+': GL error after recovery');assert(pixels.some((value,index)=>index%4!==3&&value>0),name+': restored shader has no RGB output');
    if(name==='site background'){const index=(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4;assert(pixels[index]>pixels[index+2]+30,'Latest site palette must survive context loss');}
    phases.push(mount.getCurrentFrame());
   }
   await delay(120);
   if(name!=='site background')for(let i=0;i<current.length;i++)assert(current[i].parentElement.paperShaderMount.getCurrentFrame()===phases[i],name+': paused state was lost during recovery');
   assert([...allContexts].filter(context=>!context.isContextLost()).length===9,name+': retired contexts retained');verified.push(name);result.textContent=`${verified.length}/8 surfaces recovered`;
  }
  const state=adapter.read();assert(!state.playing&&state.current===34&&state.volume===.4,'GPU recovery must preserve native transport state');
  transport.destroy();transport=null;theme.destroy();theme=null;materials.destroy();materials=null;atmosphere.destroy();atmosphere=null;adapter.destroy();adapter=null;
  assert([...allContexts].every(context=>context.isContextLost()),'Destroy retained an owned GPU context');
  result.textContent=JSON.stringify({version:VERSION,recoveredSurfaces:verified,recoveredCanvases:9,pausedStatePreserved:true,latestPalettePreserved:true,nativeTransportPreserved:true,totalContextsObserved:allContexts.size,liveContextsAfterDestroy:0},null,2);
 }catch(error){result.textContent='FAIL: '+(error.stack||error);}
 finally{transport?.destroy();theme?.destroy();materials?.destroy();atmosphere?.destroy();adapter?.destroy();run.disabled=false;}
};
