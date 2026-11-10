import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { isPortAvailable, waitUntilPortFree } from '../lib/port-detector.mjs';
import { getProcessOnPort } from '../lib/process-info.mjs';
import { formatPortConflictError } from '../lib/error-reporter.mjs';
import { safeCleanupOccupiedPort } from '../lib/process-cleanup.mjs';

describe('Port Conflict Regression Tests', () => {
  const REGRESSION_PORT = 39880;

  test('full regression cycle: detects occupation, retrieves PID info, and formats actionable error', async () => {
    const server = net.createServer();

    await new Promise((resolve, reject) => {
      server.listen(REGRESSION_PORT, '127.0.0.1', resolve);
      server.on('error', reject);
    });

    try {
      // 1. Port availability detection
      const status = await isPortAvailable(REGRESSION_PORT);
      assert.equal(status.available, false, 'Port should be detected as occupied');
      assert.equal(status.port, REGRESSION_PORT);
      assert.equal(status.occupiedOn, '127.0.0.1');

      // 2. Process identification
      const procInfo = getProcessOnPort(REGRESSION_PORT);
      assert.equal(procInfo.occupied, true);
      assert.ok(procInfo.process, 'Process info should be present');
      assert.equal(procInfo.process.pid, process.pid, 'Should identify this test runner process');

      // 3. Diagnostic error message formatting
      const errorReport = formatPortConflictError(procInfo);
      assert.match(errorReport, new RegExp(`Port ${REGRESSION_PORT} is already in use`));
      assert.match(errorReport, new RegExp(`Process ID:\\s+${process.pid}`));
      assert.match(errorReport, /How to resolve:/);
      assert.match(errorReport, /node/i);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    // 4. Verify release
    const free = await waitUntilPortFree(REGRESSION_PORT, 2000, 50);
    assert.equal(free, true, 'Port should be free after server closure');
  });

  test('regression: protects unrelated foreign processes on occupied port from auto-termination', async () => {
    const foreignServer = net.createServer();

    await new Promise((resolve, reject) => {
      foreignServer.listen(REGRESSION_PORT, '127.0.0.1', resolve);
      foreignServer.on('error', reject);
    });

    try {
      // Even with force=true, safeCleanupOccupiedPort must refuse if not a confirmed LucidClip process
      // (The test runner process is node running test, not vite in LucidClip context)
      const cleanupResult = await safeCleanupOccupiedPort(REGRESSION_PORT, { force: true });
      assert.equal(cleanupResult.cleaned, false);
      assert.ok(
        cleanupResult.reason === 'unrelated_process' ||
        cleanupResult.reason === 'protected_self_process' ||
        cleanupResult.reason === 'protected_unrelated_process',
        `Expected protective reason, got: ${cleanupResult.reason}`
      );
    } finally {
      await new Promise((resolve) => foreignServer.close(resolve));
    }
  });

  test('regression: detects IPv6 localhost binding conflicts', async () => {
    const ipv6Server = net.createServer();

    let supportsIpv6 = true;
    try {
      await new Promise((resolve, reject) => {
        ipv6Server.listen(REGRESSION_PORT, '::1', resolve);
        ipv6Server.on('error', reject);
      });
    } catch {
      supportsIpv6 = false;
    }

    if (supportsIpv6) {
      try {
        const status = await isPortAvailable(REGRESSION_PORT);
        assert.equal(status.available, false, 'Port should be detected as occupied on ::1');
      } finally {
        await new Promise((resolve) => ipv6Server.close(resolve));
      }
    }
  });
});
