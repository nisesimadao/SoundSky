import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=await build({entryPoints:['src/native-cover.ts'],bundle:true,write:false,format:'iife',globalName:'coverTest',footer:{js:'window.coverTest=coverTest;'},loader:{'.css':'text'}});
function setup(path='/artist/track',modern=false){
 const html=modern?'<section aria-label="Track header"><img src="https://i1.sndcdn.com/avatars-user.jpg"><div id="art" style="scale:1.02!important;border-radius:12px;transform:translateX(2px)"><img src="https://i1.sndcdn.com/artworks-track.jpg"></div></section>':'<div class="fullHero"><div id="art" class="fullHero__artwork" style="transform:translateX(2px)"></div></div>';
 const dom=new JSDOM(html,{url:'https://soundcloud.com'+path,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 let time=0,id=0;const frames=new Map();w.performance.now=()=>time;w.requestAnimationFrame=f=>{frames.set(++id,f);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 const motion={matches:false,addEventListener(){},removeEventListener(){}};w.matchMedia=()=>motion;w.eval(bundle.outputFiles[0].text);
 const cover=new w.coverTest.NativeCover();const art=w.document.querySelector('#art'),original=art.style.cssText;
 const state={trackKey:'/artist/track',contextKey:'/artist/sets/album',playing:true,muted:false,maximum:.15,sensitivity:3};
 const tick=()=>{time+=16;for(const [key,callback]of [...frames]){frames.delete(key);callback(time);}};
 const audio=()=>{for(let i=0;i<20;i++){cover.setAudio(.2,0);tick();}};
 return {dom,w,cover,art,original,state,frames,tick,audio,motion};
}
test('native track cover shares continuous response and restores native styles on pause, mute, disable and destroy',()=>{
 const t=setup();t.cover.setState(t.state);t.cover.setEnabled(true);t.audio();assert.ok(Math.abs(Number(t.art.style.scale)-1.06)<.002);assert.equal(t.art.style.transform,'translateX(2px)');
 t.cover.setState({...t.state,playing:false});for(let i=0;i<30;i++)t.tick();assert.equal(Number(t.art.style.scale),1);assert.equal(t.frames.size,0);
 t.cover.setState(t.state);t.audio();t.cover.setState({...t.state,muted:true});for(let i=0;i<30;i++)t.tick();assert.equal(Number(t.art.style.scale),1);
 t.cover.setEnabled(false);assert.equal(t.art.style.cssText,t.original);t.cover.destroy();assert.equal(t.frames.size,0);t.dom.window.close();
});
test('playlist context must match the actual playback context, even if other playlists contain the same song',()=>{
 const t=setup('/artist/sets/album');t.cover.setEnabled(true);t.cover.setState({...t.state,contextKey:'/artist/sets/other'});t.audio();assert.equal(t.art.style.scale,'');
 t.cover.setState(t.state);t.audio();assert.ok(Number(t.art.style.scale)>1.05);
 t.cover.setState({...t.state,contextKey:''});assert.equal(t.art.style.scale,'');assert.equal(t.frames.size,0);t.cover.destroy();t.dom.window.close();
});
test('embedded modern header animates the artwork frame, preserves avatars and restores inline priorities',()=>{
 const t=setup('/n/artist/track',true);t.cover.setEnabled(true);t.cover.setState(t.state);t.audio();assert.ok(Number(t.art.style.scale)>1.05);
 assert.equal(t.w.document.querySelector('img[src*=avatars]').style.scale,'');
 t.cover.setOpen(true);assert.equal(t.art.style.scale,'1.02');assert.equal(t.art.style.getPropertyPriority('scale'),'important');assert.equal(t.art.style.borderRadius,'12px');assert.equal(t.frames.size,0);
 t.cover.setOpen(false);t.audio();t.motion.matches=true;t.cover.setState(t.state);assert.equal(t.art.style.scale,'1.02');t.cover.destroy();t.dom.window.close();
});
test('tag, home and playlist lists animate every matching cover while leaving other songs and avatars alone',async()=>{
 const t=setup('/tags/garage');
 t.w.document.body.insertAdjacentHTML('beforeend',`<div class="sound__artwork" id="tag"><a class="sound__coverArt" href="/artist/track"><div class="image"><span class="image__full" style="background-image:url(https://i1.sndcdn.com/artworks-track.jpg)"></span></div></a></div><div class="playableTile__artwork" id="album"><a href="/artist/sets/album"><img src="https://i1.sndcdn.com/artworks-album.jpg"></a></div><div class="sound__artwork" id="other"><a href="/artist/other"><img src="https://i1.sndcdn.com/artworks-other.jpg"></a></div><div class="trackItem"><div class="trackItem__image"><div class="image" id="row-art"><span class="image__full"></span></div></div><div class="trackItem__content"><a href="/artist/track?in=artist/sets/album">Song</a></div></div><a href="/artist/track" id="avatar"><img class="sc-avatar" src="https://i1.sndcdn.com/avatars-user.jpg"></a>`);
 t.cover.setEnabled(true);t.cover.setState(t.state);t.audio();
 for(const id of ['tag','album','row-art'])assert.ok(Number(t.w.document.getElementById(id).style.scale)>1.05);
 for(const id of ['other','avatar'])assert.equal(t.w.document.getElementById(id).style.scale,'');
 assert.equal(t.art.style.scale,'');
 // A lazy-loaded duplicate cover should join the existing envelope.
 t.w.document.body.insertAdjacentHTML('beforeend','<a id="lazy" href="/artist/track"><img src="https://i1.sndcdn.com/artworks-track.jpg"></a>');await Promise.resolve();t.audio();assert.ok(Number(t.w.document.getElementById('lazy').style.scale)>1.05);
 t.cover.setState({...t.state,trackKey:'/artist/other',contextKey:''});t.audio();assert.equal(t.w.document.getElementById('tag').style.scale,'');assert.equal(t.w.document.getElementById('album').style.scale,'');assert.ok(Number(t.w.document.getElementById('other').style.scale)>1.05);
 t.cover.setEnabled(false);assert.equal(t.w.document.getElementById('other').style.scale,'');t.cover.destroy();t.dom.window.close();
});
test('modern cover with native loading overlay expands its clipping box',()=>{
 const t=setup('/n/artist/track',true);t.art.insertAdjacentHTML('beforeend','<div class="loading-overlay"></div>');t.cover.setEnabled(true);t.cover.setState(t.state);t.audio();assert.ok(Number(t.art.style.scale)>1.05);assert.equal(t.art.querySelector('img').style.scale,'');t.cover.destroy();t.dom.window.close();
});
