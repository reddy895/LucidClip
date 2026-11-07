#!/usr/bin/env node

/**
 * LucidClip Unified Development Launcher
 * Launches the Tauri desktop application with hot-reloading Vite frontend.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('----------------------------------------------------');
console.log(' LucidClip Desktop Development Launcher');
console.log(' Starting Vite frontend & Tauri 2 backend...');
console.log('----------------------------------------------------\n');

const child = spawn(npxCmd, ['tauri', 'dev'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    RUST_BACKTRACE: '1',
  },
});

child.on('error', (err) => {
  console.error('[LucidClip] Failed to start Tauri process:', err);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.warn(`[LucidClip] Process exited with status code ${code}`);
  }
  process.exit(code ?? 0);
});

const cleanup = () => {
  if (child && !child.killed) {
    if (isWindows) {
      spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
    } else {
      child.kill('SIGINT');
    }
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
