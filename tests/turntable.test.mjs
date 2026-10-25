import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/turntable.ts'],bundle:true,write:false,format:'iife',globalName:'recordTest',footer:{js:'window.recordTest=recordTest;'}});
function setup(t){
 const dom=new JSDOM('<button class="playControl" title="Play current"></button><a class="playbackSoundBadge__titleLink" href="/artist/track"></a><input>',{url:'https://soundcloud.com/discover',runScripts:'outside-only'}),w=dom.window;t.after(()=>dom.window.close());
 let time=0,id=0,clicks=0,source=null;const timers=new Map(),frames=new Map();w.performance.now=()=>time;w.setTimeout=(f,ms)=>{timers.set(++id,{f,at:time+ms});return id;};w.clearTimeout=i=>timers.delete(i);w.requestAnimationFrame=f=>{frames.set(++id,f);return id;};w.cancelAnimationFrame=i=>frames.delete(i);
 class Rate{value=1;calls=[];cancelScheduledValues(at){this.calls.push(['cancel',at]);}cancelAndHoldAtTime(at){this.calls.push(['hold',at]);}setValueAtTime(value,at){this.value=value;this.calls.push(['value',value,at]);}setValueCurveAtTime(curve,at,duration){this.value=curve[0];this.calls.push(['curve',[...curve],at,duration]);}}
 const context={state:'running',currentTime:0};
 class Source extends w.EventTarget{context=context;playbackRate=new Rate();starts=[];stops=[];start(...args){if(args[0]<0)throw new Error('Invalid start');this.starts.push(args);}stop(...args){this.stops.push(args);}}
 const actions=new Map();const session={setActionHandler(action,handler){if(handler)actions.set(action,handler);else actions.delete(action);}};
 Object.defineProperty(w.navigator,'mediaSession',{value:session});const originalAction=session.setActionHandler;
 const paused=new WeakMap();let pauses=0;
 Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return paused.get(this)??true;}});
 w.HTMLMediaElement.prototype.pause=function(){pauses++;paused.set(this,true);};const originalPause=w.HTMLMediaElement.prototype.pause;
 w.AudioBufferSourceNode=Source;const originalStart=Source.prototype.start,originalStop=Source.prototype.stop;w.eval(bundle.outputFiles[0].text);const turntable=new w.recordTest.Turntable();t.after(()=>turntable.destroy());const button=w.document.querySelector('button');
 button.onclick=()=>{clicks++;const playing=button.classList.toggle('playing');button.title=playing?'Pause current':'Play current';if(playing){source=new Source();source.start(0,5,10);}else source.stop(context.currentTime);};
 const advance=ms=>{time+=ms;context.currentTime=time/1000;for(const [id,callback]of [...frames]){frames.delete(id);callback(time);}for(const [id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.f();}};
 return {w,turntable,button,Source,context,originalStart,originalStop,originalPause,originalAction,session,actions,paused,timers,frames,advance,get pauses(){return pauses;},get source(){return source;},get clicks(){return clicks;}};
}
test('record effect is opt-in, slows the live source before native pause and accelerates a fresh source on resume',t=>{
 const h=setup(t);h.button.click();assert.equal(h.clicks,1);assert.equal(h.source.playbackRate.calls.length,0);h.turntable.setEnabled(true);h.button.click();assert.equal(h.clicks,1);const down=h.source.playbackRate.calls.at(-1);assert.equal(down[0],'curve');assert.ok(Math.abs(down[1].at(-1)-.04)<.001);assert.equal(down[3],.42);
 h.advance(419);assert.equal(h.clicks,1);h.advance(1);assert.equal(h.clicks,2);assert.equal(h.source.stops.length,1);h.advance(250);assert.equal(h.source.playbackRate.value,1);
 h.button.click();assert.equal(h.clicks,3);assert.deepEqual(h.source.starts,[[0,5,10]]);const up=h.source.playbackRate.calls.at(-1);assert.ok(Math.abs(up[1][0]-.08)<.001);assert.ok(Math.abs(up[1].at(-1)-1)<.001);assert.equal(up[3],.24);h.turntable.setEnabled(false);assert.equal(h.source.playbackRate.value,1);
});
test('repeated toggle reverses slowing, while disabling, seeking and track changes cancel a pending native pause',t=>{
 const h=setup(t);h.turntable.setEnabled(true);h.button.click();h.button.click();h.advance(80);h.button.click();h.advance(600);assert.equal(h.clicks,1);assert.equal(h.button.title,'Pause current');
 h.button.click();h.turntable.setEnabled(false);h.advance(800);assert.equal(h.clicks,1);assert.equal(h.source.playbackRate.value,1);
 h.turntable.setEnabled(true);h.button.click();h.source.stop(h.context.currentTime);h.advance(800);assert.equal(h.clicks,1);
 h.button.click(); // Native stop has removed the source; no delay without an eligible output.
 assert.equal(h.clicks,2);h.button.click();h.button.click();h.w.document.querySelector('a').href='/artist/other';h.advance(420);assert.equal(h.clicks,3);assert.equal(h.source.playbackRate.value,1);
});
test('Space uses the same effect, editing stays native, and teardown restores prototypes and rates',t=>{
 const h=setup(t);h.turntable.setEnabled(true);h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert.equal(h.clicks,1);
 h.w.document.querySelector('input').dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert.equal(h.clicks,1);
 h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Space',bubbles:true,cancelable:true}));assert.equal(h.clicks,1);h.turntable.destroy();h.advance(700);assert.equal(h.clicks,1);assert.equal(h.source.playbackRate.value,1);assert.equal(h.Source.prototype.start,h.originalStart);assert.equal(h.Source.prototype.stop,h.originalStop);assert.equal(h.timers.size,0);assert.throws(()=>new h.Source().start(-1),/Invalid start/);
});
test('detached HTML media preserves its original speed and pitch correction after pause, resume and disable',t=>{
 const h=setup(t),media=h.w.document.createElement('audio');let paused=true;Object.defineProperty(media,'paused',{get:()=>paused});media.playbackRate=1.25;media.preservesPitch=true;
 h.button.onclick=()=>{const playing=h.button.classList.toggle('playing');h.button.title=playing?'Pause current':'Play current';if(playing)h.turntable.startMedia(media);paused=!playing;};h.turntable.setEnabled(true);h.button.click();assert.equal(media.preservesPitch,false);assert.equal(media.playbackRate,.3125);h.advance(240);assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);
 h.button.click();h.advance(200);assert.ok(media.playbackRate<1.25);h.advance(220);assert.equal(paused,true);assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);h.button.click();h.turntable.setEnabled(false);assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);assert.equal(h.frames.size,0);
});
test('loading delay and scheduled start retain spin-up, but subsequent chunks stay at their native rate',t=>{
 const h=setup(t);h.turntable.setEnabled(true);h.button.onclick=()=>{h.button.classList.add('playing');h.button.title='Pause current';};h.button.click();h.advance(2000);
 const first=new h.Source();first.start(3,5,10);const curve=first.playbackRate.calls.at(-1);assert.equal(curve[0],'curve');assert.equal(curve[2],3);
 const next=new h.Source();next.start(3,5,10);assert.equal(next.playbackRate.calls.length,0);assert.throws(()=>new h.Source().start(-1),/Invalid start/);
});
test('a source with a scheduled future stop remains eligible for manual slowing until it ends',t=>{
 const h=setup(t);h.button.click();const scheduled=new h.Source();scheduled.start(0);scheduled.stop(10);h.turntable.setEnabled(true);h.button.click();assert.equal(scheduled.playbackRate.calls.at(-1)[0],'curve');scheduled.dispatchEvent(new h.w.Event('ended'));assert.equal(scheduled.playbackRate.value,1);
});

