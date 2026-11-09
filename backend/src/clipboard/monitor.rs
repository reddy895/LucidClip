//! Background clipboard monitoring.
//!
//! The monitor samples the operating-system clipboard, deduplicates content by
//! its normalized SHA-256 hash, persists new text, and notifies the frontend.
//! Clipboard contents are never logged.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use crate::clipboard::hasher::hash_content;
use crate::clipboard::service::ClipboardService;
use crate::database::{DbPool, SettingsRepo};
use crate::platform;

/// Event emitted whenever the monitor persists a new clipboard entry.
pub const CLIPBOARD_CAPTURED_EVENT: &str = "clipboard://new-entry";

/// Sampling interval for clipboard changes.
const POLL_INTERVAL: Duration = Duration::from_millis(500);

/// Guard against pathological clipboard payloads freezing the UI or database.
const MAX_CAPTURE_CHARS: usize = 1_000_000;

/// Read the persisted application settings and decide whether monitoring runs.
///
/// The frontend stores the full settings payload under `app_settings`. Missing
/// or malformed settings default to enabled so a fresh install captures text.
fn monitoring_enabled(pool: &DbPool) -> bool {
    let repo = SettingsRepo::new(pool);
    let Ok(Some(raw)) = repo.get("app_settings") else {
        return true;
    };

    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return true;
    };

    let clipboard_enabled = value
        .get("clipboard")
        .and_then(|clipboard| clipboard.get("monitoringEnabled"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);

    let paused = value
        .get("privacy")
        .and_then(|privacy| privacy.get("pauseMonitoring"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);

    clipboard_enabled && !paused
}

/// Start the clipboard monitor thread.
///
/// The thread exits when `stop` is set to `true` during application shutdown.
pub fn spawn(app: AppHandle, pool: Arc<DbPool>, stop: Arc<AtomicBool>) {
    if !platform::clipboard_monitoring_supported() {
        println!("[LucidClip Monitor] Native clipboard monitoring is unavailable on this host.");
        return;
    }

    let spawned = thread::Builder::new()
        .name("lucidclip-clipboard-monitor".into())
        .spawn(move || {
            println!("[LucidClip Monitor] Clipboard monitor started.");
            let mut last_hash: Option<String> = None;

            while !stop.load(Ordering::Relaxed) {
                if monitoring_enabled(&pool) {
                    match platform::read_clipboard_text() {
                        Ok(Some(text)) if !text.trim().is_empty() => {
                            if text.chars().count() > MAX_CAPTURE_CHARS {
                                eprintln!(
                                    "[LucidClip Monitor] Skipped clipboard content larger than {MAX_CAPTURE_CHARS} characters."
                                );
                            } else {
                                let hash = hash_content(&text);
                                if last_hash.as_deref() != Some(hash.as_str()) {
                                    let service = ClipboardService::new(&pool);
                                    match service.process_copied_text(&text, None) {
                                        Ok(entry) => {
                                            last_hash = Some(hash);
                                            if let Err(err) =
                                                app.emit(CLIPBOARD_CAPTURED_EVENT, &entry)
                                            {
                                                eprintln!(
                                                    "[LucidClip Monitor] Failed to notify frontend: {err}"
                                                );
                                            }
                                        }
                                        Err(err) => {
                                            eprintln!(
                                                "[LucidClip Monitor] Failed to persist clipboard entry: {err}"
                                            );
                                        }
                                    }
                                }
                            }
                        }
                        Ok(_) => {}
                        Err(err) => {
                            // Clipboard contention is expected; retry on the next tick.
                            eprintln!("[LucidClip Monitor] Clipboard read skipped: {err}");
                        }
                    }
                }

                thread::sleep(POLL_INTERVAL);
            }

            println!("[LucidClip Monitor] Clipboard monitor stopped.");
        });

    if let Err(err) = spawned {
        eprintln!("[LucidClip Monitor] Failed to start monitor thread: {err}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{run_migrations, DbPool};

    #[test]
    fn monitoring_defaults_to_enabled_without_settings() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        assert!(monitoring_enabled(&pool));
    }

    #[test]
    fn monitoring_respects_pause_and_disable_flags() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        let repo = SettingsRepo::new(&pool);

        repo.set(
            "app_settings",
            r#"{"clipboard":{"monitoringEnabled":true},"privacy":{"pauseMonitoring":true}}"#,
        )
        .unwrap();
        assert!(!monitoring_enabled(&pool));

        repo.set(
            "app_settings",
            r#"{"clipboard":{"monitoringEnabled":false},"privacy":{"pauseMonitoring":false}}"#,
        )
        .unwrap();
        assert!(!monitoring_enabled(&pool));

        repo.set(
            "app_settings",
            r#"{"clipboard":{"monitoringEnabled":true},"privacy":{"pauseMonitoring":false}}"#,
        )
        .unwrap();
        assert!(monitoring_enabled(&pool));
    }

    #[test]
    fn malformed_settings_do_not_disable_monitoring() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        SettingsRepo::new(&pool)
            .set("app_settings", "not-json")
            .unwrap();
        assert!(monitoring_enabled(&pool));
    }
}
