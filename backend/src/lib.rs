//! LucidClip Desktop Backend Application
//! Entry point and Tauri 2 integration.

pub mod clipboard;
pub mod commands;
pub mod database;
pub mod errors;
pub mod platform;
pub mod screenshots;
pub mod settings;
pub mod storage;

use crate::clipboard::{MonitorStatus, PasteGuard};
use crate::database::{run_migrations, DbPool};
use crate::platform::{FocusManager, GlobalShortcutService};
use crate::storage::AppPaths;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
#[cfg(target_os = "windows")]
use tauri::Emitter;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "lucidclip-tray";

/// Core application state managed by Tauri runtime
#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<DbPool>,
    pub paths: AppPaths,
    pub monitor_stop: Arc<AtomicBool>,
    pub monitor_status: Arc<Mutex<MonitorStatus>>,
    pub paste_guard: Arc<PasteGuard>,
    pub focus_manager: Arc<FocusManager>,
    pub hotkeys: Arc<GlobalShortcutService>,
}

impl AppState {
    pub fn new(
        pool: Arc<DbPool>,
        paths: AppPaths,
        monitor_stop: Arc<AtomicBool>,
        monitor_status: Arc<Mutex<MonitorStatus>>,
        paste_guard: Arc<PasteGuard>,
        focus_manager: Arc<FocusManager>,
        hotkeys: Arc<GlobalShortcutService>,
    ) -> Self {
        Self {
            pool,
            paths,
            monitor_stop,
            monitor_status,
            paste_guard,
            focus_manager,
            hotkeys,
        }
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        eprintln!("[LucidClip] Main window is not available.");
        return;
    };

    if let Err(err) = window.show() {
        eprintln!("[LucidClip] Failed to show the main window: {err}");
        return;
    }
    if let Err(err) = window.unminimize() {
        eprintln!("[LucidClip] Failed to restore the main window: {err}");
    }
    if let Err(err) = window.set_focus() {
        eprintln!("[LucidClip] Failed to focus the main window: {err}");
    }
}

/// Install a tray icon so closing the window only hides it. Monitoring continues
/// in the background until the user explicitly chooses Quit.
fn setup_tray_icon(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show LucidClip", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit LucidClip", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("LucidClip - clipboard and screenshot history")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn hide_on_close(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let window_for_event = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if let Err(err) = window_for_event.hide() {
                eprintln!("[LucidClip] Failed to hide the main window: {err}");
            }
        }
    });
}

