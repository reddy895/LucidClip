use lucidclip_lib::platform::hotkey_sequence::{SequenceDetector, SequenceEventResult};
use lucidclip_lib::platform::hotkeys_linux::{
    capture_linux_active_window, determine_linux_forward_action, get_last_linux_active_window,
    get_linux_hotkey_diagnostics, is_linux_ctrl_keysym, linux_keysym_to_char,
    process_linux_key_event, LinuxKeyEventType, LinuxKeyForwardAction, XK_CONTROL_L,
    XK_CONTROL_R, XK_V_LOWER, XK_V_UPPER, XK_Z_LOWER, XK_Z_UPPER,
};

#[test]
fn test_linux_keysym_checks() {
    assert!(is_linux_ctrl_keysym(XK_CONTROL_L));
    assert!(is_linux_ctrl_keysym(XK_CONTROL_R));
    assert!(!is_linux_ctrl_keysym(XK_V_LOWER));
    assert!(!is_linux_ctrl_keysym(XK_Z_LOWER));

    assert_eq!(linux_keysym_to_char(XK_V_LOWER), Some('V'));
    assert_eq!(linux_keysym_to_char(XK_V_UPPER), Some('V'));
    assert_eq!(linux_keysym_to_char(XK_Z_LOWER), Some('Z'));
    assert_eq!(linux_keysym_to_char(XK_Z_UPPER), Some('Z'));
    assert_eq!(linux_keysym_to_char(0x0061), Some('A')); // 'a'
}

#[test]
fn test_process_linux_sequence_flow() {
    let mut detector = SequenceDetector::new('V', 'Z', 500);

    // Press Control
    let res = process_linux_key_event(&mut detector, LinuxKeyEventType::KeyPress, XK_CONTROL_L);
    assert_eq!(res, SequenceEventResult::PassThrough);

    // Press V
    let res = process_linux_key_event(&mut detector, LinuxKeyEventType::KeyPress, XK_V_LOWER);
    assert_eq!(res, SequenceEventResult::AwaitingSequence);
    let action = determine_linux_forward_action(res, false);
    assert_eq!(action, LinuxKeyForwardAction::ForwardOriginal);

    // Press Z within window
    let res = process_linux_key_event(&mut detector, LinuxKeyEventType::KeyPress, XK_Z_LOWER);
    assert_eq!(res, SequenceEventResult::TriggerSequence);
    let action = determine_linux_forward_action(res, false);
    assert_eq!(action, LinuxKeyForwardAction::TriggerPopup);

    // Release Z
    let res = process_linux_key_event(&mut detector, LinuxKeyEventType::KeyRelease, XK_Z_LOWER);
    assert_eq!(res, SequenceEventResult::Reset);
    let action = determine_linux_forward_action(res, true);
    assert_eq!(action, LinuxKeyForwardAction::Swallow);
}

#[test]
fn test_linux_active_window_tracking() {
    let handle = capture_linux_active_window();
    let retrieved = get_last_linux_active_window();
    assert_eq!(handle, retrieved);
}

#[test]
fn test_linux_diagnostics() {
    let diag = get_linux_hotkey_diagnostics();
    assert!(!diag.session.is_empty());
    assert!(!diag.reason.is_empty());
}
