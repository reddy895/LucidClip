import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Text History vs Screenshot Gallery View Separation Tests', () => {
  const sampleEntries = [
    { id: '1', content: 'const x = 42;', contentType: 'code', sourceApp: 'VS Code' },
    { id: '2', content: 'https://example.com', contentType: 'url', sourceApp: 'Firefox' },
    { id: '3', content: 'Standard clipboard text line', contentType: 'text', sourceApp: 'Terminal' },
    { id: '4', content: '{"key": "value"}', contentType: 'json', sourceApp: 'Postman' },
    { id: '5', content: '/usr/local/bin/lucidclip', contentType: 'path', sourceApp: 'Terminal' },
    { id: '6', content: 'FileA.png\nFileB.txt', contentType: 'files', sourceApp: 'Nautilus', fileCount: 2 },
    {
      id: '7',
      content: '',
      contentType: 'image',
      sourceApp: 'Flameshot',
      imagePath: '/data/screenshots/originals/7.png',
      thumbnailPath: '/data/screenshots/thumbnails/7.png',
      imageWidth: 1920,
      imageHeight: 1080,
    },
  ];

  function isTextClipboardEntry(entry) {
    return entry.contentType !== 'image';
  }

  function isClipboardImageEntry(entry) {
    return entry.contentType === 'image';
  }

  function selectTextEntries(entries) {
    return entries.filter(isTextClipboardEntry);
  }

  function selectClipboardImages(entries) {
    return entries.filter(isClipboardImageEntry);
  }

  test('selectTextEntries excludes raw image entries and keeps all text/code/file varieties', () => {
    const textOnly = selectTextEntries(sampleEntries);
    assert.equal(textOnly.length, 6);
    assert.ok(textOnly.every((e) => e.contentType !== 'image'));
    assert.ok(textOnly.some((e) => e.contentType === 'code'));
    assert.ok(textOnly.some((e) => e.contentType === 'url'));
    assert.ok(textOnly.some((e) => e.contentType === 'files'));
    assert.ok(textOnly.some((e) => e.contentType === 'path'));
  });

  test('selectClipboardImages isolates image entries for screenshot gallery integration', () => {
    const imagesOnly = selectClipboardImages(sampleEntries);
    assert.equal(imagesOnly.length, 1);
    assert.equal(imagesOnly[0].id, '7');
    assert.equal(imagesOnly[0].contentType, 'image');
    assert.equal(imagesOnly[0].imageWidth, 1920);
  });

  test('View separation ensures zero overlap between text history and screenshot gallery', () => {
    const textOnly = selectTextEntries(sampleEntries);
    const imagesOnly = selectClipboardImages(sampleEntries);

    const textIds = new Set(textOnly.map((e) => e.id));
    const imageIds = new Set(imagesOnly.map((e) => e.id));

    // Intersection must be completely empty
    for (const id of textIds) {
      assert.ok(!imageIds.has(id), `Entry ${id} appears in both text and screenshot views!`);
    }

    assert.equal(textIds.size + imageIds.size, sampleEntries.length);
  });
});
