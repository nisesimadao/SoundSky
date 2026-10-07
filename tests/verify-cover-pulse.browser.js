async page => {
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'Play',exact:true}).last().click();
 await page.waitForFunction(()=>document.querySelector('soundsky-player').shadowRoot.querySelector('.player').dataset.playing==='true');
 return await page.evaluate(async()=>{
  const s=document.querySelector('soundsky-player').shadowRoot;
  const art=s.querySelector('.artwork');
  const scale=()=>Number(art.style.getPropertyValue('--beat-scale'));
  const send=async onset=>{window.postMessage({type:'soundsky:audio',level:.5,onset},location.origin);await new Promise(r=>setTimeout(r,32));};
  for(let i=0;i<18;i++)await send(.8);
  if(scale()>1.001)throw new Error('Continuous mastered spectrum holds cover enlarged');
  await send(.1);await send(3);
  const peak=scale();
  if(peak<1.025)throw new Error('Transient no longer pulses');
  for(let i=0;i<16;i++)await send(3);
  if(scale()>1.003)throw new Error('Sustained onset holds cover at pulse limit');
  return {sustainedScale:scale(),transientScale:peak,returnsToRest:true};
 });
}
