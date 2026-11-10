import type { ClipboardEntry } from '@/types';
import type { DbClipboardDto } from '@/services/tauri/TauriClipboardService';

export const CLIPBOARD_EVENT_VERSION = 1;
export const CLIPBOARD_EVENT_NAME = 'clipboard://new-entry';
export const CLIPBOARD_STATUS_EVENT_NAME = 'clipboard://monitor-status';

const KNOWN_CONTENT_TYPES = new Set([
  'multiline',
  'code',
  'url',
  'json',
  'color_code',
  'path',
  'image',
  'files',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Validate a `clipboard://new-entry` payload.
 *
 * Accepts the current versioned envelope `{ version, entry }` and the legacy
 * direct entry shape. Returns `null` for anything malformed so the UI never
 * renders partial or fabricated data.
 */
export function validateClipboardEventPayload(raw: unknown): DbClipboardDto | null {
  if (!isRecord(raw)) return null;

  let candidate: unknown = raw;
  if ('entry' in raw) {
    const version = raw.version;
    if (typeof version !== 'number' || !Number.isFinite(version)) return null;
    if (version > CLIPBOARD_EVENT_VERSION) return null;
    candidate = raw.entry;
  }

  if (!isRecord(candidate)) return null;

  const {
    id,
    content,
    content_type,
    content_hash,
    created_at,
    pinned,
    favorite,
  } = candidate;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof content !== 'string') return null;
  if (typeof content_type !== 'string' || content_type.length === 0) return null;
  if (typeof content_hash !== 'string' || content_hash.length === 0) return null;
  if (typeof created_at !== 'number' || !Number.isFinite(created_at)) return null;
  if (typeof pinned !== 'boolean' || typeof favorite !== 'boolean') return null;

  if (!isOptionalString(candidate.source_app)) return null;
  if (!isOptionalString(candidate.image_path)) return null;
  if (!isOptionalString(candidate.thumbnail_path)) return null;
  if (!isOptionalNumber(candidate.image_width)) return null;
  if (!isOptionalNumber(candidate.image_height)) return null;
  if (!isOptionalNumber(candidate.byte_size)) return null;
  if (!isOptionalNumber(candidate.file_count)) return null;

  if (
    content_type !== 'plain' &&
    content_type !== 'text' &&
    !KNOWN_CONTENT_TYPES.has(content_type)
  ) {
    return null;
  }

  return candidate as unknown as DbClipboardDto;
}

function timeOf(entry: ClipboardEntry): number {
  const value = new Date(entry.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

/** Newest first, with id as a stable tie-breaker. */
export function sortClipboardEntries(entries: ClipboardEntry[]): ClipboardEntry[] {
  return [...entries].sort((a, b) => {
    const delta = timeOf(b) - timeOf(a);
    if (delta !== 0) return delta;
    return b.id.localeCompare(a.id);
  });
}

/** Reconcile a fetched history with an in-flight event update. */
export function mergeClipboardHistory(
  current: ClipboardEntry[],
  fetched: ClipboardEntry[]
): ClipboardEntry[] {
  const byId = new Map(fetched.map((entry) => [entry.id, entry]));
  for (const entry of current) {
    byId.set(entry.id, entry);
  }
  return sortClipboardEntries([...byId.values()]);
}

/** Insert or replace an entry, keep ordering, and optionally cap the list. */
export function mergeClipboardEntry(
  entries: ClipboardEntry[],
  incoming: ClipboardEntry,
  limit?: number
): ClipboardEntry[] {
  const merged = [incoming, ...entries.filter((entry) => entry.id !== incoming.id)];
  const sorted = sortClipboardEntries(merged);
  return typeof limit === 'number' && limit >= 0 ? sorted.slice(0, limit) : sorted;
}
