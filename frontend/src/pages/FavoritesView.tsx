import React, { useState, useMemo } from 'react';
import { useApp } from '@/context';
import { SectionHeader, EmptyState, Badge, SearchInput } from '@/components/ui';
import { SearchEmptyState, SortDropdown } from '@/components/search';
import { UnifiedHistoryRow } from '@/components/history/UnifiedHistoryRow';
import { useListKeyboardNavigation } from '@/hooks';
import { Star } from 'lucide-react';
import { SortOrder } from '@/types';

export const FavoritesView: React.FC = () => {
  const { unifiedHistory, selectedItem, setSelectedItem } = useApp();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'clipboard' | 'screenshot'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const favoriteItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return unifiedHistory
      .filter((item) => item.isFavorite)
      .filter((item) => {
        if (filterType !== 'all' && item.kind !== filterType) return false;
        if (!q) return true;
        if (item.kind === 'clipboard') {
          return (
            item.content.toLowerCase().includes(q) ||
            (item.sourceApp?.toLowerCase().includes(q) ?? false)
          );
        } else {
          return item.ocrText?.toLowerCase().includes(q) ?? false;
        }
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return 0;
      });
  }, [unifiedHistory, query, filterType, sortOrder]);

  useListKeyboardNavigation({ items: favoriteItems });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Page Header */}
      <SectionHeader
        title="Favorites"
        description="Your starred snippets and visual references for quick retrieval."
        badge={
          <Badge variant="warning" size="sm" className="font-mono">
            {favoriteItems.length}
          </Badge>
        }
        actions={
          <SortDropdown
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            className="w-32"
          />
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search favorite entries..."
            shortcutBadge="/"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'clipboard', 'screenshot'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`flex h-7 items-center rounded-btn px-2.5 text-xs font-medium transition-colors duration-micro outline-none uppercase ${
                filterType === type
                  ? 'bg-graphite-surface-elevated text-status-warning border border-graphite-border shadow-sm'
                  : 'bg-transparent text-graphite-text-muted hover:text-graphite-text-primary hover:bg-graphite-hover border border-transparent'
              }`}
            >
              {type === 'all' ? 'All' : type === 'clipboard' ? 'Text' : 'Screenshots'}
            </button>
          ))}
        </div>
      </div>

      {/* List Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {favoriteItems.length === 0 ? (
          query || filterType !== 'all' ? (
            <SearchEmptyState />
          ) : (
            <EmptyState
              icon={<Star className="h-5 w-5 text-status-warning" />}
              title="No favorite items yet."
              description="Star frequently copied commands, code templates, or important screenshots to access them here."
            />
          )
        ) : (
          <div className="flex flex-col gap-1">
            {favoriteItems.map((item) => (
              <UnifiedHistoryRow
                key={`${item.kind}-${item.id}`}
                item={item}
                isSelected={selectedItem?.id === item.id}
                searchQuery={query}
                onSelect={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

