import React, { useEffect, useState } from 'react';
import { GalleryItem } from '@/types';
import { cn, formatRelativeTime, formatBytes } from '@/utils';
import { Badge, Tooltip } from '@/components/ui';
import { Copy, Pin, Star, Trash2, Eye, ImageOff, Loader2 } from 'lucide-react';
import { useApp } from '@/context';
import { clipboardService, screenshotService } from '@/services';

export interface ScreenshotThumbnailProps {
  item: GalleryItem;
  isSelected: boolean;
  onSelect: () => void;
  onOpenPreview?: () => void;
}

export const ScreenshotThumbnail: React.FC<ScreenshotThumbnailProps> = ({
  item,
  isSelected,
  onSelect,
  onOpenPreview,
}) => {
  const { copyItem, togglePin, toggleFavorite, deleteItem } = useApp();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>();
  const [thumbnailState, setThumbnailState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;

    if (!item.thumbnailAvailable) {
      setThumbnailUrl(undefined);
      setThumbnailState('error');
      return () => {
        active = false;
      };
    }

    setThumbnailState('loading');
    const request =
      item.source === 'screenshot'
        ? screenshotService.getScreenshotImageUrl(item.id, 'thumbnail')
        : clipboardService.getClipboardImageUrl(item.id, 'thumbnail');

    request
      .then((url) => {
        if (!active) return;
        setThumbnailUrl(url);
        setThumbnailState('ready');
      })
      .catch(() => {
        if (!active) return;
        setThumbnailUrl(undefined);
        setThumbnailState('error');
      });

    return () => {
      active = false;
    };
  }, [item.id, item.source, item.thumbnailAvailable]);

  return (
    <div
      role="gridcell"
      tabIndex={0}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col rounded-panel bg-graphite-surface-elevated border transition-all duration-micro overflow-hidden cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-accent',
        isSelected
          ? 'border-accent shadow-desktop ring-1 ring-accent/30'
          : 'border-graphite-border hover:border-[#3d444d] hover:bg-graphite-hover'
      )}
    >
      {/* Thumbnail Aspect Box */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#151719]">
        {thumbnailState === 'ready' && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${item.source === 'screenshot' ? 'Screenshot' : 'Clipboard image'} from ${item.createdAt}`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => {
              setThumbnailUrl(undefined);
              setThumbnailState('error');
            }}
          />
        ) : thumbnailState === 'loading' ? (
          <div className="flex h-full w-full items-center justify-center text-graphite-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center text-graphite-text-muted">
            <ImageOff className="h-5 w-5" />
            <span className="text-[10px] leading-tight">
              {!item.originalAvailable ? 'Image file is missing' : 'Thumbnail unavailable'}
            </span>
          </div>
        )}

        {/* Source / capture type top left */}
        <div className="absolute top-2 left-2">
          <Badge variant="default" size="sm" className="bg-[#151719]/80 text-[9.5px] uppercase">
            {item.source === 'clipboard' ? 'Clipboard' : item.captureType}
          </Badge>
        </div>

        {/* Hover overlay with quick actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-micro">
          {onOpenPreview && (
            <Tooltip content="Inspect Preview">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPreview();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-btn bg-[#22262B] text-graphite-text-primary hover:bg-graphite-hover transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}

          <Tooltip content="Copy Image">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyItem(item.historyItem);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-btn bg-[#22262B] text-graphite-text-primary hover:bg-graphite-hover transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          <Tooltip content={item.isPinned ? 'Unpin' : 'Pin'}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(item.historyItem);
              }}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-btn transition-colors',
                item.isPinned
                  ? 'bg-accent text-[#111315]'
                  : 'bg-[#22262B] text-graphite-text-primary hover:bg-graphite-hover'
              )}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          <Tooltip content={item.isFavorite ? 'Unfavorite' : 'Favorite'}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item.historyItem);
              }}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-btn transition-colors',
                item.isFavorite
                  ? 'bg-status-warning text-[#111315]'
                  : 'bg-[#22262B] text-graphite-text-primary hover:bg-graphite-hover'
              )}
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Delete">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteItem(item.historyItem);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-btn bg-[#22262B] text-status-error hover:bg-status-error-bg transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Card Metadata Footer */}
      <div className="flex items-center justify-between p-2.5 text-[11px] text-graphite-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-graphite-text-muted">
            {item.width > 0 && item.height > 0
              ? `${item.width} × ${item.height}`
              : 'Unknown size'}
          </span>
          <span>•</span>
          <span className="text-graphite-text-muted">
            {item.fileSizeBytes != null ? formatBytes(item.fileSizeBytes) : '—'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-graphite-text-muted">
          <span>{formatRelativeTime(item.createdAt)}</span>
          {item.isPinned && <Pin className="h-3 w-3 text-accent fill-accent" />}
          {item.isFavorite && <Star className="h-3 w-3 text-status-warning fill-status-warning" />}
        </div>
      </div>
    </div>
  );
};
