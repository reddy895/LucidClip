//! Typed clipboard event contract shared with the frontend.
//!
//! Events are emitted only after the database write succeeds. The envelope
//! carries a version so the webview can reject payloads it does not understand
//! instead of rendering partial or fabricated data.

use serde::Serialize;

use crate::database::DbClipboardEntry;

/// Emitted after a clipboard entry has been persisted.
pub const CLIPBOARD_CAPTURED_EVENT: &str = "clipboard://new-entry";

/// Emitted whenever monitor status changes (capture, pause, error, shutdown).
pub const CLIPBOARD_STATUS_EVENT: &str = "clipboard://monitor-status";

/// Current event contract version.
pub const CLIPBOARD_EVENT_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize)]
pub struct ClipboardCapturedEvent {
    pub version: u8,
    pub entry: DbClipboardEntry,
}

impl ClipboardCapturedEvent {
    pub fn new(entry: DbClipboardEntry) -> Self {
        Self {
            version: CLIPBOARD_EVENT_VERSION,
            entry,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_entry() -> DbClipboardEntry {
        DbClipboardEntry {
            id: "clip_test".into(),
            content: "hello".into(),
            content_type: "plain".into(),
            source_app: Some("Code.exe".into()),
            created_at: 1_700_000_000_000,
            content_hash: "hash".into(),
            pinned: false,
            favorite: false,
            image_path: None,
            thumbnail_path: None,
            image_width: None,
            image_height: None,
            byte_size: 5,
            file_count: 0,
        }
    }

    #[test]
    fn captured_event_serializes_a_versioned_entry() {
        let payload = ClipboardCapturedEvent::new(sample_entry());
        let value = serde_json::to_value(&payload).unwrap();

        assert_eq!(value["version"], CLIPBOARD_EVENT_VERSION);
        assert_eq!(value["entry"]["id"], "clip_test");
        assert_eq!(value["entry"]["content"], "hello");
        assert_eq!(value["entry"]["content_type"], "plain");
        assert_eq!(value["entry"]["created_at"], 1_700_000_000_000i64);
        assert_eq!(value["entry"]["pinned"], false);
    }
}
