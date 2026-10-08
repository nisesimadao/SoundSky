import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/artwork-palette.ts'],bundle:true,write:false,format:'esm'});
const {artworkPalette,defaultPalette,paletteAt}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const pixels=(...colors)=>new Uint8ClampedArray(colors.flatMap(c=>[...c,255]));
test('distinct artwork colors become a dark shader palette without averaging opposing hues',()=>{
 const p=artworkPalette(pixels([255,0,0],[255,0,0],[0,255,255],[0,255,0]));
 assert.notDeepEqual(p,defaultPalette);assert.equal(p.length,4);
 assert.match(p[1],/^#[0-9a-f]{2}0000$/);
 assert.ok(p.every(color=>Math.max(...[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)))<=77));
});
test('monochrome, neutral, transparent and same-hue shading use the fallback',()=>{
 for(const data of [pixels([255,0,0]),pixels([255,0,0],[120,0,0],[60,0,0]),pixels([255,255,255],[0,0,0]),new Uint8ClampedArray([255,0,0,0])])assert.deepEqual(artworkPalette(data),defaultPalette);
});
test('palette transitions keep chromatic color and exact endpoints',()=>{
 const a=['#440000','#440000','#440000','#440000'],b=['#004444','#004444','#004444','#004444'];
 assert.deepEqual(paletteAt(a,b,0),a);assert.deepEqual(paletteAt(a,b,1),b);
 const mid=paletteAt(a,b,.5);assert.ok(mid.every(c=>c!=='#222222'));
});
