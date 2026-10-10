import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const built=await build({entryPoints:['src/native-transport.ts'],bundle:true,write:false,format:'iife',globalName:'transportTest',footer:{js:'window.transportTest=transportTest;'},loader:{'.css':'text'},define:{'process.env.NODE_ENV':'"production"'}});
const setup=()=>{
 const dom=new JSDOM('<!doctype html><body><div class="playControls"><div class="playControls__elements"><button class="playControl" aria-label="Play"><div>Original icon</div></button><div class="playbackTimeline__progressWrapper" aria-valuenow="10"><div class="playbackTimeline__progressBar"></div></div></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://soundcloud.com/discover'});
 const w=dom.window;let now=0;let frame=0;const frames=new Map();
 w.performance.now=()=>now;w.requestAnimationFrame=cb=>{frames.set(++frame,cb);return frame;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.eval(built.outputFiles[0].text);
 let state={track:{key:'/artist/track'},current:10,duration:100,playing:true,muted:false};let docked=false;let opens=0;
 const adapter={root:w.document.querySelector('.playControls'),query(s){return this.root?.querySelector(s);},emit(){transport.sync(state);}};
 const transport=new w.transportTest.NativeTransport(adapter,()=>opens++,v=>docked=v);
 const tick=time=>{now=time;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(now);};
 return {dom,w,adapter,transport,tick,frames,setState(s){state={...state,...s};transport.sync(state);},get docked(){return docked;},get opens(){return opens;}};
};
test('native progress interpolates between updates and yields to authoritative seek, pause and drag',()=>{
 const t=setup();t.setState({});t.transport.setEnabled(true);const bar=t.adapter.query('.playbackTimeline__progressWrapper');
 t.tick(300);assert.equal(parseFloat(bar.style.getPropertyValue('--soundsky-progress')),10.3);assert.equal(bar.getAttribute('aria-valuenow'),'10');
 t.tick(2000);assert.equal(parseFloat(bar.style.getPropertyValue('--soundsky-progress')),11.25);
 t.setState({current:5,playing:false});t.tick(2400);assert.equal(parseFloat(bar.style.getPropertyValue('--soundsky-progress')),5);
 bar.dispatchEvent(new t.w.Event('pointerdown',{bubbles:true}));t.tick(2500);assert.equal(bar.hasAttribute('data-soundsky-progress'),false);assert.equal(bar.style.getPropertyValue('--soundsky-progress'),'');
 bar.dispatchEvent(new t.w.Event('pointerup',{bubbles:true}));t.tick(2600);assert.equal(bar.hasAttribute('data-soundsky-progress'),true);
 t.transport.setEnabled(false);assert.equal(t.frames.size,0);assert.equal(bar.style.getPropertyValue('--soundsky-progress'),'');t.transport.destroy();t.dom.window.close();
});
test('docked entry and decorative icons preserve native handlers and release on root replacement and destroy',()=>{
 const t=setup();const play=t.adapter.query('.playControl');let nativeClicks=0;play.onclick=()=>nativeClicks++;
 t.setState({});assert.equal(t.docked,true);t.w.document.querySelector('[data-soundsky-entry]').click();assert.equal(t.opens,1);
 t.transport.setEnabled(true);play.click();assert.equal(nativeClicks,1);assert.ok(play.querySelector('[data-soundsky-glyph]'));assert.equal(play.getAttribute('aria-label'),'Play');
 t.transport.setEnabled(false);assert.equal(play.querySelector('[data-soundsky-glyph]'),null);assert.equal(play.querySelector('div').textContent,'Original icon');play.click();assert.equal(nativeClicks,2);
 const next=t.adapter.root.cloneNode(true);t.adapter.root.replaceWith(next);t.adapter.root=next;t.setState({});assert.equal(t.w.document.querySelectorAll('[data-soundsky-entry]').length,1);
 t.transport.destroy();assert.equal(t.docked,false);assert.equal(t.frames.size,0);assert.equal(t.w.document.querySelector('[data-soundsky-entry]'),null);assert.equal(t.w.document.querySelector('[data-soundsky-transport-style]'),null);t.dom.window.close();
});
test('native button redraw and replacement reuse the metal surface before the next frame',async()=>{
 const t=setup();t.setState({});t.transport.setEnabled(true);const play=t.adapter.query('.playControl');const metal=play.querySelector('[data-soundsky-metal]');
 play.replaceChildren(t.w.document.createElement('div'));play.title='Pause current';await Promise.resolve();assert.equal(play.querySelector('[data-soundsky-metal]'),metal);assert.equal(play.querySelector('[data-soundsky-glyph]').dataset.icon,'pause');
 const next=play.cloneNode(false);next.title='Play current';play.replaceWith(next);await Promise.resolve();assert.equal(next.querySelector('[data-soundsky-metal]'),metal);assert.equal(next.querySelector('[data-soundsky-glyph]').dataset.icon,'play');
 t.transport.destroy();next.replaceChildren(t.w.document.createElement('div'));await Promise.resolve();assert.equal(next.querySelector('[data-soundsky-metal]'),null);t.dom.window.close();
});
