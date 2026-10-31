async page=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();
 const nativeTypography=await page.evaluate(()=>({queueDecoration:getComputedStyle(document.querySelector('.queueItemView__title a')).textDecorationLine,badgeDecoration:getComputedStyle(document.querySelector('.playbackSoundBadge__titleLink')).textDecorationLine}));
 const entry=page.locator('[data-soundsky-entry]');
 if(await entry.count()!==1||!await entry.isVisible())throw new Error('Entry is not docked');
 if(await page.locator('soundsky-player').locator('.launcher').isVisible())throw new Error('Floating entry remains');
 await entry.click();await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();await page.getByRole('tab',{name:'サイト',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();
 const overlay=await page.evaluate(()=>Array.from(document.querySelectorAll('.playControls,.playControls__inner')).map(e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter})));
 if(overlay.some(s=>s.background!=='rgba(0, 0, 0, 0)'||s.blur!=='none'))throw new Error('Native transport obscures SoundSky: '+JSON.stringify(overlay));
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 const launcher=await entry.evaluate(e=>{const r=e.getBoundingClientRect(),logo=e.querySelector('svg').getBoundingClientRect(),styles=getComputedStyle(e);return {width:r.width,height:r.height,logoWidth:logo.width,logoFits:logo.left>=r.left&&logo.right<=r.right&&logo.top>=r.top&&logo.bottom<=r.bottom,border:styles.borderWidth,background:styles.backgroundColor};});
 if(launcher.width!==48||launcher.height!==44||launcher.logoWidth!==30||!launcher.logoFits||launcher.border!=='0px'||launcher.background!=='rgba(0, 0, 0, 0)')throw new Error('Themed Now Playing entry is misaligned or boxed: '+JSON.stringify(launcher));
 await entry.hover();
 await page.waitForTimeout(120);
 if(!await entry.evaluate(e=>getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'))throw new Error('Now Playing entry has no hover feedback');
 await page.locator('.playbackSoundBadge__showQueue').click();
 const nativeQueue=await page.locator('.queue').evaluate(q=>({visible:q.classList.contains('m-visible'),background:getComputedStyle(q).backgroundColor,animation:getComputedStyle(q).animationName,title:getComputedStyle(q.querySelector('.queue__panel')).color,link:getComputedStyle(q.querySelector('.queueItemView__title a')).color}));
 if(!nativeQueue.visible||!nativeQueue.background.includes('24, 28, 32')||nativeQueue.link!==nativeQueue.title)throw new Error('Next Up retains native light surfaces: '+JSON.stringify(nativeQueue));
 const queueTypography=await page.evaluate(()=>{const row=document.querySelector('.queueItemView'),title=row.querySelector('.queueItemView__title'),meta=row.querySelector('.queueItemView__meta'),link=title.querySelector('a'),user=meta.querySelector('a'),cover=row.querySelector('.queueItemView__artworkImage'),badge=document.querySelector('.playbackSoundBadge');return {rowHeight:row.getBoundingClientRect().height,layout:getComputedStyle(row.querySelector('.queueItemView__details')).display,titleOrder:getComputedStyle(title).order,metaOrder:getComputedStyle(meta).order,linkDecoration:getComputedStyle(link).textDecorationLine,userDecoration:getComputedStyle(user).textDecorationLine,linkSize:getComputedStyle(link).fontSize,userSize:getComputedStyle(user).fontSize,coverRadius:getComputedStyle(cover).borderRadius,badgeTitleDecoration:getComputedStyle(badge.querySelector('.playbackSoundBadge__titleLink')).textDecorationLine,badgeArtistDecoration:getComputedStyle(badge.querySelector('.playbackSoundBadge__lightLink')).textDecorationLine};});
 if(queueTypography.rowHeight!==56||queueTypography.layout!=='flex'||queueTypography.titleOrder!=='0'||queueTypography.metaOrder!=='1'||queueTypography.linkDecoration!=='none'||queueTypography.userDecoration!=='none'||queueTypography.linkSize!=='13px'||queueTypography.userSize!=='11px'||queueTypography.coverRadius==='0px'||queueTypography.badgeTitleDecoration!=='none'||queueTypography.badgeArtistDecoration!=='none')throw new Error('Native queue hierarchy differs from SoundSky: '+JSON.stringify(queueTypography));
 const queueReveal=await page.locator('.queue__itemWrapper').evaluateAll(items=>items.slice(0,10).map(item=>{
  const row=item.querySelector('.queueItemView'),style=getComputedStyle(row);
  return {name:style.animationName,delay:parseFloat(style.animationDelay),height:row.getBoundingClientRect().height};
 }));
 if(queueReveal.length<9||queueReveal.slice(0,8).some((row,i)=>row.name!=='soundsky-queue-row-reveal'||row.height!==56||(i>0&&row.delay<=queueReveal[i-1].delay))||queueReveal[8].name!=='none')throw new Error('Native queue stagger changes row geometry or timing: '+JSON.stringify(queueReveal));
 await page.emulateMedia({reducedMotion:'reduce'});
 if(!await page.locator('.queue').evaluate(q=>getComputedStyle(q).animationName==='none')||!await entry.evaluate(e=>getComputedStyle(e.querySelector('svg')).transitionDuration==='0s')||!await page.locator('.queueItemView').first().evaluate(row=>getComputedStyle(row).animationName==='none'))throw new Error('Reduced-motion preference still animates native UI');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.queue__hide').click();
 // Match native timeline children; test the visuals without replacing native event owners.
 await page.evaluate(()=>{document.querySelector('.playControls__elements').insertAdjacentHTML('afterbegin','<div class="playControls__shuffle"><button class="shuffleControl"><div><svg></svg></div>Shuffle</button></div><div class="playControls__repeat"><button class="repeatControl"><div><svg></svg></div>Repeat</button></div>');const p=document.querySelector('.playbackTimeline__progressWrapper');p.insertAdjacentHTML('beforeend','<div class="playbackTimeline__progressBar"></div><div class="playbackTimeline__progressHandle"></div>');});
 await page.evaluate(()=>{const style=document.createElement('style');style.textContent='.playbackTimeline{display:flex;height:48px;align-items:stretch}.playbackTimeline__progressWrapper{padding:12px 0;box-sizing:content-box}.playbackTimeline__progressBar,.playbackTimeline__progressHandle{position:absolute}.playbackTimeline__progressHandle{margin-top:-3px}html[data-soundsky-theme] .playControl:focus,html[data-soundsky-theme] .playControl:active,html[data-soundsky-theme] .playControl.playing{background:var(--sky-site-accent)!important}.playControl>span{margin-left:8px;text-indent:-99999px}.playControl{background-image:linear-gradient(red,blue)}.playControl svg{color:#121212}.playControl path{stroke:none;fill:#121212}';document.head.append(style);});
 await page.waitForTimeout(350);
 const glyphFits=await page.locator('.playControl').evaluate(e=>{const b=e.getBoundingClientRect(),s=e.querySelector('[data-soundsky-glyph] svg').getBoundingClientRect();return s.x>=b.x&&s.right<=b.right&&s.y>=b.y&&s.bottom<=b.bottom&&getComputedStyle(e).backgroundImage.includes('conic-gradient');});
 const nativeIcons=await page.evaluate(()=>['shuffle','repeat'].every(name=>{const wrapper=document.querySelector('.playControls__'+name),button=wrapper.querySelector('button');return !wrapper.hasAttribute('data-soundsky-control') && button.querySelectorAll('[data-soundsky-glyph]').length===1 && getComputedStyle(button.querySelector('div')).opacity==='0';}));
 if(!nativeIcons)throw new Error('Shuffle/repeat original glyph overlaps shared glyph');
 const seekMatch=await page.evaluate(()=>{const p=document.querySelector('.playbackTimeline__progressWrapper'),bar=p.querySelector('.playbackTimeline__progressBar'),surface=p.querySelector('[data-soundsky-seek]'),thumb=p.querySelector('.playbackTimeline__progressHandle');return getComputedStyle(bar).height==='5px' && Math.abs(surface.getBoundingClientRect().width-p.getBoundingClientRect().width)<1 && getComputedStyle(thumb).width==='9px' && getComputedStyle(document.querySelector('.playControl')).borderWidth==='0px';});
 const knobCentered=await page.locator('.playbackTimeline__progressWrapper').evaluate(e=>{const b=e.querySelector('.playbackTimeline__progressBar').getBoundingClientRect(),h=e.querySelector('.playbackTimeline__progressHandle').getBoundingClientRect();return Math.abs(b.y+b.height/2-h.y-h.height/2)<.5;});
 const timelineCentered=await page.locator('.playbackTimeline').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.querySelector('.playbackTimeline__progressWrapper').getBoundingClientRect(),b=e.querySelector('.playbackTimeline__progressBar').getBoundingClientRect();return Math.abs(r.y+r.height/2-b.y-b.height/2)<.5 && p.height===24;});
 if(!timelineCentered)throw new Error('Seek bar is above timeline center');
 if(!knobCentered)throw new Error('Native knob is above seek bar');
 if(!seekMatch)throw new Error('Seek geometry/material or play border differs');
 if(!glyphFits)throw new Error('Native styles displace or duplicate SoundSky glyph');
 await page.locator('.playControl').click();await page.waitForTimeout(350);
 if(!await page.locator('.playControl [data-soundsky-glyph] path').evaluate(e=>getComputedStyle(e).stroke==='rgb(255, 255, 255)'&&getComputedStyle(e).strokeWidth==='4px'))throw new Error('Native CSS erases the pause glyph');
 if(!await page.locator('.playControl').evaluate(e=>getComputedStyle(e).backgroundImage.includes('conic-gradient')&&getComputedStyle(e.querySelector('[data-soundsky-metal]')).zIndex==='1'))throw new Error('Native click/keyboard state replaces metal with accent');
 await page.locator('.playControl').press('Space');await page.waitForTimeout(100);
 if(!await page.locator('.playControl').evaluate(e=>getComputedStyle(e).backgroundImage.includes('conic-gradient')&&getComputedStyle(e.querySelector('[data-soundsky-metal]')).zIndex==='1'))throw new Error('Space paints the play control');
 await page.locator('.playControl').press('Space');await page.waitForTimeout(100);
 const metalDrawn=await page.locator('.playControl [data-soundsky-metal]').evaluate(e=>{const mount=e.querySelector('[data-paper-shader]').paperShaderMount,gl=mount.gl;if(gl.isContextLost())return false;mount.setFrame(9000);const pixels=new Uint8Array(gl.canvas.width*gl.canvas.height*4);gl.readPixels(0,0,gl.canvas.width,gl.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let min=255,max=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>0){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);}}return max-min>30;});
 if(!metalDrawn)throw new Error('Play/pause state loses the rendered metal texture');
 // Native rerenders must not recreate the GPU canvas or jump back to frame zero.
 await page.evaluate(()=>{
  const control=document.querySelector('.playControl');window.savedMetal=control.querySelector('[data-soundsky-metal]');window.savedCanvas=window.savedMetal.querySelector('canvas');window.savedMount=window.savedMetal.querySelector('[data-paper-shader]').paperShaderMount;
  const native=control.onclick;control.onclick=function(event){native.call(this,event);this.replaceChildren(document.createElement('div'));this.removeAttribute('data-soundsky-control');window.immediatePlayBackground=getComputedStyle(this).backgroundImage;};
 });
 await page.locator('.playControl').click();await page.waitForTimeout(180);
 const retained=await page.evaluate(()=>({sameCanvas:document.querySelector('.playControl canvas')===window.savedCanvas,sameMount:document.querySelector('.playControl [data-paper-shader]').paperShaderMount===window.savedMount,immediateBackground:window.immediatePlayBackground,phase:window.savedMount.getCurrentFrame?.()}));
 if(!retained.sameCanvas||!retained.sameMount||retained.phase<9000||!retained.immediateBackground.includes('conic-gradient'))throw new Error('Pause rebuilds shader or flashes accent: '+JSON.stringify(retained));
 await page.evaluate(()=>{const play=document.querySelector('.playControl');const handler=play.onclick;play.onclick=function(e){handler.call(this,e);const replacement=this.cloneNode(false);replacement.onclick=this.onclick;this.replaceWith(replacement);};});
 await page.locator('.playControl').press('Space');await page.waitForTimeout(180);
 if(!await page.evaluate(()=>document.querySelector('.playControl canvas')===window.savedCanvas&&document.querySelector('.playControl [data-paper-shader]').paperShaderMount===window.savedMount))throw new Error('Resume resets shader');

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
 await entry.click();await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();await page.getByRole('tab',{name:'サイト',exact:true}).click();await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).uncheck();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 if(await page.locator('[data-soundsky-control],[data-soundsky-metal],[data-soundsky-seek],[data-soundsky-progress]').count())throw new Error('Theme leaves native overrides');
 const restoredTypography=await page.evaluate(()=>({queueDecoration:getComputedStyle(document.querySelector('.queueItemView__title a')).textDecorationLine,badgeDecoration:getComputedStyle(document.querySelector('.playbackSoundBadge__titleLink')).textDecorationLine}));
 if(JSON.stringify(restoredTypography)!==JSON.stringify(nativeTypography))throw new Error('Theme leaves native typography overrides: '+JSON.stringify({nativeTypography,restoredTypography}));
 if(await entry.count()!==1)throw new Error('Entry duplicated');
 await page.locator('.playControl').click();if(await page.locator('.playControl').getAttribute('title')!=='Pause current')throw new Error('Native handler lost after restoring');
 return {entryDocked:true,floatingEntryHidden:true,soundSkyControlsUnobscured:true,nativeQueueTypography:true,nativePlayPreserved:true,icons:true,metal:true,shaderSeek:true,progressBetweenNativeTicks:true,pauseStable:true,shaderInstancePreserved:true,noAccentFlashDuringRedraw:true,dragPreserved:true,themeOffRestores:true};
}
