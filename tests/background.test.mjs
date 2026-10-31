import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const code=(await build({entryPoints:['src/background.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
function setup(options={}){
 const calls=[],injected=[];let clicked,status=options.status,toggles=0,open=false;
 const chrome={tabs:{create:async options=>calls.push(['create',options.url]),sendMessage:async(id,message)=>{
  calls.push(['message',message.type]);if(message.type==='soundsky:status'){if(options.missing&&!injected.length)throw Error('no receiver');return status;}
  open=!open;toggles++;return {open,version};
 }},scripting:{executeScript:async request=>{if(options.fail)throw Error('tab unavailable');injected.push(request);if(options.pauseInjection)await options.pauseInjection();status={version};}},action:{onClicked:{addListener:fn=>clicked=fn},setBadgeText:async options=>calls.push(['badge',options.text]),setTitle:async options=>calls.push(['title',options.title])}};
 runInNewContext(code,{chrome});
 return {click:tab=>clicked(tab??{id:7,url:'https://soundcloud.com/discover'}),calls,injected,get toggles(){return toggles;},get open(){return open;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('current tabs toggle without reinjecting and clear previous failure feedback',async()=>{
 const h=setup({status:{version}});h.click();await settle();assert.equal(h.injected.length,0);assert.equal(h.toggles,1);assert.ok(h.calls.some(c=>c[0]==='badge'&&c[1]===''));
});
test('already-open tabs install the main-world audio bridge before their UI',async()=>{
 const h=setup({missing:true});h.click();await settle();assert.equal(h.injected.length,2);
 assert.equal(h.injected[0].world,'MAIN');assert.equal(h.injected[0].files[0],'audio.js');assert.equal(h.injected[1].files[0],'content.js');assert.equal(h.toggles,1);
});
test('stale versions recover before toggling instead of briefly opening the stale UI',async()=>{
 const h=setup({status:{version:'0.0.1'}});h.click();await settle();assert.equal(h.injected.length,2);assert.equal(h.calls.filter(c=>c[1]==='soundsky:toggle').length,1);
});
test('rapid clicks keep their open-close order while recovery is pending',async()=>{
 let resume;let first=true;const h=setup({missing:true,pauseInjection:()=>{if(!first)return;first=false;return new Promise(resolve=>resume=resolve);}});
 h.click();h.click();await settle();assert.equal(h.toggles,0);resume();await settle();await settle();assert.equal(h.injected.length,2);assert.equal(h.toggles,2);assert.equal(h.open,false);
});
test('failed injection gives actionable feedback and does not toggle partial UI',async()=>{
 const h=setup({missing:true,fail:true});h.click();await settle();assert.equal(h.toggles,0);assert.ok(h.calls.some(c=>c[0]==='badge'&&c[1]==='!'));assert.ok(h.calls.some(c=>c[0]==='title'&&c[1].includes('再読み込み')));
});
test('a non-SoundCloud action opens the actual discover route without injecting into another site',async()=>{
 const h=setup();h.click({id:5,url:'https://example.com/'});await settle();assert.equal(h.injected.length,0);assert.ok(h.calls.some(c=>c[0]==='create'&&c[1]==='https://soundcloud.com/discover#soundsky'));
});
test('worker, manifest and UI use the same release identity',async()=>{
 const manifest=JSON.parse(await readFile('public/manifest.json','utf8'));assert.equal(manifest.version,version);
 const {VERSION}=await import(`data:text/javascript;base64,${Buffer.from((await build({entryPoints:['src/version.ts'],bundle:true,write:false,format:'esm'})).outputFiles[0].text).toString('base64')}`);assert.equal(VERSION,version);
});
