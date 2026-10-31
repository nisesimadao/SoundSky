import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/settings-storage.ts'],bundle:true,write:false,format:'iife',globalName:'StoreTest',footer:{js:'window.StoreTest=StoreTest;'}});
function setup(t,storage){
 const dom=new JSDOM('',{url:'https://soundcloud.com',runScripts:'outside-only'}),w=dom.window;t.after(()=>dom.window.close());
 if(storage)w.chrome={storage};w.eval(bundle.outputFiles[0].text);
 const values=[],states=[];const store=new w.StoreTest.SettingsStorage(v=>values.push(v),s=>states.push(s));t.after(()=>store.destroy());return {w,store,values,states};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
test('edits before the initial read finishes preserve untouched saved preferences',async t=>{
 let resolveRead;const writes=[];
 const h=setup(t,{local:{get:()=>new Promise(r=>resolveRead=r),set:async value=>writes.push(value)}});
 const loading=h.store.load();h.store.save({focusMode:true});
 resolveRead({'soundsky:settings':{pulseMax:.2,turntableSpeed:1.7}});await loading;await tick();
 assert.equal(h.values.at(-1).pulseMax,.2);assert.equal(h.values.at(-1).focusMode,true);
 assert.equal(writes.at(-1)['soundsky:settings'].turntableSpeed,1.7);assert.equal(h.states.at(-1),'saved');
});
test('a reset before reading storage overrides all saved fields',async t=>{
 let resolveRead;const writes=[];const h=setup(t,{local:{get:()=>new Promise(r=>resolveRead=r),set:async value=>writes.push(value)}});
 const loading=h.store.load();h.store.save({},true);resolveRead({'soundsky:settings':{pulseMax:.3,turntable:true}});await loading;await tick();
 assert.equal(writes.at(-1)['soundsky:settings'].pulseMax,.15);assert.equal(h.values.at(-1).turntable,false);
});
test('rapid changes serialize writes so an older save cannot finish last',async t=>{
 const writes=[],complete=[];
 const h=setup(t,{local:{get:async()=>({}),set:value=>{writes.push(value);return new Promise(r=>complete.push(r));}}});await h.store.load();
 h.store.save({...h.values.at(-1),pulseMax:.1});h.store.save({...h.values.at(-1),pulseMax:.2});h.store.save({...h.values.at(-1),pulseMax:.3});
 assert.equal(writes.length,1);complete.shift()();await tick();assert.equal(writes.length,2);assert.equal(writes[1]['soundsky:settings'].pulseMax,.3);
 complete.shift()();await tick();assert.equal(h.states.at(-1),'saved');
});
test('failed writes report failure and can recover on the next change',async t=>{
 let fail=true;const h=setup(t,{local:{get:async()=>({}),set:async()=>{if(fail)throw Error('quota');}}});await h.store.load();
 h.store.save({...h.values.at(-1),focusMode:true});await tick();assert.equal(h.states.at(-1),'error');
 fail=false;h.store.save({...h.values.at(-1),turntable:true});await tick();assert.equal(h.states.at(-1),'saved');
});
test('other tabs update idle preferences and listeners are removed on disposal',async t=>{
 let listener,removed;const h=setup(t,{local:{get:async()=>({}),set:async()=>{}},onChanged:{addListener:fn=>listener=fn,removeListener:fn=>removed=fn}});await h.store.load();
 listener({'soundsky:settings':{newValue:{focusMode:true}}},'local');assert.equal(h.values.at(-1).focusMode,true);
 h.store.destroy();const before=h.values.length;listener({'soundsky:settings':{newValue:{focusMode:false}}},'local');assert.equal(h.values.length,before);assert.equal(removed,listener);
});
test('disposal during an initial read never applies settings or starts a write',async t=>{
 let resolveRead,writes=0;const h=setup(t,{local:{get:()=>new Promise(r=>resolveRead=r),set:async()=>writes++}});
 const loading=h.store.load();h.store.save({focusMode:true});h.store.destroy();resolveRead({});await loading;assert.equal(h.values.length,0);assert.equal(writes,0);
});
test('local development storage saves synchronously and receives external changes',async t=>{
 const h=setup(t);await h.store.load();h.store.save({...h.values.at(-1),focusMode:true});
 assert.equal(JSON.parse(h.w.localStorage.getItem('soundsky:settings')).focusMode,true);
 h.w.dispatchEvent(new h.w.StorageEvent('storage',{key:'soundsky:settings',storageArea:h.w.localStorage,newValue:'{"focusMode":false}'}));assert.equal(h.values.at(-1).focusMode,false);
});

test('failed reads can retry without changing preferences or writing defaults',async t=>{
 let fail=true,writes=0;const h=setup(t,{local:{get:async()=>{if(fail)throw Error('read failed');return {'soundsky:settings':{pulseMax:.2,turntableSpeed:1.7}};},set:async()=>writes++}});
 await h.store.load();assert.equal(h.states.at(-1),'load-error');
 fail=false;await h.store.retry();assert.equal(h.values.at(-1).pulseMax,.2);assert.equal(h.values.at(-1).turntableSpeed,1.7);assert.equal(writes,0);assert.equal(h.states.at(-1),'saved');
});

test('failed writes retry the unchanged local edit without resetting other fields',async t=>{
 let fail=true;const writes=[];const h=setup(t,{local:{get:async()=>({'soundsky:settings':{pulseMax:.2}}),set:async value=>{writes.push(value);if(fail)throw Error('write failed');}}});
 await h.store.load();h.store.save({...h.values.at(-1),focusMode:true});await tick();assert.equal(h.states.at(-1),'error');
 fail=false;await h.store.retry();assert.equal(writes.length,2);assert.equal(writes[1]['soundsky:settings'].focusMode,true);assert.equal(writes[1]['soundsky:settings'].pulseMax,.2);assert.equal(h.states.at(-1),'saved');
});

test('a failed initial read cannot erase newer settings delivered by a storage event',async t=>{
 let rejectRead,changed;const h=setup(t,{local:{get:()=>new Promise((resolve,reject)=>{rejectRead=reject;})},onChanged:{addListener:listener=>{changed=listener;},removeListener(){}}});
 const loading=h.store.load();changed({'soundsky:settings':{newValue:{focusMode:true,pulseMax:.2}}},'local');rejectRead(Error('read failed'));await loading;
 assert.equal(h.values.at(-1).focusMode,true);assert.equal(h.values.at(-1).pulseMax,.2);assert.equal(h.states.at(-1),'load-error');
});

test('repeated retry clicks share one in-flight read',async t=>{
 let reads=0,finishRead;const h=setup(t,{local:{get:()=>{if(++reads===1)return Promise.reject(Error('read failed'));return new Promise(resolve=>{finishRead=resolve;});}}});
 await h.store.load();const first=h.store.retry(),second=h.store.retry();assert.equal(reads,2);finishRead({'soundsky:settings':{focusMode:true}});await Promise.all([first,second]);assert.equal(h.values.at(-1).focusMode,true);assert.equal(h.states.at(-1),'saved');
});
