export type SearchFilterType = 'all' | 'text' | 'code' | 'url' | 'screenshots';
export type SortOrder = 'newest' | 'oldest' | 'char_count' | 'source_app';

export interface SearchQuery {
  text: string;
  filter: SearchFilterType;
  sort: SortOrder;
  onlyPinned?: boolean;
  onlyFavorites?: boolean;
}
