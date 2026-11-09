//! Native screen capture integration.

use crate::errors::Result;

/// Rectangle describing the virtual desktop in physical screen coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Raw RGBA image returned by the platform capture layer.
#[derive(Debug, Clone)]
pub struct CapturedImage {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

#[cfg(target_os = "windows")]
mod windows_screenshot {
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::ptr;

    use windows_sys::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BI_RGB, DIB_RGB_COLORS, HBITMAP, HDC,
        HGDIOBJ, SRCCOPY,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN,
    };

    use super::{CapturedImage, ScreenBounds};
    use crate::errors::{AppError, Result};

    struct CaptureContext {
        screen_dc: HDC,
        memory_dc: HDC,
        bitmap: HBITMAP,
        previous: HGDIOBJ,
    }

    impl Drop for CaptureContext {
        fn drop(&mut self) {
            unsafe {
                if !self.previous.is_null() {
                    SelectObject(self.memory_dc, self.previous);
                }
                if !self.bitmap.is_null() {
                    DeleteObject(self.bitmap as HGDIOBJ);
                }
                if !self.memory_dc.is_null() {
                    DeleteDC(self.memory_dc);
                }
                if !self.screen_dc.is_null() {
                    ReleaseDC(ptr::null_mut(), self.screen_dc);
                }
            }
        }
    }

    pub fn virtual_screen_bounds() -> Result<ScreenBounds> {
        let x = unsafe { GetSystemMetrics(SM_XVIRTUALSCREEN) };
        let y = unsafe { GetSystemMetrics(SM_YVIRTUALSCREEN) };
        let width = unsafe { GetSystemMetrics(SM_CXVIRTUALSCREEN) };
        let height = unsafe { GetSystemMetrics(SM_CYVIRTUALSCREEN) };

        if width <= 0 || height <= 0 {
            return Err(AppError::Screenshot(
                "Windows reported an invalid virtual screen size".into(),
            ));
        }

        Ok(ScreenBounds {
            x,
            y,
            width: width as u32,
            height: height as u32,
        })
    }

    pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<CapturedImage> {
        if width == 0 || height == 0 {
            return Err(AppError::InvalidInput(
                "Screenshot width and height must be greater than zero".into(),
            ));
        }

        let buffer_len = (width as usize)
            .checked_mul(height as usize)
            .and_then(|pixels| pixels.checked_mul(4))
            .ok_or_else(|| AppError::InvalidInput("Screenshot dimensions are too large".into()))?;

        unsafe {
            let screen_dc = GetDC(ptr::null_mut());
            if screen_dc.is_null() {
                return Err(AppError::Screenshot(
                    "Failed to acquire the desktop device context".into(),
                ));
            }

            let memory_dc = CreateCompatibleDC(screen_dc);
            if memory_dc.is_null() {
                ReleaseDC(ptr::null_mut(), screen_dc);
                return Err(AppError::Screenshot(
                    "Failed to create a screen capture device context".into(),
                ));
            }

            let bitmap = CreateCompatibleBitmap(screen_dc, width as i32, height as i32);
            if bitmap.is_null() {
                DeleteDC(memory_dc);
                ReleaseDC(ptr::null_mut(), screen_dc);
                return Err(AppError::Screenshot(
                    "Failed to allocate a screen capture bitmap".into(),
                ));
            }

            let previous = SelectObject(memory_dc, bitmap as HGDIOBJ);
            if previous.is_null() {
                DeleteObject(bitmap as HGDIOBJ);
                DeleteDC(memory_dc);
                ReleaseDC(ptr::null_mut(), screen_dc);
                return Err(AppError::Screenshot(
                    "Failed to select the screen capture bitmap".into(),
                ));
            }

            let context = CaptureContext {
                screen_dc,
                memory_dc,
                bitmap,
                previous,
            };

            if BitBlt(
                context.memory_dc,
                0,
                0,
                width as i32,
                height as i32,
                context.screen_dc,
                x,
                y,
                SRCCOPY,
            ) == 0
            {
                return Err(AppError::Screenshot(
                    "Failed to copy the screen into the capture bitmap".into(),
                ));
            }

            let mut info: BITMAPINFO = std::mem::zeroed();
            info.bmiHeader.biSize =
                size_of::<windows_sys::Win32::Graphics::Gdi::BITMAPINFOHEADER>() as u32;
            info.bmiHeader.biWidth = width as i32;
            info.bmiHeader.biHeight = -(height as i32);
            info.bmiHeader.biPlanes = 1;
            info.bmiHeader.biBitCount = 32;
            info.bmiHeader.biCompression = BI_RGB;

            let mut buffer = vec![0u8; buffer_len];
            let lines = GetDIBits(
                context.memory_dc,
                context.bitmap,
                0,
                height,
                buffer.as_mut_ptr() as *mut c_void,
                &mut info,
                DIB_RGB_COLORS,
            );

            if lines == 0 {
                return Err(AppError::Screenshot(
                    "Failed to read pixels from the capture bitmap".into(),
                ));
            }

            // GDI returns BGRA; normalize to RGBA for the image crate.
            for pixel in buffer.chunks_exact_mut(4) {
                pixel.swap(0, 2);
                pixel[3] = 255;
            }

            Ok(CapturedImage {
                width,
                height,
                rgba: buffer,
            })
        }
    }
}

/// Capture an arbitrary rectangle from the Windows virtual desktop.
pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<CapturedImage> {
    #[cfg(target_os = "windows")]
    {
        windows_screenshot::capture_region(x, y, width, height)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (x, y, width, height);
        Err(crate::errors::AppError::Screenshot(
            "Native screenshot capture is only available on Windows".into(),
        ))
    }
}

/// Return the bounds of the Windows virtual desktop.
pub fn virtual_screen_bounds() -> Result<ScreenBounds> {
    #[cfg(target_os = "windows")]
    {
        windows_screenshot::virtual_screen_bounds()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(crate::errors::AppError::Screenshot(
            "Native screenshot capture is only available on Windows".into(),
        ))
    }
}

/// Whether native screenshot capture is available on this host.
pub const fn screenshot_capture_supported() -> bool {
    cfg!(target_os = "windows")
}
