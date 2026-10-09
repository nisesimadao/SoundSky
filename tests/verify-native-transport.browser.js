async page=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();
 const entry=page.locator('[data-soundsky-entry]');
 if(await entry.count()!==1||!await entry.isVisible())throw new Error('Entry is not docked');
 if(await page.locator('soundsky-player').locator('.launcher').isVisible())throw new Error('Floating entry remains');
 await entry.click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();
 const overlay=await page.evaluate(()=>Array.from(document.querySelectorAll('.playControls,.playControls__inner')).map(e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter})));
 if(overlay.some(s=>s.background!=='rgba(0, 0, 0, 0)'||s.blur!=='none'))throw new Error('Native transport obscures SoundSky: '+JSON.stringify(overlay));
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 // Match native timeline children; test the visuals without replacing native event owners.
 await page.evaluate(()=>{document.querySelector('.playControls__elements').insertAdjacentHTML('afterbegin','<div class="playControls__shuffle"><button class="shuffleControl"><div><svg></svg></div>Shuffle</button></div><div class="playControls__repeat"><button class="repeatControl"><div><svg></svg></div>Repeat</button></div>');const p=document.querySelector('.playbackTimeline__progressWrapper');p.insertAdjacentHTML('beforeend','<div class="playbackTimeline__progressBar"></div><div class="playbackTimeline__progressHandle"></div>');});
 await page.evaluate(()=>{const style=document.createElement('style');style.textContent='.playbackTimeline__progressBar,.playbackTimeline__progressHandle{position:absolute}.playbackTimeline__progressHandle{margin-top:-3px}html[data-soundsky-theme] .playControl:focus,html[data-soundsky-theme] .playControl:active,html[data-soundsky-theme] .playControl.playing{background:var(--sky-site-accent)!important}.playControl>span{margin-left:8px;text-indent:-99999px}.playControl{background-image:linear-gradient(red,blue)}.playControl svg{color:#121212}.playControl path{stroke:none;fill:#121212}';document.head.append(style);});
 await page.waitForTimeout(350);
 const glyphFits=await page.locator('.playControl').evaluate(e=>{const b=e.getBoundingClientRect(),s=e.querySelector('[data-soundsky-glyph] svg').getBoundingClientRect();return s.x>=b.x&&s.right<=b.right&&s.y>=b.y&&s.bottom<=b.bottom&&getComputedStyle(e).backgroundImage==='none';});
 const nativeIcons=await page.evaluate(()=>['shuffle','repeat'].every(name=>{const wrapper=document.querySelector('.playControls__'+name),button=wrapper.querySelector('button');return !wrapper.hasAttribute('data-soundsky-control') && button.querySelectorAll('[data-soundsky-glyph]').length===1 && getComputedStyle(button.querySelector('div')).opacity==='0';}));
 if(!nativeIcons)throw new Error('Shuffle/repeat original glyph overlaps shared glyph');
 const seekMatch=await page.evaluate(()=>{const p=document.querySelector('.playbackTimeline__progressWrapper'),bar=p.querySelector('.playbackTimeline__progressBar'),surface=p.querySelector('[data-soundsky-seek]'),thumb=p.querySelector('.playbackTimeline__progressHandle');return getComputedStyle(bar).height==='5px' && Math.abs(surface.getBoundingClientRect().width-p.getBoundingClientRect().width)<1 && getComputedStyle(thumb).width==='9px' && getComputedStyle(document.querySelector('.playControl')).borderWidth==='0px';});
 const knobCentered=await page.locator('.playbackTimeline__progressWrapper').evaluate(e=>{const b=e.querySelector('.playbackTimeline__progressBar').getBoundingClientRect(),h=e.querySelector('.playbackTimeline__progressHandle').getBoundingClientRect();return Math.abs(b.y+b.height/2-h.y-h.height/2)<.5;});
 if(!knobCentered)throw new Error('Native knob is above seek bar');
 if(!seekMatch)throw new Error('Seek geometry/material or play border differs');
 if(!glyphFits)throw new Error('Native styles displace or duplicate SoundSky glyph');
 await page.locator('.playControl').click();await page.waitForTimeout(350);
 if(!await page.locator('.playControl [data-soundsky-glyph] path').evaluate(e=>getComputedStyle(e).stroke==='rgb(255, 255, 255)'&&getComputedStyle(e).strokeWidth==='4px'))throw new Error('Native CSS erases the pause glyph');
 if(!await page.locator('.playControl').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(180, 181, 184)'))throw new Error('Native click/keyboard state replaces metal with accent');
 await page.locator('.playControl').press('Space');await page.waitForTimeout(100);
 if(!await page.locator('.playControl').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(180, 181, 184)'))throw new Error('Space paints the play control');
 await page.locator('.playControl').press('Space');await page.waitForTimeout(100);
 if(await page.locator('.playControl').getAttribute('title')!=='Pause current')throw new Error('Native playback handler lost');
 const before=await page.evaluate(()=>({native:Number(document.querySelector('.playbackTimeline__progressWrapper').getAttribute('aria-valuenow')),visual:parseFloat(document.querySelector('.playbackTimeline__progressWrapper').style.getPropertyValue('--soundsky-progress')),playing:document.querySelector('.playControl [data-soundsky-glyph]').dataset.icon,metal:!!document.querySelector('[data-soundsky-metal] canvas'),seek:!!document.querySelector('[data-soundsky-seek] canvas')}));
 await page.waitForTimeout(120);
 const after=await page.evaluate(()=>({native:Number(document.querySelector('.playbackTimeline__progressWrapper').getAttribute('aria-valuenow')),visual:parseFloat(document.querySelector('.playbackTimeline__progressWrapper').style.getPropertyValue('--soundsky-progress'))}));
 if(after.visual<=before.visual||before.native!==after.native||!before.metal||!before.seek||before.playing!=='pause')throw new Error(JSON.stringify({before,after}));
 await page.locator('.playControl').click();await page.waitForTimeout(150);
 const paused=await page.evaluate(()=>document.querySelector('.playbackTimeline__progressWrapper').style.getPropertyValue('--soundsky-progress'));await page.waitForTimeout(180);
 if(paused!==await page.evaluate(()=>document.querySelector('.playbackTimeline__progressWrapper').style.getPropertyValue('--soundsky-progress')))throw new Error('Paused timeline moves');
 // Pointer drag temporarily hands the visual position back to the native control.
 await page.locator('.playbackTimeline__progressWrapper').dispatchEvent('pointerdown');await page.waitForTimeout(50);
 if(await page.locator('[data-soundsky-progress]').count())throw new Error('Smoothing fights native drag');
 await page.locator('.playbackTimeline__progressWrapper').dispatchEvent('pointerup');await page.waitForTimeout(50);
 if(!await page.locator('[data-soundsky-progress]').count())throw new Error('Smoothing fails to resume');
 await entry.click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).uncheck();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 if(await page.locator('[data-soundsky-control],[data-soundsky-metal],[data-soundsky-seek],[data-soundsky-progress]').count())throw new Error('Theme leaves native overrides');
 if(await entry.count()!==1)throw new Error('Entry duplicated');
 await page.locator('.playControl').click();if(await page.locator('.playControl').getAttribute('title')!=='Pause current')throw new Error('Native handler lost after restoring');
 return {entryDocked:true,floatingEntryHidden:true,soundSkyControlsUnobscured:true,nativePlayPreserved:true,icons:true,metal:true,shaderSeek:true,progressBetweenNativeTicks:true,pauseStable:true,dragPreserved:true,themeOffRestores:true};
}
