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

function graphHarness(t) {
 const dom=new JSDOM('',{url:'https://soundcloud.com',runScripts:'outside-only'}),w=dom.window;
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
 const context={state:'running',sampleRate:48000,createAnalyser(){analysers++;return new Analyser(this);}};
 const node=new Node(context),destination=new Destination(context);
 const nativeConnect=Node.prototype.connect,nativeDisconnect=Node.prototype.disconnect,nativePlay=w.HTMLMediaElement.prototype.play;
 const session={playbackState:'none',setActionHandler(){}};
 Object.defineProperty(w.navigator,'mediaSession',{value:session});
 const send=active=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{type:'soundsky:analysis',active}}));
 w.eval(compiled.outputFiles[0].text);
 return {w,Node,node,destination,context,frames,send,session,nativeConnect,nativeDisconnect,nativePlay,analysers:()=>analysers};
}
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
