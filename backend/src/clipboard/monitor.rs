//! Background clipboard monitoring.
//!
//! The monitor samples the operating-system clipboard, deduplicates content by
//! its normalized SHA-256 hash, persists new text, and notifies the frontend.
//! Clipboard contents are never logged.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::clipboard::events::{
    ClipboardCapturedEvent, CLIPBOARD_CAPTURED_EVENT, CLIPBOARD_STATUS_EVENT,
};
use crate::clipboard::guard::PasteGuard;
use crate::clipboard::hasher::hash_content;
use crate::clipboard::service::ClipboardService;
use crate::database::{DbClipboardEntry, DbPool, SettingsRepo};
use crate::errors::{AppError, Result};
use crate::platform::{self, ClipboardSnapshot};
use crate::storage::AppPaths;

/// Fallback sampling interval when native change notifications are unavailable.
/// Deliberately conservative so an unsupported host never spins the CPU.
const POLL_INTERVAL: Duration = Duration::from_millis(750);

/// Native notifications can arrive before the source application has finished
/// writing all formats. Wait briefly, then coalesce the burst.
const DEBOUNCE_INTERVAL: Duration = Duration::from_millis(120);

/// Even with native notifications, run a slow safety pass to recover from
/// dropped or missed messages without polling aggressively.
const SAFETY_POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Guard against pathological clipboard payloads freezing the UI or database.
const MAX_CAPTURE_CHARS: usize = 1_000_000;

/// Observable monitor state shared with the Tauri command layer.
///
/// Errors never include clipboard content; they describe the failing operation
/// only. The UI uses this to avoid claiming monitoring is active after failure.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MonitorStatus {
    pub supported: bool,
    pub running: bool,
    pub paused: bool,
    pub backend: String,
    pub session: String,
    pub captures: u64,
    pub last_capture_at: Option<i64>,
    pub last_error: Option<String>,
    pub started_at: Option<i64>,
    /// Last persisted fingerprint, shared with manual captures so the safety
    /// poll does not immediately re-capture the same clipboard value.
    #[serde(skip)]
    last_hash: Option<String>,
}

pub fn initial_status() -> MonitorStatus {
    let environment = platform::clipboard_environment();
    MonitorStatus {
        supported: environment.monitoring_supported,
        running: false,
        paused: false,
        backend: environment.backend,
        session: environment.session.as_str().to_string(),
        captures: 0,
        last_capture_at: None,
        last_error: None,
        started_at: None,
        last_hash: None,
    }
}

pub fn status_snapshot(status: &Arc<Mutex<MonitorStatus>>) -> MonitorStatus {
    status
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| initial_status())
}

fn update_status(status: &Arc<Mutex<MonitorStatus>>, update: impl FnOnce(&mut MonitorStatus)) {
    if let Ok(mut guard) = status.lock() {
        update(&mut guard);
    }
}

pub(crate) fn emit_status(app: &AppHandle, status: &Arc<Mutex<MonitorStatus>>) {
    if let Err(err) = app.emit(CLIPBOARD_STATUS_EVENT, status_snapshot(status)) {
        eprintln!("[LucidClip Monitor] Failed to notify frontend about monitor status: {err}");
    }
}

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

fn last_hash(status: &Arc<Mutex<MonitorStatus>>) -> Option<String> {
    status.lock().ok().and_then(|guard| guard.last_hash.clone())
}

fn set_last_hash(status: &Arc<Mutex<MonitorStatus>>, hash: Option<String>) {
    update_status(status, |state| state.last_hash = hash);
}

fn fail(app: &AppHandle, status: &Arc<Mutex<MonitorStatus>>, message: String) {
    eprintln!("[LucidClip Monitor] {message}");
    let changed = status
        .lock()
        .map(|mut state| {
            if state.last_error.as_deref() == Some(message.as_str()) {
                false
            } else {
                state.last_error = Some(message);
                true
            }
        })
        .unwrap_or(false);
    if changed {
        emit_status(app, status);
    }
}

