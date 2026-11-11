import { ClipboardEntry, GalleryItem, ScreenshotEntry } from '@/types';

export function buildGalleryItems(
  screenshots: ScreenshotEntry[],
  clipboardImages: ClipboardEntry[]
): GalleryItem[] {
  const screenshotItems: GalleryItem[] = screenshots.map((screenshot) => ({
    id: screenshot.id,
    source: 'screenshot',
    historyItem: { kind: 'screenshot', ...screenshot },
    width: screenshot.width,
    height: screenshot.height,
    fileSizeBytes: screenshot.fileSizeBytes,
    createdAt: screenshot.createdAt,
    isPinned: screenshot.isPinned,
    isFavorite: screenshot.isFavorite,
    captureType: screenshot.captureType,
    thumbnailAvailable: screenshot.thumbnailAvailable !== false,
    originalAvailable: screenshot.originalAvailable !== false,
    ocrText: screenshot.ocrText,
  }));

  const clipboardItems: GalleryItem[] = clipboardImages.map((entry) => ({
    id: entry.id,
    source: 'clipboard',
    historyItem: { kind: 'clipboard', ...entry },
    width: entry.imageWidth ?? 0,
    height: entry.imageHeight ?? 0,
    fileSizeBytes: entry.byteSize,
    createdAt: entry.createdAt,
    isPinned: entry.isPinned,
    isFavorite: entry.isFavorite,
    captureType: 'clipboard',
    thumbnailAvailable: !!entry.thumbnailPath,
    originalAvailable: !!entry.imagePath,
  }));

  return [...screenshotItems, ...clipboardItems].sort((a, b) => {
    const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return delta !== 0 ? delta : b.id.localeCompare(a.id);
  });
}
