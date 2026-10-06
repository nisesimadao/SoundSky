import type { SoundCloudAdapter } from './adapter';
import nativeCSS from './native.css';

/** Restyles the live native queue in place, retaining its virtual list and event owners. */
export class NativeQueue {
  private style: HTMLStyleElement;
  private queue: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private originalVisible = false;
  private originalScroll = 0;
  private observer = new ResizeObserver(() => this.position());
  private currentKey = '';
  private pendingAlign = false;
  private active = false;
  private accent = 'hsl(210 55% 72%)';
  private alignTimer: ReturnType<typeof setTimeout> | null = null;
  private mutation = new MutationObserver(() => this.update());
  onUpdate: ((info: { available: boolean; hasTracks: boolean; autoplay: boolean | null; upcoming: number; history: boolean }) => void) | null = null;

  constructor(private adapter: SoundCloudAdapter, private aperture: HTMLElement) {
    this.style = document.createElement('style');
    this.style.dataset.soundskyNativeStyle = '';
    this.style.textContent = nativeCSS;
    document.head.append(this.style);
    this.observer.observe(aperture);
  }
  setAccent(color: string) { this.accent = color; this.queue?.style.setProperty('--sky-accent', color); }
  open() { this.active = true; this.bind(); }
  bind() {
    if (!this.active) return;
    const queue = this.adapter.query<HTMLElement>('.queue');
    if (queue === this.queue && this.root?.isConnected) { this.update(); return; }
    this.release();
    this.queue = queue;
    this.root = this.adapter.root;
    if (!queue || !this.root) { this.onUpdate?.({ available: false, hasTracks: false, autoplay: null, upcoming: 0, history: false }); return; }
    this.originalVisible = queue.classList.contains('m-visible');
    this.originalScroll = queue.querySelector('.queue__scrollableInner')?.scrollTop || 0;
    this.root.setAttribute('data-soundsky-player', '');
    queue.setAttribute('data-soundsky-queue', '');
    queue.style.setProperty('--sky-accent', this.accent);
    this.position();
    if (!this.originalVisible) this.adapter.query<HTMLElement>('.playbackSoundBadge__showQueue')?.click();
    this.mutation.observe(queue, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'href'] });
    this.pendingAlign = true;
    this.currentKey = '';
    this.update();
  }
  private position() {
    if (!this.active || !this.queue) return;
    const rect = this.aperture.getBoundingClientRect();
    const properties: Record<string, string> = {
      '--sky-queue-left': `${Math.round(rect.left)}px`, '--sky-queue-top': `${Math.round(rect.top)}px`,
      '--sky-queue-width': `${Math.round(rect.width)}px`, '--sky-queue-height': `${Math.round(rect.height)}px`,
    };
    for (const [key, value] of Object.entries(properties)) {
      if (this.queue.style.getPropertyValue(key) !== value) this.queue.style.setProperty(key, value);
    }
  }
  private update() {
    if (!this.active || !this.queue) return;
    const track = this.adapter.readTrack();
    if (this.currentKey !== track.key) { this.currentKey = track.key; this.pendingAlign = true; }
    const current = this.queue.querySelector<HTMLElement>('.queueItemView.m-active');
    const scroll = this.queue.querySelector<HTMLElement>('.queue__scrollableInner');
    if (current && scroll && this.pendingAlign) {
      this.pendingAlign = false;
      if (this.alignTimer) clearTimeout(this.alignTimer);
      this.alignTimer = setTimeout(() => {
        this.alignTimer = null;
        if (!this.active || !current.isConnected || this.currentKey !== track.key) return;
        scroll.scrollTop += current.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
        scroll.dispatchEvent(new Event('scroll'));
      }, 100);
    }
    const toggle = this.queue.querySelector<HTMLInputElement>('.queueFallback input[type="checkbox"]');
    const items = [...this.queue.querySelectorAll<HTMLElement>('.queueItemView')];
    const currentY = current?.getBoundingClientRect().top;
    // Position, not DOM order, is authoritative in SoundCloud's recycled virtual list.
    let upcoming = 0;
    for (const item of items) {
      const y = item.getBoundingClientRect().top;
      const before = currentY !== undefined && y < currentY - 1;
      const after = currentY !== undefined && y > currentY + 1;
      const status = item === current ? 'current' : before || item.classList.contains('m-dimmed') ? 'history' : after ? 'next' : '';
      if (item.getAttribute('data-sky-status') !== status) item.setAttribute('data-sky-status', status);
      if (status === 'next') upcoming++;
    }
    this.onUpdate?.({ available: true, hasTracks: items.length > 0, autoplay: toggle ? toggle.checked : null, upcoming,
      history: !!scroll && !!current && current.getBoundingClientRect().top > scroll.getBoundingClientRect().top + 56 });
  }
  focusables(): HTMLElement[] {
    if (!this.queue) return [];
    const bounds = this.aperture.getBoundingClientRect();
    return [...this.queue.querySelectorAll<HTMLElement>('a[href],button,input,[tabindex="0"]')]
      .filter(el => { const rect = el.getBoundingClientRect(); return !el.hasAttribute('disabled') && rect.width > 0
        && rect.top >= bounds.top && rect.bottom <= bounds.bottom && getComputedStyle(el).visibility !== 'hidden'; });
  }
  private release() {
    this.mutation.disconnect();
    if (this.alignTimer) clearTimeout(this.alignTimer);
    this.alignTimer = null;
    if (this.queue?.isConnected) {
      const scroll = this.queue.querySelector<HTMLElement>('.queue__scrollableInner');
      if (scroll) scroll.scrollTop = this.originalScroll;
      if (!this.originalVisible && this.queue.classList.contains('m-visible')) this.queue.querySelector<HTMLElement>('.queue__hide')?.click();
      this.queue.removeAttribute('data-soundsky-queue');
      this.queue.style.removeProperty('--sky-accent');
      for (const property of ['left', 'top', 'width', 'height']) this.queue.style.removeProperty(`--sky-queue-${property}`);
      this.queue.querySelectorAll('[data-sky-status]').forEach(el => el.removeAttribute('data-sky-status'));
    }
    this.root?.removeAttribute('data-soundsky-player');
    this.queue = null; this.root = null;
  }
  close() { this.active = false; this.release(); }
  destroy() { this.close(); this.observer.disconnect(); this.style.remove(); this.onUpdate = null; }
}
