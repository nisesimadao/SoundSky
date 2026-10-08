async page=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();
 const original=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'見た目の設定',exact:true}).click();
 await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true});
 if(await toggle.isChecked())throw new Error('Site theme is not opt-in');await toggle.check();
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();await page.waitForTimeout(1200);
 const state=await page.evaluate(()=>({theme:document.documentElement.hasAttribute('data-soundsky-theme'),bg:getComputedStyle(document.body).backgroundColor,accent:document.documentElement.style.getPropertyValue('--sky-site-accent'),expected:document.querySelector('soundsky-player').style.getPropertyValue('--accent'),radius:getComputedStyle(document.querySelector('.playControl')).borderRadius,shader:!!document.querySelector('[data-soundsky-site-shader] canvas')}));
 if(!state.theme||state.bg===original||state.accent!==state.expected||!state.shader)throw new Error('Native theme or artwork accent missing');
 await page.getByRole('button',{name:'Play',exact:true}).first().click();
 if(await page.locator('.playControl').getAttribute('title')!=='Pause current')throw new Error('Theme breaks native playback');
 await page.screenshot({path:'output/playwright/site-theme-fixture.png'});
 await page.route('**/site-theme-frame-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main class="bg-white"><h1>Track page</h1><button>Play</button></main>'}));
 await page.evaluate(()=>{const f=document.createElement('iframe');f.id='site-theme-frame-test';f.src='/site-theme-frame-test';document.body.append(f);});
 const frame=page.frames().find(f=>f.parentFrame());
 await frame.waitForLoadState();
 await frame.evaluate(()=>{window.chrome={storage:{local:{get:async()=>({'soundsky:settings':{modernSoundCloud:true}})},onChanged:{addListener(){},removeListener(){}}}};});
 await frame.addScriptTag({path:'dist/theme-frame.js'});await page.waitForTimeout(300);
 const embedded=await frame.evaluate(()=>({theme:document.documentElement.hasAttribute('data-soundsky-theme'),accent:document.documentElement.style.getPropertyValue('--sky-site-accent')}));
 if(!embedded.theme||embedded.accent!==await page.evaluate(()=>document.documentElement.style.getPropertyValue('--sky-site-accent')))throw new Error('Embedded page misses theme or current accent');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();
 await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).uncheck();await page.waitForTimeout(100);
 if(await frame.evaluate(()=>document.documentElement.hasAttribute('data-soundsky-theme')))throw new Error('Embedded theme does not switch off');
 await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).check();
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();

 await page.reload();await page.waitForTimeout(300);
 if(!await page.evaluate(()=>document.documentElement.hasAttribute('data-soundsky-theme')))throw new Error('Site theme preference lost');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 if(!await page.evaluate(()=>{const p=document.querySelector('soundsky-player').shadowRoot.querySelector('.settings-panel');return p.scrollWidth<=p.clientWidth;}))throw new Error('New setting overflows mobile');
 await page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true}).uncheck();
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 if(await page.evaluate(()=>document.querySelector('[data-soundsky-site-style]')||document.querySelector('[data-soundsky-site-shader]')||getComputedStyle(document.body).backgroundColor!== 'rgb(236, 236, 236)'))throw new Error('Theme fails to restore native appearance');
 return {embeddedPage:true,themeOutsidePlayer:true,artworkAccent:true,shader:true,nativePlayWorks:true,persists:true,mobileFits:true,restores:true};
}
