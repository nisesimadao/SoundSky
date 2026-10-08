async page=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();
 await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend',`<style>.tileGallery{position:relative;width:600px}.tileGallery__slider{width:600px;overflow:hidden}.tileGallery__sliderPanel{display:flex;transform:translateX(-100px)}.tileGallery__sliderPanelSlide{flex:0 0 200px;height:208px;background:#345}.tileGallery__sliderPeek{position:absolute;right:0;top:40px}.tileGallery__sliderPeekBackward{left:0;right:auto}</style><div class="tileGallery"><div class="tileGallery__slider"><div class="tileGallery__sliderPanel">${Array.from({length:8},(_,i)=>`<div class="tileGallery__sliderPanelSlide">Album ${i}</div>`).join('')}</div></div><div class="tileGallery__sliderPeek tileGallery__sliderPeekForward"><button class="tileGallery__sliderButton tileGallery__slideForwardButton">forward</button></div><div class="tileGallery__sliderPeek tileGallery__sliderPeekBackward"><button class="tileGallery__sliderButton tileGallery__slideBackwardButton">backward</button></div></div>`));
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 const slider=page.locator('.tileGallery__slider');
 await slider.hover();await page.mouse.wheel(160,0);await page.waitForTimeout(180);
 if(await slider.evaluate(e=>e.scrollLeft)<100)throw new Error('Trackpad horizontal scroll missing');
 const left=await slider.evaluate(e=>e.scrollLeft);
 await page.getByRole('button',{name:'forward',exact:true}).click();await page.waitForTimeout(700);
 if(await slider.evaluate(e=>e.scrollLeft)<=left)throw new Error('Arrow no longer scrolls');
 const shadow=await page.locator('.tileGallery__slideForwardButton').evaluate(e=>getComputedStyle(e).boxShadow);
 if(shadow==='none')throw new Error('Arrow shadow missing');
 const horizontal=await slider.evaluate(e=>e.scrollLeft);await page.mouse.wheel(0,100);await page.waitForTimeout(120);
 if(await slider.evaluate(e=>e.scrollLeft)!==horizontal)throw new Error('Vertical scroll hijacked');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).uncheck();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 if(await slider.evaluate(e=>e.scrollLeft)!==0)throw new Error('Native scroll position not restored');
 return {trackpad:true,arrows:true,shadow:true,verticalScrollPreserved:true,offRestores:true};
}
