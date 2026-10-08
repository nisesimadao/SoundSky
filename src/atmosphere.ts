import { unmountShader } from './shader-lifecycle';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { seekMaterial } from './seek-material';
import { defaultPalette } from './artwork-palette';
import { GemSmoke, MeshGradient } from '@paper-design/shaders-react';

/** The decorative Paper backdrop responds to audio separately from the fixed cover materials. */
export class Atmosphere {
  private roots: { background: Root; console: Root; seek: Root } | null = null;
  private active = false;
  private playing = false;
  private disposed = false;
  private flowSpeed = .1;
  private glow = 1;
  private consoleSpeed = .2;
  private seekSpeed = .3;
  private accentHue = 210;
  private palette = [...defaultPalette];
  private level = 0;
  private onset = 0;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private changed = () => this.render();

  constructor(private background: HTMLElement, private console: HTMLElement, private seek: HTMLElement) {
    document.addEventListener('visibilitychange', this.changed);
    this.motion.addEventListener('change', this.changed);
  }
  setActive(active: boolean) { if (active !== this.active) { this.active = active; this.render(); } }
  setPlaying(playing: boolean) { if (playing !== this.playing) { this.playing = playing; this.render(); } }
  setSettings(speed: number, glow: number, consoleSpeed: number, seekSpeed: number) {
    this.flowSpeed = Math.max(0, speed); this.glow = Math.max(0, glow);
    this.consoleSpeed = Math.max(0, consoleSpeed); this.seekSpeed = Math.max(0, seekSpeed);
    this.render();
  }
  setPalette(colors: string[]) { this.palette = [...colors]; this.renderBackground(); }
  setAccent(hue: number) { this.accentHue = hue; this.renderSeek(); }
  setLevel(level: number, onset = 0) {
    const next = Number.isFinite(level) ? Math.max(0, level) : 0;
    const attack = Number.isFinite(onset) ? Math.max(0, onset) : 0;
    if (next === this.level && attack === this.onset) return;
    this.level = next; this.onset = attack;
    this.render();
  }

  private render() {
    if (this.disposed) return;
    const audible = this.active && this.playing && !document.hidden;
    const level = audible ? this.level : 0;
    // Keep a dark resting surface; louder audio lifts the same material into view.
    const intensity = Math.min(.84, (.14 + level * 1.8) * this.glow);
    this.background.style.setProperty('--ambient-intensity', String(intensity));
    if (!this.roots && this.active && typeof WebGL2RenderingContext !== 'undefined') {
      this.roots = { background: createRoot(this.background), console: createRoot(this.console), seek: createRoot(this.seek) };
    }
    if (!this.roots) return;
    const moving = audible && !this.motion.matches;
    this.renderBackground();
    this.roots.console.render(createElement(GemSmoke, {
      width: '100%', height: '100%', shape: 'none',
      colors: ['#0d141b', '#263139'], colorBack: '#090d11', colorInner: '#121a20',
      innerDistortion: .8, outerDistortion: .6, outerGlow: .55, innerGlow: 1,
      offset: 0, angle: 0, size: .8, scale: 1,
      speed: moving ? this.consoleSpeed : 0, minPixelRatio: 1, maxPixelCount: 16384,
    }));
    this.renderSeek();
  }
  private renderBackground() {
    if (!this.roots || this.disposed) return;
    const moving = this.active && this.playing && !document.hidden && !this.motion.matches;
    const level = moving ? this.level : 0;
    this.roots.background.render(createElement(MeshGradient, {
      width: '100%', height: '100%', colors: this.palette,
      distortion: .65, swirl: .25, grainMixer: .02, grainOverlay: .018,
      speed: moving ? this.flowSpeed * (.15 + level * 4 + this.onset * 8) : 0,
      frame: 18000, scale: 1.25, minPixelRatio: 1, maxPixelCount: 230400,
    }));
  }
  private renderSeek() {
    if (!this.roots || this.disposed) return;
    const moving = this.active && this.playing && !document.hidden && !this.motion.matches;
    const level = moving ? this.level : 0;
    this.roots.seek.render(createElement(MeshGradient, seekMaterial(this.accentHue, moving ? this.seekSpeed * (.5 + level) : 0)));
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.changed);
    this.motion.removeEventListener('change', this.changed);
    if (this.roots) { unmountShader(this.roots.background, this.background); unmountShader(this.roots.console, this.console); unmountShader(this.roots.seek, this.seek); } this.roots = null;
  }
}
