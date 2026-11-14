import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.resolve(path.dirname(__filename), '..');
const rootDir = path.resolve(scriptsDir, '..');
const devScript = path.join(scriptsDir, 'dev.mjs');

describe('Launcher Lifecycle and Conflict Tests', () => {
  test('dev launcher detects active conflict and exits with code 1 without starting Tauri', async () => {
    // Occupy port 1420 to reliably test the pre-flight conflict detection path
    const server = net.createServer();
    let portOccupied = false;

    try {
      await new Promise((resolve, reject) => {
        server.listen(1420, '127.0.0.1', () => {
          portOccupied = true;
          resolve();
        });
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            // Already occupied by another process, proceed to test
            resolve();
          } else {
            reject(err);
          }
        });
      });

      const result = spawnSync(process.execPath, [devScript], {
        cwd: rootDir,
        encoding: 'utf8',
        env: { ...process.env, CI: 'true' },
        timeout: 5000,
      });

      assert.equal(result.status, 1, 'Launcher must exit with code 1 on conflict');
      assert.match(result.stderr, /\[LucidClip\] Development Server Port Conflict Detected/);
      assert.match(result.stderr, /Target Port:\s+1420/);
      assert.match(result.stderr, /Diagnostic Information:/);
      assert.match(result.stderr, /How to resolve:/);
    } finally {
      if (portOccupied) {
        await new Promise((resolve) => server.close(resolve));
      }
    }
  });

  test('launcher cleanly validates arguments and environment without throwing unhandled exceptions', () => {
    const result = spawnSync(process.execPath, [devScript, '--help'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
      timeout: 5000,
    });

    // Ensure it did not crash with unhandled exception or stack trace
    assert.doesNotMatch(result.stderr, /UnhandledPromiseRejection/);
    assert.doesNotMatch(result.stderr, /ReferenceError/);
    assert.doesNotMatch(result.stderr, /SyntaxError/);
  });

  test('killProcessTree terminates spawned test child processes cleanly', async () => {
    const { killProcessTree } = await import('../lib/process-cleanup.mjs');

    // Spawn a long-running dummy process
    const dummy = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });

    assert.ok(dummy.pid > 0);

    // Verify it is alive
    let isAlive = false;
    try {
      process.kill(dummy.pid, 0);
      isAlive = true;
    } catch {
      isAlive = false;
    }
    assert.equal(isAlive, true);

    // Terminate via killProcessTree
    const killed = killProcessTree(dummy.pid);
    assert.equal(killed, true);

    // Allow process to terminate
    await new Promise((r) => setTimeout(r, 200));

    // Verify it is now dead
    let isDead = false;
    try {
      process.kill(dummy.pid, 0);
    } catch {
      isDead = true;
    }
    assert.equal(isDead, true);
  });
});

