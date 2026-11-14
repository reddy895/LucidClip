import React from 'react';
import {
  FileText,
  Code2,
  Globe,
  FileJson,
  Image as ImageIcon,
  Files,
  Pin,
  Sparkles,
} from 'lucide-react';
import { ClipboardEntry, ClipboardContentType } from '@/types';

export interface PopupHistoryRowProps {
  entry: ClipboardEntry;
  isSelected: boolean;
  shortcutIndex?: number;
  onSelect: () => void;
  onPaste: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    const diff = Math.max(0, Date.now() - timestamp);
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } catch {
    return '';
  }
}

function getTypeIcon(type: ClipboardContentType) {
  switch (type) {
    case 'code':
      return <Code2 className="w-3 h-3 text-sky-400" />;
    case 'url':
      return <Globe className="w-3 h-3 text-emerald-400" />;
    case 'json':
      return <FileJson className="w-3 h-3 text-amber-400" />;
    case 'image':
      return <ImageIcon className="w-3 h-3 text-purple-400" />;
    case 'files':
      return <Files className="w-3 h-3 text-orange-400" />;
    default:
      return <FileText className="w-3 h-3 text-[#A1A7B0]" />;
  }
}

export const PopupHistoryRow = React.memo<PopupHistoryRowProps>(({
  entry,
  isSelected,
  shortcutIndex,
  onSelect,
  onPaste,
  onTogglePin,
}) => {
  const relativeTime = formatRelativeTime(entry.createdAt);

  return (
    <div
      onClick={onPaste}
      onMouseEnter={onSelect}
      className={`group relative flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors duration-100 ${
        isSelected
          ? 'bg-[#191C20] border-l-[3px] border-[#8B9CF7]'
          : 'hover:bg-[#151719] border-l-[3px] border-transparent'
      }`}
      data-testid={`popup-row-${entry.id}`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
        <div className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded bg-[#22262B] text-xs">
          {getTypeIcon(entry.contentType)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono uppercase text-[#A1A7B0] tracking-wider">
              {entry.contentType}
            </span>

            {entry.sourceApp && (
              <span className="text-[10px] text-[#6B7280] truncate max-w-[120px]">
                &bull; {entry.sourceApp}
              </span>
            )}

            {entry.isPinned && (
              <Pin className="w-2.5 h-2.5 text-[#8B9CF7] fill-[#8B9CF7] shrink-0 ml-0.5" />
            )}

            {entry.isFavorite && (
              <Sparkles className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0 ml-0.5" />
            )}

            {entry.usageCount && entry.usageCount > 1 ? (
              <span className="text-[9px] text-[#A1A7B0] bg-[#22262B] px-1 rounded-sm">
                x{entry.usageCount}
              </span>
            ) : null}
          </div>

          {entry.contentType === 'image' && (entry.thumbnailUrl || entry.imageUrl) ? (
            <div className="mt-1 flex items-center gap-2">
              <img
                src={entry.thumbnailUrl || entry.imageUrl}
                alt="Clipboard media"
                className="w-12 h-8 object-cover rounded border border-[#30363D] bg-black/40"
              />
              <span className="text-xs text-[#A1A7B0]">
                {entry.imageWidth && entry.imageHeight
                  ? `${entry.imageWidth} × ${entry.imageHeight} px`
                  : 'Image'}
              </span>
            </div>
          ) : (
            <p className="text-xs text-[#F3F4F6] truncate font-normal leading-relaxed">
              {entry.content}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#22262B] transition-opacity ${
              entry.isPinned ? 'opacity-100 text-[#8B9CF7]' : 'text-[#A1A7B0]'
            }`}
            title={entry.isPinned ? 'Unpin (Ctrl+P)' : 'Pin (Ctrl+P)'}
          >
            <Pin className="w-3 h-3" />
          </button>
        )}

        <div className="flex flex-col items-end text-right">
          {shortcutIndex ? (
            <span
              className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                isSelected
                  ? 'bg-[#8B9CF7]/20 text-[#8B9CF7] font-semibold'
                  : 'text-[#6B7280] bg-[#151719]'
              }`}
            >
              Alt+{shortcutIndex}
            </span>
          ) : (
            <span className="text-[10px] text-[#6B7280] font-mono">{relativeTime}</span>
          )}
        </div>
      </div>
    </div>
  );
});

PopupHistoryRow.displayName = 'PopupHistoryRow';

export default PopupHistoryRow;
