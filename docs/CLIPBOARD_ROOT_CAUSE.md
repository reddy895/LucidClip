# LucidClip Clipboard Root-Cause Audit

**Date:** 2026-11-10
**Host inspected:** Ubuntu 26.04, GNOME, `XDG_SESSION_TYPE=wayland`
**Repository state:** `main` at `812d3a9`, clean working tree

## Reproduction

1. Copy text in any application.
2. Open LucidClip (or refresh the webview).
3. The clipboard page stays empty.
4. Restarting the application does not help.

## Evidence

The frontend pipeline is wired correctly:

- `AppContext` loads persisted history from SQLite through
  `get_clipboard_entries` on startup (`frontend/src/context/AppContext.tsx`).
- `AppContext` subscribes to `clipboard://new-entry` and inserts the received
  entry into state (`frontend/src/context/AppContext.tsx`).
- `TauriClipboardService` calls the right IPC commands and maps the DTO.

The backend pipeline stops at the platform boundary:

- `platform/clipboard.rs::clipboard_monitoring_supported()` returned
  `cfg!(target_os = "windows")`. On Linux this is `false`.
- `clipboard::monitor::spawn()` therefore printed
  "Native clipboard monitoring is unavailable on this host." and returned
  without spawning the monitor thread.
- Even if the thread had started, `read_clipboard_snapshot()` returned
  `Ok(None)` on every non-Windows target, so nothing could ever be captured.
- `set_clipboard_text()`, `set_clipboard_image()`, and `set_clipboard_files()`
  also returned "only available on Windows" errors, so copy-back was broken too.

In short: **the entire OS clipboard implementation was compiled only for
Windows.** The Linux development host had no clipboard backend at all. This is
not a frontend refresh, SQLite, event-name, or launcher bug.

## Environment findings

- Session: Wayland (`WAYLAND_DISPLAY=wayland-0`), XWayland available
  (`DISPLAY=:0`).
- No `wl-paste`, `wl-copy`, `xclip`, or `xsel` binaries are installed.
- GTK 3 and its clipboard are available and were verified experimentally:
  - `Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD).wait_for_text()` returned real
    clipboard content.
  - A background GTK window received the `owner-change` signal and read new
    content copied by a separate process.
- Therefore the correct Linux backend is the GTK clipboard already linked into
  the Tauri/WebKitGTK process, with CLI tools only reported as optional
  diagnostics.

## Launcher finding

The historical `ENOENT: /home/reddy895/Downloads/frontend/package.json` was
caused by resolving `../frontend` from the repository root instead of from
`backend/tauri.conf.json`. The current layout (`backend/tauri.conf.json` with
`frontendDist: ../frontend/dist`) and `scripts/dev.mjs` correctly resolve the
frontend at `~/Downloads/LucidClip/frontend`. `npm run dev:frontend` was
verified to work when invoked from both the root and `backend/`.

## Fix strategy

1. Add a platform clipboard environment detector that reports session type,
   available utilities, backend, and actionable diagnostics.
2. Implement a Linux GTK clipboard backend:
   - read `CLIPBOARD` (never `PRIMARY`) text, images, and `text/uri-list`;
   - write text and images;
   - subscribe to `owner-change` on the GTK main context for change
     notifications, with a controlled safety poll;
   - never call GTK off the main thread.
3. Keep the Windows native backend unchanged, but wire Linux into the same
   monitor lifecycle.
4. Expose monitoring status, diagnostics, pause/resume, and manual capture over
   IPC, and surface them in the settings UI.
5. Normalize text consistently, use deterministic ordering, and add tests for
   the pure logic plus an opt-in real GTK clipboard probe.
6. Load persisted history on startup and keep event delivery as an enhancement,
   never the only source of truth.

## Honest limitations

- GNOME Wayland restricts background clipboard access for some compositors.
  The GTK backend is verified on this host; other compositors must be tested.
- Linux image writing uses GTK pixbufs, and file-list writing uses a
  `text/uri-list` `set_with_data` handler.
- Sensitive-content markers are a Windows convention. On Linux LucidClip can
  only recognize the KDE password-manager hint target; it does not claim
  perfect detection.
- Windows behaviour is preserved by conditional compilation and cannot be
  re-verified on this Linux host.

## Resolution (implemented)

The audit above describes the original state. The current tree implements the
fix strategy:

- `platform/clipboard_linux.rs` provides GTK-backed read, write, and
  `owner-change` watching; all GTK calls are marshalled to the main context.
- `platform/environment.rs` reports the session, backend, optional CLI tools,
  and actionable diagnostics.
- `clipboard/monitor.rs` runs on Linux, shares its deduplication fingerprint
  with manual capture, and exposes lifecycle status and errors without logging
  clipboard content.
- `clipboard/events.rs` defines a versioned capture event and a status event.
- IPC commands expose diagnostics, monitor status, pause/resume, and manual
  capture; the Settings UI renders them.
- Text is normalized before hashing and persistence, and history is ordered by
  `created_at DESC, id DESC` with a supporting index.
- `backend/examples/clipboard_probe.rs` verifies a real GTK read/write
  round-trip and, with `--watch`, the `owner-change` notification path. Both
  reported `ok` on the GNOME Wayland host.
- Backend tests and frontend contract tests cover the pure logic and IPC
  surface. End-to-end monitoring on other compositors still requires manual
  verification.
