import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/cover-pulse.ts'],bundle:true,write:false,format:'esm'});
const {CoverPulse}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
test('high mastered loudness and continuous spectral flux do not hold the cover enlarged',()=>{
 const pulse=new CoverPulse();
 for(let i=0;i<100;i++){pulse.sample(.8,i*32);assert.equal(pulse.expansion(i*32,.3,12),0);}
});
test('a strong transient returns from the limit even if onset remains high',()=>{
 const pulse=new CoverPulse();pulse.sample(0,0);pulse.sample(2,32);
 assert.equal(pulse.expansion(32,.15,12),.15);
 for(let i=2;i<10;i++)pulse.sample(2,i*32);
 assert.ok(pulse.expansion(288,.15,12)<.004);
});
test('repeated beats in dense music still generate separate pulses',()=>{
 const pulse=new CoverPulse();pulse.sample(.2,0);
 for(let beat=0;beat<5;beat++){
  const now=32+beat*256;pulse.sample(.7,now);
  assert.ok(pulse.expansion(now,.15,3)>.1);
  for(let i=1;i<=7;i++)pulse.sample(.2,now+i*32);
  assert.ok(pulse.expansion(now+224,.15,3)<.005);
 }
});
test('raw transient strength and sensitivity remain meaningful below the limit',()=>{
 const hit=(onset,sensitivity)=>{const p=new CoverPulse();p.sample(0,0);p.sample(onset,32);return p.expansion(32,.3,sensitivity);};
 assert.equal(hit(.1,2),hit(.1,1)*2);assert.equal(hit(.1,1),hit(.2,1)/2);
});
test('close, stale audio and track resets cannot replay an old hit',()=>{
 const p=new CoverPulse();p.sample(0,0);p.sample(.7,32);p.reset();assert.equal(p.expansion(33,.15,3),0);
 p.sample(.7,64);assert.equal(p.expansion(64,.15,3),0);
 p.sample(0,96);p.sample(.7,128);p.sample(.7,400);assert.equal(p.expansion(400,.15,3),0);
});
test('a sustained synth lifts gently without pinning even at maximum sensitivity',()=>{
 const p=new CoverPulse();
 for(let i=0;i<100;i++)p.sample(.8,i*32,.5);
 const lift=p.expansion(3168,.15,3);
 assert.ok(lift>.015 && lift<.03);
 assert.ok(p.expansion(3168,.3,12)<.061);
 p.sample(.1,3200,.5);p.sample(3,3232,.5);
 assert.ok(p.expansion(3232,.15,3)>.12);
 for(let i=1;i<=20;i++)p.sample(3,3232+i*32,.5);
 assert.ok(Math.abs(p.expansion(3872,.15,3)-lift)<.001);
});
test('sustained lift releases gradually, follows loudness and resets on stale input',()=>{
 const quiet=new CoverPulse(), loud=new CoverPulse();
 for(let i=0;i<60;i++){quiet.sample(0,i*32,.04);loud.sample(0,i*32,.5);}
 assert.ok(quiet.expansion(1888,.15,3)<loud.expansion(1888,.15,3)/4);
 const before=loud.expansion(1888,.15,3);
 loud.sample(0,1920,0);
 assert.ok(loud.expansion(1920,.15,3)>before*.8);
 for(let i=1;i<80;i++)loud.sample(0,1920+i*32,0);
 assert.ok(loud.expansion(4448,.15,3)<.001);
 loud.sample(0,4800,0);assert.equal(loud.expansion(4800,.15,3),0);
 loud.reset();assert.equal(loud.expansion(4801,.15,3),0);
});
