import { PlaybackClock } from './playback-clock';
import {unmountShader} from './shader-lifecycle';
import {createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LiquidMetal,MeshGradient} from '@paper-design/shaders-react';
import {icon} from './icons';
import {seekMaterial} from './seek-material';
import type {SoundCloudAdapter} from './adapter';
import type {PlayerState} from './types';
import css from './native-transport.css';

/** Decorative additions keep SoundCloud's controls, hit areas and handlers intact. */
export class NativeTransport {
 private entry=document.createElement('button');
 private style=document.createElement('style');
 private enabled=false;
 private open=false;
 private state:PlayerState|null=null;
 private clock=new PlaybackClock();
 private frame=0;
 private dragging=false;
 private level=0;
 private onset=0;
 private audioAt=0;
 private hue=210;
 private metalSpeed=2.8;
 private seekSpeed=.3;
 private roots=new Map<HTMLElement,Root>();
 private decorations=new Set<HTMLElement>();
 private bar:HTMLElement|null=null;
 private metal:HTMLElement|null=null;
 private observedRoot:HTMLElement|null=null;
 private observer=new MutationObserver(()=>{
  if(!this.enabled)return;
  const play=this.adapter.query<HTMLElement>('.playControl');
  if(play&&(!play.contains(this.metal)||!play.querySelector('[data-soundsky-glyph]')||play.querySelector('[data-soundsky-glyph]')?.getAttribute('data-icon')!==this.playGlyph(play))) {
   this.decorate('.playControl',this.playGlyph(play),true);
  }
 });
 private docked:boolean|null=null;
 private intersectionVisible:boolean|null=null;
 private dockObserver=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
  const entry=entries[0];this.intersectionVisible=!!entry?.isIntersecting&&entry.intersectionRatio>=.99;this.updateDock();
 },{threshold:[0,1]});
 private updateDock=()=>{
  if(this.open)return;
  const rect=this.entry.getBoundingClientRect(),style=getComputedStyle(this.entry);
  const visible=this.entry.isConnected&&!this.entry.hidden&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight&&style.display!=='none'&&style.visibility!=='hidden'&&this.intersectionVisible!==false&&(this.entry.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true})??true);
  if(visible!==this.docked){this.docked=visible;this.onDock(visible);}
 };
 private playGlyph(play:HTMLElement){return play.classList.contains('playing')||/pause/i.test(play.getAttribute('title')||play.getAttribute('aria-label')||'')?'pause':'play';}
 private events=new AbortController();
 private motion=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(private adapter:SoundCloudAdapter,onOpen:()=>void,private onDock:(docked:boolean)=>void){
  this.style.textContent=css;this.style.dataset.soundskyTransportStyle='';document.head.append(this.style);
  this.entry.type='button';this.entry.dataset.soundskyEntry='';this.entry.innerHTML=icon('music');
  this.entry.title='Open SoundSky · Alt/Option + Shift + Y';this.entry.setAttribute('aria-label','Open SoundSky');
  this.entry.addEventListener('click',onOpen,{signal:this.events.signal});
  const signal=this.events.signal;
  this.dockObserver?.observe(this.entry);window.addEventListener('resize',this.updateDock,{signal});
  document.addEventListener('pointerdown',e=>{if((e.target as Element)?.closest('.playbackTimeline__progressWrapper'))this.dragging=true;},{signal});
  const released=()=>{this.dragging=false;this.adapter.emit();};
  document.addEventListener('pointerup',released,{signal});document.addEventListener('pointercancel',released,{signal});
  document.addEventListener('visibilitychange',()=>{this.adapter.emit();this.animateMaterials();this.start();},{signal});
  this.motion.addEventListener('change',()=>{this.animateMaterials();this.start();},{signal});
 }
 sync(state:PlayerState){
  const now=performance.now();
  this.clock.sync(state.track.key,state.current,state.playing,now,this.dragging);
  const playingChanged=this.state?.playing!==state.playing||this.state?.muted!==state.muted;
  this.state=state;
  const controls=this.adapter.query<HTMLElement>('.playControls__elements');
  if(controls&&!controls.contains(this.entry)){for(const stale of controls.querySelectorAll('[data-soundsky-entry]'))stale.remove();controls.append(this.entry);}
  this.entry.hidden=this.open;this.updateDock();
  if(!this.enabled)return;
  if(this.observedRoot!==this.adapter.root){this.observer.disconnect();this.observedRoot=this.adapter.root;if(this.observedRoot)this.observer.observe(this.observedRoot,{subtree:true,childList:true,attributes:true,attributeFilter:['class','title','aria-label']});}
  this.decorate('.playControl',state.playing?'pause':'play',true);
  for(const [selector,glyph] of [['.skipControl__previous','previous'],['.skipControl__next','next'],['.volume__button',state.muted?'mute':'volume'],['.playbackSoundBadge__like','heart'],['.playbackSoundBadge__follow','follow'],['.playbackSoundBadge__showQueue','queue'],['.playControls__shuffle button','shuffle'],['.playControls__repeat button','repeat']])this.decorate(selector,glyph);
  const bar=this.adapter.query<HTMLElement>('.playbackTimeline__progressBar');
  if(bar!==this.bar||bar&&!bar.querySelector('[data-soundsky-seek]')){this.bar=bar;if(bar)this.shader(bar,'seek');}
  this.cleanupDetached();if(playingChanged)this.animateMaterials();this.start();
 }
 private decorate(selector:string,glyph:string,metal=false){
  const control=this.adapter.query<HTMLElement>(selector);if(!control)return;
  control.setAttribute('data-soundsky-control',metal?'play':'icon');
  let overlay=control.querySelector<HTMLElement>(':scope > [data-soundsky-glyph]');
  if(!overlay){overlay=document.createElement('span');overlay.dataset.soundskyGlyph='';overlay.setAttribute('aria-hidden','true');control.append(overlay);this.decorations.add(overlay);}
  if(overlay.dataset.icon!==glyph){overlay.dataset.icon=glyph;overlay.innerHTML=icon(glyph);}
  if(metal){
   // SoundCloud rewrites the button's children on play/pause. Reattach our existing
   // surface before paint, keeping the React root, GPU context and shader phase.
   if(!this.metal){this.metal=document.createElement('span');this.metal.dataset.soundskyMetal='';this.metal.setAttribute('aria-hidden','true');this.decorations.add(this.metal);}
   if(this.metal.parentElement!==control)control.append(this.metal);
   this.shader(this.metal,'metal');
  }
 }
 private shader(element:HTMLElement,kind:'metal'|'seek'){
  if(typeof WebGL2RenderingContext==='undefined'||this.roots.has(element))return;
  if(kind==='seek'){const surface=document.createElement('span');surface.dataset.soundskySeek='';surface.setAttribute('aria-hidden','true');element.append(surface);this.decorations.add(surface);element=surface;}
  if(this.roots.has(element))return;
  this.roots.set(element,createRoot(element));this.animateMaterials();
 }
 private cleanupDetached(){for(const [el,root]of this.roots)if(!el.isConnected){unmountShader(root,el);this.roots.delete(el);}for(const el of this.decorations)if(!el.isConnected)this.decorations.delete(el);}
 private animateMaterials(){
  const moving=this.enabled&&!this.open&&!document.hidden&&!this.motion.matches&&this.state?.playing;
  const audible=moving&&!this.state?.muted&&performance.now()-this.audioAt<200;
  for(const [el,root]of this.roots){
   if(el.hasAttribute('data-soundsky-metal'))root.render(createElement(LiquidMetal,{width:'100%',height:'100%',colorBack:'#aaaaac',colorTint:'#ffffff',shape:'circle',repetition:2,softness:.1,shiftRed:.3,shiftBlue:.3,distortion:.07,contour:.4,angle:70,speed:moving?(.6+(audible?this.level*5+this.onset*12:0))*this.metalSpeed:0,scale:1.12,fit:'contain',minPixelRatio:1,maxPixelCount:4096}));
   else root.render(createElement(MeshGradient,seekMaterial(this.hue,moving?this.seekSpeed*(.5+(audible?this.level:0)):0)));
  }
 }
 setEnabled(enabled:boolean){if(this.enabled===enabled)return;this.enabled=enabled;if(!enabled)this.clear();else if(this.state)this.sync(this.state);}
 setOpen(open:boolean){this.open=open;this.entry.hidden=open;this.updateDock();this.animateMaterials();this.start();}
 setAccent(hue:number){this.hue=hue;this.animateMaterials();}
 setAudio(level:number,onset:number){this.level=level;this.onset=onset;this.audioAt=performance.now();if(this.enabled&&!this.open)this.animateMaterials();}
 setSpeeds(metal:number,seek:number){this.metalSpeed=metal;this.seekSpeed=seek;this.animateMaterials();}
 private start(){if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}if(this.enabled&&!this.open&&!document.hidden)this.frame=requestAnimationFrame(this.tick);}
 private tick=(now:number)=>{
  this.frame=0;if(!this.enabled||this.open||document.hidden||!this.state)return;
  const progress=this.adapter.query<HTMLElement>('.playbackTimeline__progressWrapper');
  if(progress&&!this.dragging){
   // Native aria values are authoritative; extrapolate only between updates, never beyond 1.25s.
   const current=Math.min(this.state.duration,this.clock.read(now));
   const ratio=this.state.duration?Math.min(1,Math.max(0,current/this.state.duration)):0;
   progress.style.setProperty('--soundsky-seek-width', `${progress.getBoundingClientRect().width}px`);
   progress.style.setProperty('--soundsky-progress',`${ratio*100}%`);progress.setAttribute('data-soundsky-progress','');
  }else {progress?.removeAttribute('data-soundsky-progress');progress?.style.removeProperty('--soundsky-progress');progress?.style.removeProperty('--soundsky-seek-width');}
  this.frame=requestAnimationFrame(this.tick);
 };
 private clear(){
  this.observer.disconnect();this.observedRoot=null;
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
  for(const [el,root] of this.roots)unmountShader(root,el);this.roots.clear();for(const el of this.decorations)el.remove();this.decorations.clear();this.bar=null;this.metal=null;
  for(const el of this.adapter.root?.querySelectorAll('[data-soundsky-control]')??[])el.removeAttribute('data-soundsky-control');
  for(const el of this.adapter.root?.querySelectorAll<HTMLElement>('[data-soundsky-progress]')??[]){el.removeAttribute('data-soundsky-progress');el.style.removeProperty('--soundsky-progress');el.style.removeProperty('--soundsky-seek-width');}
 }
 destroy(){this.dockObserver?.disconnect();this.events.abort();this.clear();this.entry.remove();this.style.remove();this.onDock(false);}
}
