import { HistorySearchService } from '../search/HistorySearchService';
import { clipboardService } from './MockClipboardService';
import { screenshotService } from './MockScreenshotService';

/**
 * Browser-only search adapter backed by the mock clipboard and screenshot
 * services. The desktop runtime uses HistorySearchService with Tauri adapters.
 */
export class MockSearchService extends HistorySearchService {
  constructor() {
    super(clipboardService, screenshotService);
  }
}

export const searchService = new MockSearchService();
