import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/account-settings.ts'],bundle:true,write:false,format:'iife',globalName:'AccountTest',loader:{'.css':'text'},footer:{js:'window.AccountTest=AccountTest;'}});
test('embedded settings keep one frame, preserve native forms and never navigate the playing page',t=>{
 const dom=new JSDOM('<div id="mount"></div>',{url:'https://soundcloud.com/artist/track',runScripts:'outside-only'}),w=dom.window;
 t.after(()=>dom.window.close());w.eval(bundle.outputFiles[0].text);
 const mount=w.document.querySelector('#mount'),settings=new w.AccountTest.AccountSettings(mount),url=w.location.href;
 settings.setTheme('light');settings.open();settings.open();assert.equal(mount.querySelectorAll('iframe').length,1);
 const frame=mount.querySelector('iframe');assert.equal(frame.getAttribute('src'),'/settings');assert.equal(frame.getAttribute('sandbox').includes('allow-top-navigation'),false);assert.equal(w.location.href,url);
 const doc=frame.contentDocument;doc.open();doc.write('<html><head></head><body><form><input name="preference"><button>Save</button></form></body></html>');doc.close();
 const input=doc.querySelector('input');let changes=0;input.addEventListener('change',()=>changes++);
 frame.dispatchEvent(new w.Event('load'));assert.equal(doc.documentElement.dataset.soundskyAppearance,'light');
 assert.equal(doc.querySelector('input'),input);input.dispatchEvent(new frame.contentWindow.Event('change'));assert.equal(changes,1);
 assert.ok(doc.querySelector('[data-soundsky-account-frame]'));settings.setTheme('dark');assert.equal(doc.documentElement.dataset.soundskyAppearance,'dark');assert.equal(w.location.href,url);
 settings.destroy();assert.equal(mount.querySelector('iframe'),null);
});
