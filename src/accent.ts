import { artworkPalette, defaultPalette, paletteAt, hueAt } from './artwork-palette';
/** Pick a dominant chromatic hue rather than averaging opposing colors into gray. */
export function artworkHue(pixels: Uint8ClampedArray): number | null {
  const weights = new Float64Array(36);
  const xs = new Float64Array(36), ys = new Float64Array(36);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), chroma = hi - lo;
    if (pixels[i + 3] < 128 || chroma < .08 || hi < .12) continue;
    let hue = hi === r ? ((g - b) / chroma) % 6 : hi === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    hue = (hue * 60 + 360) % 360;
    const bin = Math.floor(hue / 10), weight = chroma * chroma * Math.sqrt(hi);
    weights[bin] += weight;
    xs[bin] += Math.cos(hue * Math.PI / 180) * weight;
    ys[bin] += Math.sin(hue * Math.PI / 180) * weight;
  }
  let best = -1, score = 0;
  for (let i = 0; i < weights.length; i++) {
    const local = weights[(i + 35) % 36] + weights[i] + weights[(i + 1) % 36];
    if (local > score) { best = i; score = local; }
  }
  if (best < 0) return null;
  let x = 0, y = 0;
  for (const i of [(best + 35) % 36, best, (best + 1) % 36]) { x += xs[i]; y += ys[i]; }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export { hueAt } from './artwork-palette';
export const accentColor = (hue: number) => `hsl(${hue.toFixed(3)} 55% 72%)`;

export class ArtworkAccent {
  private hue = 210;
  private palette = [...defaultPalette];
  private paletteTransition: {from:string[];to:string[]} | null = null;
  private generation = 0;
  private image: HTMLImageElement | null = null;
  private frame = 0;
  private transition: { from: number; to: number; start: number } | null = null;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private apply: (hue: number) => void, private applyPalette: (colors:string[]) => void = () => {}) { apply(this.hue); applyPalette(this.palette); }
  setArtwork(url: string) {
    const generation = ++this.generation;
    if (this.image) this.image.onload = this.image.onerror = null;
    this.image = null;
    if (!url) { this.fadeTo(210); return; }
    const image = new Image(); this.image = image;
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (generation !== this.generation) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 40, 40);
        const pixels = context.getImageData(0, 0, 40, 40).data;
        this.fadeTo(artworkHue(pixels) ?? 210, artworkPalette(pixels));
      } catch { this.fadeTo(210); }
      this.image = null;
    };
    image.onerror = () => { if (generation === this.generation) { this.image = null; this.fadeTo(210); } };
    image.src = url;
  }
  private sample(now: number) {
    if (!this.transition) return;
    const progress = (now - this.transition.start) / 900;
    this.hue = hueAt(this.transition.from, this.transition.to, progress);
    this.apply(this.hue);
    if (this.paletteTransition) { this.palette = paletteAt(this.paletteTransition.from, this.paletteTransition.to, progress); this.applyPalette(this.palette); }
    if (progress >= 1) this.transition = null;
  }
  private fadeTo(hue: number, colors = defaultPalette) {
    this.sample(performance.now());
    cancelAnimationFrame(this.frame); this.frame = 0;
    if (this.motion.matches) { this.transition = null; this.hue = hue; this.apply(hue); this.palette = [...colors]; this.paletteTransition = null; this.applyPalette(this.palette); return; }
    this.paletteTransition = { from: [...this.palette], to: [...colors] };
    this.transition = { from: this.hue, to: hue, start: performance.now() };
    this.frame = requestAnimationFrame(this.tick);
  }
  private tick = () => {
    this.frame = 0;
    this.sample(performance.now());
    if (this.transition) this.frame = requestAnimationFrame(this.tick);
  };
  destroy() {
    this.generation++;
    if (this.image) this.image.onload = this.image.onerror = null;
    this.image = null; this.transition = null; this.paletteTransition = null;
    cancelAnimationFrame(this.frame); this.frame = 0;
  }
}

/** Paper's color parser accepts hex; CSS uses the same HSL color directly. */
export function accentShaderColor(hue: number): string {
  const c = (1 - Math.abs(2 * .72 - 1)) * .55;
  const h = ((hue % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs(h % 2 - 1));
  const rgb = h < 1 ? [c,x,0] : h < 2 ? [x,c,0] : h < 3 ? [0,c,x] : h < 4 ? [0,x,c] : h < 5 ? [x,0,c] : [c,0,x];
  const m = .72 - c / 2;
  return '#' + rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('');
}
