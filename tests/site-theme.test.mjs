import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const result=await build({entryPoints:['src/site-theme.ts'],bundle:true,write:false,format:'iife',globalName:'themeTest',footer:{js:'window.themeTest=themeTest;'},loader:{'.css':'text'},define:{'process.env.NODE_ENV':'"production"'}});
const create=()=>{
 const dom=new JSDOM('<!doctype html><html><head><style>body{background:white}</style></head><body class="theme-dark"><button id="native">Play</button></body></html>',{runScripts:'outside-only',url:'https://soundcloud.com/discover'});
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

test('appearance regions, corner scale and fixed accent apply without leaking after disabling',()=>{
 const dom=create(),w=dom.window,theme=new w.themeTest.SiteTheme();
 theme.setEnabled(true);
 theme.setPreferences({siteHeader:false,siteArtwork:false,siteQueue:false,siteTransport:false,siteBackground:false,siteWide:false,siteCorners:'round',siteAccent:'warm',siteBackdropOpacity:.55});
 const html=w.document.documentElement;
 for(const part of ['header','artwork','queue','transport','background','wide'])assert.equal(html.hasAttribute('data-sky-site-'+part),false);
 assert.equal(html.style.getPropertyValue('--sky-site-radius'),'20px');
 assert.equal(html.style.getPropertyValue('--sky-site-background-opacity'),'0.55');
 assert.equal(html.style.getPropertyValue('--sky-site-accent'),'#f2b585');
 theme.setPreferences({siteHeader:true,siteArtwork:true,siteQueue:true,siteTransport:true,siteBackground:true,siteWide:true,siteCorners:'subtle',siteAccent:'sky',siteBackdropOpacity:.15});
 for(const part of ['header','artwork','queue','transport','background','wide'])assert.equal(html.hasAttribute('data-sky-site-'+part),true);
 assert.equal(html.style.getPropertyValue('--sky-site-radius'),'5px');
 assert.equal(html.style.getPropertyValue('--sky-site-accent'),'#97d7ec');
 theme.setEnabled(false);
 for(const part of ['header','artwork','queue','transport','background','wide'])assert.equal(html.hasAttribute('data-sky-site-'+part),false);
 for(const value of ['--sky-site-radius','--sky-site-background-opacity','--sky-site-accent'])assert.equal(html.style.getPropertyValue(value),'');
 assert.equal(w.document.querySelectorAll('[data-soundsky-site-style]').length,0);
 theme.destroy();dom.window.close();
});


test('desktop wide layout reaches the modern track frame and restores its native width when switched off',()=>{
 const dom=create(),w=dom.window,theme=new w.themeTest.SiteTheme(false,false);
 const preferences={siteHeader:true,siteArtwork:true,siteQueue:true,siteTransport:true,siteBackground:true,siteWide:true,siteCorners:'soft',siteAccent:'artwork',siteBackdropOpacity:.3};
 try {
  const base=w.document.createElement('style');
  base.textContent='.native-track-main { width:1240px; margin:0 auto 100px; }';
  w.document.head.append(base);
  w.document.body.innerHTML='<div id="navigation-shell-right-side-container"><main id="main" class="native-track-main"><section aria-label="Track header"></section></main></div><aside><main id="unrelated">Other content</main></aside>';
  const main=w.document.getElementById('main');
  theme.setPreferences(preferences);theme.setEnabled(true);
  // jsdom does not evaluate viewport media queries. Activate the shipped desktop
  // rules explicitly to check their selectors, cascade and preference scoping.
  const media=[...w.document.querySelector('[data-soundsky-site-style]').sheet.cssRules].find(rule=>rule.conditionText==='(min-width: 1100px)');
  const desktop=w.document.createElement('style');desktop.textContent=[...media.cssRules].map(rule=>rule.cssText).join('\n');w.document.head.append(desktop);
  assert.equal(w.getComputedStyle(main).width,'calc(100% - 80px)');
  assert.equal(w.getComputedStyle(main).maxWidth,'1760px');
  assert.notEqual(w.getComputedStyle(w.document.getElementById('unrelated')).maxWidth,'1760px');
  theme.setPreferences({...preferences,siteWide:false});
  assert.equal(w.getComputedStyle(main).width,'1240px');
  theme.setPreferences({...preferences,siteWide:true});
  assert.equal(w.getComputedStyle(main).width,'calc(100% - 80px)');
  theme.setEnabled(false);
  assert.equal(w.getComputedStyle(main).width,'1240px');
 } finally { theme.destroy();dom.window.close(); }
});


test('native theme changes drive the palette without independent saved overrides',async()=>{
 const dom=create(),w=dom.window,theme=new w.themeTest.SiteTheme();
 w.document.body.className='theme-light';await Promise.resolve();
 assert.equal(w.document.documentElement.dataset.soundskyAppearance,'light');
 assert.ok(w.document.querySelector('[data-soundsky-palette-style]'));
 theme.setEnabled(true);assert.match(w.document.documentElement.style.getPropertyValue('--sky-site-accent'),/35%/);
 w.document.body.className='theme-dark';await Promise.resolve();assert.equal(w.document.documentElement.dataset.soundskyAppearance,'dark');
 theme.destroy();assert.equal(w.document.querySelector('[data-soundsky-palette-style]'),null);dom.window.close();
});
