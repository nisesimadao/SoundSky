export interface Track {
  key: string;
  title: string;
  artist: string;
  artistKey: string;
  artwork: string;
}
export type Action = 'like' | 'repost' | 'follow';
export interface ActionState { available: boolean; selected: boolean | null; }
export interface PlayerState {
  track: Track;
  playing: boolean;
  current: number;
  duration: number;
  volume: number;
  muted: boolean;
  canPlay: boolean;
  canPrevious: boolean;
  canNext: boolean;
  canSeek: boolean;
  canVolume: boolean;
  actions: Record<Action, ActionState>;
}

export interface SoundSkySettings {
  /** Maximum artwork scale expansion (0–0.30, default 0.15 = 15%). */
  pulseMax: number;
  /** Multiplier for beat-pulse sensitivity (0.2–12.0, default 3.0). */
  pulseSensitivity: number;
  /** Ambient background flow speed multiplier (0–8.0, default 0.1). */
  ambientSpeed: number;
  /** Liquid-metal animation speed multiplier (0–8.0, default 2.8). */
  materialSpeed: number;
  /** Official Heatmap animation speed multiplier (0–8, default 1). */
  heatSpeed: number;
  heatEnabled: boolean;
  /** Audio-reactive backdrop light multiplier (0–2). */
  ambientGlow: number;
  /** GemSmoke motion in the transport housing (0–2). */
  consoleSpeed: number;
  /** Smooth light motion in the seek fill (0–3). */
  seekSpeed: number;
}

export const defaultSettings: SoundSkySettings = {
  pulseMax: 0.15,
  pulseSensitivity: 3.0,
  ambientSpeed: 0.1,
  materialSpeed: 2.8,
  heatSpeed: 1,
  heatEnabled: true,
  ambientGlow: 1,
  consoleSpeed: .2,
  seekSpeed: .3,
};
