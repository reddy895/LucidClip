import { ISearchService } from '../contracts';
import { HistoryItem, SearchQuery } from '@/types';
import { clipboardService } from './MockClipboardService';
import { screenshotService } from './MockScreenshotService';

export class MockSearchService implements ISearchService {
  async search(query: SearchQuery): Promise<HistoryItem[]> {
    const [clipList, shotList] = await Promise.all([
      clipboardService.getHistory(),
      screenshotService.getScreenshots(),
    ]);

    const unified: HistoryItem[] = [
      ...clipList.map((c) => ({ kind: 'clipboard' as const, ...c })),
      ...shotList.map((s) => ({ kind: 'screenshot' as const, ...s })),
    ];

    const q = query.text.trim().toLowerCase();

    const filtered = unified.filter((item) => {
      // Pinned filter
      if (query.onlyPinned && !item.isPinned) return false;

      // Favorites filter
      if (query.onlyFavorites && !item.isFavorite) return false;

      // Type filter
      if (query.filter === 'text' && (item.kind !== 'clipboard' || item.contentType === 'code' || item.contentType === 'url')) {
        return false;
      }
      if (query.filter === 'code' && (item.kind !== 'clipboard' || item.contentType !== 'code')) {
        return false;
      }
      if (query.filter === 'url' && (item.kind !== 'clipboard' || item.contentType !== 'url')) {
        return false;
      }
      if (query.filter === 'screenshots' && item.kind !== 'screenshot') {
        return false;
      }

      // Query text matching
      if (q) {
        if (item.kind === 'clipboard') {
          const matchContent = item.content.toLowerCase().includes(q);
          const matchApp = item.sourceApp?.toLowerCase().includes(q) ?? false;
          const matchLang = item.language?.toLowerCase().includes(q) ?? false;
          return matchContent || matchApp || matchLang;
        } else {
          const matchOcr = item.ocrText?.toLowerCase().includes(q) ?? false;
          const matchType = item.captureType.toLowerCase().includes(q);
          return matchOcr || matchType;
        }
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (query.sort === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (query.sort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (query.sort === 'char_count') {
        const aLen = a.kind === 'clipboard' ? a.charCount : (a.ocrText?.length ?? 0);
        const bLen = b.kind === 'clipboard' ? b.charCount : (b.ocrText?.length ?? 0);
        return bLen - aLen;
      }
      if (query.sort === 'source_app') {
        const aApp = a.kind === 'clipboard' ? (a.sourceApp || '') : 'Screenshot';
        const bApp = b.kind === 'clipboard' ? (b.sourceApp || '') : 'Screenshot';
        return aApp.localeCompare(bApp);
      }
      return 0;
    });

    return filtered;
  }
}

export const searchService = new MockSearchService();
