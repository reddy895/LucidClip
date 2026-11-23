# LucidClip — Codebase Audit & System Stabilization Report

This document records the baseline audit of LucidClip's desktop application structure across the Rust backend, Tauri 2 configuration, and React frontend before implementing today's 10-commit engineering roadmap.

---

## 1. System Architecture Audit

### 1.1 Tauri & Window Configuration (`backend/tauri.conf.json`)
- **Primary Window (`main`):** Default size 1280x800 (minimum 960x600), native decorations, centered. Serves the full productivity workspace (history table, screenshot gallery, settings).
- **Secondary Window (`clipboard-popup`):** Frameless, `alwaysOnTop: true`, `skipTaskbar: true`, initially hidden. Dedicated to the `Ctrl + V + Z` instant history selector.
- **Asset Protocol Scopes:** Configured to grant secure local access to `$LOCALDATA/LucidClip/screenshots/**`.
- **Port Synchronization:** Dev server statically locked to `http://localhost:1420` with strict port protection against orphaned processes.

### 1.2 Rust Backend Structure (`backend/src/`)
- **`clipboard/`:** Monitor lifecycle, native Windows/Linux event polling and debouncing, text normalization, SHA-256 deduplication, and `PasteGuard` self-capture loop prevention.
- **`database/`:** SQLite connection pool with WAL mode, 9 applied migrations, `ClipboardRepo`, `ScreenshotRepo`, and `SettingsRepo`.
- **`platform/`:** OS-specific bindings for clipboard I/O, focus tracking (`_NET_ACTIVE_WINDOW` on Linux, `GetForegroundWindow` on Windows), synthetic paste injection, and global keyboard shortcuts.
- **`screenshots/`:** Capture coordination, image encoding, directory management, and thumbnail derivation.
- **`storage/`:** `AppPaths` managing local application state directory (`screenshots/`, `originals/`, `thumbnails/`).

### 1.3 Frontend Architecture (`frontend/src/`)
- **State Management (`AppContext.tsx`):** Single source of truth subscribing to Tauri events (`clipboard://new-entry` and `clipboard://monitor-status`).
- **Zero Duplicate Listeners Verified:** Audited codebase to ensure only one listener instance is registered per application session. No duplicate polling routines exist in the frontend layer.
- **View Hierarchy:** Distinct sections for All Items, Clipboard History, Screenshot Gallery, Pinned Items, Favorites, and Settings.

---

## 2. SQLite Schema & History Persistence Audit

### Schema Migrations:
1. `version 1`: `clipboard_entries` (id, content, content_type, source_app, created_at, content_hash, pinned, favorite).
2. `version 2`: `screenshots` (id, original_path, thumbnail_path, width, height, file_size, ocr_text, created_at, pinned, favorite).
3. `version 3`: `settings` (key, value, updated_at).
4. `version 4`: Search and filtering indexes on `created_at`, `pinned`, `favorite`, and `content_type`.
5. `version 5`: Screenshot capture metadata (`capture_type`, `region_*`).
6. `version 6`: Media metadata on clipboard entries (`image_path`, `thumbnail_path`, `image_width`, `image_height`, `byte_size`, `file_count`).
7. `version 7`: Deterministic ordering index `idx_clipboard_created_id`.
8. `version 8`: Last used tracking and usage frequency (`last_used_at`, `usage_count`).
9. `version 9`: Compound ranking index `idx_clipboard_ranking`.

---

## 3. Identified Problems & Stabilization Roadmap

1. **Clipboard Monitoring Lifecycle:**
   - Linux GTK signal monitoring requires robust error recovery when external applications release or overwrite clipboard atoms rapidly.
   - Monitor shutdown must guarantee clean cancellation without leaving orphaned threads or hung X11 handles.
2. **Content Classification & Ingestion:**
   - Multi-format ingestion must cleanly differentiate plain text, multiline text, URLs, JSON, source code, and binary images.
   - Normalization must eliminate carriage return discrepancies (`\r\n` vs `\n`) to prevent false duplicate records across cross-platform copies.
3. **Screenshot Thumbnail & Path Resilience:**
   - Relative paths must reliably resolve across system restarts, home directory migrations, and Linux flatpak/appimage relocations.
   - Full-size previews must unpack actual base64 data URLs without encountering `[object Object]` stringification errors.
4. **Separation of History Views:**
   - Text items and screenshots must be cleanly segmented in the UI while retaining a unified chronological timeline where appropriate.
5. **Keyboard Control Engine (`Ctrl + V + Z`):**
   - Must operate reliably in Linux X11 environments via passive key grabs and stateful key transition detection.
   - Must support instant selection and paste restoration to the active target application.

---

## 4. Baseline Verification

- **Automated Test Runner:** 64 tests across 16 test suites pass cleanly.
- **Typecheck:** Zero TypeScript errors (`tsc --noEmit`).
- **Build Status:** Vite production bundle and Tauri backend compile reproducibly.
