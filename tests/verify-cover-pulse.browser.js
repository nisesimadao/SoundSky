async page => {
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'Play',exact:true}).last().click();
 return await page.evaluate(async()=>{
  const s=document.querySelector('soundsky-player').shadowRoot;
  const scale=()=>Number(s.querySelector('.artwork').style.getPropertyValue('--beat-scale'));
  const send=async(onset,level=.2)=>{window.postMessage({type:'soundsky:audio',level,onset},location.origin);await new Promise(r=>setTimeout(r,32));};
  for(let i=0;i<18;i++)await send(0);
  const sustained=scale();if(Math.abs(sustained-1.06)>.002)throw new Error('Non-percussive sound is gated');
  for(let i=0;i<8;i++)await send(.1);
  const changed=scale();if(Math.abs(changed-1.09)>.002)throw new Error('Ordinary spectral movement is gated');
  for(let i=0;i<10;i++)await send(3);
  const peak=scale();if(peak<1.13||peak>=1.15)throw new Error('Ceiling easing is excessive or absent');
  for(let i=0;i<30;i++)await send(3);
  const held=scale();
  for(let i=0;i<3;i++)await send(3.04);const up=scale();
  for(let i=0;i<3;i++)await send(2.96);const down=scale();
  if(up-down<.003)throw new Error('Near-ceiling details are lost');
  for(let i=0;i<12;i++)await send(0);
  if(Math.abs(scale()-1.06)>.002)throw new Error('Ordinary sound remains suppressed after a loud section');
  await send(0,0);await new Promise(r=>setTimeout(r,250));
  if(scale()>1.001)throw new Error('Silence leaves cover enlarged');
  return {sustainedScale:sustained,ordinaryChangeScale:changed,peakScale:peak,heldScale:held,detailRange:up-down,rawResponse:true,silenceRests:true};
 });
}
