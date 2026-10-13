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
 w.AudioBufferSourceNode=Source;const originalStart=Source.prototype.start,originalStop=Source.prototype.stop;w.eval(bundle.outputFiles[0].text);const turntable=new w.recordTest.Turntable();t.after(()=>turntable.destroy());const button=w.document.querySelector('button');
 button.onclick=()=>{clicks++;const playing=button.classList.toggle('playing');button.title=playing?'Pause current':'Play current';if(playing){source=new Source();source.start(0,5,10);}else source.stop(context.currentTime);};
 const advance=ms=>{time+=ms;context.currentTime=time/1000;for(const [id,callback]of [...frames]){frames.delete(id);callback(time);}for(const [id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.f();}};
 return {w,turntable,button,Source,context,originalStart,originalStop,timers,frames,advance,get source(){return source;},get clicks(){return clicks;}};
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
