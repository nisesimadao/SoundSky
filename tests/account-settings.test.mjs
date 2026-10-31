import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/account-settings.ts'],bundle:true,write:false,format:'iife',globalName:'AccountTest',loader:{'.css':'text'},footer:{js:'window.AccountTest=AccountTest;'}});
test('embedded settings keep one frame, preserve native forms and never navigate the playing page',async t=>{
 const dom=new JSDOM('<div id="mount"></div>',{url:'https://soundcloud.com/artist/track',runScripts:'outside-only'}),w=dom.window;
 t.after(()=>dom.window.close());w.eval(bundle.outputFiles[0].text);
 const mount=w.document.querySelector('#mount'),changesSeen=[],settings=new w.AccountTest.AccountSettings(mount,theme=>changesSeen.push(theme)),url=w.location.href;
 settings.setTheme('dark');settings.open();settings.open();assert.equal(mount.querySelectorAll('iframe').length,1);
 const frame=mount.querySelector('iframe');assert.equal(frame.getAttribute('src'),'/settings');assert.equal(frame.getAttribute('sandbox').includes('allow-top-navigation'),false);assert.equal(w.location.href,url);
 const doc=frame.contentDocument;doc.open();doc.write('<html><head></head><body class="theme-dark"><form><input name="preference"><button>Save</button></form></body></html>');doc.close();
 const input=doc.querySelector('input');let changes=0;input.addEventListener('change',()=>changes++);
 frame.dispatchEvent(new w.Event('load'));assert.equal(doc.documentElement.dataset.soundskyAppearance,'dark');
 doc.body.className='theme-light';await Promise.resolve();assert.equal(doc.documentElement.dataset.soundskyAppearance,'light');assert.deepEqual(changesSeen,['light']);
 assert.equal(doc.querySelector('input'),input);input.dispatchEvent(new frame.contentWindow.Event('change'));assert.equal(changes,1);
 assert.ok(doc.querySelector('[data-soundsky-account-frame]'));settings.setTheme('dark');assert.equal(doc.documentElement.dataset.soundskyAppearance,'dark');assert.equal(w.location.href,url);
 settings.destroy();assert.equal(mount.querySelector('iframe'),null);
});

test('slow and failed settings loads offer recovery without navigating or replacing the playing page',t=>{
 const dom=new JSDOM('<div id="mount"></div>',{url:'https://soundcloud.com/artist/track',runScripts:'outside-only'}),w=dom.window;w.eval(bundle.outputFiles[0].text);
 const timers=new Map();let id=0;w.setTimeout=callback=>{timers.set(++id,callback);return id;};w.clearTimeout=id=>timers.delete(id);
 const mount=w.document.querySelector('#mount'),settings=new w.AccountTest.AccountSettings(mount);t.after(()=>{settings.destroy();w.close();});
 settings.open();const frame=mount.querySelector('iframe'),url=w.location.href;
 assert.equal(mount.dataset.loadState,'loading');assert.equal(mount.getAttribute('aria-busy'),'true');assert.equal(timers.size,1);
 for(const [id,callback]of [...timers]){timers.delete(id);callback();}
 assert.equal(mount.dataset.loadState,'slow');assert.equal(mount.querySelector('button').hidden,false);
 const external=mount.querySelector('a');assert.equal(external.target,'_blank');assert.equal(external.getAttribute('href'),'/settings');
 mount.querySelector('button').click();assert.equal(mount.querySelectorAll('iframe').length,1);assert.equal(mount.querySelector('iframe'),frame);assert.equal(timers.size,1);
 frame.dispatchEvent(new w.Event('error'));assert.equal(mount.dataset.loadState,'error');assert.equal(timers.size,0);
 mount.querySelector('button').click();frame.dispatchEvent(new w.Event('load'));assert.equal(mount.dataset.loadState,'ready');assert.equal(timers.size,0);
 assert.equal(mount.querySelector('[role="status"]').hidden,true);assert.equal(w.location.href,url);
 settings.destroy();assert.equal(mount.children.length,0);assert.equal(timers.size,0);
});

test('Escape inside the settings frame closes the drawer once and respects native dialogs',t=>{
 const dom=new JSDOM('<div id="mount"></div>',{url:'https://soundcloud.com/artist/track',runScripts:'outside-only'}),w=dom.window;w.eval(bundle.outputFiles[0].text);
 let closed=0;const settings=new w.AccountTest.AccountSettings(w.document.querySelector('#mount'),undefined,()=>closed++);t.after(()=>{settings.destroy();w.close();});
 settings.open();const frame=w.document.querySelector('iframe'),doc=frame.contentDocument;doc.open();doc.write('<html><head></head><body></body></html>');doc.close();frame.dispatchEvent(new w.Event('load'));frame.dispatchEvent(new w.Event('load'));
 doc.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(closed,1,'reloads must replace the key listener');
 doc.addEventListener('keydown',event=>event.preventDefault());frame.dispatchEvent(new w.Event('load'));
 doc.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(closed,1,'native dialog dismissal owns Escape first');
 settings.destroy();doc.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(closed,1);
});

test('Tab from the checked radio at frame boundaries returns to the parent focus order',t=>{
 const dom=new JSDOM('<div id="mount"></div>',{url:'https://soundcloud.com/artist/track',runScripts:'outside-only'}),w=dom.window;w.eval(bundle.outputFiles[0].text);
 const directions=[],settings=new w.AccountTest.AccountSettings(w.document.querySelector('#mount'),undefined,undefined,direction=>directions.push(direction));t.after(()=>{settings.destroy();w.close();});
 settings.open();const frame=w.document.querySelector('iframe'),doc=frame.contentDocument;doc.open();doc.write('<html><head></head><body><input id="light" name="theme" type="radio" checked><input id="dark" name="theme" type="radio"></body></html>');doc.close();
 frame.contentWindow.HTMLElement.prototype.getBoundingClientRect=()=>({width:20,height:20});frame.dispatchEvent(new w.Event('load'));
 const light=doc.querySelector('#light');light.focus();light.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
 light.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.deepEqual(directions,[1,-1]);
});
