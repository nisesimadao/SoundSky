import { canonical } from './adapter';
import { CoverPulse } from './cover-pulse';

export interface CoverPlayback {
  trackKey: string; contextKey: string; playing: boolean; muted: boolean; maximum: number; sensitivity: number;
}
/** Share the audio envelope across matching track/playlist artwork, including list and gallery cards. */
export class NativeCover {
  private enabled = false;
  private open = false;
  private state: CoverPlayback | null = null;
  private targets = new Map<HTMLElement, Map<string, [string, string]>>();
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
    if (enabled) this.observer.observe(this.doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'src'] });
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
    const allowed = this.enabled && !this.open && !this.doc.hidden && !this.motion.matches && this.state?.trackKey;
    const next = new Set<HTMLElement>();
    if (allowed && this.state) {
      const matches = (key: string) => key === this.state!.trackKey || !!this.state!.contextKey && key === this.state!.contextKey;
      if (matches(path)) {
        const hero = this.doc.querySelector('.fullHero, [aria-label="Track header"], [aria-label="Playlist header"]');
        const image = hero?.querySelector<HTMLElement>('img[src*="sndcdn.com/artworks-"]');
        // Modern artwork boxes also contain a loading overlay; scale the box, not its clipped image.
        const target = hero?.querySelector<HTMLElement>('.fullHero__artwork') || (image?.parentElement !== hero ? image?.parentElement : image);
        if (target) next.add(target);
      }
      for (const link of this.doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        if (!matches(canonical(link.href)) || link.closest('.playControls, header, .queue')) continue;
        // Playlist rows place artwork beside the title link, rather than inside it.
        const rowArt = link.closest('.trackItem')?.querySelector<HTMLElement>('.trackItem__image .image, .trackItem__artwork');
        if (rowArt) { next.add(rowArt); continue; }
        const art = link.querySelector<HTMLElement>('img, .image__full, [style*="background-image"]');
        if (!art || art.closest('.sc-avatar, .image__rounded, .userBadge__avatar')) continue;
        const target = link.closest<HTMLElement>('.sound__artwork, .playlist__artwork, .playableTile__artwork, .trackItem__artwork') || link;
        next.add(target);
      }
    }
    for (const target of next) if ([...next].some(parent => parent !== target && parent.contains(target))) next.delete(target);
    // Lazy loading and SPA navigation can add or remove several matching cards at once.
    for (const [target, original] of this.targets) if (!next.has(target)) {
      this.restoreTarget(target, original); this.targets.delete(target);
    }
    for (const target of next) if (!this.targets.has(target)) {
      const original = new Map<string, [string, string]>();
      for (const key of ['scale', 'border-radius', 'transform-origin']) original.set(key, [target.style.getPropertyValue(key), target.style.getPropertyPriority(key)]);
      this.targets.set(target, original);
      target.style.setProperty('transform-origin', 'center', 'important');
    }
    if (!this.targets.size) { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.scale = 1; this.at = 0; }
    else if (this.state?.playing && !this.state.muted || Math.abs(this.scale - 1) > .0001) this.start();
  }
  private start() { if (this.targets.size && !this.frame) this.frame = requestAnimationFrame(this.tick); }
  private tick = (now: number) => {
    this.frame = 0;
    if (!this.state) return;
    if ([...this.targets.keys()].some(target => !target.isConnected)) this.bind();
    if (!this.targets.size) return;
    const target = 1 + (this.state.playing && !this.state.muted ? this.pulse.expansion(now, this.state.maximum, this.state.sensitivity) : 0);
    const dt = this.at ? Math.min(100, now - this.at) : 16; this.at = now;
    this.scale += (target - this.scale) * (1 - Math.exp(-dt / (target > this.scale ? 20 : 45)));
    for (const element of this.targets.keys()) {
      element.style.setProperty('scale', String(this.scale), 'important');
      element.style.setProperty('border-radius', `${6 + element.clientWidth * Math.max(0, this.scale - 1) * .3}px`, 'important');
    }
    if (this.state.playing && !this.state.muted || Math.abs(this.scale - 1) > .0001) this.start();
    else { for (const element of this.targets.keys()) element.style.setProperty('scale', '1', 'important'); this.at = 0; }
  };
  private restoreTarget(target: HTMLElement, original: Map<string, [string, string]>) {
    for (const [key, [value, priority]] of original) {
      if (value) target.style.setProperty(key, value, priority); else target.style.removeProperty(key);
    }
  }
  private restore() {
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    for (const [target, original] of this.targets) this.restoreTarget(target, original);
    this.targets.clear(); this.scale = 1; this.at = 0;
  }
  destroy() { this.observer.disconnect(); this.events.abort(); this.restore(); }
}
