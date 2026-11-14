export interface GeneralSettings {
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  theme: 'dark';
  defaultView: 'all' | 'clipboard' | 'screenshots' | 'pinned' | 'favorites';
  popupPosition: 'center' | 'cursor';
}

export interface ClipboardSettings {
  monitoringEnabled: boolean;
  maxHistoryItems: number;
  autoCleanupDays: number;
  ignoreDuplicates: boolean;
  captureImages: boolean;
  excludedApps: string[];
}

export interface ScreenshotSettings {
  saveDirectory: string;
  retentionDays: number;
  enableOcr: boolean;
  ocrLanguage: string;
  thumbnailQuality: 'standard' | 'high';
}

export interface ShortcutSettings {
  quickAccess: string;
  captureFullscreen: string;
  captureRegion: string;
  historyPopup: string;
}

export interface PrivacySettings {
  pauseMonitoring: boolean;
  excludePasswordManagers: boolean;
  autoPurgeSensitive: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  clipboard: ClipboardSettings;
  screenshots: ScreenshotSettings;
  shortcuts: ShortcutSettings;
  privacy: PrivacySettings;
}

