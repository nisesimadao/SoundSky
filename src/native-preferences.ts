import css from './native-preferences.css';
/** The native settings view shares values and handlers, never SoundSky's panel DOM. */
export class NativePreferences {
  private style = document.createElement('style');
  private outputs = new Map<HTMLOutputElement, HTMLInputElement | HTMLSelectElement>();
  private resets = new Map<HTMLButtonElement, HTMLInputElement | HTMLSelectElement>();
  private saveLabel = '自動保存';
  private retryAvailable=false;
  private retry:HTMLButtonElement|null=null;
  private hints = new Map<HTMLElement,HTMLElement>();
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
    if (!show) {this.restore();this.view?.remove();this.view=null;this.retry=null;this.controls.clear();this.outputs.clear();this.resets.clear();this.hints.clear();return;}
    if (!this.view?.isConnected) {
      this.restore();
      for (const child of wrapper.children) if (child instanceof HTMLElement && child !== tabs && child.tagName !== 'SOUNDSKY-PLAYER') {this.hidden.set(child,child.hidden);child.hidden=true;}
      for (const link of tabs.querySelectorAll<HTMLElement>('.g-tabs-link')) {this.selected.set(link,link.classList.contains('active'));link.classList.toggle('active',this.entry.contains(link));}
      this.view=document.createElement('div');this.view.className='settingsMain__tabContent sc-mt-5x';this.view.dataset.soundskyNativePreferences='';
      this.view.addEventListener('keydown',event=>{if(event.code==='Space')event.stopPropagation();});
      for (const panel of this.source.querySelectorAll<HTMLElement>('.settings-section')) {
        if (panel.id === 'settings-account' || !panel.querySelector('h3')) continue;
        const section=document.createElement('div');section.className='g-form-section';
        const head=document.createElement('div');head.className='g-form-section-head g-flex-row-spread sc-mb-2x';
        const title=document.createElement('h3');title.className='g-form-section-title';title.textContent=panel.querySelector('h3')?.textContent??'';head.append(title);
        const saved=document.createElement('span');saved.className='sc-text-captions sc-text-secondary';saved.dataset.soundskySaveStatus='';saved.textContent=this.saveLabel;head.append(saved);section.append(head);
        const rows=document.createElement('div');rows.className='g-options-row g-flex-column';section.append(rows);
        const appendControls=(group:HTMLElement,rows:HTMLElement)=>{
        for (const control of group.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')) {
          if(!group.matches('details')&&control.closest('details'))continue;
          const row=document.createElement('div');row.className='g-options-cell sc-pr-2x';
          const label=document.createElement('label');label.htmlFor=`native-${control.id}`;label.textContent=this.source.querySelector(`label[for="${control.id}"]`)?.textContent??'';
          const input=control.cloneNode(true) as HTMLInputElement | HTMLSelectElement;input.id=label.htmlFor;input.className=control.type==='range'?'soundsky-native-range':control.type==='checkbox'?'':'sc-input';input.removeAttribute('style');input.removeAttribute('aria-describedby');
          input.addEventListener(control.type==='range'?'input':'change',()=>{control.value=input.value;if(control instanceof HTMLInputElement&&input instanceof HTMLInputElement)control.checked=input.checked;control.dispatchEvent(new Event(control.type==='range'?'input':'change',{bubbles:true}));this.update();});
          this.controls.set(input,control);
          const content=document.createElement('div');content.className='toggleRow g-flex-row-spread sc-mb-2x';
          const text=document.createElement('div');text.className='toggleRow__text sc-mr-3x';
          const labelRow=document.createElement('p');labelRow.className='sc-text-body';labelRow.append(label);text.append(labelRow);
          const controls=document.createElement('div');controls.className=control.type==='checkbox'?'toggleRow__toggle':'soundsky-native-field';
          if(control.type==='checkbox'){
            const toggle=document.createElement('label');toggle.className='toggle sc-toggle toggleFormControl__toggle sc-toggle-active';
            const handle=document.createElement('span');handle.className='sc-toggle-handle';
            input.className='sc-toggle-input sc-visuallyhidden';toggle.append(handle,input);controls.append(toggle);
          }else controls.append(input);
          if(control.type==='range'){const output=document.createElement('output');output.htmlFor.value=input.id;controls.append(output);this.outputs.set(output,control);}
          content.append(text,controls);row.append(content);
          const hint=control.getAttribute('aria-describedby');const help=hint?this.source.querySelector<HTMLElement>(`#${hint}`)?.textContent:null;
          if(help){const description=document.createElement('p');description.className='sc-text-secondary';description.textContent=help;description.id=`hint-${input.id}`;input.setAttribute('aria-describedby',description.id);text.append(description);}
          const reset=control.closest('.settings-group')?.querySelector<HTMLButtonElement>('[data-command="setting-default"]');
          if(reset){const button=document.createElement('button');button.type='button';button.className='sc-button sc-button-small';button.textContent='標準';button.setAttribute('aria-label',`${label.textContent}を標準に戻す`);button.addEventListener('click',()=>{reset.click();this.update();});controls.append(button);this.resets.set(button,control);}
          rows.append(row);
        }
        };appendControls(panel,rows);
        for(const detail of panel.querySelectorAll('details')){
          const disclosure=document.createElement('details');disclosure.className='soundsky-native-details';
          const summary=document.createElement('summary');summary.className='sc-text-body';summary.textContent=detail.querySelector('summary')?.textContent??'';disclosure.append(summary);
          const fields=document.createElement('div');fields.className='g-options-row g-flex-column';disclosure.append(fields);appendControls(detail,fields);
          const status=detail.querySelector<HTMLElement>('#prefetch-status');if(status){const hint=document.createElement('p');hint.className='sc-text-secondary';hint.setAttribute('role','status');fields.append(hint);this.hints.set(hint,status);}
          section.append(disclosure);
        }
        this.view.append(section);
      }
      const retrySource=this.source.querySelector<HTMLButtonElement>('[data-command="settings-retry"]');
      if(retrySource){
        this.retry=document.createElement('button');this.retry.type='button';this.retry.className='sc-button sc-button-medium';this.retry.textContent=retrySource.textContent;this.retry.dataset.soundskySaveRetry='';
        this.retry.addEventListener('click',()=>retrySource.click());this.view.append(this.retry);
      }
      wrapper.append(this.view);
    }
    this.update();
  }
  setSaveLabel(label:string,retryAvailable=false){this.saveLabel=label;this.retryAvailable=retryAvailable;this.view?.querySelectorAll<HTMLElement>('[data-soundsky-save-status]').forEach(el=>{if(el.textContent!==label)el.textContent=label;});this.updateRetry();}
  private updateRetry(){const hidden=!this.retryAvailable;if(this.retry&&this.retry.hidden!==hidden)this.retry.hidden=hidden;}
  update(){
    this.updateRetry();
    for(const [hint,source]of this.hints){if(hint.textContent!==source.textContent)hint.textContent=source.textContent;hint.hidden=source.hidden;}
    for(const [input,source]of this.controls){
      input.value=source.value;input.disabled=source.disabled;
      const spoken=source.getAttribute('aria-valuetext');if(spoken!==null&&input.getAttribute('aria-valuetext')!==spoken)input.setAttribute('aria-valuetext',spoken);
      if(input instanceof HTMLInputElement&&source instanceof HTMLInputElement){
        input.checked=source.checked;
        input.closest('.sc-toggle')?.classList.toggle('sc-toggle-on',source.checked);
        input.closest('.sc-toggle')?.classList.toggle('sc-toggle-disabled',source.disabled);
      }
      if(input.type==='range'){const range=input as HTMLInputElement;const ratio=(Number(range.value)-Number(range.min))/(Number(range.max)-Number(range.min));range.style.setProperty('--progress',`${Math.max(0,Math.min(1,ratio))*100}%`);}
    }
    for(const [output,source]of this.outputs){const value=source.closest('.settings-group')?.querySelector('.settings-val')?.textContent??source.value;if(output.value!==value)output.value=value;}
    for(const [button,source]of this.resets)button.disabled=source.disabled;
  }
  private restore(){for(const [node,hidden]of this.hidden)node.hidden=hidden;this.hidden.clear();for(const [node,active]of this.selected)node.classList.toggle('active',active);this.selected.clear();}
  private clear(){this.restore();this.entry?.remove();this.entry=null;this.view?.remove();this.view=null;this.retry=null;this.controls.clear();this.outputs.clear();this.resets.clear();this.hints.clear();}
  destroy(){this.clear();this.style.remove();document.querySelector('[data-soundsky-settings-tabs]:empty')?.remove();}
}
