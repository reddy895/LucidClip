import { HistoryItem } from './navigation';

export type GallerySource = 'screenshot' | 'clipboard';

/**
 * A single image card in the Screenshots gallery. LucidClip captures and
 * clipboard images share the grid, but keep their original history identity so
 * pin/favorite/delete/copy still route to the correct backend store.
 */
export interface GalleryItem {
  id: string;
  source: GallerySource;
  historyItem: HistoryItem;
  width: number;
  height: number;
  fileSizeBytes?: number;
  createdAt: string;
  isPinned: boolean;
  isFavorite: boolean;
  captureType: 'fullscreen' | 'region' | 'clipboard';
  thumbnailAvailable: boolean;
  originalAvailable: boolean;
  ocrText?: string;
}
