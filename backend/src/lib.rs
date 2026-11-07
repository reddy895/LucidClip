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

use std::sync::Arc;
use tauri::Manager;

/// Core application state managed by Tauri runtime
#[derive(Clone, Default)]
pub struct AppState {
    pub is_initialized: Arc<std::sync::atomic::AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            is_initialized: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }
}

/// Main application runner invoked by main.rs
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            println!("[LucidClip] Setting up application context...");
            
            let state = AppState::new();
            state.is_initialized.store(true, std::sync::atomic::Ordering::SeqCst);
            app.manage(state);

            println!("[LucidClip] Backend context initialized successfully.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running LucidClip desktop application");
}
