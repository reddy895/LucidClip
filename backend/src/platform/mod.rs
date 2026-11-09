//! Platform-specific operating system integrations for LucidClip.

pub mod clipboard;

pub use clipboard::{
    clipboard_monitoring_supported, read_clipboard_text, set_clipboard_text,
};
