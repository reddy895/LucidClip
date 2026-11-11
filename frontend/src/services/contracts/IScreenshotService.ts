import { CaptureType, ImageVariant, ScreenshotEntry, ScreenshotRegion } from '@/types';

export interface IScreenshotService {
  getScreenshots(): Promise<ScreenshotEntry[]>;
  getScreenshotById(id: string): Promise<ScreenshotEntry | null>;
  getScreenshotImageUrl(id: string, variant: ImageVariant): Promise<string>;
  clearImageCache(id?: string): void;
  captureScreen(type: CaptureType): Promise<ScreenshotEntry>;
  beginRegionCapture(): Promise<ScreenshotEntry>;
  cropScreenshot(
    sourceId: string,
    region: ScreenshotRegion,
    removeSource?: boolean
  ): Promise<ScreenshotEntry>;
  togglePin(id: string): Promise<ScreenshotEntry>;
  toggleFavorite(id: string): Promise<ScreenshotEntry>;
  deleteScreenshot(id: string): Promise<boolean>;
  copyImageToClipboard(id: string): Promise<boolean>;
  exportScreenshot(id: string): Promise<string>;
}

