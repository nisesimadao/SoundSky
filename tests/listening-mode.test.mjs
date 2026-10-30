import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/listening-mode.ts'],bundle:true,write:false,format:'iife',globalName:'ListeningTest',footer:{js:'window.ListeningTest=ListeningTest;'}});
test('focus mode wakes on interaction and stays visible for settings, pause, touch and keyboard',t=>{
 const dom=new JSDOM('<section><header class="topbar"><button>Settings</button></header><footer class="controls"><button>Play</button></footer></section>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>dom.window.close());
 const timers=new Map();let id=0;w.setTimeout=callback=>{timers.set(++id,callback);return id;};w.clearTimeout=id=>timers.delete(id);
 const pointer={matches:true,addEventListener(){},removeEventListener(){}};w.matchMedia=()=>pointer;
 w.eval(built.outputFiles[0].text);const player=w.document.querySelector('section'),mode=new w.ListeningTest.ListeningMode(player);t.after(()=>mode.destroy());
 const idle=()=>{for(const [id,callback]of [...timers]){timers.delete(id);callback();}};
 mode.sync(true,true,true,false);idle();assert.equal(player.classList.contains('is-idle'),true);
 player.dispatchEvent(new w.Event('pointermove'));assert.equal(player.classList.contains('is-idle'),false);
 mode.sync(true,true,true,true);idle();assert.equal(player.classList.contains('is-idle'),false);
 mode.sync(true,true,false,false);idle();assert.equal(player.classList.contains('is-idle'),false);
 pointer.matches=false;mode.sync(true,true,true,false);idle();assert.equal(player.classList.contains('is-idle'),false);
 pointer.matches=true;player.querySelector('button').focus();mode.sync(false,true,true,false);mode.sync(true,true,true,false);idle();assert.equal(player.classList.contains('is-idle'),false);
 mode.destroy();assert.equal(timers.size,0);assert.equal(player.hasAttribute('data-focus-mode'),false);
});
