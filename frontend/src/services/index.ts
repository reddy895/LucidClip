export * from './contracts';
export * from './mock';
export * from './tauri';

import {
  MockClipboardService,
  MockScreenshotService,
  MockSettingsService,
  storageService as mockStorageService,
} from './mock';
import {
  TauriClipboardService,
  TauriScreenshotService,
  TauriSettingsService,
  TauriStorageService,
} from './tauri';
import { HistorySearchService } from './search/HistorySearchService';

// Detect whether running in desktop Tauri webview or standard browser
export const isTauri = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
};

export const clipboardService = isTauri()
  ? new TauriClipboardService()
  : new MockClipboardService();

export const screenshotService = isTauri()
  ? new TauriScreenshotService()
  : new MockScreenshotService();

export const settingsService = isTauri()
  ? new TauriSettingsService()
  : new MockSettingsService();

export const storageService = isTauri()
  ? new TauriStorageService()
  : mockStorageService;

export const searchService = new HistorySearchService(
  clipboardService,
  screenshotService
);

export { pasteService } from './tauri/TauriPasteService';
