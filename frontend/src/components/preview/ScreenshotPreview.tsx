import React, { useEffect, useState } from 'react';
import { ScreenshotEntry, HistoryItem } from '@/types';
import { formatFullDateTime, formatRelativeTime, formatBytes } from '@/utils';
import { Badge, Button, Tooltip, Dialog } from '@/components/ui';
import { Copy, Pin, Star, Trash2, Download, Maximize2, Calendar, ImageOff, Loader2 } from 'lucide-react';
import { useApp } from '@/context';
import { screenshotService } from '@/services';

export interface ScreenshotPreviewProps {
  screenshot: ScreenshotEntry;
}

export const ScreenshotPreview: React.FC<ScreenshotPreviewProps> = ({ screenshot }) => {
  const { copyItem, togglePin, toggleFavorite, deleteItem, exportScreenshot } = useApp();
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | undefined>(screenshot.fullImageUrl);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>(
    screenshot.fullImageUrl ? 'ready' : 'loading'
  );

  const asHistoryItem: HistoryItem = { kind: 'screenshot', ...screenshot };

  useEffect(() => {
    let active = true;

    if (screenshot.originalAvailable === false) {
      setFullImageUrl(undefined);
      setImageState('error');
      return () => {
        active = false;
      };
    }

    setImageState('loading');
    screenshotService
      .getScreenshotImageUrl(screenshot.id, 'original')
      .then((url) => {
        if (!active) return;
        setFullImageUrl(url);
        setImageState('ready');
      })
      .catch(() => {
        if (!active) return;
        setFullImageUrl(undefined);
        setImageState('error');
      });

    return () => {
      active = false;
    };
  }, [screenshot.id, screenshot.originalAvailable]);

  const handleDownload = () => {
    void exportScreenshot(screenshot.id);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 select-none">
      {/* Header Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-graphite-border">
        <div className="flex items-center gap-1.5">
          <Badge variant="default" size="sm" className="uppercase font-mono">
            {screenshot.captureType}
          </Badge>
          {screenshot.isPinned && (
            <Badge variant="accent" size="sm" className="gap-1">
              <Pin className="h-2.5 w-2.5 fill-accent" />
              Pinned
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Copy Image">
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => copyItem(asHistoryItem)}
            >
              Copy
            </Button>
          </Tooltip>

          <Tooltip content={screenshot.isPinned ? 'Unpin' : 'Pin'}>
            <button
              type="button"
              onClick={() => togglePin(asHistoryItem)}
              className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
            >
              <Pin className={`h-3.5 w-3.5 ${screenshot.isPinned ? 'text-accent fill-accent' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip content={screenshot.isFavorite ? 'Unfavorite' : 'Favorite'}>
            <button
              type="button"
              onClick={() => toggleFavorite(asHistoryItem)}
              className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
            >
              <Star className={`h-3.5 w-3.5 ${screenshot.isFavorite ? 'text-status-warning fill-status-warning' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip content="Delete Screenshot">
            <button
              type="button"
              onClick={() => deleteItem(asHistoryItem)}
              className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-status-error hover:bg-status-error-bg transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        <div className="relative group rounded-btn overflow-hidden border border-graphite-border bg-[#151719]">
          {imageState === 'ready' && fullImageUrl ? (
            <>
              <img
                src={fullImageUrl}
                alt="Full screenshot preview"
                className="w-full object-contain cursor-zoom-in"
                onClick={() => setIsZoomOpen(true)}
                onError={() => {
                  setFullImageUrl(undefined);
                  setImageState('error');
                }}
              />
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                aria-label="Inspect screenshot fullscreen"
                className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-btn bg-black/60 text-[#F3F4F6] opacity-0 group-hover:opacity-100 transition-opacity duration-micro hover:bg-black/80"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : imageState === 'loading' ? (
            <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 text-graphite-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-[11px]">Loading screenshot...</span>
            </div>
          ) : (
            <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 px-4 text-center text-graphite-text-muted">
              <ImageOff className="h-6 w-6" />
              <span className="text-xs font-medium text-graphite-text-secondary">
                Screenshot file is missing
              </span>
              <span className="text-[11px] leading-relaxed">
                The database record is intact, but the image could not be read from local storage.
              </span>
            </div>
          )}
        </div>

        {/* Metadata Details */}
        <div className="pt-2 border-t border-graphite-border-subtle flex flex-col gap-2">
          <span className="text-[11px] font-medium text-graphite-text-muted uppercase tracking-wider block">
            Image Details
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
              <Maximize2 className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
              <div>
                <div className="text-[10px] text-graphite-text-muted">Resolution</div>
                <div className="font-mono font-medium text-graphite-text-primary">
                  {screenshot.width} × {screenshot.height}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
              <Download className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
              <div>
                <div className="text-[10px] text-graphite-text-muted">File Size</div>
                <div className="font-mono font-medium text-graphite-text-primary">
                  {formatBytes(screenshot.fileSizeBytes)}
                </div>
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
              <Calendar className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
              <div>
                <div className="text-[10px] text-graphite-text-muted">Captured At</div>
                <div className="text-graphite-text-primary text-[11px]">
                  {formatFullDateTime(screenshot.createdAt)} ({formatRelativeTime(screenshot.createdAt)})
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={handleDownload}
            className="w-full mt-1"
          >
            Export Screenshot File
          </Button>
        </div>
      </div>

      {/* Fullscreen Zoom Dialog */}
      <Dialog
        isOpen={isZoomOpen && imageState === 'ready'}
        onClose={() => setIsZoomOpen(false)}
        title="Screenshot Inspection"
        description={`${screenshot.width} × ${screenshot.height} ${screenshot.captureType}`}
        maxWidth="xl"
      >
        <div className="flex flex-col gap-3">
          <div className="max-h-[70vh] overflow-auto rounded-btn bg-[#111315] border border-graphite-border flex items-center justify-center p-2">
            {fullImageUrl && (
              <img
                src={fullImageUrl}
                alt="Full preview"
                className="max-h-[65vh] w-auto object-contain"
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-graphite-text-secondary">
              Resolution: {screenshot.width} × {screenshot.height}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setIsZoomOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
