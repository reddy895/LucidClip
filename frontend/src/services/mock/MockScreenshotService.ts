import { IScreenshotService } from '../contracts';
import { CaptureType, ScreenshotEntry } from '@/types';

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

  async captureScreen(type: CaptureType): Promise<ScreenshotEntry> {
    const list = this.load();
    const id = `shot-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const title = type === 'fullscreen' ? 'Desktop Snapshot' : 'Selected Region';
    const accent = type === 'fullscreen' ? '#8B9CF7' : '#55B889';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380" fill="none">
      <rect width="600" height="380" rx="10" fill="#151719"/>
      <rect x="1" y="1" width="598" height="378" rx="9" stroke="#30363D" stroke-width="1.5"/>
      <rect width="600" height="42" rx="10" fill="#191C20"/>
      <circle cx="24" cy="21" r="5" fill="#55B889"/>
      <text x="40" y="25" fill="#F3F4F6" font-family="sans-serif" font-weight="600" font-size="12">${title}</text>
      <rect x="480" y="12" width="100" height="18" rx="4" fill="${accent}" fill-opacity="0.2"/>
      <text x="530" y="25" fill="${accent}" font-family="sans-serif" font-weight="500" font-size="10" text-anchor="middle">${type.toUpperCase()}</text>
      <line x1="0" y1="42" x2="600" y2="42" stroke="#30363D" stroke-width="1"/>
      <text x="28" y="110" fill="#A1A7B0" font-family="monospace" font-size="12">Captured: ${new Date().toLocaleTimeString()}</text>
      <text x="28" y="140" fill="#A1A7B0" font-family="monospace" font-size="12">Type: ${type.toUpperCase()}</text>
      <text x="28" y="170" fill="#55B889" font-family="monospace" font-size="12">OCR Result: Local OCR text extracted successfully</text>
    </svg>`;

    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    const newShot: ScreenshotEntry = {
      id,
      thumbnailUrl: dataUri,
      fullImageUrl: dataUri,
      width: type === 'fullscreen' ? 1920 : 800,
      height: type === 'fullscreen' ? 1080 : 600,
      fileSizeBytes: 320000,
      ocrText: `Captured: ${new Date().toLocaleTimeString()}\nType: ${type.toUpperCase()}\nOCR Result: Local OCR text extracted successfully`,
      ocrStatus: 'completed',
      captureType: type,
      isPinned: false,
      isFavorite: false,
      createdAt: timestamp,
    };

    this.screenshots = [newShot, ...list];
    this.save();
    return Promise.resolve(newShot);
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
    // Simulated native clipboard copy for desktop
    return Promise.resolve(true);
  }

  async exportScreenshot(_id: string, _destinationPath?: string): Promise<boolean> {
    // Simulated export
    return Promise.resolve(true);
  }
}

export const screenshotService = new MockScreenshotService();
