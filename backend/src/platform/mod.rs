//! Platform-specific operating system integrations for LucidClip.

pub mod clipboard;
#[cfg(target_os = "windows")]
pub mod clipboard_watcher;
pub mod screenshot;
pub mod startup;
pub mod window;

pub use clipboard::{
    clipboard_content_is_sensitive, clipboard_monitoring_supported, read_clipboard_snapshot,
    read_clipboard_text, set_clipboard_image, set_clipboard_text, ClipboardSnapshot,
};
#[cfg(target_os = "windows")]
pub use clipboard_watcher::spawn as spawn_clipboard_watcher;
pub use screenshot::{
    capture_region as capture_screen_region, screenshot_capture_supported, virtual_screen_bounds,
    CapturedImage, ScreenBounds,
};
pub use startup::{launch_on_startup_enabled, set_launch_on_startup};
pub use window::foreground_process_name;
