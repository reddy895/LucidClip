//! LucidClip Desktop Backend Application
//! Entry point and Tauri 2 integration.

pub mod errors;
pub mod settings;
pub mod storage;
pub mod database;
pub mod clipboard;
pub mod screenshots;
pub mod search;
pub mod platform;
pub mod security;
pub mod commands;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;
use crate::database::{run_migrations, DbPool};
use crate::storage::AppPaths;

/// Core application state managed by Tauri runtime
#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<DbPool>,
    pub paths: AppPaths,
    pub monitor_stop: Arc<AtomicBool>,
}

impl AppState {
    pub fn new(pool: Arc<DbPool>, paths: AppPaths, monitor_stop: Arc<AtomicBool>) -> Self {
        Self {
            pool,
            paths,
            monitor_stop,
        }
    }
}

/// Main application runner invoked by main.rs
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            println!("[LucidClip] Setting up application context...");

            let paths = AppPaths::default_paths();
            paths.ensure_dirs_exist()
                .expect("Failed to initialize LucidClip application directories");

            let pool = Arc::new(
                DbPool::open(&paths.database_path)
                    .expect("Failed to open SQLite database")
            );

            run_migrations(&pool)
                .expect("Failed to execute database migrations");

            if let Ok(Some(raw)) = database::SettingsRepo::new(&pool).get("app_settings") {
                if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if let Some(enabled) = settings
                        .pointer("/general/launchOnStartup")
                        .and_then(serde_json::Value::as_bool)
                    {
                        if let Err(err) = platform::set_launch_on_startup(enabled) {
                            eprintln!("[LucidClip] Failed to sync launch at startup: {err}");
                        }
                    }
                }
            }

            let service = clipboard::ClipboardService::new(&pool);
            match service.enforce_retention() {
                Ok(removed) if removed > 0 => {
                    println!("[LucidClip] Purged {removed} clipboard entries by retention policy.");
                }
                Ok(_) => {}
                Err(err) => eprintln!("[LucidClip] Startup retention cleanup failed: {err}"),
            }

            let monitor_stop = Arc::new(AtomicBool::new(false));
            let state = AppState::new(pool.clone(), paths, monitor_stop.clone());
            app.manage(state);

            clipboard::spawn_monitor(app.handle().clone(), pool, monitor_stop);

            println!("[LucidClip] Backend context initialized successfully.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clipboard_entries,
            commands::add_clipboard_entry,
            commands::copy_clipboard_entry,
            commands::delete_clipboard_entry,
            commands::toggle_clipboard_pin,
            commands::toggle_clipboard_favorite,
            commands::clear_clipboard_history,
            commands::get_screenshots,
            commands::capture_screenshot,
            commands::crop_screenshot,
            commands::copy_screenshot_image,
            commands::export_screenshot,
            commands::delete_screenshot,
            commands::toggle_screenshot_pin,
            commands::toggle_screenshot_favorite,
            commands::get_settings,
            commands::update_setting,
            commands::get_storage_stats
        ])
        .build(tauri::generate_context!())
        .expect("error while building LucidClip desktop application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<AppState>() {
                state.monitor_stop.store(true, std::sync::atomic::Ordering::Relaxed);
            }
        }
    });
}
