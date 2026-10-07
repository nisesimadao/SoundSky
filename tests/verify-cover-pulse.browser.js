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
  const held=scale();
  if(held<1.01||held>1.031)throw new Error('Sustained synth lift is absent or excessive');
  await send(.1);await send(3);
  const peak=scale();
  if(peak<1.025)throw new Error('Transient no longer pulses');
  for(let i=0;i<16;i++)await send(3);
  if(Math.abs(scale()-held)>.004)throw new Error('Transient fails to return to gentle sustained lift');
  window.postMessage({type:'soundsky:audio',level:0,onset:0},location.origin);
  await new Promise(r=>setTimeout(r,250));
  if(scale()>1.001)throw new Error('Silence leaves cover enlarged');
  return {sustainedScale:held,transientScale:peak,returnsToSustainedLift:true,silenceRests:true};
 });
}
