import { AudioPrefetch } from '../src/prefetch.ts';
import { VERSION } from '../src/version.ts';
const button=document.querySelector('#run'),result=document.querySelector('#result');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const completed=xhr=>new Promise(resolve=>xhr.addEventListener('loadend',resolve,{once:true}));
const throwsInvalid=fn=>{try{fn();return false;}catch(error){return error.name==='InvalidStateError';}};
button.addEventListener('click',async()=>{
 button.disabled=true;result.textContent='検証中';
 const nativeOpen=XMLHttpRequest.prototype.open;
 // Only the test transport redirects fixture media URLs to a local response.
 const localOpen=function(method,url,...options){return Reflect.apply(nativeOpen,this,[method,String(url).startsWith('https://cf-hls-media.sndcdn.com/')?'/prefetch-response?slow=1':url,...options]);};
 XMLHttpRequest.prototype.open=localOpen;
 const bridge=new AudioPrefetch();
 try {
  const first=new XMLHttpRequest(),second=new XMLHttpRequest();
  first.open('GET','https://cf-hls-media.sndcdn.com/first.m4s');first.send();
  second.open('GET','https://cf-hls-media.sndcdn.com/second.m4s');second.send();
  assert(bridge.foreground===2,'Parallel playback requests must own two observations');
  assert(throwsInvalid(()=>second.send()),'Native duplicate send exception must survive');
  assert(bridge.foreground===2,'Duplicate send must not leak priority');
  first.open('GET','/prefetch-response');
  assert(bridge.foreground===1,'Reopen must release old request without loadend');
  const firstDone=completed(first);first.send();await firstDone;
  assert(bridge.foreground===1,'Unrelated completion must not release second request');
  try{second.open('INVALID METHOD','/prefetch-response');throw new Error('Invalid method accepted');}catch(error){if(error.name!=='SyntaxError')throw error;}
  assert(bridge.foreground===1,'Failed open must preserve the active request');
  second.abort();assert(bridge.foreground===0,'Abort must release exactly once');
  for(let i=0;i<100;i++) {
   const recycled=new XMLHttpRequest();recycled.open('GET','https://cf-hls-media.sndcdn.com/recycled.m4s');recycled.send();
   if(i%2)recycled.abort();else recycled.open('GET','/prefetch-response');
   assert(bridge.foreground===0&&bridge.foregroundXHR.size===0,'Recycled native requests must release every observation');
  }
  const url='https://cf-hls-media.sndcdn.com/cached.m4s',response=new Response('cached-audio');
  Object.defineProperty(response,'url',{value:url});
  bridge.cache.set(bridge.key(url,new Headers()),{response,bytes:12,at:Date.now(),owner:'/artist/test'});bridge.bytes=12;
  const cached=new XMLHttpRequest();cached.open('GET',url);const cacheDone=completed(cached);cached.send();
  assert(throwsInvalid(()=>cached.send()),'Pending cached duplicate send must be rejected');await cacheDone;
  assert(cached.status===200&&cached.responseText==='cached-audio'&&cached.responseURL===url,'Cached native XHR must preserve bytes and response URL');
  assert(throwsInvalid(()=>cached.send()),'Completed cached send must preserve native rejection');
  const active=new XMLHttpRequest();active.open('GET','https://cf-hls-media.sndcdn.com/active.m4s');const activeDone=completed(active);active.send();
  assert(bridge.foreground===1,'Final native request must be observed');bridge.destroy();
  assert(bridge.foreground===0&&bridge.foregroundXHR.size===0,'Destroy must release all observations');
  await activeDone;assert(active.status===200&&active.responseText==='native-audio','Destroy must preserve in-flight native playback');
  assert(XMLHttpRequest.prototype.open===localOpen,'Native hook must be restored');
  result.textContent=JSON.stringify({version:VERSION,parallelRequests:true,nativeDuplicateSend:true,reopenWithoutLoadend:true,failedOpenPreservesRequest:true,abortExactlyOnce:true,recycledNativeRequests:100,cachedNativeBytesAndURL:true,cachedDuplicateAndCompletedSend:true,destroyPreservesNativeRequest:true,remainingObservers:bridge.foregroundXHR.size},null,2);
 }catch(error){result.textContent='FAIL: '+(error.stack||error);}
 finally{bridge.destroy();XMLHttpRequest.prototype.open=nativeOpen;button.disabled=false;}
});
