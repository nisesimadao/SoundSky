import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=await build({entryPoints:['src/queue-prefetch.ts'],bundle:true,write:false,format:'iife',globalName:'markers'});
test('ready markers follow recycled track identities, exclude active rows and clear on scope/off/destroy',async()=>{
 const dom=new JSDOM('<div id="root"><div class="queueItemView m-active"><div class="queueItemView__title"><a href="/artist/a"></a></div></div><div class="queueItemView"><div class="queueItemView__title"><a href="/artist/b"></a></div></div></div>',{runScripts:'outside-only'});
 const w=dom.window;w.eval(bundle.outputFiles[0].text+';window.Markers=markers.QueuePrefetch');const marker=new w.Markers(),root=w.document.querySelector('#root'),rows=root.querySelectorAll('.queueItemView'),marked=()=>root.querySelectorAll('[data-soundsky-prefetched]').length;
 const flush=()=>new Promise(resolve=>w.setTimeout(resolve,0));
 marker.sync(root,3,0);marker.setReady(['/artist/a','/artist/b']);assert.equal(marked(),1);assert.equal(rows[0].hasAttribute('data-soundsky-prefetched'),false);
 rows[1].querySelector('a').href='/artist/c';await flush();assert.equal(marked(),0);
 rows[1].querySelector('a').href='/artist/b';await flush();assert.equal(marked(),1);
 rows[1].classList.add('m-active');await flush();assert.equal(marked(),0);rows[1].classList.remove('m-active');await flush();assert.equal(marked(),1);
 marker.sync(root,3,30);assert.equal(marked(),0);marker.setReady(['/artist/b']);marker.sync(root,0,30);assert.equal(marked(),0);
 marker.sync(root,3,30);marker.setReady(['/artist/b']);marker.destroy();assert.equal(marked(),0);dom.window.close();
});
