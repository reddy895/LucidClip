import { IClipboardService, IScreenshotService, ISearchService } from '../contracts';
import { HistoryItem, SearchQuery } from '@/types';
import { filterHistory } from '@/utils/search';

type ClipboardSource = Pick<IClipboardService, 'getHistory'>;
type ScreenshotSource = Pick<IScreenshotService, 'getScreenshots'>;

/**
 * Search implementation backed by the active data services.
 * In the desktop build these resolve to the Tauri IPC adapters, ensuring the
 * unified history feed only ever searches the local SQLite store.
 */
export class HistorySearchService implements ISearchService {
  constructor(
    private readonly clipboard: ClipboardSource,
    private readonly screenshots: ScreenshotSource
  ) {}

  async search(query: SearchQuery): Promise<HistoryItem[]> {
    const [clipList, shotList] = await Promise.all([
      this.clipboard.getHistory(),
      this.screenshots.getScreenshots(),
    ]);

    const unified: HistoryItem[] = [
      ...clipList.map((c) => ({ kind: 'clipboard' as const, ...c })),
      ...shotList.map((s) => ({ kind: 'screenshot' as const, ...s })),
    ];

    return filterHistory(unified, query);
  }
}
