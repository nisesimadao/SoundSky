import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/playback-clock.ts'],bundle:true,write:false,format:'esm'});
const {PlaybackClock}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
test('pause and resume preserve subsecond progress rather than snapping to the native integer',()=>{
 const clock=new PlaybackClock();clock.sync('a',10,true,0);
 assert.equal(clock.sync('a',10,false,780),10.78);
 assert.equal(clock.sync('a',10,false,3000),10.78);
 assert.equal(clock.sync('a',10,true,4000),10.78);
 assert.equal(clock.read(4500),11.28);
});
test('seeks, track changes and large corrections still update immediately',()=>{
 const clock=new PlaybackClock();clock.sync('a',10,true,0);
 assert.equal(clock.sync('a',10.2,true,800,true),10.2);
 assert.equal(clock.sync('b',0,true,900),0);
 assert.equal(clock.sync('b',40,true,1000),40);
});
