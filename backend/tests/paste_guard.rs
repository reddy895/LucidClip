use lucidclip_lib::clipboard::PasteGuard;

#[test]
fn test_concurrent_paste_guard_sequences() {
    let guard = PasteGuard::new();

    let seq1 = guard.mark_internal("hash-alpha");
    let seq2 = guard.mark_internal("hash-beta");
    let seq3 = guard.mark_internal("hash-gamma");

    assert!(seq1 < seq2);
    assert!(seq2 < seq3);

    assert!(guard.is_internal("hash-alpha"));
    assert_eq!(guard.last_intercepted_sequence(), seq1);

    assert!(guard.is_internal("hash-beta"));
    assert_eq!(guard.last_intercepted_sequence(), seq2);

    assert!(guard.is_internal("hash-gamma"));
    assert_eq!(guard.last_intercepted_sequence(), seq3);

    assert!(!guard.is_internal("unrelated-hash"));
}

#[test]
fn test_paste_guard_reset() {
    let guard = PasteGuard::new();
    guard.mark_internal("temp-hash");
    assert!(guard.is_internal("temp-hash"));

    guard.clear();
    assert!(!guard.is_internal("temp-hash"));
}
