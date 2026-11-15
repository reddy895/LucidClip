//! Windows native RegisterHotKey integration.
//!
//! Registers and unregisters system-wide keyboard shortcuts with the Windows operating system.

#[cfg_attr(not(target_os = "windows"), allow(unused_imports))]
use crate::errors::{AppError, Result};
use crate::platform::hotkeys::ShortcutKey;
#[cfg(target_os = "windows")]
use std::sync::Mutex;
#[cfg(target_os = "windows")]
use crate::platform::hotkey_sequence::{SequenceDetector, SequenceEventResult};

pub const LUCIDCLIP_HOTKEY_ID: i32 = 0x4C43; // 'LC' in hex

pub const VK_CONTROL: u32 = 0x11;
pub const VK_LCONTROL: u32 = 0xA2;
pub const VK_RCONTROL: u32 = 0xA3;
pub const VK_V: u32 = 0x56;
pub const VK_Z: u32 = 0x5A;

use std::sync::atomic::{AtomicIsize, Ordering};

static LAST_FOREGROUND_WINDOW: AtomicIsize = AtomicIsize::new(0);

#[cfg(target_os = "windows")]
pub fn capture_foreground_window() -> isize {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    let hwnd = unsafe { GetForegroundWindow() };
    let handle = hwnd as isize;
    LAST_FOREGROUND_WINDOW.store(handle, Ordering::SeqCst);
    handle
}

#[cfg(not(target_os = "windows"))]
pub fn capture_foreground_window() -> isize {
    0
}

pub fn get_last_foreground_window() -> isize {
    LAST_FOREGROUND_WINDOW.load(Ordering::SeqCst)
}

/// Check if a given Windows virtual key code is any Ctrl key.
pub fn is_ctrl_vk(vk: u32) -> bool {
    vk == VK_CONTROL || vk == VK_LCONTROL || vk == VK_RCONTROL
}

