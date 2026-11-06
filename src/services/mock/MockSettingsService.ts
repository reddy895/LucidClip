import { ISettingsService, IStorageService, StorageStats } from '../contracts';
import { AppSettings } from '@/types';
import { clipboardService } from './MockClipboardService';
import { screenshotService } from './MockScreenshotService';

const SETTINGS_STORAGE_KEY = 'lucidclip_app_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    launchOnStartup: true,
    minimizeToTray: true,
    theme: 'dark',
    defaultView: 'all',
  },
  clipboard: {
    monitoringEnabled: true,
    maxHistoryItems: 500,
    autoCleanupDays: 30,
    ignoreDuplicates: true,
    captureImages: true,
    excludedApps: ['1Password.exe', 'KeePass.exe', 'Bitwarden.exe', 'KeePassXC.exe'],
  },
  screenshots: {
    saveDirectory: 'C:\\Users\\User\\Pictures\\LucidClip',
    retentionDays: 60,
    enableOcr: true,
    ocrLanguage: 'en-US',
    thumbnailQuality: 'high',
  },
  shortcuts: {
    quickAccess: 'Alt+Space',
    captureFullscreen: 'PrintScreen',
    captureRegion: 'Ctrl+Shift+S',
  },
  privacy: {
    pauseMonitoring: false,
    excludePasswordManagers: true,
    autoPurgeSensitive: false,
  },
};

export class MockSettingsService implements ISettingsService, IStorageService {
  private settings: AppSettings = DEFAULT_SETTINGS;
  private isLoaded = false;

  private load(): AppSettings {
    if (this.isLoaded) return this.settings;

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        this.isLoaded = true;
        return this.settings;
      }
    } catch (e) {
      console.warn('Failed to parse settings from localStorage', e);
    }

    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    this.isLoaded = true;
    return this.settings;
  }

  private save(): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
  }

  async getSettings(): Promise<AppSettings> {
    return Promise.resolve({ ...this.load() });
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = this.load();
    this.settings = {
      general: { ...current.general, ...(partial.general || {}) },
      clipboard: { ...current.clipboard, ...(partial.clipboard || {}) },
      screenshots: { ...current.screenshots, ...(partial.screenshots || {}) },
      shortcuts: { ...current.shortcuts, ...(partial.shortcuts || {}) },
      privacy: { ...current.privacy, ...(partial.privacy || {}) },
    };
    this.save();
    return Promise.resolve({ ...this.settings });
  }

  async resetToDefaults(): Promise<AppSettings> {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return Promise.resolve({ ...this.settings });
  }

  async getStorageUsage(): Promise<StorageStats> {
    const [clips, shots] = await Promise.all([
      clipboardService.getHistory(),
      screenshotService.getScreenshots(),
    ]);

    const clipBytes = clips.reduce((sum, c) => sum + c.charCount * 2 + 128, 0);
    const shotBytes = shots.reduce((sum, s) => sum + s.fileSizeBytes, 0);

    return Promise.resolve({
      dbSizeBytes: clipBytes + 4096 * 4, // simulated SQLite DB header + page size
      screenshotStorageBytes: shotBytes,
      entryCount: clips.length,
      screenshotCount: shots.length,
    });
  }
}

export const settingsService = new MockSettingsService();
export const storageService = settingsService;

