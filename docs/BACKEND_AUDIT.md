# LucidClip Backend Architecture & Environment Audit

## 1. Environment Inspection
- **Node.js**: v22.14.0
- **npm**: 10.9.2
- **Rust Toolchain**: 1.98.1 (x86_64-unknown-linux-gnu host, targeting Windows desktop x86_64-pc-windows-msvc / cross-platform development)
- **Cargo**: 1.98.1
- **Current Repository State**: Clean working tree on `main` branch.

## 2. Architecture Plan & Responsibilities
The repository will be cleanly decoupled into two distinct top-level directories:
- `frontend/`: Standalone React + TypeScript + Vite + Tailwind CSS application using the existing LucidClip desktop UI design system.
- `backend/`: Robust Tauri 2 + Rust backend providing local-first clipboard monitoring, screenshot capture, SQLite persistence, and search services.
- `scripts/`: Development coordination scripts (`dev.mjs`) ensuring `npm run dev` launches the unified environment.

## 3. Core Principles
1. **Zero Mock / Genuine Data Only**:
   - Fresh installations start with 0 clipboard records and 0 screenshots.
   - All fixtures and mock generators are removed from the production runtime path.
2. **Local-First & Privacy Conscious**:
   - Data stored in `%LOCALAPPDATA%/LucidClip/` (Windows) or standard local data dirs.
   - No external cloud services or network telemetry.
   - Sensitive clipboard contents are never logged to diagnostic log files.
3. **Cross-Platform Compilation with Windows Specialization**:
   - Win32 API calls (`GetClipboardData`, `AddClipboardFormatListener`, GDI screenshot APIs) are specialized for Windows targets with clean abstractions.
   - Fallback and mock adapters ensure development, compilation, and automated tests pass across both Linux and Windows environments.
