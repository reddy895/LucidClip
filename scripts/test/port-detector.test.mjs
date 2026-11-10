import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { isPortAvailable, checkSingleHostPort } from '../lib/port-detector.mjs';

describe('Port Availability Detector Tests', () => {
  test('returns available=true for an unused random high port', async () => {
    // Pick an ephemeral port range
    const testPort = 39871;
    const result = await isPortAvailable(testPort);
    assert.equal(result.available, true);
    assert.equal(result.port, testPort);
  });

  test('detects when a TCP port is occupied', async () => {
    const testPort = 39872;
    const server = net.createServer();

    await new Promise((resolve, reject) => {
      server.listen(testPort, '127.0.0.1', resolve);
      server.on('error', reject);
    });

    try {
      const result = await isPortAvailable(testPort);
      assert.equal(result.available, false);
      assert.equal(result.port, testPort);
      assert.equal(result.occupiedOn, '127.0.0.1');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    // Verify it becomes available again after server closes
    const afterClose = await isPortAvailable(testPort);
    assert.equal(afterClose.available, true);
  });
});

