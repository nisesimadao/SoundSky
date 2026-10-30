import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
await build({ entryPoints:['src/adapter.ts'], outfile:'artifacts/adapter-test.mjs', bundle:true, platform:'node', format:'esm' });
const { SoundCloudAdapter, canonical, artworkURL } = await import(pathToFileURL(`${process.cwd()}/artifacts/adapter-test.mjs`));
let dom, adapter;
beforeEach(()=>{
  dom=new JSDOM(`<!doctype html><body><main><button class="sc-button-like">Other like</button><button class="sc-button-follow">Other artist</button><button class="sc-button-repost">Other repost</button></main><div class="playControls"><div class="playControl" title="Pause current"></div><button class="skipControl__previous"></button><button class="skipControl__next"></button><div class="playbackTimeline is-scrubbable"><div class="playbackTimeline__progressWrapper" aria-valuenow="29" aria-valuemax="189"></div></div><div class="volume"><button class="volume__button"></button><div class="volume__sliderWrapper" aria-valuenow="0.4"><div class="volume__sliderBackground"></div></div></div><div class="playbackSoundBadge"><a class="playbackSoundBadge__titleLink" title="Track one" href="/artist/one"></a><a class="playbackSoundBadge__lightLink" title="Artist" href="/artist"></a><a class="playbackSoundBadge__avatar"><span style="background-image:url(https://i1.sndcdn.com/artworks-example-t120x120.jpg)"></span></a><button class="playbackSoundBadge__like sc-button-selected"></button><button class="playbackSoundBadge__follow"></button></div><div class="queueItemView m-active"><div class="queueItemView__title"><a href="/artist/one">Track one</a></div><button class="queueItemView__more" aria-owns="owned-current"></button></div></div></body>`,{url:'https://soundcloud.com/discover'});
  for(const key of ['document','window','Element','HTMLElement','HTMLImageElement','MutationObserver','MouseEvent','Event'])globalThis[key]=key==='window'?dom.window:key==='document'?dom.window.document:dom.window[key];
  adapter=new SoundCloudAdapter(document);
});
afterEach(()=>{adapter.destroy();dom.window.close();});
test('reads actual player independently of the browsed page',()=>{
 const s=adapter.read();assert.equal(s.track.key,'/artist/one');assert.equal(s.track.artistKey,'/artist');assert.equal(s.playing,true);assert.equal(s.duration,189);assert.equal(s.current,29);assert.equal(s.actions.like.selected,true);assert.equal(s.actions.follow.selected,false);
});
test('only current-track and current-artist native controls receive social actions',async()=>{
 let other=0,like=0,follow=0;document.querySelector('main').onclick=()=>other++;
 document.querySelector('.playbackSoundBadge__like').onclick=()=>like++;
 document.querySelector('.playbackSoundBadge__follow').onclick=()=>follow++;
 const track=adapter.readTrack();assert.equal(await adapter.perform('like',track),true);assert.equal(await adapter.perform('follow',track),true);assert.equal(other,0);assert.equal(like,1);assert.equal(follow,1);
});
test('refuses stale track and stale artist actions',async()=>{
 const track=adapter.readTrack();let hits=0;adapter.root.onclick=()=>hits++;
 document.querySelector('.playbackSoundBadge__titleLink').href='/artist/two';assert.equal(await adapter.perform('like',track),false);
 document.querySelector('.playbackSoundBadge__titleLink').href='/artist/one';document.querySelector('.playbackSoundBadge__lightLink').href='/another';assert.equal(await adapter.perform('follow',track),false);assert.equal(hits,0);
});
test('cannot borrow a repost button from another track or an unowned menu',async()=>{
 const row=document.querySelector('.queueItemView__title a');row.href='/other/track';let hits=0;document.querySelector('.queueItemView__more').onclick=()=>hits++;
 assert.equal(await adapter.perform('repost',adapter.readTrack()),false);assert.equal(hits,0);assert.equal(adapter.read().actions.repost.available,false);
});
test('repost probing is read-only and restricted to the current row owned menu',async()=>{
 let writes=0;const more=document.querySelector('.queueItemView__more');more.onclick=()=>{
  const old=document.getElementById('owned-current');if(old){old.remove();return;}
  const menu=document.createElement('div');menu.id='owned-current';menu.innerHTML='<button class="sc-button-repost sc-button-selected"></button>';menu.firstChild.onclick=()=>writes++;document.body.append(menu);
 };
 await adapter.probeRepost();assert.equal(writes,0);assert.equal(document.getElementById('owned-current'),null);assert.deepEqual(adapter.read().actions.repost,{available:true,selected:true});
});
test('rechecks identity after an asynchronous repost menu opens',async()=>{
 let writes=0;document.querySelector('.queueItemView__more').onclick=()=>{
  document.querySelector('.playbackSoundBadge__titleLink').href='/artist/two';
  const menu=document.createElement('div');menu.id='owned-current';menu.innerHTML='<button class="sc-button-repost"></button>';menu.firstChild.onclick=()=>writes++;document.body.append(menu);
 };
 assert.equal(await adapter.perform('repost',adapter.readTrack()),false);assert.equal(writes,0);
});
test('seek rejects a track change during a drag',()=>{
 const key=adapter.readTrack().key;document.querySelector('.playbackSoundBadge__titleLink').href='/artist/two';assert.equal(adapter.seek(.5,key),false);
});
test('repost presents only the owned native control without changing the account',async()=>{
 let writes=0;const more=document.querySelector('.queueItemView__more');more.onclick=()=>{const old=document.getElementById('owned-current');if(old){old.remove();return;}const menu=document.createElement('div');menu.id='owned-current';menu.innerHTML='<button class="sc-button-repost"></button>';menu.firstChild.onclick=()=>writes++;document.body.append(menu);};
 assert.equal(await adapter.perform('repost',adapter.readTrack()),true);assert.equal(writes,0);assert.equal(adapter.repostMenu().hasAttribute('data-soundsky-menu'),true);assert.equal(adapter.read().actions.repost.available,true);adapter.dismissMenu();assert.equal(document.getElementById('owned-current'),null);
});
test('missing player yields graceful unavailable state',()=>{
 adapter.root.remove();adapter.root=null;const s=adapter.read();assert.equal(s.track.key,'');assert.equal(s.canPlay,false);assert.equal(s.canSeek,false);assert.equal(s.canVolume,false);assert.equal(s.actions.like.available,false);
});
test('validates canonical targets and permits artwork only from SoundCloud CDN',()=>{
 assert.equal(canonical('https://soundcloud.com/artist/track?in=x#y'),'/artist/track');assert.equal(canonical('https://soundcloud.com.evil.test/artist/track'),'');assert.equal(canonical('javascript:alert(1)'),'');assert.equal(artworkURL('https://i1.sndcdn.com/artwork.jpg'),'https://i1.sndcdn.com/artwork.jpg');assert.equal(artworkURL('https://sndcdn.com.evil.test/a.jpg'),'');assert.equal(artworkURL('data:text/html,hi'),'');
});
test('rebinds a replaced native player root',async()=>{
 let changes=0;adapter.onRootChange=()=>changes++;
 const replacement=adapter.root.cloneNode(true);replacement.querySelector('.playbackSoundBadge__titleLink').setAttribute('href','/artist/new');adapter.root.replaceWith(replacement);
 await new Promise(r=>setTimeout(r,2100));assert.equal(adapter.readTrack().key,'/artist/new');assert.equal(changes,1);
});

