import React, { useState, useMemo } from 'react';
import { useApp } from '@/context';
import { SectionHeader, EmptyState, Badge, Button, SearchInput } from '@/components/ui';
import { SearchEmptyState } from '@/components/search';
import { ScreenshotGrid } from '@/components/screenshots/ScreenshotGrid';
import { Camera, Crop, Image as ImageIcon } from 'lucide-react';
import { useListKeyboardNavigation } from '@/hooks';
import { buildGalleryItems, selectClipboardImages } from '@/utils';

export const ScreenshotsView: React.FC = () => {
  const {
    screenshotItems,
    clipboardItems,
    captureScreenshot,
    setIsPreviewVisible,
  } = useApp();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'fullscreen' | 'region' | 'clipboard'
  >('all');
  const [isCapturing, setIsCapturing] = useState(false);

  const galleryItems = useMemo(
    () => buildGalleryItems(screenshotItems, selectClipboardImages(clipboardItems)),
    [screenshotItems, clipboardItems]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s/g, '');
    return galleryItems.filter((item) => {
      if (filterType !== 'all') {
        if (filterType === 'clipboard') {
          if (item.source !== 'clipboard') return false;
        } else if (item.source !== 'screenshot' || item.captureType !== filterType) {
          return false;
        }
      }
      if (!q) return true;

      const dimensions = `${item.width}x${item.height}`.toLowerCase();
      if (item.source === 'clipboard') {
        return 'clipboard image'.replace(/\s/g, '').includes(q) || dimensions.includes(q);
      }
      return (
        (item.ocrText?.toLowerCase().includes(q) ?? false) ||
        item.captureType.toLowerCase().includes(q) ||
        dimensions.includes(q)
      );
    });
  }, [galleryItems, query, filterType]);

  const historyItems = useMemo(() => filtered.map((item) => item.historyItem), [filtered]);

  useListKeyboardNavigation({ items: historyItems });

  const handleCapture = async (type: 'fullscreen' | 'region') => {
    setIsCapturing(true);
    try {
      await captureScreenshot(type);
      setIsPreviewVisible(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Page Header */}
      <SectionHeader
        title="Screenshots"
        description="Desktop captures and clipboard images stored locally on this device."
        badge={
          <Badge variant="default" size="sm" className="font-mono">
            {filtered.length}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Crop className="h-3.5 w-3.5" />}
              onClick={() => handleCapture('region')}
              disabled={isCapturing}
            >
              Capture Region
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Camera className="h-3.5 w-3.5" />}
              onClick={() => handleCapture('fullscreen')}
              isLoading={isCapturing}
            >
              Capture Screen
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder="Filter by capture type or dimensions..."
            shortcutBadge="/"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'fullscreen', 'region', 'clipboard'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`flex h-7 items-center rounded-btn px-2.5 text-xs font-medium transition-colors duration-micro outline-none uppercase ${
                filterType === type
                  ? 'bg-graphite-surface-elevated text-accent border border-graphite-border shadow-sm'
                  : 'bg-transparent text-graphite-text-muted hover:text-graphite-text-primary hover:bg-graphite-hover border border-transparent'
              }`}
            >
              {type === 'all' ? 'All Types' : type === 'clipboard' ? 'Clipboard' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          query || filterType !== 'all' ? (
            <SearchEmptyState />
          ) : (
            <EmptyState
              icon={<ImageIcon className="h-5 w-5" />}
              title="No images captured yet."
              description="Capture a screenshot or copy an image to see it in this gallery."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Camera className="h-3.5 w-3.5" />}
                  onClick={() => handleCapture('fullscreen')}
                >
                  Take First Screenshot
                </Button>
              }
            />
          )
        ) : (
          <ScreenshotGrid
            items={filtered}
            onOpenPreview={() => setIsPreviewVisible(true)}
          />
        )}
      </div>
    </div>
  );
};

