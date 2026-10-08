import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MeshGradient } from '@paper-design/shaders-react';
import { accentColor } from './accent';
import { defaultPalette } from './artwork-palette';
import css from './site-theme.css';
import { SiteGallery } from './site-gallery';

/** Reversible skin: a scoped stylesheet and one decorative, pointer-free canvas. */
export class SiteTheme {
  private style = document.createElement('style');
  private surface = document.createElement('div');
  private root: Root | null = null;
  private enabled = false;
  private open = false;
  private hue = 210;
  private colors = [...defaultPalette];
  private events = new AbortController();
  private inView = true;
  private observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries=>{this.inView=entries[0]?.isIntersecting??false;this.render();});
  private gallery:SiteGallery|null=null;
  private frames = new Set<HTMLIFrameElement>();
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private top = window === window.top,private decorative=true) {
    document.dispatchEvent(new Event('soundsky:theme-dispose'));
    document.addEventListener('soundsky:theme-dispose',()=>this.destroy(),{signal:this.events.signal});
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
        if(typeof data.enabled==='boolean')this.setEnabled(data.enabled);
        if(typeof data.hue==='number'&&Number.isFinite(data.hue))this.setAccent(data.hue);
        if(Array.isArray(data.colors)&&data.colors.length===4&&data.colors.every((c:unknown)=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))this.setPalette(data.colors);
        this.setPlayerOpen(data.open===true);
      }
    },{signal:this.events.signal});
    if(!this.top)window.parent.postMessage({type:'soundsky:theme-ready'},location.origin);
  }
  private packet(){return {type:'soundsky:site-theme',enabled:this.enabled,hue:this.hue,colors:this.colors,open:this.open};}
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
    if(enabled){document.head.append(this.style);if(this.decorative){document.body.prepend(this.surface);this.observer?.observe(this.surface);}else document.documentElement.setAttribute('data-soundsky-embed','');document.documentElement.setAttribute('data-soundsky-theme','');this.applyAccent();}
    else {this.observer?.unobserve(this.surface);document.documentElement.removeAttribute('data-soundsky-theme');document.documentElement.removeAttribute('data-soundsky-embed');document.documentElement.style.removeProperty('--sky-site-accent');this.root?.unmount();this.root=null;this.surface.remove();this.style.remove();}
    if(this.decorative){this.gallery??=new SiteGallery();this.gallery.setEnabled(enabled);}
    this.render();this.broadcast();
  }
  private applyAccent(){if(this.enabled)document.documentElement.style.setProperty('--sky-site-accent',accentColor(this.hue));}
  setAccent(hue:number){this.hue=hue;this.applyAccent();this.broadcast();}
  setPalette(colors:string[]){this.colors=[...colors];this.render();this.broadcast();}
  setPlayerOpen(open:boolean){this.open=open;this.render();this.broadcast();}
  private render(){
    if(!this.enabled||!this.decorative)return;
    this.surface.hidden=this.open;
    if(!this.root&&typeof WebGL2RenderingContext!=='undefined')this.root=createRoot(this.surface);
    const moving=this.inView&&!this.open&&!document.hidden&&!this.motion.matches;
    this.root?.render(createElement(MeshGradient,{width:'100%',height:'100%',colors:this.colors,speed:moving?.22:0,distortion:.65,swirl:.25,grainMixer:.02,grainOverlay:.018,scale:1.25,minPixelRatio:1,maxPixelCount:60000,frame:18000}));
  }
  destroy(){this.gallery?.destroy();this.observer?.disconnect();this.events.abort();this.setEnabled(false);this.root?.unmount();this.root=null;this.surface.remove();this.style.remove();}
}
