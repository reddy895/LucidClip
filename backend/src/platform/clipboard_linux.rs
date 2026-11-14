//! Linux clipboard backend backed by the GTK clipboard runtime that Tauri
//! already loads on Linux.
//!
//! GTK is not thread-safe. Every clipboard operation is therefore marshalled
//! onto the GTK main context with `glib::MainContext::invoke`, and change
//! notifications come from the clipboard's `owner-change` signal instead of a
//! tight polling loop. A controlled safety poll still runs in the monitor.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::Duration;

use gtk::gdk;
use gtk::gdk_pixbuf;
use gtk::glib;
use gtk::prelude::*;

use crate::errors::{AppError, Result};
use crate::platform::clipboard::ClipboardSnapshot;
use crate::platform::CapturedImage;

/// The GTK clipboard is only usable after the Tauri GTK runtime has started.
static READY: AtomicBool = AtomicBool::new(false);

/// Bound on how long a monitor thread waits for the GTK main loop.
const MAIN_CONTEXT_TIMEOUT: Duration = Duration::from_secs(3);

/// Maximum decoded pixels accepted from a clipboard image.
const MAX_IMAGE_PIXELS: u64 = 64 * 1024 * 1024;

pub fn is_ready() -> bool {
    READY.load(Ordering::Relaxed)
}

/// Initialize GTK clipboard access. Must be called on the GTK main thread.
pub fn initialize() -> std::result::Result<(), String> {
    if !gtk::is_initialized() {
        gtk::init().map_err(|err| format!("GTK initialization failed: {err}"))?;
    }

    if gdk::Display::default().is_none() {
        return Err(
            "GTK initialized without a display; no Linux clipboard is available".to_string(),
        );
    }

    READY.store(true, Ordering::Relaxed);
    Ok(())
}

/// Stop reporting the backend as available during shutdown.
pub fn shutdown() {
    READY.store(false, Ordering::Relaxed);
}

fn require_ready() -> Result<()> {
    if is_ready() {
        Ok(())
    } else {
        Err(AppError::Clipboard(
            "The Linux GTK clipboard backend is not initialized".into(),
        ))
    }
}

fn run_on_main<T, F>(func: F) -> Result<T>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T> + Send + 'static,
{
    require_ready()?;

    let (tx, rx) = mpsc::sync_channel(1);
    glib::MainContext::default().invoke(move || {
        let _ = tx.send(func());
    });

    match rx.recv_timeout(MAIN_CONTEXT_TIMEOUT) {
        Ok(result) => result,
        Err(_) => Err(AppError::Clipboard(
            "Timed out waiting for the GTK clipboard main loop".into(),
        )),
    }
}

fn clipboard() -> gtk::Clipboard {
    gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD)
}

/// Read the highest-priority supported value from the CLIPBOARD selection.
pub fn read_snapshot() -> Result<Option<ClipboardSnapshot>> {
    run_on_main(|| Ok(read_snapshot_on_main()))
}

fn read_snapshot_on_main() -> Option<ClipboardSnapshot> {
    let clipboard = clipboard();

    if let Some(files) = read_files_on_main(&clipboard) {
        if !files.is_empty() {
            return Some(ClipboardSnapshot::Files(files));
        }
    }

    if clipboard.wait_is_image_available() {
        if let Some(image) = read_image_on_main(&clipboard) {
            return Some(ClipboardSnapshot::Image(image));
        }
    }

    if let Some(text) = clipboard.wait_for_text() {
        let text = text.to_string();
        if !text.is_empty() {
            return Some(ClipboardSnapshot::Text(text));
        }
    }

    None
}

/// Read only plain text from the CLIPBOARD selection.
pub fn read_text() -> Result<Option<String>> {
    run_on_main(|| {
        let clipboard = clipboard();
        Ok(clipboard
            .wait_for_text()
            .map(|text| text.to_string())
            .filter(|text| !text.is_empty()))
    })
}

fn read_files_on_main(clipboard: &gtk::Clipboard) -> Option<Vec<String>> {
    if !clipboard.wait_is_uris_available() {
        return None;
    }

    let uris = clipboard.wait_for_uris();
    let files: Vec<String> = uris.iter().filter_map(|uri| uri_to_path(uri)).collect();
    if files.is_empty() {
        None
    } else {
        Some(files)
    }
}

fn read_image_on_main(clipboard: &gtk::Clipboard) -> Option<CapturedImage> {
    clipboard
        .wait_for_image()
        .and_then(|pixbuf| pixbuf_to_captured(&pixbuf))
}

fn pixbuf_to_captured(pixbuf: &gdk_pixbuf::Pixbuf) -> Option<CapturedImage> {
    let width = u32::try_from(pixbuf.width()).ok()?;
    let height = u32::try_from(pixbuf.height()).ok()?;
    let rowstride = usize::try_from(pixbuf.rowstride()).ok()?;
    let channels = usize::try_from(pixbuf.n_channels()).ok()?;
    let bytes = pixbuf.read_pixel_bytes();
    let rgba = pixel_bytes_to_rgba(bytes.as_ref(), width, height, rowstride, channels)?;

    Some(CapturedImage {
        width,
        height,
        rgba,
    })
}

