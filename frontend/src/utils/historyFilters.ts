import { ClipboardEntry } from '@/types';

/**
 * Image-only clipboard rows belong to the screenshot gallery, not the text
 * history. File lists and every textual content type remain in the text view.
 */
export function isTextClipboardEntry(entry: ClipboardEntry): boolean {
  return entry.contentType !== 'image';
}

export function isClipboardImageEntry(entry: ClipboardEntry): boolean {
  return entry.contentType === 'image';
}

export function selectTextEntries(entries: ClipboardEntry[]): ClipboardEntry[] {
  return entries.filter(isTextClipboardEntry);
}

export function selectClipboardImages(entries: ClipboardEntry[]): ClipboardEntry[] {
  return entries.filter(isClipboardImageEntry);
}
