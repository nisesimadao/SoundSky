import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const compiled=await build({entryPoints:['src/prefetch.ts'],bundle:true,write:false,format:'iife',globalName:'prefetchTest',footer:{js:'window.prefetchTest=prefetchTest;'}});
const track=i=>({permalink_url:`https://soundcloud.com/artist/track-${i}`,streamable:true,policy:'ALLOW',track_authorization:'authorized',media:{transcodings:[{url:`https://api-v2.soundcloud.com/media/${i}/stream/hls`,format:{protocol:'hls',mime_type:'audio/mp4'},quality:'sq'}]}});
class FakeResponse extends Response {
 constructor(body,url,headers={'content-type':'application/json'}){super(body,{headers});Object.defineProperty(this,'url',{value:url,configurable:true});}
 clone(){const clone=super.clone();Object.setPrototypeOf(clone,FakeResponse.prototype);Object.defineProperty(clone,'url',{value:this.url,configurable:true});return clone;}
}
function setup(t){
 const dom=new JSDOM('',{url:'https://soundcloud.com/discover',runScripts:'outside-only'}),w=dom.window;t.after(()=>dom.window.close());Object.assign(w,{Request,Response,Headers});let time=0,id=0,offline=false,encrypted=false,large=false;const timers=new Map(),requests=[],messages=[];
 w.Date.now=()=>time;w.setTimeout=(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;};w.clearTimeout=id=>timers.delete(id);w.postMessage=data=>messages.push(data);
 const native=async(input,options={})=>{
  const url=input instanceof Request?input.url:new URL(String(input),w.location.href).href;requests.push({url,options,input});
  if(offline)throw new Error('Offline');if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(url.includes('/tracks?'))return new FakeResponse(JSON.stringify([track(1),track(2),track(3)]),url);
  if(url.includes('/stream/hls')){const id=new URL(url).pathname.split('/')[2];return new FakeResponse(JSON.stringify({url:`https://cf-hls-media.sndcdn.com/${id}/list.m3u8?signature=old`}),url);}
  if(url.includes('.m3u8'))return new FakeResponse(`#EXTM3U\n${encrypted?'#EXT-X-KEY:METHOD=AES-128,URI="secret.key"\n':''}#EXT-X-MAP:URI="init.mp4"\n#EXTINF:5,\naudio.m4s\n#EXT-X-ENDLIST\n`,url,{'content-type':'application/vnd.apple.mpegurl'});
  if(url.endsWith('.m4s')||url.endsWith('.mp4'))return new FakeResponse('audio-bytes',url,{'content-type':'audio/mp4',...(large?{'content-length':'999999999'}:{})});
  if(input instanceof Request&&input.method==='POST')return new FakeResponse(await input.text(),url);
  return new FakeResponse('{}',url);
 };
 class XHR extends w.EventTarget { readyState=0;status=200;responseType='json';response={};responseText='';url='';open(method,url){this.url=url;this.readyState=1;}setRequestHeader(){}send(){this.response={url:'https://cf-hls-media.sndcdn.com/1/list.m3u8?signature=new'};this.responseText=JSON.stringify(this.response);this.readyState=4;this.dispatchEvent(new w.Event('readystatechange'));} }
 w.XMLHttpRequest=XHR;
 w.fetch=native;w.eval(compiled.outputFiles[0].text);const preload=new w.prefetchTest.AudioPrefetch();t.after(()=>preload.destroy());
 const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
 const tick=async(ms=1500)=>{time+=ms;for(const [key,timer]of [...timers])if(timer.at<=time){timers.delete(key);timer.fn();}await flush();};
 const seed=async()=>{await w.fetch('https://api-v2.soundcloud.com/tracks?client_id=client');await flush();};
 return {w,preload,native,timers,requests,messages,flush,tick,seed,set offline(v){offline=v;},set encrypted(v){encrypted=v;},set large(v){large=v;}};
}
test('upcoming audio, manifests and init segments are cached and survive promotion to current track',async t=>{
 const h=setup(t);await h.seed();h.preload.configure(3,true,['/artist/track-1','/artist/track-2','/artist/track-3'],'/artist/current');await h.tick();assert.equal(h.messages.at(-1).ready,3);assert.deepEqual([...h.messages.at(-1).readyKeys],['/artist/track-1','/artist/track-2','/artist/track-3']);
 const before=h.requests.length;h.offline=true;
 for(const i of [1,2,3])assert.equal(await (await h.w.fetch(`https://cf-hls-media.sndcdn.com/${i}/audio.m4s`)).text(),'audio-bytes');assert.equal(h.requests.length,before);
 h.preload.configure(3,true,['/artist/track-2','/artist/track-3'],'/artist/track-1');assert.equal(await (await h.w.fetch('https://cf-hls-media.sndcdn.com/1/audio.m4s')).text(),'audio-bytes');assert.equal(h.requests.length,before);
 h.preload.configure(0,true,[],'/artist/track-1');assert.deepEqual([...h.messages.at(-1).readyKeys],[]);await assert.rejects(h.w.fetch('https://cf-hls-media.sndcdn.com/1/audio.m4s'),/Offline/);
});
test('no upcoming tracks and disabled lookahead produce no additional requests',async t=>{
 const h=setup(t);await h.seed();const before=h.requests.length;
 for(const [count,playing,next]of [[3,true,[]],[0,true,['/artist/track-1']],[3,false,[]]]){h.preload.configure(count,playing,next);await h.tick();assert.equal(h.requests.length,before);}
});
test('native POST bodies and Range requests are not replaced by cached full responses',async t=>{
 const h=setup(t);await h.seed();h.preload.configure(1,true,['/artist/track-1']);await h.tick();
 const request=new Request('https://api-v2.soundcloud.com/native',{method:'POST',body:'original-body'});assert.equal(await (await h.w.fetch(request)).text(),'original-body');
 h.offline=true;await assert.rejects(h.w.fetch('https://cf-hls-media.sndcdn.com/1/audio.m4s',{headers:{Range:'bytes=0-3'}}),/Offline/);
 const controller=new AbortController();controller.abort();await assert.rejects(h.w.fetch('https://cf-hls-media.sndcdn.com/1/audio.m4s',{signal:controller.signal}),/Aborted/);
});
test('encrypted media and memory-over-limit media are not reported as prepared',async t=>{
 for(const mode of ['encrypted','large']){const h=setup(t);await h.seed();h[mode]=true;h.preload.configure(1,true,['/artist/track-1']);await h.tick();assert.equal(h.messages.at(-1).ready,0);assert.equal(h.timers.size,0);}
});
test('cached audio expires, and disposal restores the native fetch and XHR methods',async t=>{
 const h=setup(t),open=h.w.XMLHttpRequest.prototype.open;await h.seed();h.preload.configure(1,true,['/artist/track-1']);await h.tick();h.offline=true;await h.tick(16*60*1000);h.preload.configure(1,true,['/artist/track-1']);assert.equal(h.messages.at(-1).ready,0);await assert.rejects(h.w.fetch('https://cf-hls-media.sndcdn.com/1/audio.m4s'),/Offline/);h.preload.destroy();assert.equal(h.w.fetch,h.native);assert.notEqual(h.w.XMLHttpRequest.prototype.open,open);assert.equal(h.timers.size,0);
});

