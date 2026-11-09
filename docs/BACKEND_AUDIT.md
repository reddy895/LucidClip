# LucidClip Backend Architecture & Environment Audit

## 1. Current Environment

- Node.js 22.x and npm 10.x.
- Rust 1.98.x with a Linux host and the `x86_64-pc-windows-gnu` target installed.
- The full backend cannot be cross-compiled on this host because bundled SQLite requires `x86_64-w64-mingw32-gcc`.
- Windows-only modules are validated separately with `cargo check --target x86_64-pc-windows-gnu`.

## 2. Implemented Surface

- Native Windows clipboard notifications with polling fallback.
- Windows clipboard Unicode/ANSI text, `CF_DIB`/`CF_DIBV5` and `CF_BITMAP` image, and `CF_HDROP` file-list capture.
- Clipboard text, image, and file-list restore, including clipboard image thumbnails.
- Foreground process lookup and sensitive-format detection.
- Background clipboard monitoring with pause, exclusions, deduplication, retention, and media cleanup.
- GDI desktop capture, region crop, PNG originals, and thumbnails.
- SQLite migrations and persistence for clipboard, screenshots, settings, and storage stats.
- Launch-at-login through the per-user Windows registry.
- System-tray background operation with Show and Quit actions.

## 3. Deliberate Gaps

- OCR, global hotkeys, configurable screenshot paths, and signed installer packaging are not implemented.
- Native behavior and installer output must be verified on a Windows machine.
- Browser development adapters return explicit unsupported errors for native operations instead of fabricating screenshots or OCR.
