#!/usr/bin/env node

/**
 * LucidClip Unified Development Launcher
 *
 * Launches the Tauri desktop application with the Vite frontend.
 * Validates configuration and detects port conflicts before starting processes.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEV_SERVER_PORT,
  DEV_SERVER_URL,
  validatePortConfig,
} from './lib/config.mjs';
import { isPortAvailable } from './lib/port-detector.mjs';
import { getProcessOnPort } from './lib/process-info.mjs';
import { formatPortConflictError } from './lib/error-reporter.mjs';
import { safeCleanupOccupiedPort, killProcessTree } from './lib/process-cleanup.mjs';

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

async function main() {
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

  // 1. Validate that Vite and Tauri port configurations match
  const portConfig = validatePortConfig();
  if (!portConfig.valid) {
    fail(`Configuration error.\n${portConfig.errors.join('\n')}`);
  }

  // 2. Parse command-line flags
  const rawArgs = process.argv.slice(2);
  const wantsClean = rawArgs.includes('--clean') || rawArgs.includes('--force');
  const isDryRun = rawArgs.includes('--dry-run') || rawArgs.includes('--check');
  const tauriArgs = ['dev', ...rawArgs.filter((arg) =>
    arg !== '--clean' && arg !== '--force' && arg !== '--dry-run' && arg !== '--check'
  )];

  // 3. Pre-flight check: Detect port 1420 availability before launching Tauri
  const portStatus = await isPortAvailable(DEV_SERVER_PORT);

  if (!portStatus.available) {
    if (wantsClean) {
      console.log(`[LucidClip] Port ${DEV_SERVER_PORT} is busy. Attempting safe cleanup (--clean)...`);
      const cleanupResult = await safeCleanupOccupiedPort(DEV_SERVER_PORT, { force: true });
      if (cleanupResult.cleaned) {
        console.log(`[LucidClip] Successfully freed port ${DEV_SERVER_PORT}.\n`);
      } else {
        const conflict = getProcessOnPort(DEV_SERVER_PORT);
        console.error(formatPortConflictError(conflict));
        process.exit(1);
      }
    } else {
      // Diagnostic information and actionable error
      const conflict = getProcessOnPort(DEV_SERVER_PORT);
      console.error(formatPortConflictError(conflict));
      process.exit(1);
    }
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

  if (isDryRun) {
    console.log('[LucidClip] Pre-flight verification passed in dry-run mode.');
    console.log(`[LucidClip] Dev server port ${DEV_SERVER_PORT} is available.`);
    process.exit(0);
  }

  console.log(`[LucidClip] Repository: ${rootDir}`);
  console.log(`[LucidClip] Tauri app:  ${backendDir}`);
  console.log(`[LucidClip] Frontend:   ${frontendDir}`);
  console.log(`[LucidClip] Dev Server: ${DEV_SERVER_URL}`);
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

  function cleanupLeftoverDevServer() {
    const info = getProcessOnPort(DEV_SERVER_PORT);
    if (info.occupied && info.process?.isLucidClip && info.process?.pid) {
      try {
        killProcessTree(info.process.pid);
      } catch {
        // ignore
      }
    }
  }

  function terminate(signal = 'SIGINT') {
    if (shuttingDown) return;
    shuttingDown = true;

    if (child && child.pid) {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
      } else {
        try {
          process.kill(-child.pid, signal);
        } catch {
          try {
            child.kill(signal);
          } catch {
            // Process already exited
          }
        }
      }
    }

    // Clean up any detached or orphaned Vite server that Tauri might have spawned
    cleanupLeftoverDevServer();

    setTimeout(() => {
      cleanupLeftoverDevServer();
      process.exit(0);
    }, 500).unref();
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => terminate(signal));
  }

  process.on('exit', () => {
    cleanupLeftoverDevServer();
  });

  process.on('uncaughtException', (err) => {
    console.error('[LucidClip] Uncaught exception in launcher:', err);
    terminate('SIGTERM');
  });

  child.on('error', (err) => {
    cleanupLeftoverDevServer();
    fail(`Failed to start the Tauri process: ${err.message}`);
  });

  child.on('close', (code, signal) => {
    // When Tauri process terminates, guarantee no orphaned Vite server remains
    cleanupLeftoverDevServer();

    if (shuttingDown) {
      return;
    }
    if (code !== 0) {
      console.warn(`[LucidClip] Development session exited with status ${code ?? signal}.`);
    }
    process.exit(code ?? (signal ? 1 : 0));
  });
}

main().catch((err) => {
  console.error('[LucidClip] Fatal error in development launcher:', err);
  process.exit(1);
});
