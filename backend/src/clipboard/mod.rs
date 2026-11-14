//! Clipboard Processing and Storage Engine

pub mod classifier;
pub mod events;
pub mod guard;
pub mod hasher;
pub mod media;
pub mod monitor;
pub mod normalize;
pub mod service;

pub use classifier::{classify_content, detect_programming_language, ClipboardContentType};
pub use events::{
    ClipboardCapturedEvent, CLIPBOARD_CAPTURED_EVENT, CLIPBOARD_EVENT_VERSION,
    CLIPBOARD_STATUS_EVENT,
};
pub use guard::PasteGuard;
pub use hasher::hash_content;
pub use monitor::{
    capture_now, initial_status, spawn as spawn_monitor, status_snapshot, MonitorStatus,
};
pub use normalize::{canonical_text, normalize_text};
pub use service::ClipboardService;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{run_migrations, DbPool};

    #[test]
    fn test_content_classification() {
        assert_eq!(
            classify_content("https://github.com/reddy895/LucidClip"),
            ClipboardContentType::Url
        );
        assert_eq!(
            classify_content("http://localhost:1420"),
            ClipboardContentType::Url
        );
        assert_eq!(
            classify_content("vscode://file/home/user/project"),
            ClipboardContentType::Url
        );
        assert_eq!(classify_content("#8B9CF7"), ClipboardContentType::ColorCode);
        assert_eq!(
            classify_content("rgb(25, 28, 32)"),
            ClipboardContentType::ColorCode
        );
        assert_eq!(
            classify_content("C:\\Users\\User\\Documents\\file.txt"),
            ClipboardContentType::Path
        );
        assert_eq!(
            classify_content("{\"key\": \"value\", \"count\": 42}"),
            ClipboardContentType::Json
        );
        assert_eq!(
            classify_content("function calculateTotal(items) {\n  return items.length;\n}"),
            ClipboardContentType::Code
        );
        assert_eq!(
            classify_content("First line\nSecond line\nThird line"),
            ClipboardContentType::Multiline
        );
        assert_eq!(
            classify_content("Simple single line note"),
            ClipboardContentType::Plain
        );
    }

    #[test]
    fn test_content_hashing_and_deduplication() {
        let pool = DbPool::open_in_memory().unwrap();
        run_migrations(&pool).unwrap();

        let service = ClipboardService::new(&pool);

        // First copy
        let entry1 = service
            .process_copied_text("npm run dev", Some("Terminal".into()))
            .unwrap();
        assert_eq!(entry1.content, "npm run dev");
        assert_eq!(service.get_history().unwrap().len(), 1);

        // Duplicate copy with CRLF variation should resolve to same hash and NOT create duplicate row
        let entry2 = service
            .process_copied_text("npm run dev\r\n", Some("Terminal".into()))
            .unwrap();
        // Normalized hash should match
        let h1 = hash_content("npm run dev");
        let h2 = hash_content("npm run dev\r\n");
        assert_eq!(h1, h2);

        // Total count in database remains exactly 1
        assert_eq!(service.get_history().unwrap().len(), 1);
        assert_eq!(entry1.id, entry2.id);
    }
}
