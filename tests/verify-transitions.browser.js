async page => {
 await page.setViewportSize({width:1440,height:900});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://i1.sndcdn.com/**',async route=>{
   if(route.request().url().includes('transition-slow'))await new Promise(resolve=>setTimeout(resolve,450));
   const response=await page.request.get('http://127.0.0.1:4173/artwork.jpg');
   await route.fulfill({body:await response.body(),contentType:'image/jpeg'});
 });
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();
 await page.waitForFunction(()=>document.querySelector('soundsky-player').shadowRoot.querySelector('.art-image').getAttribute('src'));
 await page.evaluate(()=>{window.motionRecords=[];const original=Element.prototype.animate;Element.prototype.animate=function(keys,options){window.motionRecords.push({className:this.className,keys,options});return original.call(this,keys,options);};});
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.waitForTimeout(100);
 const queue=await page.evaluate(()=>window.motionRecords.filter(r=>r.className.includes('queueItemView')));
 if(queue.length<3||queue[1].options.delay<=queue[0].options.delay)throw new Error('Queue lacks staggered entry: '+JSON.stringify(queue));
 const old=await page.locator('soundsky-player').locator('.art-image').getAttribute('src');
 const change=async name=>page.evaluate(name=>{document.querySelector('.playbackSoundBadge__avatar span').style.backgroundImage=`url("https://i1.sndcdn.com/artworks-transition-${name}-t500x500.jpg")`;document.querySelector('#change').click();},name);
 await change('slow');await page.waitForTimeout(120);
 if(await page.locator('soundsky-player').locator('.art-image').getAttribute('src')!==old)throw new Error('Old artwork disappears while loading');
 await page.waitForFunction(()=>document.querySelector('soundsky-player').shadowRoot.querySelector('.art-image').src.includes('slow'));
 const motion=await page.evaluate(()=>window.motionRecords.filter(r=>['art-image','art-transition-outgoing'].includes(r.className)));
 if(!motion.some(r=>r.className==='art-image'&&r.keys[0].transform==='translateY(100%)')||!motion.some(r=>r.className==='art-transition-outgoing'&&r.keys[1].transform==='translateY(-100%)'))throw new Error('Cover transition directions wrong');
 await change('fast');await page.waitForTimeout(100);await change('latest');await page.waitForTimeout(700);
 if(await page.locator('soundsky-player').locator('.art-transition-outgoing').count()||!(await page.locator('soundsky-player').locator('.art-image').getAttribute('src')).includes('latest'))throw new Error('Rapid track change retains stale artwork');
 // A late response must not replace a newer track.
 await change('slow-stale');await page.waitForTimeout(70);await change('winner');await page.waitForTimeout(750);
 if(!(await page.locator('soundsky-player').locator('.art-image').getAttribute('src')).includes('winner'))throw new Error('Delayed artwork overwrites current track');
 await page.emulateMedia({reducedMotion:'reduce'});await change('still');await page.waitForTimeout(180);
 if(await page.locator('soundsky-player').locator('.art-transition-outgoing').count())throw new Error('Reduced motion still animates');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('button',{name:'見た目の設定',exact:true}).click();
 await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();
 await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 await page.evaluate(()=>window.motionRecords=[]);
 await page.locator('.playbackSoundBadge__showQueue').click();await page.waitForTimeout(60);
 const normal=await page.evaluate(()=>({rows:window.motionRecords.filter(r=>r.className.includes('queueItemView')),radius:getComputedStyle(document.querySelector('.queueItemView.m-active')).borderRadius,shadow:getComputedStyle(document.querySelector('.queueItemView.m-active')).boxShadow}));
 if(normal.rows.length<3||normal.radius!=='0px'||!normal.shadow.includes('inset'))throw new Error('Native Next Up differs or lacks stagger: '+JSON.stringify(normal));
 if(errors.length)throw new Error(errors.join('\n'));
 await page.unroute('https://i1.sndcdn.com/**');
 return {queueStagger:true,retainCoverWhileLoading:true,coverDirections:true,rapidChanges:true,staleLoadRejected:true,reducedMotion:true,noRuntimeErrors:true};
}