test('Space inside SoundSky shadow player reaches the turntable once; settings remain keyboard accessible', t => {
 const h=setup(t);h.turntable.setEnabled(true);
 const host=h.w.document.createElement('soundsky-player');
 const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML='<button class="play-toggle"></button><button class="settings-tab"></button><input type="range">';
 h.w.document.body.append(host);
 const keyboard=(element)=>element.dispatchEvent(new h.w.KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true,composed:true,cancelable:true}));
 const toggle=shadow.querySelector('.play-toggle');
 assert.equal(keyboard(toggle),false,'handled Space must cancel native button activation');
 assert.equal(h.clicks,1);
 assert.equal(h.source.playbackRate.calls.at(-1)[0],'curve');
 keyboard(toggle);
 assert.equal(h.clicks,1,'second press must ease the output down before the native pause');
 assert.equal(h.timers.size,1);
 h.advance(420);assert.equal(h.clicks,2);
 const settings=shadow.querySelector('.settings-tab');
 assert.equal(keyboard(settings),true);
 assert.equal(keyboard(shadow.querySelector('input')),true);
 assert.equal(h.clicks,2,'Space in settings must not start playback');
});

test('track and queue pause controls slow the current output before committing native pause',t=>{
 const h=setup(t);h.turntable.setEnabled(true);
 for(const className of ['sc-button-play sc-button-pause','playButton m-playing']){
  const control=h.w.document.createElement('button');control.className=className;control.innerHTML='<span>Pause</span>';h.w.document.body.append(control);
  let direct=0;control.onclick=()=>direct++;
  h.button.click();const before=h.clicks;control.firstChild.click();
  assert.equal(direct,0);assert.equal(h.clicks,before);assert.equal(h.source.playbackRate.calls.at(-1)[3],.42);
  h.advance(420);assert.equal(h.clicks,before+1);assert.equal(h.source.stops.length,1);h.advance(250);control.remove();
 }
 const play=h.w.document.createElement('button');play.className='sc-button-play';h.w.document.body.append(play);
 play.onclick=()=>{h.button.classList.add('playing');h.button.title='Pause current';const source=new h.Source();source.start();assert.equal(source.playbackRate.calls.at(-1)[3],.24);};play.click();
});

