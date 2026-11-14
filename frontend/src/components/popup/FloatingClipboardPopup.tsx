import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useApp } from '@/context';
import { ClipboardEntry } from '@/types';
import { PopupHeader } from './PopupHeader';
import { PopupFilterChips, PopupFilterType } from './PopupFilterChips';
import { PopupHistoryList } from './PopupHistoryList';
import { PopupFooter } from './PopupFooter';
import { PopupEmptyState } from './PopupEmptyState';
import { usePopupKeyboardNavigation } from '@/hooks/usePopupKeyboardNavigation';
import { usePopupShortcuts } from '@/hooks/usePopupShortcuts';

export interface FloatingClipboardPopupProps {
  onPasteAction?: (entry: ClipboardEntry) => void;
}

export const FloatingClipboardPopup: React.FC<FloatingClipboardPopupProps> = ({
  onPasteAction,
}) => {
  const { clipboardItems, monitorStatus, togglePin, deleteItem, clearClipboardHistory, isLoading } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PopupFilterType>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute category counts
  const counts = useMemo(() => {
    const res: Record<PopupFilterType, number> = {
      all: clipboardItems.length,
      text: 0,
      image: 0,
      files: 0,
      pinned: 0,
    };

    for (const item of clipboardItems) {
      if (item.isPinned) res.pinned += 1;
      if (item.contentType === 'image') res.image += 1;
      else if (item.contentType === 'files') res.files += 1;
      else res.text += 1;
    }

    return res;
  }, [clipboardItems]);

  // Filter items based on active chip and search query
  const filteredItems = useMemo(() => {
    let result = clipboardItems;

    // Filter by type
    if (activeFilter === 'pinned') {
      result = result.filter((item) => item.isPinned);
    } else if (activeFilter === 'image') {
      result = result.filter((item) => item.contentType === 'image');
    } else if (activeFilter === 'files') {
      result = result.filter((item) => item.contentType === 'files');
    } else if (activeFilter === 'text') {
      result = result.filter(
        (item) => item.contentType !== 'image' && item.contentType !== 'files'
      );
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.content.toLowerCase().includes(q) ||
          item.contentType.toLowerCase().includes(q) ||
          item.sourceApp?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [clipboardItems, activeFilter, searchQuery]);

  const handlePaste = useCallback(
    (entry: ClipboardEntry) => {
      if (onPasteAction) {
        onPasteAction(entry);
      } else if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('execute_instant_paste', {
            entryId: entry.id,
            content: entry.content,
            contentType: entry.contentType,
          }).catch(() => {});
        });
      }
    },
    [onPasteAction]
  );

  const { selectedIndex, setSelectedIndex, handleKeyDown } = usePopupKeyboardNavigation({
    items: filteredItems,
    onSelectAndPaste: handlePaste,
  });

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('hide_clipboard_popup').catch(() => {});
      });
    }
  }, []);

  const handleTogglePinSelected = useCallback(() => {
    const selected = filteredItems[selectedIndex];
    if (selected) {
      togglePin({ kind: 'clipboard', ...selected });
    }
  }, [filteredItems, selectedIndex, togglePin]);

  const handleDeleteSelected = useCallback(() => {
    const selected = filteredItems[selectedIndex];
    if (selected) {
      deleteItem({ kind: 'clipboard', ...selected });
    }
  }, [filteredItems, selectedIndex, deleteItem]);

  usePopupShortcuts({
    searchInputRef,
    searchQuery,
    onClearSearch: () => setSearchQuery(''),
    onClosePopup: handleClose,
    onTogglePinSelected: handleTogglePinSelected,
    onDeleteSelected: handleDeleteSelected,
  });

  const isMonitoring = monitorStatus ? monitorStatus.running && !monitorStatus.paused : true;

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col w-full h-screen bg-[#111315] text-[#F3F4F6] border border-[#30363D] rounded-xl shadow-2xl overflow-hidden select-none font-sans"
      data-testid="floating-clipboard-popup"
    >
      <PopupHeader
        inputRef={searchInputRef}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={clipboardItems.length}
        filteredCount={filteredItems.length}
        isMonitoring={isMonitoring}
      />

      <PopupFilterChips
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={counts}
      />

      {isLoading || filteredItems.length === 0 ? (
        <PopupEmptyState
          isLoading={isLoading}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
        />
      ) : (
        <PopupHistoryList
          items={filteredItems}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onPaste={handlePaste}
          onTogglePin={(item) => togglePin({ kind: 'clipboard', ...item })}
          onDelete={(item) => deleteItem({ kind: 'clipboard', ...item })}
        />
      )}

      <PopupFooter
        unpinnedCount={counts.all - counts.pinned}
        onClearUnpinned={clearClipboardHistory}
      />
    </div>
  );
};

export default FloatingClipboardPopup;
