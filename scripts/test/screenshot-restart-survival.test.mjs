import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

describe('Screenshot Restart Survival and Relative Path Resolution Tests', () => {
  function simulatePathResolution(dbPath, currentScreenshotsDir) {
    if (!dbPath) return null;

    const base = path.basename(dbPath);
    // 1. If stored path is relative or basename, resolve against current root
    const resolvedCanonical = path.join(currentScreenshotsDir, base);

    // 2. If stored path was an obsolete absolute path from a prior run in another folder,
    // ensure basename migration safely maps it to current root
    return resolvedCanonical;
  }

  test('Canonical relative filename survives folder relocation across restarts', () => {
    const priorRunRelativePath = 'clip_1700000000000_abc123.png';
    const newSessionScreenshotsDir = '/home/user/.local/share/lucidclip/screenshots';

    const resolved = simulatePathResolution(priorRunRelativePath, newSessionScreenshotsDir);
    assert.equal(resolved, '/home/user/.local/share/lucidclip/screenshots/clip_1700000000000_abc123.png');
  });

  test('Obsolete absolute path from previous run migrates by basename', () => {
    const oldSessionAbsolutePath = '/tmp/old_lucidclip_session/screenshots/clip_1700000000000_abc123.png';
    const newSessionScreenshotsDir = '/home/user/.local/share/lucidclip/screenshots';

    const resolved = simulatePathResolution(oldSessionAbsolutePath, newSessionScreenshotsDir);
    assert.equal(resolved, '/home/user/.local/share/lucidclip/screenshots/clip_1700000000000_abc123.png');
  });

  test('Automatic thumbnail path generation derives consistently from original filename', () => {
    const originalFile = 'clip_test_123.png';
    const expectedThumb = 'clip_test_123_thumb.png';

    const deriveThumb = (file) => file.replace(/\.png$/i, '_thumb.png');
    assert.equal(deriveThumb(originalFile), expectedThumb);
  });
});
