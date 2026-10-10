async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.request.get('http://127.0.0.1:4173');
 const html=(await response.text()).replace(/<script[^>]*>.*?<\/script>/gs,'').replace('<main>','<main><div class="fullHero"><div id="page-art" class="fullHero__artwork" style="width:200px;height:200px;background:#345;transform:translateX(2px)"></div></div><iframe id="cover-frame" src="/n/artist/track" width="500" height="420"></iframe>');
 await page.route('https://soundcloud.com/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  await route.fulfill({contentType:'text/html',body:path.startsWith('/n/')?'<!doctype html><section aria-label="Track header"><img id="avatar" src="https://i1.sndcdn.com/avatars-user.jpg" width="24" height="24"><div id="frame-art" style="width:300px;height:300px;overflow:hidden"><img src="https://i1.sndcdn.com/artworks-track.jpg" width="300" height="300"></div></section>':html});
 });
 await page.route('https://i1.sndcdn.com/**',async route=>{const r=await page.request.get('http://127.0.0.1:4173/artwork.jpg');await route.fulfill({contentType:'image/jpeg',body:await r.body()});});
 await page.goto('https://soundcloud.com/artist/track');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));
 await page.addScriptTag({path:'tests/fixture.js'});await page.addScriptTag({path:'artifacts/preview.js'});
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 const frame=await (await page.locator('#cover-frame').elementHandle()).contentFrame();await frame.waitForLoadState();await frame.addScriptTag({path:'dist/theme-frame.js'});
 await page.locator('.playControl').click();
 const send=async()=>page.evaluate(async()=>{for(let i=0;i<20;i++){window.postMessage({type:'soundsky:audio',level:.2,onset:0},location.origin);await new Promise(r=>setTimeout(r,20));}});
 await send();
 const track=await page.locator('#page-art').evaluate(e=>({scale:Number(e.style.scale),transform:e.style.transform,radius:parseFloat(e.style.borderRadius)}));
 const embedded=await frame.locator('#frame-art').evaluate(e=>({scale:Number(e.style.scale),radius:parseFloat(e.style.borderRadius)}));
 if(Math.abs(track.scale-1.06)>.003||Math.abs(embedded.scale-1.06)>.003||track.radius<=6||embedded.radius<=6||track.transform!=='translateX(2px)')throw new Error(JSON.stringify({track,embedded}));
 if(await frame.locator('#avatar').evaluate(e=>!!e.style.scale))throw new Error('Avatar pulses with cover');
 await page.locator('.playControl').click();await page.waitForTimeout(450);
 if(await page.locator('#page-art').evaluate(e=>Number(e.style.scale)!==1)||await frame.locator('#frame-art').evaluate(e=>Number(e.style.scale)!==1))throw new Error('Paused cover keeps expanding');
 // Same song inside a different playlist must not animate this page's cover.
 await page.evaluate(()=>{history.pushState({},'', '/artist/sets/album');document.querySelector('.playbackSoundBadge__titleLink').href='/artist/track?in=artist/sets/other';});
 await page.locator('.playControl').click();await send();
 if(await page.locator('#page-art').evaluate(e=>!!e.style.scale))throw new Error('Unrelated playlist pulses');
 await page.evaluate(()=>document.querySelector('.playbackSoundBadge__titleLink').href='/artist/track?in=artist/sets/album');await send();
 if(await page.locator('#page-art').evaluate(e=>Number(e.style.scale)<1.05))throw new Error('Current playlist cover does not pulse');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(60);
 if(await page.locator('#page-art').evaluate(e=>!!e.style.scale))throw new Error('Reduced motion still pulses');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.waitForTimeout(60);
 if(await page.locator('#page-art').evaluate(e=>!!e.style.scale))throw new Error('Native cover animates underneath SoundSky');
 if(errors.length)throw new Error(errors.join('\n'));
 await page.unroute('https://soundcloud.com/**');await page.unroute('https://i1.sndcdn.com/**');
 return {track,embedded,sharedRawResponse:true,playlistIdentity:true,avatarPreserved:true,pauseReturns:true,reducedMotion:true,soundSkyRestores:true,noRuntimeErrors:true};
}
