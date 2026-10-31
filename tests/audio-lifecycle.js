(() => {
 const result=document.querySelector('#result'),run=document.querySelector('#run');let largestError=0;
 const analysis=active=>new Promise(resolve=>{
  const received=event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='soundsky:analysis'){window.removeEventListener('message',received);resolve();}};
  window.addEventListener('message',received);window.postMessage({type:'soundsky:analysis',active},location.origin);
 });
 function graph(){
  const context=new OfflineAudioContext(1,2400,48000),buffer=context.createBuffer(1,2400,48000),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.sin(2*Math.PI*1000*i/48000);
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.02;
  source.connect(gain);gain.connect(context.destination);source.start();return context;
 }
 async function render(context){
  const output=(await context.startRendering()).getChannelData(0),rms=Math.sqrt(output.reduce((sum,value)=>sum+value*value,0)/output.length);
  let error=0;for(let i=0;i<output.length;i++)error=Math.max(error,Math.abs(output[i]-.02*Math.sin(2*Math.PI*1000*i/48000)));
  largestError=Math.max(largestError,error);
  if(Math.abs(rms-.02/Math.sqrt(2))>1e-5||error>1e-6)throw Error(`Native output changed: RMS=${rms}, sample error=${error}`);
  if(context.state!=='closed')throw Error('Rendered context is not closed');
 }
 async function drained(){
  const deadline=performance.now()+5000;
  while(window.audioLifecycleMonitor.live&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  if(window.audioLifecycleMonitor.live)throw Error(`Context watchers retained: ${window.audioLifecycleMonitor.live}`);
 }
 run.onclick=async()=>{
  run.disabled=true;result.dataset.status='running';let rendered=0;
  try{
   for(let i=0;i<200;i++){
    if(i%10===0)await analysis(i%20===0);
    await render(graph());rendered++;result.textContent=`${rendered}/200 contexts rendered`;
   }
   await drained();const afterCycles=window.audioLifecycleMonitor.live;
   if(!window.audioLifecycleMonitor.peak)throw Error('Audio lifecycle observers were never installed');
   await analysis(false);const last=graph();
   if(!window.audioLifecycleMonitor.live)throw Error('Live graph was not observed before teardown');
   const bridge=window[Symbol.for('soundsky:audio-bridge')],version=bridge.version;bridge.destroy();
   if(window.audioLifecycleMonitor.live)throw Error('Teardown retained context observers');
   await render(last);rendered++;
   const native=window.audioLifecycleNative;
   if(AudioNode.prototype.connect!==native.connect||AudioNode.prototype.disconnect!==native.disconnect||AudioBufferSourceNode.prototype.start!==native.start||AudioBufferSourceNode.prototype.stop!==native.stop)throw Error('Owned native hooks were not restored');
   result.dataset.status='passed';result.textContent=JSON.stringify({version,maximumSampleError:largestError,renderedContexts:rendered,correctWaveforms:rendered,watchersAfterCycles:afterCycles,watchersAfterTeardown:window.audioLifecycleMonitor.live,peakWatchers:window.audioLifecycleMonitor.peak,nativeHooksRestored:true,outputPreservedAfterTeardown:true},null,2);
  }catch(error){result.dataset.status='failed';result.textContent=String(error.stack||error);console.error(error);}
 };
})();
