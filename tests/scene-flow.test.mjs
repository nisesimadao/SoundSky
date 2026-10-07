import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/scene-flow.ts'],bundle:true,write:false,format:'esm'});
const {SceneFlow}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const make=()=>new SceneFlow(()=>.75);
test('ordinary random route reaches its next waypoint in five seconds',()=>{
 const p=make();for(let i=0;i<49;i++)p.step(100);
 const end=p.step(100);assert.ok(Math.abs(end.x-.35)<1e-12);
 p.reset();assert.deepEqual(p.step(0),{x:0,y:0});
});
test('kick accelerates the existing route without moving position immediately',()=>{
 const p=make(),plain=make();p.step(100);plain.step(100);
 const before=p.step(0);p.sample(.5,100);assert.deepEqual(p.step(0),before);
 assert.ok(p.step(16).x>plain.step(16).x*3);
});
test('motion agrees across frame rates and repeated kicks stay bounded',()=>{
 const run=dt=>{const p=make();p.sample(.5,0);let point;for(let t=0;t<480;t+=dt)point=p.step(dt);return point;};
 assert.ok(Math.abs(run(8).x-run(32).x)<1e-10);
 let seed=42;const p=new SceneFlow(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;});
 for(let i=0;i<2000;i++){p.sample(i%8===0?.5:0,i*16);const q=p.step(16);assert.ok(Math.abs(q.x)<=1&&Math.abs(q.y)<=1);}
});

test('waypoint joins preserve velocity and acceleration in a turning route',()=>{
 const values=[.9,.1,.2,.8,.7,.6,.1,.3];let i=0;
 const p=new SceneFlow(()=>values[(i++)%values.length]);
 for(let n=0;n<49;n++)p.step(100);
 p.step(98);const samples=[p.step(0),p.step(1),p.step(1),p.step(1),p.step(1)];
 for(const axis of ['x','y']){
  const s=samples.map(q=>q[axis]);
  const before=s[2]-2*s[1]+s[0],after=s[4]-2*s[3]+s[2];
  assert.ok(Math.abs(before-after)<1e-9);
  assert.ok(Math.abs((s[2]-s[1])-(s[3]-s[2]))<1e-7);
 }
});
