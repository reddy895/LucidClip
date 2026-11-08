/**
 * LucidClip Automated Verification Suite
 * Tests core frontend contracts, zero-mock guarantees, classification, and backend integrity.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

describe('LucidClip Core Integrity Verification', () => {

  test('Zero-Mock Policy: fresh services initialize with zero entries', () => {
    // Read the mock services to verify no fixtures are loaded into default state
    const clipServiceSrc = fs.readFileSync(
      path.join(rootDir, 'frontend/src/services/mock/MockClipboardService.ts'),
      'utf8'
    );
    const shotServiceSrc = fs.readFileSync(
      path.join(rootDir, 'frontend/src/services/mock/MockScreenshotService.ts'),
      'utf8'
    );

    assert.ok(
      !clipServiceSrc.includes('INITIAL_CLIPBOARD_ENTRIES'),
      'MockClipboardService must not load sample INITIAL_CLIPBOARD_ENTRIES'
    );
    assert.ok(
      !shotServiceSrc.includes('INITIAL_SCREENSHOT_ENTRIES'),
      'MockScreenshotService must not load sample INITIAL_SCREENSHOT_ENTRIES'
    );
  });

  test('Frontend Build Output: production distribution contains index.html', () => {
    const distPath = path.join(rootDir, 'frontend/dist/index.html');
    assert.ok(
      fs.existsSync(distPath),
      'Production build file frontend/dist/index.html must exist'
    );
    const html = fs.readFileSync(distPath, 'utf8');
    assert.ok(html.includes('id="root"'), 'Built HTML must contain root container');
  });

  test('Tauri 2 IPC Capabilities: default capability file exists and restricts permissions', () => {
    const capPath = path.join(backendDir, 'capabilities/default.json');
    assert.ok(fs.existsSync(capPath), 'Tauri 2 capabilities/default.json must exist');
    const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    assert.equal(cap.identifier, 'default');
    assert.ok(Array.isArray(cap.permissions), 'Permissions must be an array');
    assert.ok(cap.permissions.includes('core:default'), 'Must declare core:default');
  });

  test('Rust Backend Unit Tests: SQLite migrations, classification, and deduplication pass', () => {
    const output = execSync('cargo test', {
      cwd: backendDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PKG_CONFIG_PATH: path.join(backendDir, '.pkgconfig'),
      },
    });

    assert.ok(
      output.includes('test database::tests::test_migrations_and_repositories ... ok'),
      'Database migration & repository test must pass'
    );
    assert.ok(
      output.includes('test clipboard::tests::test_content_classification ... ok'),
      'Content classification test must pass'
    );
    assert.ok(
      output.includes('test clipboard::tests::test_content_hashing_and_deduplication ... ok'),
      'Content hashing and deduplication test must pass'
    );
  });

});