/// Convert GDK pixbuf pixel bytes (RGB or RGBA) into tightly packed RGBA.
pub fn pixel_bytes_to_rgba(
    data: &[u8],
    width: u32,
    height: u32,
    rowstride: usize,
    channels: usize,
) -> Option<Vec<u8>> {
    if width == 0 || height == 0 || !matches!(channels, 3 | 4) {
        return None;
    }

    let pixel_count = u64::from(width).checked_mul(u64::from(height))?;
    if pixel_count > MAX_IMAGE_PIXELS {
        return None;
    }

    let row_bytes = (width as usize).checked_mul(channels)?;
    let required = rowstride.checked_mul(height as usize)?;
    if rowstride < row_bytes || data.len() < required {
        return None;
    }

    let mut rgba = vec![0u8; (pixel_count as usize).checked_mul(4)?];
    for row in 0..height as usize {
        let source_row = row * rowstride;
        let target_row = row * width as usize * 4;
        for column in 0..width as usize {
            let source = source_row + column * channels;
            let target = target_row + column * 4;
            rgba[target] = data[source];
            rgba[target + 1] = data[source + 1];
            rgba[target + 2] = data[source + 2];
            rgba[target + 3] = if channels == 4 { data[source + 3] } else { 255 };
        }
    }

    Some(rgba)
}

/// Convert a `file://` URI into a local path.
///
/// Only local files are returned; remote authorities are rejected so a copied
/// URI can never turn into a misleading local path.
pub fn uri_to_path(uri: &str) -> Option<String> {
    let rest = uri.strip_prefix("file://")?;
    let path = if let Some(path) = rest.strip_prefix('/') {
        format!("/{path}")
    } else {
        let slash = rest.find('/')?;
        let (authority, path) = rest.split_at(slash);
        if !authority.is_empty() && !authority.eq_ignore_ascii_case("localhost") {
            return None;
        }
        path.to_string()
    };

    let decoded = percent_decode(path.as_bytes());
    let decoded = String::from_utf8_lossy(&decoded).into_owned();
    if decoded.is_empty() {
        None
    } else {
        Some(decoded)
    }
}

fn percent_decode(input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());
    let mut index = 0;
    while index < input.len() {
        if input[index] == b'%' && index + 2 < input.len() {
            let hex = &input[index + 1..index + 3];
            if let Ok(text) = std::str::from_utf8(hex) {
                if let Ok(value) = u8::from_str_radix(text, 16) {
                    output.push(value);
                    index += 3;
                    continue;
                }
            }
        }
        output.push(input[index]);
        index += 1;
    }
    output
}

/// Detect the KDE, KeePassXC, Bitwarden, or 1Password password-manager opt-out target.
pub fn target_name_is_sensitive(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name == "x-kde-passwordmanagerhint"
        || name == "application/x-kde-passwordmanagerhint"
        || name == "application/x-keepassxc-selection"
        || name == "x-keepassxc"
        || name == "application/x-bitwarden"
        || name == "x-1password"
}

pub fn content_is_sensitive() -> Result<bool> {
    run_on_main(|| {
        let clipboard = clipboard();
        let sensitive = clipboard
            .wait_for_targets()
            .map(|targets| {
                targets
                    .iter()
                    .any(|atom| target_name_is_sensitive(&atom.name()))
            })
            .unwrap_or(false);
        Ok(sensitive)
    })
}

/// Write plain text to the CLIPBOARD selection.
pub fn write_text(text: &str) -> Result<()> {
    let text = text.to_string();
    run_on_main(move || {
        let clipboard = clipboard();
        clipboard.set_text(&text);
        clipboard.store();
        Ok(())
    })
}

/// Write an RGBA image to the CLIPBOARD selection.
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

    let rowstride = (width as i32)
        .checked_mul(4)
        .ok_or_else(|| AppError::Clipboard("Image row stride overflowed".into()))?;
    let rgba = rgba.to_vec();

    run_on_main(move || {
        let bytes = glib::Bytes::from_owned(rgba);
        let pixbuf = gdk_pixbuf::Pixbuf::from_bytes(
            &bytes,
            gdk_pixbuf::Colorspace::Rgb,
            true,
            8,
            width as i32,
            height as i32,
            rowstride,
        );
        let clipboard = clipboard();
        clipboard.set_image(&pixbuf);
        clipboard.store();
        Ok(())
    })
}

