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
