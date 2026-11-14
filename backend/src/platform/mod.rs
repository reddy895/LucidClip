//! Platform-specific operating system integrations for LucidClip.

pub mod clipboard;
#[cfg(target_os = "linux")]
pub mod clipboard_linux;
#[cfg(target_os = "windows")]
pub mod clipboard_watcher;
pub mod environment;
pub mod focus;
pub mod hotkeys;
pub mod paste;
pub mod popup_window;
pub mod screenshot;
pub mod startup;
pub mod window;

pub use focus::{ActiveWindowTarget, FocusManager};
pub use hotkeys::{
    GlobalShortcutState, GlobalShortcutStatus, ShortcutKey, DEFAULT_HISTORY_SHORTCUT,
};
pub use paste::{
    synthetic_paste_supported, trigger_paste_keystroke, PasteExecutionResult, PasteMethod,
};
pub use popup_window::{
    hide_popup_window, is_popup_visible, show_popup_window, toggle_popup_window,
    POPUP_WINDOW_LABEL,
};

pub use clipboard::{
    clipboard_content_is_sensitive, clipboard_monitoring_supported, read_clipboard_snapshot,
    read_clipboard_text, set_clipboard_files, set_clipboard_image, set_clipboard_text,
    ClipboardSnapshot,
};
#[cfg(target_os = "linux")]
pub use clipboard_linux::start_watcher as spawn_clipboard_watcher;
#[cfg(target_os = "windows")]
pub use clipboard_watcher::spawn as spawn_clipboard_watcher;
pub use environment::{
    clipboard_environment, ClipboardEnvironment, ClipboardSession, ClipboardUtilities,
};
pub use screenshot::{
    capture_region as capture_screen_region, screenshot_capture_supported, virtual_screen_bounds,
    CapturedImage, ScreenBounds,
};
pub use startup::{launch_on_startup_enabled, set_launch_on_startup};
pub use window::{
    capture_foreground_target, focus_restoration_supported, foreground_process_name,
    restore_target_focus,
};

/// Prepare the clipboard backend on the current (main) thread.
///
/// Linux must initialize GTK clipboard access from the GTK main thread before
/// the monitor thread starts. Windows has no such constraint.
pub fn initialize_clipboard_backend() -> std::result::Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        clipboard_linux::initialize()
    }

    #[cfg(target_os = "windows")]
    {
        Ok(())
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Err("Clipboard backends are only implemented for Windows and Linux".to_string())
    }
}

/// Release clipboard resources during application shutdown.
pub fn shutdown_clipboard_backend() {
    #[cfg(target_os = "linux")]
    {
        clipboard_linux::shutdown();
    }
}

/// Whether this build can read the operating-system clipboard on this host.
pub fn clipboard_backend_ready() -> bool {
    #[cfg(target_os = "windows")]
    {
        true
    }

    #[cfg(target_os = "linux")]
    {
        clipboard_linux::is_ready()
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        false
    }
}