test('media session pause and play preserve handler details, reverse pending pauses and restore on teardown',t=>{
 const h=setup(t);h.turntable.setEnabled(true);let pauses=0,received;
 const pause=details=>{pauses++;received=details;h.source.stop();};
 h.session.setActionHandler('pause',pause);
 h.session.setActionHandler('play',()=>{if(!h.button.classList.contains('playing'))h.button.click();});
 h.button.click();const details={action:'pause'};
 h.actions.get('pause')(details);h.advance(200);h.actions.get('pause')(details);h.advance(220);
 assert.equal(pauses,1,'repeated pause must not restart or reverse the slowdown');assert.equal(received,details);
 h.advance(250);h.button.classList.remove('playing');h.button.title='Play current';h.actions.get('play')({action:'play'});
 assert.equal(h.source.playbackRate.calls.at(-1)[3],.24);
 h.actions.get('pause')(details);h.actions.get('play')({action:'play'});h.advance(500);assert.equal(pauses,1);
 h.session.setActionHandler('pause',null);assert.equal(h.actions.has('pause'),false);
 h.session.setActionHandler('pause',pause);h.turntable.destroy();assert.equal(h.actions.get('pause'),pause);assert.equal(h.session.setActionHandler,h.originalAction);
});

test('media session seeking and track changes cancel delayed pause without delaying navigation',t=>{
 const h=setup(t);h.turntable.setEnabled(true);h.button.click();let pauses=0,navigations=0;
 h.session.setActionHandler('pause',()=>pauses++);
 for(const action of ['seekto','seekforward','seekbackward','nexttrack','previoustrack']){
  h.session.setActionHandler(action,()=>navigations++);
  h.actions.get('pause')({action:'pause'});h.actions.get(action)({action});h.advance(500);
  assert.equal(pauses,0);assert.equal(h.source.playbackRate.value,1);
 }
 assert.equal(navigations,5);
});

test('direct HTML media pause slows detached output and resumes with original rate and pitch',t=>{
 const h=setup(t),media=h.w.document.createElement('audio');media.playbackRate=1.25;media.preservesPitch=true;
 h.turntable.setEnabled(true);h.turntable.startMedia(media);h.paused.set(media,false);h.advance(240);
 media.pause();assert.equal(h.pauses,0);h.advance(200);assert.ok(media.playbackRate<1.25);assert.equal(media.preservesPitch,false);
 media.pause();h.advance(220);assert.equal(h.pauses,1);assert.equal(media.paused,true);assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);
 h.turntable.startMedia(media);h.paused.set(media,false);assert.equal(media.playbackRate,.3125);h.advance(240);
 media.pause();h.turntable.startMedia(media);h.advance(500);assert.equal(h.pauses,1,'resume cancels a delayed direct pause');
 media.pause();media.dispatchEvent(new h.w.Event('seeking'));h.advance(500);assert.equal(h.pauses,1);
 Object.defineProperty(media,'seeking',{value:true});media.pause();assert.equal(h.pauses,2,'seeking must retain immediate native pause');
 h.turntable.destroy();assert.equal(h.w.HTMLMediaElement.prototype.pause,h.originalPause);
});

test('media key toggle resumes after delayed pause using the native playback state',t=>{
 const h=setup(t);h.turntable.setEnabled(true);
 const nativeClick=h.button.onclick;
 h.button.onclick=()=>{nativeClick();h.turntable.syncPlaybackState(h.button.classList.contains('playing')?'playing':'paused');};
 h.session.setActionHandler('play',()=>h.button.click());
 h.session.setActionHandler('pause',()=>h.button.click());
 const mediaKey=()=>{const action=h.session.playbackState==='playing'?'pause':'play';h.actions.get(action)({action});};
 h.turntable.syncPlaybackState('paused');mediaKey();assert.equal(h.session.playbackState,'playing');assert.equal(h.clicks,1);
 mediaKey();h.advance(419);assert.equal(h.session.playbackState,'playing');assert.equal(h.clicks,1);
 h.advance(1);assert.equal(h.session.playbackState,'paused');assert.equal(h.clicks,2);
 mediaKey();assert.equal(h.session.playbackState,'playing');assert.equal(h.clicks,3);
 mediaKey();h.advance(420);assert.equal(h.session.playbackState,'paused');assert.equal(h.clicks,4);
 // Button-driven resume and pause must publish the same OS state.
 h.button.click();assert.equal(h.session.playbackState,'playing');h.button.click();h.advance(420);assert.equal(h.session.playbackState,'paused');
 h.turntable.syncPlaybackState('none');assert.equal(h.session.playbackState,'none');
});

test('playback state synchronization leaves disabled and disposed sessions under native control',t=>{
 const h=setup(t);h.session.playbackState='none';h.turntable.syncPlaybackState('playing');assert.equal(h.session.playbackState,'none');
 h.turntable.setEnabled(true);h.turntable.syncPlaybackState('paused');assert.equal(h.session.playbackState,'paused');
 h.session.playbackState='playing';h.turntable.syncPlaybackState('paused');assert.equal(h.session.playbackState,'paused','a stale OS state must be corrected even when the native state has not changed');
 h.turntable.setEnabled(false);h.turntable.syncPlaybackState('playing');assert.equal(h.session.playbackState,'paused');
 h.turntable.destroy();h.turntable.syncPlaybackState('none');assert.equal(h.session.playbackState,'paused');
});
