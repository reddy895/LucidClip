import { HistoryItem, SearchQuery } from '@/types';

export interface ISearchService {
  search(query: SearchQuery): Promise<HistoryItem[]>;
}
