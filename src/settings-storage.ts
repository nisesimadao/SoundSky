import { loadSavedSettings } from './settings';
import { defaultSettings, type SoundSkySettings } from './types';
import { SETTINGS_KEY as key, SETTINGS_REVISION_KEY, type SettingsReply } from './settings-protocol';

export type SaveState = 'saved' | 'saving' | 'error';
/** Merge local edits with versioned worker snapshots, including out-of-order replies. */
export class SettingsStorage {
  private value = { ...defaultSettings };
  private remote: SoundSkySettings | null = null;
  private remoteRevision = -1;
  private editRevision = 0;
  private dirty = new Map<keyof SoundSkySettings, number>();
  private ready = false;
  private delivered = false;
  private pending = false;
  private writing = false;
  private disposed = false;
  private events = new AbortController();
  private storage = globalThis.chrome?.storage;
  private runtime = globalThis.chrome?.runtime;
  constructor(private changed: (settings: SoundSkySettings) => void, private status: (state: SaveState) => void) {
    this.storage?.onChanged?.addListener(this.onChanged);
    window.addEventListener('storage', event => {
      if (event.key !== key || event.storageArea !== localStorage) return;
      try { this.receive(event.newValue ? JSON.parse(event.newValue) : undefined); } catch { /* malformed external data */ }
    }, { signal: this.events.signal });
  }
  async load() {
    let saved: unknown, revision: unknown = 0, failed = false;
    try {
      if (this.storage?.local) {
        const result = await this.storage.local.get([key,SETTINGS_REVISION_KEY]);
        saved = result[key]; revision = result[SETTINGS_REVISION_KEY] ?? 0;
      } else saved = JSON.parse(localStorage.getItem(key) || 'null');
    } catch { failed = true; }
    if (this.disposed) return;
    this.ready = true; this.receive(saved,revision);
    if (failed) this.status('error');
    if (this.pending) void this.flush();
  }
  save(settings: SoundSkySettings, replace = false) {
    if (this.disposed) return;
    const next = loadSavedSettings(settings);
    for (const field of Object.keys(next) as (keyof SoundSkySettings)[]) {
      if (replace || next[field] !== this.value[field]) this.dirty.set(field,++this.editRevision);
    }
    this.value = next;
    if (!this.dirty.size) return;
    this.pending = true; this.status('saving');
    if (this.ready) void this.flush();
  }
  private onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    const revision = changes[SETTINGS_REVISION_KEY]?.newValue;
    if (changes[key]) this.receive(changes[key].newValue,revision);
  };
  private receive(saved: unknown, revision?: unknown) {
    if (this.disposed) return;
    // A newer storage event can arrive before an older message response.
    const stamp=typeof revision==='number'&&Number.isSafeInteger(revision)&&revision>=0?revision:null;
    if (stamp===null || stamp >= this.remoteRevision) {
      this.remote = loadSavedSettings(saved);
      if (stamp!==null) this.remoteRevision = stamp;
    }
    if (!this.ready) return;
    const next = { ...(this.remote ?? defaultSettings) };
    for (const field of this.dirty.keys()) Object.assign(next,{ [field]: this.value[field] });
    if (!this.delivered || JSON.stringify(next) !== JSON.stringify(this.value)) {
      this.delivered=true;this.value = next; this.changed({ ...next });
    }
    if (!this.writing && !this.pending && !this.dirty.size) this.status('saved');
  }
  private async flush() {
    if (this.writing || !this.ready || this.disposed) return;
    this.writing = true;
    try {
      while (this.pending && !this.disposed) {
        this.pending = false;
        const edits = new Map(this.dirty), snapshot = { ...this.value };
        if (!edits.size) continue;
        if (this.runtime?.id && this.runtime.sendMessage) {
          const patch = Object.fromEntries([...edits.keys()].map(field=>[field,snapshot[field]]));
          const reply: SettingsReply = await this.runtime.sendMessage({ type:'soundsky:save-settings',patch });
          if (!reply?.ok) throw new Error('Settings write was not acknowledged');
          if (this.disposed) return;
          for (const [field,revision] of edits) if (this.dirty.get(field)===revision) this.dirty.delete(field);
          this.receive(reply.settings,reply.revision);
        } else {
          // The local fixture has no extension worker. Its storage remains synchronous.
          if (this.storage?.local) await this.storage.local.set({ [key]: snapshot });
          else localStorage.setItem(key, JSON.stringify(snapshot));
          if (this.disposed) return;
          for (const [field,revision] of edits) if (this.dirty.get(field)===revision) this.dirty.delete(field);
          this.receive(snapshot);
        }
      }
      if (!this.disposed) this.status('saved');
    } catch {
      this.pending = false;
      if (!this.disposed) this.status('error');
    } finally { this.writing = false; }
  }
  destroy() {
    this.disposed = true; this.events.abort();
    try { this.storage?.onChanged?.removeListener(this.onChanged); } catch { /* extension reloaded */ }
  }
}
