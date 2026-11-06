import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/context';
import { QuickAccessItem } from './QuickAccessItem';
import { Search, Command, CornerDownLeft, ArrowUpDown } from 'lucide-react';

export const QuickAccessOverlay: React.FC = () => {
  const {
    isQuickAccessOpen,
    closeQuickAccess,
    unifiedHistory,
    copyItem,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isQuickAccessOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isQuickAccessOpen]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show up to 8 most recent items
      return unifiedHistory.slice(0, 8);
    }

    return unifiedHistory
      .filter((item) => {
        if (item.kind === 'clipboard') {
          return (
            item.content.toLowerCase().includes(q) ||
            (item.sourceApp?.toLowerCase().includes(q) ?? false) ||
            (item.language?.toLowerCase().includes(q) ?? false)
          );
        } else {
          return (
            (item.ocrText?.toLowerCase().includes(q) ?? false) ||
            item.captureType.toLowerCase().includes(q)
          );
        }
      })
      .slice(0, 10);
  }, [unifiedHistory, query]);

  // Keyboard navigation inside overlay
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickAccess();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        copyItem(filteredItems[selectedIndex]);
        closeQuickAccess();
      }
      return;
    }
  };

  if (!isQuickAccessOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={closeQuickAccess}
    >
      {/* Subtle backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity" />

      {/* Floating launcher window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick Access Launcher"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-[540px] rounded-modal bg-graphite-surface-elevated border border-graphite-border shadow-modal overflow-hidden text-graphite-text-primary animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Launcher Search Bar */}
        <div className="flex items-center gap-2.5 border-b border-graphite-border px-3.5 py-2.5 bg-graphite-surface">
          <Search className="h-4 w-4 text-graphite-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search clipboard history and screenshots..."
            className="flex-1 bg-transparent text-[13px] text-graphite-text-primary placeholder:text-graphite-text-muted outline-none"
          />
          <kbd className="flex items-center gap-0.5 rounded bg-graphite-sidebar px-1.5 py-0.5 text-[10px] font-mono text-graphite-text-muted border border-graphite-border">
            <Command className="h-2.5 w-2.5" />
            <span>Esc to exit</span>
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[340px] overflow-y-auto p-1.5 flex flex-col gap-0.5">
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-graphite-text-muted">
            {query ? 'Search Results' : 'Recent Items'}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-graphite-text-muted">
              No matching clipboard entries found.
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <QuickAccessItem
                key={`${item.kind}-${item.id}`}
                item={item}
                isSelected={selectedIndex === index}
                searchQuery={query}
                onSelect={() => setSelectedIndex(index)}
                onExecute={() => {
                  copyItem(item);
                  closeQuickAccess();
                }}
              />
            ))
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-graphite-border bg-graphite-sidebar px-3 py-1.5 text-[11px] text-graphite-text-muted select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3 text-accent" />
              <span>Copy & Paste</span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-graphite-text-muted" />
              <span>Navigate</span>
            </span>
          </div>
          <span>LucidClip Desktop</span>
        </div>
      </div>
    </div>
  );
};
