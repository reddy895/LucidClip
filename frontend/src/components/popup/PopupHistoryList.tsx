import React, { useRef, useEffect } from 'react';
import { ClipboardEntry } from '@/types';
import { PopupHistoryRow } from './PopupHistoryRow';

export interface PopupHistoryListProps {
  items: ClipboardEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPaste: (entry: ClipboardEntry) => void;
  onTogglePin?: (entry: ClipboardEntry) => void;
  onDelete?: (entry: ClipboardEntry) => void;
}

export const PopupHistoryList: React.FC<PopupHistoryListProps> = ({
  items,
  selectedIndex,
  onSelect,
  onPaste,
  onTogglePin,
  onDelete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll active item into view smoothly
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const activeEl = itemRefs.current[selectedIndex];
      if (activeEl && containerRef.current) {
        const container = containerRef.current;
        const itemTop = activeEl.offsetTop;
        const itemBottom = itemTop + activeEl.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [selectedIndex, items.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto divide-y divide-[#22262B]/60 focus:outline-none select-none scroll-smooth"
      tabIndex={-1}
      data-testid="popup-history-list"
    >
      {items.map((entry, index) => {
        const isSelected = index === selectedIndex;
        return (
          <div
            key={entry.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
          >
            <PopupHistoryRow
              entry={entry}
              isSelected={isSelected}
              shortcutIndex={index < 9 ? index + 1 : undefined}
              onSelect={() => onSelect(index)}
              onPaste={() => onPaste(entry)}
              onTogglePin={() => onTogglePin?.(entry)}
              onDelete={() => onDelete?.(entry)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PopupHistoryList;
