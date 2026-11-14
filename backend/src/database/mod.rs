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
    fn clipboard_media_metadata_round_trips() {
        let pool = DbPool::open_in_memory().expect("failed to open in-memory db");
        run_migrations(&pool).expect("failed to run migrations");
        let repo = ClipboardRepo::new(&pool);

        let entry = DbClipboardEntry {
            id: "clip-media".to_string(),
            content: String::new(),
            content_type: "image".to_string(),
            source_app: Some("msedge.exe".to_string()),
            created_at: 2000,
            content_hash: "media-hash".to_string(),
            pinned: false,
            favorite: false,
            image_path: Some(r"C:\Data\originals\clip-media.png".to_string()),
            thumbnail_path: Some(r"C:\Data\thumbnails\clip-media.png".to_string()),
            image_width: Some(1920),
            image_height: Some(1080),
            byte_size: 4_096,
            file_count: 0,
            last_used_at: None,
            usage_count: 0,
        };
        repo.insert(&entry).expect("failed to insert media entry");

        let stored = repo.find_by_id("clip-media").unwrap().unwrap();
        assert_eq!(stored.image_path, entry.image_path);
        assert_eq!(stored.thumbnail_path, entry.thumbnail_path);
        assert_eq!(stored.image_width, Some(1920));
        assert_eq!(stored.image_height, Some(1080));
        assert_eq!(stored.byte_size, 4_096);
        assert_eq!(stored.file_count, 0);
    }

    #[test]
    fn list_all_orders_equal_timestamps_deterministically() {
        let pool = DbPool::open_in_memory().expect("failed to open in-memory db");
        run_migrations(&pool).expect("failed to run migrations");
        let repo = ClipboardRepo::new(&pool);

        for (id, hash) in [("clip_a", "hash-a"), ("clip_b", "hash-b")] {
            repo.insert(&DbClipboardEntry {
                id: id.to_string(),
                content: id.to_string(),
                content_type: "plain".to_string(),
                source_app: None,
                created_at: 1000,
                content_hash: hash.to_string(),
                pinned: false,
                favorite: false,
                image_path: None,
                thumbnail_path: None,
                image_width: None,
                image_height: None,
                byte_size: id.len() as u64,
                file_count: 0,
                last_used_at: None,
                usage_count: 0,
            })
            .unwrap();
        }

        let ids: Vec<String> = repo.list_all().unwrap().into_iter().map(|e| e.id).collect();
        assert_eq!(ids, vec!["clip_b".to_string(), "clip_a".to_string()]);
    }

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
            last_used_at: None,
            usage_count: 0,
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
