use lucidclip_lib::database::{run_migrations, ClipboardRepo, DbClipboardEntry, DbPool};

fn make_entry(id: &str, content: &str) -> DbClipboardEntry {
    DbClipboardEntry {
        id: id.to_string(),
        content: content.to_string(),
        content_type: "text".to_string(),
        source_app: None,
        created_at: 1000,
        content_hash: format!("hash_{id}"),
        pinned: false,
        favorite: false,
        image_path: None,
        thumbnail_path: None,
        image_width: None,
        image_height: None,
        byte_size: content.len() as u64,
        file_count: 0,
        last_used_at: None,
        usage_count: 0,
    }
}

#[test]
fn test_database_touch_entry() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    let entry = make_entry("clip_touch", "test content");
    repo.insert(&entry).expect("insert");

    let initial = repo.find_by_id("clip_touch").unwrap().unwrap();
    assert_eq!(initial.usage_count, 0);
    assert!(initial.last_used_at.is_none());

    // First touch
    repo.touch("clip_touch").expect("touch 1");
    let touched1 = repo.find_by_id("clip_touch").unwrap().unwrap();
    assert_eq!(touched1.usage_count, 1);
    assert!(touched1.last_used_at.is_some());

    // Second touch
    repo.touch("clip_touch").expect("touch 2");
    let touched2 = repo.find_by_id("clip_touch").unwrap().unwrap();
    assert_eq!(touched2.usage_count, 2);
    assert!(touched2.last_used_at.unwrap() >= touched1.last_used_at.unwrap());
}

#[test]
fn test_transactional_single_delete() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    let entry = make_entry("clip_del", "content to delete");
    repo.insert(&entry).expect("insert");

    let deleted = repo.delete_entry_transactional("clip_del").expect("delete");
    assert!(deleted.is_some());
    assert_eq!(deleted.unwrap().id, "clip_del");

    // Second delete should return None
    let deleted_again = repo.delete_entry_transactional("clip_del").expect("delete again");
    assert!(deleted_again.is_none());
}

#[test]
fn test_transactional_clear_unpinned() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    let e1 = make_entry("e1", "unpinned 1");
    let mut e2 = make_entry("e2", "pinned");
    let mut e3 = make_entry("e3", "favorite");
    let e4 = make_entry("e4", "unpinned 2");

    e2.pinned = true;
    e3.favorite = true;

    repo.insert(&e1).unwrap();
    repo.insert(&e2).unwrap();
    repo.insert(&e3).unwrap();
    repo.insert(&e4).unwrap();

    let removed = repo.clear_unpinned_transactional().expect("clear");
    assert_eq!(removed.len(), 2);
    let removed_ids: Vec<String> = removed.into_iter().map(|e| e.id).collect();
    assert!(removed_ids.contains(&"e1".to_string()));
    assert!(removed_ids.contains(&"e4".to_string()));

    // Verify e2 and e3 remain in DB
    assert!(repo.find_by_id("e2").unwrap().is_some());
    assert!(repo.find_by_id("e3").unwrap().is_some());
    assert_eq!(repo.count().unwrap(), 2);
}

#[test]
fn test_db_pool_integrity_and_maintenance() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");

    assert!(pool.pragma_integrity_check().expect("integrity check"));
    assert!(pool.wal_checkpoint().is_ok());
}
