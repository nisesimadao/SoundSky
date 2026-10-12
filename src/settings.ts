import { defaultSettings, type SoundSkySettings } from './types';
export const settingLimits = {
  pulseMax: [0, .3], pulseSensitivity: [.2, 12], ambientSpeed: [0, 8],
  materialSpeed: [0, 8], heatSpeed: [0, 8], heatResponse: [0, 3],
  ambientGlow: [0, 2], consoleSpeed: [0, 2], seekSpeed: [0, 3], sceneSway: [0, 1], prefetchCount: [0, 3],
} as const;
/** Accept only known, finite settings; old combined speed seeds Heatmap speed. */
export function loadSavedSettings(saved: unknown): SoundSkySettings {
  const settings = { ...defaultSettings };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return settings;
  const values = saved as Record<string, unknown>;
  for (const key of Object.keys(settingLimits) as (keyof typeof settingLimits)[]) {
    const value = key === 'heatSpeed' ? values.heatSpeed ?? values.materialSpeed : values[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const [min, max] = settingLimits[key];
    settings[key] = Math.max(min, Math.min(max, value));
  }
  settings.prefetchCount=Math.round(settings.prefetchCount);
  if (typeof values.prefetchSeconds==='number' && [0,15,30,60,120].includes(values.prefetchSeconds)) settings.prefetchSeconds=values.prefetchSeconds;
  if (typeof values.heatEnabled === 'boolean') settings.heatEnabled = values.heatEnabled;
  if (typeof values.modernSoundCloud === 'boolean') settings.modernSoundCloud = values.modernSoundCloud;
  if (typeof values.turntable === 'boolean') settings.turntable = values.turntable;
  return settings;
}
