import { HistoryItem, SearchQuery } from '@/types';

/**
 * Filter and sort a unified history list for the search workspace.
 * Kept pure so both live and mock data sources share identical behavior.
 */
export function filterHistory(items: HistoryItem[], query: SearchQuery): HistoryItem[] {
  const q = query.text.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (query.onlyPinned && !item.isPinned) return false;
    if (query.onlyFavorites && !item.isFavorite) return false;

    if (
      query.filter === 'text' &&
      (item.kind !== 'clipboard' || item.contentType === 'code' || item.contentType === 'url')
    ) {
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

    if (!q) return true;

    if (item.kind === 'clipboard') {
      const matchContent = item.content.toLowerCase().includes(q);
      const matchApp = item.sourceApp?.toLowerCase().includes(q) ?? false;
      const matchLang = item.language?.toLowerCase().includes(q) ?? false;
      return matchContent || matchApp || matchLang;
    }

    const matchOcr = item.ocrText?.toLowerCase().includes(q) ?? false;
    const matchType = item.captureType.toLowerCase().includes(q);
    return matchOcr || matchType;
  });

  filtered.sort((a, b) => {
    if (query.sort === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (query.sort === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (query.sort === 'char_count') {
      const aLen = a.kind === 'clipboard' ? a.charCount : a.ocrText?.length ?? 0;
      const bLen = b.kind === 'clipboard' ? b.charCount : b.ocrText?.length ?? 0;
      return bLen - aLen;
    }
    if (query.sort === 'source_app') {
      const aApp = a.kind === 'clipboard' ? a.sourceApp || '' : 'Screenshot';
      const bApp = b.kind === 'clipboard' ? b.sourceApp || '' : 'Screenshot';
      return aApp.localeCompare(bApp);
    }
    return 0;
  });

  return filtered;
}