/// Convert a Windows virtual key code to an uppercase ASCII character if applicable.
pub fn vk_to_char(vk: u32) -> Option<char> {
    match vk {
        VK_V => Some('V'),
        VK_Z => Some('Z'),
        0x41..=0x5A => char::from_u32(vk),
        0x30..=0x39 => char::from_u32(vk),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

#[cfg(target_os = "windows")]
pub struct WindowsLowLevelHook {
    hook: HHOOK,
}

#[cfg(target_os = "windows")]
impl WindowsLowLevelHook {
    pub fn install(proc: unsafe extern "system" fn(i32, usize, isize) -> isize) -> Result<Self> {
        let hook = unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(proc), std::ptr::null_mut(), 0) };
        if hook.is_null() {
            let err = unsafe { windows_sys::Win32::Foundation::GetLastError() };
            return Err(AppError::GlobalShortcut(format!(
                "Failed to install WH_KEYBOARD_LL low-level hook (Error {err})"
            )));
        }
        Ok(Self { hook })
    }

    pub fn handle(&self) -> HHOOK {
        self.hook
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsLowLevelHook {
    fn drop(&mut self) {
        if !self.hook.is_null() {
            unsafe {
                UnhookWindowsHookEx(self.hook);
            }
        }
    }
}

#[cfg(target_os = "windows")]
struct WindowsHookContext {
    detector: SequenceDetector,
    on_triggered: Box<dyn Fn() + Send + 'static>,
    hook: HHOOK,
}

#[cfg(target_os = "windows")]
static WINDOWS_HOOK_CONTEXT: Mutex<Option<WindowsHookContext>> = Mutex::new(None);

#[cfg(target_os = "windows")]
unsafe extern "system" fn low_level_keyboard_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    if code < 0 {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    let kbd = *(lparam as *const KBDLLHOOKSTRUCT);
    let vk = kbd.vkCode;
    let is_keydown = wparam as u32 == WM_KEYDOWN || wparam as u32 == WM_SYSKEYDOWN;
    let is_keyup = wparam as u32 == WM_KEYUP || wparam as u32 == WM_SYSKEYUP;

    if let Ok(mut guard) = WINDOWS_HOOK_CONTEXT.lock() {
        if let Some(ctx) = guard.as_mut() {
            if is_ctrl_vk(vk) {
                if is_keydown {
                    ctx.detector.on_ctrl_down();
                } else if is_keyup {
                    ctx.detector.on_ctrl_up();
                }
            } else if let Some(ch) = vk_to_char(vk) {
                // Ensure expired sequence states are reset so late keys pass through normally
                ctx.detector.check_timeout();

                if is_keydown {
                    let res = ctx.detector.on_key_down(ch);
                    if res == SequenceEventResult::TriggerSequence {
                        capture_foreground_window();
                        (ctx.on_triggered)();
                        // Swallow the trigger key so it doesn't cause an undo (Ctrl+Z) in the focused app
                        return 1;
                    }
                    // For PassThrough, AwaitingSequence, or Reset, we intentionally fall through
                    // to CallNextHookEx below so standard keyboard functionality (e.g. normal Ctrl+V paste)
                    // is preserved in full fidelity without blocking host input.
                } else if is_keyup && ctx.detector.should_suppress_key_up(ch) {
                    // Swallow the keyup of the sequence key to avoid ghost key events
                    return 1;
                }
            }
        }
    }

    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

#[cfg(target_os = "windows")]
pub fn register_hotkey(id: i32, key: &ShortcutKey) -> Result<()> {
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, MOD_WIN,
    };

    let mut modifiers = MOD_NOREPEAT;
    if key.ctrl {
        modifiers |= MOD_CONTROL;
    }
    if key.shift {
        modifiers |= MOD_SHIFT;
    }
    if key.alt {
        modifiers |= MOD_ALT;
    }
    if key.meta {
        modifiers |= MOD_WIN;
    }

    let vk = match key.key.as_str() {
        "V" => 0x56,
        "C" => 0x43,
        "X" => 0x58,
        "Z" => 0x5A,
        "SPACE" => 0x20,
        other if other.len() == 1 => other.chars().next().unwrap() as u32,
        _ => {
            return Err(AppError::InvalidInput(format!(
                "Unsupported Windows virtual key: {}",
                key.key
            )))
        }
    };

    let res = unsafe { RegisterHotKey(std::ptr::null_mut(), id, modifiers, vk) };
    if res == 0 {
        let err = unsafe { GetLastError() };
        if err == 1409 {
            return Err(AppError::GlobalShortcut(format!(
                "Shortcut '{}' is already registered by another application (Error 1409).",
                key.canonical()
            )));
        }
        return Err(AppError::GlobalShortcut(format!(
            "Failed to register Windows global shortcut '{}' (Error {err}).",
            key.canonical()
        )));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn unregister_hotkey(id: i32) -> Result<()> {
    use windows_sys::Win32::UI::WindowsAndMessaging::UnregisterHotKey;

    let res = unsafe { UnregisterHotKey(std::ptr::null_mut(), id) };
    if res == 0 {
        return Err(AppError::GlobalShortcut(format!(
            "Failed to unregister Windows hotkey ID {id}"
        )));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register_hotkey(_id: i32, _key: &ShortcutKey) -> Result<()> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn unregister_hotkey(_id: i32) -> Result<()> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn spawn_windows_hotkey_listener<F>(
    key: ShortcutKey,
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    on_triggered: F,
) -> Result<()>
where
    F: Fn() + Send + 'static,
{
    use std::sync::mpsc;
    use std::thread;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, GetMessageW, MSG, WM_HOTKEY,
    };

    let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<()>>(1);

    thread::Builder::new()
        .name("lucidclip-windows-hotkeys".into())
        .spawn(move || {
            let is_seq = key.is_sequence();
            let init_res: Result<()> = if is_seq {
                let hook = unsafe {
                    SetWindowsHookExW(
                        WH_KEYBOARD_LL,
                        Some(low_level_keyboard_proc),
                        std::ptr::null_mut(),
                        0,
                    )
                };
                if hook.is_null() {
                    let err = unsafe { windows_sys::Win32::Foundation::GetLastError() };
                    Err(AppError::GlobalShortcut(format!(
                        "Failed to install WH_KEYBOARD_LL hook: Error {err}"
                    )))
                } else {
                    let first_ch = key.sequence_keys.first().and_then(|k| k.chars().next()).unwrap_or('V');
                    let second_ch = key.sequence_keys.get(1).and_then(|k| k.chars().next()).unwrap_or('Z');
                    let detector = SequenceDetector::new(first_ch, second_ch, 750);
                    if let Ok(mut guard) = WINDOWS_HOOK_CONTEXT.lock() {
                        *guard = Some(WindowsHookContext {
                            detector,
                            on_triggered: Box::new(on_triggered),
                            hook,
                        });
                    }
                    Ok(())
                }
            } else {
                register_hotkey(LUCIDCLIP_HOTKEY_ID, &key)
            };

            let success = init_res.is_ok();
            let _ = ready_tx.send(init_res);

            if !success {
                return;
            }

            let mut msg: MSG = unsafe { std::mem::zeroed() };
            while !stop.load(std::sync::atomic::Ordering::Relaxed) {
                let res = unsafe { GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) };
                if res <= 0 {
                    break;
                }

                if !is_seq && msg.message == WM_HOTKEY && msg.wParam == LUCIDCLIP_HOTKEY_ID as usize {
                    if let Ok(guard) = WINDOWS_HOOK_CONTEXT.lock() {
                        if let Some(ctx) = guard.as_ref() {
                            (ctx.on_triggered)();
                        }
                    }
                }

                unsafe {
                    DispatchMessageW(&msg);
                }
            }

            // Clean teardown on thread exit
            if is_seq {
                if let Ok(mut guard) = WINDOWS_HOOK_CONTEXT.lock() {
                    if let Some(ctx) = guard.take() {
                        if !ctx.hook.is_null() {
                            unsafe {
                                UnhookWindowsHookEx(ctx.hook);
                            }
                        }
                    }
                }
            } else {
                let _ = unregister_hotkey(LUCIDCLIP_HOTKEY_ID);
            }
        })
        .map_err(|e| AppError::System(format!("Failed to spawn Windows hotkey thread: {e}")))?;

    ready_rx
        .recv()
        .map_err(|_| AppError::System("Hotkey initialization thread dropped".into()))?
}

#[cfg(not(target_os = "windows"))]
pub fn spawn_windows_hotkey_listener<F>(
    _key: ShortcutKey,
    _stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    _on_triggered: F,
) -> Result<()>
where
    F: Fn() + Send + 'static,
{
    Ok(())
}
