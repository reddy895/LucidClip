//! Foreground window inspection used for source-app attribution, focus tracking, and exclusions.

use crate::errors::Result;
use crate::platform::focus::ActiveWindowTarget;

/// Return the executable file name of the process owning the foreground window.
///
/// `Ok(None)` means no foreground window or the process could not be queried.
/// The file name is returned without its directory (for example `Code.exe`).
pub fn foreground_process_name() -> Result<Option<String>> {
    #[cfg(target_os = "windows")]
    {
        windows_window::foreground_process_name()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// Capture full foreground window details (HWND, thread, PID, process name, title).
pub fn capture_foreground_target() -> Result<Option<ActiveWindowTarget>> {
    #[cfg(target_os = "windows")]
    {
        windows_window::capture_foreground_target()
    }

    #[cfg(target_os = "linux")]
    {
        linux_window::capture_foreground_target()
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        Ok(None)
    }
}

/// Restore keyboard focus to the specified target window.
pub fn restore_target_focus(target: &ActiveWindowTarget) -> Result<bool> {
    #[cfg(target_os = "windows")]
    {
        windows_window::restore_target_focus(target)
    }

    #[cfg(target_os = "linux")]
    {
        linux_window::restore_target_focus(target)
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = target;
        Ok(false)
    }
}

/// Whether the current platform environment can restore window focus to external processes.
pub fn focus_restoration_supported() -> bool {
    #[cfg(target_os = "windows")]
    {
        true
    }

    #[cfg(target_os = "linux")]
    {
        linux_window::is_supported()
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        false
    }
}

#[cfg(target_os = "linux")]
mod linux_window {
    use super::*;
    use std::process::Command;
    use std::fs;
    use crate::platform::environment::{clipboard_environment, ClipboardSession};

    pub fn is_supported() -> bool {
        let env = clipboard_environment();
        match env.session {
            ClipboardSession::X11 => true,
            ClipboardSession::Wayland | ClipboardSession::Unsupported => false,
        }
    }

    pub fn capture_foreground_target() -> Result<Option<ActiveWindowTarget>> {
        let env = clipboard_environment();
        if env.session != ClipboardSession::X11 {
            return Ok(None);
        }

        // Try xdotool to get active window
        let output = match Command::new("xdotool").arg("getactivewindow").output() {
            Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).trim().to_string(),
            _ => return Ok(None),
        };

        let window_id: usize = match output.parse() {
            Ok(id) => id,
            Err(_) => return Ok(None),
        };

        // Get window title
        let title_out = Command::new("xdotool")
            .args(["getwindowname", &window_id.to_string()])
            .output()
            .ok();
        let window_title = title_out
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|s| !s.is_empty());

        // Get window PID
        let pid_out = Command::new("xdotool")
            .args(["getwindowpid", &window_id.to_string()])
            .output()
            .ok();
        let process_id: u32 = pid_out
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok())
            .unwrap_or(0);

        let process_name = if process_id > 0 {
            fs::read_to_string(format!("/proc/{process_id}/comm"))
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        } else {
            None
        };

        Ok(Some(ActiveWindowTarget::new(
            window_id,
            0,
            process_id,
            process_name,
            window_title,
        )))
    }

    pub fn restore_target_focus(target: &ActiveWindowTarget) -> Result<bool> {
        let env = clipboard_environment();
        if env.session != ClipboardSession::X11 || target.window_id == 0 {
            return Ok(false);
        }

        let res = Command::new("xdotool")
            .args(["windowactivate", &target.window_id.to_string()])
            .status();

        match res {
            Ok(status) => Ok(status.success()),
            Err(_) => Ok(false),
        }
    }
}

#[cfg(target_os = "windows")]
mod windows_window {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::Path;

    use windows_sys::Win32::Foundation::{CloseHandle, HWND};
    use windows_sys::Win32::System::Threading::{
        GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        AttachThreadInput, BringWindowToTop, GetForegroundWindow, GetWindowTextW,
        GetWindowThreadProcessId, SetFocus, SetForegroundWindow,
    };

    use crate::errors::{AppError, Result};
    use crate::platform::focus::ActiveWindowTarget;

    const MAX_PATH_UNITS: usize = 1_024;

    pub fn foreground_process_name() -> Result<Option<String>> {
        let window = unsafe { GetForegroundWindow() };
        if window.is_null() {
            return Ok(None);
        }

        let mut process_id = 0u32;
        if unsafe { GetWindowThreadProcessId(window, &mut process_id) } == 0 || process_id == 0 {
            return Ok(None);
        }

        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
        if process.is_null() {
            return Ok(None);
        }

        let mut buffer = [0u16; MAX_PATH_UNITS];
        let mut size = MAX_PATH_UNITS as u32;
        let success =
            unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut size) };

        unsafe {
            CloseHandle(process);
        }

        if success == 0 || size == 0 {
            return Err(AppError::System(
                "Failed to resolve the foreground process path".into(),
            ));
        }

        let path = Path::new(&OsString::from_wide(&buffer[..size as usize])).to_path_buf();
        Ok(path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned()))
    }

    pub fn capture_foreground_target() -> Result<Option<ActiveWindowTarget>> {
        let window = unsafe { GetForegroundWindow() };
        if window.is_null() {
            return Ok(None);
        }

        let mut process_id = 0u32;
        let thread_id = unsafe { GetWindowThreadProcessId(window, &mut process_id) };
        if thread_id == 0 {
            return Ok(None);
        }

        let process_name = match foreground_process_name() {
            Ok(name) => name,
            Err(_) => None,
        };

        let mut title_buf = [0u16; 512];
        let title_len = unsafe { GetWindowTextW(window, title_buf.as_mut_ptr(), 512) };
        let window_title = if title_len > 0 {
            Some(OsString::from_wide(&title_buf[..title_len as usize]).to_string_lossy().into_owned())
        } else {
            None
        };

        Ok(Some(ActiveWindowTarget::new(
            window as usize,
            thread_id,
            process_id,
            process_name,
            window_title,
        )))
    }

    pub fn restore_target_focus(target: &ActiveWindowTarget) -> Result<bool> {
        let hwnd = target.window_id as HWND;
        if hwnd.is_null() {
            return Ok(false);
        }

        let current_thread = unsafe { GetCurrentThreadId() };
        let attached = if current_thread != target.thread_id && target.thread_id != 0 {
            unsafe { AttachThreadInput(current_thread, target.thread_id, 1) != 0 }
        } else {
            false
        };

        let brought_to_top = unsafe { BringWindowToTop(hwnd) != 0 };
        let foreground_set = unsafe { SetForegroundWindow(hwnd) != 0 };
        let _ = unsafe { SetFocus(hwnd) };

        if attached {
            unsafe {
                AttachThreadInput(current_thread, target.thread_id, 0);
            }
        }

        Ok(brought_to_top || foreground_set)
    }
}
