//! Tauri Native Clipboard Service Implementation

import { invoke } from '@tauri-apps/api/core';
import { IClipboardService } from '../contracts';
import { ClipboardContentType, ClipboardEntry } from '@/types';

interface DbClipboardDto {
  id: string;
  content: string;
  content_type: string;
  source_app?: string;
  created_at: number;
  content_hash: string;
  pinned: boolean;
  favorite: boolean;
}

function mapDtoToEntry(dto: DbClipboardDto): ClipboardEntry {
  const charCount = dto.content.length;
  const wordCount = dto.content.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = dto.content.split('\n').length;
  const iso = new Date(dto.created_at).toISOString();

  let contentType: ClipboardContentType = 'text';
  if (dto.content_type === 'multiline') {
    contentType = 'multiline';
  } else if (['code', 'url', 'json'].includes(dto.content_type)) {
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
    isPinned: dto.pinned,
    isFavorite: dto.favorite,
    createdAt: iso,
    updatedAt: iso,
  };
}

export class TauriClipboardService implements IClipboardService {
  async getHistory(): Promise<ClipboardEntry[]> {
    try {
      const list = await invoke<DbClipboardDto[]>('get_clipboard_entries');
      return list.map(mapDtoToEntry);
    } catch (err) {
      console.error('[LucidClip] Failed to fetch clipboard history from backend:', err);
      return [];
    }
  }

  async getEntryById(id: string): Promise<ClipboardEntry | null> {
    const list = await this.getHistory();
    return list.find((e) => e.id === id) ?? null;
  }

  async copyToClipboard(content: string): Promise<boolean> {
    try {
      return await invoke<boolean>('copy_clipboard_entry', { content });
    } catch (err) {
      console.error('[LucidClip] Failed to copy to clipboard via backend:', err);
      return false;
    }
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
    try {
      return await invoke<boolean>('delete_clipboard_entry', { id });
    } catch (err) {
      console.error('[LucidClip] Failed to delete entry via backend:', err);
      return false;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await invoke<number>('clear_clipboard_history');
    } catch (err) {
      console.error('[LucidClip] Failed to clear history via backend:', err);
    }
  }

  async addEntry(content: string, sourceApp?: string): Promise<ClipboardEntry> {
    const dto = await invoke<DbClipboardDto>('add_clipboard_entry', {
      content,
      sourceApp,
    });
    return mapDtoToEntry(dto);
  }
}
