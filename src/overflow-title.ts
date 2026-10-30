/** Retain the multi-line title; reveal a slow, readable marquee only on overflow. */
export class OverflowTitle {
  private observer: ResizeObserver;
  private overlay = document.createElement('span');
  private text = document.createElement('span');
  private value = '';
  constructor(private button: HTMLElement, private heading: HTMLElement) {
    this.overlay.className='title-marquee';this.overlay.setAttribute('aria-hidden','true');this.overlay.append(this.text);button.append(this.overlay);
    this.observer=new ResizeObserver(()=>this.measure());this.observer.observe(button);
  }
  sync(value: string){if(value===this.value)return;this.value=value;this.text.textContent=value;this.measure();}
  private measure(){
    if(!this.button.clientWidth)return;
    const style=getComputedStyle(this.heading);this.overlay.style.font=style.font;this.overlay.style.letterSpacing=style.letterSpacing;
    // scrollHeight includes glyph ink outside its line box even for short titles.
    // Compare an unclamped layout instead, so only missing lines start scrolling.
    const probe=this.heading.cloneNode(false) as HTMLElement;probe.textContent=this.value;
    probe.classList.add('title-measure');probe.removeAttribute('id');probe.setAttribute('aria-hidden','true');
    Object.assign(probe.style,{position:'absolute',visibility:'hidden',display:'block',pointerEvents:'none',width:`${this.heading.clientWidth}px`,webkitLineClamp:'unset'});
    this.button.append(probe);const fullHeight=probe.getBoundingClientRect().height;probe.remove();
    const overflow=fullHeight>this.heading.clientHeight+1;
    this.button.toggleAttribute('data-title-overflow',overflow);
    const distance=Math.max(0,this.text.scrollWidth-this.button.clientWidth);
    this.button.style.setProperty('--title-travel',`${-distance}px`);
    this.button.style.setProperty('--title-duration',`${Math.max(10,distance/60+4)}s`);
  }
  destroy(){this.observer.disconnect();this.overlay.remove();this.button.removeAttribute('data-title-overflow');}
}
