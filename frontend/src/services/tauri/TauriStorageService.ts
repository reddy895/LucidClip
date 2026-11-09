//! Tauri Native Storage Service Implementation

import { invoke } from '@tauri-apps/api/core';
import { IStorageService, StorageStats } from '../contracts';

interface StorageStatsDto {
  db_size_bytes: number;
  screenshot_storage_bytes: number;
  total_storage_bytes: number;
  entry_count: number;
  screenshot_count: number;
}

export class TauriStorageService implements IStorageService {
  async getStorageUsage(): Promise<StorageStats> {
    try {
      const stats = await invoke<StorageStatsDto>('get_storage_stats');
      return {
        dbSizeBytes: stats.db_size_bytes,
        screenshotStorageBytes: stats.screenshot_storage_bytes,
        entryCount: stats.entry_count,
        screenshotCount: stats.screenshot_count,
      };
    } catch (err) {
      console.error('[LucidClip] Failed to read storage statistics:', err);
      throw err;
    }
  }
}
