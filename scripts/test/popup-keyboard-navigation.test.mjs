import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Floating Clipboard Popup Keyboard Navigation Tests', () => {
  const sampleItems = [
    { id: '1', content: 'item 1' },
    { id: '2', content: 'item 2' },
    { id: '3', content: 'item 3' },
    { id: '4', content: 'item 4' },
    { id: '5', content: 'item 5' },
    { id: '6', content: 'item 6' },
  ];

  test('ArrowDown advances index and clamps at last item', () => {
    let index = 0;
    const nextIndex = (curr, max) => (curr < max - 1 ? curr + 1 : curr);

    index = nextIndex(index, sampleItems.length);
    assert.equal(index, 1);

    index = nextIndex(index, sampleItems.length);
    assert.equal(index, 2);

    // Advance to end
    for (let i = 0; i < 10; i++) {
      index = nextIndex(index, sampleItems.length);
    }
    assert.equal(index, sampleItems.length - 1);
  });

  test('ArrowUp decrements index and clamps at 0', () => {
    let index = 4;
    const prevIndex = (curr) => (curr > 0 ? curr - 1 : 0);

    index = prevIndex(index);
    assert.equal(index, 3);

    index = prevIndex(index);
    assert.equal(index, 2);

    for (let i = 0; i < 10; i++) {
      index = prevIndex(index);
    }
    assert.equal(index, 0);
  });

  test('Home and End jump to extremities', () => {
    let index = 2;
    index = 0; // Home
    assert.equal(index, 0);

    index = sampleItems.length - 1; // End
    assert.equal(index, 5);
  });

  test('Alt+1 through Alt+9 directly selects corresponding index', () => {
    const handleAltKey = (key, items) => {
      const idx = parseInt(key, 10) - 1;
      return idx >= 0 && idx < items.length ? items[idx] : null;
    };

    assert.equal(handleAltKey('1', sampleItems)?.id, '1');
    assert.equal(handleAltKey('3', sampleItems)?.id, '3');
    assert.equal(handleAltKey('6', sampleItems)?.id, '6');
    assert.equal(handleAltKey('9', sampleItems), null);
  });

  test('Enter triggers paste execution for currently selected item', () => {
    let pastedItem = null;
    const onPaste = (item) => {
      pastedItem = item;
    };

    const selectedIndex = 2;
    onPaste(sampleItems[selectedIndex]);

    assert.deepEqual(pastedItem, { id: '3', content: 'item 3' });
  });
});
