import { canonical } from './adapter';

/** Annotate native rows by track identity; SoundCloud recycles these nodes. */
export class QueuePrefetch {
  private root: HTMLElement | null = null;
  private progress = new Map<string, number>();
  private scope = '';
  private observer = new MutationObserver(() => this.refresh());

  sync(root: HTMLElement | null, count: number, seconds: number) {
    const scope = `${count}:${seconds}`;
    if (scope !== this.scope) { this.scope = scope; this.progress.clear(); }
    if (root !== this.root) {
      this.observer.disconnect(); this.clear(); this.root = root;
      if (root) this.observer.observe(root, {subtree:true, childList:true, attributes:true, attributeFilter:['href','class']});
    }
    this.refresh();
  }
  setReady(keys: string[]) { this.setProgress(keys.map(key => ({key,value:1}))); }
  setProgress(items: {key:string;value:number}[]) { this.progress = new Map(items.map(item => [item.key,item.value])); this.refresh(); }
  private refresh() {
    this.root?.querySelectorAll<HTMLElement>('.queueItemView').forEach(row => {
      const key = canonical(row.querySelector('.queueItemView__title a')?.getAttribute('href'));
      const value = !row.classList.contains('m-active') && !row.classList.contains('m-dimmed') ? this.progress.get(key) || 0 : 0;
      const ready = value === 1;
      if(row.hasAttribute('data-soundsky-prefetching') !== (value > 0))row.toggleAttribute('data-soundsky-prefetching',value > 0);
      if(value > 0) { if(row.style.getPropertyValue('--sky-prefetch-progress') !== String(value))row.style.setProperty('--sky-prefetch-progress',String(value)); } else if(row.style.getPropertyValue('--sky-prefetch-progress'))row.style.removeProperty('--sky-prefetch-progress');
      if (row.hasAttribute('data-soundsky-prefetched') !== ready) row.toggleAttribute('data-soundsky-prefetched', ready);
    });
  }
  private clear() {
    this.root?.querySelectorAll<HTMLElement>('[data-soundsky-prefetching], [data-soundsky-prefetched]').forEach(row => { row.removeAttribute('data-soundsky-prefetched'); row.removeAttribute('data-soundsky-prefetching'); row.style.removeProperty('--sky-prefetch-progress'); });
  }
  destroy() { this.observer.disconnect(); this.clear(); this.root = null; this.progress.clear(); }
}
