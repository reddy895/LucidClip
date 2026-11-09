//! Tauri Native Settings Service Implementation

import { invoke } from '@tauri-apps/api/core';
import { ISettingsService } from '../contracts';
import { DEFAULT_SETTINGS } from '../mock/MockSettingsService';
import { AppSettings } from '@/types';

export class TauriSettingsService implements ISettingsService {
  private cache: AppSettings = DEFAULT_SETTINGS;

  async getSettings(): Promise<AppSettings> {
    const records = await invoke<Record<string, string>>('get_settings');
    if (records && Object.keys(records).length > 0) {
      this.cache = {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(records['app_settings'] || '{}'),
      };
    }
    return this.cache;
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const next: AppSettings = {
      ...this.cache,
      ...partial,
      general: { ...this.cache.general, ...(partial.general || {}) },
      clipboard: { ...this.cache.clipboard, ...(partial.clipboard || {}) },
      screenshots: { ...this.cache.screenshots, ...(partial.screenshots || {}) },
      shortcuts: { ...this.cache.shortcuts, ...(partial.shortcuts || {}) },
      privacy: { ...this.cache.privacy, ...(partial.privacy || {}) },
    };

    await invoke('update_setting', {
      key: 'app_settings',
      value: JSON.stringify(next),
    });

    this.cache = next;
    return this.cache;
  }

  async resetToDefaults(): Promise<AppSettings> {
    this.cache = { ...DEFAULT_SETTINGS };
    await invoke('update_setting', {
      key: 'app_settings',
      value: JSON.stringify(this.cache),
    });
    return this.cache;
  }
}
