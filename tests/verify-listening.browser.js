// Run against npm run dev. Real audio output is covered separately by verify-turntable.
async page => {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Long title',exact:true}).click();
 await page.locator('.playControl').click();
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 const player=page.locator('soundsky-player');
 await player.locator('[data-command="settings"]').click();
 await page.getByRole('tab',{name:'再生',exact:true}).click();
 await page.getByRole('switch',{name:'集中表示',exact:true}).check();
 await page.getByRole('tab',{name:'SoundCloud設定',exact:true}).click();
 const url=page.url();
 await page.frameLocator('iframe[title="SoundCloudの設定"]').getByRole('radio',{name:'Light',exact:true}).check();
 await page.waitForFunction(()=>document.querySelector('soundsky-player').dataset.appearance==='light');
 const state=await page.evaluate(()=>{
  const host=document.querySelector('soundsky-player'),s=host.shadowRoot,queue=document.querySelector('[data-soundsky-queue]');
  return {playing:s.querySelector('.player').dataset.playing,queue:getComputedStyle(queue).backgroundColor,inner:getComputedStyle(queue.querySelector('.queue__scrollableInner')).backgroundColor,title:s.querySelector('.title-link').hasAttribute('data-title-overflow')};
 });
 if(page.url()!==url||state.playing!=='true'||state.queue!=='rgba(0, 0, 0, 0)'||state.inner!=='rgba(0, 0, 0, 0)'||!state.title)throw new Error(JSON.stringify(state));
 await player.locator('[data-command="settings"]').click();
 const art=await player.locator('.art-image').boundingBox();await page.mouse.move(art.x+art.width/2,art.y+art.height/2);
 await page.waitForFunction(()=>{
  const s=document.querySelector('soundsky-player').shadowRoot;
  return s.querySelector('.player').classList.contains('is-idle')&&getComputedStyle(s.querySelector('.controls')).opacity==='0';
 });
 await page.keyboard.press('Tab');
 await page.waitForFunction(()=>!document.querySelector('soundsky-player').shadowRoot.querySelector('.player').classList.contains('is-idle'));
 if(errors.length)throw new Error(errors.join('\n'));
 return {themeFollowsNative:true,queueTransparent:true,playbackStatePreserved:true,longTitles:true,idleChrome:true,keyboardWake:true};
}
