import { ClipboardEntry } from './clipboard';
import { ScreenshotEntry } from './screenshot';

export type NavigationSection =
  | 'all'
  | 'clipboard'
  | 'screenshots'
  | 'pinned'
  | 'favorites'
  | 'settings';

export type HistoryItem =
  | ({ kind: 'clipboard' } & ClipboardEntry)
  | ({ kind: 'screenshot' } & ScreenshotEntry);

