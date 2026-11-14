import { useState, useCallback, useEffect } from 'react';

export interface UsePopupKeyboardNavigationOptions<T> {
  items: T[];
  onSelectAndPaste: (item: T) => void;
  initialIndex?: number;
}

export function usePopupKeyboardNavigation<T>({
  items,
  onSelectAndPaste,
  initialIndex = 0,
}: UsePopupKeyboardNavigationOptions<T>) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  // Clamp selectedIndex when items array size changes
  useEffect(() => {
    if (items.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= items.length) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length, selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (items.length === 0) return;

      // Direct Alt+1..Alt+9 selection
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const targetIdx = parseInt(e.key, 10) - 1;
        if (targetIdx < items.length) {
          e.preventDefault();
          setSelectedIndex(targetIdx);
          onSelectAndPaste(items[targetIdx]);
          return;
        }
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;

        case 'Home':
          e.preventDefault();
          setSelectedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setSelectedIndex(items.length - 1);
          break;

        case 'PageDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 5));
          break;

        case 'PageUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 5));
          break;

        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelectAndPaste(items[selectedIndex]);
          }
          break;

        default:
          break;
      }
    },
    [items, selectedIndex, onSelectAndPaste]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}

export default usePopupKeyboardNavigation;
