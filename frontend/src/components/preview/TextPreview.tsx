import React from 'react';
import { ClipboardEntry, HistoryItem } from '@/types';
import { formatBytes, formatFullDateTime, formatRelativeTime } from '@/utils';
import { Badge, Button, Tooltip } from '@/components/ui';
import { CodeSnippetPreview } from '@/components/clipboard/CodeSnippetPreview';
import { UrlPreview } from '@/components/clipboard/UrlPreview';
import { Copy, Pin, Star, Trash2, Calendar, AppWindow, AlignLeft, Hash } from 'lucide-react';
import { useApp } from '@/context';

export interface TextPreviewProps {
  entry: ClipboardEntry;
}

export const TextPreview: React.FC<TextPreviewProps> = ({ entry }) => {
  const { copyItem, togglePin, toggleFavorite, deleteItem } = useApp();
  const asHistoryItem: HistoryItem = { kind: 'clipboard', ...entry };

  return (
    <div className="flex flex-col h-full p-4 gap-4 select-none">
      {/* Header Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-graphite-border">
        <div className="flex items-center gap-1.5">
          <Badge variant={entry.contentType === 'code' ? 'accent' : 'default'} size="sm">
            {entry.language ? entry.language.toUpperCase() : entry.contentType.toUpperCase()}
          </Badge>
          {entry.isPinned && (
            <Badge variant="accent" size="sm" className="gap-1">
              <Pin className="h-2.5 w-2.5 fill-accent" />
              Pinned
            </Badge>
          )}
          {entry.isFavorite && (
            <Badge variant="warning" size="sm" className="gap-1">
              <Star className="h-2.5 w-2.5 fill-status-warning" />
              Favorite
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Copy Content (Enter)">
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => copyItem(asHistoryItem)}
            >
              Copy
            </Button>
          </Tooltip>

          <Tooltip content={entry.isPinned ? 'Unpin' : 'Pin'}>
            <button
              type="button"
              onClick={() => togglePin(asHistoryItem)}
              className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
            >
              <Pin className={`h-3.5 w-3.5 ${entry.isPinned ? 'text-accent fill-accent' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip content={entry.isFavorite ? 'Unfavorite' : 'Favorite'}>
            <button
              type="button"
              onClick={() => toggleFavorite(asHistoryItem)}
              className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
            >
              <Star className={`h-3.5 w-3.5 ${entry.isFavorite ? 'text-status-warning fill-status-warning' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip content="Delete Entry">
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

      {/* Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        <div>
          <span className="text-[11px] font-medium text-graphite-text-muted uppercase tracking-wider block mb-1.5">
            Content
          </span>

          {entry.contentType === 'image' ? (
            <div className="rounded-btn border border-graphite-border bg-[#151719] p-2">
              {entry.imageUrl ? (
                <img
                  src={entry.imageUrl}
                  alt="Clipboard preview"
                  className="mx-auto max-h-[420px] w-auto rounded-[3px] object-contain"
                />
              ) : (
                <p className="p-3 text-xs text-status-error">
                  The stored image file is unavailable.
                </p>
              )}
            </div>
          ) : entry.contentType === 'files' ? (
            <div className="rounded-btn bg-[#151719] border border-graphite-border p-3 text-xs leading-relaxed text-[#F3F4F6] font-mono whitespace-pre-wrap break-all selectable-text">
              {entry.content}
            </div>
          ) : entry.contentType === 'code' ? (
            <CodeSnippetPreview code={entry.content} language={entry.language} />
          ) : entry.contentType === 'url' ? (
            <UrlPreview url={entry.content} />
          ) : (
            <div className="rounded-btn bg-[#151719] border border-graphite-border p-3 text-xs leading-relaxed text-[#F3F4F6] font-sans whitespace-pre-wrap break-words selectable-text">
              {entry.content}
            </div>
          )}
        </div>

        {/* Metadata Details */}
        <div className="pt-2 border-t border-graphite-border-subtle flex flex-col gap-2">
          <span className="text-[11px] font-medium text-graphite-text-muted uppercase tracking-wider block">
            Metadata
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {entry.contentType === 'image' ? (
              <div className="flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
                <Hash className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
                <div>
                  <div className="text-[10px] text-graphite-text-muted">Dimensions</div>
                  <div className="font-mono font-medium text-graphite-text-primary">
                    {entry.imageWidth ?? '?'} × {entry.imageHeight ?? '?'}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
                  <Hash className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
                  <div>
                    <div className="text-[10px] text-graphite-text-muted">Characters</div>
                    <div className="font-mono font-medium text-graphite-text-primary">
                      {entry.charCount}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
                  <AlignLeft className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
                  <div>
                    <div className="text-[10px] text-graphite-text-muted">Words / Lines</div>
                    <div className="font-mono font-medium text-graphite-text-primary">
                      {entry.wordCount}w / {entry.lineCount}L
                    </div>
                  </div>
                </div>
              </>
            )}

            {entry.contentType === 'image' || entry.contentType === 'files' ? (
              <div className="flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
                <Hash className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
                <div>
                  <div className="text-[10px] text-graphite-text-muted">
                    {entry.contentType === 'files' ? 'Files' : 'Size'}
                  </div>
                  <div className="font-mono font-medium text-graphite-text-primary">
                    {entry.contentType === 'files'
                      ? entry.fileCount ?? 0
                      : typeof entry.byteSize === 'number'
                      ? formatBytes(entry.byteSize)
                      : 'Unknown'}
                  </div>
                </div>
              </div>
            ) : null}

            {entry.sourceApp && (
              <div className="col-span-2 flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
                <AppWindow className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
                <div>
                  <div className="text-[10px] text-graphite-text-muted">Source Application</div>
                  <div className="font-medium text-graphite-text-primary truncate">
                    {entry.sourceApp}
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-2 flex items-center gap-2 rounded-btn bg-graphite-surface p-2 border border-graphite-border-subtle">
              <Calendar className="h-3.5 w-3.5 text-graphite-text-muted shrink-0" />
              <div>
                <div className="text-[10px] text-graphite-text-muted">Captured At</div>
                <div className="text-graphite-text-primary text-[11px]">
                  {formatFullDateTime(entry.createdAt)} ({formatRelativeTime(entry.createdAt)})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

