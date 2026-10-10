async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));await page.reload();await page.addScriptTag({path:'dist/audio.js'});
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'操作部分',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'レコードのように再生・停止',exact:true});if(await toggle.isChecked())throw new Error('Record effect is enabled by default');await toggle.check();await page.waitForTimeout(50);
 if(!await page.evaluate(()=>JSON.parse(localStorage.getItem('soundsky:settings')).turntable))throw new Error('Record preference is not saved');await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 await page.evaluate(()=>{
  const play=document.querySelector('.playControl');window.recordClicks=0;
  play.onclick=()=>{window.recordClicks++;const playing=play.classList.toggle('playing');play.title=playing?'Pause current':'Play current';if(playing){window.recordContext??=new AudioContext();const ctx=window.recordContext;void ctx.resume();const buffer=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=Math.sin(i/ctx.sampleRate*2*Math.PI*440)*.015;window.recordSource=ctx.createBufferSource();window.recordSource.buffer=buffer;const gain=ctx.createGain();gain.gain.value=.005;window.recordSource.connect(gain).connect(ctx.destination);window.recordSource.start();window.recordSamples=[];const source=window.recordSource,start=ctx.currentTime;const sampling=setInterval(()=>{window.recordSamples.push(source.playbackRate.value);if(ctx.currentTime-start>.5)clearInterval(sampling);},10);}else window.recordSource.stop();};
 });
 await page.locator('.playControl').click();await page.waitForFunction(()=>window.recordSamples?.some(rate=>rate<.95),null,{timeout:5000});
 const up=await page.evaluate(()=>Math.min(...window.recordSamples));if(up>=.95||up<.079)throw new Error('Real buffer does not spin up: '+up);await page.waitForFunction(()=>Math.abs(window.recordSource.playbackRate.value-1)<.001,null,{timeout:5000});
 const normal=await page.evaluate(()=>window.recordSource.playbackRate.value);if(Math.abs(normal-1)>.001)throw new Error('Record never reaches original pitch');
 await page.locator('.playControl').click();await page.waitForTimeout(180);
 const down=await page.evaluate(()=>({rate:window.recordSource.playbackRate.value,clicks:window.recordClicks}));if(down.rate>=.95||down.rate<=.04||down.clicks!==1)throw new Error('Record is paused before slowing: '+JSON.stringify(down));
 await page.waitForTimeout(350);if(await page.evaluate(()=>window.recordClicks)!==2)throw new Error('Native pause is not committed');
 await page.locator('.playControl').press('Space');await page.waitForTimeout(70);if(await page.evaluate(()=>window.recordClicks)!==3||await page.evaluate(()=>window.recordSource.playbackRate.value)>=.95)throw new Error('Space does not spin up');await page.waitForTimeout(300);
 await page.locator('.playControl').click();await page.waitForTimeout(50);await page.locator('.playControl').click();await page.waitForTimeout(500);if(await page.evaluate(()=>window.recordClicks)!==3)throw new Error('Fast reversal still commits an old pause');
 await page.locator('.playControl').click();await page.waitForTimeout(40);await page.evaluate(()=>window.postMessage({type:'soundsky:turntable',enabled:false},location.origin));await page.waitForTimeout(500);
 if(!await page.evaluate(()=>window.recordClicks===3&&Math.abs(window.recordSource.playbackRate.value-1)<.001))throw new Error('Disabling an active curve retains pitch change or commits a stale pause');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();await page.getByRole('button',{name:'見た目の設定',exact:true}).click();await page.getByRole('tab',{name:'操作部分',exact:true}).click();await toggle.uncheck();await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();await page.waitForTimeout(60);await page.locator('.playControl').click();
 if(await page.evaluate(()=>window.recordClicks)!==4)throw new Error('Disabled effect delays native pause');
 // Verify actual rendered pitch with an OfflineAudioContext, independent of clock and UI timing.
 const pitch=await page.evaluate(async()=>{
  const ctx=new OfflineAudioContext(1,48000,48000),buffer=ctx.createBuffer(1,48000,48000),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.sin(i/48000*2*Math.PI*440);
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);const curve=new Float32Array(64);for(let i=0;i<64;i++){const t=i/63;curve[i]=1-.96*t*t*(3-2*t);}source.playbackRate.setValueCurveAtTime(curve,0,.42);source.start();const rendered=(await ctx.startRendering()).getChannelData(0);
  const frequency=(a,b)=>{let crossings=0;for(let i=Math.floor(a*48000)+1;i<Math.floor(b*48000);i++)if(rendered[i-1]<=0&&rendered[i]>0)crossings++;return crossings/(b-a);};return {early:frequency(.01,.06),late:frequency(.34,.39)};
 });
 if(pitch.early<350||pitch.late>150||pitch.late>=pitch.early)throw new Error('Rate automation does not lower rendered pitch: '+JSON.stringify(pitch));
 await page.evaluate(()=>window.recordContext.close());if(errors.length)throw new Error(errors.join('\n'));
 return {toggleSaved:true,defaultOff:true,realSpinUp:up,realSpinDown:down.rate,normalRate:normal,space:true,rapidReversal:true,offImmediate:true,activeCurveRestored:true,renderedPitchHz:pitch,noRuntimeErrors:true};
}