test('follow falls back only to the verified current artist badge',async()=>{
 document.querySelector('.playbackSoundBadge__follow').remove();
 const user=document.createElement('div');user.className='userBadge';user.innerHTML='<a class="userBadge__usernameLink" href="/artist"></a><button class="sc-button-follow"></button>';document.body.append(user);
 let clicks=0;user.querySelector('button').onclick=()=>clicks++;
 assert.equal(adapter.read().actions.follow.available,true);
 assert.equal(await adapter.perform('follow',adapter.readTrack()),true);assert.equal(clicks,1);
 user.querySelector('a').href='/another';assert.equal(adapter.read().actions.follow.available,false);
});
test('a failed repost probe is retried when the owned menu becomes available',async()=>{
 const more=document.querySelector('.queueItemView__more');let available=false;
 more.onclick=()=>{const old=document.getElementById('owned-current');if(old){old.remove();return;}const menu=document.createElement('div');menu.id='owned-current';if(available)menu.innerHTML='<button class="sc-button-repost"></button>';document.body.append(menu);};
 await adapter.probeRepost();assert.equal(adapter.read().actions.repost.available,false);
 available=true;await adapter.probeRepost(true);assert.equal(adapter.read().actions.repost.available,true);
});

test('repeated tab returns immediately rebind controls replaced while inactive',()=>{
 let latest;
 adapter.subscribe(state=>latest=state);
 for(let i=0;i<12;i++){
  adapter.setActive(false);
  const replacement=adapter.root.cloneNode(true),key=`/artist/returned-${i}`;
  replacement.querySelector('.playbackSoundBadge__titleLink').setAttribute('href',key);
  adapter.root.replaceWith(replacement);
  let plays=0;replacement.querySelector('.playControl').onclick=()=>plays++;
  adapter.setActive(true);
  assert.equal(adapter.root,replacement);
  assert.equal(latest.track.key,key);
  assert.equal(latest.canPlay,true);
  assert.equal(adapter.click('play'),true);
  assert.equal(plays,1);
 }
});

test('play targets the live controls when the native player changes before discovery runs',()=>{
 const old=adapter.root,replacement=old.cloneNode(true);
 let oldClicks=0,newClicks=0;
 old.querySelector('.playControl').onclick=()=>oldClicks++;
 replacement.querySelector('.playControl').onclick=()=>newClicks++;
 old.replaceWith(replacement);
 assert.equal(adapter.click('play'),true);
 assert.equal(newClicks,1);
 assert.equal(oldClicks,0);
});
