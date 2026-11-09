//! Tauri Native Clipboard Service Implementation

import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { IClipboardService } from '../contracts';
import { ClipboardContentType, ClipboardEntry } from '@/types';

export interface DbClipboardDto {
  id: string;
  content: string;
  content_type: string;
  source_app?: string;
  created_at: number;
  content_hash: string;
  pinned: boolean;
  favorite: boolean;
  image_path?: string;
  thumbnail_path?: string;
  image_width?: number;
  image_height?: number;
  byte_size?: number;
  file_count?: number;
}

export function mapDtoToEntry(dto: DbClipboardDto): ClipboardEntry {
  const charCount = dto.content.length;
  const wordCount = dto.content.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = dto.content.split('\n').length;
  const iso = new Date(dto.created_at).toISOString();

  let contentType: ClipboardContentType = 'text';
  if (
    ['multiline', 'code', 'url', 'json', 'color_code', 'path', 'image', 'files'].includes(
      dto.content_type
    )
  ) {
    contentType = dto.content_type as ClipboardContentType;
  }

  return {
    id: dto.id,
    content: dto.content,
    contentType,
    charCount,
    wordCount,
    lineCount,
    sourceApp: dto.source_app,
    imagePath: dto.image_path,
    thumbnailPath: dto.thumbnail_path,
    imageUrl: dto.image_path ? convertFileSrc(dto.image_path) : undefined,
    thumbnailUrl: dto.thumbnail_path ? convertFileSrc(dto.thumbnail_path) : undefined,
    imageWidth: dto.image_width,
    imageHeight: dto.image_height,
    byteSize: dto.byte_size,
    fileCount: dto.file_count,
    isPinned: dto.pinned,
    isFavorite: dto.favorite,
    createdAt: iso,
    updatedAt: iso,
  };
}

export class TauriClipboardService implements IClipboardService {
  async getHistory(): Promise<ClipboardEntry[]> {
    const list = await invoke<DbClipboardDto[]>('get_clipboard_entries');
    return list.map(mapDtoToEntry);
  }

  async getEntryById(id: string): Promise<ClipboardEntry | null> {
    const list = await this.getHistory();
    return list.find((e) => e.id === id) ?? null;
  }

  async copyToClipboard(content: string): Promise<boolean> {
    return await invoke<boolean>('copy_clipboard_entry', { content });
  }

  async copyEntryById(id: string): Promise<boolean> {
    return await invoke<boolean>('copy_clipboard_entry_by_id', { id });
  }

  async togglePin(id: string): Promise<ClipboardEntry> {
    await invoke<boolean>('toggle_clipboard_pin', { id });
    const updated = await this.getEntryById(id);
    if (!updated) throw new Error(`Entry ${id} not found after pin toggle`);
    return updated;
  }

  async toggleFavorite(id: string): Promise<ClipboardEntry> {
    await invoke<boolean>('toggle_clipboard_favorite', { id });
    const updated = await this.getEntryById(id);
    if (!updated) throw new Error(`Entry ${id} not found after favorite toggle`);
    return updated;
  }

  async deleteEntry(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_clipboard_entry', { id });
  }

  async clearHistory(): Promise<void> {
    await invoke<number>('clear_clipboard_history');
  }

  async addEntry(content: string, sourceApp?: string): Promise<ClipboardEntry> {
    const dto = await invoke<DbClipboardDto>('add_clipboard_entry', {
      content,
      sourceApp,
    });
    return mapDtoToEntry(dto);
  }
}
