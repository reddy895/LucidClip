import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Floating Clipboard Popup Filtering and Pinning Tests', () => {
  const entries = [
    { id: '1', content: 'SELECT * FROM users;', contentType: 'code', sourceApp: 'DataGrip', isPinned: true, createdAt: '2026-11-20T10:00:00Z' },
    { id: '2', content: 'https://linear.app/issue/12', contentType: 'url', sourceApp: 'Chrome', isPinned: false, createdAt: '2026-11-21T10:00:00Z' },
    { id: '3', content: 'meeting notes summary', contentType: 'text', sourceApp: 'Notion', isPinned: false, createdAt: '2026-11-22T10:00:00Z' },
    { id: '4', content: '', contentType: 'image', sourceApp: 'SnippingTool', isPinned: true, createdAt: '2026-11-23T08:00:00Z' },
    { id: '5', content: '/var/log/syslog', contentType: 'files', sourceApp: 'Terminal', isPinned: false, createdAt: '2026-11-23T09:00:00Z' },
  ];

  function filterEntries(items, activeFilter, searchQuery) {
    let res = items;
    if (activeFilter === 'pinned') {
      res = res.filter((item) => item.isPinned);
    } else if (activeFilter === 'image') {
      res = res.filter((item) => item.contentType === 'image');
    } else if (activeFilter === 'files') {
      res = res.filter((item) => item.contentType === 'files');
    } else if (activeFilter === 'text') {
      res = res.filter((item) => item.contentType !== 'image' && item.contentType !== 'files');
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      res = res.filter((item) => {
        const textToSearch = `${item.content} ${item.contentType} ${item.sourceApp ?? ''}`.toLowerCase();
        return tokens.every((token) => textToSearch.includes(token));
      });
    }

    return [...res].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  test('Filtering by chip categories isolates expected types', () => {
    assert.equal(filterEntries(entries, 'all', '').length, 5);
    assert.equal(filterEntries(entries, 'pinned', '').length, 2);
    assert.equal(filterEntries(entries, 'image', '').length, 1);
    assert.equal(filterEntries(entries, 'files', '').length, 1);
    assert.equal(filterEntries(entries, 'text', '').length, 3);
  });

  test('Search query matches content and source application', () => {
    const queryResults = filterEntries(entries, 'all', 'users');
    assert.equal(queryResults.length, 1);
    assert.equal(queryResults[0].id, '1');

    const appResults = filterEntries(entries, 'all', 'chrome');
    assert.equal(appResults.length, 1);
    assert.equal(appResults[0].id, '2');
  });

  test('Compound filter respects both active chip and search query', () => {
    // Both entries 1 and 4 are pinned, but only entry 1 is text/code matching 'users'
    const compoundResults = filterEntries(entries, 'pinned', 'users');
    assert.equal(compoundResults.length, 1);
    assert.equal(compoundResults[0].id, '1');

    // Searching 'notion' under pinned should yield empty
    const noResults = filterEntries(entries, 'pinned', 'notion');
    assert.equal(noResults.length, 0);
  });

  test('Newest-first ordering is preserved across filtering', () => {
    const all = filterEntries(entries, 'all', '');
    assert.equal(all[0].id, '5'); // 2026-11-23T09:00:00Z
    assert.equal(all[1].id, '4'); // 2026-11-23T08:00:00Z
    assert.equal(all[2].id, '3'); // 2026-11-22
    assert.equal(all[3].id, '2'); // 2026-11-21
    assert.equal(all[4].id, '1'); // 2026-11-20
  });

  test('Multi-token case-insensitive search matches across content and source app', () => {
    // "datagrip users" matches entry 1
    const res = filterEntries(entries, 'all', 'datagrip users');
    assert.equal(res.length, 1);
    assert.equal(res[0].id, '1');

    // Case-insensitivity check: "CHROME LINEAR"
    const res2 = filterEntries(entries, 'all', 'CHROME LINEAR');
    assert.equal(res2.length, 1);
    assert.equal(res2[0].id, '2');
  });

  test('Pin toggle updates item pinned status', () => {
    const list = [...entries];
    const toggle = (id) => {
      const idx = list.findIndex((i) => i.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], isPinned: !list[idx].isPinned };
      }
    };

    assert.equal(list[1].isPinned, false);
    toggle('2');
    assert.equal(list[1].isPinned, true);
    toggle('2');
    assert.equal(list[1].isPinned, false);
  });
});
