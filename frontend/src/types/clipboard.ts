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
  lastUsedAt?: string;
  usageCount?: number;
}


/**
 * Backend clipboard diagnostics reported by `get_clipboard_diagnostics`.
 * Never includes clipboard content.
 */
export interface ClipboardDiagnostics {
  os: string;
  session: 'wayland' | 'x11' | 'unsupported';
  session_type: string | null;
  wayland_display: string | null;
  display: string | null;
  desktop: string | null;
  backend: string;
  monitoring_supported: boolean;
  supports_text: boolean;
  supports_images: boolean;
  supports_files: boolean;
  utilities: {
    wl_paste: boolean;
    wl_copy: boolean;
    xclip: boolean;
    xsel: boolean;
  };
  diagnostics: string[];
}

/** Live monitor lifecycle reported by `get_monitor_status`. */
export interface ClipboardMonitorStatus {
  supported: boolean;
  running: boolean;
  paused: boolean;
  backend: string;
  session: string;
  captures: number;
  last_capture_at: number | null;
  last_error: string | null;
  started_at: number | null;
}
