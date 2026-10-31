import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const compiled=await build({entryPoints:['src/ambient.ts'],bundle:true,write:false,format:'iife',globalName:'AmbientTest',footer:{js:'window.AmbientTest=AmbientTest;'}});
function setup(t,failAt){
 const dom=new JSDOM('<canvas></canvas><div></div>',{url:'https://soundcloud.com',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const canvas=w.document.querySelector('canvas'),fallback=w.document.querySelector('div'),live={shader:new Set(),program:new Set(),buffer:new Set(),texture:new Set()},timers=new Map(),frames=new Map(),images=[],uploads=[];let id=0,draws=0;
 const allocate=kind=>{const handle={kind,id:++id};live[kind].add(handle);return handle;};
 const gl=new Proxy({
  createShader:()=>allocate('shader'),createProgram:()=>allocate('program'),createBuffer:()=>allocate('buffer'),createTexture:()=>allocate('texture'),
  deleteShader:handle=>live.shader.delete(handle),deleteProgram:handle=>live.program.delete(handle),deleteBuffer:handle=>live.buffer.delete(handle),deleteTexture:handle=>live.texture.delete(handle),
  getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({}),getExtension:()=>null,
  bufferData(){if(failAt==='buffer')throw Error('GPU allocation failed');},
  texImage2D(...args){uploads.push(args.at(-1));},drawArrays(){draws++;},
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 w.HTMLCanvasElement.prototype.getContext=function(kind){if(kind==='webgl'){if(failAt==='context')throw Error('Context unavailable');return gl;}return {drawImage:image=>{this.image=image.src;}};};
 canvas.getBoundingClientRect=()=>({width:1280,height:720});
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};
 w.setTimeout=fn=>{const handle=++id;timers.set(handle,fn);return handle;};w.clearTimeout=handle=>timers.delete(handle);w.requestAnimationFrame=fn=>{const handle=++id;frames.set(handle,fn);return handle;};w.cancelAnimationFrame=handle=>frames.delete(handle);
 w.Image=class{constructor(){images.push(this);}};
 w.eval(compiled.outputFiles[0].text);const ambient=new w.AmbientTest.Ambient(canvas,fallback);t.after(()=>{ambient.destroy();w.close();});
 return {w,canvas,fallback,ambient,live,timers,frames,images,uploads,draws:()=>draws,lose(){for(const handles of Object.values(live))handles.clear();const event=new w.Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);assert.equal(event.defaultPrevented,true);},restore(){canvas.dispatchEvent(new w.Event('webglcontextrestored'));}};
}
test('restored WebGL recreates resources and uploads the latest artwork without accepting old image callbacks',t=>{
 const h=setup(t);h.ambient.setActive(true);h.ambient.setArtwork('https://i1.sndcdn.com/old.jpg');const stale=h.images[0];
 h.lose();assert.equal(h.canvas.hidden,true);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
 h.ambient.setArtwork('https://i1.sndcdn.com/latest.jpg');h.restore();assert.equal(h.canvas.hidden,false);assert.equal(h.live.program.size,1);assert.equal(h.live.texture.size,1);assert.equal(h.live.buffer.size,1);
 const current=h.images.at(-1);assert.equal(current.src,'https://i1.sndcdn.com/latest.jpg');current.onload();assert.equal(h.uploads.at(-1).image,current.src);
 const count=h.uploads.length;stale.onload();assert.equal(h.uploads.length,count);assert.equal(h.timers.size,1);
});
test('removing artwork restores the neutral texture instead of retaining the previous cover',t=>{
 const h=setup(t);h.ambient.setArtwork('https://i1.sndcdn.com/old.jpg');h.images.at(-1).onload();const cover=h.uploads.at(-1);
 h.ambient.setArtwork('');assert.notEqual(h.uploads.at(-1),cover);assert.equal(h.uploads.at(-1).length,16);assert.equal(h.fallback.style.backgroundImage,'');
});
test('partial initialization failures release allocated GPU resources and keep the fallback available',t=>{
 const h=setup(t,'buffer');assert.equal(h.canvas.hidden,true);for(const handles of Object.values(h.live))assert.equal(handles.size,0);
});
test('restoring an inactive renderer stays stopped and destruction prevents later recovery',t=>{
 const h=setup(t);h.ambient.setArtwork('https://i1.sndcdn.com/current.jpg');h.lose();h.restore();assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
 const image=h.images.at(-1),before=h.uploads.length;h.ambient.destroy();h.restore();image.onload();assert.equal(h.uploads.length,before);
 for(const handles of Object.values(h.live))assert.equal(handles.size,0);
});
test('repeated context recovery retains one live resource set and one animation timer',t=>{
 const h=setup(t);h.ambient.setActive(true);
 for(let cycle=0;cycle<250;cycle++){
  h.lose();h.restore();assert.equal(h.live.program.size,1);assert.equal(h.live.buffer.size,1);assert.equal(h.live.texture.size,1);assert.equal(h.live.shader.size,0);assert.equal(h.timers.size,1);
 }
 h.ambient.destroy();assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);for(const handles of Object.values(h.live))assert.equal(handles.size,0);
});
test('WebGL context creation exceptions leave the CSS fallback usable',t=>{
 const h=setup(t,'context');h.ambient.setArtwork('https://i1.sndcdn.com/current.jpg');h.ambient.setActive(true);
 assert.equal(h.canvas.hidden,true);assert.match(h.fallback.style.backgroundImage,/current\.jpg/);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});
test('failed artwork loads discard the previous GPU image without accepting stale failures',t=>{
 const h=setup(t);h.ambient.setArtwork('https://i1.sndcdn.com/old.jpg');const old=h.images.at(-1);old.onload();h.ambient.setArtwork('https://i1.sndcdn.com/current.jpg');h.images.at(-1).onerror();
 assert.equal(h.uploads.at(-1).length,16);const count=h.uploads.length;old.onerror();assert.equal(h.uploads.length,count);
});
