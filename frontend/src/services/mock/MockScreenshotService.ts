import { IScreenshotService } from '../contracts';
import { CaptureType, ImageVariant, ScreenshotEntry, ScreenshotRegion } from '@/types';

const STORAGE_KEY = 'lucidclip_screenshot_history';

export class MockScreenshotService implements IScreenshotService {
  private screenshots: ScreenshotEntry[] = [];
  private isLoaded = false;

  private load(): ScreenshotEntry[] {
    if (this.isLoaded) return this.screenshots;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.screenshots = JSON.parse(stored);
        this.isLoaded = true;
        return this.screenshots;
      }
    } catch (e) {
      console.warn('Failed to parse screenshot history from localStorage', e);
    }

    // Real data only: fresh installation produces a genuinely empty gallery
    this.screenshots = [];
    this.save();
    this.isLoaded = true;
    return this.screenshots;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.screenshots));
    } catch (e) {
      console.warn('Failed to save screenshot history to localStorage', e);
    }
  }

  async getScreenshots(): Promise<ScreenshotEntry[]> {
    return Promise.resolve([...this.load()]);
  }

  async getScreenshotById(id: string): Promise<ScreenshotEntry | null> {
    const list = this.load();
    const found = list.find((item) => item.id === id);
    return Promise.resolve(found ? { ...found } : null);
  }

  async getScreenshotImageUrl(id: string, variant: ImageVariant): Promise<string> {
    const found = await this.getScreenshotById(id);
    const url = variant === 'thumbnail' ? found?.thumbnailUrl : found?.fullImageUrl;
    if (!url) throw new Error('Screenshot images require the LucidClip desktop application.');
    return url;
  }

  clearImageCache(): void {
    // Browser preview data is already held in memory.
  }

  async captureScreen(_type: CaptureType): Promise<ScreenshotEntry> {
    throw new Error('Screenshot capture requires the LucidClip desktop application.');
  }

  async beginRegionCapture(): Promise<ScreenshotEntry> {
    throw new Error('Region capture requires the LucidClip desktop application.');
  }

  async cropScreenshot(
    _sourceId: string,
    _region: ScreenshotRegion,
    _removeSource?: boolean
  ): Promise<ScreenshotEntry> {
    throw new Error('Region capture requires the LucidClip desktop application.');
  }

  async togglePin(id: string): Promise<ScreenshotEntry> {
    const list = this.load();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Screenshot with ID ${id} not found.`);
    }

    const updated: ScreenshotEntry = {
      ...list[index],
      isPinned: !list[index].isPinned,
    };

    list[index] = updated;
    this.screenshots = [...list];
    this.save();
    return Promise.resolve(updated);
  }

  async toggleFavorite(id: string): Promise<ScreenshotEntry> {
    const list = this.load();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Screenshot with ID ${id} not found.`);
    }

    const updated: ScreenshotEntry = {
      ...list[index],
      isFavorite: !list[index].isFavorite,
    };

    list[index] = updated;
    this.screenshots = [...list];
    this.save();
    return Promise.resolve(updated);
  }

  async deleteScreenshot(id: string): Promise<boolean> {
    const list = this.load();
    const initialLen = list.length;
    this.screenshots = list.filter((item) => item.id !== id);
    if (this.screenshots.length !== initialLen) {
      this.save();
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  async copyImageToClipboard(_id: string): Promise<boolean> {
    throw new Error('Copying screenshot images requires the LucidClip desktop application.');
  }

  async exportScreenshot(_id: string): Promise<string> {
    throw new Error('Exporting screenshots requires the LucidClip desktop application.');
  }
}

export const screenshotService = new MockScreenshotService();
