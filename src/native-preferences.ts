import css from './native-preferences.css';
/** The native settings view shares values and handlers, never SoundSky's panel DOM. */
export class NativePreferences {
  private style = document.createElement('style');
  private outputs = new Map<HTMLOutputElement, HTMLInputElement | HTMLSelectElement>();
  private resets = new Map<HTMLButtonElement, HTMLInputElement | HTMLSelectElement>();
  private entry: HTMLElement | null = null;
  private view: HTMLElement | null = null;
  private hidden = new Map<HTMLElement, boolean>();
  private selected = new Map<HTMLElement, boolean>();
  private controls = new Map<HTMLInputElement | HTMLSelectElement, HTMLInputElement | HTMLSelectElement>();
  constructor(private source: HTMLElement) {this.style.dataset.soundskyNativePreferencesStyle='';this.style.textContent=css;document.head.append(this.style);}
  sync() {
    const onSettings = /^\/settings(?:\/|$)/.test(location.pathname);
    const wrapper = onSettings ? document.querySelector<HTMLElement>('.settingsMain__wrapper, main') : null;
    if (!wrapper) { this.clear(); return; }
    let tabs = wrapper.querySelector<HTMLElement>('.settingsMain__tabs');
    if (!tabs) {
      tabs = wrapper.querySelector('[data-soundsky-settings-tabs]');
      if (!tabs) { tabs = document.createElement('ul'); tabs.className='settingsMain__tabs g-tabs g-tabs-large';tabs.dataset.soundskySettingsTabs='';wrapper.prepend(tabs); }
    }
    if (!this.entry?.isConnected || !tabs.contains(this.entry)) {
      this.clear();
      this.entry=document.createElement('li');this.entry.className='g-tabs-item';this.entry.dataset.soundskySettingsEntry='';
      const link=document.createElement('a');link.className='g-tabs-link';link.href='/settings#soundsky';link.textContent='SoundSky';
      link.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();history.pushState({},'', '/settings#soundsky');this.sync();});
      this.entry.append(link);tabs.append(this.entry);
    }
    const show=location.hash==='#soundsky';
    if (!show) {this.restore();this.view?.remove();this.view=null;this.controls.clear();this.outputs.clear();this.resets.clear();return;}
    if (!this.view?.isConnected) {
      this.restore();
      for (const child of wrapper.children) if (child instanceof HTMLElement && child !== tabs && child.tagName !== 'SOUNDSKY-PLAYER') {this.hidden.set(child,child.hidden);child.hidden=true;}
      for (const link of tabs.querySelectorAll<HTMLElement>('.g-tabs-link')) {this.selected.set(link,link.classList.contains('active'));link.classList.toggle('active',this.entry.contains(link));}
      this.view=document.createElement('div');this.view.className='settingsMain__tabContent sc-mt-5x';this.view.dataset.soundskyNativePreferences='';
      for (const panel of this.source.querySelectorAll<HTMLElement>('.settings-section')) {
        if (panel.id === 'settings-account' || !panel.querySelector('h3')) continue;
        const section=document.createElement('section');section.className='g-form-section';
        const head=document.createElement('div');head.className='g-form-section-head sc-mb-2x';
        const title=document.createElement('h3');title.textContent=panel.querySelector('h3')?.textContent??'';head.append(title);section.append(head);
        for (const control of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')) {
          const row=document.createElement('div');row.className='soundsky-native-row';
          const label=document.createElement('label');label.htmlFor=`native-${control.id}`;label.textContent=this.source.querySelector(`label[for="${control.id}"]`)?.textContent??'';
          const input=control.cloneNode(true) as HTMLInputElement | HTMLSelectElement;input.id=label.htmlFor;input.className=control.type==='range'?'soundsky-native-range':control.type==='checkbox'?'':'sc-input';input.removeAttribute('style');input.removeAttribute('aria-describedby');
          input.addEventListener(control.type==='range'?'input':'change',()=>{control.value=input.value;if(control instanceof HTMLInputElement&&input instanceof HTMLInputElement)control.checked=input.checked;control.dispatchEvent(new Event(control.type==='range'?'input':'change',{bubbles:true}));this.update();});
          this.controls.set(input,control);
          const labelRow=document.createElement('div');labelRow.className='soundsky-native-label';labelRow.append(label);
          const controls=document.createElement('div');controls.className='soundsky-native-control';controls.append(input);
          if(control.type==='range'){const output=document.createElement('output');output.htmlFor.value=input.id;labelRow.append(output);this.outputs.set(output,control);}
          row.append(labelRow,controls);
          const hint=control.getAttribute('aria-describedby');const text=hint?this.source.querySelector<HTMLElement>(`#${hint}`)?.textContent:null;
          if(text){const description=document.createElement('p');description.className='soundsky-native-hint sc-type-light';description.textContent=text;row.append(description);}
          const reset=control.closest('.settings-group')?.querySelector<HTMLButtonElement>('[data-command="setting-default"]');
          if(reset){const button=document.createElement('button');button.type='button';button.className='sc-button sc-button-small';button.textContent='標準に戻す';button.addEventListener('click',()=>{reset.click();this.update();});controls.append(button);this.resets.set(button,control);}
          section.append(row);
        }
        this.view.append(section);
      }
      wrapper.append(this.view);
    }
    this.update();
  }
  update(){
    for(const [input,source]of this.controls){
      input.value=source.value;input.disabled=source.disabled;
      if(input instanceof HTMLInputElement&&source instanceof HTMLInputElement)input.checked=source.checked;
      if(input.type==='range'){const range=input as HTMLInputElement;const ratio=(Number(range.value)-Number(range.min))/(Number(range.max)-Number(range.min));range.style.setProperty('--progress',`${Math.max(0,Math.min(1,ratio))*100}%`);}
    }
    for(const [output,source]of this.outputs)output.value=source.closest('.settings-group')?.querySelector('.settings-val')?.textContent??source.value;
    for(const [button,source]of this.resets)button.disabled=source.disabled;
  }
  private restore(){for(const [node,hidden]of this.hidden)node.hidden=hidden;this.hidden.clear();for(const [node,active]of this.selected)node.classList.toggle('active',active);this.selected.clear();}
  private clear(){this.restore();this.entry?.remove();this.entry=null;this.view?.remove();this.view=null;this.controls.clear();this.outputs.clear();this.resets.clear();}
  destroy(){this.clear();this.style.remove();document.querySelector('[data-soundsky-settings-tabs]:empty')?.remove();}
}
