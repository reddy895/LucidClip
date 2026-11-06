import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/utils';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  shortcutBadge?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search clipboard history and screenshots...',
      shortcutBadge = '/',
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      onClear?.();
    };

    return (
      <div className="relative flex w-full items-center">
        <Search className="absolute left-2.5 h-4 w-4 text-graphite-text-muted pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'h-8 w-full rounded-input bg-graphite-surface pl-8 pr-16 text-[13px] text-graphite-text-primary placeholder:text-graphite-text-muted border border-graphite-border transition-colors duration-micro outline-none focus:border-accent focus:bg-graphite-surface-elevated',
            className
          )}
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="flex h-4 w-4 items-center justify-center rounded text-graphite-text-muted hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          ) : shortcutBadge ? (
            <kbd className="hidden sm:inline-flex h-4 min-w-[16px] items-center justify-center rounded bg-graphite-surface-elevated px-1 text-[10px] font-mono text-graphite-text-muted border border-graphite-border pointer-events-none">
              {shortcutBadge}
            </kbd>
          ) : null}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

