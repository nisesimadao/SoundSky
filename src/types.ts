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
  canMute: boolean;
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
  modernSoundCloud: boolean;
  /** Which native SoundCloud surfaces receive SoundSky finishing details. */
  siteHeader: boolean;
  siteArtwork: boolean;
  siteQueue: boolean;
  siteTransport: boolean;
  siteBackground: boolean;
  siteWide: boolean;
  /** Site controls: understated, standard, or strongly rounded. */
  siteCorners: 'subtle' | 'soft' | 'round';
  /** Artwork-driven or fixed accent colour. */
  siteAccent: 'artwork' | 'sky' | 'warm';
  /** Strength of the decorative site-only background canvas. */
  siteBackdropOpacity: number;
  /** Auto-hide transport chrome during pointer-based listening, opt-in. */
  focusMode: boolean;
  /** Record-style pitch glide on manual play/pause, opt-in. */
  turntable: boolean;
  turntableSpeed: number;
  /** Upcoming audio tracks to prepare in memory, 0 off through 3. */
  prefetchCount: number;
  /** Per-track prepared duration in seconds; 0 means the whole track. */
  prefetchSeconds: number;
  /** How far sound drives the red thermal front (0–3, default 1). */
  heatResponse: number;
  /** Audio-reactive backdrop light multiplier (0–2). */
  ambientGlow: number;
  /** GemSmoke motion in the transport housing (0–2). */
  consoleSpeed: number;
  /** Smooth light motion in the seek fill (0–3). */
  seekSpeed: number;
  /** Whole-scene random drift with bass-driven acceleration, 0 off to 1 (up to about 14px). */
  sceneSway: number;
}

export const defaultSettings: SoundSkySettings = {
  pulseMax: 0.15,
  pulseSensitivity: 3.0,
  ambientSpeed: 0.1,
  materialSpeed: 2.8,
  heatSpeed: 1,
  heatEnabled: true,
  modernSoundCloud: false,
  siteHeader: true,
  siteArtwork: true,
  siteQueue: true,
  siteTransport: true,
  siteBackground: true,
  siteWide: true,
  siteCorners: 'soft',
  siteAccent: 'artwork',
  siteBackdropOpacity: .3,
  focusMode: false,
  turntable: false,
  turntableSpeed: 1,
  prefetchCount: 3,
  prefetchSeconds: 0,
  heatResponse: 1,
  ambientGlow: 1,
  consoleSpeed: .2,
  seekSpeed: .3,
  sceneSway: 0,
};
