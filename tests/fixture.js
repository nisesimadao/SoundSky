// Settings frames emulate SoundCloud's native theme control without creating a second player.
if (window !== window.top) {
 document.body.className='theme-dark';
 document.body.innerHTML='<main><h1>Settings fixture</h1><h3>Change theme</h3><label><input type="radio" name="theme" value="light"> Light</label> <label><input type="radio" name="theme" value="dark" checked> Dark</label></main>';
 document.querySelectorAll('input[name="theme"]').forEach(input=>input.addEventListener('change',()=>{document.body.classList.toggle('theme-light',input.value==='light');document.body.classList.toggle('theme-dark',input.value==='dark');}));
} else {
 document.body.classList.add('theme-dark');
const q = s => document.querySelector(s);
q('.playbackSoundBadge__avatar span').style.backgroundImage='url("https://i1.sndcdn.com/artworks-7dVRWT0Yre5thf5c-54ZfkA-t120x120.png")';
let index=0, playing=false, tick;
const tracks = ['In the quiet between','A place beyond the horizon','After the last light','Slowly, then all at once','The other side of silence','Waterline','Midnight, passing','Air & absence','Everything is moving','At the edge of morning'];
function rows(){ q('.queue__itemsContainer').innerHTML=tracks.map((t,i)=>`<div class="queue__itemWrapper"><div class="queueItemView ${i===index?'m-active':''}"><div class="queueItemView__artwork"><div class="queueItemView__artworkImage"><span style="background-image:url(/artwork.jpg)"></span></div></div><div class="queueItemView__details"><div class="queueItemView__meta"><a class="queueItemView__username" href="/artist">Aural State</a></div><div class="queueItemView__title"><a href="/artist/${i===0?'track':'track-'+i}">${t}</a></div></div><div class="queueItemView__duration">4:08</div><div class="queueItemView__actions"><button class="queueItemView__more" aria-owns="fixture-menu-${i}">More</button></div></div></div>`).join('')+'<div class="queueFallback"><div class="queueFallback__stationMode"><div><div class="queueFallback__heading">Autoplay station</div><div class="queueFallback__subheading">Hear related tracks based on what’s playing now.</div></div><label><input type="checkbox" checked> Autoplay</label></div></div>'; }
function change(delta=1){ index=(index+delta+tracks.length)%tracks.length; q('.playbackSoundBadge__titleLink').setAttribute('href',index===0?'/artist/track':'/artist/track-'+index); q('.playbackSoundBadge__titleLink').title=tracks[index]; q('.playbackTimeline__progressWrapper').setAttribute('aria-valuenow','0'); rows(); }
rows();
q('.playbackSoundBadge__showQueue').onclick=()=>q('.queue').classList.toggle('m-visible'); q('.queue__hide').onclick=()=>q('.queue').classList.remove('m-visible');
q('.playControl').onclick=()=>{ playing=!playing; q('.playControl').title=playing?'Pause current':'Play current'; clearInterval(tick); if(playing) tick=setInterval(()=>{const bar=q('.playbackTimeline__progressWrapper');const value=Number(bar.getAttribute('aria-valuenow'))+1;if(value>=248) change();else bar.setAttribute('aria-valuenow',value);},1000); };
q('.skipControl__next').onclick=()=>change();q('.skipControl__previous').onclick=()=>change(-1);q('#change').onclick=()=>change();
q('#long').onclick=()=>{q('.playbackSoundBadge__titleLink').title='A very long track title / 星の消えた夜、静けさの中に残った音のすべて — An Extended Live Session Somewhere Beyond the Horizon (2026 Remastered Edition)';};
q('#empty').onclick=()=>q('.queue__itemsContainer').replaceChildren();q('#no-art').onclick=()=>q('.playbackSoundBadge__avatar span').removeAttribute('style');
q('.playbackSoundBadge__like').onclick=()=>q('.playbackSoundBadge__like').classList.toggle('sc-button-selected');q('.playbackSoundBadge__follow').onclick=()=>q('.playbackSoundBadge__follow').classList.toggle('sc-button-selected');
q('.queue').addEventListener('click',e=>{const more=e.target.closest('.queueItemView__more'); if(!more)return;const id=more.getAttribute('aria-owns');const old=document.getElementById(id);if(old){old.remove();return;}const menu=document.createElement('div');menu.id=id;menu.className='dropdownMenu';menu.innerHTML='<button class="sc-button-repost" title="Repost">Repost</button>';document.body.append(menu);});
q('.playbackTimeline__progressWrapper').onmousedown=e=>{const r=e.currentTarget.getBoundingClientRect();e.currentTarget.setAttribute('aria-valuenow',Math.round((e.clientX-r.left)/r.width*248));};
q('.volume__sliderWrapper').onmousedown=e=>{const r=e.currentTarget.querySelector('.volume__sliderBackground').getBoundingClientRect();e.currentTarget.setAttribute('aria-valuenow',Math.max(0,Math.min(1,(r.bottom-e.clientY)/r.height)));};
q('.volume__button').onclick=()=>q('.volume__sliderWrapper').setAttribute('aria-valuenow',q('.volume__sliderWrapper').getAttribute('aria-valuenow')==='0'?'0.4':'0');

}
