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
import { pasteService, settingsService, clipboardService } from '@/services';

export interface FloatingClipboardPopupProps {
  onPasteAction?: (entry: ClipboardEntry) => void;
}

export const FloatingClipboardPopup: React.FC<FloatingClipboardPopupProps> = ({
  onPasteAction,
}) => {
  const { clipboardItems, monitorStatus, togglePin, deleteItem, clearClipboardHistory, isLoading } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PopupFilterType>('all');
  const [pasteOnSelect, setPasteOnSelect] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load user settings preference for paste-on-select vs copy-only
  React.useEffect(() => {
    let active = true;
    settingsService.getSettings().then((settings) => {
      if (active && settings?.clipboard?.pasteOnSelect !== undefined) {
        setPasteOnSelect(Boolean(settings.clipboard.pasteOnSelect));
      }
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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

    // Filter by search query (case-insensitive across content, type, and source application)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      result = result.filter((item) => {
        const textToSearch = `${item.content} ${item.contentType} ${item.sourceApp ?? ''}`.toLowerCase();
        return tokens.every((token) => textToSearch.includes(token));
      });
    }

    // Ensure newest-first ordering
    return [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [clipboardItems, activeFilter, searchQuery]);

  const handlePaste = useCallback(
    async (entry: ClipboardEntry) => {
      if (onPasteAction) {
        onPasteAction(entry);
      } else {
        try {
          await pasteService.executeInstantPaste({
            entryId: entry.id,
            content: entry.content,
            contentType: entry.contentType,
          });
        } catch (err) {
          console.error('[LucidClip] Paste execution failed:', err);
        }
      }
    },
    [onPasteAction]
  );

  const { selectedIndex, setSelectedIndex, handleKeyDown } = usePopupKeyboardNavigation({
    items: filteredItems,
    onSelectAndPaste: (entry) => handleSelectAction(entry, false),
    onCopyOnly: (entry) => handleSelectAction(entry, true),
  });

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('hide_clipboard_popup').catch(() => {});
      });
    }
  }, []);

  const handleCopyOnly = useCallback(
    async (entry: ClipboardEntry) => {
      try {
        await clipboardService.copyEntryById(entry.id);
      } catch {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(entry.content).catch(() => {});
        }
      }
      handleClose();
    },
    [handleClose]
  );

  const handleSelectAction = useCallback(
    async (entry: ClipboardEntry, forceCopyOnly = false) => {
      if (forceCopyOnly || !pasteOnSelect) {
        await handleCopyOnly(entry);
      } else {
        await handlePaste(entry);
      }
    },
    [handleCopyOnly, handlePaste, pasteOnSelect]
  );

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
          onPaste={(item) => handleSelectAction(item, false)}
          onTogglePin={(item) => togglePin({ kind: 'clipboard', ...item })}
          onDelete={(item) => deleteItem({ kind: 'clipboard', ...item })}
        />
      )}

      <PopupFooter
        unpinnedCount={counts.all - counts.pinned}
        onClearUnpinned={clearClipboardHistory}
        pasteOnSelect={pasteOnSelect}
      />
    </div>
  );
};

export default FloatingClipboardPopup;
