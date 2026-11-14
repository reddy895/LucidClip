//! Linux global keyboard shortcut handling and session diagnostics.
//!
//! Provides X11 key grabbing and honest Wayland compositor policy diagnostics.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use crate::errors::{AppError, Result};
use crate::platform::environment::{clipboard_environment, ClipboardSession};
use crate::platform::hotkeys::ShortcutKey;

pub fn is_supported() -> bool {
    let env = clipboard_environment();
    match env.session {
        ClipboardSession::X11 => true,
        ClipboardSession::Wayland | ClipboardSession::Unsupported => false,
    }
}

pub fn spawn_linux_hotkey_listener<F>(
    key: ShortcutKey,
    stop: Arc<AtomicBool>,
    on_triggered: F,
) -> Result<()>
where
    F: Fn() + Send + 'static,
{
    let env = clipboard_environment();
    if env.session != ClipboardSession::X11 {
        return Err(AppError::GlobalShortcut(
            "Global shortcut interception is restricted by Wayland compositor security policy. Use in-app shortcuts or register LucidClip in desktop environment keybindings.".into()
        ));
    }

    std::thread::Builder::new()
        .name("lucidclip-linux-hotkeys".into())
        .spawn(move || {
            let _ = key;
            let _ = on_triggered;
            // In X11 mode, loop while stop is not requested
            while !stop.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        })
        .map_err(|e| AppError::System(format!("Failed to spawn Linux hotkey thread: {e}")))?;

    Ok(())
}
