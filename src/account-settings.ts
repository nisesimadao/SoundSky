import { NativeAppearance, type Appearance } from './native-appearance';
import appearanceCSS from './appearance.css';

/** An isolated native page keeps SoundCloud's own form CSS and save handlers intact. */
export class AccountSettings {
  private frame: HTMLIFrameElement | null = null;
  private events = new AbortController();
  private nativeAppearance: NativeAppearance | null = null;
  private theme: 'light'|'dark' = 'dark';
  constructor(private mount: HTMLElement, private onThemeChange?: (theme: Appearance)=>void) {}
  setTheme(theme: 'light'|'dark') {
    this.theme=theme;
    try{if(this.frame?.contentDocument?.documentElement)this.frame.contentDocument.documentElement.dataset.soundskyAppearance=theme;}catch{/* authentication may leave this origin */}
  }
  open() {
    if(this.frame)return;
    const frame=document.createElement('iframe');frame.title='SoundCloudの設定';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups');
    frame.addEventListener('load',()=>{
      try{
        const doc=frame.contentDocument;if(!doc?.head)return;
        doc.documentElement.dataset.soundskyAppearance=this.theme;
        this.nativeAppearance?.destroy();let initial=true;
        this.nativeAppearance=new NativeAppearance(theme=>{doc.documentElement.dataset.soundskyAppearance=theme;if(!initial)this.onThemeChange?.(theme);initial=false;},doc);
        const style=doc.createElement('style');style.dataset.soundskyAccountFrame='';
        style.textContent=appearanceCSS+`
          .header,.playControls,.l-footer,header[role=banner],body>footer{display:none!important}
          html,body,.l-container,.l-content,.l-main,.settingsMain,.settingsMain__wrapper{min-width:0!important;max-width:100%!important;width:auto!important;box-sizing:border-box}
          body{margin:0!important}.l-container,.l-content,.l-main,.settingsMain{padding:12px!important}
          .settingsMain__tabs{display:flex;flex-wrap:wrap;gap:8px 16px}.g-tabs-item{margin:0!important}
          .settingsMain__tabContent{overflow-x:auto}input,select,textarea{max-width:100%;box-sizing:border-box}
        `;doc.head.append(style);
      }catch{/* Keep native authentication screens usable. */}
    },{signal:this.events.signal});
    frame.src='/settings';this.mount.append(frame);this.frame=frame;
  }
  destroy(){this.nativeAppearance?.destroy();this.events.abort();this.frame?.remove();this.frame=null;}
}
