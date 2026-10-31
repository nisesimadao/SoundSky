import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/native-preferences.ts'],bundle:true,write:false,format:'iife',globalName:'PrefsTest',footer:{js:'window.PrefsTest=PrefsTest;'},loader:{'.css':'text'}});
test('native settings settle after rendering and after a value or status change',async t=>{
 const dom=new JSDOM('<main class="settingsMain__wrapper"><ul class="settingsMain__tabs"></ul><form>Native settings</form></main>',{url:'https://soundcloud.com/settings#soundsky',runScripts:'outside-only'}),w=dom.window;
 w.eval(built.outputFiles[0].text);
 const host=w.document.createElement('soundsky-player');w.document.body.append(host);const source=host.attachShadow({mode:'open'});
 source.innerHTML='<div class="settings-section"><h3>再生</h3><details><summary>先読み</summary><div class="settings-group"><label for="setting-count">曲数</label><input id="setting-count" type="range" value="2"><output class="settings-val">2曲</output></div><p id="prefetch-status">待機中</p></details></div>';
 const prefs=new w.PrefsTest.NativePreferences(source);
 let deliveries=0;const observer=new w.MutationObserver(()=>{if(++deliveries>12){observer.disconnect();return;}prefs.sync();});t.after(()=>{observer.disconnect();prefs.destroy();w.close();});observer.observe(w.document.body,{childList:true,subtree:true});
 prefs.sync();await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(deliveries<5,`initial render must settle, got ${deliveries} observer deliveries`);
 const initial=deliveries;source.querySelector('.settings-val').textContent='3曲';source.querySelector('#prefetch-status').textContent='準備済み';prefs.update();
 await new Promise(resolve=>setTimeout(resolve,20));assert.ok(deliveries-initial<3,'value updates must settle');
 let space=0;w.document.addEventListener('keydown',()=>space++);w.document.querySelector('summary').dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));assert.equal(space,0);
 assert.equal(w.document.querySelector('output').value,'3曲');
 assert.equal(w.document.querySelector('[role="status"]').textContent,'準備済み');
 const before=deliveries;prefs.update();prefs.setSaveLabel('自動保存');await new Promise(resolve=>setTimeout(resolve,20));assert.equal(deliveries,before,'unchanged values must not rewrite text nodes');
 prefs.setSaveLabel('保存できませんでした');await new Promise(resolve=>setTimeout(resolve,20));assert.ok(deliveries-before<=1,'status updates must settle');
});

test('native retry uses the shared handler and keeps native button styling after navigation',t=>{
 const dom=new JSDOM('<main class="settingsMain__wrapper"><ul class="settingsMain__tabs"></ul></main>',{url:'https://soundcloud.com/settings#soundsky',runScripts:'outside-only'}),w=dom.window;w.eval(built.outputFiles[0].text);
 const source=w.document.createElement('div');source.innerHTML='<section class="settings-section"><h3>再生</h3></section><button data-command="settings-retry" hidden>もう一度試す</button>';
 const prefs=new w.PrefsTest.NativePreferences(source);t.after(()=>{prefs.destroy();w.close();});let retried=0;source.querySelector('button').onclick=()=>retried++;
 prefs.sync();let retry=w.document.querySelector('[data-soundsky-save-retry]');assert.equal(retry.hidden,true);assert.ok(retry.classList.contains('sc-button'));
 prefs.setSaveLabel('保存できませんでした',true);assert.equal(retry.hidden,false);retry.click();assert.equal(retried,1);
 w.history.pushState({},'','/settings');prefs.sync();w.history.pushState({},'','/settings#soundsky');prefs.sync();retry=w.document.querySelector('[data-soundsky-save-retry]');assert.equal(retry.hidden,false);retry.click();assert.equal(retried,2);
 prefs.setSaveLabel('自動保存');assert.equal(retry.hidden,true);
});
