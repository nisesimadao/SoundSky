import { createElement, Fragment } from 'react';
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
  private artwork = '';
  private changed = () => this.render();
  constructor(private metal: HTMLElement, private heat: HTMLElement) {
    this.motion.addEventListener('change', this.changed);
    document.addEventListener('visibilitychange', this.changed);
  }
  setActive(active: boolean) { this.active = active; this.render(); }
  setArtwork(url: string) { if (this.artwork === url) return; this.artwork = url; this.render(); }
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
  private render() {
    if (this.disposed) return;
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
    // Both official shaders receive the jacket itself. No CSS mask, clipping,
    // custom fragment or reset of the native animation when an audio hit arrives.
    const showHeat = this.heatEnabled && !!this.artwork;
    this.heat.hidden = !showHeat;
    const moving = this.active && this.playing && !document.hidden && !this.motion.matches;
    const common = {
      width: '100%', height: '100%', image: this.artwork, colorBack: '#00000000',
      scale: 1, fit: 'contain' as const, contour: 0, noise: 0,
      speed: moving ? this.heatSpeedMul : 0, minPixelRatio: 1, maxPixelCount: 131072,
    };
    this.roots.heat.render(showHeat ? createElement(Fragment, null,
      // Native outer waves: fixed parameters keep their timing independent of sound.
      createElement(Heatmap, { ...common, key: 'cool', className: 'heatmap-surface heatmap-cool',
        innerGlow: 0, outerGlow: .5,
        colors: ['#11206a00', '#1f3ba2', '#2f63e7', '#6bd7ff'],
      }),
      // Sound changes heat inside the image; the shader still animates its own waves.
      createElement(Heatmap, { ...common, key: 'warm', className: 'heatmap-surface heatmap-warm',
        innerGlow: this.active && this.playing && !document.hidden ? Math.min(1, this.level * 3 + this.onset * 5) : 0,
        outerGlow: 0, colors: ['#ffe67900', '#ffe679', '#ff991e', '#ff4c00'],
      }),
    ) : null);
  }

  destroy() {
    this.disposed = true;
    this.motion.removeEventListener('change', this.changed);
    document.removeEventListener('visibilitychange', this.changed);
    this.roots?.metal.unmount(); this.roots?.heat.unmount(); this.roots = null;
  }
}
