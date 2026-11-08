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
