/** Animate visible rows on entry without changing virtual-list positioning or handlers. */
export class QueueMotion {
  private visible: HTMLElement | null = null;
  private frame = 0;
  private inSoundSky = false;
  private animations = new Set<Animation>();
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private observer = new MutationObserver(records => {
    if (records.some(record => record.attributeName !== 'style' || (record.target instanceof Element && record.target.matches('.queue')))) this.schedule();
  });
  private changed = () => { this.cancel(); this.schedule(); };
  constructor() {
    this.observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'data-soundsky-theme', 'data-soundsky-open', 'data-soundsky-queue', 'style'] });
    this.motion.addEventListener('change', this.changed);
    document.addEventListener('visibilitychange', this.changed);
  }
  private schedule() { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); }); }
  private update() {
    const queue = document.querySelector<HTMLElement>('.queue.m-visible');
    const enabled = !!document.documentElement.hasAttribute('data-soundsky-theme') || !!queue?.hasAttribute('data-soundsky-queue');
    const next = enabled && queue && queue.getBoundingClientRect().height && !document.hidden ? queue : null;
    const inSoundSky = !!next?.hasAttribute('data-soundsky-queue');
    if (next === this.visible && inSoundSky === this.inSoundSky) return;
    this.inSoundSky = inSoundSky;
    this.cancel(); this.visible = next;
    if (!next || this.motion.matches) return;
    const bounds = (next.querySelector('.queue__scrollableInner') || next).getBoundingClientRect();
    const rows = [...next.querySelectorAll<HTMLElement>('.queueItemView')]
      .filter(row => { const rect = row.getBoundingClientRect(); return rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom; })
      .sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    rows.forEach((row, index) => {
      // Individual translate leaves native absolute/transform offsets intact.
      const animation = row.animate([{ translate: '0 12px', opacity: 0 }, { translate: '0 0', opacity: 1 }],
        { duration: 340, delay: Math.min(index, 12) * 35, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'backwards' });
      this.animations.add(animation);
      animation.finished.then(() => this.animations.delete(animation), () => this.animations.delete(animation));
    });
  }
  private cancel() { for (const animation of this.animations) animation.cancel(); this.animations.clear(); }
  destroy() {
    this.observer.disconnect(); cancelAnimationFrame(this.frame); this.cancel();
    this.motion.removeEventListener('change', this.changed); document.removeEventListener('visibilitychange', this.changed);
  }
}
