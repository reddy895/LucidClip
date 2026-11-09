export type ClipboardContentType =
  | 'text'
  | 'code'
  | 'url'
  | 'json'
  | 'multiline'
  | 'color_code'
  | 'path';

export interface ClipboardEntry {
  id: string;
  content: string;
  contentType: ClipboardContentType;
  language?: string;
  charCount: number;
  wordCount: number;
  lineCount: number;
  sourceApp?: string;
  sourceAppIcon?: string;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

