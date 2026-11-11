import React, { useState } from 'react';
import { HistoryItem } from '@/types';
import { cn, formatRelativeTime, truncate } from '@/utils';
import { Badge, Tooltip, ContextMenu, ContextMenuItem } from '@/components/ui';
import { HighlightText } from '@/components/search';
import {
  Copy,
  Pin,
  Star,
  Trash2,
  FileText,
  Code,
  Link as LinkIcon,
  Camera,
  ExternalLink,
  Image as ImageIcon,
  Files,
} from 'lucide-react';
import { useApp } from '@/context';
import { useMediaImageUrl } from '@/hooks';

export interface UnifiedHistoryRowProps {
  item: HistoryItem;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
}

export const UnifiedHistoryRow: React.FC<UnifiedHistoryRowProps> = ({
  item,
  isSelected,
  searchQuery,
  onSelect,
}) => {
  const { copyItem, togglePin, toggleFavorite, deleteItem } = useApp();
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const isClipboard = item.kind === 'clipboard';
  const imageEnabled = isClipboard
    ? item.contentType === 'image' && !!item.thumbnailPath
    : true;
  const thumbnail = useMediaImageUrl(item.kind, item.id, 'thumbnail', imageEnabled);

  const typeConfig = {
    text: { label: 'TXT', icon: <FileText className="h-3 w-3" />, variant: 'default' as const },
    multiline: { label: 'NOTE', icon: <FileText className="h-3 w-3" />, variant: 'default' as const },
    code: { label: item.kind === 'clipboard' && item.language ? item.language.toUpperCase() : 'CODE', icon: <Code className="h-3 w-3" />, variant: 'accent' as const },
    url: { label: 'URL', icon: <LinkIcon className="h-3 w-3" />, variant: 'accent' as const },
    json: { label: 'JSON', icon: <Code className="h-3 w-3" />, variant: 'accent' as const },
    color_code: { label: 'COLOR', icon: <FileText className="h-3 w-3" />, variant: 'accent' as const },
    path: { label: 'PATH', icon: <FileText className="h-3 w-3" />, variant: 'default' as const },
    image: { label: 'IMG', icon: <ImageIcon className="h-3 w-3" />, variant: 'accent' as const },
    files: { label: 'FILES', icon: <Files className="h-3 w-3" />, variant: 'default' as const },
    screenshot: { label: 'IMG', icon: <Camera className="h-3 w-3" />, variant: 'default' as const },
  };

  const currentType = isClipboard ? typeConfig[item.contentType] : typeConfig.screenshot;

  const previewText = isClipboard
    ? item.contentType === 'image'
      ? `${item.imageWidth ?? '?'} × ${item.imageHeight ?? '?'} image`
      : item.contentType === 'files'
      ? `${item.fileCount ?? 0} file${(item.fileCount ?? 0) === 1 ? '' : 's'}: ${item.content
          .replace(/\s+/g, ' ')
          .trim()}`
      : item.content.replace(/\s+/g, ' ').trim()
    : item.ocrText
    ? item.ocrText.replace(/\s+/g, ' ').trim()
    : `${item.width} × ${item.height} ${item.captureType} screenshot`;

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: 'copy',
      label: 'Copy to Clipboard',
      icon: <Copy className="h-3.5 w-3.5" />,
      shortcut: 'Enter',
      onClick: () => copyItem(item),
    },
    {
      id: 'pin',
      label: item.isPinned ? 'Unpin Item' : 'Pin Item',
      icon: <Pin className="h-3.5 w-3.5" />,
      shortcut: 'P',
      onClick: () => togglePin(item),
    },
    {
      id: 'favorite',
      label: item.isFavorite ? 'Remove Favorite' : 'Mark Favorite',
      icon: <Star className="h-3.5 w-3.5" />,
      onClick: () => toggleFavorite(item),
    },
    ...(isClipboard && item.contentType === 'url'
      ? [
          {
            id: 'open-url',
            label: 'Open in Browser',
            icon: <ExternalLink className="h-3.5 w-3.5" />,
            onClick: () => window.open(item.content, '_blank'),
          },
        ]
      : []),
    { id: 'div-1', label: '', isDivider: true },
    {
      id: 'delete',
      label: 'Delete Item',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      isDanger: true,
      shortcut: 'Del',
      onClick: () => deleteItem(item),
    },
  ];

  return (
    <>
      <div
        role="row"
        tabIndex={0}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        className={cn(
          'group relative flex items-center justify-between gap-3 rounded-btn px-3 py-2 text-[13px] transition-colors duration-micro cursor-pointer border select-none outline-none focus-visible:ring-1 focus-visible:ring-accent',
          isSelected
            ? 'bg-graphite-surface-elevated text-graphite-text-primary border-graphite-border shadow-sm'
            : 'bg-graphite-surface/40 text-graphite-text-secondary hover:bg-graphite-surface hover:text-graphite-text-primary border-transparent'
        )}
      >
        {/* Left: Thumbnail/Type Badge + Content Preview */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {imageEnabled && thumbnail.state === 'ready' && thumbnail.url ? (
            <div className="relative h-6 w-9 shrink-0 overflow-hidden rounded-[3px] border border-graphite-border bg-[#151719]">
              <img
                src={thumbnail.url}
                alt={isClipboard ? 'Clipboard image thumbnail' : 'Screenshot thumbnail'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <Badge variant={currentType.variant} size="sm" className="font-mono text-[10px]">
              {currentType.label}
            </Badge>
          )}

          <div className="truncate min-w-0 flex-1">
            <HighlightText
              text={truncate(previewText, 140)}
              query={searchQuery}
              className={cn(
                'text-[13px] leading-tight',
                isClipboard && item.contentType === 'code' && 'font-mono text-[12px]'
              )}
            />
          </div>
        </div>

        {/* Right: Metadata + Hover Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Metadata: App + Timestamp */}
          <div className="flex items-center gap-2 text-[11px] text-graphite-text-muted group-hover:hidden">
            {isClipboard && item.sourceApp && (
              <span className="hidden sm:inline-block rounded bg-graphite-surface-elevated px-1.5 py-0.2 text-[10px] text-graphite-text-secondary border border-graphite-border-subtle">
                {item.sourceApp}
              </span>
            )}
            <span>{formatRelativeTime(item.createdAt)}</span>
            {item.isPinned && <Pin className="h-3 w-3 text-accent fill-accent" />}
            {item.isFavorite && <Star className="h-3 w-3 text-status-warning fill-status-warning" />}
          </div>

          {/* Quick Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-1">
            <Tooltip content="Copy (Enter)">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyItem(item);
                }}
                aria-label="Copy item"
                className="flex h-6 w-6 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
            </Tooltip>

            <Tooltip content={item.isPinned ? 'Unpin' : 'Pin (P)'}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(item);
                }}
                aria-label={item.isPinned ? 'Unpin item' : 'Pin item'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-btn transition-colors',
                  item.isPinned
                    ? 'text-accent fill-accent bg-accent-muted'
                    : 'text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover'
                )}
              >
                <Pin className="h-3 w-3" />
              </button>
            </Tooltip>

            <Tooltip content={item.isFavorite ? 'Unfavorite' : 'Favorite'}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item);
                }}
                aria-label={item.isFavorite ? 'Remove favorite' : 'Add favorite'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-btn transition-colors',
                  item.isFavorite
                    ? 'text-status-warning fill-status-warning bg-status-warning-bg'
                    : 'text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover'
                )}
              >
                <Star className="h-3 w-3" />
              </button>
            </Tooltip>

            <Tooltip content="Delete (Del)">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteItem(item);
                }}
                aria-label="Delete item"
                className="flex h-6 w-6 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-status-error hover:bg-status-error-bg transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <ContextMenu
        isOpen={contextMenuPos !== null}
        position={contextMenuPos || { x: 0, y: 0 }}
        items={contextMenuItems}
        onClose={() => setContextMenuPos(null)}
      />
    </>
  );
};

