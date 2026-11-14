//! Window management utilities for the floating clipboard history popup.
//!
//! Provides routines to position, display, center, and hide the dedicated
//! frameless popup window across desktop monitors.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use crate::errors::{AppError, Result};

pub const POPUP_WINDOW_LABEL: &str = "clipboard-popup";
pub const POPUP_WIDTH: f64 = 480.0;
pub const POPUP_HEIGHT: f64 = 560.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PopupPositionMode {
    #[default]
    Center,
    Cursor,
}

/// Display and focus the dedicated floating popup window with positioning mode.
pub fn show_popup_window_with_mode(app: &AppHandle, mode: PopupPositionMode) -> Result<()> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        let _ = window.unminimize();
        match mode {
            PopupPositionMode::Center => {
                let _ = window.center();
            }
            PopupPositionMode::Cursor => {
                // If cursor positioning is requested, attempt to center near cursor
                if let Ok(pos) = window.cursor_position() {
                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: (pos.x as f64 - POPUP_WIDTH / 2.0).max(0.0) as i32,
                        y: (pos.y as f64 - POPUP_HEIGHT / 2.0).max(0.0) as i32,
                    }));
                } else {
                    let _ = window.center();
                }
            }
        }
        let _ = window.set_always_on_top(true);
        window
            .show()
            .map_err(|e| AppError::System(format!("Failed to show popup window: {e}")))?;
        window
            .set_focus()
            .map_err(|e| AppError::System(format!("Failed to focus popup window: {e}")))?;
        return Ok(());
    }

    show_popup_window(app)
}

/// Display and focus the dedicated floating popup window.
/// If the window does not yet exist, dynamically instantiate it with frameless styling.
pub fn show_popup_window(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        let _ = window.unminimize();
        let _ = window.center();
        let _ = window.set_always_on_top(true);
        window
            .show()
            .map_err(|e| AppError::System(format!("Failed to show popup window: {e}")))?;
        window
            .set_focus()
            .map_err(|e| AppError::System(format!("Failed to focus popup window: {e}")))?;
        return Ok(());
    }

    // Window does not exist yet: build it dynamically
    let builder = WebviewWindowBuilder::new(
        app,
        POPUP_WINDOW_LABEL,
        WebviewUrl::App("index.html#popup".into()),
    )
    .title("LucidClip History")
    .inner_size(POPUP_WIDTH, POPUP_HEIGHT)
    .min_inner_size(360.0, 420.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .center();

    let window = builder
        .build()
        .map_err(|e| AppError::System(format!("Failed to create popup window: {e}")))?;

    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

/// Hide the floating clipboard popup window without destroying its state.
pub fn hide_popup_window(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        let _ = window.hide();
    }
    Ok(())
}

/// Check if the floating popup window is currently visible.
pub fn is_popup_visible(app: &AppHandle) -> bool {
    app.get_webview_window(POPUP_WINDOW_LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

/// Toggle the popup window (show if hidden, hide if visible).
pub fn toggle_popup_window(app: &AppHandle) -> Result<bool> {
    if is_popup_visible(app) {
        hide_popup_window(app)?;
        Ok(false)
    } else {
        show_popup_window(app)?;
        Ok(true)
    }
}
