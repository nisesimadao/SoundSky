export type Appearance = 'light' | 'dark';
export function declaredAppearance(doc: Document = document): Appearance | null {
  for (const element of [doc.body, doc.documentElement]) {
    if (!element) continue;
    if (element.classList.contains('theme-dark')) return 'dark';
    if (element.classList.contains('theme-light')) return 'light';
    if (element.getAttribute('data-theme') === 'dark') return 'dark';
    if (element.getAttribute('data-theme') === 'light') return 'light';
  }
  return null;
}
/** Observe SoundCloud's resolved theme, including its Automatic mode. Never save an override. */
export class NativeAppearance {
  private observer: MutationObserver;
  private media: MediaQueryList | null;
  private value: Appearance | null = null;
  constructor(private changed: (theme: Appearance) => void, private doc = document) {
    const win = doc.defaultView!;
    this.media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: dark)') : null;
    this.observer = new win.MutationObserver(this.update);
    for (const node of [doc.documentElement, doc.body]) if (node) this.observer.observe(node, {attributes:true,attributeFilter:['class','data-theme']});
    this.media?.addEventListener('change', this.update);
    this.update();
  }
  private update = () => {
    const next = declaredAppearance(this.doc) ?? (this.media?.matches ? 'dark' : 'light');
    if (next === this.value) return;
    this.value = next; this.changed(next);
  };
  destroy(){this.observer.disconnect();this.media?.removeEventListener('change',this.update);}
}
