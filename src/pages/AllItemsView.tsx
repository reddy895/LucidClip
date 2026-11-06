import React, { useState, useEffect } from 'react';
import { HistoryItem } from '@/types';
import { useApp } from '@/context';
import { SectionHeader, EmptyState, LoadingState, Badge } from '@/components/ui';
import { SearchBar, SortDropdown, SearchEmptyState } from '@/components/search';
import { UnifiedHistoryRow } from '@/components/history/UnifiedHistoryRow';
import { DateGroupSeparator } from '@/components/history/DateGroupSeparator';
import { getDateGroup } from '@/utils';
import { searchService } from '@/services';
import { useListKeyboardNavigation } from '@/hooks';
import { Clock } from 'lucide-react';

export const AllItemsView: React.FC = () => {
  const {
    selectedItem,
    setSelectedItem,
    searchQuery,
    searchFilter,
    sortOrder,
    setSortOrder,
    unifiedHistory,
    isLoading,
  } = useApp();

  const [filteredItems, setFilteredItems] = useState<HistoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsSearching(true);

    searchService
      .search({
        text: searchQuery,
        filter: searchFilter,
        sort: sortOrder,
      })
      .then((results) => {
        if (!isCancelled) {
          setFilteredItems(results);
          setIsSearching(false);
          // Auto select first item if none selected
          if (!selectedItem && results.length > 0) {
            setSelectedItem(results[0]);
          }
        }
      })
      .catch((err) => {
        console.error('Search failed', err);
        setIsSearching(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [searchQuery, searchFilter, sortOrder, unifiedHistory, selectedItem, setSelectedItem]);

  useListKeyboardNavigation({ items: filteredItems });

  if (isLoading) {
    return <LoadingState message="Loading your history..." />;
  }

  // Group items by date group if sorting is newest
  const renderList = () => {
    if (filteredItems.length === 0) {
      if (searchQuery || searchFilter !== 'all') {
        return <SearchEmptyState />;
      }
      return (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="Your history will appear here when you copy something."
          description="LucidClip automatically records clipboard changes and captured screenshots locally."
        />
      );
    }

    if (sortOrder !== 'newest') {
      return (
        <div className="flex flex-col gap-1">
          {filteredItems.map((item) => (
            <UnifiedHistoryRow
              key={`${item.kind}-${item.id}`}
              item={item}
              isSelected={selectedItem?.id === item.id}
              searchQuery={searchQuery}
              onSelect={() => setSelectedItem(item)}
            />
          ))}
        </div>
      );
    }

    // Grouping by date
    const groups: { [key: string]: HistoryItem[] } = {};
    for (const item of filteredItems) {
      const g = getDateGroup(item.createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }

    const groupOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Earlier'];

    return (
      <div className="flex flex-col">
        {groupOrder.map((groupName) => {
          const items = groups[groupName];
          if (!items || items.length === 0) return null;

          return (
            <div key={groupName} className="flex flex-col mb-2">
              <DateGroupSeparator label={groupName} />
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <UnifiedHistoryRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    isSelected={selectedItem?.id === item.id}
                    searchQuery={searchQuery}
                    onSelect={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Workspace Header */}
      <SectionHeader
        title="All Items"
        description="Unified chronological feed of clipboard entries and screenshots."
        badge={
          <Badge variant="default" size="sm" className="font-mono">
            {filteredItems.length}
          </Badge>
        }
        actions={
          <SortDropdown
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            className="w-36"
          />
        }
      />

      {/* Filter and Search Bar */}
      <div className="mb-3">
        <SearchBar showFilters={true} />
      </div>

      {/* List Container */}
      <div className="flex-1 min-h-0">
        {isSearching ? <LoadingState message="Filtering items..." /> : renderList()}
      </div>
    </div>
  );
};
