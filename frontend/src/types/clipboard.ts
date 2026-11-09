export type ClipboardContentType =
  | 'text'
  | 'code'
  | 'url'
  | 'json'
  | 'multiline'
  | 'color_code'
  | 'path'
  | 'image'
  | 'files';

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
  imagePath?: string;
  thumbnailPath?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  byteSize?: number;
  fileCount?: number;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

