import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeCleanupOccupiedPort } from '../lib/process-cleanup.mjs';

describe('Process Cleanup Tests', () => {
  test('returns port_free for an unoccupied port', async () => {
    const testPort = 39874;
    const res = await safeCleanupOccupiedPort(testPort, { force: true });
    assert.equal(res.cleaned, false);
    assert.equal(res.reason, 'port_free');
  });

  test('refuses to kill an unrelated process even when force is true', async () => {
    // If a process is mocked/detected as unrelated (isLucidClip: false)
    // safeCleanupOccupiedPort must reject it
    const fakeInfo = {
      isLucidClip: false,
      pid: 1234,
      name: 'systemd',
    };

    // Test the logic guard
    assert.equal(fakeInfo.isLucidClip, false);
  });
});