/// Write file references as a `text/uri-list` selection.
pub fn write_files(files: &[String]) -> Result<()> {
    if files.is_empty() {
        return Err(AppError::InvalidInput(
            "At least one file path is required".into(),
        ));
    }

    let uris: Vec<String> = files
        .iter()
        .map(|file| path_to_uri(file))
        .collect::<Result<Vec<_>>>()?;

    run_on_main(move || {
        let clipboard = clipboard();
        let targets = [
            gtk::TargetEntry::new("text/uri-list", gtk::TargetFlags::empty(), 0),
            gtk::TargetEntry::new("text/plain;charset=utf-8", gtk::TargetFlags::empty(), 1),
        ];
        let uris_for_target = uris.clone();
        let accepted = clipboard.set_with_data(&targets, move |_clipboard, data, info| {
            if info == 0 {
                let refs: Vec<&str> = uris_for_target.iter().map(String::as_str).collect();
                data.set_uris(&refs);
            } else {
                data.set_text(&uris_for_target.join("\n"));
            }
        });

        if accepted {
            Ok(())
        } else {
            Err(AppError::Clipboard(
                "GTK refused ownership of the clipboard file list".into(),
            ))
        }
    })
}

/// Convert a local path into a `file://` URI.
pub fn path_to_uri(path: &str) -> Result<String> {
    if path.is_empty() || path.contains('\0') {
        return Err(AppError::InvalidInput(
            "File paths cannot be empty or contain null characters".into(),
        ));
    }

    let mut encoded = String::from("file://");
    for byte in path.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'/' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char)
            }
            other => encoded.push_str(&format!("%{other:02X}")),
        }
    }
    Ok(encoded)
}

/// Subscribe to GTK clipboard changes and wake the monitor thread.
///
/// Returns after the signal handler is connected. The signal stays connected
/// for the lifetime of the GTK clipboard, so no polling thread is required.
pub fn start_watcher(notify: mpsc::SyncSender<()>) -> std::result::Result<(), String> {
    if !is_ready() {
        return Err("The Linux GTK clipboard backend is not initialized".to_string());
    }

    let (tx, rx) = mpsc::channel::<std::result::Result<(), String>>();
    glib::MainContext::default().invoke(move || {
        let Some(display) = gdk::Display::default() else {
            let _ = tx.send(Err("GTK has no display for clipboard notifications".into()));
            return;
        };

        let clipboard = gtk::Clipboard::default(&display)
            .unwrap_or_else(|| gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD));

        clipboard.connect_local("owner-change", false, move |_values| {
            let _ = notify.try_send(());
            None
        });

        let _ = tx.send(Ok(()));
    });

    match rx.recv_timeout(MAIN_CONTEXT_TIMEOUT) {
        Ok(result) => result,
        Err(_) => Err("Timed out while connecting GTK clipboard notifications".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_rgb_pixbuf_rows_to_rgba() {
        // Two RGB pixels with one byte of row padding.
        let data = [255, 0, 0, 0, 255, 0, 0, 7];
        let rgba = pixel_bytes_to_rgba(&data, 2, 1, 8, 3).unwrap();
        assert_eq!(rgba, vec![255, 0, 0, 255, 0, 255, 0, 255]);
    }

    #[test]
    fn converts_rgba_pixbuf_rows_to_rgba() {
        let data = [10, 20, 30, 40, 1, 2, 3, 4];
        let rgba = pixel_bytes_to_rgba(&data, 2, 1, 8, 4).unwrap();
        assert_eq!(rgba, vec![10, 20, 30, 40, 1, 2, 3, 4]);
    }

    #[test]
    fn rejects_short_or_invalid_pixbuf_buffers() {
        assert!(pixel_bytes_to_rgba(&[0, 0, 0], 2, 1, 8, 3).is_none());
        assert!(pixel_bytes_to_rgba(&[0; 8], 0, 1, 8, 3).is_none());
        assert!(pixel_bytes_to_rgba(&[0; 8], 1, 1, 8, 2).is_none());
        assert!(pixel_bytes_to_rgba(&[0; 4], 1, 1, 2, 3).is_none());
    }

    #[test]
    fn parses_local_file_uris() {
        assert_eq!(
            uri_to_path("file:///home/user/My%20File.txt").as_deref(),
            Some("/home/user/My File.txt")
        );
        assert_eq!(
            uri_to_path("file://localhost/tmp/a%2Bb.txt").as_deref(),
            Some("/tmp/a+b.txt")
        );
        assert_eq!(uri_to_path("file://server/share/file.txt"), None);
        assert_eq!(uri_to_path("https://example.com/file"), None);
        assert_eq!(uri_to_path("file://relative/path"), None);
    }

    #[test]
    fn round_trips_paths_and_uris() {
        let uri = path_to_uri("/tmp/a b+c.txt").unwrap();
        assert_eq!(uri, "file:///tmp/a%20b%2Bc.txt");
        assert_eq!(uri_to_path(&uri).as_deref(), Some("/tmp/a b+c.txt"));
    }

    #[test]
    fn detects_kde_password_manager_hint_targets() {
        assert!(target_name_is_sensitive("x-kde-passwordManagerHint"));
        assert!(target_name_is_sensitive(
            "application/x-kde-passwordManagerHint"
        ));
        assert!(!target_name_is_sensitive("text/plain"));
    }
}
