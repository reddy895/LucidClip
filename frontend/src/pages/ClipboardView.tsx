import React, { useState, useMemo } from 'react';
import { useApp } from '@/context';
import { SectionHeader, EmptyState, Badge, Button, SearchInput } from '@/components/ui';
import { SearchEmptyState, SortDropdown } from '@/components/search';
import { ClipboardRow, ClipboardToolbar } from '@/components/clipboard';
import { useListKeyboardNavigation } from '@/hooks';
import { ClipboardList, Trash2 } from 'lucide-react';
import { ClipboardContentType } from '@/types';
import { ConfirmationModal } from '@/components/ui';

export const ClipboardView: React.FC = () => {
  const {
    clipboardItems,
    selectedItem,
    setSelectedItem,
    clearClipboardHistory,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ClipboardContentType | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'char_count' | 'source_app'>('newest');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return clipboardItems
      .filter((item) => {
        if (selectedType !== 'all' && item.contentType !== selectedType) {
          return false;
        }
        if (q) {
          const matchContent = item.content.toLowerCase().includes(q);
          const matchApp = item.sourceApp?.toLowerCase().includes(q) ?? false;
          const matchLang = item.language?.toLowerCase().includes(q) ?? false;
          const matchKind = item.contentType.toLowerCase().includes(q);
          const matchDimensions =
            item.imageWidth != null &&
            item.imageHeight != null &&
            `${item.imageWidth}x${item.imageHeight}`.includes(q.replace(/\s/g, ''));
          const matchFileCount =
            item.fileCount != null && String(item.fileCount) === q.replace(/\s/g, '');
          return matchContent || matchApp || matchLang || matchKind || matchDimensions || matchFileCount;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortOrder === 'char_count') return b.charCount - a.charCount;
        if (sortOrder === 'source_app') return (a.sourceApp || '').localeCompare(b.sourceApp || '');
        return 0;
      });
  }, [clipboardItems, query, selectedType, sortOrder]);

  const historyItems = useMemo(
    () => filtered.map((c) => ({ kind: 'clipboard' as const, ...c })),
    [filtered]
  );

  useListKeyboardNavigation({ items: historyItems });

  const typeButtons: { id: ClipboardContentType | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'text', label: 'Plain Text' },
    { id: 'code', label: 'Code' },
    { id: 'url', label: 'URLs' },
    { id: 'multiline', label: 'Notes' },
    { id: 'json', label: 'JSON' },
    { id: 'color_code', label: 'Colors' },
    { id: 'path', label: 'Paths' },
    { id: 'image', label: 'Images' },
    { id: 'files', label: 'Files' },
  ];

  return (
    <div className="flex flex-col h-full w-full">
      {/* Page Header */}
      <SectionHeader
        title="Clipboard History"
        description="Search, preview, and restore your copied snippets and URLs."
        badge={
          <Badge variant="default" size="sm" className="font-mono">
            {filtered.length}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <ClipboardToolbar />
            <div className="h-4 w-[1px] bg-graphite-border mx-0.5" />
            <SortDropdown
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              className="w-32"
            />
            <Button
              variant="subtle"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setIsClearModalOpen(true)}
              disabled={clipboardItems.length === 0}
            >
              Clear
            </Button>
          </div>
        }
      />

      {/* Search and Quick Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search clipboard text, code, paths, files..."
            shortcutBadge="/"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {typeButtons.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setSelectedType(tb.id)}
              className={`flex h-7 items-center rounded-btn px-2.5 text-xs font-medium transition-colors duration-micro outline-none shrink-0 ${
                selectedType === tb.id
                  ? 'bg-graphite-surface-elevated text-accent border border-graphite-border shadow-sm'
                  : 'bg-transparent text-graphite-text-muted hover:text-graphite-text-primary hover:bg-graphite-hover border border-transparent'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          query || selectedType !== 'all' ? (
            <SearchEmptyState />
          ) : (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="No clipboard entries yet."
              description="Copy text, links, images, or files in any application and they will appear here automatically."
            />
          )
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((item) => (
              <ClipboardRow
                key={item.id}
                entry={item}
                isSelected={selectedItem?.id === item.id}
                searchQuery={query}
                onSelect={() => setSelectedItem({ kind: 'clipboard', ...item })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={async () => {
          await clearClipboardHistory();
          setIsClearModalOpen(false);
        }}
        title="Clear Clipboard History"
        description="Are you sure you want to clear your clipboard history? Pinned items will be preserved safely."
        confirmText="Clear History"
        isDestructive={true}
      />
    </div>
  );
};
