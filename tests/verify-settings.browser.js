// Against npm run dev, using playwright-cli run-code --filename.
async page => {
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();
 await page.getByRole('tab',{name:'見た目',exact:true}).click();
 await page.waitForFunction(()=>{
  const s=document.querySelector('soundsky-player').shadowRoot;
  const player=s.querySelector('.shell').getBoundingClientRect(), panel=s.querySelector('.settings-panel').getBoundingClientRect();
  return player.width<innerWidth-300 && Math.abs(player.right-panel.left)<2 && Math.abs(panel.right-innerWidth)<2;
 });
 await page.locator('soundsky-player').locator('[data-command="play"]').click();
 if ((await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).getAttribute('aria-expanded'))!=='false') throw new Error('Clicking outside settings does not close the drawer');
 await page.waitForFunction(()=>!document.querySelector('soundsky-player').shadowRoot.querySelector('.settings-panel').matches(':popover-open'));
 await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();
 await page.screenshot({path:'output/playwright/settings-cover-ja.png'});
 await page.getByRole('tab',{name:'見た目',exact:true}).click();
 await page.locator('summary').filter({hasText:'カバーの反応を調整'}).click();
 await page.getByRole('slider',{name:'赤い光の反応',exact:true}).fill('2');
 if ((await page.locator('soundsky-player').locator('#val-heatResponse').textContent())!=='2.0倍') throw new Error('Response value is unclear');
 await page.getByRole('switch',{name:'カバー周囲の光',exact:true}).uncheck();
 if (!(await page.getByRole('slider',{name:'赤い光の反応',exact:true}).isDisabled())) throw new Error('Disabled heat remains adjustable');
 await page.getByRole('switch',{name:'カバー周囲の光',exact:true}).check();
 await page.reload();
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'SoundSkyの設定',exact:true}).click();
 await page.getByRole('tab',{name:'見た目',exact:true}).click();
 await page.locator('summary').filter({hasText:'カバーの反応を調整'}).click();
 if ((await page.getByRole('slider',{name:'赤い光の反応',exact:true}).inputValue())!=='2') throw new Error('Response preference was lost');
 await page.getByRole('button',{name:'赤い光の反応を標準に戻す',exact:true}).click();
 if ((await page.getByRole('slider',{name:'赤い光の反応',exact:true}).inputValue())!=='1') throw new Error('Individual default reset failed');
 await page.screenshot({path:'output/playwright/settings-light-ja.png'});
 await page.getByRole('tab',{name:'再生',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'output/playwright/settings-controls-ja-mobile.png'});
 const fits=await page.evaluate(()=>{const panel=document.querySelector('soundsky-player').shadowRoot.querySelector('.settings-panel');return panel.scrollWidth<=panel.clientWidth});
 if(!fits) throw new Error('Settings overflow horizontally on mobile');
 return {japaneseLabels:true,individualReset:true,preferencePersists:true,disabledControls:true,mobileFits:true};
}
