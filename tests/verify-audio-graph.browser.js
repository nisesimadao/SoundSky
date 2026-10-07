// Real Web Audio rendering in the local fixture; this does not test SoundCloud streams.
async page => {
 await page.goto('http://127.0.0.1:4173');
 await page.addScriptTag({path:'dist/audio.js'});
 return await page.evaluate(async()=>{
  async function render(active){
   const ctx=new OfflineAudioContext(2,4096,48000);
   const buffer=ctx.createBuffer(2,4096,48000);
   for(let i=0;i<4096;i++){buffer.getChannelData(0)[i]=Math.sin(i*.03)*.1;buffer.getChannelData(1)[i]=Math.cos(i*.04)*.3;}
   const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
   window.postMessage({type:'soundsky:analysis',active},location.origin);
   await new Promise(r=>setTimeout(r,30));source.start();
   const output=await ctx.startRendering();
   window.postMessage({type:'soundsky:analysis',active:false},location.origin);
   await new Promise(r=>setTimeout(r,30));
   return [output.getChannelData(0),output.getChannelData(1)];
  }
  const native=await render(false),tapped=await render(true);
  for(let ch=0;ch<2;ch++)for(let i=0;i<4096;i++)if(native[ch][i]!==tapped[ch][i])throw new Error('Analysis changed stereo output');
  return {nativeWebAudio:true,stereoOutputUnchanged:true,samplesCompared:8192};
 });
}
