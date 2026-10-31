import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/focus.ts'],bundle:true,write:false,format:'iife',globalName:'FocusTest',footer:{js:'window.FocusTest=FocusTest;'}});
test('tab stops exclude hidden, disabled and inert content and honor positive tab order',t=>{
 const dom=new JSDOM('<button id="first">First</button><div inert><button id="inert">No</button></div><button disabled id="disabled">No</button><input type="hidden" id="hidden"><div hidden><button>No</button></div><button style="visibility:hidden">No</button><button tabindex="-1">No</button><button tabindex="2" id="two">Two</button><button tabindex="1" id="one">One</button><details><summary id="summary">More</summary></details><iframe id="frame"></iframe>',{runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:20,height:20});w.eval(bundle.outputFiles[0].text);
 assert.deepEqual([...w.FocusTest.tabStops(w.document)].map(el=>el.id),['one','two','first','summary','frame']);
});
test('checked radio owns its group stop, while independent forms and nameless radios remain independent',t=>{
 const dom=new JSDOM('<input id="light" type="radio" name="theme" checked><input id="dark" type="radio" name="theme"><form><input id="other-form" type="radio" name="theme"></form><input id="alone" type="radio"><input id="other-alone" type="radio">',{runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:20,height:20});w.eval(bundle.outputFiles[0].text);
 assert.deepEqual([...w.FocusTest.tabStops(w.document)].map(el=>el.id),['light','other-form','alone','other-alone']);
 w.document.querySelector('#dark').checked=true;assert.deepEqual([...w.FocusTest.tabStops(w.document)].map(el=>el.id),['dark','other-form','alone','other-alone']);
});
