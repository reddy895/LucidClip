//! Background clipboard monitoring.
//!
//! The monitor samples the operating-system clipboard, deduplicates content by
//! its normalized SHA-256 hash, persists new text, and notifies the frontend.
//! Clipboard contents are never logged.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use crate::clipboard::hasher::hash_content;
use crate::clipboard::service::ClipboardService;
use crate::database::{DbPool, SettingsRepo};
use crate::platform::{self, ClipboardSnapshot};
use crate::storage::AppPaths;

/// Event emitted whenever the monitor persists a new clipboard entry.
pub const CLIPBOARD_CAPTURED_EVENT: &str = "clipboard://new-entry";

/// Fallback sampling interval when native change notifications are unavailable.
const POLL_INTERVAL: Duration = Duration::from_millis(500);

/// Native notifications can arrive before the source application has finished
/// writing all formats. Wait briefly, then coalesce the burst.
const DEBOUNCE_INTERVAL: Duration = Duration::from_millis(120);

/// Even with native notifications, run a slow safety pass to recover from
/// dropped or missed messages without polling aggressively.
const SAFETY_POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Guard against pathological clipboard payloads freezing the UI or database.
const MAX_CAPTURE_CHARS: usize = 1_000_000;

#[derive(Debug)]
struct MonitorPolicy {
    enabled: bool,
    excluded_apps: Vec<String>,
    exclude_sensitive: bool,
}

impl Default for MonitorPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            excluded_apps: vec![
                "1Password.exe".into(),
                "KeePass.exe".into(),
                "KeePassXC.exe".into(),
                "Bitwarden.exe".into(),
            ],
            exclude_sensitive: true,
        }
    }
}

