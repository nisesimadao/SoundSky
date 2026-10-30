import type { Action, ActionState, PlayerState, Track } from './types';

export function canonical(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value, 'https://soundcloud.com');
    if (!/^https:$/.test(url.protocol) || !/^(www\.)?soundcloud\.com$/.test(url.hostname)) return '';
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch { return ''; }
}
export function artworkURL(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)sndcdn\.com$/.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}
export function imageFrom(element: Element | null): string {
  if (!element) return '';
  const image = element.matches('img') ? element : element.querySelector('img');
  if (image instanceof HTMLImageElement) return artworkURL(image.currentSrc || image.src);
  const art = element.querySelector<HTMLElement>('[style*="background-image"]');
  const match = art?.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
  return artworkURL(match?.[1] || '');
}
export const selected = (element: Element | null): boolean | null => element
  ? element.classList.contains('sc-button-selected') || element.getAttribute('aria-pressed') === 'true'
    || /^(unlike|unfollow|undo repost|remove repost|following|liked|reposted)$/i.test(element.getAttribute('aria-label') || element.getAttribute('title') || '')
  : null;
const enabled = (element: Element | null) => element instanceof HTMLElement && element.isConnected
  && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true'
  && !element.classList.contains('m-disabled') && !element.classList.contains('disabled');
const number = (element: Element | null, attribute: string, fallback = 0) => {
  const value = Number(element?.getAttribute(attribute));
  return Number.isFinite(value) ? value : fallback;
};
export const emptyTrack = (): Track => ({ key: '', title: 'Your music, in focus.', artist: 'Play something on SoundCloud to begin.', artistKey: '', artwork: '' });

/** SoundCloud remains the only playback engine and the only source of truth. */
export class SoundCloudAdapter {
  root: HTMLElement | null = null;
  private observer: MutationObserver;
  private discovery: ReturnType<typeof setInterval>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scheduled: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(state: PlayerState) => void>();
  private trackKey = '';
  private repostState: { key: string; selected: boolean | null; available: boolean } | null = null;
  private probing = false;
  private probeAt = 0;
  private disposed = false;
  private ownedMore: HTMLElement | null = null;
  onRootChange: (() => void) | null = null;

