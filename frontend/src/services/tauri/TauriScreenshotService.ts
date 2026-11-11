//! Tauri Native Screenshot Service Implementation

import { invoke } from '@tauri-apps/api/core';
import { IScreenshotService } from '../contracts';
import { CaptureType, ImageVariant, ScreenshotEntry, ScreenshotRegion } from '@/types';

interface DbScreenshotDto {
  id: string;
  original_path: string;
  thumbnail_path: string;
  width: number;
  height: number;
  file_size: number;
  ocr_text?: string | null;
  created_at: number;
  pinned: boolean;
  favorite: boolean;
  capture_type: string;
  thumbnail_available?: boolean;
  original_available?: boolean;
  region_x?: number | null;
  region_y?: number | null;
  region_width?: number | null;
  region_height?: number | null;
}

function mapDtoToEntry(dto: DbScreenshotDto): ScreenshotEntry {
  const capturedRegion =
    dto.region_x != null &&
    dto.region_y != null &&
    dto.region_width != null &&
    dto.region_height != null
      ? {
          x: dto.region_x,
          y: dto.region_y,
          width: dto.region_width,
          height: dto.region_height,
        }
      : undefined;

  return {
    id: dto.id,
    // Image bytes are fetched on demand through the validated IPC command.
    thumbnailUrl: undefined,
    fullImageUrl: undefined,
    thumbnailAvailable: dto.thumbnail_available,
    originalAvailable: dto.original_available,
    width: dto.width,
    height: dto.height,
    fileSizeBytes: dto.file_size,
    ocrText: dto.ocr_text ?? undefined,
    ocrStatus: dto.ocr_text ? 'completed' : 'none',
    captureType: dto.capture_type === 'region' ? 'region' : 'fullscreen',
    capturedRegion,
    isPinned: dto.pinned,
    isFavorite: dto.favorite,
    createdAt: new Date(dto.created_at).toISOString(),
  };
}

const imageCache = new Map<string, Promise<string>>();

function cacheKey(id: string, variant: ImageVariant): string {
  return `${variant}:${id}`;
}

export class TauriScreenshotService implements IScreenshotService {
  async getScreenshots(): Promise<ScreenshotEntry[]> {
    const list = await invoke<DbScreenshotDto[]>('get_screenshots');
    return list.map(mapDtoToEntry);
  }

  async getScreenshotImageUrl(id: string, variant: ImageVariant): Promise<string> {
    const key = cacheKey(id, variant);
    const cached = imageCache.get(key);
    if (cached) return cached;

    const request = invoke<string>('get_screenshot_image', { id, variant }).catch((err) => {
      imageCache.delete(key);
      throw err;
    });
    imageCache.set(key, request);
    return request;
  }

  clearImageCache(id?: string): void {
    if (!id) {
      imageCache.clear();
      return;
    }
    imageCache.delete(cacheKey(id, 'thumbnail'));
    imageCache.delete(cacheKey(id, 'original'));
  }

  async getScreenshotById(id: string): Promise<ScreenshotEntry | null> {
    const list = await this.getScreenshots();
    return list.find((s) => s.id === id) ?? null;
  }

  async captureScreen(type: CaptureType): Promise<ScreenshotEntry> {
    if (type !== 'fullscreen') {
      throw new Error('Use beginRegionCapture to select a desktop region.');
    }
    const dto = await invoke<DbScreenshotDto>('capture_screenshot', {
      captureType: type,
    });
    this.clearImageCache(dto.id);
    return mapDtoToEntry(dto);
  }

  async beginRegionCapture(): Promise<ScreenshotEntry> {
    const dto = await invoke<DbScreenshotDto>('capture_screenshot', {
      captureType: 'fullscreen',
    });
    this.clearImageCache(dto.id);
    return mapDtoToEntry(dto);
  }

  async cropScreenshot(
    sourceId: string,
    region: ScreenshotRegion,
    removeSource = true
  ): Promise<ScreenshotEntry> {
    const dto = await invoke<DbScreenshotDto>('crop_screenshot', {
      sourceId,
      region,
      removeSource,
    });
    this.clearImageCache(sourceId);
    this.clearImageCache(dto.id);
    return mapDtoToEntry(dto);
  }

  async copyImageToClipboard(id: string): Promise<boolean> {
    return await invoke<boolean>('copy_screenshot_image', { id });
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
    const deleted = await invoke<boolean>('delete_screenshot', { id });
    if (deleted) this.clearImageCache(id);
    return deleted;
  }

  async exportScreenshot(id: string): Promise<string> {
    return await invoke<string>('export_screenshot', { id });
  }
}
