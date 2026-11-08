//! Tauri Native Storage Service Implementation

import { invoke } from '@tauri-apps/api/core';
import { IStorageService, StorageStats } from '../contracts';

interface StorageStatsDto {
  db_size_bytes: number;
  screenshot_storage_bytes: number;
  total_storage_bytes: number;
}

export class TauriStorageService implements IStorageService {
  async getStorageUsage(): Promise<StorageStats> {
    try {
      const stats = await invoke<StorageStatsDto>('get_storage_stats');
      return {
        dbSizeBytes: stats.db_size_bytes,
        screenshotStorageBytes: stats.screenshot_storage_bytes,
        entryCount: 0,
        screenshotCount: 0,
      };
    } catch {
      return {
        dbSizeBytes: 0,
        screenshotStorageBytes: 0,
        entryCount: 0,
        screenshotCount: 0,
      };
    }
  }
}
