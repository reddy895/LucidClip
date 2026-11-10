import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatPortConflictError } from '../lib/error-reporter.mjs';

describe('Error Reporter Tests', () => {
  test('formats detailed message for LucidClip process conflict', () => {
    const formatted = formatPortConflictError({
      port: 1420,
      process: {
        pid: 12345,
        name: 'node',
        command: 'node .../vite',
        cwd: '/path/to/LucidClip/frontend',
        isLucidClip: true,
      },
    });

    assert.ok(formatted.includes('Port 1420 is already in use'));
    assert.ok(formatted.includes('Process ID:      12345'));
    assert.ok(formatted.includes('node'));
    assert.ok(formatted.includes('--clean'));
  });

  test('formats protective message for external process conflict', () => {
    const formatted = formatPortConflictError({
      port: 1420,
      process: {
        pid: 54321,
        name: 'nginx',
        command: 'nginx -g daemon off;',
        cwd: '/etc/nginx',
        isLucidClip: false,
      },
    });

    assert.ok(formatted.includes('External application (Protected: will not be terminated automatically)'));
    assert.ok(!formatted.includes('--clean'));
    assert.ok(formatted.includes('54321'));
  });
});

