//! Windows native RegisterHotKey integration.
//!
//! Registers and unregisters system-wide keyboard shortcuts with the Windows operating system.

#[cfg_attr(not(target_os = "windows"), allow(unused_imports))]
use crate::errors::{AppError, Result};
use crate::platform::hotkeys::ShortcutKey;

pub const LUCIDCLIP_HOTKEY_ID: i32 = 0x4C43; // 'LC' in hex

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
            let reg_res = register_hotkey(LUCIDCLIP_HOTKEY_ID, &key);
            let success = reg_res.is_ok();
            let _ = ready_tx.send(reg_res);

            if !success {
                return;
            }

            let mut msg: MSG = unsafe { std::mem::zeroed() };
            while !stop.load(std::sync::atomic::Ordering::Relaxed) {
                let res = unsafe { GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) };
                if res <= 0 {
                    break;
                }

                if msg.message == WM_HOTKEY && msg.wParam == LUCIDCLIP_HOTKEY_ID as usize {
                    on_triggered();
                }

                unsafe {
                    DispatchMessageW(&msg);
                }
            }

            let _ = unregister_hotkey(LUCIDCLIP_HOTKEY_ID);
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
