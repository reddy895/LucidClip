# LucidClip — Keyboard Shortcuts & Desktop Navigation Specification

LucidClip is engineered for high-velocity desktop productivity with complete keyboard-first control. Every critical workflow—from toggling the history popup to instant synthetic pasting, filtering, pinning, and navigation—can be operated entirely without a mouse.

---

## 1. Global System-Wide Shortcuts

Global shortcuts function across the entire operating system, regardless of whether LucidClip is focused, minimized, or running in the system tray.

| Shortcut | Action | Scope | Description |
| :--- | :--- | :--- | :--- |
| **`Ctrl+V+Z`** | **Toggle Clipboard Popup** | System-Wide | **Primary Sequence Shortcut:** Press `Ctrl+V` followed by `Ctrl+Z` while `Ctrl` remains held. Opens or dismisses the frameless floating clipboard popup at screen center. |
| **`Ctrl+Shift+V`** | **Toggle Popup (Chord Fallback)** | System-Wide | Configurable simultaneous chord alternative. |
| **`Ctrl+Shift+S`** | **Full Screen Capture** | System-Wide | Triggers immediate full-screen desktop capture and registers it in the Screenshot Gallery. |
| **`Ctrl+Shift+A`** | **Area Region Capture** | System-Wide | Launches the interactive screen selection overlay for cropped capture. |

### The `Ctrl+V+Z` Sequence State Machine

To prevent interference with daily typing while supporting high-speed muscle memory:
1. **Holding `Ctrl`:** State machine enters `CtrlHeld`.
2. **Pressing `V`:** State machine transitions to `AwaitingZ { timestamp }`.
3. **Pressing `Z` within 750ms:**
   - Sequence is recognized!
   - Key event is swallowed to prevent accidental undo or paste.
   - Floating clipboard history popup appears immediately over the current foreground application.
4. **Timeout / Interruption:**
   - If `Ctrl` is released, or another key is pressed, or 750ms elapses without `Z`, the state machine resets cleanly.
   - Normal `Ctrl+V` (paste) and `Ctrl+Z` (undo) continue operating unimpeded.

> [!NOTE]
> Global hotkey combinations can be configured in **Settings > Hotkeys**. Sequence mode and timeout thresholds (default 750ms) are adjustable to match individual typing speed.

---

## 2. Floating Clipboard Popup Navigation

The floating clipboard history popup window is designed for zero-distraction, sub-second entry selection and paste insertion into the active application.

### Entry Navigation & Selection

| Key | Function | Behavior |
| :--- | :--- | :--- |
| **`ArrowDown`** / **`j`** | Next Entry | Moves selection cursor down. Clamps at the end of the loaded list. |
| **`ArrowUp`** / **`k`** | Previous Entry | Moves selection cursor up. Clamps at index 0. |
| **`Home`** | Jump to Start | Instantly highlights the topmost (most recent) item. |
| **`End`** | Jump to End | Highlights the bottom-most item in the current query view. |
| **`PageDown`** | Page Down | Advances the selected item by one page viewport height (~8 items). |
| **`PageUp`** | Page Up | Retreats the selected item by one page viewport height (~8 items). |
| **`Alt+1` .. `Alt+9`** | Quick Slot Pick | Directly selects the entry in slot 1 through 9. |

### Actions & Instant Paste

| Key | Function | Behavior |
| :--- | :--- | :--- |
| **`Enter`** | **Instant Paste** | Hides the popup, restores focus to the previously active application window, populates the system clipboard, and synthesizes `Ctrl+V` key injection. |
| **`Shift+Enter`** | Copy to Clipboard | Copies the selected entry to the clipboard without auto-injecting paste into the target application. |
| **`Escape`** | Dismiss Popup | Closes the floating popup immediately and restores focus to the prior application. |
| **`Ctrl+F`** / **`/`** | Focus Search | Highlights the popup search field for instant query typing. |
| **`Ctrl+P`** | Toggle Pin | Pins or unpins the currently selected entry, preventing automated retention purge. |
| **`Delete`** / **`Backspace`** | Delete Entry | Removes the highlighted entry from the clipboard database (with safety check on pinned items). |
| **`Tab`** / **`Shift+Tab`** | Cycle Elements | Cycles focus between search field, type filter chips, and list entries. |

---

## 3. Main Window Navigation

When operating within the primary LucidClip desktop application window, the following keyboard shortcuts accelerate view management and entry inspection.

### View Switching

| Shortcut | View | Description |
| :--- | :--- | :--- |
| **`Ctrl+1`** | **Clipboard History** | Navigates to the full searchable clipboard history table. |
| **`Ctrl+2`** | **Screenshot Gallery** | Navigates to the screenshot library and cropping workspace. |
| **`Ctrl+,`** | **Settings** | Opens application configuration, hotkeys, and retention rules. |
| **`Ctrl+B`** | **Toggle Sidebar** | Expands or collapses the navigation sidebar for maximum density. |

### Clipboard History Management

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`Ctrl+F`** | Find in History | Focuses the main search bar with query syntax support. |
| **`Ctrl+C`** | Copy Selected | Copies the currently selected history row back to system clipboard. |
| **`Ctrl+D`** | Inspect Details | Opens the rich text / JSON / syntax detail modal for deep inspection. |
| **`Ctrl+Shift+Delete`**| Clear Unpinned | Opens the confirmation dialog to flush all unpinned clipboard items. |

---

## 4. Platform Implementation Details

### Windows (`winuser.h`)
- **Low-Level Keyboard Hook (`WH_KEYBOARD_LL`):** Installed via `SetWindowsHookExW` on a dedicated background message pump thread. Intercepts `VK_CONTROL`, `VK_V`, and `VK_Z` to drive the `SequenceDetector` state machine.
- **Accidental Paste & Undo Suppression:** When the `Ctrl+V+Z` sequence is completed, the trigger keydown and subsequent keyup events are swallowed (returning `1` from the hook procedure) so the focused application never receives an undo (`Ctrl+Z`).
- **Normal Keystroke Pass-Through:** If the sequence is not completed or times out (>750ms), keys pass directly to `CallNextHookEx`, ensuring normal `Ctrl+V` (paste) and `Ctrl+Z` (undo) operate unimpeded.
- **Active Window Capture:** Target window handles (`HWND`) are captured via `GetForegroundWindow` before displaying the popup.
- **Focus Restoration & Synthetic Paste:** Prior to paste injection, focus is returned via `SetForegroundWindow` and `AttachThreadInput`, followed by synthetic `SendInput` keystrokes.
- **Chord Fallback:** For systems preferring chords, `RegisterHotKey` supports `Ctrl+Shift+V`.

### Linux (X11 & Wayland)
- **X11 Session:** Global key sequence listening uses passive grabs on root window keycodes for Control, V, and Z. Active windows are resolved via EWMH `_NET_ACTIVE_WINDOW`. Synthetic paste uses `XTestFakeKeyEvent`.
- **Wayland Session:** Under Wayland, compositors intentionally restrict background key interception for security. LucidClip surfaces clear diagnostics advising users to map a desktop environment shortcut (GNOME / KDE) to `lucidclip --popup`.
- **Paste Guard Protection:** LucidClip's `PasteGuard` computes SHA-256 hashes of injected text and images to prevent loop-recording self-generated clipboard updates.
- On Wayland environments, shortcuts adhere to the `org.freedesktop.portal.GlobalShortcuts` portal protocol; paste execution operates via standard clipboard synchronization with graceful notification when direct synthetic input injection is restricted by the Wayland compositor security boundary.