/// Read the clipboard once and persist a supported value.
///
/// Returns the persisted (or refreshed) entry when a capture happened. All
/// errors are recorded in the shared status without logging clipboard content.
fn capture_clipboard_once(
    app: &AppHandle,
    pool: &DbPool,
    paths: &AppPaths,
    policy: &MonitorPolicy,
    status: &Arc<Mutex<MonitorStatus>>,
    paste_guard: &PasteGuard,
    force: bool,
) -> Option<DbClipboardEntry> {
    let foreground = match platform::foreground_process_name() {
        Ok(name) => name,
        Err(err) => {
            eprintln!("[LucidClip Monitor] Could not resolve source app: {err}");
            None
        }
    };

    if is_excluded_process(policy, foreground.as_deref()) {
        return None;
    }

    if policy.exclude_sensitive {
        match platform::clipboard_content_is_sensitive() {
            Ok(true) => return None,
            Ok(false) => {}
            Err(err) => {
                fail(
                    app,
                    status,
                    format!("Sensitive-content check failed; skipping tick: {err}"),
                );
                return None;
            }
        }
    }

    match platform::read_clipboard_snapshot() {
        Ok(Some(ClipboardSnapshot::Text(text))) if !text.trim().is_empty() => {
            if text.chars().count() > MAX_CAPTURE_CHARS {
                eprintln!(
                    "[LucidClip Monitor] Skipped clipboard content larger than {MAX_CAPTURE_CHARS} characters."
                );
                return None;
            }

            let hash = hash_content(&text);
            if paste_guard.is_internal(&hash) {
                return None;
            }
            if !force && last_hash(status).as_deref() == Some(hash.as_str()) {
                return None;
            }

            let service = ClipboardService::with_paths(pool, paths);
            match service.process_copied_text(&text, foreground) {
                Ok(entry) => {
                    record_capture(app, status, &entry);
                    return Some(entry);
                }
                Err(err) => fail(
                    app,
                    status,
                    format!("Failed to persist clipboard text: {err}"),
                ),
            }
        }
        Ok(Some(ClipboardSnapshot::Image(image))) => {
            let img_hash = crate::clipboard::media::hash_image(&image);
            if paste_guard.is_internal(&img_hash) {
                return None;
            }

            let service = ClipboardService::with_paths(pool, paths);
            match service.process_copied_image(image, foreground) {
                Ok(entry) => {
                    record_capture(app, status, &entry);
                    return Some(entry);
                }
                Err(err) => fail(
                    app,
                    status,
                    format!("Failed to persist clipboard image: {err}"),
                ),
            }
        }
        Ok(Some(ClipboardSnapshot::Files(files))) => {
            let files_hash = hash_content(&files.join("\n"));
            if paste_guard.is_internal(&files_hash) {
                return None;
            }

            if files.iter().map(String::len).sum::<usize>() > MAX_CAPTURE_CHARS {
                eprintln!(
                    "[LucidClip Monitor] Skipped file list larger than {MAX_CAPTURE_CHARS} characters."
                );
                return None;
            }

            let service = ClipboardService::with_paths(pool, paths);
            match service.process_copied_files(files, foreground) {
                Ok(entry) => {
                    record_capture(app, status, &entry);
                    return Some(entry);
                }
                Err(err) => fail(
                    app,
                    status,
                    format!("Failed to persist clipboard files: {err}"),
                ),
            }
        }
        Ok(_) => {
            // The clipboard no longer holds a supported value. Clear the
            // fingerprint so the same content is captured again later.
            set_last_hash(status, None);
        }
        Err(err) => {
            // Transient clipboard contention is normal during external multi-format writes;
            // update status and allow subsequent tick or burst debounce to recover.
            fail(app, status, format!("Clipboard read contention: {err}"));
        }
    }

    None
}

