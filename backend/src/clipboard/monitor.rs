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
            excluded_apps: Vec::new(),
            exclude_sensitive: false,
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
        .unwrap_or(false);

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
                let policy = monitor_policy(&pool);
                if policy.enabled {
                    let foreground = match platform::foreground_process_name() {
                        Ok(name) => name,
                        Err(err) => {
                            eprintln!("[LucidClip Monitor] Could not resolve source app: {err}");
                            None
                        }
                    };

                    if is_excluded_process(&policy, foreground.as_deref()) {
                        thread::sleep(POLL_INTERVAL);
                        continue;
                    }

                    if policy.exclude_sensitive {
                        match platform::clipboard_content_is_sensitive() {
                            Ok(true) => {
                                thread::sleep(POLL_INTERVAL);
                                continue;
                            }
                            Ok(false) => {}
                            Err(err) => {
                                eprintln!(
                                    "[LucidClip Monitor] Sensitive-content check failed; skipping tick: {err}"
                                );
                                thread::sleep(POLL_INTERVAL);
                                continue;
                            }
                        }
                    }

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
                                    match service.process_copied_text(&text, foreground) {
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
