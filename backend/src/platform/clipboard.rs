//! Operating system clipboard integrations.

use crate::errors::{AppError, Result};
use crate::platform::CapturedImage;

/// A supported clipboard value captured in one clipboard session.
#[derive(Debug, Clone)]
pub enum ClipboardSnapshot {
    Text(String),
    Image(CapturedImage),
    Files(Vec<String>),
}

/// Maximum decoded image bytes accepted from another process.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
const MAX_IMAGE_BYTES: usize = 128 * 1024 * 1024;

/// Maximum number of file references accepted from one clipboard value.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
const MAX_FILE_COUNT: usize = 10_000;

#[cfg(target_os = "windows")]
mod windows_clipboard {
    use std::ptr;
    use std::thread;
    use std::time::Duration;

    use windows_sys::Win32::Foundation::{GetLastError, GlobalFree, HGLOBAL};
    use windows_sys::Win32::Globalization::MultiByteToWideChar;
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable,
        OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
    };

    use super::{build_dropfiles, parse_dib, parse_file_list, ClipboardSnapshot};
    use crate::errors::{AppError, Result};
    use crate::platform::CapturedImage;

    /// Standard clipboard format identifier for null-terminated UTF-16 text.
    const CF_UNICODETEXT: u32 = 13;

    /// Legacy ANSI text format used by some older applications.
    const CF_TEXT: u32 = 1;

    /// Device-independent bitmap format.
    const CF_DIB: u32 = 8;

    /// Device-independent bitmap with an extended header.
    const CF_DIBV5: u32 = 17;

    /// Shell file list.
    const CF_HDROP: u32 = 15;

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
                std::ptr::copy_nonoverlapping(value.to_le_bytes().as_ptr(), header.add(offset), 4);
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

    pub fn write_files(files: &[String]) -> Result<()> {
        let data = build_dropfiles(files)?;
        let _session = ClipboardSession::open()?;

        if unsafe { EmptyClipboard() } == 0 {
            return Err(AppError::Clipboard(format!(
                "Failed to empty the Windows clipboard (error {})",
                unsafe { GetLastError() }
            )));
        }

        let handle: HGLOBAL = unsafe { GlobalAlloc(GMEM_MOVEABLE, data.len()) };
        if handle.is_null() {
            return Err(AppError::Clipboard(
                "Failed to allocate memory for the file list".into(),
            ));
        }

        let destination = unsafe { GlobalLock(handle) } as *mut u8;
        if destination.is_null() {
            unsafe {
                GlobalFree(handle);
            }
            return Err(AppError::Clipboard(
                "Failed to lock clipboard memory".into(),
            ));
        }

        unsafe {
            ptr::copy_nonoverlapping(data.as_ptr(), destination, data.len());
            GlobalUnlock(handle);

            if SetClipboardData(CF_HDROP, handle).is_null() {
                let error = GetLastError();
                GlobalFree(handle);
                return Err(AppError::Clipboard(format!(
                    "Failed to set Windows clipboard files (error {error})"
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

    pub fn read_snapshot() -> Result<Option<ClipboardSnapshot>> {
        let _session = ClipboardSession::open()?;

        if unsafe { IsClipboardFormatAvailable(CF_HDROP) } != 0 {
            match read_files() {
                Ok(Some(files)) => return Ok(Some(ClipboardSnapshot::Files(files))),
                Ok(None) => {}
                Err(err) => {
                    eprintln!("[LucidClip Clipboard] Could not read clipboard files: {err}");
                }
            }
        }

        for format in [CF_DIB, CF_DIBV5] {
            if unsafe { IsClipboardFormatAvailable(format) } != 0 {
                match read_image(format) {
                    Ok(Some(image)) => return Ok(Some(ClipboardSnapshot::Image(image))),
                    Ok(None) => {}
                    Err(err) => {
                        eprintln!("[LucidClip Clipboard] Could not read clipboard bitmap: {err}");
                    }
                }
            }
        }

        if let Some(text) = read_unicode_text()? {
            return Ok(Some(ClipboardSnapshot::Text(text)));
        }

        if let Some(text) = read_ansi_text()? {
            return Ok(Some(ClipboardSnapshot::Text(text)));
        }

        Ok(None)
    }

    pub fn read_text() -> Result<Option<String>> {
        let _session = ClipboardSession::open()?;
        read_unicode_text()
    }

    fn read_unicode_text() -> Result<Option<String>> {
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

    fn read_ansi_text() -> Result<Option<String>> {
        if unsafe { IsClipboardFormatAvailable(CF_TEXT) } == 0 {
            return Ok(None);
        }

        let handle = unsafe { GetClipboardData(CF_TEXT) };
        if handle.is_null() {
            return Ok(None);
        }

        let source = unsafe { GlobalLock(handle) } as *const u8;
        if source.is_null() {
            return Err(AppError::Clipboard(
                "Failed to lock Windows clipboard text".into(),
            ));
        }

        let byte_len = unsafe { GlobalSize(handle) } as usize;
        let bytes = unsafe { std::slice::from_raw_parts(source, byte_len) };
        let end = bytes.iter().position(|byte| *byte == 0).unwrap_or(byte_len);
        let ansi = bytes[..end].to_vec();
        unsafe {
            GlobalUnlock(handle);
        }

        if ansi.is_empty() {
            return Ok(None);
        }

        let ansi_len = i32::try_from(ansi.len())
            .map_err(|_| AppError::Clipboard("Clipboard text is too large".into()))?;
        let wide_len =
            unsafe { MultiByteToWideChar(0, 0, ansi.as_ptr(), ansi_len, std::ptr::null_mut(), 0) };
        if wide_len <= 0 {
            return Err(AppError::Clipboard(
                "Failed to measure legacy clipboard text".into(),
            ));
        }

        let mut wide = vec![0u16; wide_len as usize];
        let written = unsafe {
            MultiByteToWideChar(0, 0, ansi.as_ptr(), ansi_len, wide.as_mut_ptr(), wide_len)
        };
        if written <= 0 {
            return Err(AppError::Clipboard(
                "Failed to decode legacy clipboard text".into(),
            ));
        }

        Ok(Some(String::from_utf16_lossy(&wide)))
    }

    fn read_files() -> Result<Option<Vec<String>>> {
        let handle = unsafe { GetClipboardData(CF_HDROP) };
        if handle.is_null() {
            return Ok(None);
        }

        let source = unsafe { GlobalLock(handle) } as *const u8;
        if source.is_null() {
            return Err(AppError::Clipboard(
                "Failed to lock the Windows file list".into(),
            ));
        }

        let byte_len = unsafe { GlobalSize(handle) } as usize;
        let data = unsafe { std::slice::from_raw_parts(source, byte_len) };
        let result = parse_file_list(data);
        unsafe {
            GlobalUnlock(handle);
        }

        match result {
            Ok(files) if files.is_empty() => Ok(None),
            Ok(files) => Ok(Some(files)),
            Err(err) => Err(err),
        }
    }

    fn read_image(format: u32) -> Result<Option<CapturedImage>> {
        let handle = unsafe { GetClipboardData(format) };
        if handle.is_null() {
            return Ok(None);
        }

        let source = unsafe { GlobalLock(handle) } as *const u8;
        if source.is_null() {
            return Err(AppError::Clipboard(
                "Failed to lock the Windows clipboard image".into(),
            ));
        }

        let byte_len = unsafe { GlobalSize(handle) } as usize;
        let data = unsafe { std::slice::from_raw_parts(source, byte_len) };
        let result = parse_dib(data);
        unsafe {
            GlobalUnlock(handle);
        }
        result.map(Some)
    }
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn build_dropfiles(files: &[String]) -> Result<Vec<u8>> {
    if files.is_empty() {
        return Err(AppError::InvalidInput(
            "At least one file path is required".into(),
        ));
    }
    if files.iter().any(|file| file.contains('\0')) {
        return Err(AppError::InvalidInput(
            "File paths cannot contain null characters".into(),
        ));
    }

    let mut paths = String::new();
    for file in files {
        paths.push_str(file);
        paths.push('\0');
    }
    paths.push('\0');

    let mut data = vec![0u8; 20];
    data[0..4].copy_from_slice(&20u32.to_le_bytes());
    data[16..20].copy_from_slice(&1u32.to_le_bytes());
    for unit in paths.encode_utf16() {
        data.extend_from_slice(&unit.to_le_bytes());
    }
    Ok(data)
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn parse_file_list(data: &[u8]) -> Result<Vec<String>> {
    if data.len() < 20 {
        return Err(AppError::Clipboard(
            "Windows returned a truncated file list".into(),
        ));
    }

    let offset = u32::from_le_bytes(data[0..4].try_into().unwrap()) as usize;
    let wide = u32::from_le_bytes(data[16..20].try_into().unwrap()) != 0;
    if offset >= data.len() {
        return Err(AppError::Clipboard(
            "Windows returned an invalid file list offset".into(),
        ));
    }
    if !wide {
        return Err(AppError::Clipboard(
            "ANSI file lists are not supported".into(),
        ));
    }

    let mut files = Vec::new();
    let mut cursor = offset;
    while cursor + 2 <= data.len() && files.len() < MAX_FILE_COUNT {
        let mut units = Vec::new();
        loop {
            if cursor + 2 > data.len() {
                break;
            }
            let unit = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
            cursor += 2;
            if unit == 0 {
                break;
            }
            units.push(unit);
        }

        if units.is_empty() {
            break;
        }
        files.push(String::from_utf16_lossy(&units));
    }

    Ok(files)
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn parse_dib(data: &[u8]) -> Result<CapturedImage> {
    if data.len() < 40 {
        return Err(AppError::Clipboard(
            "Windows returned a truncated bitmap".into(),
        ));
    }

    let header_size = u32::from_le_bytes(data[0..4].try_into().unwrap()) as usize;
    if header_size < 40 || header_size > data.len() {
        return Err(AppError::Clipboard(
            "Windows returned an unsupported bitmap header".into(),
        ));
    }

    let width = i32::from_le_bytes(data[4..8].try_into().unwrap());
    let signed_height = i32::from_le_bytes(data[8..12].try_into().unwrap());
    let planes = u16::from_le_bytes(data[12..14].try_into().unwrap());
    let bit_count = u16::from_le_bytes(data[14..16].try_into().unwrap());
    let compression = u32::from_le_bytes(data[16..20].try_into().unwrap());

    if width <= 0 || signed_height == 0 || planes != 1 {
        return Err(AppError::Clipboard(
            "Windows returned invalid bitmap dimensions".into(),
        ));
    }
    if compression != 0 || !matches!(bit_count, 24 | 32) {
        return Err(AppError::Clipboard(format!(
            "Unsupported clipboard bitmap (compression {compression}, {bit_count} bpp)"
        )));
    }

    let width = width as u32;
    let height = signed_height.unsigned_abs();
    let top_down = signed_height < 0;
    if width > 32_768 || height > 32_768 {
        return Err(AppError::Clipboard(
            "Clipboard bitmap dimensions are too large".into(),
        ));
    }

    let row_stride = (width as usize * bit_count as usize).div_ceil(32) * 4;
    let pixel_bytes = row_stride
        .checked_mul(height as usize)
        .ok_or_else(|| AppError::Clipboard("Clipboard bitmap size overflowed".into()))?;
    let total_bytes = header_size
        .checked_add(pixel_bytes)
        .ok_or_else(|| AppError::Clipboard("Clipboard bitmap size overflowed".into()))?;

    if total_bytes > data.len() || pixel_bytes > MAX_IMAGE_BYTES {
        return Err(AppError::Clipboard(
            "Clipboard bitmap is larger than the supported limit".into(),
        ));
    }

    let rgba_len = (width as usize)
        .checked_mul(height as usize)
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| AppError::Clipboard("Clipboard bitmap size overflowed".into()))?;
    let mut rgba = vec![0u8; rgba_len];
    let bytes_per_pixel = (bit_count / 8) as usize;

    for row in 0..height as usize {
        let source_row = if top_down {
            row
        } else {
            height as usize - 1 - row
        };
        for column in 0..width as usize {
            let source_index = header_size + source_row * row_stride + column * bytes_per_pixel;
            let target_index = (row * width as usize + column) * 4;
            rgba[target_index] = data[source_index + 2];
            rgba[target_index + 1] = data[source_index + 1];
            rgba[target_index + 2] = data[source_index];
            rgba[target_index + 3] = 255;
        }
    }

    Ok(CapturedImage {
        width,
        height,
        rgba,
    })
}

/// Write plain text to the operating system clipboard.
pub fn set_clipboard_text(text: &str) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::write_text(text)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Err(AppError::Clipboard(
            "Clipboard writing is only available on Windows".into(),
        ))
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
        Err(AppError::Clipboard(
            "Copying images is only available on Windows".into(),
        ))
    }
}

/// Write file references so Explorer and other applications can paste them.
pub fn set_clipboard_files(files: &[String]) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::write_files(files)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = files;
        Err(AppError::Clipboard(
            "Copying files is only available on Windows".into(),
        ))
    }
}

/// Read the highest-priority supported value from the clipboard in one session.
pub fn read_clipboard_snapshot() -> Result<Option<ClipboardSnapshot>> {
    #[cfg(target_os = "windows")]
    {
        windows_clipboard::read_snapshot()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn dib_2x2_top_down() -> Vec<u8> {
        let mut data = vec![0u8; 40];
        data[0..4].copy_from_slice(&40u32.to_le_bytes());
        data[4..8].copy_from_slice(&2i32.to_le_bytes());
        data[8..12].copy_from_slice(&(-2i32).to_le_bytes());
        data[12..14].copy_from_slice(&1u16.to_le_bytes());
        data[14..16].copy_from_slice(&24u16.to_le_bytes());
        data.extend_from_slice(&[
            0, 0, 255, 0, 255, 0, 0, 0, // red, green + padding
            255, 0, 0, 255, 255, 255, 0, 0, // blue, white + padding
        ]);
        data
    }

    #[test]
    fn parses_top_down_24_bit_bitmap() {
        let image = parse_dib(&dib_2x2_top_down()).unwrap();
        assert_eq!((image.width, image.height), (2, 2));
        assert_eq!(&image.rgba[0..4], &[255, 0, 0, 255]);
        assert_eq!(&image.rgba[4..8], &[0, 255, 0, 255]);
        assert_eq!(&image.rgba[8..12], &[0, 0, 255, 255]);
        assert_eq!(&image.rgba[12..16], &[255, 255, 255, 255]);
    }

    #[test]
    fn rejects_compressed_or_truncated_bitmaps() {
        let mut compressed = dib_2x2_top_down();
        compressed[16..20].copy_from_slice(&3u32.to_le_bytes());
        assert!(parse_dib(&compressed).is_err());
        assert!(parse_dib(&dib_2x2_top_down()[..44]).is_err());
    }

    #[test]
    fn parses_wide_dropfile_list() {
        let paths = "C:\\Work\\a.txt\0D:\\b.txt\0\0";
        let wide: Vec<u8> = paths
            .encode_utf16()
            .flat_map(|unit| unit.to_le_bytes())
            .collect();
        let mut data = vec![0u8; 20];
        data[0..4].copy_from_slice(&20u32.to_le_bytes());
        data[16..20].copy_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&wide);

        assert_eq!(
            parse_file_list(&data).unwrap(),
            vec!["C:\\Work\\a.txt".to_string(), "D:\\b.txt".to_string()]
        );
    }

    #[test]
    fn builds_wide_dropfile_header_and_paths() {
        let data = build_dropfiles(&["C:\\a.txt".into(), "D:\\b.txt".into()]).unwrap();
        assert_eq!(&data[0..4], &20u32.to_le_bytes());
        assert_eq!(&data[16..20], &1u32.to_le_bytes());
        assert_eq!(
            parse_file_list(&data).unwrap(),
            vec!["C:\\a.txt", "D:\\b.txt"]
        );
    }

    #[test]
    fn rejects_invalid_file_list_offsets() {
        let mut data = vec![0u8; 20];
        data[0..4].copy_from_slice(&20u32.to_le_bytes());
        assert!(parse_file_list(&data).is_err());
    }
}
