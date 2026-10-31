import { loadSavedSettings } from './settings';
import { defaultSettings, type SoundSkySettings } from './types';

export type SaveState = 'saved' | 'saving' | 'error';
const key = 'soundsky:settings';
/** Serialize saves and merge edits made before Chrome finishes reading preferences. */
export class SettingsStorage {
  private value = { ...defaultSettings };
  private dirty = new Set<keyof SoundSkySettings>();
  private ready = false;
  private pending = false;
  private writing = false;
  private disposed = false;
  private events = new AbortController();
  private storage = globalThis.chrome?.storage;
  constructor(private changed: (settings: SoundSkySettings) => void, private status: (state: SaveState) => void) {
    this.storage?.onChanged?.addListener(this.onChanged);
    window.addEventListener('storage', event => {
      if (event.key !== key || event.storageArea !== localStorage) return;
      try { this.receive(event.newValue ? JSON.parse(event.newValue) : undefined); } catch { /* malformed external data */ }
    }, { signal: this.events.signal });
  }
  async load() {
    let saved: unknown;
    try {
      saved = this.storage?.local ? (await this.storage.local.get(key))[key] : JSON.parse(localStorage.getItem(key) || 'null');
    } catch { if (!this.disposed) this.status('error'); }
    if (this.disposed) return;
    const loaded = loadSavedSettings(saved);
    for (const field of this.dirty) Object.assign(loaded, { [field]: this.value[field] });
    this.value = loaded; this.ready = true; this.changed({ ...loaded });
    if (this.pending) void this.flush();
  }
  save(settings: SoundSkySettings, replace = false) {
    if (this.disposed) return;
    const next = loadSavedSettings(settings);
    for (const field of Object.keys(next) as (keyof SoundSkySettings)[]) {
      if (replace || next[field] !== this.value[field]) this.dirty.add(field);
    }
    this.value = next; this.pending = true; this.status('saving');
    if (this.ready) void this.flush();
  }
  private onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[key]) this.receive(changes[key].newValue);
  };
  private receive(saved: unknown) {
    // Local edits remain authoritative while their serialized write is pending.
    if (this.disposed || !this.ready || this.pending || this.writing) return;
    const next = loadSavedSettings(saved);
    if (JSON.stringify(next) === JSON.stringify(this.value)) return;
    this.value = next; this.changed({ ...next }); this.status('saved');
  }
  private async flush() {
    if (this.writing || !this.ready || this.disposed) return;
    this.writing = true;
    try {
      while (this.pending && !this.disposed) {
        this.pending = false;
        const snapshot = { ...this.value };
        if (this.storage?.local) await this.storage.local.set({ [key]: snapshot });
        else localStorage.setItem(key, JSON.stringify(snapshot));
      }
      if (!this.disposed) { this.dirty.clear(); this.status('saved'); }
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
