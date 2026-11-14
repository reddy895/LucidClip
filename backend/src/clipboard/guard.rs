//! Internal clipboard operation guard.
//!
//! Prevents LucidClip from capturing its own internal clipboard writes (such as
//! when setting the clipboard for instant paste or copy-back actions).

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use chrono::Utc;

/// Maximum duration (in milliseconds) an internal hash remains suppressed.
const SUPPRESSION_WINDOW_MS: i64 = 4_000;

#[derive(Debug, Clone)]
pub struct SuppressedHash {
    pub hash: String,
    pub sequence: u64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Default)]
pub struct PasteGuard {
    sequence: Arc<AtomicU64>,
    suppressed: Arc<Mutex<Vec<SuppressedHash>>>,
}

impl PasteGuard {
    pub fn new() -> Self {
        Self {
            sequence: Arc::new(AtomicU64::new(1)),
            suppressed: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Mark a content hash as an internal LucidClip copy operation.
    /// Returns the assigned sequence number.
    pub fn mark_internal(&self, hash: &str) -> u64 {
        let seq = self.sequence.fetch_add(1, Ordering::SeqCst);
        let now = Utc::now().timestamp_millis();

        if let Ok(mut lock) = self.suppressed.lock() {
            // Prune expired entries older than the suppression window
            lock.retain(|entry| now - entry.created_at < SUPPRESSION_WINDOW_MS);
            lock.push(SuppressedHash {
                hash: hash.to_string(),
                sequence: seq,
                created_at: now,
            });
        }

        seq
    }

    /// Test if a given content hash was written by LucidClip and should be ignored.
    pub fn is_internal(&self, hash: &str) -> bool {
        let now = Utc::now().timestamp_millis();

        if let Ok(mut lock) = self.suppressed.lock() {
            lock.retain(|entry| now - entry.created_at < SUPPRESSION_WINDOW_MS);
            lock.iter().any(|entry| entry.hash == hash)
        } else {
            false
        }
    }

    /// Clear all suppression tags (useful for testing and reset).
    pub fn clear(&self) {
        if let Ok(mut lock) = self.suppressed.lock() {
            lock.clear();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paste_guard_suppression_and_expiry() {
        let guard = PasteGuard::new();
        assert!(!guard.is_internal("sha256-test-hash"));

        let seq = guard.mark_internal("sha256-test-hash");
        assert!(seq >= 1);
        assert!(guard.is_internal("sha256-test-hash"));
        assert!(!guard.is_internal("other-hash"));

        guard.clear();
        assert!(!guard.is_internal("sha256-test-hash"));
    }
}
