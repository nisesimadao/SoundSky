import {createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LiquidMetal,MeshGradient} from '@paper-design/shaders-react';
import {icon} from './icons';
import {accentShaderColor} from './accent';
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
 private at=0;
 private current=0;
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
 private events=new AbortController();
 private motion=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(private adapter:SoundCloudAdapter,onOpen:()=>void,private onDock:(docked:boolean)=>void){
  this.style.textContent=css;this.style.dataset.soundskyTransportStyle='';document.head.append(this.style);
  this.entry.type='button';this.entry.dataset.soundskyEntry='';this.entry.innerHTML=icon('sky');
  this.entry.title='Open SoundSky · Alt/Option + Shift + Y';this.entry.setAttribute('aria-label','Open SoundSky');
  this.entry.addEventListener('click',onOpen,{signal:this.events.signal});
  const signal=this.events.signal;
  document.addEventListener('pointerdown',e=>{if((e.target as Element)?.closest('.playbackTimeline__progressWrapper'))this.dragging=true;},{signal});
  const released=()=>{this.dragging=false;this.adapter.emit();};
  document.addEventListener('pointerup',released,{signal});document.addEventListener('pointercancel',released,{signal});
  document.addEventListener('visibilitychange',()=>{this.adapter.emit();this.animateMaterials();this.start();},{signal});
  this.motion.addEventListener('change',()=>{this.animateMaterials();this.start();},{signal});
 }
 sync(state:PlayerState){
  const now=performance.now();
  if(!this.state||state.track.key!==this.state.track.key||state.current!==this.state.current||state.playing!==this.state.playing){this.current=state.current;this.at=now;}
  const playingChanged=this.state?.playing!==state.playing||this.state?.muted!==state.muted;
  this.state=state;
  const controls=this.adapter.query<HTMLElement>('.playControls__elements');
  if(controls&&!controls.contains(this.entry)){for(const stale of controls.querySelectorAll('[data-soundsky-entry]'))stale.remove();controls.append(this.entry);}
  this.onDock(!!controls&&this.entry.isConnected);this.entry.hidden=this.open;
  if(!this.enabled)return;
  this.decorate('.playControl',state.playing?'pause':'play',true);
  for(const [selector,glyph] of [['.skipControl__previous','previous'],['.skipControl__next','next'],['.volume__button',state.muted?'mute':'volume'],['.playbackSoundBadge__like','heart'],['.playbackSoundBadge__follow','follow'],['.playbackSoundBadge__showQueue','queue'],['.playControls__shuffle','shuffle'],['.playControls__repeat','repeat']])this.decorate(selector,glyph);
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
  if(metal){let surface=control.querySelector<HTMLElement>(':scope > [data-soundsky-metal]');if(!surface){surface=document.createElement('span');surface.dataset.soundskyMetal='';surface.setAttribute('aria-hidden','true');control.append(surface);this.decorations.add(surface);this.shader(surface,'metal');}}
 }
 private shader(element:HTMLElement,kind:'metal'|'seek'){
  if(typeof WebGL2RenderingContext==='undefined'||this.roots.has(element))return;
  if(kind==='seek'){const surface=document.createElement('span');surface.dataset.soundskySeek='';surface.setAttribute('aria-hidden','true');element.append(surface);this.decorations.add(surface);element=surface;}
  if(this.roots.has(element))return;
  this.roots.set(element,createRoot(element));this.animateMaterials();
 }
 private cleanupDetached(){for(const [el,root]of this.roots)if(!el.isConnected){root.unmount();this.roots.delete(el);}for(const el of this.decorations)if(!el.isConnected)this.decorations.delete(el);}
 private animateMaterials(){
  const moving=this.enabled&&!this.open&&!document.hidden&&!this.motion.matches&&this.state?.playing;
  const audible=moving&&!this.state?.muted&&performance.now()-this.audioAt<200;
  for(const [el,root]of this.roots){
   if(el.hasAttribute('data-soundsky-metal'))root.render(createElement(LiquidMetal,{width:'100%',height:'100%',colorBack:'#aaaaac',colorTint:'#ffffff',shape:'circle',repetition:2,softness:.1,shiftRed:.3,shiftBlue:.3,distortion:.07,contour:.4,angle:70,speed:moving?(.6+(audible?this.level*5+this.onset*12:0))*this.metalSpeed:0,scale:1.12,fit:'contain',minPixelRatio:1,maxPixelCount:4096}));
   else root.render(createElement(MeshGradient,{width:'100%',height:'100%',colors:[-14,0,14,0].map(offset=>accentShaderColor((this.hue+offset+360)%360)),distortion:.5,swirl:.1,grainMixer:0,grainOverlay:0,speed:moving?this.seekSpeed*(.5+(audible?this.level:0)):0,scale:1,minPixelRatio:1,maxPixelCount:8192}));
  }
 }
 setEnabled(enabled:boolean){if(this.enabled===enabled)return;this.enabled=enabled;if(!enabled)this.clear();else if(this.state)this.sync(this.state);}
 setOpen(open:boolean){this.open=open;this.entry.hidden=open;this.animateMaterials();this.start();}
 setAccent(hue:number){this.hue=hue;this.animateMaterials();}
 setAudio(level:number,onset:number){this.level=level;this.onset=onset;this.audioAt=performance.now();if(this.enabled&&!this.open)this.animateMaterials();}
 setSpeeds(metal:number,seek:number){this.metalSpeed=metal;this.seekSpeed=seek;this.animateMaterials();}
 private start(){if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}if(this.enabled&&!this.open&&!document.hidden)this.frame=requestAnimationFrame(this.tick);}
 private tick=(now:number)=>{
  this.frame=0;if(!this.enabled||this.open||document.hidden||!this.state)return;
  const progress=this.adapter.query<HTMLElement>('.playbackTimeline__progressWrapper');
  if(progress&&!this.dragging){
   // Native aria values are authoritative; extrapolate only between updates, never beyond 1.25s.
   const current=Math.min(this.state.duration,this.current+(this.state.playing?Math.min(1.25,Math.max(0,now-this.at)/1000):0));
   const ratio=this.state.duration?Math.min(1,Math.max(0,current/this.state.duration)):0;
   progress.style.setProperty('--soundsky-progress',`${ratio*100}%`);progress.setAttribute('data-soundsky-progress','');
  }else {progress?.removeAttribute('data-soundsky-progress');progress?.style.removeProperty('--soundsky-progress');}
  this.frame=requestAnimationFrame(this.tick);
 };
 private clear(){
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
  for(const root of this.roots.values())root.unmount();this.roots.clear();for(const el of this.decorations)el.remove();this.decorations.clear();this.bar=null;
  for(const el of this.adapter.root?.querySelectorAll('[data-soundsky-control]')??[])el.removeAttribute('data-soundsky-control');
  for(const el of this.adapter.root?.querySelectorAll<HTMLElement>('[data-soundsky-progress]')??[]){el.removeAttribute('data-soundsky-progress');el.style.removeProperty('--soundsky-progress');}
 }
 destroy(){this.events.abort();this.clear();this.entry.remove();this.style.remove();this.onDock(false);}
}
