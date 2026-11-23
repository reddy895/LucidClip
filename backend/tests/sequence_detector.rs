use std::thread::sleep;
use std::time::Duration;
use lucidclip_lib::platform::hotkey_sequence::{SequenceDetector, SequenceEventResult, SequenceState};

#[test]
fn test_sequence_detector_complete_flow() {
    let mut detector = SequenceDetector::new('V', 'Z', 500);
    assert_eq!(detector.state(), SequenceState::Idle);

    // Ctrl pressed
    let res = detector.on_ctrl_down();
    assert_eq!(res, SequenceEventResult::PassThrough);
    assert_eq!(detector.state(), SequenceState::CtrlDown);

    // V pressed while Ctrl held
    let res = detector.on_key_down('v');
    assert_eq!(res, SequenceEventResult::AwaitingSequence);
    assert!(detector.is_awaiting());

    // Z pressed within timeout
    let res = detector.on_key_down('z');
    assert_eq!(res, SequenceEventResult::TriggerSequence);
    assert_eq!(detector.state(), SequenceState::Triggered);

    // Key up for Z should be suppressed to avoid triggering undo in host app
    assert!(detector.should_suppress_key_up('z'));
    // Repeated check should not suppress
    assert!(!detector.should_suppress_key_up('z'));
}

#[test]
fn test_sequence_detector_ctrl_release_aborts() {
    let mut detector = SequenceDetector::default_ctrl_v_z();

    detector.on_ctrl_down();
    detector.on_key_down('V');
    assert!(detector.is_awaiting());

    // Release Ctrl before Z is pressed
    let res = detector.on_ctrl_up();
    assert_eq!(res, SequenceEventResult::Reset);
    assert_eq!(detector.state(), SequenceState::Idle);
    assert!(!detector.is_awaiting());
}

#[test]
fn test_sequence_detector_wrong_key_aborts() {
    let mut detector = SequenceDetector::default_ctrl_v_z();

    detector.on_ctrl_down();
    detector.on_key_down('V');
    assert!(detector.is_awaiting());

    // Press 'C' instead of 'Z'
    let res = detector.on_key_down('C');
    assert_eq!(res, SequenceEventResult::Reset);
    assert_eq!(detector.state(), SequenceState::CtrlDown);
}

#[test]
fn test_sequence_detector_timeout() {
    let mut detector = SequenceDetector::new('V', 'Z', 50);

    detector.on_ctrl_down();
    detector.on_key_down('V');
    assert!(detector.is_awaiting());

    // Wait for timeout to expire
    sleep(Duration::from_millis(80));

    assert!(detector.check_timeout());
    assert!(!detector.is_awaiting());
    assert_eq!(detector.state(), SequenceState::CtrlDown);

    // Pressing Z now should pass through or reset
    let res = detector.on_key_down('Z');
    assert_eq!(res, SequenceEventResult::PassThrough);
}

#[test]
fn test_sequence_detector_refreshed_first_key() {
    let mut detector = SequenceDetector::new('V', 'Z', 200);

    detector.on_ctrl_down();
    detector.on_key_down('V');
    sleep(Duration::from_millis(50));

    // Press V again (restarting the timeout window)
    let res = detector.on_key_down('V');
    assert_eq!(res, SequenceEventResult::AwaitingSequence);
    assert!(detector.is_awaiting());

    // Finish with Z
    let res = detector.on_key_down('Z');
    assert_eq!(res, SequenceEventResult::TriggerSequence);
}

#[test]
fn test_single_key_mode_ctrl_p() {
    let mut detector = SequenceDetector::single_key('P');
    assert_eq!(detector.state(), SequenceState::Idle);

    // Ctrl down
    detector.on_ctrl_down();
    assert_eq!(detector.state(), SequenceState::CtrlDown);

    // Press P -> triggers popup immediately
    let res = detector.on_key_down('p');
    assert_eq!(res, SequenceEventResult::TriggerSequence);
    assert_eq!(detector.state(), SequenceState::Triggered);
    assert!(detector.should_suppress_key_up('p'));
}
