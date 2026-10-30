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

test('audio lookahead stores only a whole count between off and three tracks',()=>{
 assert.equal(loadSavedSettings({}).prefetchCount,3);assert.equal(loadSavedSettings({prefetchCount:99}).prefetchCount,3);assert.equal(loadSavedSettings({prefetchCount:-2}).prefetchCount,0);assert.equal(loadSavedSettings({prefetchCount:1.6}).prefetchCount,2);assert.equal(loadSavedSettings({prefetchCount:'2'}).prefetchCount,3);
});
test('prepared duration accepts the offered scopes and defaults to whole tracks',()=>{
 for(const seconds of [0,15,30,60,120])assert.equal(loadSavedSettings({prefetchSeconds:seconds}).prefetchSeconds,seconds);
 for(const seconds of [7,NaN,Infinity,'30',-1])assert.equal(loadSavedSettings({prefetchSeconds:seconds}).prefetchSeconds,0);
});

test('native page appearance sections and style choices validate independently',()=>{
 const customized=loadSavedSettings({modernSoundCloud:true,siteHeader:false,siteQueue:false,siteTransport:false,siteArtwork:false,siteBackground:false,siteWide:false,siteCorners:'round',siteAccent:'warm',siteBackdropOpacity:.55});
 for(const key of ['siteHeader','siteQueue','siteTransport','siteArtwork','siteBackground','siteWide'])assert.equal(customized[key],false);
 assert.equal(customized.siteCorners,'round');assert.equal(customized.siteAccent,'warm');assert.equal(customized.siteBackdropOpacity,.55);
 const invalid=loadSavedSettings({siteHeader:'false',siteQueue:1,siteCorners:'random',siteAccent:'purple',siteBackdropOpacity:Infinity});
 for(const key of ['siteHeader','siteQueue','siteBackground','siteTransport','siteWide'])assert.equal(invalid[key],true);
 assert.equal(invalid.siteCorners,'soft');assert.equal(invalid.siteAccent,'artwork');assert.equal(invalid.siteBackdropOpacity,.3);
 assert.equal(loadSavedSettings({siteBackdropOpacity:-5}).siteBackdropOpacity,0);
 assert.equal(loadSavedSettings({siteBackdropOpacity:5}).siteBackdropOpacity,.7);
});

test('record speed defaults to native duration and accepts only finite bounded multipliers',()=>{
 assert.equal(loadSavedSettings({}).turntableSpeed,1);
 assert.equal(loadSavedSettings({turntableSpeed:2.5}).turntableSpeed,2);
 assert.equal(loadSavedSettings({turntableSpeed:0}).turntableSpeed,.5);
 assert.equal(loadSavedSettings({turntableSpeed:NaN}).turntableSpeed,1);
});

test('obsolete independent themes are ignored and listening focus remains opt-in',()=>{
 for(const appearance of ['light','dark','system'])assert.equal('appearance' in loadSavedSettings({appearance}),false);
 assert.equal(loadSavedSettings({}).focusMode,false);
 assert.equal(loadSavedSettings({focusMode:true}).focusMode,true);
 assert.equal(loadSavedSettings({focusMode:'true'}).focusMode,false);
});
