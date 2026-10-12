async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let offline=false;const audioRequests=[];
 const fixture=await page.request.get('http://127.0.0.1:4173');const html=(await fixture.text()).replace(/<script[^>]*>.*?<\/script>/gs,'');
 const track=i=>({permalink_url:`https://soundcloud.com/artist/track-${i}`,streamable:true,policy:'ALLOW',track_authorization:'authorized',media:{transcodings:[{url:`https://api-v2.soundcloud.com/media/${i}/stream/hls`,format:{protocol:'hls',mime_type:'audio/mp4; codecs="mp4a.40.2"'},quality:'sq'}]}});
 await page.route('https://soundcloud.com/**',r=>r.fulfill({body:html,contentType:'text/html'}));
 await page.route('https://api-v2.soundcloud.com/**',r=>{if(offline)return r.abort();const url=new URL(r.request().url());const data=url.pathname==='/tracks'?[1,2,3].map(track):{url:`https://playback.media-streaming.soundcloud.cloud/${url.pathname.split('/')[2]}/list.m3u8?signature=old`};return r.fulfill({body:JSON.stringify(data),contentType:'application/json',headers:{'access-control-allow-origin':'*'}});});
 await page.route('https://playback.media-streaming.soundcloud.cloud/**',r=>{audioRequests.push(r.request().url());if(offline)return r.abort();const name=new URL(r.request().url()).pathname.split('/').at(-1);return r.fulfill({path:`tests/fixtures/prefetch-audio/${name}`,contentType:name.endsWith('m3u8')?'application/vnd.apple.mpegurl':'audio/mp4',headers:{'access-control-allow-origin':'*'}});});
 await page.route('https://i1.sndcdn.com/**',r=>r.fulfill({path:'tests/artwork.jpg',contentType:'image/jpeg',headers:{'access-control-allow-origin':'*'}}));
 await page.context().setOffline(false);await page.goto('https://soundcloud.com/discover');await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.addScriptTag({path:'tests/fixture.js'});await page.addScriptTag({path:'dist/audio.js'});await page.addScriptTag({path:'artifacts/preview.js'});
 await page.evaluate(async()=>{await fetch('https://api-v2.soundcloud.com/tracks?client_id=client');});await page.evaluate(()=>{const box=document.querySelector('.queueFallback input');if(box)box.checked=true;});
 await page.waitForFunction(()=>document.querySelector('soundsky-player').shadowRoot.querySelector('#prefetch-status').textContent==='3曲中3曲の音声を準備済み',null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelectorAll('[data-soundsky-prefetched]').length===3);
 if(await page.locator('.queueItemView.m-active[data-soundsky-prefetched]').count())throw new Error('Playing row has a preload marker');
 const preparedRequests=audioRequests.length;if(preparedRequests!==18)throw new Error('Three complete HLS tracks were not fetched: '+preparedRequests);
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'操作部分',exact:true}).click();
 const rail=await page.locator('[data-soundsky-prefetched]').first().evaluate(row=>{const css=getComputedStyle(row,'::after');return{width:css.width,background:css.backgroundImage,height:row.getBoundingClientRect().height};});
 if(rail.width!=='2px'||!rail.background.includes('repeating-linear-gradient')||rail.height!==56)throw new Error('Prepared rail changes row layout or is not dashed: '+JSON.stringify(rail));
 const setting=page.locator('soundsky-player').locator('[data-setting="prefetchCount"]');if(await setting.inputValue()!=='3')throw new Error('Wrong default lookahead count');
 await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 const nativeRail=await page.locator('.queue:not([data-soundsky-queue]) [data-soundsky-prefetched]').first().evaluate(row=>getComputedStyle(row,'::after').backgroundImage);
 if(!nativeRail.includes('repeating-linear-gradient'))throw new Error('Native themed queue lacks ready rail');
 // Advance native queue first; its former next track must remain cached when it becomes current.
 await page.locator('.skipControl__next').click();await page.waitForFunction(()=>document.querySelectorAll('[data-soundsky-prefetched]').length===2);offline=true;await page.context().setOffline(true);
 const playback=await page.evaluate(async()=>{
  const broker=await (await fetch('https://api-v2.soundcloud.com/media/1/stream/hls?client_id=client&track_authorization=authorized')).json();
  const manifest=await (await fetch(broker.url)).text();const names=[...manifest.matchAll(/URI="([^"]+)"/g)].map(x=>x[1]).concat(manifest.split(/\r?\n/).filter(x=>x&&!x.startsWith('#')));
  const parts=[];for(const name of names)parts.push(await (await fetch(new URL(name,broker.url))).arrayBuffer());
  const media=new MediaSource(),audio=document.createElement('audio');audio.muted=true;audio.src=URL.createObjectURL(media);window.prefetchTestAudio=audio;
  await new Promise((resolve,reject)=>{media.addEventListener('sourceopen',async()=>{try{const buffer=media.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');for(const part of parts)await new Promise((done,fail)=>{buffer.addEventListener('updateend',done,{once:true});buffer.addEventListener('error',fail,{once:true});buffer.appendBuffer(part);});media.endOfStream();resolve();}catch(e){reject(e);}},{once:true});});
  await audio.play();return{segments:parts.length,duration:audio.duration,readyState:audio.readyState};
 });
 await page.waitForTimeout(250);if(!await page.evaluate(()=>window.prefetchTestAudio.currentTime>0))throw new Error('Cached audio could not play while offline');if(audioRequests.length!==preparedRequests)throw new Error('Offline playback attempted to redownload audio');
 await page.evaluate(()=>{window.prefetchTestAudio.pause();URL.revokeObjectURL(window.prefetchTestAudio.src);});await page.context().setOffline(false);offline=false;
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'操作部分',exact:true}).click();await setting.fill('0');await setting.dispatchEvent('input');
 if(await page.locator('[data-soundsky-prefetched]').count())throw new Error('Disabled preload leaves ready markers');
 if(!await page.locator('soundsky-player').locator('#prefetch-status').isHidden())throw new Error('Disabled preload status remains');
 const scope=page.getByLabel('各曲の読み込み量',{exact:true});if(!await scope.isDisabled())throw new Error('Disabled count leaves duration active');await setting.fill('1');await setting.dispatchEvent('input');await scope.selectOption('30');
 if(!await page.evaluate(()=>{const values=JSON.parse(localStorage.getItem('soundsky:settings'));return values.prefetchCount===1&&values.prefetchSeconds===30;}))throw new Error('Count or duration preference is not saved');
 await setting.fill('0');await setting.dispatchEvent('input');

 await page.unroute('https://soundcloud.com/**');await page.unroute('https://api-v2.soundcloud.com/**');await page.unroute('https://playback.media-streaming.soundcloud.cloud/**');await page.unroute('https://i1.sndcdn.com/**');
 if(errors.length)throw new Error(errors.join('\n'));return{readyDashedRail:true,nativeThemeReadyRail:true,recycledQueueMarkers:true,threeCompleteTracks:true,knownAutoplayQueueWhilePaused:true,preparedRequests,cachedMSEPlaybackWhileOffline:playback,currentTrackCacheRetained:true,noAudioRedownload:true,settingOff:true,countAndDurationSaved:true,noRuntimeErrors:true};
}
