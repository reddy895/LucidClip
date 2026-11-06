import React, { useState, useMemo } from 'react';
import { useApp } from '@/context';
import { SectionHeader, EmptyState, Badge, Button, SearchInput } from '@/components/ui';
import { SearchEmptyState } from '@/components/search';
import { ScreenshotGrid } from '@/components/screenshots/ScreenshotGrid';
import { Camera, Crop, Image as ImageIcon } from 'lucide-react';
import { useListKeyboardNavigation } from '@/hooks';

export const ScreenshotsView: React.FC = () => {
  const {
    screenshotItems,
    captureScreenshot,
    setIsPreviewVisible,
  } = useApp();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fullscreen' | 'region'>('all');
  const [isCapturing, setIsCapturing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return screenshotItems.filter((shot) => {
      if (filterType !== 'all' && shot.captureType !== filterType) return false;
      if (q) {
        const matchOcr = shot.ocrText?.toLowerCase().includes(q) ?? false;
        const matchType = shot.captureType.toLowerCase().includes(q);
        return matchOcr || matchType;
      }
      return true;
    });
  }, [screenshotItems, query, filterType]);

  const historyItems = useMemo(
    () => filtered.map((s) => ({ kind: 'screenshot' as const, ...s })),
    [filtered]
  );

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
        description="Captured desktop snapshots and OCR-extracted text archives."
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
            placeholder="Search OCR extracted text, keywords, types..."
            shortcutBadge="/"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'fullscreen', 'region'] as const).map((type) => (
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
              {type === 'all' ? 'All Types' : type}
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
              title="No screenshots captured yet."
              description="Capture full-screen or region snapshots to archive and extract searchable text."
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
            screenshots={filtered}
            onOpenPreview={() => setIsPreviewVisible(true)}
          />
        )}
      </div>
    </div>
  );
};

