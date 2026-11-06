import React, { useState, useMemo } from 'react';
import { useApp } from '@/context';
import { SectionHeader, EmptyState, Badge, SearchInput } from '@/components/ui';
import { SearchEmptyState, SortDropdown } from '@/components/search';
import { UnifiedHistoryRow } from '@/components/history/UnifiedHistoryRow';
import { useListKeyboardNavigation } from '@/hooks';
import { Pin } from 'lucide-react';
import { SortOrder } from '@/types';

export const PinnedView: React.FC = () => {
  const { unifiedHistory, selectedItem, setSelectedItem } = useApp();

  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const pinnedItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return unifiedHistory
      .filter((item) => item.isPinned)
      .filter((item) => {
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
  }, [unifiedHistory, query, sortOrder]);

  useListKeyboardNavigation({ items: pinnedItems });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Page Header */}
      <SectionHeader
        title="Pinned Items"
        description="Important snippets, commands, and screenshots kept permanently."
        badge={
          <Badge variant="accent" size="sm" className="font-mono">
            {pinnedItems.length}
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

      {/* Search Input */}
      <div className="mb-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          placeholder="Filter pinned items..."
          shortcutBadge="/"
        />
      </div>

      {/* List Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {pinnedItems.length === 0 ? (
          query ? (
            <SearchEmptyState />
          ) : (
            <EmptyState
              icon={<Pin className="h-5 w-5" />}
              title="You haven't pinned anything yet."
              description="Click the pin icon on any clipboard entry or screenshot to keep it easily accessible at the top."
            />
          )
        ) : (
          <div className="flex flex-col gap-1">
            {pinnedItems.map((item) => (
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

