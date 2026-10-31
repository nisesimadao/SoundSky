import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/audio-lifetime.ts'],bundle:true,write:false,format:'esm'});
const {AudioLifetime}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
class TrackedTarget extends EventTarget {
 listeners=new Map();
 addEventListener(type,listener,options){super.addEventListener(type,listener,options);const set=this.listeners.get(type)||new Set();set.add(listener);this.listeners.set(type,set);}
 removeEventListener(type,listener){super.removeEventListener(type,listener);this.listeners.get(type)?.delete(listener);}
 count(type){return this.listeners.get(type)?.size||0;}
}
const context=()=>Object.assign(new TrackedTarget(),{state:'running'});
const node=context=>Object.assign(new TrackedTarget(),{context});
test('one context listener releases ended sources and the last closed-context node exactly once',()=>{
 const released=[],ctx=context(),a=node(ctx),b=node(ctx),lifetime=new AudioLifetime(n=>released.push(n));
 lifetime.watch(a,true);lifetime.watch(a,true);lifetime.watch(b,true);assert.equal(ctx.count('statechange'),1);assert.equal(a.count('ended'),1);
 a.dispatchEvent(new Event('ended'));assert.deepEqual(released,[a]);assert.equal(a.count('ended'),0);assert.equal(ctx.count('statechange'),1);
 ctx.state='closed';ctx.dispatchEvent(new Event('statechange'));assert.deepEqual(released,[a,b]);assert.equal(ctx.count('statechange'),0);assert.equal(b.count('ended'),0);
 b.dispatchEvent(new Event('ended'));assert.equal(released.length,2);
});
test('manual disconnection and bridge teardown remove observation without altering native nodes',()=>{
 const released=[],ctx=context(),a=node(ctx),b=node(ctx),lifetime=new AudioLifetime(n=>released.push(n));lifetime.watch(a,true);lifetime.watch(b,true);
 lifetime.unwatch(a);assert.equal(ctx.count('statechange'),1);assert.equal(a.count('ended'),0);lifetime.clear();assert.equal(ctx.count('statechange'),0);assert.equal(b.count('ended'),0);assert.equal(released.length,0);
});
test('passive observation does not retain watchers across thousands of closed contexts',()=>{
 let released=0;const lifetime=new AudioLifetime(()=>released++);
 for(let i=0;i<2000;i++){const ctx=context(),source=node(ctx);lifetime.watch(source,true);ctx.state='closed';ctx.dispatchEvent(new Event('statechange'));assert.equal(ctx.count('statechange'),0);assert.equal(source.count('ended'),0);}
 assert.equal(released,2000);lifetime.clear();
});
test('an already closed context is released immediately without waiting for another event',()=>{
 let released=0;const ctx=context();ctx.state='closed';const lifetime=new AudioLifetime(()=>released++);lifetime.watch(node(ctx),true);assert.equal(released,1);assert.equal(ctx.count('statechange'),0);
});
