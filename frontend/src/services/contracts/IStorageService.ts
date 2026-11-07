export interface StorageStats {
  dbSizeBytes: number;
  screenshotStorageBytes: number;
  entryCount: number;
  screenshotCount: number;
}

export interface IStorageService {
  getStorageUsage(): Promise<StorageStats>;
}

