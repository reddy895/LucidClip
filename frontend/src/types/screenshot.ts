export type OcrStatus = 'none' | 'pending' | 'completed' | 'failed';
export type CaptureType = 'fullscreen' | 'region';
export type ImageVariant = 'thumbnail' | 'original';

export interface ScreenshotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotEntry {
  id: string;
  thumbnailUrl?: string;
  fullImageUrl?: string;
  thumbnailAvailable?: boolean;
  originalAvailable?: boolean;
  width: number;
  height: number;
  fileSizeBytes: number;
  ocrText?: string;
  ocrStatus: OcrStatus;
  captureType: CaptureType;
  capturedRegion?: ScreenshotRegion;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string; // ISO 8601
}

