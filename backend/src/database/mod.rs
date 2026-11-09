//! SQLite Database Module

pub mod clipboard_repo;
pub mod connection;
pub mod migrations;
pub mod screenshot_repo;
pub mod settings_repo;

pub use clipboard_repo::{ClipboardRepo, DbClipboardEntry};
pub use connection::DbPool;
pub use migrations::run_migrations;
pub use screenshot_repo::{DbScreenshotEntry, ScreenshotRepo};
pub use settings_repo::SettingsRepo;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_and_repositories() {
        let pool = DbPool::open_in_memory().expect("failed to open in-memory db");
        run_migrations(&pool).expect("failed to run migrations");

        // Verify clipboard repo starts genuinely empty
        let clipboard_repo = ClipboardRepo::new(&pool);
        assert_eq!(clipboard_repo.count().unwrap(), 0);

        // Insert genuine entry
        let entry = DbClipboardEntry {
            id: "clip-1".to_string(),
            content: "Hello LucidClip".to_string(),
            content_type: "plain".to_string(),
            source_app: Some("Code.exe".to_string()),
            created_at: 1000,
            content_hash: "hash-1".to_string(),
            pinned: false,
            favorite: false,
            image_path: None,
            thumbnail_path: None,
            image_width: None,
            image_height: None,
            byte_size: 15,
            file_count: 0,
        };
        clipboard_repo.insert(&entry).expect("failed to insert");
        assert_eq!(clipboard_repo.count().unwrap(), 1);

        // Pin and favorite
        assert!(clipboard_repo.toggle_pin("clip-1").unwrap());
        assert!(clipboard_repo.toggle_favorite("clip-1").unwrap());

        let retrieved = clipboard_repo.find_by_id("clip-1").unwrap().unwrap();
        assert!(retrieved.pinned);
        assert!(retrieved.favorite);

        // Verify screenshot repo starts empty
        let screenshot_repo = ScreenshotRepo::new(&pool);
        assert_eq!(screenshot_repo.count().unwrap(), 0);

        // Verify settings repo
        let settings_repo = SettingsRepo::new(&pool);
        settings_repo.set("theme", "dark").unwrap();
        assert_eq!(settings_repo.get("theme").unwrap().as_deref(), Some("dark"));
    }
}
