use lucidclip_lib::database::{run_migrations, ClipboardRepo, DbClipboardEntry, DbPool};
use std::fs;
use std::path::PathBuf;

fn temp_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let unique = format!("lucidclip_test_{}_{}.db", std::process::id(), chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    path.push(unique);
    path
}

#[test]
fn test_clipboard_history_survives_pool_restarts() {
    let db_path = temp_db_path();

    // 1. First run: open DB, run migrations, and insert items
    {
        let pool = DbPool::open(&db_path).expect("Failed to open DB");
        run_migrations(&pool).expect("Failed to run migrations");
        let repo = ClipboardRepo::new(&pool);

        let entry = DbClipboardEntry {
            id: "clip_restart_1".into(),
            content: "echo 'Persistence test'".into(),
            content_type: "code".into(),
            source_app: Some("terminal".into()),
            created_at: 1_700_000_100_000,
            content_hash: "hash_restart_1".into(),
            pinned: true,
            favorite: false,
            image_path: None,
            thumbnail_path: None,
            image_width: None,
            image_height: None,
            byte_size: 23,
            file_count: 0,
            last_used_at: Some(1_700_000_100_000),
            usage_count: 1,
        };

        repo.insert(&entry).expect("Insert must succeed");
    } // Pool closed here

    // 2. Second run: simulate app restart by opening the existing DB file anew
    {
        let pool = DbPool::open(&db_path).expect("Failed to reopen DB on restart");
        let repo = ClipboardRepo::new(&pool);

        let retrieved = repo
            .find_by_id("clip_restart_1")
            .expect("Query failed")
            .expect("Entry must survive restart");

        assert_eq!(retrieved.id, "clip_restart_1");
        assert_eq!(retrieved.content, "echo 'Persistence test'");
        assert_eq!(retrieved.content_type, "code");
        assert_eq!(retrieved.source_app.as_deref(), Some("terminal"));
        assert_eq!(retrieved.created_at, 1_700_000_100_000);
        assert!(retrieved.pinned);
        assert_eq!(retrieved.usage_count, 1);

        // Verify upsert on conflict
        let updated_entry = DbClipboardEntry {
            id: "clip_restart_2".into(),
            content: "echo 'Persistence test'".into(),
            content_type: "code".into(),
            source_app: Some("terminal".into()),
            created_at: 1_700_000_200_000,
            content_hash: "hash_restart_1".into(),
            pinned: true,
            favorite: false,
            image_path: None,
            thumbnail_path: None,
            image_width: None,
            image_height: None,
            byte_size: 23,
            file_count: 0,
            last_used_at: Some(1_700_000_200_000),
            usage_count: 2,
        };

        // Insert must not fail due to UNIQUE constraint
        repo.insert(&updated_entry).expect("Insert on conflict must succeed");

        let after_conflict = repo
            .find_by_hash("hash_restart_1")
            .expect("Query failed")
            .expect("Entry must exist");
        assert_eq!(after_conflict.created_at, 1_700_000_200_000);
    }

    let _ = fs::remove_file(&db_path);
}