/// Read the persisted application settings.
///
/// The frontend stores the full settings payload under `app_settings`. Missing
/// or malformed settings default to enabled so a fresh install captures text.
fn monitor_policy(pool: &DbPool) -> MonitorPolicy {
    let repo = SettingsRepo::new(pool);
    let Ok(Some(raw)) = repo.get("app_settings") else {
        return MonitorPolicy::default();
    };

    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return MonitorPolicy::default();
    };

    let clipboard_enabled = value
        .pointer("/clipboard/monitoringEnabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);

    let paused = value
        .pointer("/privacy/pauseMonitoring")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);

    let excluded_apps = value
        .pointer("/clipboard/excludedApps")
        .and_then(serde_json::Value::as_array)
        .map(|apps| {
            apps.iter()
                .filter_map(serde_json::Value::as_str)
                .map(|app| app.trim().to_string())
                .filter(|app| !app.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let exclude_sensitive = value
        .pointer("/privacy/excludePasswordManagers")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);

    MonitorPolicy {
        enabled: clipboard_enabled && !paused,
        excluded_apps,
        exclude_sensitive,
    }
}

#[cfg(test)]
fn monitoring_enabled(pool: &DbPool) -> bool {
    monitor_policy(pool).enabled
}

fn is_excluded_process(policy: &MonitorPolicy, process: Option<&str>) -> bool {
    let Some(process) = process else {
        return false;
    };

    policy
        .excluded_apps
        .iter()
        .any(|excluded| excluded.eq_ignore_ascii_case(process))
}

/// Start the clipboard monitor thread.
///
/// The thread exits when `stop` is set to `true` during application shutdown.
struct CaptureState {
    last_hash: Option<String>,
}

fn capture_clipboard_once(
    app: &AppHandle,
    pool: &DbPool,
    paths: &AppPaths,
    policy: &MonitorPolicy,
    state: &mut CaptureState,
) {
    let foreground = match platform::foreground_process_name() {
        Ok(name) => name,
        Err(err) => {
            eprintln!("[LucidClip Monitor] Could not resolve source app: {err}");
            None
        }
    };

    if is_excluded_process(policy, foreground.as_deref()) {
        return;
    }

    if policy.exclude_sensitive {
        match platform::clipboard_content_is_sensitive() {
            Ok(true) => return,
            Ok(false) => {}
            Err(err) => {
                eprintln!(
                    "[LucidClip Monitor] Sensitive-content check failed; skipping tick: {err}"
                );
                return;
            }
        }
    }

    match platform::read_clipboard_snapshot() {
        Ok(Some(ClipboardSnapshot::Text(text))) if !text.trim().is_empty() => {
            if text.chars().count() > MAX_CAPTURE_CHARS {
                eprintln!(
                    "[LucidClip Monitor] Skipped clipboard content larger than {MAX_CAPTURE_CHARS} characters."
                );
                return;
            }

            let hash = hash_content(&text);
            if state.last_hash.as_deref() == Some(hash.as_str()) {
                return;
            }

            let service = ClipboardService::with_paths(pool, paths);
            match service.process_copied_text(&text, foreground) {
                Ok(entry) => record_capture(app, state, entry),
                Err(err) => {
                    eprintln!("[LucidClip Monitor] Failed to persist clipboard text: {err}");
                }
            }
        }
        Ok(Some(ClipboardSnapshot::Image(image))) => {
            let service = ClipboardService::with_paths(pool, paths);
            match service.process_copied_image(image, foreground) {
                Ok(entry) => record_capture(app, state, entry),
                Err(err) => {
                    eprintln!("[LucidClip Monitor] Failed to persist clipboard image: {err}");
                }
            }
        }
        Ok(Some(ClipboardSnapshot::Files(files))) => {
            if files.iter().map(String::len).sum::<usize>() > MAX_CAPTURE_CHARS {
                eprintln!(
                    "[LucidClip Monitor] Skipped file list larger than {MAX_CAPTURE_CHARS} characters."
                );
                return;
            }

            let service = ClipboardService::with_paths(pool, paths);
            match service.process_copied_files(files, foreground) {
                Ok(entry) => record_capture(app, state, entry),
                Err(err) => {
                    eprintln!("[LucidClip Monitor] Failed to persist clipboard files: {err}");
                }
            }
        }
        Ok(_) => {
            // The clipboard no longer holds a supported value. Clear the
            // fingerprint so the same content is captured again later.
            state.last_hash = None;
        }
        Err(err) => {
            // Clipboard contention is expected; retry on the next tick.
            eprintln!("[LucidClip Monitor] Clipboard read skipped: {err}");
        }
    }
}

fn record_capture(
    app: &AppHandle,
    state: &mut CaptureState,
    entry: crate::database::DbClipboardEntry,
) {
    state.last_hash = Some(entry.content_hash.clone());
    if let Err(err) = app.emit(CLIPBOARD_CAPTURED_EVENT, &entry) {
        eprintln!("[LucidClip Monitor] Failed to notify frontend: {err}");
    }
}

fn run_monitor(app: AppHandle, pool: Arc<DbPool>, paths: AppPaths, stop: Arc<AtomicBool>) {
    println!("[LucidClip Monitor] Clipboard monitor started.");
    let mut state = CaptureState { last_hash: None };

    #[cfg(target_os = "windows")]
    let native_notifications = {
        let (notify_tx, notify_rx) = mpsc::sync_channel::<()>(1);
        match platform::spawn_clipboard_watcher(notify_tx, stop.clone()) {
            Ok(()) => Some(notify_rx),
            Err(err) => {
                eprintln!(
                    "[LucidClip Monitor] Native notifications unavailable ({err}); using polling fallback."
                );
                None
            }
        }
    };

    #[cfg(not(target_os = "windows"))]
    let native_notifications: Option<mpsc::Receiver<()>> = None;

    // Capture the current clipboard once at startup.
    let policy = monitor_policy(&pool);
    if policy.enabled {
        capture_clipboard_once(&app, &pool, &paths, &policy, &mut state);
    }

    while !stop.load(Ordering::Relaxed) {
        let wait_result = match &native_notifications {
            Some(receiver) => receiver.recv_timeout(SAFETY_POLL_INTERVAL),
            None => {
                thread::sleep(POLL_INTERVAL);
                Err(RecvTimeoutError::Timeout)
            }
        };

        if stop.load(Ordering::Relaxed) {
            break;
        }

        if matches!(wait_result, Ok(())) {
            // Let the source application finish publishing every format, then
            // drain any queued notifications into this single capture.
            thread::sleep(DEBOUNCE_INTERVAL);
            while native_notifications
                .as_ref()
                .is_some_and(|receiver| receiver.try_recv().is_ok())
            {}
        }

        let policy = monitor_policy(&pool);
        if policy.enabled {
            capture_clipboard_once(&app, &pool, &paths, &policy, &mut state);
        }
    }

    println!("[LucidClip Monitor] Clipboard monitor stopped.");
}

pub fn spawn(app: AppHandle, pool: Arc<DbPool>, paths: AppPaths, stop: Arc<AtomicBool>) {
    if !platform::clipboard_monitoring_supported() {
        println!("[LucidClip Monitor] Native clipboard monitoring is unavailable on this host.");
        return;
    }

    let spawned = thread::Builder::new()
        .name("lucidclip-clipboard-monitor".into())
        .spawn(move || run_monitor(app, pool, paths, stop));

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

#[cfg(test)]
mod exclusion_tests {
    use super::*;
    use crate::database::run_migrations;

    #[test]
    fn excluded_process_matching_is_case_insensitive() {
        let policy = MonitorPolicy {
            enabled: true,
            excluded_apps: vec!["KeePass.exe".into(), "Bitwarden.exe".into()],
            exclude_sensitive: true,
        };

        assert!(is_excluded_process(&policy, Some("keepass.exe")));
        assert!(is_excluded_process(&policy, Some("BITWARDEN.EXE")));
        assert!(!is_excluded_process(&policy, Some("Code.exe")));
        assert!(!is_excluded_process(&policy, None));
    }

    #[test]
    fn policy_reads_exclusions_and_sensitive_flag() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();
        SettingsRepo::new(&pool)
            .set(
                "app_settings",
                r#"{"clipboard":{"monitoringEnabled":true,"excludedApps":["KeePass.exe"]},"privacy":{"pauseMonitoring":false,"excludePasswordManagers":true}}"#,
            )
            .unwrap();

        let policy = monitor_policy(&pool);
        assert!(policy.enabled);
        assert!(policy.exclude_sensitive);
        assert_eq!(policy.excluded_apps, vec!["KeePass.exe".to_string()]);
    }
}
