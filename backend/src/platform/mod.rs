//! Platform-specific operating system integrations for LucidClip.

pub mod clipboard;
pub mod screenshot;
pub mod window;

pub use clipboard::{
    clipboard_content_is_sensitive, clipboard_monitoring_supported, read_clipboard_text,
    set_clipboard_image, set_clipboard_text,
};
pub use screenshot::{
    capture_region as capture_screen_region, screenshot_capture_supported,
    virtual_screen_bounds, CapturedImage, ScreenBounds,
};
pub use window::foreground_process_name;
