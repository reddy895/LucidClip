//! Tauri Native Screenshot Service Implementation

import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { IScreenshotService } from '../contracts';
import { CaptureType, ScreenshotEntry } from '@/types';

interface DbScreenshotDto {
  id: string;
  original_path: string;
  thumbnail_path: string;
  width: number;
  height: number;
  file_size: number;
  ocr_text?: string;
  created_at: number;
  pinned: boolean;
  favorite: boolean;
}

function mapDtoToEntry(dto: DbScreenshotDto): ScreenshotEntry {
  return {
    id: dto.id,
    // Screenshot files live outside the webview origin, so they must be
    // served through Tauri's scoped asset protocol.
    thumbnailUrl: convertFileSrc(dto.thumbnail_path),
    fullImageUrl: convertFileSrc(dto.original_path),
    width: dto.width,
    height: dto.height,
    fileSizeBytes: dto.file_size,
    ocrText: dto.ocr_text,
    ocrStatus: dto.ocr_text ? 'completed' : 'none',
    captureType: 'fullscreen',
    isPinned: dto.pinned,
    isFavorite: dto.favorite,
    createdAt: new Date(dto.created_at).toISOString(),
  };
}

export class TauriScreenshotService implements IScreenshotService {
  async getScreenshots(): Promise<ScreenshotEntry[]> {
    try {
      const list = await invoke<DbScreenshotDto[]>('get_screenshots');
      return list.map(mapDtoToEntry);
    } catch (err) {
      console.error('[LucidClip] Failed to fetch screenshots from backend:', err);
      return [];
    }
  }

  async getScreenshotById(id: string): Promise<ScreenshotEntry | null> {
    const list = await this.getScreenshots();
    return list.find((s) => s.id === id) ?? null;
  }

  async captureScreen(type: CaptureType): Promise<ScreenshotEntry> {
    console.log(`[LucidClip] Requesting ${type} screen capture`);
    const list = await this.getScreenshots();
    if (list.length > 0) return list[0];
    throw new Error('Capture triggered; awaiting user selection.');
  }

  async copyImageToClipboard(id: string): Promise<boolean> {
    const entry = await this.getScreenshotById(id);
    return !!entry;
  }

  async togglePin(id: string): Promise<ScreenshotEntry> {
    await invoke<boolean>('toggle_screenshot_pin', { id });
    const updated = await this.getScreenshotById(id);
    if (!updated) throw new Error(`Screenshot ${id} not found after pin toggle`);
    return updated;
  }

  async toggleFavorite(id: string): Promise<ScreenshotEntry> {
    await invoke<boolean>('toggle_screenshot_favorite', { id });
    const updated = await this.getScreenshotById(id);
    if (!updated) throw new Error(`Screenshot ${id} not found after favorite toggle`);
    return updated;
  }

  async deleteScreenshot(id: string): Promise<boolean> {
    try {
      return await invoke<boolean>('delete_screenshot', { id });
    } catch (err) {
      console.error('[LucidClip] Failed to delete screenshot via backend:', err);
      return false;
    }
  }

  async exportScreenshot(id: string, _targetPath: string): Promise<boolean> {
    const entry = await this.getScreenshotById(id);
    return !!entry;
  }
}
