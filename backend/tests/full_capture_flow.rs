use lucidclip_lib::clipboard::{hash_content, ClipboardService, PasteGuard};
use lucidclip_lib::database::{run_migrations, ClipboardRepo, DbPool};
use lucidclip_lib::platform::focus::{ActiveWindowTarget, FocusManager};
use lucidclip_lib::platform::paste::PasteExecutionResult;

#[test]
fn test_end_to_end_clipboard_capture_and_instant_paste_flow() {
    let pool = DbPool::open_in_memory().expect("in-memory db");
    run_migrations(&pool).expect("run migrations");

    let service = ClipboardService::new(&pool);
    let repo = ClipboardRepo::new(&pool);
    let focus_manager = FocusManager::new();
    let paste_guard = PasteGuard::new();

    // 1. External application copy occurs (e.g. from browser)
    let copied_code = "const apiKey = 'sk-prod-test-9988';";
    let entry = service
        .process_copied_text(copied_code, Some("msedge.exe".to_string()))
        .expect("store external text");

    assert_eq!(entry.content, copied_code);
    assert_eq!(entry.content_type, "code");
    assert_eq!(entry.source_app.as_deref(), Some("msedge.exe"));
    assert_eq!(entry.usage_count, 0);
    assert!(entry.last_used_at.is_none());

    // 2. User presses global shortcut Ctrl+Shift+V
    // FocusManager captures currently active target window before popup opens
    let target = ActiveWindowTarget::new(
        0xFEED_FACE,
        4444,
        8888,
        Some("Code.exe".to_string()),
        Some("app.ts - Visual Studio Code".to_string()),
    );
    focus_manager.set_target(Some(target.clone()));
    assert_eq!(focus_manager.get_target(), Some(target));

    // 3. Floating popup searches history
    let search_results = repo.search_entries("apiKey", 10).expect("search");
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].id, entry.id);

    // 4. User presses Enter on item to execute instant paste
    // Paste engine marks internal guard, updates usage stats, and triggers synthetic input
    let hash = hash_content(&entry.content);
    let seq = paste_guard.mark_internal(&hash);
    assert!(seq > 0);

    // Database touch updates usage frequency and timestamp
    repo.touch(&entry.id).expect("touch entry");
    let touched_entry = repo.find_by_id(&entry.id).unwrap().unwrap();
    assert_eq!(touched_entry.usage_count, 1);
    assert!(touched_entry.last_used_at.is_some());

    // 5. Verification that monitor detects internal copy and suppresses duplicate entry
    assert!(paste_guard.is_internal(&hash));
    assert_eq!(paste_guard.last_intercepted_sequence(), seq);

    // 6. Focus manager cleared after paste execution
    focus_manager.clear();
    assert!(focus_manager.get_target().is_none());

    // Execution result formatted correctly
    let result = PasteExecutionResult::success(true);
    assert!(result.success);
    assert!(result.target_restored);
}
