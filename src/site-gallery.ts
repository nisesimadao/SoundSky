/** Use the browser's native horizontal scrolling, with the existing gallery buttons. */
export class SiteGallery {
 private events:AbortController|null=null;
 private observer:MutationObserver|null=null;
 private queued=0;
 private sliders=new Map<HTMLElement,number>();
 private buttons=new Map<HTMLButtonElement,boolean>();
 setEnabled(enabled:boolean){
  if(!enabled){this.events?.abort();this.events=null;this.observer?.disconnect();this.observer=null;if(this.queued)cancelAnimationFrame(this.queued);this.queued=0;for(const [button,disabled]of this.buttons)button.disabled=disabled;this.buttons.clear();for(const [slider,left]of this.sliders)slider.scrollLeft=left;this.sliders.clear();return;}
  if(this.events)return;this.events=new AbortController();const signal=this.events.signal;
  document.addEventListener('click',event=>{
   const button=(event.target as Element)?.closest<HTMLButtonElement>('.tileGallery__sliderButton');
   const slider=button?.closest('.tileGallery')?.querySelector<HTMLElement>('.tileGallery__slider');
   if(!button||!slider)return;event.preventDefault();event.stopImmediatePropagation();
   slider.scrollBy({left:(button.classList.contains('tileGallery__slideBackwardButton')?-1:1)*slider.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  },{signal,capture:true});
  document.addEventListener('wheel',event=>{
   if(event.ctrlKey||event.metaKey||!event.shiftKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
   const slider=(event.target as Element)?.closest('.tileGallery')?.querySelector<HTMLElement>('.tileGallery__slider');
   if(!slider||slider.scrollWidth<=slider.clientWidth)return;
   event.preventDefault();slider.scrollLeft+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?slider.clientWidth:1);
  },{signal,passive:false});
  document.addEventListener('scroll',event=>{if((event.target as Element)?.matches?.('.tileGallery__slider'))this.refresh();},{signal,capture:true,passive:true});
  window.addEventListener('resize',()=>this.refresh(),{signal});
  this.observer=new MutationObserver(()=>{if(!this.queued)this.queued=requestAnimationFrame(()=>{this.queued=0;this.refresh();});});
  this.observer.observe(document.body,{childList:true,subtree:true});this.refresh();
 }
 private refresh(){
  for(const gallery of document.querySelectorAll('.tileGallery')){
   const slider=gallery.querySelector<HTMLElement>('.tileGallery__slider');if(!slider)continue;if(!this.sliders.has(slider))this.sliders.set(slider,slider.scrollLeft);
   for(const direction of ['Backward','Forward']){
    const button=gallery.querySelector<HTMLButtonElement>(`.tileGallery__slide${direction}Button`);if(!button)continue;
    if(!this.buttons.has(button))this.buttons.set(button,button.disabled);
    button.disabled=direction==='Backward'?slider.scrollLeft<=1:slider.scrollLeft+slider.clientWidth>=slider.scrollWidth-1;
   }
  }
  for(const slider of this.sliders.keys())if(!slider.isConnected)this.sliders.delete(slider);
  for(const button of this.buttons.keys())if(!button.isConnected)this.buttons.delete(button);
 }
 destroy(){this.setEnabled(false);}
}
