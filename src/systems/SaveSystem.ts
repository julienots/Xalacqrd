// Versioned save system with checksum, backup slot and pluggable storage
// adapters (local now, cloud-ready later via the same interface).

import { hashString } from '../core/rng';

export interface StorageAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  async read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
  async write(key: string, value: string) { localStorage.setItem(key, value); }
  async remove(key: string) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
}

export class MemoryAdapter implements StorageAdapter {
  data = new Map<string, string>();
  async read(key: string) { return this.data.get(key) ?? null; }
  async write(key: string, value: string) { this.data.set(key, value); }
  async remove(key: string) { this.data.delete(key); }
}

/** Placeholder for a future cloud backend: implement read/write against an API. */
export interface CloudSyncProvider {
  pull(): Promise<{ payload: string; updatedAt: number } | null>;
  push(payload: string, updatedAt: number): Promise<void>;
}

interface Envelope { v: number; t: number; sum: string; data: unknown }

export const SAVE_KEY = 'xalacards.save';
export const SAVE_VERSION = 1;

export class SaveSystem<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  lastSavedAt = 0;
  constructor(private storage: StorageAdapter, private migrate: (data: any, fromVersion: number) => T, public cloud?: CloudSyncProvider) {}

  private wrap(data: T): string {
    const json = JSON.stringify(data);
    const env: Envelope = { v: SAVE_VERSION, t: Date.now(), sum: hashString(json).toString(36), data };
    return JSON.stringify(env);
  }

  private unwrap(raw: string | null): T | null {
    if (!raw) return null;
    try {
      const env = JSON.parse(raw) as Envelope;
      const json = JSON.stringify(env.data);
      if (hashString(json).toString(36) !== env.sum) { console.warn('[Save] checksum mismatch'); return null; }
      return this.migrate(env.data, env.v);
    } catch (e) {
      console.warn('[Save] corrupt save', e);
      return null;
    }
  }

  async load(): Promise<T | null> {
    const main = this.unwrap(await this.storage.read(SAVE_KEY));
    if (main) return main;
    const backup = this.unwrap(await this.storage.read(SAVE_KEY + '.bak'));
    if (backup) console.warn('[Save] restored from backup');
    return backup;
  }

  async save(data: T): Promise<void> {
    const payload = this.wrap(data);
    const prev = await this.storage.read(SAVE_KEY);
    if (prev) await this.storage.write(SAVE_KEY + '.bak', prev);
    await this.storage.write(SAVE_KEY, payload);
    this.lastSavedAt = Date.now();
    if (this.cloud) this.cloud.push(payload, this.lastSavedAt).catch((e) => console.warn('[Save] cloud push failed', e));
  }

  /** Debounced save, used after every state change. */
  schedule(data: () => T, delay = 400) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.save(data()).catch((e) => console.error('[Save]', e)); }, delay);
  }

  async flush(data: T) {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    await this.save(data);
  }

  async wipe() {
    await this.storage.remove(SAVE_KEY);
    await this.storage.remove(SAVE_KEY + '.bak');
  }

  exportString(data: T): string { return btoa(unescape(encodeURIComponent(this.wrap(data)))); }
  importString(s: string): T | null {
    try { return this.unwrap(decodeURIComponent(escape(atob(s.trim())))); } catch { return null; }
  }
}
