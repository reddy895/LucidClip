//! Cross-platform focus and active window preservation.
//!
//! Stores the active foreground window target prior to opening the floating
//! clipboard popup window so focus can be accurately restored for instant paste.

use std::sync::{Arc, Mutex};
use chrono::Utc;
use serde::Serialize;

/// Descriptor of an active external window captured before the popup opened.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ActiveWindowTarget {
    pub window_id: usize,
    pub thread_id: u32,
    pub process_id: u32,
    pub process_name: Option<String>,
    pub window_title: Option<String>,
    pub captured_at: i64,
}

impl ActiveWindowTarget {
    pub fn new(
        window_id: usize,
        thread_id: u32,
        process_id: u32,
        process_name: Option<String>,
        window_title: Option<String>,
    ) -> Self {
        Self {
            window_id,
            thread_id,
            process_id,
            process_name,
            window_title,
            captured_at: Utc::now().timestamp_millis(),
        }
    }
}

/// Global or application-scoped focus manager that tracks the last active external target.
#[derive(Debug, Clone, Default)]
pub struct FocusManager {
    target: Arc<Mutex<Option<ActiveWindowTarget>>>,
}

impl FocusManager {
    pub fn new() -> Self {
        Self {
            target: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_target(&self, target: Option<ActiveWindowTarget>) {
        if let Ok(mut lock) = self.target.lock() {
            *lock = target;
        }
    }

    pub fn get_target(&self) -> Option<ActiveWindowTarget> {
        self.target.lock().ok().and_then(|lock| lock.clone())
    }

    pub fn clear(&self) {
        self.set_target(None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_focus_manager_lifecycle() {
        let manager = FocusManager::new();
        assert!(manager.get_target().is_none());

        let target = ActiveWindowTarget::new(
            0x1234,
            42,
            100,
            Some("code.exe".to_string()),
            Some("editor - LucidClip".to_string()),
        );
        manager.set_target(Some(target.clone()));

        let retrieved = manager.get_target();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().process_name.as_deref(), Some("code.exe"));

        manager.clear();
        assert!(manager.get_target().is_none());
    }
}
