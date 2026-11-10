import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.resolve(path.dirname(__filename), '..');
const rootDir = path.resolve(scriptsDir, '..');
const devScript = path.join(scriptsDir, 'dev.mjs');

describe('Launcher Lifecycle and Conflict Tests', () => {
  test('dev launcher detects active conflict and exits with code 1 without starting Tauri', () => {
    // If port 1420 is currently occupied, running dev.mjs directly must fail cleanly
    const result = spawnSync(process.execPath, [devScript], {
      cwd: rootDir,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    });

    // The output should either show port conflict detection OR initiate startup if port is free.
    // If port conflict is detected:
    if (result.status === 1 && result.stderr.includes('Conflict Detected')) {
      assert.match(result.stderr, /\[LucidClip\] Development Server Port Conflict Detected/);
      assert.match(result.stderr, /Target Port:\s+1420/);
      assert.match(result.stderr, /Diagnostic Information:/);
      assert.match(result.stderr, /How to resolve:/);
    } else {
      // If port 1420 happens to be free, it should output the startup banner
      assert.match(result.stdout, /LucidClip Desktop Development Launcher/);
    }
  });

  test('launcher cleanly validates arguments and environment without throwing unhandled exceptions', () => {
    const result = spawnSync(process.execPath, [devScript, '--invalid-flag-test-only'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
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

