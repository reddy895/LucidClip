//! State machine for detecting multi-key sequence shortcuts (e.g. Ctrl+V followed by Ctrl+Z).
//!
//! Prevents accidental paste or undo actions when the configured sequence is completed,
//! while allowing normal Ctrl+V and Ctrl+Z events to pass through when the sequence is aborted.

use std::time::{Duration, Instant};

pub const DEFAULT_SEQUENCE_TIMEOUT_MS: u64 = 750;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SequenceState {
    Idle,
    CtrlDown,
    AwaitingSecondKey { v_pressed_at: Instant },
    Triggered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SequenceEventResult {
    PassThrough,
    AwaitingSequence,
    TriggerSequence,
    Reset,
}

#[derive(Debug, Clone)]
pub struct SequenceDetector {
    state: SequenceState,
    timeout: Duration,
    first_key: char,
    second_key: char,
}

impl SequenceDetector {
    pub fn new(first_key: char, second_key: char, timeout_ms: u64) -> Self {
        Self {
            state: SequenceState::Idle,
            timeout: Duration::from_millis(timeout_ms),
            first_key: first_key.to_ascii_uppercase(),
            second_key: second_key.to_ascii_uppercase(),
        }
    }

    pub fn default_ctrl_v_z() -> Self {
        Self::new('V', 'Z', DEFAULT_SEQUENCE_TIMEOUT_MS)
    }

    pub fn state(&self) -> SequenceState {
        self.state
    }

    pub fn timeout(&self) -> Duration {
        self.timeout
    }

    pub fn reset(&mut self) {
        self.state = SequenceState::Idle;
    }
}
