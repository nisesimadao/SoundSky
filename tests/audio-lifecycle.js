(() => {
 const result=document.querySelector('#result'),run=document.querySelector('#run'),playRun=document.querySelector('#play-failure'),playResult=document.querySelector('#play-result');let largestError=0;
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
  run.disabled=true;playRun.disabled=true;result.dataset.status='running';let rendered=0;
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
 const turntable=enabled=>new Promise(resolve=>{
  const received=event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='soundsky:turntable'){window.removeEventListener('message',received);resolve();}};
  window.addEventListener('message',received);window.postMessage({type:'soundsky:turntable',enabled},location.origin);
 });
 playRun.onclick=async()=>{
  playRun.disabled=true;run.disabled=true;playResult.textContent='検証中';const errors=[],pausedStates=[];
  try{
   await turntable(true);
   for(let i=0;i<10;i++){
    const media=new Audio('data:audio/wav;base64,AA=='),rate=i%2?1.5:1.25,pitch=!!(i%2);
    media.muted=true;media.volume=.37;media.playbackRate=rate;media.preservesPitch=pitch;
    const promise=media.play();
    if(media.playbackRate!==rate*.25)throw Error('Record spin-up was not installed');
    try{await promise;throw Error('Invalid audio unexpectedly played');}catch(error){if(error.name!=='NotSupportedError')throw error;errors.push(error.name);}
    pausedStates.push(media.paused);
    if(media.playbackRate!==rate||media.preservesPitch!==pitch||media.volume!==.37||!media.muted)throw Error('Rejected play did not restore owned state immediately');
    media.removeAttribute('src');media.load();
   }
   playResult.textContent=JSON.stringify({version:window[Symbol.for('soundsky:audio-bridge')].version,rejectedNativePlays:errors.length,nativeErrors:errors,nativePausedStates:pausedStates,immediateRateAndPitchRestoration:true,volumeAndMutePreserved:true},null,2);
  }catch(error){playResult.textContent='FAIL: '+(error.stack||error);}
  finally{await turntable(false);playRun.disabled=false;run.disabled=false;}
 };
})();
