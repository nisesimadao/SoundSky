import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
const compiled = await build({entryPoints:['src/audio.ts'],bundle:true,write:false,format:'iife'});
test('buffer-source audio is analysed without replacing output, and taps disconnect on close', () => {
  const dom = new JSDOM('', {url:'https://soundcloud.com',runScripts:'outside-only'});
  const w = dom.window;
  const frames = new Map(); let id = 0;
  w.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  w.cancelAnimationFrame = key => frames.delete(key);
  class Node {
    constructor(context) { this.context=context; this.connections=[]; }
    connect(target) { this.connections.push(target); return target; }
    disconnect(target) { this.connections = target ? this.connections.filter(n=>n!==target) : []; }
  }
  class Destination extends Node {}
  class Analyser extends Node { getFloatTimeDomainData(samples) { samples.fill(.2); } getFloatFrequencyData(bins) { bins.fill(-Infinity); } }
  w.AudioNode=Node; w.AudioDestinationNode=Destination;
  const context={sampleRate:48000,state:'running',createAnalyser(){return new Analyser(this);}};
  const output=new Node(context), destination=new Destination(context);
  const levels=[]; w.postMessage=data=>levels.push(data);
  w.eval(compiled.outputFiles[0].text);
  assert.equal(output.connect(destination),destination);
  const send=active=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{type:'soundsky:analysis',active}}));
  send(true); assert.equal(output.connections.length,2); assert.equal(output.connections[0],destination);
  [...frames.values()][0](100); assert.ok(levels.at(-1).level > .19);
  send(false); assert.deepEqual(output.connections,[destination]);
  send(true); assert.equal(output.connections.length,2);
  output.disconnect(destination); assert.equal(output.connections.length,0);
  send(false); dom.window.close();
});

function graphHarness(t, playImpl) {
 const dom=new JSDOM('',{url:'https://soundcloud.com',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>dom.window.close());
 const frames=new Map();let frameId=0,analysers=0;
 w.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};w.cancelAnimationFrame=id=>frames.delete(id);
 class Node {
  constructor(context){this.context=context;this.routes=[];}
  connect(destination,output=0,input=0){
   if(output>1||input>1)throw new Error('Invalid port');
   if(!this.routes.some(r=>r.destination===destination&&r.output===output&&r.input===input))this.routes.push({destination,output,input});
   return destination;
  }
  disconnect(...args){
   if(args[0]==='invalid')throw new Error('Native disconnect failed');
   this.routes=this.routes.filter(r=>args.length?(typeof args[0]==='number'?r.output!==args[0]:r.destination!==args[0]||(args.length>1&&r.output!==args[1])||(args.length>2&&r.input!==args[2])):false);
  }
 }
 class Destination extends Node{}
 class Analyser extends Node{getFloatTimeDomainData(samples){samples.fill(.2);}getFloatFrequencyData(bins){bins.fill(-Infinity);}}
 w.AudioNode=Node;w.AudioDestinationNode=Destination;
 const context=Object.assign(new w.EventTarget(),{state:'running',sampleRate:48000,createAnalyser(){analysers++;return new Analyser(this);}});
 const node=new Node(context),destination=new Destination(context);
 if(playImpl)w.HTMLMediaElement.prototype.play=playImpl;
 const nativeConnect=Node.prototype.connect,nativeDisconnect=Node.prototype.disconnect,nativePlay=w.HTMLMediaElement.prototype.play;
 const session={playbackState:'none',setActionHandler(){}};
 Object.defineProperty(w.navigator,'mediaSession',{value:session});
 const send=active=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{type:'soundsky:analysis',active}}));
 w.eval(compiled.outputFiles[0].text);
 return {w,Node,node,destination,context,frames,send,session,nativeConnect,nativeDisconnect,nativePlay,analysers:()=>analysers};
}

test('a rejected native play restores the paused element rate and preserves the original promise',async t=>{
 const failure=new DOMException('Autoplay denied','NotAllowedError'),promise=Promise.reject(failure);
 const h=graphHarness(t,()=>promise),media=h.w.document.createElement('audio');media.playbackRate=1.25;media.preservesPitch=true;
 h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{type:'soundsky:turntable',enabled:true}}));
 assert.equal(media.play(),promise);assert.equal(media.playbackRate,.3125);
 await assert.rejects(promise,error=>error===failure);await Promise.resolve();
 assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);assert.equal(h.frames.size,0);
});

test('a synchronous native play exception restores the attempted ramp and propagates unchanged',t=>{
 const failure=new Error('Native play failed'),h=graphHarness(t,()=>{throw failure;}),media=h.w.document.createElement('audio');media.playbackRate=1.5;media.preservesPitch=false;
 h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{type:'soundsky:turntable',enabled:true}}));
 assert.throws(()=>media.play(),error=>error===failure);
 assert.equal(media.playbackRate,1.5);assert.equal(media.preservesPitch,false);assert.equal(h.frames.size,0);
});

