use lucidclip_lib::platform::hotkey_sequence::{SequenceDetector, SequenceEventResult};
use lucidclip_lib::platform::hotkeys_windows::{
    capture_foreground_window, get_last_foreground_window, is_ctrl_vk, vk_to_char,
    VK_CONTROL, VK_LCONTROL, VK_RCONTROL, VK_V, VK_Z,
};

#[test]
fn test_windows_vk_mapping() {
    assert!(is_ctrl_vk(VK_CONTROL));
    assert!(is_ctrl_vk(VK_LCONTROL));
    assert!(is_ctrl_vk(VK_RCONTROL));
    assert!(!is_ctrl_vk(VK_V));
    assert!(!is_ctrl_vk(VK_Z));
    assert!(!is_ctrl_vk(0x20)); // Space

    assert_eq!(vk_to_char(VK_V), Some('V'));
    assert_eq!(vk_to_char(VK_Z), Some('Z'));
    assert_eq!(vk_to_char(0x43), Some('C'));
    assert_eq!(vk_to_char(0x31), Some('1'));
    assert_eq!(vk_to_char(0x70), None); // F1
}

#[test]
fn test_windows_hook_sequence_simulation() {
    let mut detector = SequenceDetector::new('V', 'Z', 500);
    let mut triggered = false;

    // Simulate VK_LCONTROL down
    let vk = VK_LCONTROL;
    if is_ctrl_vk(vk) {
        detector.on_ctrl_down();
    }
    assert_eq!(detector.is_awaiting(), false);

    // Simulate VK_V down
    let vk = VK_V;
    if let Some(ch) = vk_to_char(vk) {
        let res = detector.on_key_down(ch);
        assert_eq!(res, SequenceEventResult::AwaitingSequence);
    }
    assert!(detector.is_awaiting());

    // Simulate VK_Z down
    let vk = VK_Z;
    if let Some(ch) = vk_to_char(vk) {
        let res = detector.on_key_down(ch);
        if res == SequenceEventResult::TriggerSequence {
            triggered = true;
        }
    }
    assert!(triggered);
    assert!(detector.should_suppress_key_up('Z'));
}

#[test]
fn test_windows_foreground_window_capture() {
    let handle = capture_foreground_window();
    let retrieved = get_last_foreground_window();
    assert_eq!(handle, retrieved);
}
