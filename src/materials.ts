import { createShaderRoot, unmountShader } from './shader-lifecycle';
import { createElement, Fragment } from 'react';
import type { Root } from 'react-dom/client';
import { Heatmap, LiquidMetal } from '@paper-design/shaders-react';

const coverShape = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="12" fill="black"/></svg>')}`;

/** Official Paper components own sizing, mask preprocessing and GL lifecycles. */
export class Materials {
  private roots: { metal: Root; heat: Root | null } | null = null;
  private active = false;
  private playing = false;
  private level = 0;
  private onset = 0;
  private speedMul = 1;
  private heatSpeedMul = 1;
  private heatResponse = 1;
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
  setSettings(materialSpeed: number, heatSpeed: number, heatEnabled: boolean, heatResponse: number) {
    this.heatEnabled = heatEnabled;
    this.heatResponse = Math.max(0, heatResponse);
    this.speedMul = Math.max(0, materialSpeed);
    this.heatSpeedMul = Math.max(0, heatSpeed);
    this.render();
  }
  private render() {
    if (this.disposed) return;
    if (!this.roots && this.active && typeof WebGL2RenderingContext !== 'undefined') {
      this.roots = { metal: createShaderRoot(this.metal), heat: null };
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
    const showHeat = this.heatEnabled && !!this.artwork;
    this.heat.hidden = !showHeat;
    if (!showHeat) { unmountShader(this.roots.heat, this.heat); this.roots.heat = null; return; }
    this.roots.heat ??= createShaderRoot(this.heat);
    const moving = this.active && this.playing && !document.hidden && !this.motion.matches;
    // Restore the small, filled backing surface. The jacket is no longer a shader input.
    const common = {
      width: '100%', height: '100%', image: coverShape,
      scale: 1, fit: 'contain' as const,
      minPixelRatio: 1, maxPixelCount: 131072,
    };
    const reach = this.active && this.playing && !document.hidden && this.level > 0 && this.heatResponse > 0 ? Math.max(-18, Math.min(110, this.level * 420 * this.heatResponse - 12)) : -18;
    const reveal = `linear-gradient(to bottom, #000 ${reach}%, transparent ${reach + 18}%)`;
    this.roots.heat.render(showHeat ? createElement(Fragment, null,
      // Keep Paper's original cool wave animation running independently of audio.
      createElement(Heatmap, { ...common, key: 'cool', className: 'heatmap-surface heatmap-cool',
        colorBack: '#11206a', colors: ['#11206a', '#1f3ba2', '#2f63e7', '#6bd7ff'],
        speed: moving ? this.heatSpeedMul : 0,
      }),
      // Restore the sound-driven thermal front over the same official material.
      createElement(Heatmap, { ...common, key: 'warm', className: 'heatmap-surface heatmap-warm',
        colorBack: '#391515', colors: ['#661e18', '#ff4c00', '#ff991e', '#ffe679'],
        speed: dynamics * this.heatSpeedMul,
        style: { maskImage: reveal, WebkitMaskImage: reveal },
      }),
    ) : null);
  }

  destroy() {
    this.disposed = true;
    this.motion.removeEventListener('change', this.changed);
    document.removeEventListener('visibilitychange', this.changed);
    if (this.roots) { unmountShader(this.roots.metal, this.metal); unmountShader(this.roots.heat, this.heat); } this.roots = null;
  }
}
