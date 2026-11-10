import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEV_SERVER_PORT,
  getTauriDevPort,
  getViteDevPort,
  validatePortConfig,
  frontendDir,
} from '../lib/config.mjs';

describe('Vite and Tauri Port Synchronization Tests', () => {
  test('Tauri devUrl port matches canonical DEV_SERVER_PORT', () => {
    const tauriPort = getTauriDevPort();
    assert.equal(tauriPort, DEV_SERVER_PORT, `Tauri must be configured for port ${DEV_SERVER_PORT}`);
  });

  test('Vite server.port matches canonical DEV_SERVER_PORT', () => {
    const vitePort = getViteDevPort();
    assert.equal(vitePort, DEV_SERVER_PORT, `Vite must be configured for port ${DEV_SERVER_PORT}`);
  });

  test('Vite config has strictPort enabled to prevent silent port shifting', () => {
    const viteConfig = fs.readFileSync(path.join(frontendDir, 'vite.config.ts'), 'utf8');
    assert.match(viteConfig, /strictPort:\s*true/, 'Vite must set strictPort: true');
  });

  test('validatePortConfig returns valid:true when configs are synchronized', () => {
    const result = validatePortConfig();
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.expected, DEV_SERVER_PORT);
    assert.equal(result.vitePort, DEV_SERVER_PORT);
    assert.equal(result.tauriPort, DEV_SERVER_PORT);
  });
});
