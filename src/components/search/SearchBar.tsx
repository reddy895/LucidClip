import React from 'react';
import { SearchInput } from '@/components/ui';
import { FilterChips } from './FilterChips';
import { useApp } from '@/context';

export interface SearchBarProps {
  className?: string;
  showFilters?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  className,
  showFilters = true,
}) => {
  const { searchQuery, setSearchQuery, searchFilter, setSearchFilter } = useApp();

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Search clipboard history and screenshots..."
            shortcutBadge="/"
          />
        </div>
        {showFilters && (
          <FilterChips
            activeFilter={searchFilter}
            onFilterChange={setSearchFilter}
          />
        )}
      </div>
    </div>
  );
};

