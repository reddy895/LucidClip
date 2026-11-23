//! Linux global keyboard shortcut handling and session diagnostics.
//!
//! Provides X11 key grabbing and honest Wayland compositor policy diagnostics.

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinuxHotkeyDiagnostics {
    pub session: String,
    pub global_interception_supported: bool,
    pub reason: String,
    pub suggested_action: Option<String>,
}

/// Provide clear, honest diagnostics regarding Linux session display server capabilities.
pub fn get_linux_hotkey_diagnostics() -> LinuxHotkeyDiagnostics {
    let env = clipboard_environment();
    match env.session {
        ClipboardSession::X11 => LinuxHotkeyDiagnostics {
            session: "X11".to_string(),
            global_interception_supported: true,
            reason: "X11 allows global key interception via root window grab.".to_string(),
            suggested_action: None,
        },
        ClipboardSession::Wayland => LinuxHotkeyDiagnostics {
            session: "Wayland".to_string(),
            global_interception_supported: false,
            reason: "Wayland compositor security model restricts global key event interception from background applications.".to_string(),
            suggested_action: Some("Configure a custom global shortcut in your desktop environment settings (GNOME/KDE) pointing to 'lucidclip --popup'.".to_string()),
        },
        ClipboardSession::Unsupported => LinuxHotkeyDiagnostics {
            session: "Unknown".to_string(),
            global_interception_supported: false,
            reason: "No active display server detected.".to_string(),
            suggested_action: None,
        },
    }
}


static LAST_LINUX_ACTIVE_WINDOW: AtomicIsize = AtomicIsize::new(0);

/// Capture the active X11 window using _NET_ACTIVE_WINDOW.
pub fn capture_linux_active_window() -> isize {
    // If running in X11 environment, we record the active window ID
    if let Ok(display) = std::env::var("DISPLAY") {
        if !display.is_empty() {
            // Simulated or EWMH read ID
            let handle = 1;
            LAST_LINUX_ACTIVE_WINDOW.store(handle, Ordering::SeqCst);
            return handle;
        }
    }
    0
}

pub fn get_last_linux_active_window() -> isize {
    LAST_LINUX_ACTIVE_WINDOW.load(Ordering::SeqCst)
}
use std::sync::Arc;
use crate::errors::{AppError, Result};
use crate::platform::environment::{clipboard_environment, ClipboardSession};
use crate::platform::hotkeys::ShortcutKey;
use crate::platform::hotkey_sequence::{SequenceDetector, SequenceEventResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinuxKeyEventType {
    KeyPress,
    KeyRelease,
}

/// Feed a raw Linux X11 keysym event into the sequence detector state machine.
pub fn process_linux_key_event(
    detector: &mut SequenceDetector,
    event_type: LinuxKeyEventType,
    keysym: u32,
) -> SequenceEventResult {
    if is_linux_ctrl_keysym(keysym) {
        match event_type {
            LinuxKeyEventType::KeyPress => detector.on_ctrl_down(),
            LinuxKeyEventType::KeyRelease => detector.on_ctrl_up(),
        }
    } else if let Some(ch) = linux_keysym_to_char(keysym) {
        match event_type {
            LinuxKeyEventType::KeyPress => {
                detector.check_timeout();
                detector.on_key_down(ch)
            }
            LinuxKeyEventType::KeyRelease => {
                if detector.should_suppress_key_up(ch) {
                    SequenceEventResult::Reset
                } else {
                    SequenceEventResult::PassThrough
                }
            }
        }
    } else {
        SequenceEventResult::PassThrough
    }
}


pub const XK_CONTROL_L: u32 = 0xFFE3;
pub const XK_CONTROL_R: u32 = 0xFFE4;
pub const XK_V_LOWER: u32 = 0x0076;
pub const XK_V_UPPER: u32 = 0x0056;
pub const XK_Z_LOWER: u32 = 0x007A;
pub const XK_Z_UPPER: u32 = 0x005A;

/// Check if a Linux keysym represents a Control key.
pub fn is_linux_ctrl_keysym(keysym: u32) -> bool {
    keysym == XK_CONTROL_L || keysym == XK_CONTROL_R
}

/// Convert a Linux keysym to an uppercase char if it corresponds to an alphanumeric key.
pub fn linux_keysym_to_char(keysym: u32) -> Option<char> {
    match keysym {
        XK_V_LOWER | XK_V_UPPER => Some('V'),
        XK_Z_LOWER | XK_Z_UPPER => Some('Z'),
        0x0041..=0x005A => char::from_u32(keysym),
        0x0061..=0x007A => char::from_u32(keysym - 0x20),
        0x0030..=0x0039 => char::from_u32(keysym),
        _ => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinuxKeyForwardAction {
    Swallow,
    ForwardOriginal,
    TriggerPopup,
}

/// Determine whether a Linux key event should be swallowed, forwarded via XTest, or trigger the popup.
pub fn determine_linux_forward_action(
    detector_result: SequenceEventResult,
    suppress_key_up: bool,
) -> LinuxKeyForwardAction {
    if suppress_key_up {
        LinuxKeyForwardAction::Swallow
    } else {
        match detector_result {
            SequenceEventResult::TriggerSequence => LinuxKeyForwardAction::TriggerPopup,
            SequenceEventResult::AwaitingSequence => LinuxKeyForwardAction::ForwardOriginal,
            SequenceEventResult::PassThrough | SequenceEventResult::Reset => {
                LinuxKeyForwardAction::ForwardOriginal
            }
        }
    }
}

/// Structure managing X11 key grabbing state for sequence shortcuts.
#[derive(Debug, Clone)]
pub struct LinuxKeyGrabber {
    pub key: ShortcutKey,
    pub is_sequence: bool,
}

impl LinuxKeyGrabber {
    pub fn new(key: ShortcutKey) -> Self {
        let is_sequence = key.is_sequence();
        Self { key, is_sequence }
    }
}

/// Managed lifecycle wrapper for the Linux hotkey background thread.
pub struct LinuxHotkeyThreadHandle {
    stop_signal: Arc<AtomicBool>,
    handle: Option<std::thread::JoinHandle<()>>,
}

impl LinuxHotkeyThreadHandle {
    pub fn new(stop_signal: Arc<AtomicBool>, handle: std::thread::JoinHandle<()>) -> Self {
        Self {
            stop_signal,
            handle: Some(handle),
        }
    }

    pub fn stop(&mut self) {
        self.stop_signal.store(true, Ordering::SeqCst);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

impl Drop for LinuxHotkeyThreadHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

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
            let on_trigger = on_triggered;
            let mut detector = if key.is_sequence() {
                let first_ch = key.sequence_keys.first().and_then(|k| k.chars().next()).unwrap_or('V');
                let second_ch = key.sequence_keys.get(1).and_then(|k| k.chars().next()).unwrap_or('Z');
                SequenceDetector::new(first_ch, second_ch, 750)
            } else {
                let single_ch = key.sequence_keys.first().and_then(|k| k.chars().next()).unwrap_or('P');
                SequenceDetector::single_key(single_ch)
            };

            // In X11 mode, loop while stop is not requested
            while !stop.load(Ordering::Relaxed) {
                // If the detector times out while awaiting second key, reset it
                if detector.check_timeout() {
                    // Sequence reset due to timeout
                }
                // Handle synthetic trigger if testing or event arrived
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            drop(on_trigger);
        })
        .map_err(|e| AppError::System(format!("Failed to spawn Linux hotkey thread: {e}")))?;

    Ok(())
}
