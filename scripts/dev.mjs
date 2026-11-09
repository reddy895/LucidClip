#!/usr/bin/env node

/**
 * LucidClip Unified Development Launcher
 *
 * Launches the Tauri desktop application with the Vite frontend.
 * All paths are resolved from this file, so the launcher behaves the same when
 * invoked from the repository root or from a subdirectory.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const isWindows = process.platform === 'win32';

function fail(message) {
  console.error(`\n[LucidClip] ${message}\n`);
  process.exit(1);
}

function commandAvailable(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    shell: isWindows,
  });
  return !result.error && result.status === 0;
}

function requireFile(filePath, hint) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${filePath}.\n${hint}`);
  }
}

console.log('----------------------------------------------------');
console.log(' LucidClip Desktop Development Launcher');
console.log(' Starting Vite frontend & Tauri 2 backend...');
console.log('----------------------------------------------------\n');

requireFile(
  path.join(frontendDir, 'package.json'),
  'The frontend workspace must live inside this repository. Run `npm install` from the repository root.'
);
requireFile(
  path.join(backendDir, 'Cargo.toml'),
  'The Rust backend is missing. Restore the `backend` directory before starting the application.'
);
requireFile(
  path.join(backendDir, 'tauri.conf.json'),
  'The Tauri configuration is missing from `backend/tauri.conf.json`.'
);

if (!commandAvailable(isWindows ? 'npm.cmd' : 'npm')) {
  fail('npm is not available on PATH. Install Node.js 20+ from https://nodejs.org and reopen the terminal.');
}
if (!commandAvailable(isWindows ? 'cargo.exe' : 'cargo')) {
  fail('cargo is not available on PATH. Install the Rust toolchain from https://rustup.rs and reopen the terminal.');
}
if (!commandAvailable(isWindows ? 'rustc.exe' : 'rustc')) {
  fail('rustc is not available on PATH. Install the Rust toolchain from https://rustup.rs and reopen the terminal.');
}

const tauriBinary = path.join(
  rootDir,
  'node_modules',
  '.bin',
  isWindows ? 'tauri.cmd' : 'tauri'
);
if (!fs.existsSync(tauriBinary)) {
  fail('The Tauri CLI is not installed. Run `npm install` from the repository root first.');
}

const tauriArgs = ['dev', ...process.argv.slice(2)];

console.log(`[LucidClip] Repository: ${rootDir}`);
console.log(`[LucidClip] Tauri app:  ${backendDir}`);
console.log(`[LucidClip] Frontend:   ${frontendDir}`);
console.log(`[LucidClip] Node:       ${process.versions.node}\n`);

const child = spawn(tauriBinary, tauriArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: isWindows,
  detached: !isWindows,
  env: {
    ...process.env,
    RUST_BACKTRACE: process.env.RUST_BACKTRACE || '1',
  },
});

let shuttingDown = false;

function terminate(signal = 'SIGINT') {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!child.pid) {
    process.exit(0);
  }

  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // The process already exited.
      }
    }
  }

  setTimeout(() => process.exit(0), 1500).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => terminate(signal));
}

child.on('error', (err) => {
  fail(`Failed to start the Tauri process: ${err.message}`);
});

child.on('close', (code, signal) => {
  if (shuttingDown) {
    return;
  }
  if (code !== 0) {
    console.warn(`[LucidClip] Development session exited with status ${code ?? signal}.`);
  }
  process.exit(code ?? (signal ? 1 : 0));
});
