import { IClipboardService } from '../contracts';
import {
  ClipboardDiagnostics,
  ClipboardEntry,
  ClipboardMonitorStatus,
  ImageVariant,
} from '@/types';
import { copyTextToClipboard, detectContentType } from '@/utils';

const STORAGE_KEY = 'lucidclip_clipboard_history';

export class MockClipboardService implements IClipboardService {
  private entries: ClipboardEntry[] = [];
  private isLoaded = false;
  private monitoringEnabled = true;

  private load(): ClipboardEntry[] {
    if (this.isLoaded) return this.entries;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.entries = JSON.parse(stored);
        this.isLoaded = true;
        return this.entries;
      }
    } catch (e) {
      console.warn('Failed to parse clipboard history from localStorage', e);
    }

    // Real data only: fresh installation produces a genuinely empty history
    this.entries = [];
    this.save();
    this.isLoaded = true;
    return this.entries;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch (e) {
      console.warn('Failed to save clipboard history to localStorage', e);
    }
  }

  async getHistory(): Promise<ClipboardEntry[]> {
    return Promise.resolve([...this.load()]);
  }

  async getEntryById(id: string): Promise<ClipboardEntry | null> {
    const list = this.load();
    const found = list.find((item) => item.id === id);
    return Promise.resolve(found ? { ...found } : null);
  }

  async getClipboardImageUrl(id: string, variant: ImageVariant): Promise<string> {
    const found = await this.getEntryById(id);
    const url = variant === 'thumbnail' ? found?.thumbnailUrl : found?.imageUrl;
    if (!url) throw new Error('Clipboard images require the LucidClip desktop application.');
    return url;
  }

  clearImageCache(): void {
    // Browser preview data is already held in memory.
  }

  async copyEntryById(id: string): Promise<boolean> {
    const entry = this.entries.find((item) => item.id === id);
    if (!entry) return false;
    return this.copyToClipboard(entry.content);
  }

  async copyToClipboard(content: string): Promise<boolean> {
    return copyTextToClipboard(content);
  }

  async togglePin(id: string): Promise<ClipboardEntry> {
    const list = this.load();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Clipboard entry with ID ${id} not found.`);
    }

    const updated: ClipboardEntry = {
      ...list[index],
      isPinned: !list[index].isPinned,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.entries = [...list];
    this.save();
    return Promise.resolve(updated);
  }

  async toggleFavorite(id: string): Promise<ClipboardEntry> {
    const list = this.load();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Clipboard entry with ID ${id} not found.`);
    }

    const updated: ClipboardEntry = {
      ...list[index],
      isFavorite: !list[index].isFavorite,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.entries = [...list];
    this.save();
    return Promise.resolve(updated);
  }

  async deleteEntry(id: string): Promise<boolean> {
    const list = this.load();
    const initialLen = list.length;
    this.entries = list.filter((item) => item.id !== id);
    if (this.entries.length !== initialLen) {
      this.save();
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  async clearHistory(): Promise<void> {
    // Keep pinned items when clearing history per standard desktop clipboard manager convention
    const list = this.load();
    this.entries = list.filter((item) => item.isPinned || item.isFavorite);
    this.save();
    return Promise.resolve();
  }

  async addEntry(content: string, sourceApp = 'Manual'): Promise<ClipboardEntry> {
    const list = this.load();
    const { type, language } = detectContentType(content);
    const nowIso = new Date().toISOString();

    const charCount = content.length;
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const lineCount = content.split('\n').length;

    const newEntry: ClipboardEntry = {
      id: `clip-${Date.now()}`,
      content,
      contentType: type,
      language,
      charCount,
      wordCount,
      lineCount,
      sourceApp,
      isPinned: false,
      isFavorite: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.entries = [newEntry, ...list];
    this.save();
    return Promise.resolve(newEntry);
  }

  async getDiagnostics(): Promise<ClipboardDiagnostics> {
    return Promise.resolve({
      os: 'browser',
      session: 'unsupported',
      session_type: null,
      wayland_display: null,
      display: null,
      desktop: null,
      backend: 'mock',
      monitoring_supported: false,
      supports_text: false,
      supports_images: false,
      supports_files: false,
      utilities: { wl_paste: false, wl_copy: false, xclip: false, xsel: false },
      diagnostics: [
        'Browser preview mode: native clipboard monitoring is only available in the desktop app.',
      ],
    });
  }

  async getMonitorStatus(): Promise<ClipboardMonitorStatus> {
    return Promise.resolve({
      supported: false,
      running: false,
      paused: !this.monitoringEnabled,
      backend: 'mock',
      session: 'unsupported',
      captures: 0,
      last_capture_at: null,
      last_error: null,
      started_at: null,
    });
  }

  async setMonitoringEnabled(enabled: boolean): Promise<ClipboardMonitorStatus> {
    this.monitoringEnabled = enabled;
    return this.getMonitorStatus();
  }

  async captureNow(): Promise<ClipboardEntry | null> {
    return Promise.resolve(null);
  }
}

export const clipboardService = new MockClipboardService();

