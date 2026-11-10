/**
 * LucidClip Safe Process Cleanup Helper
 *
 * Provides safe, guarded process tree termination.
 * Strictly enforces that unrelated processes are NEVER killed.
 */

import { spawnSync } from 'node:child_process';
import { getProcessOnPort } from './process-info.mjs';
import { waitUntilPortFree } from './port-detector.mjs';

const isWindows = process.platform === 'win32';

/**
 * Terminates a process and all of its descendants safely.
 * @param {number} pid
 * @returns {boolean}
 */
export function killProcessTree(pid) {
  if (!pid || pid <= 1) return false;

  if (isWindows) {
    try {
      const res = spawnSync('taskkill', ['/pid', String(pid), '/f', '/t'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  // Unix / Linux / macOS:
  // First attempt to find and terminate children
  try {
    const pgrep = spawnSync('pgrep', ['-P', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (pgrep.stdout) {
      const childPids = pgrep.stdout
        .split('\n')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p) && p > 0);

      for (const childPid of childPids) {
        killProcessTree(childPid);
      }
    }
  } catch {
    // ignore
  }

  // Send SIGTERM, then SIGKILL if needed
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return true; // Already exited
  }

  // Brief delay to allow graceful shutdown
  const start = Date.now();
  while (Date.now() - start < 150) {
    try {
      process.kill(pid, 0); // test if still alive
    } catch {
      return true; // Process exited
    }
  }

  // If still alive, send SIGKILL
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process exited
  }

  return true;
}

/**
 * Attempts to safely clean up an occupied port IF AND ONLY IF
 * the process belongs to an orphaned LucidClip / Vite session.
 *
 * @param {number} port
 * @param {{ force?: boolean }} options
 * @returns {Promise<{ cleaned: boolean, reason?: string, process?: object }>}
 */
export async function safeCleanupOccupiedPort(port, { force = false } = {}) {
  const info = getProcessOnPort(port);

  if (!info.occupied || !info.process?.pid) {
    return { cleaned: false, reason: 'port_free' };
  }

  const proc = info.process;

  // STRICT SAFETY GUARD: Never kill unrelated processes!
  if (!proc.isLucidClip) {
    return {
      cleaned: false,
      reason: 'unrelated_process',
      process: proc,
    };
  }

  if (!force) {
    return {
      cleaned: false,
      reason: 'requires_force',
      process: proc,
    };
  }

  console.log(
    `[LucidClip] Safely stopping previous LucidClip development process (PID ${proc.pid})...`
  );

  killProcessTree(proc.pid);
  const isFree = await waitUntilPortFree(port, 3000, 100);

  return {
    cleaned: isFree,
    reason: isFree ? 'success' : 'failed_to_free',
    process: proc,
  };
}
