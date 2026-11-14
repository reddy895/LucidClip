use lucidclip_lib::clipboard::PasteGuard;
use lucidclip_lib::database::{run_migrations, ClipboardRepo, DbClipboardEntry, DbPool};
use lucidclip_lib::platform::focus::{ActiveWindowTarget, FocusManager};
use lucidclip_lib::platform::paste::{PasteExecutionResult, PasteMethod};

#[test]
fn test_paste_execution_result_contracts() {
    let success_res = PasteExecutionResult::success(true);
    assert!(success_res.success);
    assert!(success_res.target_restored);
    assert_eq!(success_res.method, PasteMethod::SyntheticKeyEvent);
    assert!(!success_res.fallback_used);
    assert!(success_res.message.is_none());

    let fallback_res = PasteExecutionResult::clipboard_fallback(false, "manual Ctrl+V required");
    assert!(fallback_res.success);
    assert!(!fallback_res.target_restored);
    assert_eq!(fallback_res.method, PasteMethod::ClipboardOnly);
    assert!(fallback_res.fallback_used);
    assert_eq!(fallback_res.message.as_deref(), Some("manual Ctrl+V required"));

    let reason_fallback = PasteExecutionResult::clipboard_fallback_with_reason(true, "Wayland policy");
    assert!(reason_fallback.success);
    assert!(reason_fallback.target_restored);
    assert!(reason_fallback.message.unwrap().contains("Wayland policy"));
}

#[test]
fn test_paste_orchestration_state_lifecycle() {
    let focus_manager = FocusManager::new();
    let paste_guard = PasteGuard::new();

    // 1. Initial state
    assert!(focus_manager.get_target().is_none());

    // 2. Set foreground window target before popup opens
    let target = ActiveWindowTarget::new(
        0x123456,
        1111,
        9999,
        Some("Code.exe".to_string()),
        Some("Visual Studio Code".to_string()),
    );
    focus_manager.set_target(Some(target.clone()));
    assert_eq!(focus_manager.get_target(), Some(target));

    // 3. Mark internal hash in paste guard during paste execution
    let test_content = "let x = 42;";
    let hash = lucidclip_lib::clipboard::hash_content(test_content);
    paste_guard.mark_internal(&hash);

    // Verify guard immediately reports internal paste suppression
    assert!(paste_guard.is_internal(&hash));

    // 4. Focus manager cleared after paste execution finishes
    focus_manager.clear();
    assert!(focus_manager.get_target().is_none());
}

#[test]
fn test_paste_database_touch_integration() {
    let pool = DbPool::open_in_memory().expect("open db");
    run_migrations(&pool).expect("migrations");
    let repo = ClipboardRepo::new(&pool);

    let entry = DbClipboardEntry {
        id: "clip_paste_test".to_string(),
        content: "fn main() {}".to_string(),
        content_type: "code".to_string(),
        source_app: Some("Terminal".to_string()),
        created_at: 1000,
        content_hash: "hash_main".to_string(),
        pinned: false,
        favorite: false,
        image_path: None,
        thumbnail_path: None,
        image_width: None,
        image_height: None,
        byte_size: 12,
        file_count: 0,
        last_used_at: None,
        usage_count: 0,
    };
    repo.insert(&entry).expect("insert");

    // Execute touch (as done during paste execution)
    repo.touch("clip_paste_test").expect("touch");

    let touched = repo.find_by_id("clip_paste_test").unwrap().unwrap();
    assert_eq!(touched.usage_count, 1);
    assert!(touched.last_used_at.is_some());
    assert!(touched.last_used_at.unwrap() >= 1000);
}
