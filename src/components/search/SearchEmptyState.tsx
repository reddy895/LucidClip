import React from 'react';
import { EmptyState, Button } from '@/components/ui';
import { SearchX } from 'lucide-react';
import { useApp } from '@/context';

export const SearchEmptyState: React.FC = () => {
  const { searchQuery, setSearchQuery, setSearchFilter } = useApp();

  const handleReset = () => {
    setSearchQuery('');
    setSearchFilter('all');
  };

  return (
    <EmptyState
      icon={<SearchX className="h-5 w-5" />}
      title="No matching items found."
      description={
        searchQuery
          ? `No entries matched "${searchQuery}". Try searching for words, code symbols, or screenshot text.`
          : 'No entries match the selected filter criteria.'
      }
      action={
        <Button variant="secondary" size="sm" onClick={handleReset}>
          Clear Search & Filters
        </Button>
      }
    />
  );
};
