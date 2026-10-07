async page => {
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>localStorage.removeItem('soundsky:settings'));
 await page.reload();
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'見た目の設定',exact:true}).click();
 await page.getByRole('tab',{name:'背景',exact:true}).click();
 const slider=page.getByRole('slider',{name:'画面のゆらぎ',exact:true});
 if(await slider.inputValue()!=='0')throw new Error('Scene sway is enabled by default');
 await page.evaluate(()=>{const input=document.querySelector('soundsky-player').shadowRoot.querySelector('#setting-sceneSway');input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByRole('button',{name:'見た目の設定',exact:true}).click();
 await page.getByRole('button',{name:'Play',exact:true}).last().click();
 await page.waitForTimeout(1200);
 const compare=()=>page.evaluate(()=>{
  const s=document.querySelector('soundsky-player').shadowRoot;
  const aperture=s.querySelector('.queue-aperture').getBoundingClientRect();
  const queue=document.querySelector('[data-soundsky-queue]').getBoundingClientRect();
  const x=parseFloat(document.querySelector('soundsky-player').style.getPropertyValue('--soundsky-scene-x'))||0;
  const y=parseFloat(document.querySelector('soundsky-player').style.getPropertyValue('--soundsky-scene-y'))||0;
  if(Math.abs(aperture.left-queue.left)>1.1||Math.abs(aperture.top-queue.top)>1.1)throw new Error('Native Queue drifts out of position');
  if(Math.abs(x)>14||Math.abs(y)>14)throw new Error('Sway exceeds its subtle bounds');
  return {x,y};
 });
 const coversEdges=()=>page.evaluate(()=>{
  const host=document.querySelector('soundsky-player'),shadow=host.shadowRoot;
  const oldX=host.style.getPropertyValue('--soundsky-scene-x'),oldY=host.style.getPropertyValue('--soundsky-scene-y');
  try {
   for(const x of [-14,14])for(const y of [-14,14]){
    host.style.setProperty('--soundsky-scene-x',`${x}px`);host.style.setProperty('--soundsky-scene-y',`${y}px`);
    for(const selector of ['.ambient','.ambient-fallback','.atmosphere','.veil']){
     const layer=shadow.querySelector(selector);if(layer.hidden)continue;
     const r=layer.getBoundingClientRect();
     if(r.left>0||r.top>0||r.right<innerWidth||r.bottom<innerHeight)throw new Error(`${selector} exposes a viewport edge`);
    }
   }
  } finally {host.style.setProperty('--soundsky-scene-x',oldX);host.style.setProperty('--soundsky-scene-y',oldY);}
 });
 await coversEdges();
 const initial=await compare();if(Math.hypot(initial.x,initial.y)<.02)throw new Error('Sway is frozen');
 const kickResult=await page.evaluate(async()=>{
  const host=document.querySelector('soundsky-player');
  const y=()=>parseFloat(host.style.getPropertyValue('--soundsky-scene-y'))||0;
  const read=()=>({x:parseFloat(host.style.getPropertyValue('--soundsky-scene-x'))||0,y:y()});
  const travel=async(count)=>{let last=read(),sum=0;for(let i=0;i<count;i++){await new Promise(r=>requestAnimationFrame(r));const next=read();sum+=Math.hypot(next.x-last.x,next.y-last.y);last=next;}return sum;};
  const normal=await travel(20);
  window.postMessage({type:'soundsky:audio',level:.3,onset:.1,bassOnset:.5},location.origin);
  const accelerated=await travel(20);
  if(accelerated<normal*3)throw new Error('Kick does not accelerate the route');
  return {kickAcceleration:true};
 });
 await compare();

 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await compare();await coversEdges();
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);
 const reduced=await compare();if(reduced.x||reduced.y)throw new Error('Reduced Motion does not stop sway');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('button',{name:'Pause',exact:true}).last().click({force:true});
 await page.waitForTimeout(3000);const paused=await compare();if(Math.abs(paused.x)>.04)throw new Error('Pause does not return scene to rest');
 await page.getByRole('button',{name:'Back to SoundCloud',exact:true}).click();
 const clean=await page.evaluate(()=>!document.querySelector('soundsky-player').style.getPropertyValue('--soundsky-scene-x')&&!document.querySelector('[data-soundsky-queue]'));
 if(!clean)throw new Error('Sway persists after close');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'見た目の設定',exact:true}).click();
 await page.getByRole('tab',{name:'背景',exact:true}).click();
 await page.getByRole('button',{name:'画面のゆらぎを標準に戻す',exact:true}).click();
 return {...kickResult,backgroundEdgesCovered:true,subtleSway:true,queueAligned:true,mobileAligned:true,reducedMotion:true,pauseSettles:true,closeClean:true};
}