/// Main application runner invoked by main.rs
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            println!("[LucidClip] Setting up application context...");

            let paths = AppPaths::default_paths();
            paths
                .ensure_dirs_exist()
                .expect("Failed to initialize LucidClip application directories");

            let pool = Arc::new(
                DbPool::open(&paths.database_path).expect("Failed to open SQLite database"),
            );

            run_migrations(&pool).expect("Failed to execute database migrations");

            // Linux must initialize GTK clipboard access on the main thread
            // before the monitor thread starts. Windows has no such constraint.
            if let Err(err) = platform::initialize_clipboard_backend() {
                eprintln!("[LucidClip] Clipboard backend initialization failed: {err}");
            }
            let environment = platform::clipboard_environment();
            println!(
                "[LucidClip] Clipboard backend: {} (session {}, monitoring supported: {})",
                environment.backend,
                environment.session.as_str(),
                environment.monitoring_supported
            );
            for diagnostic in &environment.diagnostics {
                println!("[LucidClip] Clipboard diagnostic: {diagnostic}");
            }

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

            let service = clipboard::ClipboardService::with_paths(&pool, &paths);
            match service.enforce_retention() {
                Ok(removed) if removed > 0 => {
                    println!("[LucidClip] Purged {removed} clipboard entries by retention policy.");
                }
                Ok(_) => {}
                Err(err) => eprintln!("[LucidClip] Startup retention cleanup failed: {err}"),
            }
            match service.cleanup_orphaned_media() {
                Ok(removed) if removed > 0 => {
                    println!("[LucidClip] Removed {removed} orphaned clipboard media files.");
                }
                Ok(_) => {}
                Err(err) => eprintln!("[LucidClip] Orphan media cleanup failed: {err}"),
            }

            let monitor_stop = Arc::new(AtomicBool::new(false));
            let monitor_status = Arc::new(Mutex::new(clipboard::initial_status()));
            let paste_guard = Arc::new(PasteGuard::new());
            let focus_manager = Arc::new(FocusManager::new());
            let hotkeys = Arc::new(GlobalShortcutService::new());
            let monitor_paths = paths.clone();
            let state = AppState::new(
                pool.clone(),
                paths,
                monitor_stop.clone(),
                monitor_status.clone(),
                paste_guard.clone(),
                focus_manager.clone(),
                hotkeys.clone(),
            );
            app.manage(state.clone());

            clipboard::spawn_monitor(
                app.handle().clone(),
                pool,
                monitor_paths,
                monitor_stop,
                monitor_status,
                paste_guard,
            );

            #[cfg(target_os = "windows")]
            {
                if let Ok(key) = crate::platform::ShortcutKey::parse(crate::platform::DEFAULT_HISTORY_SHORTCUT) {
                    let app_handle = app.handle().clone();
                    let state_for_hotkey = state.clone();
                    let hotkeys_clone = hotkeys.clone();
                    let _ = crate::platform::spawn_windows_hotkey_listener(
                        key,
                        hotkeys_clone.listener_stop.clone(),
                        move || {
                            let target = crate::platform::capture_foreground_target().unwrap_or(None);
                            state_for_hotkey.focus_manager.set_target(target);
                            let _ = crate::platform::show_popup_window(&app_handle);
                            let _ = app_handle.emit(
                                "clipboard://global-shortcut-triggered",
                                serde_json::json!({
                                    "shortcut": crate::platform::DEFAULT_HISTORY_SHORTCUT,
                                }),
                            );
                        },
                    );
                    hotkeys.state.set_active(crate::platform::DEFAULT_HISTORY_SHORTCUT, true, None);
                }
            }

            match setup_tray_icon(app.handle()) {
                Ok(()) => hide_on_close(app.handle()),
                Err(err) => {
                    eprintln!(
                        "[LucidClip] System tray unavailable; closing the window will exit: {err}"
                    );
                }
            }

            println!("[LucidClip] Backend context initialized successfully.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clipboard_entries,
            commands::add_clipboard_entry,
            commands::copy_clipboard_entry,
            commands::copy_clipboard_entry_by_id,
            commands::delete_clipboard_entry,
            commands::toggle_clipboard_pin,
            commands::toggle_clipboard_favorite,
            commands::clear_clipboard_history,
            commands::get_screenshots,
            commands::get_screenshot_image,
            commands::get_clipboard_image,
            commands::capture_screenshot,
            commands::crop_screenshot,
            commands::copy_screenshot_image,
            commands::export_screenshot,
            commands::delete_screenshot,
            commands::toggle_screenshot_pin,
            commands::toggle_screenshot_favorite,
            commands::get_settings,
            commands::update_setting,
            commands::get_storage_stats,
            commands::get_clipboard_diagnostics,
            commands::get_monitor_status,
            commands::set_monitoring_enabled,
            commands::capture_clipboard_now,
            commands::capture_active_target_window,
            commands::show_clipboard_popup,
            commands::hide_clipboard_popup,
            commands::hide_popup_and_restore_focus,
            commands::get_paste_capabilities,
            commands::execute_instant_paste,
            commands::get_global_shortcut_status,
            commands::update_global_shortcut
        ])
        .build(tauri::generate_context!())
        .expect("error while building LucidClip desktop application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<AppState>() {
                state
                    .monitor_stop
                    .store(true, std::sync::atomic::Ordering::Relaxed);
                state.hotkeys.stop();
            }
            platform::shutdown_clipboard_backend();
        }
    });
}