  constructor(private doc: Document = document) {
    this.observer = new MutationObserver(records => {
      if (records.some(r => r.type === 'childList' || r.type === 'characterData' ||
        ['class', 'title', 'aria-label', 'aria-pressed', 'href', 'aria-valuenow', 'aria-valuemax'].includes(r.attributeName || ''))) this.schedule();
    });
    this.discover();
    // A single selector every two seconds recovers replaced player roots; no page traversal.
    this.discovery = setInterval(() => this.discover(), 2000);
  }
  private discover() {
    if (this.disposed) return;
    const root = this.doc.querySelector<HTMLElement>('.playControls')
      || this.doc.querySelector<HTMLElement>('[role="contentinfo"][aria-label="miniplayer"]');
    if (root === this.root) return;
    this.observer.disconnect();
    this.root = root;
    if (root) this.observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true,
      attributeFilter: ['class', 'title', 'aria-label', 'aria-pressed', 'href', 'aria-valuenow', 'aria-valuemax', 'style', 'disabled'] });
    this.onRootChange?.();
    this.schedule();
  }
  private schedule() {
    if (this.scheduled || this.disposed) return;
    this.scheduled = setTimeout(() => { this.scheduled = null; this.emit(); }, 90);
  }
  subscribe(listener: (state: PlayerState) => void) {
    this.listeners.add(listener);
    listener(this.read());
    return () => this.listeners.delete(listener);
  }
  setActive(active: boolean) {
    if (this.timer) clearInterval(this.timer);
    this.timer = active ? setInterval(() => this.emit(), 250) : null;
    if (active) {
      // Background discovery timers can be throttled while SoundCloud replaces its player.
      this.discover();
      this.emit();
    }
  }
  emit() {
    if (this.disposed) return;
    const state = this.read();
    for (const listener of this.listeners) listener(state);
  }
  query<T extends Element = HTMLElement>(selector: string): T | null { return this.root?.querySelector<T>(selector) || null; }
  readTrack(): Track {
    const title = this.query<HTMLAnchorElement>('.playbackSoundBadge__titleLink');
    const artist = this.query<HTMLAnchorElement>('.playbackSoundBadge__lightLink');
    const key = canonical(title?.getAttribute('href'));
    return key ? {
      key, title: title?.getAttribute('title') || title?.querySelector('[aria-hidden="true"]')?.textContent?.trim() || 'Untitled track',
      artist: artist?.getAttribute('title') || artist?.textContent?.trim() || 'Unknown artist',
      artistKey: canonical(artist?.getAttribute('href')),
      artwork: imageFrom(this.query('.playbackSoundBadge__avatar')),
    } : emptyTrack();
  }
  read(): PlayerState {
    const track = this.readTrack();
    if (track.key !== this.trackKey) { this.trackKey = track.key; if (this.repostState?.key !== track.key) this.repostState = null; }
    const play = this.query('.playControl');
    const progress = this.query('.playbackTimeline__progressWrapper');
    const volume = this.query('.volume__sliderWrapper');
    const volumeValue = Math.min(1, Math.max(0, number(volume, 'aria-valuenow', .5)));
    return {
      track,
      playing: !!play && (play.classList.contains('playing') || /pause/i.test(play.getAttribute('title') || play.getAttribute('aria-label') || '')),
      current: Math.max(0, number(progress, 'aria-valuenow')),
      duration: Math.max(0, number(progress, 'aria-valuemax')),
      volume: volumeValue, muted: volumeValue === 0 || !!this.query('.volume.m-muted'),
      canPlay: !!track.key && enabled(play),
      canPrevious: !!track.key && enabled(this.query('.skipControl__previous')),
      canNext: !!track.key && enabled(this.query('.skipControl__next')),
      canSeek: !!track.key && number(progress, 'aria-valuemax') > 0 && !!this.query('.playbackTimeline.is-scrubbable'),
      canVolume: !!volume,
      actions: { like: this.actionState('like', track), follow: this.actionState('follow', track), repost: this.actionState('repost', track) },
    };
  }
  private currentItem(key: string) {
    const row = this.query('.queueItemView.m-active');
    return row && canonical(row.querySelector('.queueItemView__title a')?.getAttribute('href')) === key ? row : null;
  }
  private actionTarget(action: Action, track: Track): HTMLElement | null {
    if (!track.key || this.readTrack().key !== track.key) return null;
    if (action === 'like' || action === 'follow') {
      const badge = this.query('.playbackSoundBadge');
      const key = canonical(badge?.querySelector('.playbackSoundBadge__titleLink')?.getAttribute('href'));
      const artist = canonical(badge?.querySelector('.playbackSoundBadge__lightLink')?.getAttribute('href'));
      if (key !== track.key || (action === 'follow' && (!track.artistKey || artist !== track.artistKey))) return null;
      const native = badge?.querySelector<HTMLElement>(`.playbackSoundBadge__${action}`);
      if (native) return native;
      if (action === 'follow') {
        for (const user of this.doc.querySelectorAll('.userBadge')) {
          if (canonical(user.querySelector('.userBadge__usernameLink')?.getAttribute('href')) === track.artistKey)
            return user.querySelector<HTMLElement>('.sc-button-follow');
        }
      }
      return null;
    }
    if (action === 'repost' && canonical(this.doc.location?.href) === track.key)
      return this.doc.querySelector<HTMLElement>('.listenEngagement .sc-button-repost');
    // Otherwise resolve Repost from the current native queue item's owned menu.
    // Track pages can be cross-origin iframes and must never be guessed by title.
    return null;
  }
  private actionState(action: Action, track: Track): ActionState {
    const target = this.actionTarget(action, track);
    if (target) return { available: enabled(target), selected: selected(target) };
    if (action === 'repost') {
      const liveButton = this.repostMenu(track.key)?.querySelector<HTMLElement>('.sc-button-repost');
      if (liveButton) return { available: enabled(liveButton), selected: selected(liveButton) };
    }
    if (action === 'repost' && this.repostState?.key === track.key) return {
      selected: this.repostState.selected,
      available: this.repostState.available && enabled(this.currentItem(track.key)?.querySelector('.queueItemView__more') || null),
    };
    return { available: false, selected: null };
  }
  repostMenu(key = this.readTrack().key): HTMLElement | null {
    if (!key || this.readTrack().key !== key) return null;
    const more = this.currentItem(key)?.querySelector<HTMLElement>('.queueItemView__more');
    const id = more?.getAttribute('aria-owns');
    return id ? this.doc.getElementById(id) : null;
  }
  dismissMenu() {
    const id = this.ownedMore?.getAttribute('aria-owns');
    if (this.ownedMore?.isConnected && id && this.doc.getElementById(id)?.hasAttribute('data-soundsky-menu')) this.ownedMore.click();
    this.ownedMore = null;
  }
  click(control: 'play' | 'previous' | 'next' | 'mute' | 'track' | 'artist') {
    if (this.disposed) return false;
    if (!this.root?.isConnected) this.discover();
    const selectors = { play: '.playControl', previous: '.skipControl__previous', next: '.skipControl__next',
      mute: '.volume__button', track: '.playbackSoundBadge__titleLink', artist: '.playbackSoundBadge__lightLink' };
    const target = this.query<HTMLElement>(selectors[control]);
    if (enabled(target)) { target!.click(); this.schedule(); return true; }
    return false;
  }
  seek(fraction: number, expectedKey: string) {
    if (this.readTrack().key !== expectedKey || !this.read().canSeek) return false;
    return this.drag(this.query('.playbackTimeline__progressWrapper'), Math.min(1, Math.max(0, fraction)), false);
  }
  setVolume(value: number) {
    return this.drag(this.query('.volume__sliderWrapper'), Math.min(1, Math.max(0, value)), true);
  }
  private drag(element: HTMLElement | null, fraction: number, vertical: boolean): boolean {
    if (!element) return false;
    const rail = vertical ? element.querySelector('.volume__sliderBackground') || element : element;
    const rect = rail.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const x = vertical ? rect.left + rect.width / 2 : rect.left + rect.width * fraction;
    const handle = vertical ? element.querySelector('.volume__sliderHandle')?.getBoundingClientRect() : null;
    const y = vertical && handle?.height
      ? element.getBoundingClientRect().bottom - rect.height * fraction - handle.height / 2
      : vertical ? rect.bottom - rect.height * fraction : rect.top + rect.height / 2;
    const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
    element.dispatchEvent(new MouseEvent('mousedown', init));
    this.doc.dispatchEvent(new MouseEvent('mousemove', init));
    this.doc.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    this.schedule();
    return true;
  }
  async perform(action: Action, expectedTrack: Track): Promise<boolean> {
    const fresh = this.readTrack();
    if (fresh.key !== expectedTrack.key || (action === 'follow' && fresh.artistKey !== expectedTrack.artistKey)) return false;
    const target = this.actionTarget(action, fresh);
    if (enabled(target)) { target!.click(); this.schedule(); return true; }
    if (action !== 'repost') return false;
    return this.withRepostMenu(fresh.key, true);
  }
  async probeRepost(force = false) {
    const key = this.readTrack().key;
    if (!key || this.probing || (!force && this.repostState?.key === key && this.repostState.available)) return;
    if (!force && Date.now() - this.probeAt < 1500) return;
    this.probeAt = Date.now();
    this.probing = true;
    try { await this.withRepostMenu(key, false); } finally { this.probing = false; this.schedule(); }
  }
  private async withRepostMenu(key: string, activate: boolean): Promise<boolean> {
    const row = this.currentItem(key);
    const more = row?.querySelector<HTMLElement>('.queueItemView__more');
    if (!more || !enabled(more) || this.readTrack().key !== key) return false;
    const id = more.getAttribute('aria-owns');
    if (!id) return false;
    // Do not dismiss a menu the user has opened themselves.
    if (this.doc.getElementById(id)) {
      const existing = this.doc.getElementById(id)!;
      const button = existing.querySelector<HTMLElement>('.sc-button-repost');
      this.repostState = { key, selected: selected(button), available: enabled(button) };
      if (activate && enabled(button)) { existing.setAttribute('data-soundsky-menu', ''); this.ownedMore = more; return true; }
      return !!button;
    }
    this.doc.body.setAttribute('data-soundsky-probing', '');
    more.click();
    let menu = this.doc.getElementById(id);
    if (!menu) { await new Promise(resolve => setTimeout(resolve, 50)); menu = this.doc.getElementById(id); }
    if (!menu) { this.doc.body.removeAttribute('data-soundsky-probing'); return false; }
    menu.setAttribute('data-soundsky-probe', '');
    let activated = false;
    try {
      if (this.readTrack().key !== key || this.currentItem(key) !== row || more.getAttribute('aria-owns') !== id) return false;
      const button = menu.querySelector<HTMLElement>('.sc-button-repost');
      this.repostState = { key, selected: selected(button), available: enabled(button) };
      if (activate && enabled(button)) {
        menu.removeAttribute('data-soundsky-probe');
        menu.setAttribute('data-soundsky-menu', '');
        activated = true;
        // Present SoundCloud's verified, current-track Repost control. The user
        // chooses the native action, including captions/confirmation if offered.
        this.ownedMore = more;
        return true;
      }
      return !!button;
    } finally {
      if (!activated && more.isConnected && this.doc.getElementById(id) === menu) more.click();
      menu.removeAttribute('data-soundsky-probe');
      this.doc.body.removeAttribute('data-soundsky-probing');
    }
  }
  destroy() {
    this.dismissMenu();
    this.disposed = true;
    this.observer.disconnect();
    clearInterval(this.discovery);
    if (this.timer) clearInterval(this.timer);
    if (this.scheduled) clearTimeout(this.scheduled);
    this.listeners.clear(); this.onRootChange = null;
  }
}