test('an older play rejection cannot restore over a newer pending record start',async t=>{
 for(const alreadyPlaying of [false,true]){
 const rejects=[],h=graphHarness(t,()=>new Promise((resolve,reject)=>rejects.push(reject))),media=h.w.document.createElement('audio');media.playbackRate=1.25;media.preservesPitch=true;
 let paused=true;Object.defineProperty(media,'paused',{get:()=>paused});
 h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{type:'soundsky:turntable',enabled:true}}));
 const first=media.play();paused=!alreadyPlaying;const second=media.play();rejects[0](new DOMException('Superseded','AbortError'));await assert.rejects(first,/Superseded/);await Promise.resolve();
 assert.equal(media.playbackRate,.3125);assert.equal(media.preservesPitch,false);assert.equal(h.frames.size,1);
 rejects[1](new DOMException('Unavailable','NotSupportedError'));await assert.rejects(second,/Unavailable/);await Promise.resolve();
 assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);assert.equal(h.frames.size,0);
 }
});

test('a rejected old play leaves a successful already-playing media ramp intact',async t=>{
 let rejectFirst,plays=0;const h=graphHarness(t,()=>++plays===1?new Promise((resolve,reject)=>{rejectFirst=reject;}):Promise.resolve()),media=h.w.document.createElement('audio');let paused=true;
 Object.defineProperty(media,'paused',{get:()=>paused});media.playbackRate=1.5;media.preservesPitch=true;
 h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{type:'soundsky:turntable',enabled:true}}));
 const first=media.play();paused=false;await media.play();rejectFirst(new DOMException('Superseded','AbortError'));await assert.rejects(first,/Superseded/);await Promise.resolve();
 assert.equal(media.playbackRate,.375);assert.equal(media.preservesPitch,false);assert.equal(h.frames.size,1);
});

test('native play rejection restores the rate even when the browser leaves paused false',async t=>{
 let paused=true;
 const failure=new DOMException('Invalid audio','NotSupportedError'),h=graphHarness(t,()=>{paused=false;return Promise.reject(failure);}),media=h.w.document.createElement('audio');
 Object.defineProperty(media,'paused',{get:()=>paused});media.playbackRate=1.25;media.preservesPitch=true;
 h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{type:'soundsky:turntable',enabled:true}}));
 await assert.rejects(media.play(),error=>error===failure);await Promise.resolve();
 assert.equal(media.paused,false);assert.equal(media.playbackRate,1.25);assert.equal(media.preservesPitch,true);assert.equal(h.frames.size,0);
});
test('turntable bridge validates and forwards native playback state to the media session',t=>{
 const h=graphHarness(t);
 const send=(data,origin=h.w.location.origin)=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin,data:{type:'soundsky:turntable',...data}}));
 send({enabled:true,playbackState:'playing'});assert.equal(h.session.playbackState,'playing');
 send({enabled:true,playbackState:'paused'});assert.equal(h.session.playbackState,'paused');
 send({playbackState:'invalid'});assert.equal(h.session.playbackState,'paused');
 send({playbackState:'playing'},'https://example.com');assert.equal(h.session.playbackState,'paused');
 send({playbackState:'none'});assert.equal(h.session.playbackState,'none');
 send({enabled:false,playbackState:'playing'});assert.equal(h.session.playbackState,'none');
});
test('reinjecting audio hooks retains exactly one tap and one animation loop',t=>{
 const h=graphHarness(t);h.node.connect(h.destination);h.send(true);
 const hook=h.Node.prototype.connect;h.w.eval(compiled.outputFiles[0].text);h.send(true);
 assert.equal(h.Node.prototype.connect,hook);assert.equal(h.analysers(),1);assert.equal(h.frames.size,1);assert.equal(h.node.routes.length,2);
 h.send(false);assert.equal(h.frames.size,0);assert.equal(h.node.routes.length,1);
});
test('disconnecting one output preserves other native routes and analysis taps',t=>{
 const h=graphHarness(t);h.node.connect(h.destination,0);h.node.connect(h.destination,1);h.send(true);
 assert.equal(h.node.routes.length,4);
 h.node.disconnect(0);assert.equal(h.node.routes.length,2);assert.ok(h.node.routes.every(r=>r.output===1));
 h.send(false);assert.deepEqual(h.node.routes,[{destination:h.destination,output:1,input:0}]);
 h.send(true);h.node.disconnect(h.destination,1);assert.equal(h.node.routes.length,0);
});
test('disconnecting one destination input does not drop another input on the same output',t=>{
 const h=graphHarness(t);h.node.connect(h.destination,0,0);h.node.connect(h.destination,0,1);h.send(true);
 h.node.disconnect(h.destination,0,1);assert.equal(h.node.routes.length,2);
 h.send(false);assert.deepEqual(h.node.routes,[{destination:h.destination,output:0,input:0}]);
});
test('native exceptions remain native and analyser allocation failure cannot break playback',t=>{
 const h=graphHarness(t);assert.throws(()=>h.node.connect(h.destination,2),/Invalid port/);
 h.node.connect(h.destination);h.context.createAnalyser=()=>{throw new Error('GPU/audio resource pressure');};
 assert.doesNotThrow(()=>h.send(true));assert.doesNotThrow(()=>h.node.connect(h.destination));assert.equal(h.node.routes.length,1);
 assert.throws(()=>h.node.disconnect('invalid'),/Native disconnect failed/);assert.equal(h.node.routes.length,1);
});
test('audio teardown cancels work and restores only the hooks owned by SoundSky',t=>{
 const h=graphHarness(t);h.node.connect(h.destination);h.send(true);
 h.w[Symbol.for('soundsky:audio-bridge')].destroy();
 assert.equal(h.frames.size,0);assert.equal(h.node.routes.length,1);assert.equal(h.Node.prototype.connect,h.nativeConnect);assert.equal(h.Node.prototype.disconnect,h.nativeDisconnect);assert.equal(h.w.HTMLMediaElement.prototype.play,h.nativePlay);
 const other=graphHarness(t),wrapped=other.Node.prototype.connect;
 const thirdParty=function(...args){return wrapped.apply(this,args);};other.Node.prototype.connect=thirdParty;
 other.w[Symbol.for('soundsky:audio-bridge')].destroy();assert.equal(other.Node.prototype.connect,thirdParty);
});

