//! Cross-platform global keyboard shortcut abstraction.
//!
//! Handles registration, key combination parsing, error detection,
//! and lifecycle management of system-wide hotkeys (e.g. Ctrl+Shift+V).

use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use crate::errors::{AppError, Result};

/// Canonical default shortcut for opening the LucidClip floating history popup.
pub const DEFAULT_HISTORY_SHORTCUT: &str = "Ctrl+Shift+V";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShortcutKey {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub meta: bool,
    pub key: String,
}

impl ShortcutKey {
    /// Parse a shortcut specification string such as "Ctrl+Shift+V" or "CommandOrControl+Shift+V".
    pub fn parse(raw: &str) -> Result<Self> {
        let parts: Vec<&str> = raw.split('+').map(str::trim).filter(|s| !s.is_empty()).collect();
        if parts.is_empty() {
            return Err(AppError::InvalidInput("Shortcut cannot be empty".into()));
        }

        let mut ctrl = false;
        let mut shift = false;
        let mut alt = false;
        let mut meta = false;
        let mut key = String::new();

        for part in parts {
            let lower = part.to_lowercase();
            match lower.as_str() {
                "ctrl" | "control" | "commandorcontrol" | "cmdorctrl" => ctrl = true,
                "shift" => shift = true,
                "alt" | "option" => alt = true,
                "meta" | "cmd" | "command" | "win" | "super" => meta = true,
                other => {
                    if !key.is_empty() {
                        return Err(AppError::InvalidInput(format!(
                            "Shortcut cannot define multiple primary keys: '{key}' and '{other}'"
                        )));
                    }
                    key = other.to_uppercase();
                }
            }
        }

        if key.is_empty() {
            return Err(AppError::InvalidInput("Shortcut must specify a primary key".into()));
        }

        let is_valid_key = (key.len() == 1 && key.chars().next().unwrap().is_ascii_alphanumeric())
            || matches!(
                key.as_str(),
                "SPACE" | "TAB" | "ENTER" | "ESCAPE" | "INSERT" | "DELETE" | "HOME" | "END"
                    | "PAGEUP" | "PAGEDOWN" | "UP" | "DOWN" | "LEFT" | "RIGHT"
                    | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12"
            );

        if !is_valid_key {
            return Err(AppError::InvalidInput(format!("Unsupported primary key: '{key}'")));
        }

        Ok(Self {
            ctrl,
            shift,
            alt,
            meta,
            key,
        })
    }

    /// Format into a normalized canonical string.
    pub fn canonical(&self) -> String {
        let mut parts = Vec::new();
        if self.ctrl {
            parts.push("Ctrl");
        }
        if self.alt {
            parts.push("Alt");
        }
        if self.shift {
            parts.push("Shift");
        }
        if self.meta {
            parts.push("Meta");
        }
        parts.push(&self.key);
        parts.join("+")
    }
}

/// Diagnostic state of the global shortcut registration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GlobalShortcutStatus {
    pub shortcut: String,
    pub active: bool,
    pub platform_supported: bool,
    pub error: Option<String>,
}

/// Platform-agnostic manager maintaining the currently active global shortcut.
#[derive(Debug, Clone, Default)]
pub struct GlobalShortcutState {
    current_shortcut: Arc<Mutex<Option<String>>>,
    active: Arc<Mutex<bool>>,
    last_error: Arc<Mutex<Option<String>>>,
}

impl GlobalShortcutState {
    pub fn new() -> Self {
        Self {
            current_shortcut: Arc::new(Mutex::new(Some(DEFAULT_HISTORY_SHORTCUT.to_string()))),
            active: Arc::new(Mutex::new(false)),
            last_error: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_active(&self, shortcut: &str, active: bool, error: Option<String>) {
        if let Ok(mut sc) = self.current_shortcut.lock() {
            *sc = Some(shortcut.to_string());
        }
        if let Ok(mut act) = self.active.lock() {
            *act = active;
        }
        if let Ok(mut err) = self.last_error.lock() {
            *err = error;
        }
    }

    pub fn status(&self, platform_supported: bool) -> GlobalShortcutStatus {
        let shortcut = self
            .current_shortcut
            .lock()
            .ok()
            .and_then(|g| g.clone())
            .unwrap_or_else(|| DEFAULT_HISTORY_SHORTCUT.to_string());

        let active = self.active.lock().map(|g| *g).unwrap_or(false);
        let error = self.last_error.lock().ok().and_then(|g| g.clone());

        GlobalShortcutStatus {
            shortcut,
            active,
            platform_supported,
            error,
        }
    }
}

/// Validate and probe whether a shortcut string is syntactically valid and non-conflicting.
pub fn probe_shortcut_availability(raw: &str) -> Result<ShortcutKey> {
    let key = ShortcutKey::parse(raw)?;

    #[cfg(target_os = "windows")]
    {
        const PROBE_ID: i32 = 0x4C44;
        crate::platform::hotkeys_windows::register_hotkey(PROBE_ID, &key)?;
        let _ = crate::platform::hotkeys_windows::unregister_hotkey(PROBE_ID);
    }

    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shortcut_parsing_and_canonical_formatting() {
        let parsed = ShortcutKey::parse("ctrl+shift+v").unwrap();
        assert!(parsed.ctrl);
        assert!(parsed.shift);
        assert!(!parsed.alt);
        assert_eq!(parsed.key, "V");
        assert_eq!(parsed.canonical(), "Ctrl+Shift+V");

        let custom = ShortcutKey::parse("CommandOrControl+Alt+Shift+H").unwrap();
        assert!(custom.ctrl);
        assert!(custom.alt);
        assert!(custom.shift);
        assert_eq!(custom.key, "H");
        assert_eq!(custom.canonical(), "Ctrl+Alt+Shift+H");
    }

    #[test]
    fn test_shortcut_parsing_errors() {
        assert!(ShortcutKey::parse("").is_err());
        assert!(ShortcutKey::parse("Ctrl+Shift").is_err());
        assert!(ShortcutKey::parse("Ctrl+A+B").is_err());
    }

    #[test]
    fn test_global_shortcut_state() {
        let state = GlobalShortcutState::new();
        let status = state.status(true);
        assert_eq!(status.shortcut, DEFAULT_HISTORY_SHORTCUT);
        assert!(!status.active);

        state.set_active("Ctrl+Shift+V", true, None);
        let updated = state.status(true);
        assert!(updated.active);
        assert!(updated.error.is_none());
    }

    #[test]
    fn test_shortcut_probe() {
        let valid = probe_shortcut_availability("Ctrl+Shift+V");
        assert!(valid.is_ok());

        let invalid = probe_shortcut_availability("InvalidKeyString");
        assert!(invalid.is_err());
    }
}
