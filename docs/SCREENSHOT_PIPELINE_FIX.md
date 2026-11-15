# LucidClip — Screenshot History Pipeline Fix Specification

This document provides a comprehensive root cause analysis and technical specification for resolving clipboard screenshot and image history failures in LucidClip.

---

## 1. Root Cause Analysis

### A. IPC Data Model Mismatch & `[object Object]` Rendering
- **The Backend Command:** `get_clipboard_image` and `get_screenshot_image` return a serialized `ScreenshotImageData` struct:
  ```rust
  #[derive(Debug, Clone, Serialize)]
  pub struct ScreenshotImageData {
      pub mime_type: String,
      pub data_url: String,
  }
  ```
- **The Frontend Service Breakdown:** `TauriClipboardService.ts` and `TauriScreenshotService.ts` invoked the commands using `invoke<string>('get_clipboard_image', ...)`.
- **Runtime Defect:** In JavaScript, `invoke` resolved to an object `{ mime_type: "image/png", data_url: "data:image/png;base64,..." }`.
- **The Render Failure:** Components (e.g. `ClipboardRow.tsx`, `ScreenshotThumbnail.tsx`, `TextPreview.tsx`) assigned this object directly to `<img src={...} />`. The browser converted the object to string: `src="[object Object]"`, failing image loading and triggering `onError`, which displayed `"The stored image file is unavailable."`

### B. Popup History Row Missing Image Loading
- In `PopupHistoryRow.tsx`, the row only checked `entry.thumbnailUrl || entry.imageUrl`.
- However, `get_clipboard_entries` deliberately omits heavy base64 data URLs from list queries to keep IPC lightweight.
- Because `PopupHistoryRow.tsx` never invoked `useMediaImageUrl`, image entries in the floating popup never displayed thumbnail images.

### C. Storage Path Inflexibility Across Restarts
- `AppPaths::owns_media_path` checked `path.is_absolute() && path.starts_with(&self.screenshots_dir)`.
- If a relative path was stored in SQLite, or if LucidClip was restarted in a different directory or portable mode, `resolve_media_file` rejected the path with:
  `"Refusing to access media outside the application data directory"`.
- A resilient resolution strategy must support relative paths and basename fallbacks within `originals_dir` and `thumbnails_dir`.

### D. Clipboard Image Ingestion Limitations
- Windows clipboard capture previously only checked `CF_DIB` and `CF_DIBV5`.
- Modern browsers (Chrome, Edge, Firefox) and Electron applications (VS Code, Slack) register `"PNG"` and `"image/jpeg"` formats.
- Ingestion must detect registered image format atoms and decode memory-backed PNG/JPEG streams directly via the `image` crate.

---

## 2. Multi-Layer Resolution Strategy

```mermaid
flowchart TD
    A["OS Clipboard (PNG / JPEG / DIB)"] --> B["Multi-Format Ingestion Engine"]
    B --> C["Canonical Portable Storage (originals/ & thumbnails/)"]
    C --> D["SQLite Persistence (relative path / metadata)"]
    D --> E["IPC Command (get_clipboard_image)"]
    E --> F["TauriClipboardService (Unpacks .data_url)"]
    F --> G["useMediaImageUrl Hook"]
    G --> H["Frontend Components (PopupHistoryRow, ClipboardRow, TextPreview)"]
```

1. **Ingestion Layer:** Detect `CF_DIB`, `CF_DIBV5`, `CF_BITMAP`, registered `"PNG"`, `"image/png"`, and `"image/jpeg"`.
2. **Storage Layer:** Save PNG originals and 320x180 thumbnails. Support relative paths and automatic thumbnail regeneration.
3. **Database Layer:** Persist image metadata (`image_width`, `image_height`, `byte_size`, `image_path`, `thumbnail_path`).
4. **IPC Layer:** Return validated data URL with error handling for corrupted files.
5. **Frontend Layer:** Safely unpack `.data_url` from response objects and bind thumbnails in both main list and popup rows.
