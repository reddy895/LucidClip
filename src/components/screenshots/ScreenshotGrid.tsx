import React from 'react';
import { ScreenshotEntry } from '@/types';
import { ScreenshotThumbnail } from './ScreenshotThumbnail';
import { useApp } from '@/context';

export interface ScreenshotGridProps {
  screenshots: ScreenshotEntry[];
  onOpenPreview?: (screenshot: ScreenshotEntry) => void;
}

export const ScreenshotGrid: React.FC<ScreenshotGridProps> = ({
  screenshots,
  onOpenPreview,
}) => {
  const { selectedItem, setSelectedItem } = useApp();

  return (
    <div
      role="grid"
      aria-label="Screenshot gallery"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-6"
    >
      {screenshots.map((shot) => (
        <ScreenshotThumbnail
          key={shot.id}
          screenshot={shot}
          isSelected={selectedItem?.id === shot.id && selectedItem.kind === 'screenshot'}
          onSelect={() => setSelectedItem({ kind: 'screenshot', ...shot })}
          onOpenPreview={() => onOpenPreview?.(shot)}
        />
      ))}
    </div>
  );
};