fn record_capture(app: &AppHandle, status: &Arc<Mutex<MonitorStatus>>, entry: &DbClipboardEntry) {
    set_last_hash(status, Some(entry.content_hash.clone()));

    let now = Utc::now().timestamp_millis();
    update_status(status, |state| {
        state.captures = state.captures.saturating_add(1);
        state.last_capture_at = Some(now);
        state.last_error = None;
    });

    let payload = ClipboardCapturedEvent::new(entry.clone());
    if let Err(err) = app.emit(CLIPBOARD_CAPTURED_EVENT, &payload) {
        eprintln!("[LucidClip Monitor] Failed to notify frontend: {err}");
        update_status(status, |state| {
            state.last_error = Some(format!("Failed to notify frontend: {err}"));
        });
    }
    emit_status(app, status);
}

struct ClipboardMonitorWorker {
    app: AppHandle,
    pool: Arc<DbPool>,
    paths: AppPaths,
    stop: Arc<AtomicBool>,
    status: Arc<Mutex<MonitorStatus>>,
    paste_guard: Arc<PasteGuard>,
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    native_notifications: Option<mpsc::Receiver<()>>,
}

impl ClipboardMonitorWorker {
    fn new(
        app: AppHandle,
        pool: Arc<DbPool>,
        paths: AppPaths,
        stop: Arc<AtomicBool>,
        status: Arc<Mutex<MonitorStatus>>,
        paste_guard: Arc<PasteGuard>,
    ) -> Self {
        #[cfg(any(target_os = "windows", target_os = "linux"))]
        let native_notifications = {
            let (notify_tx, notify_rx) = mpsc::sync_channel::<()>(1);
            let result = {
                #[cfg(target_os = "windows")]
                {
                    platform::spawn_clipboard_watcher(notify_tx, stop.clone())
                }
                #[cfg(target_os = "linux")]
                {
                    platform::spawn_clipboard_watcher(notify_tx)
                }
            };

            match result {
                Ok(()) => Some(notify_rx),
                Err(err) => {
                    eprintln!(
                        "[LucidClip Monitor] Native notifications unavailable ({err}); using polling fallback."
                    );
                    None
                }
            }
        };

        Self {
            app,
            pool,
            paths,
            stop,
            status,
            paste_guard,
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            native_notifications,
        }
    }

    fn run(self) {
        println!("[LucidClip Monitor] Clipboard monitor worker started.");

        update_status(&self.status, |state| {
            state.running = true;
            state.started_at = Some(Utc::now().timestamp_millis());
        });

        // Capture the current clipboard once at startup.
        let policy = monitor_policy(&self.pool);
        update_status(&self.status, |state| state.paused = !policy.enabled);
        if policy.enabled {
            capture_clipboard_once(
                &self.app,
                &self.pool,
                &self.paths,
                &policy,
                &self.status,
                &self.paste_guard,
                false,
            );
        }
        emit_status(&self.app, &self.status);

        while !self.stop.load(Ordering::Relaxed) {
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            let wait_result = match &self.native_notifications {
                Some(receiver) => receiver.recv_timeout(SAFETY_POLL_INTERVAL),
                None => {
                    thread::sleep(POLL_INTERVAL);
                    Err(RecvTimeoutError::Timeout)
                }
            };

            #[cfg(not(any(target_os = "windows", target_os = "linux")))]
            let wait_result: std::result::Result<(), RecvTimeoutError> = {
                thread::sleep(POLL_INTERVAL);
                Err(RecvTimeoutError::Timeout)
            };

            if self.stop.load(Ordering::Relaxed) {
                break;
            }

            #[cfg(any(target_os = "windows", target_os = "linux"))]
            if matches!(wait_result, Ok(())) {
                // Coalesce rapid bursts: native notifications can arrive in bursts as
                // an application publishes multiple clipboard representations. Wait
                // DEBOUNCE_INTERVAL and drain all pending events into a single pass.
                thread::sleep(DEBOUNCE_INTERVAL);
                let mut burst_count = 0usize;
                while self
                    .native_notifications
                    .as_ref()
                    .is_some_and(|receiver| receiver.try_recv().is_ok())
                {
                    burst_count = burst_count.saturating_add(1);
                }
                if burst_count > 0 {
                    // Small additional settle window if many notifications were queued
                    thread::sleep(Duration::from_millis(15));
                }
            }

            let policy = monitor_policy(&self.pool);
            let was_paused = !policy.enabled;
            update_status(&self.status, |state| state.paused = was_paused);
            if policy.enabled {
                capture_clipboard_once(
                    &self.app,
                    &self.pool,
                    &self.paths,
                    &policy,
                    &self.status,
                    &self.paste_guard,
                    false,
                );
            } else {
                // Forget the last fingerprint so resuming captures the current
                // clipboard again instead of silently treating it as a duplicate.
                set_last_hash(&self.status, None);
            }
        }

        update_status(&self.status, |state| state.running = false);
        emit_status(&self.app, &self.status);
        println!("[LucidClip Monitor] Clipboard monitor worker stopped.");
    }
}

