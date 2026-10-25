/** Optional record-style transport. Native controls still perform the final play/pause. */
export class Turntable {
  private enabled = false;
  private disposed = false;
  private events = new AbortController();
  private media: HTMLMediaElement | null = null;
  private watchedMedia = new WeakSet<HTMLMediaElement>();
  private sources = new Set<AudioBufferSourceNode>();
  private sourceRates = new Map<AudioBufferSourceNode, number>();
  private mediaRates = new Map<HTMLMediaElement, { rate: number; pitch: boolean }>();
  private frames = new Map<HTMLMediaElement, number>();
  private pending: ReturnType<typeof setTimeout> | null = null;
  private release: ReturnType<typeof setTimeout> | null = null;
  private bypass = false;
  private startingUntil = 0;
  private pauseNative = HTMLMediaElement.prototype.pause;
  private pauseHook: HTMLMediaElement['pause'];
  private session = navigator.mediaSession;
  private actionNative = this.session?.setActionHandler;
  private actionHook: MediaSession['setActionHandler'] | null = null;
  private actions = new Map<MediaSessionAction, MediaSessionActionHandler>();
  private startNative = typeof AudioBufferSourceNode === 'undefined' ? null : AudioBufferSourceNode.prototype.start;
  private stopNative = typeof AudioBufferSourceNode === 'undefined' ? null : AudioBufferSourceNode.prototype.stop;
  private startHook: AudioBufferSourceNode['start'] | null = null;
  private stopHook: AudioBufferSourceNode['stop'] | null = null;
  constructor() {
    const signal = this.events.signal;
    const owner = this;
    this.pauseHook = function(this: HTMLMediaElement) {
      // A pause event is already too late to slow audible output. Intercept the
      // request while the tracked media is still playing, including detached audio.
      if (this === owner.media && !this.paused && !this.ended && !this.seeking &&
          owner.pause(() => owner.pauseNative.call(this))) return;
      owner.pauseNative.call(this);
    };
    HTMLMediaElement.prototype.pause = this.pauseHook;
    if (this.session && typeof this.actionNative === 'function') {
      this.actionHook = function(action, handler) {
        const hook: MediaSessionActionHandler | null = handler ? details => {
          if (!owner.enabled || owner.disposed || owner.bypass) { handler(details); return; }
          if (action === 'pause' || action === 'stop') {
            if (owner.pause(() => handler(details))) return;
          } else if (action === 'play') {
            owner.cancel(); owner.startingUntil = performance.now() + 10000;
          } else if (['seekbackward', 'seekforward', 'seekto', 'nexttrack', 'previoustrack'].includes(action)) {
            owner.cancel();
          }
          handler(details);
        } : null;
        Reflect.apply(owner.actionNative!, this, [action, hook]);
        if (handler) owner.actions.set(action, handler);
        else owner.actions.delete(action);
      };
      this.session.setActionHandler = this.actionHook;
    }
    if (this.startNative && this.stopNative) {
      const owner = this;
      this.startHook = function(this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
        const result = Reflect.apply(owner.startNative!, this, args);
        if (owner.disposed) return result;
        owner.sources.add(this);
        this.addEventListener('ended', () => { owner.restoreSource(this); owner.sources.delete(this); }, { once: true, signal });
        if (owner.enabled && performance.now() < owner.startingUntil) { owner.rampSource(this, false, false, Math.max(this.context.currentTime, args[0] || 0)); owner.startingUntil = 0; }
        return result;
      };
      this.stopHook = function(this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['stop']>) {
        // Seeking/track changes must stop native sources at their requested time.
        const result = Reflect.apply(owner.stopNative!, this, args);
        if (!owner.disposed && owner.pending && !owner.bypass) owner.cancel();
        if (!owner.disposed && (args[0] === undefined || args[0] <= this.context.currentTime)) owner.sources.delete(this);
        return result;
      };
      AudioBufferSourceNode.prototype.start = this.startHook;
      AudioBufferSourceNode.prototype.stop = this.stopHook;
    }
    window.addEventListener('click', this.click, { capture: true, signal });
    window.addEventListener('keydown', event => {
      if (!this.enabled || event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      // SoundCloud's global Space shortcut also runs while its buttons and links
      // have focus. Route those through the record before the native shortcut can
      // stop audio directly; preserve editing, menus and SoundSky control activation.
      const path = event.composedPath();
      const elements = path.filter((node): node is Element => node instanceof Element);
      if (elements.some(el => el.matches('input,textarea,select,[contenteditable],[role="textbox"],[role="dialog"],[role="menu"],[role="menuitem"],[role="tab"],[data-soundsky-menu],[id^="repost-dropdown-"],.repostDropdown'))) return;
      const fromPlayer = elements.some(el => el.matches('soundsky-player'));
      if (fromPlayer && elements.some(el => el.matches('a,button:not(.playControl):not(.play-toggle),[role="button"]:not(.playControl):not(.play-toggle)'))) return;
      if (event.defaultPrevented && !fromPlayer) return;
      const play = document.querySelector<HTMLElement>('.playControl');
      if (!play) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) play.click();
    }, { capture: true, signal });
    document.addEventListener('seeking', () => this.cancel(), { capture: true, signal });
    document.addEventListener('pointerdown', event => {
      if ((event.target as Element)?.closest?.('.skipControl__next,.skipControl__previous,.playbackTimeline__progressWrapper')) this.cancel();
    }, { capture: true, signal });
  }
  setEnabled(enabled: boolean) { if (this.disposed) return; this.enabled = enabled; if (!enabled) this.cancel(); }
  /** Use the native player's state, rather than AudioContext activity, for OS controls. */
  syncPlaybackState(state: MediaSessionPlaybackState) {
    if (this.disposed || !this.enabled || !this.session) return;
    if (this.session.playbackState !== state) this.session.playbackState = state;
  }
  /** Called before native media.play(), so pitch correction is disabled before sound starts. */
  startMedia(media: HTMLMediaElement) {
    if (this.disposed) return;
    this.media = media;
    if (!this.watchedMedia.has(media)) {
      this.watchedMedia.add(media);
      // SoundCloud also uses audio elements that never enter the document.
      for (const event of ['seeking', 'emptied']) media.addEventListener(event, () => this.cancel(), { signal: this.events.signal });
    }
    if (!this.enabled) return;
    if (this.pending) this.cancel();
    if (!media.paused && performance.now() >= this.startingUntil) return;
    this.rampMedia(media, false); this.startingUntil = 0;
  }
  private click = (event: MouseEvent) => {
    if (!this.enabled || this.bypass) return;
    const control = (event.target as Element)?.closest?.<HTMLElement>('.playControl,.sc-button-play,.sc-button-pause,.playButton');
    if (!control) return;
    const playing = control.classList.contains('playing') || control.classList.contains('m-playing') || control.classList.contains('sc-button-pause') || /pause/i.test(control.getAttribute('title') || control.getAttribute('aria-label') || '');
    if (!playing) {
      this.cancel(); this.startingUntil = performance.now() + 10000;
      return; // Original native handler starts playback; start hooks add the spin-up.
    }
    if (!this.pause(() => {
      const play = document.querySelector<HTMLElement>('.playControl');
      if (play && (play.classList.contains('playing') || /pause/i.test(play.getAttribute('title') || play.getAttribute('aria-label') || ''))) play.click();
    }, true)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  private pause(commit: () => void, toggle = false): boolean {
    if (!this.enabled || this.disposed || this.bypass) return false;
    const media = [...new Set([...document.querySelectorAll<HTMLMediaElement>('audio,video'), ...(this.media ? [this.media] : [])])].filter(el => !el.paused && !el.ended);
    const sources = [...this.sources].filter(node => node.context.state === 'running');
    if (!media.length && !sources.length) return false;
    if (this.pending) {
      if (!toggle) return true; // Repeated pause requests share the original deadline.
      clearTimeout(this.pending); this.pending = null;
      for (const node of sources) this.rampSource(node, false, true);
      for (const element of media) this.rampMedia(element, false, true);
      return true; // A second press reverses the slowing record without pausing native playback.
    }
    this.startingUntil = 0;
    if (this.release) clearTimeout(this.release); this.release = null;
    for (const node of sources) this.rampSource(node, true);
    for (const element of media) this.rampMedia(element, true);
    const key = document.querySelector<HTMLAnchorElement>('.playbackSoundBadge__titleLink')?.href;
    this.pending = setTimeout(() => {
      this.pending = null;
      const current = document.querySelector<HTMLAnchorElement>('.playbackSoundBadge__titleLink')?.href;
      if (!this.enabled || current !== key) { this.cancel(); return; }
      this.bypass = true;
      try { commit(); } finally { this.bypass = false; }
      // Preserve the low pitch through any short native stop fade, then restore owned rates.
      for (const element of media) if (element.paused) this.restoreMedia(element);
      this.release = setTimeout(() => { this.release = null; this.restoreRates(); }, 250);
    }, 420);
    return true;
  }
  private rampSource(node: AudioBufferSourceNode, down: boolean, reverse = false, at = node.context.currentTime) {
    const rate = node.playbackRate;
    if (!this.sourceRates.has(node)) this.sourceRates.set(node, rate.value);
    const base = this.sourceRates.get(node)!;
    const from = down || reverse ? rate.value : base * .08;
    const to = down ? base * .04 : base;
    const curve = new Float32Array(64);
    for (let i = 0; i < curve.length; i++) {
      const t = i / (curve.length - 1), ease = t * t * (3 - 2 * t);
      curve[i] = from + (to - from) * ease;
    }
    try {
      if (typeof rate.cancelAndHoldAtTime === 'function') rate.cancelAndHoldAtTime(node.context.currentTime);
      else rate.cancelScheduledValues(0);
      rate.setValueAtTime(from, at);
      rate.setValueCurveAtTime(curve, at, down ? .42 : .24);
    } catch { this.restoreSource(node); }
  }
  private rampMedia(media: HTMLMediaElement, down: boolean, reverse = false) {
    if (!this.mediaRates.has(media)) this.mediaRates.set(media, { rate: media.playbackRate, pitch: media.preservesPitch });
    const original = this.mediaRates.get(media)!;
    const oldFrame = this.frames.get(media); if (oldFrame) cancelAnimationFrame(oldFrame);
    const from = down || reverse ? media.playbackRate : original.rate * .25;
    const to = down ? original.rate * .25 : original.rate;
    media.preservesPitch = false; media.playbackRate = from;
    const at = performance.now(), duration = down ? 420 : 240;
    const tick = (now: number) => {
      const t = Math.min(1, (now - at) / duration), ease = t * t * (3 - 2 * t);
      media.playbackRate = from + (to - from) * ease;
      if (t < 1) this.frames.set(media, requestAnimationFrame(tick));
      else { this.frames.delete(media); if (!down) this.restoreMedia(media); }
    };
    this.frames.set(media, requestAnimationFrame(tick));
  }
  private restoreSource(node: AudioBufferSourceNode) {
    const base = this.sourceRates.get(node); if (base === undefined) return;
    try {
      if (typeof node.playbackRate.cancelAndHoldAtTime === 'function') node.playbackRate.cancelAndHoldAtTime(node.context.currentTime);
      else node.playbackRate.cancelScheduledValues(0);
      node.playbackRate.setValueAtTime(base, node.context.currentTime);
    } catch { /* ended/closed context */ }
    this.sourceRates.delete(node);
  }
  private restoreMedia(media: HTMLMediaElement) {
    const frame = this.frames.get(media); if (frame) cancelAnimationFrame(frame); this.frames.delete(media);
    const original = this.mediaRates.get(media);
    if (original) { media.playbackRate = original.rate; media.preservesPitch = original.pitch; this.mediaRates.delete(media); }
  }
  private restoreRates() {
    for (const node of this.sourceRates.keys()) this.restoreSource(node);
    for (const media of this.mediaRates.keys()) this.restoreMedia(media);
  }
  private cancel() {
    if (this.pending) clearTimeout(this.pending); this.pending = null;
    if (this.release) clearTimeout(this.release); this.release = null;
    this.startingUntil = 0; this.restoreRates();
  }
  destroy() {
    if (this.disposed) return; this.disposed = true;
    this.enabled = false; this.cancel(); this.events.abort(); this.sources.clear(); this.media = null;
    if (HTMLMediaElement.prototype.pause === this.pauseHook) HTMLMediaElement.prototype.pause = this.pauseNative;
    if (this.session && this.actionHook && this.session.setActionHandler === this.actionHook) {
      for (const [action, handler] of this.actions) this.actionNative!.call(this.session, action, handler);
      this.session.setActionHandler = this.actionNative!;
    }
    this.actions.clear();
    if (this.startHook && AudioBufferSourceNode.prototype.start === this.startHook) AudioBufferSourceNode.prototype.start = this.startNative!;
    if (this.stopHook && AudioBufferSourceNode.prototype.stop === this.stopHook) AudioBufferSourceNode.prototype.stop = this.stopNative!;
  }
}
