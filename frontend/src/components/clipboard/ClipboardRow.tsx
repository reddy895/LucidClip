import React, { useState } from 'react';
import { ClipboardEntry, HistoryItem } from '@/types';
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
  ExternalLink,
  Image as ImageIcon,
  Files,
} from 'lucide-react';
import { useApp } from '@/context';

export interface ClipboardRowProps {
  entry: ClipboardEntry;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
}

export const ClipboardRow: React.FC<ClipboardRowProps> = ({
  entry,
  isSelected,
  searchQuery,
  onSelect,
}) => {
  const { copyItem, togglePin, toggleFavorite, deleteItem } = useApp();
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const asHistoryItem: HistoryItem = { kind: 'clipboard', ...entry };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleDoubleClick = () => {
    copyItem(asHistoryItem);
  };

  const typeConfig = {
    text: { label: 'TXT', icon: <FileText className="h-3 w-3" />, variant: 'default' as const },
    multiline: { label: 'NOTE', icon: <FileText className="h-3 w-3" />, variant: 'default' as const },
    code: {
      label: entry.language ? entry.language.toUpperCase() : 'CODE',
      icon: <Code className="h-3 w-3" />,
      variant: 'accent' as const,
    },
    url: { label: 'URL', icon: <LinkIcon className="h-3 w-3" />, variant: 'accent' as const },
    json: { label: 'JSON', icon: <Code className="h-3 w-3" />, variant: 'accent' as const },
    color_code: { label: 'COLOR', icon: <FileText className="h-3 w-3" />, variant: 'accent' as const },
    path: { label: 'PATH', icon: <FileText className="h-3 w-3" />, variant: 'default' as const },
    image: { label: 'IMG', icon: <ImageIcon className="h-3 w-3" />, variant: 'accent' as const },
    files: { label: 'FILES', icon: <Files className="h-3 w-3" />, variant: 'default' as const },
  };

  const config = typeConfig[entry.contentType];
  const previewText =
    entry.contentType === 'image'
      ? `${entry.imageWidth ?? '?'} × ${entry.imageHeight ?? '?'} image`
      : entry.contentType === 'files'
      ? `${entry.fileCount ?? 0} file${(entry.fileCount ?? 0) === 1 ? '' : 's'}: ${entry.content
          .replace(/\s+/g, ' ')
          .trim()}`
      : entry.content.replace(/\s+/g, ' ').trim();

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: 'copy',
      label: 'Copy to Clipboard',
      icon: <Copy className="h-3.5 w-3.5" />,
      shortcut: 'Enter',
      onClick: () => copyItem(asHistoryItem),
    },
    {
      id: 'pin',
      label: entry.isPinned ? 'Unpin Entry' : 'Pin Entry',
      icon: <Pin className="h-3.5 w-3.5" />,
      shortcut: 'P',
      onClick: () => togglePin(asHistoryItem),
    },
    {
      id: 'favorite',
      label: entry.isFavorite ? 'Remove Favorite' : 'Mark Favorite',
      icon: <Star className="h-3.5 w-3.5" />,
      onClick: () => toggleFavorite(asHistoryItem),
    },
    ...(entry.contentType === 'url'
      ? [
          {
            id: 'open-url',
            label: 'Open in Browser',
            icon: <ExternalLink className="h-3.5 w-3.5" />,
            onClick: () => window.open(entry.content, '_blank'),
          },
        ]
      : []),
    { id: 'div-1', label: '', isDivider: true },
    {
      id: 'delete',
      label: 'Delete Entry',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      isDanger: true,
      shortcut: 'Del',
      onClick: () => deleteItem(asHistoryItem),
    },
  ];

  return (
    <>
      <div
        role="row"
        tabIndex={0}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={cn(
          'group relative flex items-center justify-between gap-3 rounded-btn px-3 py-2 text-[13px] transition-colors duration-micro cursor-pointer border select-none outline-none focus-visible:ring-1 focus-visible:ring-accent',
          isSelected
            ? 'bg-graphite-surface-elevated text-graphite-text-primary border-graphite-border shadow-sm'
            : 'bg-graphite-surface/40 text-graphite-text-secondary hover:bg-graphite-surface hover:text-graphite-text-primary border-transparent'
        )}
      >
        {/* Left: Type badge + text preview */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {entry.contentType === 'image' && entry.thumbnailUrl ? (
            <img
              src={entry.thumbnailUrl}
              alt="Clipboard image thumbnail"
              className="h-8 w-11 shrink-0 rounded-[3px] border border-graphite-border object-cover"
              loading="lazy"
            />
          ) : (
            <Badge variant={config.variant} size="sm" className="font-mono text-[10px]">
              {config.label}
            </Badge>
          )}

          <div className="truncate min-w-0 flex-1">
            <HighlightText
              text={truncate(previewText, 140)}
              query={searchQuery}
              className={cn(
                'text-[13px] leading-tight',
                entry.contentType === 'code' && 'font-mono text-[12px]'
              )}
            />
          </div>
        </div>

        {/* Right: Info + Quick Hover Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-graphite-text-muted group-hover:hidden">
            {entry.lineCount > 1 && (
              <span className="hidden sm:inline font-mono">{entry.lineCount} lines</span>
            )}
            {entry.sourceApp && (
              <span className="hidden sm:inline-block rounded bg-graphite-surface-elevated px-1.5 py-0.2 text-[10px] text-graphite-text-secondary border border-graphite-border-subtle">
                {entry.sourceApp}
              </span>
            )}
            <span>{formatRelativeTime(entry.createdAt)}</span>
            {entry.isPinned && <Pin className="h-3 w-3 text-accent fill-accent" />}
            {entry.isFavorite && <Star className="h-3 w-3 text-status-warning fill-status-warning" />}
          </div>

          {/* Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-1">
            <Tooltip content="Copy (Enter)">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyItem(asHistoryItem);
                }}
                aria-label="Copy entry"
                className="flex h-6 w-6 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
            </Tooltip>

            <Tooltip content={entry.isPinned ? 'Unpin' : 'Pin (P)'}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(asHistoryItem);
                }}
                aria-label={entry.isPinned ? 'Unpin entry' : 'Pin entry'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-btn transition-colors',
                  entry.isPinned
                    ? 'text-accent fill-accent bg-accent-muted'
                    : 'text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover'
                )}
              >
                <Pin className="h-3 w-3" />
              </button>
            </Tooltip>

            <Tooltip content={entry.isFavorite ? 'Unfavorite' : 'Favorite'}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(asHistoryItem);
                }}
                aria-label={entry.isFavorite ? 'Remove favorite' : 'Add favorite'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-btn transition-colors',
                  entry.isFavorite
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
                  deleteItem(asHistoryItem);
                }}
                aria-label="Delete entry"
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

