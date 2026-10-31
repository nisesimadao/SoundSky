import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const [writer,client]=await Promise.all([
 build({entryPoints:['src/settings-writer.ts'],bundle:true,write:false,format:'iife',globalName:'WriterTest'}),
 build({entryPoints:['src/settings-storage.ts'],bundle:true,write:false,format:'iife',globalName:'StoreTest',footer:{js:'window.StoreTest=StoreTest;'}}),
]);
const key='soundsky:settings',revisionKey='soundsky:settings-revision';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(t,options={}){
 const stored={[revisionKey]:0},listeners=new Set(),clients=[],writes=[],replies=[],delayed=new Set();let listener,nextId=0,failNext=false;
 const get=async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>Object.hasOwn(stored,k)).map(k=>[k,structuredClone(stored[k])]));
 const storage={local:{get,set:async values=>{
  if(failNext){failNext=false;throw Error('storage temporarily unavailable');}
  writes.push(structuredClone(values));await options.beforeWrite?.(values);
  const changes={};for(const [k,v]of Object.entries(values)){changes[k]={oldValue:structuredClone(stored[k]),newValue:structuredClone(v)};stored[k]=structuredClone(v);}
  for(const callback of listeners)callback(changes,'local');
 }},onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}};
 const api={runtime:{id:'soundsky-test',onMessage:{addListener:fn=>listener=fn}},storage};
 runInNewContext(writer.outputFiles[0].text+';WriterTest.installSettingsWriter(chrome);',{chrome:api,URL});
 t.after(()=>{for(const c of clients)c.store.destroy();for(const c of clients)c.w.close();});
 return {stored,writes,replies,failNextWrite(){failNext=true;},delayNextReply(c){delayed.add(c.id);},
 request(message,sender){return new Promise(resolve=>listener(message,sender,resolve));},
 client(options={}){
  const id=++nextId,dom=new JSDOM('',{url:'https://soundcloud.com/discover',runScripts:'outside-only'}),w=dom.window;
  const values=[],states=[];let current;
  w.chrome={storage:{...storage,local:{...storage.local,get:async keys=>{const value=await get(keys);if(options.holdRead)await options.holdRead;return value;}}},runtime:{id:api.runtime.id,sendMessage:message=>new Promise(resolve=>{
   listener(message,{id:api.runtime.id,url:w.location.href,frameId:0,tab:{id}},reply=>{if(delayed.delete(id))replies.push(()=>resolve(reply));else resolve(reply);});
  })}};
  w.eval(client.outputFiles[0].text);const store=new w.StoreTest.SettingsStorage(value=>{current=value;values.push(value);},state=>states.push(state));
  const result={id,w,store,values,states,ready:store.load(),get settings(){return {...current};},edit(patch){current={...current,...patch};store.save(current);},reset(){current={};store.save(current,true);}};
  clients.push(result);return result;
 }};
}
test('simultaneous changes in different tabs preserve both fields in storage and every UI',async t=>{
 const gate=deferred(),h=harness(t,{beforeWrite:values=>values[revisionKey]===1?gate.promise:undefined}),a=h.client(),b=h.client();await Promise.all([a.ready,b.ready]);
 a.edit({focusMode:true});b.edit({pulseMax:.2});await settle();assert.equal(h.writes.length,1,'one worker serializes tab writes');gate.resolve();await settle();await settle();
 assert.equal(h.stored[key].focusMode,true);assert.equal(h.stored[key].pulseMax,.2);assert.equal(a.settings.pulseMax,.2);assert.equal(b.settings.focusMode,true);assert.equal(h.stored[revisionKey],2);
});
test('a newer commit wins even if an older acknowledgement arrives last',async t=>{
 const h=harness(t),a=h.client(),b=h.client();await Promise.all([a.ready,b.ready]);h.delayNextReply(a);a.edit({focusMode:true});await settle();
 b.edit({focusMode:false});await settle();assert.equal(h.stored[key].focusMode,false);assert.equal(h.replies.length,1);h.replies.shift()();await settle();
 assert.equal(a.settings.focusMode,false);assert.equal(b.settings.focusMode,false);assert.equal(a.states.at(-1),'saved');
});
test('edits while an acknowledgement is pending are committed in a second patch',async t=>{
 const h=harness(t),a=h.client();await a.ready;h.delayNextReply(a);a.edit({focusMode:true});await settle();a.edit({focusMode:false});h.replies.shift()();await settle();await settle();
 assert.equal(h.writes.length,2);assert.equal(h.stored[key].focusMode,false);assert.equal(a.settings.focusMode,false);
});
test('failed local edits retry explicitly without undoing other tabs or changing another setting',async t=>{
 const h=harness(t),a=h.client(),b=h.client();await Promise.all([a.ready,b.ready]);h.failNextWrite();a.edit({focusMode:true});await settle();assert.equal(a.states.at(-1),'error');
 b.edit({pulseMax:.2});await settle();assert.equal(a.settings.focusMode,true);assert.equal(a.settings.pulseMax,.2);assert.equal(a.states.at(-1),'error');
 await a.store.retry();await settle();assert.equal(a.states.at(-1),'saved');assert.equal(b.settings.focusMode,true);assert.equal(h.stored[key].pulseMax,.2);assert.equal(h.stored[key].turntable,false);
});
test('a storage event newer than the initial read is retained',async t=>{
 const gate=deferred(),h=harness(t),a=h.client({holdRead:gate.promise}),b=h.client();await b.ready;b.edit({focusMode:true});await settle();gate.resolve();await a.ready;assert.equal(a.settings.focusMode,true);
});
test('loading already-default settings still initializes the UI once',async t=>{
 const h=harness(t),a=h.client();await a.ready;a.reset();await settle();const b=h.client();await b.ready;assert.equal(b.values.length,1);assert.equal(b.settings.turntable,false);
});
test('invalid patch values and unrelated senders cannot mutate saved preferences',async t=>{
 const h=harness(t),sender={id:'soundsky-test',url:'https://soundcloud.com/discover',frameId:0,tab:{id:1}};
 for(const patch of [{pulseMax:999},{focusMode:'yes'},{siteCorners:'unknown'},{unrecognized:true}]){
  const response=await h.request({type:'soundsky:save-settings',patch},sender);assert.equal(response.ok,false);
 }
 const response=await h.request({type:'soundsky:save-settings',patch:{focusMode:true}},{...sender,url:'https://example.com/'});assert.equal(response.ok,false);assert.equal(h.writes.length,0);
});
