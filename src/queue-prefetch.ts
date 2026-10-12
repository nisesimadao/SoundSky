import { canonical } from './adapter';

/** Annotate native rows by track identity; SoundCloud recycles these nodes. */
export class QueuePrefetch {
  private root: HTMLElement | null = null;
  private ready = new Set<string>();
  private scope = '';
  private observer = new MutationObserver(() => this.refresh());

  sync(root: HTMLElement | null, count: number, seconds: number) {
    const scope = `${count}:${seconds}`;
    if (scope !== this.scope) { this.scope = scope; this.ready.clear(); }
    if (root !== this.root) {
      this.observer.disconnect(); this.clear(); this.root = root;
      if (root) this.observer.observe(root, {subtree:true, childList:true, attributes:true, attributeFilter:['href','class']});
    }
    this.refresh();
  }
  setReady(keys: string[]) { this.ready = new Set(keys); this.refresh(); }
  private refresh() {
    this.root?.querySelectorAll<HTMLElement>('.queueItemView').forEach(row => {
      const key = canonical(row.querySelector('.queueItemView__title a')?.getAttribute('href'));
      const ready = this.ready.has(key) && !row.classList.contains('m-active') && !row.classList.contains('m-dimmed');
      if (row.hasAttribute('data-soundsky-prefetched') !== ready) row.toggleAttribute('data-soundsky-prefetched', ready);
    });
  }
  private clear() {
    this.root?.querySelectorAll('[data-soundsky-prefetched]').forEach(row => row.removeAttribute('data-soundsky-prefetched'));
  }
  destroy() { this.observer.disconnect(); this.clear(); this.root = null; this.ready.clear(); }
}
