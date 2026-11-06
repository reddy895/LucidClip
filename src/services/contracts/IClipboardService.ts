import { ClipboardEntry } from '@/types';

export interface IClipboardService {
  getHistory(): Promise<ClipboardEntry[]>;
  getEntryById(id: string): Promise<ClipboardEntry | null>;
  copyToClipboard(content: string): Promise<boolean>;
  togglePin(id: string): Promise<ClipboardEntry>;
  toggleFavorite(id: string): Promise<ClipboardEntry>;
  deleteEntry(id: string): Promise<boolean>;
  clearHistory(): Promise<void>;
  addEntry(content: string, sourceApp?: string): Promise<ClipboardEntry>;
}
