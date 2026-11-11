import React from 'react';
import { GalleryItem } from '@/types';
import { ScreenshotThumbnail } from './ScreenshotThumbnail';
import { useApp } from '@/context';

export interface ScreenshotGridProps {
  items: GalleryItem[];
  onOpenPreview?: (item: GalleryItem) => void;
}

export const ScreenshotGrid: React.FC<ScreenshotGridProps> = ({
  items,
  onOpenPreview,
}) => {
  const { selectedItem, setSelectedItem } = useApp();

  return (
    <div
      role="grid"
      aria-label="Screenshot gallery"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-6"
    >
      {items.map((item) => (
        <ScreenshotThumbnail
          key={`${item.source}-${item.id}`}
          item={item}
          isSelected={selectedItem?.id === item.id && selectedItem.kind === item.historyItem.kind}
          onSelect={() => setSelectedItem(item.historyItem)}
          onOpenPreview={() => onOpenPreview?.(item)}
        />
      ))}
    </div>
  );
};
