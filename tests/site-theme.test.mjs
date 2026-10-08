import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const result=await build({entryPoints:['src/site-theme.ts'],bundle:true,write:false,format:'iife',globalName:'themeTest',footer:{js:'window.themeTest=themeTest;'},loader:{'.css':'text'},define:{'process.env.NODE_ENV':'"production"'}});
const create=()=>{
 const dom=new JSDOM('<!doctype html><html><head><style>body{background:white}</style></head><body><button id="native">Play</button></body></html>',{runScripts:'outside-only',url:'https://soundcloud.com/discover'});
 dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 dom.window.eval(result.outputFiles[0].text);return dom;
};
test('theme toggles restore native markup, styles and event handlers',()=>{
 const dom=create(),w=dom.window,theme=new w.themeTest.SiteTheme();
 const button=w.document.getElementById('native');let clicks=0;button.onclick=()=>clicks++;
 const original=w.document.body.innerHTML;
 theme.setEnabled(true);theme.setAccent(120);
 assert.ok(w.document.documentElement.hasAttribute('data-soundsky-theme'));
 assert.match(w.document.documentElement.style.getPropertyValue('--sky-site-accent'),/120/);
 button.click();assert.equal(clicks,1);assert.equal(w.document.querySelectorAll('[data-soundsky-site-style]').length,1);
 theme.setEnabled(false);assert.equal(w.document.body.innerHTML,original);
 assert.equal(w.document.querySelectorAll('[data-soundsky-site-style]').length,0);
 assert.equal(w.document.documentElement.style.getPropertyValue('--sky-site-accent'),'');
 theme.destroy();dom.window.close();
});
test('reinjection disposes the previous theme and leaves one stylesheet',()=>{
 const dom=create(),w=dom.window,old=new w.themeTest.SiteTheme();old.setEnabled(true);
 const next=new w.themeTest.SiteTheme();next.setEnabled(true);
 assert.equal(w.document.querySelectorAll('[data-soundsky-site-style]').length,1);
 assert.equal(w.document.querySelectorAll('[data-soundsky-site-shader]').length,1);
 next.destroy();assert.equal(w.document.querySelectorAll('[data-soundsky-site-shader]').length,0);
 dom.window.close();
});

test('theme broadcasts only to ready same-origin frames, including after navigation',()=>{
 const dom=create(),w=dom.window,theme=new w.themeTest.SiteTheme();
 const ready=w.document.createElement('iframe'),opaque=w.document.createElement('iframe');
 w.document.body.append(ready,opaque);
 let sent=0,opaqueSent=0;
 ready.contentWindow.postMessage=()=>sent++;
 opaque.contentWindow.postMessage=()=>opaqueSent++;
 theme.setEnabled(true);theme.setAccent(20);
 assert.equal(sent,0);assert.equal(opaqueSent,0);
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:opaque.contentWindow,data:{type:'soundsky:theme-ready'}}));
 assert.equal(opaqueSent,0,'opaque about:blank frame must be skipped even if it sends a message');
 // jsdom has no navigation; expose an explicit same-origin location for the registered fixture.
 const source={location:{origin:w.location.origin},postMessage(){sent++;}};
 Object.defineProperty(ready,'contentWindow',{value:source});
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source,data:{type:'soundsky:theme-ready'}}));
 assert.equal(sent,1);theme.setAccent(50);assert.equal(sent,2);
 source.location.origin='null';theme.setAccent(70);assert.equal(sent,2);
 theme.destroy();dom.window.close();
});