fn run_monitor(
    app: AppHandle,
    pool: Arc<DbPool>,
    paths: AppPaths,
    stop: Arc<AtomicBool>,
    status: Arc<Mutex<MonitorStatus>>,
    paste_guard: Arc<PasteGuard>,
) {
    let worker = ClipboardMonitorWorker::new(app, pool, paths, stop, status, paste_guard);
    worker.run();
}

/// Capture the clipboard immediately on explicit user request.
///
/// The explicit request is treated as consent, so it still works while the
/// background monitor is paused. It never bypasses app exclusions or the
/// sensitive-content check, and it does not resume the monitor.
pub fn capture_now(
    app: &AppHandle,
    pool: &DbPool,
    paths: &AppPaths,
    status: &Arc<Mutex<MonitorStatus>>,
    paste_guard: &PasteGuard,
) -> Result<Option<DbClipboardEntry>> {
    let policy = monitor_policy(pool);
    let previous_error = status_snapshot(status).last_error;
    let captured = capture_clipboard_once(app, pool, paths, &policy, status, paste_guard, true);

    let current_error = status_snapshot(status).last_error;
    if let Some(error) = current_error {
        if previous_error.as_deref() != Some(error.as_str()) {
            return Err(AppError::Clipboard(error));
        }
    }

    Ok(captured)
}

pub fn spawn(
    app: AppHandle,
    pool: Arc<DbPool>,
    paths: AppPaths,
    stop: Arc<AtomicBool>,
    status: Arc<Mutex<MonitorStatus>>,
    paste_guard: Arc<PasteGuard>,
) {
    if !platform::clipboard_monitoring_supported() {
        let environment = platform::clipboard_environment();
        eprintln!(
            "[LucidClip Monitor] Clipboard monitoring is unavailable (backend {}, session {}).",
            environment.backend,
            environment.session.as_str()
        );
        let mut first = None;
        for diagnostic in environment.diagnostics {
            eprintln!("[LucidClip Monitor] {diagnostic}");
            if first.is_none() {
                first = Some(diagnostic);
            }
        }

        update_status(&status, |state| {
            state.supported = false;
            state.running = false;
            state.last_error = first;
        });
        emit_status(&app, &status);
        return;
    }

    let thread_status = status.clone();
    let thread_guard = paste_guard;
    let spawned = thread::Builder::new()
        .name("lucidclip-clipboard-monitor".into())
        .spawn(move || run_monitor(app, pool, paths, stop, thread_status, thread_guard));

    if let Err(err) = spawned {
        eprintln!("[LucidClip Monitor] Failed to start monitor thread: {err}");
        update_status(&status, |state| {
            state.running = false;
            state.last_error = Some(format!("Failed to start monitor thread: {err}"));
        });
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
    fn status_serialization_omits_the_internal_fingerprint() {
        let status = Arc::new(Mutex::new(initial_status()));
        set_last_hash(&status, Some("fingerprint-that-must-not-ship".into()));

        let value = serde_json::to_value(status_snapshot(&status)).unwrap();
        assert!(value.get("last_hash").is_none());
        assert!(!value.to_string().contains("fingerprint-that-must-not-ship"));
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
