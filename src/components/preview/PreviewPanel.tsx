import React from 'react';
import { useApp } from '@/context';
import { TextPreview } from './TextPreview';
import { ScreenshotPreview } from './ScreenshotPreview';
import { MousePointerClick } from 'lucide-react';

export const PreviewPanel: React.FC = () => {
  const { selectedItem } = useApp();

  if (!selectedItem) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center select-none text-graphite-text-muted">
        <MousePointerClick className="h-6 w-6 mb-2 text-graphite-text-muted opacity-60" />
        <p className="text-xs font-medium text-graphite-text-secondary">
          Select an item to preview its contents.
        </p>
      </div>
    );
  }

  if (selectedItem.kind === 'clipboard') {
    return <TextPreview entry={selectedItem} />;
  }

  return <ScreenshotPreview screenshot={selectedItem} />;
};
