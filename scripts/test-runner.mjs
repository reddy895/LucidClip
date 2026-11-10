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
import { createRequire } from 'node:module';
import { validateProjectLayout } from './check-layout.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

const requireFromFrontend = createRequire(path.join(rootDir, 'frontend/package.json'));

async function loadTsModule(relativePath) {
  const ts = requireFromFrontend('typescript');
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

describe('LucidClip Core Integrity Verification', () => {

  test('Project layout and launcher contracts are valid', () => {
    const errors = validateProjectLayout(rootDir);
    assert.deepEqual(errors, [], `Layout validation failed:\n${errors.join('\n')}`);
  });

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
    assert.ok(
      !shotServiceSrc.includes('data:image/svg'),
      'MockScreenshotService must not fabricate screenshot images'
    );
    assert.ok(
      !shotServiceSrc.includes('OCR Result'),
      'MockScreenshotService must not fabricate OCR output'
    );
  });

  test('Screenshot IPC surface: capture, crop, copy, and export are registered', () => {
    const libSource = fs.readFileSync(path.join(backendDir, 'src/lib.rs'), 'utf8');
    for (const command of [
      'commands::capture_screenshot',
      'commands::crop_screenshot',
      'commands::copy_screenshot_image',
      'commands::export_screenshot',
    ]) {
      assert.ok(
        libSource.includes(command),
        `${command} must be registered in the Tauri invoke handler`
      );
    }

    const migrationSource = fs.readFileSync(
      path.join(backendDir, 'src/database/migrations.rs'),
      'utf8'
    );
    assert.ok(
      migrationSource.includes("ADD COLUMN capture_type"),
      'Screenshots must persist the real capture type'
    );

    const serviceSource = fs.readFileSync(
      path.join(rootDir, 'frontend/src/services/tauri/TauriScreenshotService.ts'),
      'utf8'
    );
    for (const ipc of ["'capture_screenshot'", "'crop_screenshot'", "'copy_screenshot_image'", "'export_screenshot'"]) {
      assert.ok(serviceSource.includes(ipc), `Tauri screenshot service must invoke ${ipc}`);
    }
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

  test('Tray lifecycle keeps the backend alive when the main window closes', () => {
    const cargoSource = fs.readFileSync(path.join(backendDir, 'Cargo.toml'), 'utf8');
    assert.ok(
      cargoSource.includes('"tray-icon"'),
      'Tauri must enable the tray-icon feature'
    );

    const libSource = fs.readFileSync(path.join(backendDir, 'src/lib.rs'), 'utf8');
    for (const marker of [
      'TrayIconBuilder',
      'WindowEvent::CloseRequested',
      'api.prevent_close()',
      'window_for_event.hide()',
      '"show" => show_main_window(app)',
      '"quit" => app.exit(0)',
    ]) {
      assert.ok(libSource.includes(marker), `Tray lifecycle must include ${marker}`);
    }
  });

  test('Tauri 2 IPC Capabilities: default capability file exists and restricts permissions', () => {
    const capPath = path.join(backendDir, 'capabilities/default.json');
    assert.ok(fs.existsSync(capPath), 'Tauri 2 capabilities/default.json must exist');
    const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    assert.equal(cap.identifier, 'default');
    assert.ok(Array.isArray(cap.permissions), 'Permissions must be an array');
    assert.ok(cap.permissions.includes('core:default'), 'Must declare core:default');
  });

  test('Native clipboard surface: notifications, media capture, and restore are wired', () => {
    const watcherPath = path.join(backendDir, 'src/platform/clipboard_watcher.rs');
    assert.ok(fs.existsSync(watcherPath), 'Native clipboard watcher must exist');
    const watcherSource = fs.readFileSync(watcherPath, 'utf8');
    for (const marker of ['AddClipboardFormatListener', 'WM_CLIPBOARDUPDATE']) {
      assert.ok(watcherSource.includes(marker), `Clipboard watcher must use ${marker}`);
    }

    const monitorSource = fs.readFileSync(
      path.join(backendDir, 'src/clipboard/monitor.rs'),
      'utf8'
    );
    for (const marker of [
      'read_clipboard_snapshot',
      'ClipboardSnapshot::Image',
      'ClipboardSnapshot::Files',
    ]) {
      assert.ok(monitorSource.includes(marker), `Monitor must handle ${marker}`);
    }

    const platformSource = fs.readFileSync(
      path.join(backendDir, 'src/platform/clipboard.rs'),
      'utf8'
    );
    for (const marker of ['CF_HDROP', 'CF_DIBV5', 'build_dropfiles', 'parse_dib']) {
      assert.ok(platformSource.includes(marker), `Clipboard platform must define ${marker}`);
    }

    const migrationSource = fs.readFileSync(
      path.join(backendDir, 'src/database/migrations.rs'),
      'utf8'
    );
    for (const column of ['image_path', 'thumbnail_path', 'image_width', 'image_height', 'byte_size', 'file_count']) {
      assert.ok(
        migrationSource.includes(`ADD COLUMN ${column}`),
        `Clipboard media migration must add ${column}`
      );
    }

    const libSource = fs.readFileSync(path.join(backendDir, 'src/lib.rs'), 'utf8');
    assert.ok(
      libSource.includes('commands::copy_clipboard_entry_by_id'),
      'Restore-by-id command must be registered'
    );

    const frontendService = fs.readFileSync(
      path.join(rootDir, 'frontend/src/services/tauri/TauriClipboardService.ts'),
      'utf8'
    );
    for (const marker of ['image_path', 'thumbnail_path', 'convertFileSrc', 'copy_clipboard_entry_by_id']) {
      assert.ok(frontendService.includes(marker), `Frontend clipboard service must use ${marker}`);
    }
  });

  test('Clipboard event envelope validation rejects malformed payloads', async () => {
    const sync = await loadTsModule('frontend/src/utils/clipboardSync.ts');

    const entry = {
      id: 'clip-1',
      content: 'hello',
      content_type: 'plain',
      content_hash: 'abc123',
      created_at: 1_700_000_000_000,
      pinned: false,
      favorite: false,
      source_app: 'Terminal',
    };

    const valid = sync.validateClipboardEventPayload({ version: 1, entry });
    assert.deepEqual(valid, entry, 'Versioned envelope with a valid entry must pass');

    const legacy = sync.validateClipboardEventPayload(entry);
    assert.deepEqual(legacy, entry, 'Legacy direct entry payload must pass');

    assert.equal(
      sync.validateClipboardEventPayload({ version: sync.CLIPBOARD_EVENT_VERSION + 1, entry }),
      null,
      'Future envelope versions must be ignored'
    );
    assert.equal(sync.validateClipboardEventPayload({ version: 1 }), null);
    assert.equal(sync.validateClipboardEventPayload({ version: 1, entry: null }), null);
    assert.equal(sync.validateClipboardEventPayload(null), null);
    assert.equal(
      sync.validateClipboardEventPayload({ version: 1, entry: { ...entry, id: '' } }),
      null,
      'Entries without an id must be rejected'
    );
    assert.equal(
      sync.validateClipboardEventPayload({ version: 1, entry: { ...entry, created_at: 'now' } }),
      null,
      'Entries with a non-numeric timestamp must be rejected'
    );
    assert.equal(
      sync.validateClipboardEventPayload({ version: 1, entry: { ...entry, pinned: 'no' } }),
      null,
      'Entries with non-boolean flags must be rejected'
    );
  });

  test('Clipboard history merge deduplicates, orders, and respects limits', async () => {
    const sync = await loadTsModule('frontend/src/utils/clipboardSync.ts');
    const make = (id, iso, content = id) => ({
      id,
      content,
      contentType: 'plain',
      language: null,
      charCount: content.length,
      wordCount: 1,
      lineCount: 1,
      sourceApp: 'Test',
      isPinned: false,
      isFavorite: false,
      createdAt: iso,
      updatedAt: iso,
    });

    const older = make('a', '2024-01-01T00:00:00.000Z');
    const newer = make('b', '2024-01-02T00:00:00.000Z');
    const sameTimeA = make('a2', '2024-01-03T00:00:00.000Z');
    const sameTimeB = make('b2', '2024-01-03T00:00:00.000Z');

    const merged = sync.mergeClipboardEntry([older, sameTimeA], newer);
    assert.deepEqual(
      merged.map((entry) => entry.id),
      ['a2', 'b', 'a'],
      'Newest entries must sort first'
    );

    const tie = sync.mergeClipboardEntry([sameTimeA], sameTimeB);
    assert.deepEqual(
      tie.map((entry) => entry.id),
      ['b2', 'a2'],
      'Equal timestamps must break ties by id descending'
    );

    const deduped = sync.mergeClipboardEntry([older, newer], {
      ...older,
      content: 'updated',
    });
    assert.equal(deduped.length, 2, 'Merging an existing id must not duplicate it');
    assert.equal(deduped.find((entry) => entry.id === 'a').content, 'updated');

    const capped = sync.mergeClipboardEntry([older, newer, sameTimeA], sameTimeB, 2);
    assert.equal(capped.length, 2, 'The configured history cap must be enforced');
  });

  test('Clipboard IPC surface: diagnostics, monitor status, pause, and manual capture', () => {
    const libSource = fs.readFileSync(path.join(backendDir, 'src/lib.rs'), 'utf8');
    for (const command of [
      'commands::get_clipboard_diagnostics',
      'commands::get_monitor_status',
      'commands::set_monitoring_enabled',
      'commands::capture_clipboard_now',
    ]) {
      assert.ok(libSource.includes(command), `${command} must be registered in the invoke handler`);
    }

    const commandsSource = fs.readFileSync(path.join(backendDir, 'src/commands/mod.rs'), 'utf8');
    for (const command of [
      'get_clipboard_diagnostics',
      'get_monitor_status',
      'set_monitoring_enabled',
      'capture_clipboard_now',
    ]) {
      assert.ok(commandsSource.includes(command), `Backend must implement ${command}`);
    }

    const eventsSource = fs.readFileSync(path.join(backendDir, 'src/clipboard/events.rs'), 'utf8');
    for (const marker of ['CLIPBOARD_CAPTURED_EVENT', 'CLIPBOARD_STATUS_EVENT', 'version']) {
      assert.ok(eventsSource.includes(marker), `Clipboard events must define ${marker}`);
    }

    const serviceSource = fs.readFileSync(
      path.join(rootDir, 'frontend/src/services/tauri/TauriClipboardService.ts'),
      'utf8'
    );
    for (const ipc of [
      "'get_clipboard_diagnostics'",
      "'get_monitor_status'",
      "'set_monitoring_enabled'",
      "'capture_clipboard_now'",
    ]) {
      assert.ok(serviceSource.includes(ipc), `Tauri clipboard service must invoke ${ipc}`);
    }

    const contextSource = fs.readFileSync(
      path.join(rootDir, 'frontend/src/context/AppContext.tsx'),
      'utf8'
    );
    for (const marker of [
      'validateClipboardEventPayload',
      'mergeClipboardEntry',
      'CLIPBOARD_STATUS_EVENT_NAME',
    ]) {
      assert.ok(contextSource.includes(marker), `AppContext must use ${marker}`);
    }
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