test('delayed content playback notifications cannot overwrite newer native state',t=>{
 const h=graphHarness(t),control=h.w.document.createElement('button');control.className='playControl playing';control.title='Pause current';h.w.document.body.append(control);
 const send=state=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{type:'soundsky:turntable',enabled:true,playbackState:state}}));
 send('paused');assert.equal(h.session.playbackState,'playing');
 control.className='playControl';control.title='Play current';send('playing');assert.equal(h.session.playbackState,'paused');
 h.w[Symbol.for('soundsky:audio-bridge')].destroy();
});

test('analysis cleanup failures cannot turn a successful native disconnect into a playback exception',t=>{
 const h=graphHarness(t);h.node.connect(h.destination);h.send(true);
 const tap=h.node.routes.find(route=>route.destination!==h.destination).destination;
 tap.disconnect=()=>{throw new Error('Analysis cleanup failed');};
 assert.doesNotThrow(()=>h.node.disconnect(h.destination));assert.equal(h.node.routes.length,0);
 assert.doesNotThrow(()=>h.w[Symbol.for('soundsky:audio-bridge')].destroy());
});

test('analyser read failure emits silence for one sample and the analysis loop recovers',t=>{
 const h=graphHarness(t);h.node.connect(h.destination);h.send(true);const messages=[];h.w.postMessage=data=>messages.push(data);
 const tap=h.node.routes.find(route=>route.destination!==h.destination).destination;let failed=false;
 tap.getFloatTimeDomainData=samples=>{if(!failed){failed=true;throw Error('Context changed during read');}samples.fill(.2);};
 const tick=now=>{const pending=[...h.frames.values()];h.frames.clear();for(const callback of pending)callback(now);};
 tick(40);assert.equal(messages.at(-1).level,0);assert.equal(h.frames.size,1);assert.ok(h.node.routes.some(route=>route.destination===h.destination));
 tick(80);assert.ok(messages.at(-1).level>.19);assert.equal(h.frames.size,1);h.w[Symbol.for('soundsky:audio-bridge')].destroy();
});

test('teardown releases all owned hooks even when an analyser cannot disconnect',t=>{
 const h=graphHarness(t);h.node.connect(h.destination);h.send(true);
 const tap=h.node.routes.find(route=>route.destination!==h.destination).destination;tap.disconnect=()=>{throw Error('Analysis cleanup failed');};
 assert.doesNotThrow(()=>h.w[Symbol.for('soundsky:audio-bridge')].destroy());
 assert.equal(h.frames.size,0);assert.equal(h.Node.prototype.connect,h.nativeConnect);assert.equal(h.Node.prototype.disconnect,h.nativeDisconnect);assert.equal(h.w.HTMLMediaElement.prototype.play,h.nativePlay);assert.equal(h.node.routes.length,1);
});

test('closing a context removes its analysis edge before another animation frame arrives',t=>{
 const h=graphHarness(t);h.node.connect(h.destination);h.send(true);assert.equal(h.node.routes.length,2);
 h.context.state='closed';h.context.dispatchEvent(new h.w.Event('statechange'));
 assert.deepEqual(h.node.routes,[{destination:h.destination,output:0,input:0}]);
 h.w[Symbol.for('soundsky:audio-bridge')].destroy();
});
