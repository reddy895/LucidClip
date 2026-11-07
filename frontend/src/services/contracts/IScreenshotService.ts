import { CaptureType, ScreenshotEntry } from '@/types';

export interface IScreenshotService {
  getScreenshots(): Promise<ScreenshotEntry[]>;
  getScreenshotById(id: string): Promise<ScreenshotEntry | null>;
  captureScreen(type: CaptureType): Promise<ScreenshotEntry>;
  togglePin(id: string): Promise<ScreenshotEntry>;
  toggleFavorite(id: string): Promise<ScreenshotEntry>;
  deleteScreenshot(id: string): Promise<boolean>;
  copyImageToClipboard(id: string): Promise<boolean>;
  exportScreenshot(id: string, destinationPath?: string): Promise<boolean>;
}

