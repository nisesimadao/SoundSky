import { loadSavedSettings } from './settings';
import { defaultSettings, type SoundSkySettings } from './types';
import { SETTINGS_KEY, SETTINGS_REVISION_KEY, type SettingsReply } from './settings-protocol';

/** All tabs submit changed fields to one worker; untouched preferences survive concurrent edits. */
export function installSettingsWriter(api: typeof chrome = chrome) {
  if (!api.runtime?.onMessage || !api.storage?.local) return;
  let queue = Promise.resolve();
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'soundsky:save-settings') return;
    let allowed = false;
    try {
      const url = new URL(sender.url || '');
      allowed = sender.id === api.runtime.id && sender.tab?.id !== undefined && sender.frameId === 0 && url.protocol === 'https:' && /^(www\.)?soundcloud\.com$/.test(url.hostname);
    } catch { /* a worker message needs a known top-level SoundCloud sender */ }
    const reply=(value:SettingsReply)=>{try{respond(value);}catch{/* the originating tab closed */}};
    const patch = message.patch;
    const valid = allowed && patch && typeof patch === 'object' && !Array.isArray(patch) && Object.keys(patch).length > 0 && Object.entries(patch).every(([field,value]) =>
      Object.hasOwn(defaultSettings,field) && typeof value === typeof defaultSettings[field as keyof SoundSkySettings] && loadSavedSettings({[field]:value})[field as keyof SoundSkySettings] === value);
    if (!valid) { reply({ ok: false }); return; }
    const task = queue.then(async () => {
      const saved = await api.storage.local.get([SETTINGS_KEY,SETTINGS_REVISION_KEY]);
      const settings = loadSavedSettings({ ...loadSavedSettings(saved[SETTINGS_KEY]), ...patch });
      const previous = saved[SETTINGS_REVISION_KEY];
      const revision = (typeof previous === 'number' && Number.isSafeInteger(previous) && previous >= 0 ? previous : 0) + 1;
      await api.storage.local.set({ [SETTINGS_KEY]: settings, [SETTINGS_REVISION_KEY]: revision });
      return { ok: true, settings, revision } satisfies SettingsReply;
    });
    queue = task.then(() => {}, () => {});
    void task.then(result => reply(result), () => reply({ ok: false }));
    return true;
  });
}
