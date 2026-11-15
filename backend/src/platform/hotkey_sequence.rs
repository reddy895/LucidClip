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
    suppress_key_up: bool,
}

impl SequenceDetector {
    pub fn new(first_key: char, second_key: char, timeout_ms: u64) -> Self {
        Self {
            state: SequenceState::Idle,
            timeout: Duration::from_millis(timeout_ms),
            first_key: first_key.to_ascii_uppercase(),
            second_key: second_key.to_ascii_uppercase(),
            suppress_key_up: false,
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

    pub fn first_key(&self) -> char {
        self.first_key
    }

    pub fn second_key(&self) -> char {
        self.second_key
    }

    pub fn is_awaiting(&self) -> bool {
        matches!(self.state, SequenceState::AwaitingSecondKey { .. })
    }

    pub fn reset(&mut self) {
        self.state = SequenceState::Idle;
    }

    /// Record a Ctrl key-down event.
    pub fn on_ctrl_down(&mut self) -> SequenceEventResult {
        match self.state {
            SequenceState::Idle => {
                self.state = SequenceState::CtrlDown;
                SequenceEventResult::PassThrough
            }
            _ => SequenceEventResult::PassThrough,
        }
    }

    /// Record a Ctrl key-up event. Releases reset any in-progress sequence.
    pub fn on_ctrl_up(&mut self) -> SequenceEventResult {
        let was_awaiting = matches!(self.state, SequenceState::AwaitingSecondKey { .. });
        self.state = SequenceState::Idle;
        if was_awaiting {
            SequenceEventResult::Reset
        } else {
            SequenceEventResult::PassThrough
        }
    }

    /// Process a key-down event for a primary character key while Ctrl is down.
    pub fn on_key_down(&mut self, key: char) -> SequenceEventResult {
        let ch = key.to_ascii_uppercase();

        match self.state {
            SequenceState::CtrlDown => {
                if ch == self.first_key {
                    self.state = SequenceState::AwaitingSecondKey {
                        v_pressed_at: Instant::now(),
                    };
                    SequenceEventResult::AwaitingSequence
                } else {
                    SequenceEventResult::PassThrough
                }
            }
            SequenceState::AwaitingSecondKey { v_pressed_at } => {
                if v_pressed_at.elapsed() > self.timeout {
                    self.state = SequenceState::CtrlDown;
                    SequenceEventResult::Reset
                } else if ch == self.second_key {
                    self.state = SequenceState::Triggered;
                    self.suppress_key_up = true;
                    SequenceEventResult::TriggerSequence
                } else if ch == self.first_key {
                    // Refreshed V press
                    self.state = SequenceState::AwaitingSecondKey {
                        v_pressed_at: Instant::now(),
                    };
                    SequenceEventResult::AwaitingSequence
                } else {
                    self.state = SequenceState::CtrlDown;
                    SequenceEventResult::Reset
                }
            }
            SequenceState::Triggered => {
                self.state = SequenceState::CtrlDown;
                SequenceEventResult::PassThrough
            }
            SequenceState::Idle => SequenceEventResult::PassThrough,
        }
    }

    /// Check if the awaiting sequence has timed out.
    pub fn check_timeout(&mut self) -> bool {
        if let SequenceState::AwaitingSecondKey { v_pressed_at } = self.state {
            if v_pressed_at.elapsed() > self.timeout {
                self.state = SequenceState::CtrlDown;
                return true;
            }
        }
        false
    pub fn should_suppress_key_up(&mut self, key: char) -> bool {
        let ch = key.to_ascii_uppercase();
        if self.suppress_key_up && (ch == self.second_key || ch == self.first_key) {
            self.suppress_key_up = false;
            return true;
        }
        false
    }
}
