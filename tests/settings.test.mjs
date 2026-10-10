import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/settings.ts','src/types.ts'],bundle:true,write:false,format:'esm',outdir:'out'});
const load=async index=>import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[index].text).toString('base64')}`);
const {loadSavedSettings}=await load(0),{defaultSettings}=await load(1);
test('saved settings reject invalid values and ignore unknown keys',()=>{
 for(const input of [null,undefined,[],17,'bad'])assert.deepEqual(loadSavedSettings(input),defaultSettings);
 const result=loadSavedSettings({pulseMax:NaN,heatSpeed:Infinity,heatEnabled:'false',consoleSpeed:'8',unrelated:true});
 assert.deepEqual(result,defaultSettings);
});
test('saved settings constrain extreme finite values without changing valid preferences',()=>{
 const result=loadSavedSettings({pulseMax:999,pulseSensitivity:-5,ambientGlow:-1,sceneSway:2,heatResponse:2.2,heatEnabled:false});
 assert.equal(result.pulseMax,.3);assert.equal(result.pulseSensitivity,.2);assert.equal(result.ambientGlow,0);assert.equal(result.sceneSway,1);assert.equal(result.heatResponse,2.2);assert.equal(result.heatEnabled,false);
});
test('older speed preference migrates while explicit Heatmap settings take precedence',()=>{
 assert.equal(loadSavedSettings({materialSpeed:4}).heatSpeed,4);
 assert.equal(loadSavedSettings({materialSpeed:4,heatSpeed:0}).heatSpeed,0);
 assert.equal(loadSavedSettings({}).sceneSway,0);
});
test('the native site theme is opt-in and only accepts a boolean preference',()=>{
 assert.equal(loadSavedSettings({}).modernSoundCloud,false);
 assert.equal(loadSavedSettings({modernSoundCloud:'true'}).modernSoundCloud,false);
 assert.equal(loadSavedSettings({modernSoundCloud:true}).modernSoundCloud,true);
});
test('record-style playback is off by default and accepts only a boolean toggle',()=>{
 assert.equal(loadSavedSettings({}).turntable,false);assert.equal(loadSavedSettings({turntable:'true'}).turntable,false);assert.equal(loadSavedSettings({turntable:true}).turntable,true);
});
