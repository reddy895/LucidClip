use std::thread::sleep;
use std::time::Duration;
use lucidclip_lib::platform::hotkey_sequence::{SequenceDetector, SequenceEventResult, SequenceState};

#[test]
fn test_normal_ctrl_v_passthrough_when_sequence_aborted() {
    let mut detector = SequenceDetector::new('V', 'Z', 300);

    // User holds Ctrl and taps V to paste text
    detector.on_ctrl_down();
    let res = detector.on_key_down('V');
    assert_eq!(res, SequenceEventResult::AwaitingSequence);

    // User releases Ctrl without pressing Z
    let res = detector.on_ctrl_up();
    assert_eq!(res, SequenceEventResult::Reset);
    assert_eq!(detector.state(), SequenceState::Idle);

    // Key up of V should not be suppressed
    assert!(!detector.should_suppress_key_up('V'));
}

#[test]
fn test_normal_ctrl_z_undo_passthrough_without_v() {
    let mut detector = SequenceDetector::new('V', 'Z', 300);

    // User holds Ctrl and presses Z to undo an action (without pressing V first)
    detector.on_ctrl_down();
    let res = detector.on_key_down('Z');

    // Must pass through directly so the active window receives Ctrl+Z undo!
    assert_eq!(res, SequenceEventResult::PassThrough);
    assert_eq!(detector.state(), SequenceState::CtrlDown);

    // Key up of Z must NOT be suppressed
    assert!(!detector.should_suppress_key_up('Z'));
}

#[test]
fn test_ctrl_v_then_other_key_resets_sequence() {
    let mut detector = SequenceDetector::new('V', 'Z', 300);

    detector.on_ctrl_down();
    detector.on_key_down('V');
    assert!(detector.is_awaiting());

    // User presses 'C' (copy) or another key while holding Ctrl
    let res = detector.on_key_down('C');
    assert_eq!(res, SequenceEventResult::Reset);
    assert!(!detector.is_awaiting());

    // Next key is treated normally
    let res = detector.on_key_down('Z');
    assert_eq!(res, SequenceEventResult::PassThrough);
}

#[test]
fn test_ctrl_v_then_delayed_ctrl_z_does_not_trigger_sequence() {
    let mut detector = SequenceDetector::new('V', 'Z', 50);

    detector.on_ctrl_down();
    detector.on_key_down('V');
    assert!(detector.is_awaiting());

    // Wait past sequence timeout window (simulating deliberate paste, then later undo)
    sleep(Duration::from_millis(80));

    // The sequence timed out
    assert!(detector.check_timeout());
    assert!(!detector.is_awaiting());

    // Pressing Z now is a normal undo, not the sequence shortcut!
    let res = detector.on_key_down('Z');
    assert_eq!(res, SequenceEventResult::PassThrough);
    assert_ne!(res, SequenceEventResult::TriggerSequence);
    assert!(!detector.should_suppress_key_up('Z'));
}
