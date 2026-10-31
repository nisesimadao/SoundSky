import { tabStops } from './focus';
import { NativeAppearance, type Appearance } from './native-appearance';
import appearanceCSS from './appearance.css';

/** An isolated native page keeps SoundCloud's own form CSS and save handlers intact. */
export class AccountSettings {
  private frame: HTMLIFrameElement | null = null;
  private events = new AbortController();
  private documentEvents: AbortController | null = null;
  private nativeAppearance: NativeAppearance | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private status = document.createElement('p');
  private recovery = document.createElement('div');
  private theme: Appearance = 'dark';
  constructor(private mount: HTMLElement, private onThemeChange?: (theme: Appearance)=>void, private onClose?: ()=>void, private onTabBoundary?: (direction:1|-1)=>void) {
    this.status.className='account-settings-status';this.status.setAttribute('role','status');
    this.recovery.className='account-settings-recovery';
    const retry=document.createElement('button');retry.type='button';retry.textContent='もう一度読み込む';
    retry.addEventListener('click',()=>this.load(),{signal:this.events.signal});
    const external=document.createElement('a');external.href='/settings';external.target='_blank';external.rel='noopener';external.textContent='新しいタブで開く';
    this.recovery.append(retry,external);
  }
  setTheme(theme: Appearance) {
    this.theme=theme;
    try{if(this.frame?.contentDocument?.documentElement)this.frame.contentDocument.documentElement.dataset.soundskyAppearance=theme;}catch{/* authentication may leave this origin */}
  }
  open() {
    if(this.frame)return;
    const frame=document.createElement('iframe');frame.title='SoundCloudの設定';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups');
    frame.addEventListener('error',()=>{this.clearTimer();this.showState('error');},{signal:this.events.signal});
    frame.addEventListener('load',()=>{
      this.clearTimer();this.nativeAppearance?.destroy();this.documentEvents?.abort();
      try{
        const doc=frame.contentDocument;
        if(doc?.head){
          doc.documentElement.dataset.soundskyAppearance=this.theme;
          let initial=true;
          this.nativeAppearance=new NativeAppearance(theme=>{doc.documentElement.dataset.soundskyAppearance=theme;if(!initial)this.onThemeChange?.(theme);initial=false;},doc);
          const win=doc.defaultView!;const events=new win.AbortController();this.documentEvents=events;
          doc.addEventListener('keydown',event=>{
            if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();this.onClose?.();}
            if(event.key==='Tab'&&!event.defaultPrevented&&this.onTabBoundary){
              const focusable=tabStops(doc);
              const index=focusable.indexOf(doc.activeElement as HTMLElement);
              if(!focusable.length||(event.shiftKey?index===0:index===focusable.length-1)){
                event.preventDefault();event.stopPropagation();this.onTabBoundary(event.shiftKey?-1:1);
              }
            }
          },{signal:events.signal});
          const style=doc.createElement('style');style.dataset.soundskyAccountFrame='';
          style.textContent=appearanceCSS+`
            .header,.playControls,.l-footer,header[role=banner],body>footer{display:none!important}
            html,body,.l-container,.l-content,.l-main,.settingsMain,.settingsMain__wrapper{min-width:0!important;max-width:100%!important;width:auto!important;box-sizing:border-box}
            body{margin:0!important}.l-container,.l-content,.l-main,.settingsMain{padding:12px!important}
            .settingsMain__tabs{display:flex;flex-wrap:wrap;gap:8px 16px}.g-tabs-item{margin:0!important}
            .settingsMain__tabContent{overflow-x:auto}input,select,textarea{max-width:100%;box-sizing:border-box}
          `;doc.querySelector('[data-soundsky-account-frame]')?.remove();doc.head.append(style);
        }
      }catch{/* Keep native authentication screens usable. */}
      this.showState('ready');
    },{signal:this.events.signal});
    this.frame=frame;this.load();this.mount.append(this.status,this.recovery,frame);
  }
  private load(){
    if(!this.frame)return;
    this.clearTimer();this.nativeAppearance?.destroy();this.documentEvents?.abort();
    this.showState('loading');this.loadingTimer=setTimeout(()=>{this.loadingTimer=null;this.showState('slow');},15000);
    this.frame.src='/settings';
  }
  private showState(state:'loading'|'slow'|'error'|'ready'){
    this.mount.dataset.loadState=state;this.mount.setAttribute('aria-busy',String(state==='loading'));
    this.status.hidden=state==='ready';this.recovery.hidden=state==='loading'||state==='ready';
    this.status.textContent=state==='loading'?'SoundCloudの設定を読み込み中…':state==='slow'?'読み込みに時間がかかっています。待つか、もう一度読み込んでください。':state==='error'?'SoundCloudの設定を読み込めませんでした。':'';
  }
  private clearTimer(){if(this.loadingTimer!==null)clearTimeout(this.loadingTimer);this.loadingTimer=null;}
  destroy(){this.clearTimer();this.nativeAppearance?.destroy();this.documentEvents?.abort();this.events.abort();this.frame?.remove();this.frame=null;this.status.remove();this.recovery.remove();this.mount.removeAttribute('aria-busy');delete this.mount.dataset.loadState;}
}
