import { canonical } from './adapter';
import { CoverPulse } from './cover-pulse';

export interface CoverPlayback {
  trackKey: string; contextKey: string; playing: boolean; muted: boolean; maximum: number; sensitivity: number;
}
/** React to the native player only when this page is its track or playlist context. */
export class NativeCover {
  private enabled = false;
  private open = false;
  private state: CoverPlayback | null = null;
  private target: HTMLElement | null = null;
  private original = new Map<string, [string, string]>();
  private pulse = new CoverPulse();
  private scale = 1;
  private at = 0;
  private frame = 0;
  private observer = new MutationObserver(() => this.bind());
  private events = new AbortController();
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private doc: Document = document) {
    const signal = this.events.signal;
    this.motion.addEventListener('change', () => { this.pulse.reset(); this.bind(); }, { signal });
    doc.addEventListener('visibilitychange', () => { this.pulse.reset(); this.bind(); }, { signal });
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.observer.observe(this.doc.body, { subtree: true, childList: true });
    else { this.observer.disconnect(); this.pulse.reset(); }
    this.bind();
  }
  setOpen(open: boolean) { this.open = open; this.bind(); }
  setState(state: CoverPlayback) {
    const changed = state.trackKey !== this.state?.trackKey || state.contextKey !== this.state?.contextKey;
    if (changed || !state.playing || state.muted) this.pulse.reset();
    this.state = state; this.bind();
  }
  setAudio(level: number, onset: number) {
    if (this.state?.playing && !this.state.muted && this.enabled && !this.open) {
      this.pulse.sample(onset, performance.now(), level); this.start();
    }
  }
  private bind() {
    const path = canonical(this.doc.location.href)?.replace(/^\/n\//, '/');
    const matches = this.state?.trackKey && (path === this.state.trackKey || path === this.state.contextKey);
    const allowed = this.enabled && !this.open && !this.doc.hidden && !this.motion.matches && matches;
    const hero = allowed ? this.doc.querySelector('.fullHero, [aria-label="Track header"], [aria-label="Playlist header"]') : null;
    const image = hero?.querySelector<HTMLElement>('img[src*="sndcdn.com/artworks-"]');
    const imageFrame = image?.parentElement !== hero && image?.parentElement?.children.length === 1 ? image.parentElement : image;
    const target = hero?.querySelector<HTMLElement>('.fullHero__artwork') || imageFrame || null;
    if (target !== this.target) {
      this.restore(); this.target = target;
      if (target) {
        for (const key of ['scale', 'border-radius', 'transform-origin']) this.original.set(key, [target.style.getPropertyValue(key), target.style.getPropertyPriority(key)]);
        target.style.setProperty('transform-origin', 'center', 'important');
      }
    }
    if (this.target && (this.state?.playing && !this.state.muted || Math.abs(this.scale - 1) > .0001)) this.start();
  }
  private start() { if (this.target && !this.frame) this.frame = requestAnimationFrame(this.tick); }
  private tick = (now: number) => {
    this.frame = 0;
    if (!this.target?.isConnected || !this.state) { this.bind(); return; }
    const target = 1 + (this.state.playing && !this.state.muted ? this.pulse.expansion(now, this.state.maximum, this.state.sensitivity) : 0);
    const dt = this.at ? Math.min(100, now - this.at) : 16; this.at = now;
    this.scale += (target - this.scale) * (1 - Math.exp(-dt / (target > this.scale ? 20 : 45)));
    this.target.style.setProperty('scale', String(this.scale), 'important');
    this.target.style.setProperty('border-radius', `${6 + this.target.clientWidth * Math.max(0, this.scale - 1) * .3}px`, 'important');
    if (this.state.playing && !this.state.muted || Math.abs(this.scale - 1) > .0001) this.start();
    else { this.target.style.setProperty('scale', '1', 'important'); this.at = 0; }
  };
  private restore() {
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    if (this.target) for (const [key, [value, priority]] of this.original) {
      if (value) this.target.style.setProperty(key, value, priority); else this.target.style.removeProperty(key);
    }
    this.original.clear(); this.target = null; this.scale = 1; this.at = 0;
  }
  destroy() { this.observer.disconnect(); this.events.abort(); this.restore(); }
}
