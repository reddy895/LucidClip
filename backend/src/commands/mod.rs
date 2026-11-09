//! Tauri IPC Command Handlers

use crate::clipboard::ClipboardService;
use crate::database::{DbClipboardEntry, DbScreenshotEntry, SettingsRepo};
use crate::errors::{AppError, Result};
use crate::screenshots::{CaptureMode, CaptureRegion, ScreenshotService};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStatsDto {
    pub db_size_bytes: u64,
    pub screenshot_storage_bytes: u64,
    pub total_storage_bytes: u64,
    pub entry_count: usize,
    pub screenshot_count: usize,
}

// ==========================================
// Clipboard Commands
// ==========================================

#[tauri::command]
pub fn get_clipboard_entries(state: tauri::State<'_, AppState>) -> Result<Vec<DbClipboardEntry>> {
    let service = ClipboardService::with_paths(&state.pool, &state.paths);
    service.get_history()
}

#[tauri::command]
pub fn add_clipboard_entry(
    content: String,
    source_app: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<DbClipboardEntry> {
    let service = ClipboardService::with_paths(&state.pool, &state.paths);
    service.process_copied_text(&content, source_app)
}

#[tauri::command]
pub fn copy_clipboard_entry(content: String) -> Result<bool> {
    crate::platform::set_clipboard_text(&content)?;
    Ok(true)
}

#[tauri::command]
pub fn delete_clipboard_entry(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ClipboardService::with_paths(&state.pool, &state.paths);
    service.delete_entry(&id)
}

#[tauri::command]
pub fn toggle_clipboard_pin(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ClipboardService::with_paths(&state.pool, &state.paths);
    service.toggle_pin(&id)
}

#[tauri::command]
pub fn toggle_clipboard_favorite(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ClipboardService::with_paths(&state.pool, &state.paths);
    service.toggle_favorite(&id)
}

#[tauri::command]
pub fn clear_clipboard_history(state: tauri::State<'_, AppState>) -> Result<usize> {
    let service = ClipboardService::with_paths(&state.pool, &state.paths);
    service.clear_unpinned()
}

// ==========================================
// Screenshot Commands
// ==========================================

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct CaptureRegionDto {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn get_screenshots(state: tauri::State<'_, AppState>) -> Result<Vec<DbScreenshotEntry>> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    service.list()
}

#[tauri::command]
pub fn capture_screenshot(
    capture_type: String,
    region: Option<CaptureRegionDto>,
    state: tauri::State<'_, AppState>,
) -> Result<DbScreenshotEntry> {
    let mode = match capture_type.as_str() {
        "fullscreen" => CaptureMode::Fullscreen,
        "region" => {
            let region = region.ok_or_else(|| {
                AppError::InvalidInput("A capture region is required for region screenshots".into())
            })?;
            CaptureMode::Region(CaptureRegion {
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
            })
        }
        other => {
            return Err(AppError::InvalidInput(format!(
                "Unsupported capture type: {other}"
            )))
        }
    };

    let service = ScreenshotService::new(&state.pool, &state.paths);
    service.capture(mode)
}

#[tauri::command]
pub fn crop_screenshot(
    source_id: String,
    region: CaptureRegionDto,
    remove_source: bool,
    state: tauri::State<'_, AppState>,
) -> Result<DbScreenshotEntry> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    service.crop(
        &source_id,
        CaptureRegion {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
        },
        remove_source,
    )
}

#[tauri::command]
pub fn copy_screenshot_image(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    let entry = service
        .get(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Screenshot {id} not found")))?;

    let image = image::open(&entry.original_path)?.to_rgba8();
    crate::platform::set_clipboard_image(image.as_raw(), image.width(), image.height())?;

    Ok(true)
}

#[tauri::command]
pub fn export_screenshot(id: String, state: tauri::State<'_, AppState>) -> Result<String> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    let entry = service
        .get(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Screenshot {id} not found")))?;

    let export_root = directories::UserDirs::new()
        .and_then(|dirs| dirs.download_dir().map(|path| path.to_path_buf()))
        .unwrap_or_else(|| state.paths.root_dir.join("exports"));
    let target_dir = export_root.join("LucidClip");

    fs::create_dir_all(&target_dir)?;

    let target = target_dir.join(format!("LucidClip_{}.png", entry.id));
    fs::copy(&entry.original_path, &target)?;

    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn delete_screenshot(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    service.delete(&id)
}

#[tauri::command]
pub fn toggle_screenshot_pin(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    service.toggle_pin(&id)
}

#[tauri::command]
pub fn toggle_screenshot_favorite(id: String, state: tauri::State<'_, AppState>) -> Result<bool> {
    let service = ScreenshotService::new(&state.pool, &state.paths);
    service.toggle_favorite(&id)
}

// ==========================================
// Settings & Storage Commands
// ==========================================

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, AppState>) -> Result<HashMap<String, String>> {
    let repo = SettingsRepo::new(&state.pool);
    repo.get_all()
}

#[tauri::command]
pub fn update_setting(key: String, value: String, state: tauri::State<'_, AppState>) -> Result<()> {
    if key == "app_settings" {
        if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&value) {
            if let Some(enabled) = settings
                .pointer("/general/launchOnStartup")
                .and_then(serde_json::Value::as_bool)
            {
                crate::platform::set_launch_on_startup(enabled)?;
            }
        }
    }

    let repo = SettingsRepo::new(&state.pool);
    repo.set(&key, &value)
}

#[tauri::command]
pub fn get_storage_stats(state: tauri::State<'_, AppState>) -> Result<StorageStatsDto> {
    let db_size_bytes = match fs::metadata(&state.paths.database_path) {
        Ok(metadata) => metadata.len(),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => 0,
        Err(err) => return Err(err.into()),
    };

    let screenshot_storage_bytes =
        directory_size(&state.paths.originals_dir)? + directory_size(&state.paths.thumbnails_dir)?;

    let entry_count = crate::database::ClipboardRepo::new(&state.pool).count()?;
    let screenshot_count = crate::database::ScreenshotRepo::new(&state.pool).count()?;

    Ok(StorageStatsDto {
        db_size_bytes,
        screenshot_storage_bytes,
        total_storage_bytes: db_size_bytes + screenshot_storage_bytes,
        entry_count,
        screenshot_count,
    })
}

fn directory_size(path: &std::path::Path) -> Result<u64> {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(err) => return Err(err.into()),
    };

    let mut total = 0u64;
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
            Err(err) => return Err(err.into()),
        };

        match entry.metadata() {
            Ok(metadata) => total += metadata.len(),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
            Err(err) => return Err(err.into()),
        }
    }

    Ok(total)
}
