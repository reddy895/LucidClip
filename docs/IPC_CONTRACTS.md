# LucidClip System-Wide Clipboard IPC Contracts

This document specifies the Tauri Inter-Process Communication (IPC) command interfaces and event contracts supporting global keyboard shortcuts, window focus tracking, and the instant paste engine.

---

## 1. IPC Command Surface

### `show_clipboard_popup`
- **Direction**: Frontend $\rightarrow$ Backend or System Hotkey $\rightarrow$ Backend
- **Description**: Inspects and records the currently active foreground window handle, brings the `clipboard-popup` webview window to the foreground, centers it, and sets focus.
- **Request**: `{}` (void)
- **Response**: `Result<WindowFocusInfo, String>`
  ```json
  {
    "captured": true,
    "title": "Visual Studio Code",
    "process": "Code.exe",
    "platformSupported": true
  }
  ```

### `hide_clipboard_popup`
- **Direction**: Frontend $\rightarrow$ Backend
- **Description**: Hides the `clipboard-popup` window without restoring focus or executing a paste.
- **Request**: `{}` (void)
- **Response**: `Result<(), String>`

### `execute_instant_paste`
- **Direction**: Frontend $\rightarrow$ Backend
- **Description**: Orchestrates the entire instant paste sequence:
  1. Hides the popup window.
  2. Restores focus to the target application recorded prior to popup opening.
  3. Updates the system clipboard with the selected entry, applying internal sequence tagging to prevent monitor re-capture.
  4. Triggers native synthetic keypress (`Ctrl+V`).
- **Request**:
  ```json
  {
    "entryId": "uuid-v4-string",
    "content": "Text content to paste",
    "contentType": "text"
  }
  ```
- **Response**: `Result<InstantPasteResult, String>`
  ```json
  {
    "success": true,
    "targetRestored": true,
    "method": "synthetic_key_event",
    "fallbackUsed": false
  }
  ```

### `get_paste_capabilities`
- **Direction**: Frontend $\rightarrow$ Backend
- **Description**: Queries platform capabilities to determine whether synthetic input, focus restoration, and global shortcuts are fully supported in the current session.
- **Request**: `{}` (void)
- **Response**: `Result<PasteCapabilities, String>`
  ```json
  {
    "os": "windows",
    "session": "x11",
    "globalShortcutsSupported": true,
    "focusRestorationSupported": true,
    "syntheticPasteSupported": true,
    "diagnostics": []
  }
  ```

### `update_global_shortcut`
- **Direction**: Frontend $\rightarrow$ Backend
- **Description**: Dynamically updates the registered global shortcut combination (e.g. `Ctrl+Shift+V`).
- **Request**: `{ "shortcut": "Ctrl+Shift+V" }`
- **Response**: `Result<bool, String>`

---

## 2. Event Contracts

### `clipboard://global-shortcut-triggered`
- **Trigger**: System-wide global shortcut pressed in any application.
- **Payload**:
  ```json
  {
    "shortcut": "Ctrl+Shift+V",
    "timestamp": 1731558000
  }
  ```

### `clipboard://paste-completed`
- **Trigger**: Native instant paste execution completed.
- **Payload**:
  ```json
  {
    "entryId": "uuid-v4-string",
    "success": true,
    "durationMs": 42
  }
  ```
