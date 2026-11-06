import React from 'react';
import { SortOrder } from '@/types';
import { ArrowUpDown } from 'lucide-react';
import { Select } from '@/components/ui';

export interface SortDropdownProps {
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  className?: string;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  sortOrder,
  onSortChange,
  className,
}) => {
  const options = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'char_count', label: 'Content Size' },
    { value: 'source_app', label: 'Source App' },
  ];

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <ArrowUpDown className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
      <Select
        value={sortOrder}
        onChange={(val) => onSortChange(val as SortOrder)}
        options={options}
        className={className}
      />
    </div>
  );
};
