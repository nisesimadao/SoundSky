import { NativeAppearance, declaredAppearance, type Appearance } from './native-appearance';
import appearanceCSS from './appearance.css';
import { createElement } from 'react';
import type { Root } from 'react-dom/client';
import { MeshGradient } from '@paper-design/shaders-react';
import { accentColor } from './accent';
import { defaultSettings, type SoundSkySettings } from './types';
import { loadSavedSettings } from './settings';
import { defaultPalette } from './artwork-palette';
import css from './site-theme.css';
import { createShaderRoot, unmountShader } from './shader-lifecycle';
import { NativeCover, type CoverPlayback } from './native-cover';
import { SiteGallery } from './site-gallery';

/** Reversible skin: a scoped stylesheet and one decorative, pointer-free canvas. */
export class SiteTheme {
  private paletteStyle = document.createElement('style');
  private nativeAppearance: NativeAppearance | null = null;
  private resolvedAppearance: Appearance = 'dark';
  private parentAppearance: Appearance | null = null;
  private style = document.createElement('style');
  private surface = document.createElement('div');
  private root: Root | null = null;
  private enabled = false;
  private cover = new NativeCover();
  private coverState: CoverPlayback | null = null;
  private open = false;
  private hue = 210;
  private colors = [...defaultPalette];
  private preferences: SoundSkySettings = { ...defaultSettings };
  private events = new AbortController();
  private inView = true;
  private observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries=>{this.inView=entries[0]?.isIntersecting??false;this.render();});
  private gallery:SiteGallery|null=null;
  private frames = new Set<HTMLIFrameElement>();
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private top = window === window.top,private decorative=true) {
    document.dispatchEvent(new Event('soundsky:theme-dispose'));
    document.addEventListener('soundsky:theme-dispose',()=>this.destroy(),{signal:this.events.signal});
    this.paletteStyle.dataset.soundskyPaletteStyle='';this.paletteStyle.textContent=appearanceCSS;document.head.append(this.paletteStyle);
    this.nativeAppearance=new NativeAppearance(theme=>{
      this.resolvedAppearance=theme;if(declaredAppearance())this.parentAppearance=null;
      this.applyAppearance();this.applyAccent();this.broadcast();
    });
    this.style.dataset.soundskySiteStyle=''; this.style.textContent=css;
    this.surface.dataset.soundskySiteShader=''; this.surface.setAttribute('aria-hidden','true');
    document.addEventListener('visibilitychange',()=>this.render(),{signal:this.events.signal});
    this.motion.addEventListener('change',()=>this.render(),{signal:this.events.signal});
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin)return;
      if(this.top && event.data?.type==='soundsky:theme-ready'){
        const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow===event.source);
        if(frame&&this.sameOriginFrame(frame)){this.frames.add(frame);frame.contentWindow?.postMessage(this.packet(),location.origin);}
      } else if(!this.top && event.source===window.parent && event.data?.type==='soundsky:site-theme'){
        const data=event.data;
        if(data.appearance==='light'||data.appearance==='dark')this.parentAppearance=data.appearance;
        if(data.settings && typeof data.settings==='object') this.setPreferences(loadSavedSettings(data.settings));
        if(typeof data.enabled==='boolean')this.setEnabled(data.enabled);
        if(typeof data.hue==='number'&&Number.isFinite(data.hue))this.setAccent(data.hue);
        if(Array.isArray(data.colors)&&data.colors.length===4&&data.colors.every((c:unknown)=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))this.setPalette(data.colors);
        this.setPlayerOpen(data.open===true);
        const cover=data.cover;
        if(cover&&typeof cover.trackKey==='string'&&typeof cover.contextKey==='string'&&typeof cover.playing==='boolean'&&typeof cover.muted==='boolean'&&Number.isFinite(cover.maximum)&&cover.maximum>=0&&cover.maximum<=.3&&Number.isFinite(cover.sensitivity)&&cover.sensitivity>=.2&&cover.sensitivity<=12)this.setCoverState(cover);
      } else if(!this.top && event.source===window.parent && event.data?.type==='soundsky:cover-audio'){
        const {level,onset}=event.data;
        if(typeof level==='number'&&Number.isFinite(level)&&level>=0&&typeof onset==='number'&&Number.isFinite(onset)&&onset>=0)this.cover.setAudio(level,onset);
      }
    },{signal:this.events.signal});
    if(!this.top)window.parent.postMessage({type:'soundsky:theme-ready'},location.origin);
  }
  private packet(){return {type:'soundsky:site-theme',enabled:this.enabled,hue:this.hue,colors:this.colors,settings:this.preferences,appearance:this.parentAppearance??this.resolvedAppearance,open:this.open,cover:this.coverState};}
  private sameOriginFrame(frame:HTMLIFrameElement){
    // src alone is insufficient: sandboxed frames and redirects can have opaque origins.
    try{return frame.isConnected&&frame.contentWindow?.location.origin===location.origin;}catch{return false;}
  }
  private broadcast(){
    if(!this.top)return;
    for(const frame of this.frames){
      if(this.sameOriginFrame(frame))frame.contentWindow?.postMessage(this.packet(),location.origin);
      else this.frames.delete(frame);
    }
  }
  setEnabled(enabled:boolean){
    if(this.enabled===enabled)return;this.enabled=enabled;
    if(enabled){document.head.append(this.style);if(this.decorative){document.body.prepend(this.surface);this.observer?.observe(this.surface);}else document.documentElement.setAttribute('data-soundsky-embed','');document.documentElement.setAttribute('data-soundsky-theme','');this.applyPreferences();}
    else {this.observer?.unobserve(this.surface);document.documentElement.removeAttribute('data-soundsky-theme');document.documentElement.removeAttribute('data-soundsky-embed');this.clearPreferences();unmountShader(this.root,this.surface);this.root=null;this.surface.remove();this.style.remove();}
    this.cover.setEnabled(enabled && this.preferences.siteArtwork);
    if(this.decorative){this.gallery??=new SiteGallery();this.gallery.setEnabled(enabled && this.preferences.siteArtwork);}
    this.render();this.broadcast();
  }
  private static siteAttributes = ['header','artwork','queue','transport','background','wide'] as const;
  private clearPreferences() {
    const html=document.documentElement;
    for(const part of SiteTheme.siteAttributes) html.removeAttribute(`data-sky-site-${part}`);
    for(const name of ['--sky-site-accent','--sky-site-radius','--sky-site-radius-lg','--sky-site-background-opacity']) html.style.removeProperty(name);
  }
  private applyPreferences() {
    if(!this.enabled)return;
    const html=document.documentElement,p=this.preferences;
    for(const [part,enabled] of Object.entries({header:p.siteHeader,artwork:p.siteArtwork,queue:p.siteQueue,transport:p.siteTransport,background:p.siteBackground,wide:p.siteWide})) {
      html.toggleAttribute(`data-sky-site-${part}`,enabled);
    }
    const radii={subtle:['5px','9px'],soft:['12px','16px'],round:['20px','26px']}[p.siteCorners];
    html.style.setProperty('--sky-site-radius',radii[0]);
    html.style.setProperty('--sky-site-radius-lg',radii[1]);
    html.style.setProperty('--sky-site-background-opacity',String(p.siteBackdropOpacity));
    this.applyAccent();
  }
  private applyAppearance(){
    document.documentElement.dataset.soundskyAppearance=this.parentAppearance??this.resolvedAppearance;
  }
  setPreferences(settings:SoundSkySettings) {
    this.preferences={...defaultSettings,...settings};
    this.applyAppearance();
    this.cover.setEnabled(this.enabled && settings.siteArtwork);
    this.gallery?.setEnabled(this.enabled && settings.siteArtwork);
    this.applyPreferences();this.render();this.broadcast();
  }
  private applyAccent(){
    if(!this.enabled)return;
    const option=this.preferences.siteAccent;
    document.documentElement.style.setProperty('--sky-site-accent',
      document.documentElement.dataset.soundskyAppearance==='light'?(option==='warm'?'#936037':`hsl(${option==='sky'?200:this.hue} 38% 28%)`):option==='sky'?'#97d7ec':option==='warm'?'#f2b585':accentColor(this.hue));
  }
  setAccent(hue:number){this.hue=hue;this.applyAccent();this.broadcast();}
  setPalette(colors:string[]){this.colors=[...colors];this.render();this.broadcast();}
  setPlayerOpen(open:boolean){this.open=open;this.cover.setOpen(open);this.render();this.broadcast();}
  setCoverState(state:CoverPlayback){this.coverState=state;this.cover.setState(state);this.broadcast();}
  setCoverAudio(level:number,onset:number){
    this.cover.setAudio(level,onset);
    if(this.top&&this.enabled&&!this.open)for(const frame of this.frames){
      if(this.sameOriginFrame(frame))frame.contentWindow?.postMessage({type:'soundsky:cover-audio',level,onset},location.origin);else this.frames.delete(frame);
    }
  }
  private render(){
    if(!this.enabled||!this.decorative)return;
    const visible=this.preferences.siteBackground&&this.preferences.siteBackdropOpacity>0;
    this.surface.hidden=this.open||!visible;
    if(!visible) { if(this.root){unmountShader(this.root,this.surface);this.root=null;} return; }
    if(!this.root&&typeof WebGL2RenderingContext!=='undefined')this.root=createShaderRoot(this.surface);
    const moving=this.inView&&!this.open&&!document.hidden&&!this.motion.matches;
    this.root?.render(createElement(MeshGradient,{width:'100%',height:'100%',colors:this.colors,speed:moving?.22:0,distortion:.65,swirl:.25,grainMixer:.02,grainOverlay:.018,scale:1.25,minPixelRatio:1,maxPixelCount:60000,frame:18000}));
  }
  destroy(){this.cover.destroy();this.gallery?.destroy();this.observer?.disconnect();this.events.abort();this.nativeAppearance?.destroy();this.paletteStyle.remove();document.documentElement.removeAttribute('data-soundsky-appearance');this.setEnabled(false);unmountShader(this.root,this.surface);this.root=null;this.surface.remove();this.style.remove();}
}
