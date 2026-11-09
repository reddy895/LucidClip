import React from 'react';
import { HistoryItem } from '@/types';
import { cn, formatRelativeTime, truncate } from '@/utils';
import { Badge } from '@/components/ui';
import { HighlightText } from '@/components/search';
import { FileText, Code, Link as LinkIcon, Camera, Pin, Star, Image as ImageIcon, Files } from 'lucide-react';

export interface QuickAccessItemProps {
  item: HistoryItem;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
  onExecute: () => void;
}

export const QuickAccessItem: React.FC<QuickAccessItemProps> = ({
  item,
  isSelected,
  searchQuery,
  onSelect,
  onExecute,
}) => {
  const isClipboard = item.kind === 'clipboard';

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
      ? `${item.fileCount ?? 0} file${(item.fileCount ?? 0) === 1 ? '' : 's'}`
      : item.content.replace(/\s+/g, ' ').trim()
    : item.ocrText
    ? item.ocrText.replace(/\s+/g, ' ').trim()
    : `${item.width} × ${item.height} ${item.captureType} screenshot`;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onExecute}
      onMouseEnter={onSelect}
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2 rounded-btn text-xs cursor-pointer select-none transition-colors duration-micro outline-none',
        isSelected
          ? 'bg-graphite-hover text-graphite-text-primary'
          : 'text-graphite-text-secondary hover:bg-graphite-hover/50 hover:text-graphite-text-primary'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {isClipboard && item.contentType === 'image' && item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt="Clipboard image thumbnail"
            className="h-7 w-10 shrink-0 rounded-[3px] border border-graphite-border object-cover"
            loading="lazy"
          />
        ) : (
          <Badge variant={currentType.variant} size="sm" className="font-mono text-[9px] shrink-0">
            {currentType.label}
          </Badge>
        )}
        <span className="truncate flex-1">
          <HighlightText
            text={truncate(previewText, 90)}
            query={searchQuery}
            className={cn(
              'text-[12px]',
              isClipboard && item.contentType === 'code' && 'font-mono'
            )}
          />
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10.5px] text-graphite-text-muted shrink-0">
        {item.isPinned && <Pin className="h-2.5 w-2.5 text-accent fill-accent" />}
        {item.isFavorite && <Star className="h-2.5 w-2.5 text-status-warning fill-status-warning" />}
        <span>{formatRelativeTime(item.createdAt)}</span>
      </div>
    </div>
  );
};

