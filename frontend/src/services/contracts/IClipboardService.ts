import {
  ClipboardDiagnostics,
  ClipboardEntry,
  ClipboardMonitorStatus,
  ImageVariant,
} from '@/types';

export interface IClipboardService {
  getHistory(): Promise<ClipboardEntry[]>;
  getEntryById(id: string): Promise<ClipboardEntry | null>;
  getClipboardImageUrl(id: string, variant: ImageVariant): Promise<string>;
  clearImageCache(id?: string): void;
  copyToClipboard(content: string): Promise<boolean>;
  copyEntryById(id: string): Promise<boolean>;
  togglePin(id: string): Promise<ClipboardEntry>;
  toggleFavorite(id: string): Promise<ClipboardEntry>;
  deleteEntry(id: string): Promise<boolean>;
  clearHistory(): Promise<void>;
  addEntry(content: string, sourceApp?: string): Promise<ClipboardEntry>;
  getDiagnostics(): Promise<ClipboardDiagnostics>;
  getMonitorStatus(): Promise<ClipboardMonitorStatus>;
  setMonitoringEnabled(enabled: boolean): Promise<ClipboardMonitorStatus>;
  captureNow(): Promise<ClipboardEntry | null>;
}
