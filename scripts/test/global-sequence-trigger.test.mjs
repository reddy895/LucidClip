import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Global Ctrl+V+Z Background Sequence Trigger Tests', () => {
  class MockSequenceEngine {
    constructor(timeoutMs = 750) {
      this.timeoutMs = timeoutMs;
      this.state = 'idle'; // 'idle' | 'ctrl_down' | 'awaiting_second_key' | 'triggered'
      this.vPressedAt = 0;
      this.suppressKeyUp = false;
      this.foregroundTarget = 0;
      this.popupVisible = false;
      this.emittedEvents = [];
    }

    onCtrlDown() {
      if (this.state === 'idle') {
        this.state = 'ctrl_down';
      }
    }

    onCtrlUp() {
      const wasAwaiting = this.state === 'awaiting_second_key';
      this.state = 'idle';
      return wasAwaiting ? 'reset' : 'pass_through';
    }

    onKeyDown(key, now = Date.now()) {
      const ch = key.toUpperCase();
      if (this.state === 'ctrl_down') {
        if (ch === 'V') {
          this.state = 'awaiting_second_key';
          this.vPressedAt = now;
          return 'awaiting';
        }
      } else if (this.state === 'awaiting_second_key') {
        if (now - this.vPressedAt > this.timeoutMs) {
          this.state = 'ctrl_down';
          return 'timeout_reset';
        }
        if (ch === 'Z') {
          this.state = 'triggered';
          this.suppressKeyUp = true;
          this.triggerPopup();
          return 'trigger_sequence';
        }
        this.state = 'ctrl_down';
        return 'reset';
      }
      return 'pass_through';
    }

    triggerPopup() {
      // Capture target window before bringing popup to front
      this.foregroundTarget = 12345;
      this.popupVisible = true;
      this.emittedEvents.push({
        event: 'clipboard://global-shortcut-triggered',
        payload: { shortcut: 'Ctrl+V+Z' },
      });
    }

    shouldSuppressKeyUp(key) {
      if (this.suppressKeyUp && (key.toUpperCase() === 'Z' || key.toUpperCase() === 'V')) {
        this.suppressKeyUp = false;
        return true;
      }
      return false;
    }
  }

  test('Ctrl+V+Z triggers popup when app is backgrounded', () => {
    const engine = new MockSequenceEngine();
    assert.equal(engine.popupVisible, false);

    engine.onCtrlDown();
    const vRes = engine.onKeyDown('v', 1000);
    assert.equal(vRes, 'awaiting');
    assert.equal(engine.popupVisible, false);

    // Press Z within 200ms
    const zRes = engine.onKeyDown('z', 1200);
    assert.equal(zRes, 'trigger_sequence');
    assert.equal(engine.popupVisible, true);
    assert.equal(engine.foregroundTarget, 12345);
    assert.equal(engine.emittedEvents.length, 1);
    assert.equal(engine.emittedEvents[0].payload.shortcut, 'Ctrl+V+Z');
  });

  test('Z key release is suppressed after trigger to prevent host undo', () => {
    const engine = new MockSequenceEngine();
    engine.onCtrlDown();
    engine.onKeyDown('v', 1000);
    engine.onKeyDown('z', 1200);

    assert.equal(engine.shouldSuppressKeyUp('z'), true);
    // Subsequent key ups are not suppressed
    assert.equal(engine.shouldSuppressKeyUp('z'), false);
  });

  test('Sequence times out if Z is pressed too late', () => {
    const engine = new MockSequenceEngine(750);
    engine.onCtrlDown();
    engine.onKeyDown('v', 1000);

    // Press Z 900ms later (> 750ms timeout)
    const zRes = engine.onKeyDown('z', 1900);
    assert.equal(zRes, 'timeout_reset');
    assert.equal(engine.popupVisible, false);
  });

  test('Releasing Ctrl aborts awaiting sequence', () => {
    const engine = new MockSequenceEngine();
    engine.onCtrlDown();
    engine.onKeyDown('v', 1000);

    const ctrlUpRes = engine.onCtrlUp();
    assert.equal(ctrlUpRes, 'reset');
    assert.equal(engine.state, 'idle');
    assert.equal(engine.popupVisible, false);
  });
});