test('a fresh authorized native XHR resolver can reuse a cached manifest after its signature changes',async t=>{
 const h=setup(t);await h.seed();h.preload.configure(1,true,['/artist/track-1']);await h.tick();h.offline=true;
 const request=new h.w.XMLHttpRequest();request.open('GET','https://api-v2.soundcloud.com/media/1/stream/hls?client_id=client');request.send();
 const before=h.requests.length;assert.match(await (await h.w.fetch(request.response.url)).text(),/#EXTM3U/);assert.equal(h.requests.length,before);await assert.rejects(h.w.fetch(request.response.url,{headers:{Range:'bytes=0-3'}}),/Offline/);
 const unknown=new h.w.XMLHttpRequest();unknown.open('GET','https://api-v2.soundcloud.com/media/999/stream/hls?client_id=client');unknown.send();await assert.rejects(h.w.fetch('https://cf-hls-media.sndcdn.com/1/list.m3u8?signature=unverified'),/Offline/);
});
test('current audio aborts low-priority preparation and the next attempt resumes cached progress',async t=>{
 const h=setup(t);await h.seed();let held=false,aborted=false;
 h.preload.nativeFetch=async(input,options)=>{
  if(String(input).endsWith('/init.mp4')&&!held){held=true;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'));},{once:true}));}
  return h.native(input,options);
 };
 h.preload.configure(1,true,['/artist/track-1']);await h.tick();assert.equal(held,true);
 assert.equal(await(await h.w.fetch('https://cf-hls-media.sndcdn.com/current.mp4')).text(),'audio-bytes');assert.equal(aborted,true);assert.equal(h.messages.at(-1).ready,0);
 await h.tick();assert.equal(h.messages.at(-1).ready,1);
});
test('an unknown-length stream over the byte limit cancels without hanging or reporting it ready',async t=>{
 const h=setup(t);await h.seed();let cancelled=false;
 h.preload.nativeFetch=async(input,options)=>{
  if(String(input).endsWith('.m4s')){let chunks=0;return new FakeResponse(new ReadableStream({pull(controller){if(chunks++<26)controller.enqueue(new Uint8Array(1024*1024));else controller.close();},cancel(){cancelled=true;}}),String(input),{'content-type':'audio/mp4'});}
  return h.native(input,options);
 };
 h.preload.configure(1,true,['/artist/track-1']);await h.tick();assert.equal(cancelled,true);assert.equal(h.messages.at(-1).ready,0);assert.equal(h.timers.size,0);
});
test('new unavailable metadata invalidates old authorized stream data',async t=>{
 const h=setup(t);await h.seed();h.preload.configure(1,true,['/artist/track-1']);await h.tick();assert.equal(h.messages.at(-1).ready,1);
 h.preload.nativeFetch=async(input,options)=>String(input).includes('/tracks?')?new FakeResponse(JSON.stringify([{permalink_url:track(1).permalink_url,policy:'BLOCK',streamable:false}]),String(input)):h.native(input,options);
 await h.w.fetch('https://api-v2.soundcloud.com/tracks?client_id=client');await h.flush();assert.equal(h.messages.at(-1).ready,0);h.offline=true;await assert.rejects(h.w.fetch('https://cf-hls-media.sndcdn.com/1/audio.m4s'),/Offline/);
});
test('per-track duration limits fetch only the needed segments and reuse them when the limit increases',async t=>{
 const h=setup(t);await h.seed();
 h.preload.nativeFetch=async(input,options)=>{
  const response=await h.native(input,options);
  if(String(input).includes('.m3u8'))return new FakeResponse('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n'+Array.from({length:8},(_,i)=>`#EXTINF:5,\naudio${i}.m4s\n`).join('')+'#EXT-X-ENDLIST\n',String(input),{'content-type':'application/vnd.apple.mpegurl'});
  return response;
 };
 const audioCount=()=>h.requests.filter(r=>r.url.endsWith('.m4s')).length;
 h.preload.configure(1,true,['/artist/track-1'],'',15);await h.tick();assert.equal(audioCount(),3);assert.equal(h.messages.at(-1).ready,1);assert.equal(h.messages.at(-1).seconds,15);
 h.preload.configure(1,true,['/artist/track-1'],'',30);await h.tick();assert.equal(audioCount(),6);assert.equal(h.messages.at(-1).ready,1);
 h.preload.configure(1,true,['/artist/track-1'],'',0);await h.tick();assert.equal(audioCount(),8);assert.equal(h.messages.at(-1).ready,1);
});

test('known queued tracks prepare while paused, including the current SoundCloud delivery host',async t=>{
 const h=setup(t);await h.seed();
 h.preload.nativeFetch=async(input,options)=>{
  const response=await h.native(input,options);
  if(String(input).includes('/stream/hls'))return new FakeResponse(JSON.stringify({url:'https://playback.media-streaming.soundcloud.cloud/1/list.m3u8'}),String(input));
  return response;
 };
 h.preload.configure(1,false,['/artist/track-1'],'/artist/current');await h.tick();assert.equal(h.messages.at(-1).ready,1);assert.ok(h.requests.some(r=>r.url==='https://playback.media-streaming.soundcloud.cloud/1/audio.m4s'));
});

test('one unavailable queued song does not block preparation of the other known songs',async t=>{
 const h=setup(t);await h.seed();h.preload.metadata.delete('/artist/track-1');h.preload.configure(3,false,['/artist/track-1','/artist/track-2','/artist/track-3'],'/artist/current');await h.tick();assert.equal(h.messages.at(-1).ready,2);assert.equal(h.messages.at(-1).phase,'unavailable');
});
