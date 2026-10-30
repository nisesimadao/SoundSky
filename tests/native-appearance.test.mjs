import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/native-appearance.ts'],bundle:true,write:false,format:'iife',globalName:'AppearanceTest',footer:{js:'window.AppearanceTest=AppearanceTest;'}});
test('native Light/Dark and Automatic changes are followed without writing SoundCloud state',async t=>{
 const dom=new JSDOM('<body class="theme-dark">',{url:'https://soundcloud.com',runScripts:'outside-only'}),w=dom.window;t.after(()=>dom.window.close());
 let mediaChange;const media={matches:false,addEventListener(_name,callback){mediaChange=callback;},removeEventListener(){}};w.matchMedia=()=>media;
 w.eval(result.outputFiles[0].text);const seen=[];const watcher=new w.AppearanceTest.NativeAppearance(value=>seen.push(value));
 assert.deepEqual(seen,['dark']);w.document.body.className='theme-light';await Promise.resolve();assert.deepEqual(seen,['dark','light']);
 media.matches=true;mediaChange();assert.equal(seen.at(-1),'light','an explicit native theme takes precedence over the OS');
 w.document.body.className='';await Promise.resolve();assert.equal(seen.at(-1),'dark');
 watcher.destroy();w.document.body.className='theme-light';await Promise.resolve();assert.equal(seen.at(-1),'dark');
});
