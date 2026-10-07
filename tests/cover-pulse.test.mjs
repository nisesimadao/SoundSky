import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/cover-pulse.ts'],bundle:true,write:false,format:'esm'});
const {CoverPulse}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
test('sustained non-percussive audio responds immediately without a beat gate',()=>{
 const p=new CoverPulse();p.sample(0,0,.2);
 assert.ok(Math.abs(p.expansion(0,.15,3)-.06)<1e-12);
 for(let i=1;i<100;i++){p.sample(0,i*32,.2);assert.ok(Math.abs(p.expansion(i*32,.15,3)-.06)<1e-12);}
});
test('ordinary loudness and spectral changes remain linear and preserve sensitivity',()=>{
 const p=new CoverPulse();p.sample(.05,0,.1);const first=p.expansion(0,.3,1);
 assert.ok(Math.abs(first-.015)<1e-12);
 assert.equal(p.expansion(0,.3,2),first*2);
 p.sample(.05,32,.2);assert.ok(Math.abs(p.expansion(32,.3,1)-.025)<1e-12);
 p.sample(.06,64,.2);assert.ok(p.expansion(64,.3,1)>.025);
});
test('upper-range relief affects only a prolonged near-limit section',()=>{
 const p=new CoverPulse();p.sample(3,0,.5);const peak=p.expansion(0,.15,3);
 assert.ok(peak>.145 && peak<.15);
 for(let i=1;i<=100;i++){p.sample(3,i*32,.5);p.expansion(i*32,.15,3);}
 const held=p.expansion(3200,.15,3);assert.ok(held>.13&&held<peak);
 p.sample(0,3232,.1);assert.ok(Math.abs(p.expansion(3232,.15,3)-.03)<1e-12);
 p.sample(3,3264,.5);assert.ok(p.expansion(3264,.15,3)>held);
});
test('silence, stale input, reset and zero expansion cannot retain motion',()=>{
 const p=new CoverPulse();p.sample(.5,0,.5);assert.ok(p.expansion(0,.15,3)>0);
 assert.equal(p.expansion(200,.15,3),0);
 p.sample(0,232,0);assert.equal(p.expansion(232,.15,3),0);
 p.sample(1,264,1);assert.equal(p.expansion(264,0,3),0);
 p.reset();assert.equal(p.expansion(265,.15,3),0);
});
