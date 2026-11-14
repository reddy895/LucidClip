/**
 * Types and interfaces for the LucidClip instant paste and focus restoration engine.
 */

export interface WindowFocusInfo {
  captured: boolean;
  title?: string;
  process?: string;
  platformSupported: boolean;
}

export interface InstantPasteRequest {
  entryId: string;
  content: string;
  contentType: string;
}

export interface InstantPasteResult {
  success: boolean;
  targetRestored: boolean;
  method: 'synthetic_key_event' | 'clipboard_only';
  fallbackUsed: boolean;
  message?: string;
}

export interface PasteCapabilities {
  os: string;
  session: string;
  globalShortcutsSupported: boolean;
  focusRestorationSupported: boolean;
  syntheticPasteSupported: boolean;
  diagnostics: string[];
}
