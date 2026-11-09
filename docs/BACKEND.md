# LucidClip Backend Architecture & Integration Guide

## 1. Overview
LucidClip is architected as a local-first desktop productivity application with a complete separation between frontend interface and backend desktop services:

```text
LucidClip/
├── frontend/             # React 18, TypeScript, Vite, Tailwind CSS desktop UI
│   ├── src/
│   │   ├── components/   # Modular UI components
│   │   ├── context/      # Application & Toast context providers
│   │   ├── pages/        # Main navigation views
│   │   ├── services/     # Typed Tauri IPC adapters & contracts
│   │   └── types/        # Strongly typed TypeScript definitions
│   └── package.json
│
├── backend/              # Rust, Tauri 2, SQLite desktop engine
│   ├── src/
│   │   ├── clipboard/    # Classification, SHA-256 hashing, deduplication
│   │   ├── commands/     # Tauri IPC command handlers
│   │   ├── database/     # SQLite connection pool, migrations, and repos
│   │   ├── errors/       # Structured error handling with thiserror
│   │   ├── settings/     # Application configuration models
│   │   ├── storage/      # Local app data directories and paths
│   │   ├── lib.rs        # Main runner, setup hook, IPC registry
│   │   └── main.rs       # Application entry point
│   ├── capabilities/     # Restricted Tauri 2 capability definitions
│   └── Cargo.toml        # Rust backend crate configuration
│
└── scripts/
    ├── dev.mjs           # Unified dev launcher (Vite + Tauri)
    └── test-runner.mjs   # Automated verification suite
```

## 2. Local-First Storage Hierarchy
User data is stored strictly on the local machine in standard operating system directories:
- **Windows**: `%LOCALAPPDATA%/LucidClip/`
  - `lucidclip.db`: SQLite database running with WAL mode and normalized indexes
  - `screenshots/originals/`: Full-resolution captured PNG images
  - `screenshots/thumbnails/`: Scaled preview thumbnails (320x180)
  - `logs/`: Diagnostic logs (raw clipboard contents are never logged)

## 3. Database Schema & Migrations
The database migration engine tracks versions in `schema_migrations`:
- `clipboard_entries`:
  - `id TEXT PRIMARY KEY`: Unique entry identifier
  - `content TEXT NOT NULL`: Captured text
  - `content_type TEXT NOT NULL`: Classified category (`plain`, `multiline`, `url`, `code`, `json`, `color_code`, `path`)
  - `source_app TEXT`: Window/process metadata
  - `created_at INTEGER NOT NULL`: Millisecond epoch timestamp
  - `content_hash TEXT NOT NULL UNIQUE`: SHA-256 hash for O(1) deduplication
  - `pinned INTEGER NOT NULL DEFAULT 0`: Pinned status flag
  - `favorite INTEGER NOT NULL DEFAULT 0`: Favorite status flag
- `screenshots`:
  - `id TEXT PRIMARY KEY`: Unique screenshot identifier
  - `original_path TEXT NOT NULL`: Filesystem path to full image
  - `thumbnail_path TEXT NOT NULL`: Filesystem path to thumbnail
  - `width INTEGER NOT NULL`, `height INTEGER NOT NULL`: Pixel dimensions
  - `file_size INTEGER NOT NULL`: File size in bytes
  - `ocr_text TEXT`: Extracted OCR text (when enabled)
  - `created_at INTEGER NOT NULL`: Millisecond epoch timestamp
  - `pinned INTEGER NOT NULL DEFAULT 0`, `favorite INTEGER NOT NULL DEFAULT 0`
- `settings`:
  - `key TEXT PRIMARY KEY`: Setting key
  - `value TEXT NOT NULL`: JSON-serialized configuration
  - `updated_at INTEGER NOT NULL`: Timestamp of last change

## 4. Zero-Mock Policy
Fresh installations initialize with zero entries across all sections:
- `All Items`: 0 entries
- `Clipboard`: 0 entries
- `Screenshots`: 0 entries
- `Pinned`: 0 entries
- `Favorites`: 0 entries

All sample and demo entries are isolated solely to test fixtures and are never injected into the application database or runtime state.

## 5. Verification Commands
- `npm test`: Runs automated verification suite (`scripts/test-runner.mjs`)
- `npm run typecheck`: Runs TypeScript compiler without emit (`tsc --noEmit`)
- `npm run build`: Runs production frontend build (`vite build`)
- `cd backend && cargo test`: Runs Rust unit tests for database migrations, classification, hashing, and deduplication

## 6. Tauri IPC Command Surface

The registered handlers in `backend/src/commands/mod.rs` are:

| Command | Purpose |
|---|---|
| `get_clipboard_entries` | List persisted clipboard entries (newest first) |
| `add_clipboard_entry` | Classify, hash, deduplicate, and persist copied text |
| `copy_clipboard_entry` | Restore text to the operating system clipboard |
| `delete_clipboard_entry` | Delete a single clipboard entry |
| `toggle_clipboard_pin` / `toggle_clipboard_favorite` | Toggle entry flags |
| `clear_clipboard_history` | Delete all unpinned clipboard entries |
| `get_screenshots` | List persisted screenshot records |
| `delete_screenshot` | Remove the record and its original/thumbnail files |
| `toggle_screenshot_pin` / `toggle_screenshot_favorite` | Toggle screenshot flags |
| `get_settings` / `update_setting` | Read and upsert JSON application settings |
| `get_storage_stats` | Report database and screenshot storage usage |

## 7. Screenshot Asset Delivery

Screenshot files live outside the webview origin, so absolute filesystem paths cannot be loaded directly by an `<img>` element. The desktop build:

- Enables the Tauri `protocol-asset` crate feature in `backend/Cargo.toml`.
- Enables `app.security.assetProtocol` in `backend/tauri.conf.json` with a scope limited to the LucidClip screenshot directories for both Windows (`%LOCALAPPDATA%/LucidClip`) and the Linux development data directory.
- Converts `original_path` and `thumbnail_path` with `convertFileSrc` inside `frontend/src/services/tauri/TauriScreenshotService.ts`.

No screenshot directory outside the application data root is exposed to the webview.

## 8. Clipboard Restoration

`copy_clipboard_entry` delegates to `backend/src/platform/clipboard.rs`. On Windows the platform module calls `OpenClipboard`, `EmptyClipboard`, and `SetClipboardData` with a null-terminated UTF-16 buffer. Clipboard contention is retried briefly, memory allocation and locking failures are reported as structured errors, and a RAII guard closes the clipboard on every exit path. Non-Windows hosts are development-only and log the write without touching the host clipboard.

## 9. Unified Search Data Flow

The All Items workspace uses `HistorySearchService`, which is constructed with the active clipboard and screenshot adapters. In the desktop build those adapters are the Tauri IPC services, so search always reads from the local SQLite store. The browser development build injects the mock adapters instead. Filtering and sorting live in the pure `filterHistory` utility so both paths behave identically.

## 10. Implementation Status

Implemented:
- React/Tauri 2 application shell with the graphite desktop workspace.
- SQLite database, migrations, repositories, and WAL configuration.
- Clipboard text classification, SHA-256 normalization, and deduplication.
- Clipboard and screenshot history, pin/favorite/delete, settings, and storage statistics commands.
- Native Windows clipboard restoration and scoped screenshot asset delivery.

Not yet implemented:
- Background clipboard change listener / polling loop.
- Screenshot capture, thumbnail generation, and OCR pipeline.
- Retention and max-history enforcement against captured data.
- System tray, launch-at-startup, and global hotkey registration.

Documentation should keep the implemented IPC surface separate from these planned capabilities.
