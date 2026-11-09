//! Foreground window inspection used for source-app attribution and exclusions.

use crate::errors::Result;

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

#[cfg(target_os = "windows")]
mod windows_window {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::Path;

    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    use crate::errors::{AppError, Result};

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
}
