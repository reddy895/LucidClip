use lucidclip_lib::database::{run_migrations, ClipboardRepo, DbClipboardEntry, DbPool};

fn make_entry(id: &str, content: &str, content_type: &str, app: Option<&str>, created_at: i64) -> DbClipboardEntry {
    DbClipboardEntry {
        id: id.to_string(),
        content: content.to_string(),
        content_type: content_type.to_string(),
        source_app: app.map(str::to_string),
        created_at,
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
fn test_database_pagination() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    for i in 1..=10 {
        let entry = make_entry(&format!("clip_{i}"), &format!("Item {i}"), "text", None, 1000 + i);
        repo.insert(&entry).expect("insert");
    }

    // Page 1: limit 3, offset 0 -> clip_10, clip_9, clip_8 (newest first)
    let page1 = repo.list_paginated(3, 0).expect("page 1");
    assert_eq!(page1.len(), 3);
    assert_eq!(page1[0].id, "clip_10");
    assert_eq!(page1[1].id, "clip_9");
    assert_eq!(page1[2].id, "clip_8");

    // Page 2: limit 3, offset 3 -> clip_7, clip_6, clip_5
    let page2 = repo.list_paginated(3, 3).expect("page 2");
    assert_eq!(page2.len(), 3);
    assert_eq!(page2[0].id, "clip_7");
    assert_eq!(page2[1].id, "clip_6");
    assert_eq!(page2[2].id, "clip_5");

    // Tail page: limit 5, offset 9 -> clip_1
    let tail = repo.list_paginated(5, 9).expect("tail");
    assert_eq!(tail.len(), 1);
    assert_eq!(tail[0].id, "clip_1");
}

#[test]
fn test_database_search_and_ranking() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    let mut entry1 = make_entry("c1", "fn calculate_total() { return 42; }", "code", Some("VSCode.exe"), 2000);
    let entry2 = make_entry("c2", "https://github.com/reddy895/LucidClip", "url", Some("chrome.exe"), 3000);
    let mut entry3 = make_entry("c3", "total revenue calculation draft", "text", Some("Notepad.exe"), 1000);

    // Pin entry 1
    entry1.pinned = true;
    // Mark entry 3 favorite
    entry3.favorite = true;

    repo.insert(&entry1).expect("insert 1");
    repo.insert(&entry2).expect("insert 2");
    repo.insert(&entry3).expect("insert 3");

    // Search "calculate" or "total"
    let results = repo.search_entries("total", 10).expect("search");
    assert_eq!(results.len(), 2);
    // Pinned entry1 should rank before favorite entry3
    assert_eq!(results[0].id, "c1");
    assert_eq!(results[1].id, "c3");

    // Search by source app
    let app_results = repo.search_entries("chrome", 10).expect("search app");
    assert_eq!(app_results.len(), 1);
    assert_eq!(app_results[0].id, "c2");
}

#[test]
fn test_database_type_filtering() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    repo.insert(&make_entry("t1", "text one", "text", None, 100)).unwrap();
    repo.insert(&make_entry("c1", "code one", "code", None, 200)).unwrap();
    repo.insert(&make_entry("t2", "text two", "text", None, 300)).unwrap();
    repo.insert(&make_entry("u1", "https://example.com", "url", None, 400)).unwrap();

    let text_entries = repo.list_by_type("text", 10, 0).expect("list text");
    assert_eq!(text_entries.len(), 2);
    assert_eq!(text_entries[0].id, "t2");
    assert_eq!(text_entries[1].id, "t1");

    let code_entries = repo.list_by_type("code", 10, 0).expect("list code");
    assert_eq!(code_entries.len(), 1);
    assert_eq!(code_entries[0].id, "c1");

    let empty = repo.list_by_type("image", 10, 0).expect("list image");
    assert!(empty.is_empty());
}
