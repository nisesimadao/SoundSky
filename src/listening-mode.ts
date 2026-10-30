/** Hide only the transport chrome while a pointer user is listening. Keyboard,
 * touch, paused playback and settings keep the controls discoverable. */
export class ListeningMode {
  private events = new AbortController();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private available = false;
  private enabled = false;
  private pointer = matchMedia('(hover: hover) and (pointer: fine)');
  constructor(private player: HTMLElement) {
    const signal=this.events.signal;
    for(const name of ['pointermove','pointerdown','keydown','focusin','focusout'])player.addEventListener(name,this.reveal,{signal});
    document.addEventListener('visibilitychange',this.reveal,{signal});
    this.pointer.addEventListener('change',this.reveal,{signal});
  }
  sync(enabled: boolean, active: boolean, playing: boolean, blocked: boolean) {
    const available=enabled&&active&&playing&&!blocked;
    if(this.enabled===enabled&&this.available===available)return;
    this.enabled=enabled;this.available=available;
    this.player.toggleAttribute('data-focus-mode',enabled);this.reveal();
  }
  private reveal=()=>{
    if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
    this.player.classList.remove('is-idle');
    if(!this.available||document.hidden||!this.pointer.matches)return;
    this.timer=setTimeout(()=>{
      this.timer=null;
      if(!this.available||document.hidden||this.player.querySelector('.topbar:hover,.controls:hover,.topbar :focus-visible,.controls :focus-visible'))return;
      this.player.classList.add('is-idle');
    },3000);
  };
  destroy(){this.events.abort();if(this.timer!==null)clearTimeout(this.timer);this.player.classList.remove('is-idle');this.player.removeAttribute('data-focus-mode');}
}
