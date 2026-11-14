use lucidclip_lib::platform::hotkeys::GlobalShortcutService;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;

#[test]
fn test_global_shortcut_service_initial_state() {
    let service = GlobalShortcutService::new();
    assert!(!service.listener_stop.load(Ordering::SeqCst));

    let status = service.status();
    assert_eq!(status.shortcut, "Ctrl+Shift+V");
    assert!(!status.active);
    assert!(status.error.is_none());
}

#[test]
fn test_global_shortcut_service_update_and_validation() {
    let service = GlobalShortcutService::new();

    // Valid update
    let updated = service.update_shortcut("Ctrl+Shift+H").expect("valid update");
    assert_eq!(updated.shortcut, "Ctrl+Shift+H");
    assert!(updated.active);

    // Invalid update should fail and not overwrite valid state
    let err = service.update_shortcut("invalid+shortcut").unwrap_err();
    assert!(err.to_string().contains("Invalid") || err.to_string().contains("Unsupported"));

    // Status should still reflect valid shortcut
    let current_status = service.status();
    assert_eq!(current_status.shortcut, "Ctrl+Shift+H");
}

#[test]
fn test_global_shortcut_service_stop() {
    let service = GlobalShortcutService::new();
    assert!(!service.listener_stop.load(Ordering::SeqCst));

    service.stop();
    assert!(service.listener_stop.load(Ordering::SeqCst));
}

#[test]
fn test_global_shortcut_service_concurrency() {
    let service = Arc::new(GlobalShortcutService::new());
    let mut handles = Vec::new();

    for i in 0..5 {
        let svc = Arc::clone(&service);
        handles.push(thread::spawn(move || {
            let key = format!("Ctrl+Alt+F{}", (i % 4) + 1);
            let _ = svc.update_shortcut(&key);
            let _ = svc.status();
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    let final_status = service.status();
    assert!(final_status.shortcut.starts_with("Ctrl+Alt+F"));
}
