//! Synthetic paste key injection abstraction.
//!
//! Provides platform-agnostic triggering of keyboard paste operations (Ctrl+V)
//! into previously active target applications, with graceful clipboard-only fallback.

use serde::Serialize;
use crate::errors::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PasteMethod {
    SyntheticKeyEvent,
    ClipboardOnly,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PasteExecutionResult {
    pub success: bool,
    pub target_restored: bool,
    pub method: PasteMethod,
    pub fallback_used: bool,
    pub message: Option<String>,
}

impl PasteExecutionResult {
    pub fn success(target_restored: bool) -> Self {
        Self {
            success: true,
            target_restored,
            method: PasteMethod::SyntheticKeyEvent,
            fallback_used: false,
            message: None,
        }
    }

    pub fn clipboard_fallback(target_restored: bool, message: impl Into<String>) -> Self {
        Self {
            success: true,
            target_restored,
            method: PasteMethod::ClipboardOnly,
            fallback_used: true,
            message: Some(message.into()),
        }
    }
}

/// Whether the host platform environment supports native synthetic paste injection.
pub fn synthetic_paste_supported() -> bool {
    #[cfg(target_os = "windows")]
    {
        true
    }

    #[cfg(target_os = "linux")]
    {
        linux_paste::is_supported()
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        false
    }
}

/// Synthesize a Ctrl+V key combination into the currently focused window.
pub fn trigger_paste_keystroke() -> Result<bool> {
    #[cfg(target_os = "windows")]
    {
        windows_paste::trigger_ctrl_v()
    }

    #[cfg(target_os = "linux")]
    {
        linux_paste::trigger_ctrl_v()
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        Ok(false)
    }
}

#[cfg(target_os = "linux")]
pub(crate) mod linux_paste {
    use super::*;
    use std::process::Command;
    use crate::platform::environment::{clipboard_environment, ClipboardSession};

    pub fn is_supported() -> bool {
        let env = clipboard_environment();
        if env.session != ClipboardSession::X11 {
            return false;
        }

        // Supported under X11 if xdotool or xte is available
        Command::new("which")
            .arg("xdotool")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    pub const LINUX_FOCUS_SETTLE_DELAY_MS: u64 = 45;

    pub fn trigger_ctrl_v() -> Result<bool> {
        let env = clipboard_environment();
        if env.session != ClipboardSession::X11 {
            // Wayland does not permit client synthetic input injection without compositor privs
            return Ok(false);
        }

        // Brief delay to allow window focus switch to settle
        std::thread::sleep(std::time::Duration::from_millis(LINUX_FOCUS_SETTLE_DELAY_MS));

        // Attempt xdotool key injection
        let status = Command::new("xdotool")
            .args(["key", "--clearmodifiers", "ctrl+v"])
            .status();

        match status {
            Ok(s) if s.success() => Ok(true),
            _ => Ok(false),
        }
    }
}

#[cfg(target_os = "windows")]
pub(crate) mod windows_paste {
    use super::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::{keybd_event, KEYEVENTF_KEYUP};

    const VK_CONTROL: u8 = 0x11;
    const VK_V: u8 = 0x56;

    pub const WINDOWS_FOCUS_SETTLE_DELAY_MS: u64 = 45;

    pub fn trigger_ctrl_v() -> Result<bool> {
        // Sleep briefly to ensure window manager has switched focus to target window
        std::thread::sleep(std::time::Duration::from_millis(WINDOWS_FOCUS_SETTLE_DELAY_MS));

        unsafe {
            // Control DOWN
            keybd_event(VK_CONTROL, 0, 0, 0);
            // V DOWN
            keybd_event(VK_V, 0, 0, 0);
            // V UP
            keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
            // Control UP
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
        }

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paste_execution_result_formatting() {
        let res = PasteExecutionResult::success(true);
        assert!(res.success);
        assert!(res.target_restored);
        assert_eq!(res.method, PasteMethod::SyntheticKeyEvent);
        assert!(!res.fallback_used);

        let fallback = PasteExecutionResult::clipboard_fallback(false, "Wayland restricted");
        assert!(fallback.success);
        assert!(!fallback.target_restored);
        assert_eq!(fallback.method, PasteMethod::ClipboardOnly);
        assert!(fallback.fallback_used);
        assert_eq!(fallback.message.as_deref(), Some("Wayland restricted"));
    }
}
