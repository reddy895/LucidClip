//! Operating system clipboard integrations.

use crate::errors::Result;

#[cfg(target_os = "windows")]
mod windows_clipboard {
    use std::ptr;
    use std::thread;
    use std::time::Duration;

    use windows_sys::Win32::Foundation::{GetLastError, GlobalFree, HGLOBAL};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
    };

    use crate::errors::{AppError, Result};

    /// Standard clipboard format identifier for null-terminated UTF-16 text.
    const CF_UNICODETEXT: u32 = 13;

    /// RAII guard that guarantees the clipboard is closed on every exit path.
    struct ClipboardSession;

    impl ClipboardSession {
        fn open() -> Result<Self> {
            // Another process may briefly hold the clipboard; retry with a short backoff.
            for _ in 0..10 {
                if unsafe { OpenClipboard(ptr::null_mut()) } != 0 {
                    return Ok(Self);
                }
                thread::sleep(Duration::from_millis(10));
            }

            Err(AppError::Clipboard(
                "Could not open the Windows clipboard after retrying".into(),
            ))
        }
    }

    impl Drop for ClipboardSession {
        fn drop(&mut self) {
            unsafe {
                CloseClipboard();
            }
        }
    }

    pub fn write_text(text: &str) -> Result<()> {
        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let byte_len = wide.len() * std::mem::size_of::<u16>();

        let _session = ClipboardSession::open()?;

        if unsafe { EmptyClipboard() } == 0 {
            return Err(AppError::Clipboard(format!(
                "Failed to empty the Windows clipboard (error {})",
                unsafe { GetLastError() }
            )));
        }

        let handle: HGLOBAL = unsafe { GlobalAlloc(GMEM_MOVEABLE, byte_len) };
        if handle.is_null() {
            return Err(AppError::Clipboard(
                "Failed to allocate memory for clipboard text".into(),
            ));
        }

        let destination = unsafe { GlobalLock(handle) } as *mut u16;
        if destination.is_null() {
            unsafe {
                GlobalFree(handle);
            }
            return Err(AppError::Clipboard(
                "Failed to lock clipboard memory".into(),
            ));
        }

        unsafe {
            ptr::copy_nonoverlapping(wide.as_ptr(), destination, wide.len());
            GlobalUnlock(handle);

            if SetClipboardData(CF_UNICODETEXT, handle).is_null() {
                let error = GetLastError();
                GlobalFree(handle);
                return Err(AppError::Clipboard(format!(
                    "Failed to set Windows clipboard data (error {error})"
                )));
            }
        }

        Ok(())
    }
}

/// Write plain text to the operating system clipboard.
pub fn set_clipboard_text(text: &str) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::write_text(text)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Non-Windows hosts are development-only for LucidClip.
        println!(
            "[LucidClip Platform] Clipboard write skipped on this host ({} characters)",
            text.len()
        );
        Ok(())
    }
}
