import { useEffect } from 'react';
import { HistoryItem } from '@/types';
import { useApp } from '@/context';

export interface UseListKeyboardNavigationProps {
  items: HistoryItem[];
  enabled?: boolean;
}

export function useListKeyboardNavigation({
  items,
  enabled = true,
}: UseListKeyboardNavigationProps): void {
  const { selectedItem, setSelectedItem, copyItem, togglePin, deleteItem } = useApp();

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isInput) return;

      const currentIndex = selectedItem
        ? items.findIndex((i) => i.id === selectedItem.id && i.kind === selectedItem.kind)
        : -1;

      // Down arrow
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        setSelectedItem(items[nextIndex]);
        return;
      }

      // Up arrow
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        setSelectedItem(items[prevIndex]);
        return;
      }

      // Enter to copy selected
      if (e.key === 'Enter' && selectedItem) {
        e.preventDefault();
        copyItem(selectedItem);
        return;
      }

      // P to toggle pin
      if (e.key.toLowerCase() === 'p' && selectedItem && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        togglePin(selectedItem);
        return;
      }

      // Delete to delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem) {
        e.preventDefault();
        deleteItem(selectedItem);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedItem, enabled, setSelectedItem, copyItem, togglePin, deleteItem]);
}
