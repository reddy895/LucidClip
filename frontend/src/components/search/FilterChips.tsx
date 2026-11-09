import React from 'react';
import { SearchFilterType } from '@/types';
import { cn } from '@/utils';
import { LayoutGrid, FileText, Code, Link as LinkIcon, Camera, Image as ImageIcon, Files } from 'lucide-react';

export interface FilterChipsProps {
  activeFilter: SearchFilterType;
  onFilterChange: (filter: SearchFilterType) => void;
  className?: string;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  activeFilter,
  onFilterChange,
  className,
}) => {
  const filters: { id: SearchFilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: 'text', label: 'Text', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'code', label: 'Code', icon: <Code className="h-3.5 w-3.5" /> },
    { id: 'url', label: 'URLs', icon: <LinkIcon className="h-3.5 w-3.5" /> },
    { id: 'images', label: 'Images', icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { id: 'files', label: 'Files', icon: <Files className="h-3.5 w-3.5" /> },
    { id: 'screenshots', label: 'Screenshots', icon: <Camera className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto py-1 select-none', className)}>
      {filters.map((f) => {
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-btn px-2.5 text-xs font-medium transition-colors duration-micro outline-none shrink-0',
              isActive
                ? 'bg-graphite-surface-elevated text-accent border border-graphite-border shadow-sm'
                : 'bg-transparent text-graphite-text-muted hover:text-graphite-text-primary hover:bg-graphite-hover border border-transparent'
            )}
          >
            <span className={isActive ? 'text-accent' : 'text-graphite-text-muted'}>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
};

