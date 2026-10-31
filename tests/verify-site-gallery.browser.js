async page=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();
 await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend',`<style>.tileGallery{position:relative;width:600px}.tileGallery__slider{width:600px;overflow:hidden}.tileGallery__sliderPanel{display:flex;transform:translateX(-100px)}.tileGallery__sliderPanelSlide{flex:0 0 200px;height:208px;background:#345}.tileGallery__sliderPeek{position:absolute;right:0;top:40px}.tileGallery__sliderPeekBackward{left:0;right:auto}</style><div class="tileGallery"><div class="tileGallery__slider"><div class="tileGallery__sliderPanel">${Array.from({length:8},(_,i)=>`<div class="tileGallery__sliderPanelSlide">Album ${i}</div>`).join('')}</div></div><div class="tileGallery__sliderPeek tileGallery__sliderPeekForward"><button class="tileGallery__sliderButton tileGallery__slideForwardButton">forward</button></div><div class="tileGallery__sliderPeek tileGallery__sliderPeekBackward"><button class="tileGallery__sliderButton tileGallery__slideBackwardButton">backward</button></div></div>`));
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();await page.getByRole('tab',{name:'サイト',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 const slider=page.locator('.tileGallery__slider').first();
 await slider.hover();await page.mouse.wheel(160,0);await page.waitForTimeout(180);
 if(await slider.evaluate(e=>e.scrollLeft)<100)throw new Error('Trackpad horizontal scroll missing');
 const left=await slider.evaluate(e=>e.scrollLeft);
 await page.getByRole('button',{name:'forward',exact:true}).click();await page.waitForTimeout(700);
 if(await slider.evaluate(e=>e.scrollLeft)<=left)throw new Error('Arrow no longer scrolls');
 const shadow=await page.locator('.tileGallery__slideForwardButton').evaluate(e=>getComputedStyle(e).boxShadow);
 if(shadow==='none')throw new Error('Arrow shadow missing');
 await page.evaluate(()=>{const gallery=document.createElement('div');gallery.className='tileGallery';gallery.id='lazy-gallery';gallery.innerHTML='<div class="tileGallery__slider"><div class="tileGallery__sliderPanel">'+Array.from({length:20},(_,i)=>'<div class="tileGallery__sliderPanelSlide" data-tile-index="'+i+'">'+(i<5?'<div>Album '+i+'</div>':'')+'</div>').join('')+'</div></div><button class="tileGallery__sliderButton tileGallery__slideForwardButton">lazy forward</button>';document.querySelector('main').append(gallery);let loaded=5;gallery.querySelector('button').onclick=()=>{loaded=Math.min(20,loaded+4);gallery.querySelector('.tileGallery__sliderPanel').style.transform='translate3d(-1000px,0,0)';for(const [i,slide]of [...gallery.querySelectorAll('.tileGallery__sliderPanelSlide')].entries())if(i<loaded&&!slide.children.length)slide.innerHTML='<div>Album '+i+'</div>';gallery.dataset.loaded=String(loaded);};});
 await page.waitForTimeout(80);
 await page.locator('#lazy-gallery .tileGallery__slider').evaluate(e=>e.scrollLeft=3400);await page.waitForTimeout(250);
 const populated=await page.locator('#lazy-gallery').evaluate(g=>({loaded:Number(g.dataset.loaded),scroll:g.querySelector('.tileGallery__slider').scrollLeft,max:g.querySelector('.tileGallery__slider').scrollWidth-g.querySelector('.tileGallery__slider').clientWidth}));
 if(populated.loaded!==20||populated.scroll!==populated.max)throw new Error('Gallery reaches empty native placeholders: '+JSON.stringify(populated));
 const horizontal=await slider.evaluate(e=>e.scrollLeft);await page.mouse.wheel(0,100);await page.waitForTimeout(120);
 if(await slider.evaluate(e=>e.scrollLeft)!==horizontal)throw new Error('Vertical scroll hijacked');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();await page.getByRole('tab',{name:'サイト',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).uncheck();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 if(await slider.evaluate(e=>e.scrollLeft)!==0)throw new Error('Native scroll position not restored');
 return {trackpad:true,arrows:true,shadow:true,verticalScrollPreserved:true,offRestores:true};
}
