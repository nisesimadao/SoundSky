import { AudioLifetime } from './audio-lifetime';
/** Optional record-style transport. Native controls still perform the final play/pause. */
export class Turntable {
  private enabled = false;
  private speed = 1;
  setSpeed(speed: number) { if (Number.isFinite(speed)) this.speed = Math.max(.5, Math.min(2, speed)); }
  private disposed = false;
  private events = new AbortController();
  private media: HTMLMediaElement | null = null;
  private watchedMedia = new WeakSet<HTMLMediaElement>();
  private mediaStarts = new WeakMap<HTMLMediaElement, object>();
  private sources = new Set<AudioBufferSourceNode>();
  private lifetime = new AudioLifetime<AudioBufferSourceNode>(node=>{this.restoreSource(node);this.sources.delete(node);});
  private sourceRates = new Map<AudioBufferSourceNode, number>();
  private mediaRates = new Map<HTMLMediaElement, { rate: number; pitch: boolean }>();
  private frames = new Map<HTMLMediaElement, number>();
  private mediaSteps = new Map<HTMLMediaElement, ReturnType<typeof setTimeout>>();
  private mediaTicks = new Map<HTMLMediaElement, (now: number) => void>();
  private mediaCompletion = new Map<HTMLMediaElement, ReturnType<typeof setTimeout>>();
  private pending: ReturnType<typeof setTimeout> | null = null;
  private pauseClock: AudioBufferSourceNode | null = null;
  private release: ReturnType<typeof setTimeout> | null = null;
  private bypass = false;
  private startingUntil = 0;
  private control: HTMLElement | null = null;
  private stateObserver: MutationObserver;
  private pauseNative = HTMLMediaElement.prototype.pause;
  private pauseHook: HTMLMediaElement['pause'];
  private session = navigator.mediaSession;
  private actionNative = this.session?.setActionHandler;
  private actionHook: MediaSession['setActionHandler'] | null = null;
  private actions = new Map<MediaSessionAction, MediaSessionActionHandler | null>();
  private startNative = typeof AudioBufferSourceNode === 'undefined' ? null : AudioBufferSourceNode.prototype.start;
  private stopNative = typeof AudioBufferSourceNode === 'undefined' ? null : AudioBufferSourceNode.prototype.stop;
  private startHook: AudioBufferSourceNode['start'] | null = null;
  private stopHook: AudioBufferSourceNode['stop'] | null = null;
  constructor() {
    const signal = this.events.signal;
    const owner = this;
    this.control = document.querySelector('.playControl');
    this.stateObserver = new MutationObserver(records => {
      if (this.disposed || !this.enabled) return;
      if (!this.control?.isConnected || records.some(record => record.target === this.control)) {
        this.control = document.querySelector('.playControl');
        this.syncNativePlaybackState();
      }
    });
    // Mutation observers run in background tabs without waiting for the content
    // script's throttled timers or a round trip through postMessage.
    this.pauseHook = function(this: HTMLMediaElement) {
      // Native engine transitions must stay synchronous. Delaying an internal
      // pause can strand SoundCloud halfway through its own stop/fade operation.
      owner.pauseNative.call(this);
      if (this === owner.media && !owner.bypass) {
        owner.cancel();
        owner.syncNativePlaybackState();
      }
    };
    HTMLMediaElement.prototype.pause = this.pauseHook;
    if (this.session && typeof this.actionNative === 'function') {
      this.actionHook = function(action, nativeHandler) {
        // Without an explicit handler Chrome may suspend Web Audio directly,
        // bypassing SoundCloud's transport and leaving its UI playing forever.
        const handler = nativeHandler ?? (owner.enabled && (action === 'play' || action === 'pause') ? () => {
          const control = document.querySelector<HTMLElement>('.playControl');
          if (control && owner.nativePlaying() !== (action === 'play')) control.click();
        } : null);
        const hook: MediaSessionActionHandler | null = handler ? details => {
          if (!owner.enabled || owner.disposed || owner.bypass) { handler(details); return; }
          if (action === 'pause' || action === 'stop') {
            if (owner.nativePlaying() === false) { owner.cancel(); owner.syncNativePlaybackState(); return; }
            if (owner.pause(() => {
              owner.commitAction(action, handler, details);
              owner.syncNativePlaybackState();
            })) return;
          } else if (action === 'play') {
            owner.cancel();
            // A play action during spin-down means keep playing. Calling a
            // native handler that clicks the toggle would start another pause.
            if (owner.nativePlaying() === true) { owner.syncNativePlaybackState(); return; }
            owner.startingUntil = performance.now() + 10000;
          } else if (['seekbackward', 'seekforward', 'seekto', 'nexttrack', 'previoustrack'].includes(action)) {
            owner.cancel();
          }
          owner.commitAction(action, handler, details);
          owner.syncNativePlaybackState();
        } : null;
        Reflect.apply(owner.actionNative!, this, [action, hook]);
        owner.actions.set(action, nativeHandler);
      };
      this.session.setActionHandler = this.actionHook;
    }
    if (this.startNative && this.stopNative) {
      const owner = this;
      this.startHook = function(this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
        const result = Reflect.apply(owner.startNative!, this, args);
        if (owner.disposed) return result;
        owner.sources.add(this);
        owner.lifetime.watch(this,true);
        if (owner.sources.has(this) && owner.enabled && performance.now() < owner.startingUntil) { owner.rampSource(this, false, false, Math.max(this.context.currentTime, args[0] || 0)); owner.startingUntil = 0; }
        return result;
      };
      this.stopHook = function(this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['stop']>) {
        // Seeking/track changes must stop native sources at their requested time.
        const result = Reflect.apply(owner.stopNative!, this, args);
        const immediate = args[0] === undefined || args[0] <= this.context.currentTime;
        // A stream can end or replace a chunk during spin-down. That is not a
        // cancellation of the user's pause; seeking/navigation cancel explicitly.
        if (!owner.disposed && immediate) {owner.sources.delete(this);owner.lifetime.unwatch(this);owner.restoreSource(this);}
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
      if (elements.some(el => el.matches('input,textarea,select,[contenteditable],[role="textbox"],[role="dialog"],[role="menu"],[role="menuitem"],[role="tab"],[data-soundsky-menu],[data-soundsky-native-preferences],summary,[id^="repost-dropdown-"],.repostDropdown'))) return;
      const fromPlayer = elements.some(el => el.matches('soundsky-player'));
      if (fromPlayer && elements.some(el => el.matches('a,button:not(.playControl):not(.play-toggle),[role="button"]:not(.playControl):not(.play-toggle)'))) return;
      if (event.defaultPrevented && !fromPlayer) return;
      const play = document.querySelector<HTMLElement>('.playControl');
      if (!play) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) play.click();
    }, { capture: true, signal });
    document.addEventListener('seeking', event => {
      if(!(event.target instanceof HTMLMediaElement)||event.target===this.media)this.cancel();
    }, { capture: true, signal });
    document.addEventListener('visibilitychange', () => {
      // Switch the interpolation clock when frames stop in a background tab.
      // Visibility must not disable an audible effect or cancel a requested pause.
      for (const tick of [...this.mediaTicks.values()]) tick(performance.now());
    }, { signal });
    document.addEventListener('pointerdown', event => {
      if ((event.target as Element)?.closest?.('.skipControl__next,.skipControl__previous,.playbackTimeline__progressWrapper')) this.cancel();
    }, { capture: true, signal });
  }
  setEnabled(enabled: boolean) {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    // Install fallback play/pause actions even if the site never registers any.
    // On disable restore exactly the handlers (or nulls) registered by the site.
    if (this.session && this.actionHook) for (const action of ['play', 'pause'] as const)
      this.actionHook.call(this.session, action, this.actions.get(action) ?? null);
    if (!enabled) { this.stateObserver.disconnect(); this.cancel(); return; }
    this.control = document.querySelector('.playControl');
    this.stateObserver.observe(document, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'title', 'aria-label'] });
    this.syncNativePlaybackState();
  }
  private commitAction(action: MediaSessionAction, handler: MediaSessionActionHandler, details: MediaSessionActionDetails) {
    const control = document.querySelector<HTMLElement>('.playControl');
    if ((action === 'play' || action === 'pause') && control) {
      if (this.nativePlaying() === (action === 'play')) return;
      // Use the same full transport transition as the on-page button. A site's
      // media-session handler may stop only its output, leaving its model playing.
      const previous = this.bypass;
      this.bypass = true;
      try { control.click(); } finally { this.bypass = previous; }
    } else handler(details);
  }
  private nativePlaying(): boolean | null {
    const control = document.querySelector<HTMLElement>('.playControl');
    if (!control) return null;
    return control.classList.contains('playing') || /pause/i.test(control.getAttribute('title') || control.getAttribute('aria-label') || '');
  }
  syncNativePlaybackState(fallback: MediaSessionPlaybackState = 'none') {
    const playing = this.nativePlaying();
    this.syncPlaybackState(playing === null ? fallback : playing ? 'playing' : 'paused');
  }
  /** Use the native player's state, rather than AudioContext activity, for OS controls. */
  syncPlaybackState(state: MediaSessionPlaybackState) {
    if (this.disposed || !this.enabled || !this.session) return;
    if (this.session.playbackState !== state) this.session.playbackState = state;
  }
  /** Called before native media.play(), so pitch correction is disabled before sound starts. */
  startMedia(media: HTMLMediaElement) {
    if (this.disposed) return;
    const attempt={};this.mediaStarts.set(media,attempt);
    this.media = media;
    if (!this.watchedMedia.has(media)) {
      this.watchedMedia.add(media);
      // SoundCloud also uses audio elements that never enter the document.
      for (const event of ['seeking', 'emptied']) media.addEventListener(event, () => {
        if(this.media===media)this.cancel();else this.restoreMedia(media);
      }, { signal: this.events.signal });
    }
    if (!this.enabled) return;
    // Also clear the previous pause's release timer. Otherwise it can reset the
    // rate in the middle of this new spin-up.
    if (this.pending || this.release) this.cancel();
    if (media.paused || performance.now() < this.startingUntil) {
      this.rampMedia(media, false); this.startingUntil = 0;
    }
    const ramp=this.mediaTicks.get(media);
    if(!ramp)return;
    // A rejected play belongs to this ramp only. A later play/pause may already
    // own the element, so an old rejection must not reset its current effect.
    return () => { if(this.mediaStarts.get(media)===attempt && this.mediaTicks.get(media)===ramp)this.restoreMedia(media); };
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
      this.clearPauseClock();
      for (const node of sources) this.rampSource(node, false, true);
      for (const element of media) this.rampMedia(element, false, true);
      return true; // A second press reverses the slowing record without pausing native playback.
    }
    this.startingUntil = 0;
    if (this.release) clearTimeout(this.release); this.release = null;
    for (const node of sources) this.rampSource(node, true);
    for (const element of media) this.rampMedia(element, true);
    const key = document.querySelector<HTMLAnchorElement>('.playbackSoundBadge__titleLink')?.href;
    const duration = 420 / this.speed;
    const finish = () => {
      if (!this.pending) return;
      clearTimeout(this.pending);
      this.pending = null;
      this.clearPauseClock();
      const current = document.querySelector<HTMLAnchorElement>('.playbackSoundBadge__titleLink')?.href;
      if (!this.enabled || current !== key) { this.cancel(); return; }
      this.release = setTimeout(() => { this.release = null; this.restoreRates(); }, 250);
      this.bypass = true;
      try { commit(); }
      catch (error) { this.cancel(); throw error; }
      finally {
        this.bypass = false;
        for (const element of media) if (element.paused) this.restoreMedia(element);
        this.syncNativePlaybackState();
      }
    };
    this.pending = setTimeout(finish, duration);
    // Audio-clock completion also works when background timer delivery is delayed.
    // Call captured native methods so this silent clock never becomes an effect source.
    const context = sources[0]?.context;
    if (context && this.startNative && this.stopNative) try {
      const clock = context.createBufferSource();
      clock.buffer = context.createBuffer(1, 1, context.sampleRate); clock.loop = true;
      this.pauseClock = clock;
      clock.addEventListener('ended', () => { if (this.pauseClock === clock) finish(); }, { once: true, signal: this.events.signal });
      this.startNative.call(clock, context.currentTime);
      this.stopNative.call(clock, context.currentTime + duration / 1000);
    } catch { this.clearPauseClock(); }
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
      // Never leave an audible source at the spin-down rate if JS stalls.
      if (down) rate.setValueAtTime(base, at + .42 / this.speed + .25);
      rate.setValueCurveAtTime(curve, at, (down ? .42 : .24) / this.speed);
    } catch { this.restoreSource(node); }
  }
  private rampMedia(media: HTMLMediaElement, down: boolean, reverse = false) {
    if (!this.mediaRates.has(media)) this.mediaRates.set(media, { rate: media.playbackRate, pitch: media.preservesPitch });
    const original = this.mediaRates.get(media)!;
    const oldFrame = this.frames.get(media); if (oldFrame) cancelAnimationFrame(oldFrame);
    const oldStep = this.mediaSteps.get(media); if (oldStep !== undefined) clearTimeout(oldStep);
    const oldCompletion = this.mediaCompletion.get(media); if (oldCompletion !== undefined) clearTimeout(oldCompletion);
    const from = down || reverse ? media.playbackRate : original.rate * .25;
    const to = down ? original.rate * .25 : original.rate;
    media.preservesPitch = false; media.playbackRate = from;
    const at = performance.now(), duration = (down ? 420 : 240) / this.speed;
    const complete = () => {
      if (this.mediaTicks.get(media) !== tick) return;
      media.playbackRate = to;
      const frame = this.frames.get(media); if (frame !== undefined) cancelAnimationFrame(frame);
      this.frames.delete(media);
      const step = this.mediaSteps.get(media); if (step !== undefined) clearTimeout(step);
      this.mediaSteps.delete(media); this.mediaTicks.delete(media);
      const timer = this.mediaCompletion.get(media); if (timer !== undefined) clearTimeout(timer);
      this.mediaCompletion.delete(media);
      if (!down) this.restoreMedia(media);
    };
    const tick = (now: number) => {
      if (this.mediaTicks.get(media) !== tick) return;
      const frame = this.frames.get(media); if (frame !== undefined) cancelAnimationFrame(frame);
      this.frames.delete(media);
      const step = this.mediaSteps.get(media); if (step !== undefined) clearTimeout(step);
      this.mediaSteps.delete(media);
      const t = Math.min(1, (now - at) / duration), ease = t * t * (3 - 2 * t);
      media.playbackRate = from + (to - from) * ease;
      if (t < 1) schedule();
      else complete();
    };
    const schedule = () => {
      if (document.hidden) this.mediaSteps.set(media, setTimeout(() => tick(performance.now()), 16));
      else this.frames.set(media, requestAnimationFrame(tick));
    };
    this.mediaTicks.set(media, tick); schedule();
    // Frame delivery is only for smooth interpolation, never for completion.
    this.mediaCompletion.set(media, setTimeout(complete, duration));
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
    const timer = this.mediaCompletion.get(media); if (timer !== undefined) clearTimeout(timer); this.mediaCompletion.delete(media);
    const step = this.mediaSteps.get(media); if (step !== undefined) clearTimeout(step); this.mediaSteps.delete(media);
    this.mediaTicks.delete(media);
    const original = this.mediaRates.get(media);
    if (original) { media.playbackRate = original.rate; media.preservesPitch = original.pitch; this.mediaRates.delete(media); }
  }
  private restoreRates() {
    for (const node of this.sourceRates.keys()) this.restoreSource(node);
    for (const media of this.mediaRates.keys()) this.restoreMedia(media);
  }
  private cancel() {
    if (this.pending) clearTimeout(this.pending); this.pending = null;
    this.clearPauseClock();
    if (this.release) clearTimeout(this.release); this.release = null;
    this.startingUntil = 0; this.restoreRates();
  }
  private clearPauseClock() {
    const clock = this.pauseClock; this.pauseClock = null;
    if (clock) {
      try { this.stopNative?.call(clock); } catch { /* already ended */ }
      try { clock.disconnect(); } catch { /* context may already be closed */ }
    }
  }
  destroy() {
    if (this.disposed) return; this.disposed = true;
    this.stateObserver.disconnect(); this.control = null;
    this.enabled = false; this.cancel(); this.events.abort(); this.lifetime.clear(); this.sources.clear(); this.media = null;
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
