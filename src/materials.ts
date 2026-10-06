import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Heatmap, LiquidMetal } from '@paper-design/shaders-react';

/** Official Paper components own sizing, mask preprocessing and GL lifecycles. */
export class Materials {
  private roots: { metal: Root; heat: Root } | null = null;
  private active = false;
  private playing = false;
  private level = 0;
  private onset = 0;
  private speedMul = 1;
  private heatSpeedMul = 1;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private disposed = false;
  private heatEnabled = true;
  private titleImage = '';
  private titleFrame = 0;
  private titleObserver: ResizeObserver;
  private changed = () => this.render();
  private scheduleTitle = () => {
    if (this.disposed || this.titleFrame) return;
    this.titleFrame = requestAnimationFrame(() => { this.titleFrame = 0; this.drawTitle(); });
  };
  constructor(private metal: HTMLElement, private heat: HTMLElement, private title: HTMLElement) {
    this.motion.addEventListener('change', this.changed);
    document.addEventListener('visibilitychange', this.changed);
    this.titleObserver = new ResizeObserver(this.scheduleTitle);
    this.titleObserver.observe(this.title);
    void document.fonts?.ready.then(this.scheduleTitle);
  }
  setActive(active: boolean) { this.active = active; if (active) this.scheduleTitle(); this.render(); }
  setPlaying(playing: boolean) { this.playing = playing; this.render(); }
  setLevel(level: number, onset = 0) {
    const next = Number.isFinite(level) ? Math.max(0, level) : 0;
    const attack = Number.isFinite(onset) ? Math.max(0, onset) : 0;
    if (next === this.level && attack === this.onset) return;
    this.level = next;
    this.onset = attack;
    this.render();
  }
  setSettings(materialSpeed: number, heatSpeed: number, heatEnabled: boolean) {
    this.heatEnabled = heatEnabled;
    this.speedMul = Math.max(0, materialSpeed);
    this.heatSpeedMul = Math.max(0, heatSpeed);
    this.render();
  }
  setTitle() { this.scheduleTitle(); }
  private drawTitle() {
    const box = this.title.getBoundingClientRect();
    const text = this.title.firstChild;
    if (!text || !box.width || !box.height || this.disposed) return;
    const side = Math.ceil(Math.max(box.width, box.height) + 32);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const style = getComputedStyle(this.title);
    ctx.scale(2, 2);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = '#000';
    const left = (side - box.width) / 2, top = (side - box.height) / 2;
    const range = document.createRange();
    const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.textContent ?? '');
    for (const { segment, index } of segments) {
      range.setStart(text, index); range.setEnd(text, index + segment.length);
      const rect = range.getBoundingClientRect();
      if (rect.top >= box.bottom || rect.right > box.right + 1 || !rect.width) continue;
      const descent = ctx.measureText(segment).fontBoundingBoxDescent || 0;
      ctx.fillText(segment, left + rect.left - box.left, top + rect.bottom - box.top - descent);
    }
    // Give Paper the actual glyph silhouette, rather than masking its rendered surface.
    ctx.globalCompositeOperation = 'source-in'; ctx.fillRect(0, 0, side, side);
    ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, side, side);
    this.heat.style.width = this.heat.style.height = `${side}px`;
    this.heat.style.left = `${-left}px`; this.heat.style.top = `${-top}px`;
    this.titleImage = canvas.toDataURL();
    this.render();
  }
  private render() {
    if (!this.roots && this.active && typeof WebGL2RenderingContext !== 'undefined') {
      this.roots = { metal: createRoot(this.metal), heat: createRoot(this.heat) };
    }
    if (!this.roots) return;
    // Linear raw RMS + spectral attack mapping: no normalization, compression, envelope smoothing or ceiling.
    const dynamics = this.active && this.playing && !document.hidden && !this.motion.matches ? (.6 + this.level * 5 + this.onset * 12) : 0;
    this.roots.metal.render(createElement(LiquidMetal, {
      width: '100%', height: '100%', colorBack: '#aaaaac', colorTint: '#ffffff',
      shape: 'circle', repetition: 2, softness: .1, shiftRed: .3, shiftBlue: .3,
      distortion: .07, contour: .4, angle: 70, speed: dynamics * this.speedMul, scale: 1.12, fit: 'contain',
      minPixelRatio: 1, maxPixelCount: 16384,
    }));
    // The official component owns the original shader, palette and animation.
    const showHeat = this.heatEnabled && !!this.titleImage;
    this.heat.hidden = !showHeat;
    this.title.classList.toggle('has-heatmap', showHeat);
    this.roots.heat.render(showHeat ? createElement(Heatmap, {
      className: 'heatmap-surface', width: '100%', height: '100%', image: this.titleImage, colorBack: '#00000000',
      scale: 1, fit: 'contain', noise: 0,
      colors: ['#11206a00', '#1f3ba2', '#2f63e7', '#6bd7ff', '#ffe679', '#ff991e', '#ff4c00'],
      speed: this.active && this.playing && !document.hidden && !this.motion.matches ? this.heatSpeedMul : 0,
      minPixelRatio: 1, maxPixelCount: 262144,
    }) : null);
  }
  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.titleFrame);
    this.titleObserver.disconnect();
    this.motion.removeEventListener('change', this.changed);
    document.removeEventListener('visibilitychange', this.changed);
    this.roots?.metal.unmount(); this.roots?.heat.unmount(); this.roots = null;
  }
}
