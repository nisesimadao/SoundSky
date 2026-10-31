import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import {act,createElement,useLayoutEffect,useRef} from 'react';
await build({entryPoints:['src/shader-lifecycle.ts'],outfile:'artifacts/shader-lifecycle-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const lifecycle=await import(pathToFileURL(`${process.cwd()}/artifacts/shader-lifecycle-test.mjs`));
function setup(t){
 const dom=new JSDOM('<div id="surface"></div>',{url:'https://soundcloud.com',pretendToBeVisual:true});
 const w=dom.window;for(const name of ['window','document','Element','HTMLElement','HTMLCanvasElement','Node','MutationObserver'])globalThis[name]=name==='window'?w:name==='document'?w.document:w[name];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const surface=w.document.querySelector('#surface'),contexts=[],speeds=[],cleaned=[];
 function Shader({name,value}){
  const canvas=useRef(null);
  useLayoutEffect(()=>{
   const context={lost:false,released:0,isContextLost(){return this.lost;},getExtension(){return {loseContext:()=>{context.lost=true;context.released++;}};}};contexts.push(context);canvas.current.getContext=()=>context;
   const mount={setSpeed:speed=>speeds.push({name,speed})};canvas.current.parentElement.paperShaderMount=mount;
   return ()=>{cleaned.push(name);};
  },[]);
  return createElement('div',{'data-shader':name,'data-value':value},createElement('canvas',{ref:canvas}));
 }
 const root=lifecycle.createShaderRoot(surface);
 t.after(async()=>{await act(()=>lifecycle.unmountShader(root,surface));w.close();delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
 return {w,surface,root,Shader,contexts,speeds,cleaned,event(canvas,type){canvas.dispatchEvent(new w.Event(type,{cancelable:true}));}};
}
test('lost shader surfaces stop all mounts and restore the latest render once every lost canvas recovers',async t=>{
 const h=setup(t),scene=value=>[createElement(h.Shader,{key:'a',name:'a',value}),createElement(h.Shader,{key:'b',name:'b',value})];
 await act(()=>h.root.render(scene('old')));const old=[...h.surface.querySelectorAll('canvas')];
 await act(()=>{h.contexts[0].lost=true;h.contexts[1].lost=true;h.event(old[0],'webglcontextlost');h.event(old[1],'webglcontextlost');h.root.render(scene('latest'));});
 assert.equal(h.contexts.length,2);assert.equal(h.surface.querySelector('[data-value]').dataset.value,'old');assert.ok(h.speeds.some(call=>call.name==='a'&&call.speed===0));assert.ok(h.speeds.some(call=>call.name==='b'&&call.speed===0));
 old[0].parentElement.paperShaderMount.setSpeed(5);assert.equal(h.speeds.at(-1).speed,0,'late Paper effects cannot restart a lost mount');
 await act(()=>{h.contexts[0].lost=false;h.event(old[0],'webglcontextrestored');});assert.equal(h.contexts.length,2);
 await act(()=>{h.contexts[1].lost=false;h.event(old[1],'webglcontextrestored');});
 assert.equal(h.contexts.length,4);assert.equal(h.surface.querySelector('[data-value]').dataset.value,'latest');assert.equal(h.surface.querySelectorAll('canvas').length,2);assert.equal(h.cleaned.length,2);assert.equal(h.contexts[0].released,1);assert.equal(h.contexts[1].released,1);
 h.surface.querySelector('canvas').parentElement.paperShaderMount.setSpeed(5);assert.equal(h.speeds.at(-1).speed,5,'the recreated mount must retain its normal speed API');
 await act(()=>h.event(old[0],'webglcontextrestored'));assert.equal(h.contexts.length,4,'retired canvases must not trigger another remount');
});
test('teardown during context loss cannot resurrect the root or retain its latest render',async t=>{
 const h=setup(t);await act(()=>h.root.render(createElement(h.Shader,{name:'a',value:'old'})));const canvas=h.surface.querySelector('canvas');
 await act(()=>{h.contexts[0].lost=true;h.event(canvas,'webglcontextlost');h.root.render(createElement(h.Shader,{name:'a',value:'later'}));lifecycle.unmountShader(h.root,h.surface);});
 await act(()=>h.event(canvas,'webglcontextrestored'));assert.equal(h.surface.children.length,0);assert.equal(h.contexts.length,1);assert.equal(h.cleaned.length,1);
});
test('cleanup continues through an inaccessible context and releases the other owned contexts',()=>{
 const dom=new JSDOM('<div><canvas></canvas><canvas></canvas></div>'),surface=dom.window.document.querySelector('div'),canvases=surface.querySelectorAll('canvas');let unmounted=0,released=0;
 canvases[0].getContext=()=>{throw Error('Unavailable context');};canvases[1].getContext=()=>({isContextLost:()=>false,getExtension:()=>({loseContext:()=>released++})});
 assert.doesNotThrow(()=>lifecycle.unmountShader({unmount:()=>{unmounted++;}},surface));assert.equal(unmounted,1);assert.equal(released,1);dom.window.close();
});

test('ordinary material updates keep the existing mount and ignore unrelated restoration events',async t=>{
 const h=setup(t);for(let update=0;update<50;update++)await act(()=>h.root.render(createElement(h.Shader,{name:'a',value:String(update)})));
 assert.equal(h.contexts.length,1);assert.equal(h.cleaned.length,0);assert.equal(h.surface.querySelector('[data-value]').dataset.value,'49');
 await act(()=>h.event(h.surface.querySelector('canvas'),'webglcontextrestored'));assert.equal(h.contexts.length,1);
});
test('closing after restoration but before its commit releases the retired context only once',async t=>{
 const h=setup(t);await act(()=>h.root.render(createElement(h.Shader,{name:'a',value:'old'})));const canvas=h.surface.querySelector('canvas');
 await act(()=>{h.contexts[0].lost=true;h.event(canvas,'webglcontextlost');h.contexts[0].lost=false;h.event(canvas,'webglcontextrestored');lifecycle.unmountShader(h.root,h.surface);});
 assert.equal(h.surface.children.length,0);assert.equal(h.contexts.length,1);assert.equal(h.contexts[0].released,1);assert.equal(h.cleaned.length,1);
});
test('repeated recovery keeps one current mount and releases every previous context',async t=>{
 const h=setup(t);await act(()=>h.root.render(createElement(h.Shader,{name:'a',value:'start'})));
 for(let cycle=0;cycle<30;cycle++){
  const canvas=h.surface.querySelector('canvas'),context=h.contexts.at(-1);
  await act(()=>{context.lost=true;h.event(canvas,'webglcontextlost');h.root.render(createElement(h.Shader,{name:'a',value:String(cycle)}));context.lost=false;h.event(canvas,'webglcontextrestored');});
  assert.equal(h.contexts.filter(context=>!context.lost).length,1);assert.equal(h.surface.querySelectorAll('canvas').length,1);
 }
 assert.equal(h.cleaned.length,30);assert.ok(h.contexts.slice(0,-1).every(context=>context.released===1));
});
test('root unmount failures still release its remaining GPU context',()=>{
 const dom=new JSDOM('<div><canvas></canvas></div>'),surface=dom.window.document.querySelector('div');let released=0;
 surface.querySelector('canvas').getContext=()=>({isContextLost:()=>false,getExtension:()=>({loseContext:()=>released++})});
 assert.doesNotThrow(()=>lifecycle.unmountShader({unmount:()=>{throw Error('Unmount failed');}},surface));assert.equal(released,1);dom.window.close();
});
