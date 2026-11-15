import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Floating Popup Paste vs Copy-Only Action Tests', () => {
  const sampleItems = [
    { id: 'item-1', content: 'First snippet', contentType: 'text' },
    { id: 'item-2', content: 'Second snippet', contentType: 'text' },
    { id: 'item-3', content: '/path/to/screenshot.png', contentType: 'image' },
  ];

  function simulateSelectionAction({ entry, isShiftKey, pasteOnSelect, onPaste, onCopyOnly }) {
    if (isShiftKey) {
      onCopyOnly(entry);
    } else if (pasteOnSelect) {
      onPaste(entry);
    } else {
      onCopyOnly(entry);
    }
  }

  test('Enter with pasteOnSelect=true triggers paste action', () => {
    let pasted = null;
    let copied = null;

    simulateSelectionAction({
      entry: sampleItems[0],
      isShiftKey: false,
      pasteOnSelect: true,
      onPaste: (item) => { pasted = item; },
      onCopyOnly: (item) => { copied = item; },
    });

    assert.equal(pasted?.id, 'item-1');
    assert.equal(copied, null);
  });

  test('Enter with pasteOnSelect=false triggers copy-only action', () => {
    let pasted = null;
    let copied = null;

    simulateSelectionAction({
      entry: sampleItems[1],
      isShiftKey: false,
      pasteOnSelect: false,
      onPaste: (item) => { pasted = item; },
      onCopyOnly: (item) => { copied = item; },
    });

    assert.equal(pasted, null);
    assert.equal(copied?.id, 'item-2');
  });

  test('Shift+Enter triggers copy-only action even when pasteOnSelect=true', () => {
    let pasted = null;
    let copied = null;

    simulateSelectionAction({
      entry: sampleItems[2],
      isShiftKey: true,
      pasteOnSelect: true,
      onPaste: (item) => { pasted = item; },
      onCopyOnly: (item) => { copied = item; },
    });

    assert.equal(pasted, null);
    assert.equal(copied?.id, 'item-3');
  });

  test('Shift+Enter triggers copy-only action when pasteOnSelect=false', () => {
    let pasted = null;
    let copied = null;

    simulateSelectionAction({
      entry: sampleItems[0],
      isShiftKey: true,
      pasteOnSelect: false,
      onPaste: (item) => { pasted = item; },
      onCopyOnly: (item) => { copied = item; },
    });

    assert.equal(pasted, null);
    assert.equal(copied?.id, 'item-1');
  });

  test('Image item selection routes correctly with image content type', () => {
    let handledEntry = null;

    simulateSelectionAction({
      entry: sampleItems[2],
      isShiftKey: false,
      pasteOnSelect: true,
      onPaste: (item) => { handledEntry = item; },
      onCopyOnly: () => {},
    });

    assert.equal(handledEntry?.contentType, 'image');
    assert.equal(handledEntry?.content, '/path/to/screenshot.png');
  });
});
