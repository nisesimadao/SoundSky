import { accentShaderColor } from './accent';
export function seekMaterial(hue: number, speed: number) {
  return { width: '100%', height: '100%', colors: [-14, 0, 14, 0].map(offset => accentShaderColor((hue + offset + 360) % 360)),
    distortion: .5, swirl: .1, grainMixer: 0, grainOverlay: 0, speed, scale: 1, minPixelRatio: 1, maxPixelCount: 8192 };
}
