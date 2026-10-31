import type { SoundSkySettings } from './types';

export const SETTINGS_KEY = 'soundsky:settings';
export const SETTINGS_REVISION_KEY = 'soundsky:settings-revision';
export type SettingsReply = { ok: true; settings: SoundSkySettings; revision: number } | { ok: false };

