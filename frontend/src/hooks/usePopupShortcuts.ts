import { useEffect, useCallback } from 'react';

export interface UsePopupShortcutsOptions {
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchQuery: string;
  onClearSearch: () => void;
  onClosePopup: () => void;
  onTogglePinSelected?: () => void;
  onDeleteSelected?: () => void;
}

export function usePopupShortcuts({
  searchInputRef,
  searchQuery,
  onClearSearch,
  onClosePopup,
  onTogglePinSelected,
  onDeleteSelected,
}: UsePopupShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F or '/' outside input: focus search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Escape key behavior:
      if (e.key === 'Escape') {
        e.preventDefault();
        if (searchQuery.trim().length > 0) {
          onClearSearch();
        } else {
          onClosePopup();
        }
        return;
      }

      // Ctrl+P / Cmd+P: toggle pin
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onTogglePinSelected?.();
        return;
      }

      // Delete or Shift+Delete outside text input: delete selected item
      if (e.key === 'Delete' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        onDeleteSelected?.();
        return;
      }
    },
    [
      searchInputRef,
      searchQuery,
      onClearSearch,
      onClosePopup,
      onTogglePinSelected,
      onDeleteSelected,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default usePopupShortcuts;
