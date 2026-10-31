import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=await build({entryPoints:['src/theme-frame.ts'],bundle:true,write:false,format:'iife',loader:{'.css':'text'},define:{'process.env.NODE_ENV':'"production"'}});
for(const chromeValue of [undefined,{}])test(`frame without ${chromeValue?'storage':'chrome'} inherits parent theme and disposes safely`,()=>{
 const dom=new JSDOM('<!doctype html><iframe src="/artists"></iframe>',{url:'https://soundcloud.com/discover',runScripts:'outside-only'});
 const frame=dom.window.document.querySelector('iframe'),w=frame.contentWindow;
 w.document.open();w.document.write('<!doctype html><html><head></head><body>Artist Studio</body></html>');w.document.close();
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.chrome=chromeValue;
 assert.doesNotThrow(()=>w.eval(bundle.outputFiles[0].text));
 w.dispatchEvent(new w.MessageEvent('message',{origin:'https://soundcloud.com',source:dom.window,data:{type:'soundsky:site-theme',enabled:true,hue:140,open:false,appearance:'light'}}));
 assert.ok(w.document.documentElement.hasAttribute('data-soundsky-theme'));
 assert.match(w.document.documentElement.style.getPropertyValue('--sky-site-accent'),/140/);
 assert.equal(w.document.documentElement.dataset.soundskyAppearance,'light');
 assert.equal(w.document.querySelectorAll('canvas').length,0);
 assert.doesNotThrow(()=>w.document.dispatchEvent(new w.Event('soundsky:theme-dispose')));
 assert.equal(w.document.documentElement.hasAttribute('data-soundsky-theme'),false);
 dom.window.close();
});

for(const update of ['storage','parent'])for(const enabled of [true,false])test(`late initial frame settings cannot overwrite a newer ${update} update (enabled=${enabled})`,async t=>{
 const dom=new JSDOM('<iframe src="/artists"></iframe>',{url:'https://soundcloud.com/discover',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window.document.querySelector('iframe').contentWindow;w.document.open();w.document.write('<html><head></head><body></body></html>');w.document.close();
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 let finishRead,onChange;
 w.chrome={storage:{local:{get:()=>new Promise(resolve=>{finishRead=resolve;})},onChanged:{addListener:listener=>{onChange=listener;},removeListener(){}}}};
 w.eval(bundle.outputFiles[0].text);
 const latest={modernSoundCloud:enabled,siteCorners:'subtle',siteBackground:false};
 if(update==='storage')onChange({'soundsky:settings':{newValue:latest}},'local');
 else w.dispatchEvent(new w.MessageEvent('message',{origin:'https://soundcloud.com',source:dom.window,data:{type:'soundsky:site-theme',enabled,settings:latest,appearance:'light'}}));
 assert.equal(w.document.documentElement.style.getPropertyValue('--sky-site-radius'),enabled?'5px':'');
 finishRead({'soundsky:settings':{modernSoundCloud:true,siteCorners:'round',siteBackground:true}});await Promise.resolve();await Promise.resolve();
 assert.equal(w.document.documentElement.hasAttribute('data-soundsky-theme'),enabled);
 assert.equal(w.document.documentElement.style.getPropertyValue('--sky-site-radius'),enabled?'5px':'');
 assert.equal(w.document.documentElement.hasAttribute('data-sky-site-background'),false);
 w.document.dispatchEvent(new w.Event('soundsky:theme-dispose'));
 onChange({'soundsky:settings':{newValue:{...latest,modernSoundCloud:true}}},'local');
 assert.equal(w.document.documentElement.hasAttribute('data-soundsky-theme'),false,'a queued change must not revive a disposed frame');
});

test('unrelated messages do not suppress initial saved frame preferences',async t=>{
 const dom=new JSDOM('<iframe src="/artists"></iframe>',{url:'https://soundcloud.com/discover',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window.document.querySelector('iframe').contentWindow;w.document.open();w.document.write('<html><head></head><body></body></html>');w.document.close();
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 let finishRead,onChange;w.chrome={storage:{local:{get:()=>new Promise(resolve=>{finishRead=resolve;})},onChanged:{addListener:listener=>{onChange=listener;},removeListener(){}}}};
 w.eval(bundle.outputFiles[0].text);
 onChange({'soundsky:settings':{newValue:{modernSoundCloud:false}}},'sync');
 for(const [origin,source,data]of [
  ['https://other.test',dom.window,{type:'soundsky:site-theme',enabled:false}],
  ['https://soundcloud.com',w,{type:'soundsky:site-theme',enabled:false}],
  ['https://soundcloud.com',dom.window,{type:'soundsky:cover-audio',level:0,onset:0}],
  ['https://soundcloud.com',dom.window,{type:'soundsky:site-theme',enabled:'false'}]
 ])w.dispatchEvent(new w.MessageEvent('message',{origin,source,data}));
 finishRead({'soundsky:settings':{modernSoundCloud:true,siteCorners:'round'}});await Promise.resolve();await Promise.resolve();
 assert.equal(w.document.documentElement.hasAttribute('data-soundsky-theme'),true);assert.equal(w.document.documentElement.style.getPropertyValue('--sky-site-radius'),'20px');
 w.document.dispatchEvent(new w.Event('soundsky:theme-dispose'));
});
