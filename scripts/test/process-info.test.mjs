import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { getProcessOnPort, getProcessDetails } from '../lib/process-info.mjs';

describe('Process Info Module Tests', () => {
  test('correctly identifies the current Node process when listening on a test port', async () => {
    const testPort = 39873;
    const server = net.createServer();

    await new Promise((resolve, reject) => {
      server.listen(testPort, '127.0.0.1', resolve);
      server.on('error', reject);
    });

    try {
      const info = getProcessOnPort(testPort);
      assert.equal(info.occupied, true);
      assert.equal(info.port, testPort);
      assert.ok(info.process, 'Process info must be populated');
      assert.equal(info.process.pid, process.pid);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    const after = getProcessOnPort(testPort);
    assert.equal(after.occupied, false);
  });

  test('returns safe empty result for non-existent PID', () => {
    const details = getProcessDetails(99999999);
    assert.equal(details.pid, 99999999);
    assert.equal(details.isLucidClip, false);
  });
});
