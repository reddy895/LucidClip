//! Operating system clipboard integrations.

use crate::errors::Result;

#[cfg(target_os = "windows")]
mod windows_clipboard {
    use std::ptr;
    use std::thread;
    use std::time::Duration;

    use windows_sys::Win32::Foundation::{GetLastError, GlobalFree, HGLOBAL};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable,
        OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
    };

    use crate::errors::{AppError, Result};

    /// Standard clipboard format identifier for null-terminated UTF-16 text.
    const CF_UNICODETEXT: u32 = 13;

    /// Device-independent bitmap format.
    const CF_DIB: u32 = 8;

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


    pub fn write_image(rgba: &[u8], width: u32, height: u32) -> Result<()> {
        if width == 0 || height == 0 {
            return Err(AppError::Clipboard(
                "Image dimensions must be greater than zero".into(),
            ));
        }

        let expected = (width as usize)
            .checked_mul(height as usize)
            .and_then(|pixels| pixels.checked_mul(4))
            .ok_or_else(|| AppError::Clipboard("Image dimensions are too large".into()))?;

        if rgba.len() != expected {
            return Err(AppError::Clipboard(
                "Image buffer does not match its dimensions".into(),
            ));
        }

        // BITMAPINFOHEADER is 40 bytes; CF_DIB expects the header immediately
        // followed by bottom-up BGRA pixels.
        const HEADER_SIZE: usize = 40;
        let pixel_bytes = expected;
        let total_bytes = HEADER_SIZE + pixel_bytes;

        let _session = ClipboardSession::open()?;

        if unsafe { EmptyClipboard() } == 0 {
            return Err(AppError::Clipboard(format!(
                "Failed to empty the Windows clipboard (error {})",
                unsafe { GetLastError() }
            )));
        }

        let handle: HGLOBAL = unsafe { GlobalAlloc(GMEM_MOVEABLE, total_bytes) };
        if handle.is_null() {
            return Err(AppError::Clipboard(
                "Failed to allocate memory for clipboard image".into(),
            ));
        }

        let destination = unsafe { GlobalLock(handle) } as *mut u8;
        if destination.is_null() {
            unsafe {
                GlobalFree(handle);
            }
            return Err(AppError::Clipboard(
                "Failed to lock clipboard image memory".into(),
            ));
        }

        unsafe {
            let header = destination;
            std::ptr::write_bytes(header, 0, HEADER_SIZE);

            let write_u32 = |offset: usize, value: u32| {
                std::ptr::copy_nonoverlapping(
                    value.to_le_bytes().as_ptr(),
                    header.add(offset),
                    4,
                );
            };
            write_u32(0, HEADER_SIZE as u32); // biSize
            write_u32(4, width); // biWidth
            write_u32(8, height); // biHeight (positive = bottom-up)
            write_u32(12, 1u32 | (32u32 << 16)); // biPlanes, biBitCount
            write_u32(20, pixel_bytes as u32); // biSizeImage

            for row in 0..height as usize {
                let source_row = (height as usize - 1 - row) * width as usize * 4;
                let target_row = HEADER_SIZE + row * width as usize * 4;
                for column in 0..width as usize {
                    let source = source_row + column * 4;
                    let target = header.add(target_row + column * 4);
                    *target = rgba[source + 2]; // blue
                    *target.add(1) = rgba[source + 1]; // green
                    *target.add(2) = rgba[source]; // red
                    *target.add(3) = 255; // alpha is ignored by CF_DIB
                }
            }

            GlobalUnlock(handle);

            if SetClipboardData(CF_DIB, handle).is_null() {
                let error = GetLastError();
                GlobalFree(handle);
                return Err(AppError::Clipboard(format!(
                    "Failed to set Windows clipboard image (error {error})"
                )));
            }
        }

        Ok(())
    }

    /// Check the standard Windows opt-out formats that password managers and
    /// other sensitive applications use to exclude clipboard contents.
    pub fn content_is_sensitive() -> Result<bool> {
        let _session = ClipboardSession::open()?;

        let excluded = register_format("ExcludeClipboardContentFromMonitorProcessing");
        if excluded != 0 && unsafe { IsClipboardFormatAvailable(excluded) } != 0 {
            return Ok(true);
        }

        for name in ["CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"] {
            let format = register_format(name);
            if format == 0 || unsafe { IsClipboardFormatAvailable(format) } == 0 {
                continue;
            }

            let handle = unsafe { GetClipboardData(format) };
            if handle.is_null() {
                continue;
            }

            let value = unsafe { GlobalLock(handle) } as *const u32;
            if value.is_null() {
                continue;
            }

            let allowed = unsafe { *value };
            unsafe {
                GlobalUnlock(handle);
            }

            if allowed == 0 {
                return Ok(true);
            }
        }

        Ok(false)
    }

    fn register_format(name: &str) -> u32 {
        let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe { RegisterClipboardFormatW(wide.as_ptr()) }
    }

    pub fn read_text() -> Result<Option<String>> {
        let _session = ClipboardSession::open()?;

        if unsafe { IsClipboardFormatAvailable(CF_UNICODETEXT) } == 0 {
            return Ok(None);
        }

        let handle = unsafe { GetClipboardData(CF_UNICODETEXT) };
        if handle.is_null() {
            return Ok(None);
        }

        let source = unsafe { GlobalLock(handle) } as *const u16;
        if source.is_null() {
            return Err(AppError::Clipboard(
                "Failed to lock Windows clipboard data".into(),
            ));
        }

        let byte_len = unsafe { GlobalSize(handle) };
        let unit_count = byte_len / std::mem::size_of::<u16>();
        let mut utf16 = Vec::with_capacity(unit_count.min(1_048_576));

        unsafe {
            for index in 0..unit_count {
                let unit = *source.add(index);
                if unit == 0 {
                    break;
                }
                utf16.push(unit);
            }
            GlobalUnlock(handle);
        }

        Ok(Some(String::from_utf16_lossy(&utf16)))
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

/// Write an RGBA image to the operating system clipboard.
pub fn set_clipboard_image(rgba: &[u8], width: u32, height: u32) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::write_image(rgba, width, height)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (rgba, width, height);
        Err(crate::errors::AppError::Clipboard(
            "Copying images is only available on Windows".into(),
        ))
    }
}

/// Read text from the operating system clipboard when the platform supports it.
///
/// `Ok(None)` means the clipboard contains no supported text format. On hosts
/// without native clipboard integration this always returns `Ok(None)` so
/// development builds never fabricate clipboard content.
pub fn read_clipboard_text() -> Result<Option<String>> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::read_text()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

/// Whether the clipboard currently carries an application-declared sensitive
/// marker. Hosts without native clipboard integration report `false`.
pub fn clipboard_content_is_sensitive() -> Result<bool> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::content_is_sensitive()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

/// Whether background clipboard monitoring is available on this host.
pub const fn clipboard_monitoring_supported() -> bool {
    cfg!(target_os = "windows")
}
