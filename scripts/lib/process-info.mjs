/**
 * LucidClip Cross-Platform Process Identification
 *
 * Discovers process ID, name, command line, and working directory
 * for any process listening on a given network port.
 * Works across Windows, Linux, and macOS without third-party dependencies.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';

/**
 * Discovers the process ID listening on a given TCP port.
 * @param {number} port
 * @returns {number|null}
 */
export function getPidOnPort(port) {
  if (isWindows) {
    try {
      const netstat = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });

      if (!netstat.stdout) return null;

      // Look for lines like: TCP    127.0.0.1:1420    0.0.0.0:0    LISTENING    1234
      const lines = netstat.stdout.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (
          trimmed.includes(`:${port}`) &&
          trimmed.toUpperCase().includes('LISTENING')
        ) {
          const parts = trimmed.split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(pid) && pid > 0) {
            return pid;
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  // Linux / macOS: Try lsof first
  try {
    const lsof = spawnSync('lsof', [
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
      '-n',
      '-P',
      '-Fp',
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (lsof.stdout) {
      const match = lsof.stdout.match(/p(\d+)/);
      if (match) {
        const pid = parseInt(match[1], 10);
        if (!isNaN(pid)) return pid;
      }
    }
  } catch {
    // fallback to ss or fuser
  }

  // Fallback: ss on Linux
  try {
    const ss = spawnSync('ss', ['-tulpn'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (ss.stdout) {
      const lines = ss.stdout.split('\n');
      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          const pidMatch = line.match(/pid=(\d+)/);
          if (pidMatch) {
            const pid = parseInt(pidMatch[1], 10);
            if (!isNaN(pid)) return pid;
          }
        }
      }
    }
  } catch {
    // fallback
  }

  // Fallback: fuser
  try {
    const fuser = spawnSync('fuser', [`${port}/tcp`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (fuser.stdout) {
      const match = fuser.stdout.trim().match(/(\d+)/);
      if (match) {
        const pid = parseInt(match[1], 10);
        if (!isNaN(pid)) return pid;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Retrieves detailed process information for a given PID.
 * @param {number} pid
 * @returns {{ pid: number, name?: string, command?: string, cwd?: string, isLucidClip: boolean }}
 */
export function getProcessDetails(pid) {
  if (!pid || typeof pid !== 'number' || pid <= 0) {
    return { pid, isLucidClip: false };
  }

  let name = '';
  let command = '';
  let cwd = '';

  if (isWindows) {
    try {
      const tasklist = spawnSync('tasklist', [
        '/fi',
        `PID eq ${pid}`,
        '/fo',
        'csv',
        '/nh',
      ], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });

      if (tasklist.stdout) {
        // "node.exe","1234","Console","1","50,000 K"
        const parts = tasklist.stdout.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
        if (parts.length > 0 && parts[0]) {
          name = parts[0];
        }
      }
    } catch {
      // ignore
    }

    // Try PowerShell for full command line on Windows
    try {
      const ps = spawnSync('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
      ], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      if (ps.stdout) {
        command = ps.stdout.trim();
      }
    } catch {
      // ignore
    }
  } else {
    // Linux / Unix: check /proc or ps
    try {
      if (fs.existsSync(`/proc/${pid}/cmdline`)) {
        const cmdlineBytes = fs.readFileSync(`/proc/${pid}/cmdline`);
        command = cmdlineBytes.toString().replace(/\0+/g, ' ').trim();
      }
    } catch {
      // ignore
    }

    try {
      if (fs.existsSync(`/proc/${pid}/cwd`)) {
        cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      }
    } catch {
      // ignore
    }

    if (!command || !name) {
      try {
        const ps = spawnSync('ps', ['-fp', String(pid), '-o', 'comm=,args='], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        if (ps.stdout) {
          const firstLine = ps.stdout.trim().split('\n')[0] || '';
          const parts = firstLine.split(/\s+/);
          name = parts[0] || '';
          if (!command) command = firstLine;
        }
      } catch {
        // ignore
      }
    }
  }

  // Determine if this process belongs to a LucidClip development server.
  // Must be an active Vite or Tauri development server process, and must never be self.
  const isSelf = pid === process.pid || pid === process.ppid;
  const normalizedCommand = command.toLowerCase();
  const normalizedCwd = cwd.toLowerCase();

  const isDevServerCommand =
    normalizedCommand.includes('vite') ||
    normalizedCommand.includes('tauri') ||
    (normalizedCommand.includes('lucidclip') &&
      !normalizedCommand.includes('test') &&
      !normalizedCommand.includes('git'));

  const isDevServerCwd =
    normalizedCwd.endsWith('frontend') ||
    normalizedCwd.endsWith('backend') ||
    normalizedCwd.endsWith('lucidclip');

  const isLucidClip = !isSelf && isDevServerCommand && isDevServerCwd;

  return {
    pid,
    name: name || undefined,
    command: command || undefined,
    cwd: cwd || undefined,
    isLucidClip,
  };
}

/**
 * Resolves full information for whatever process is currently bound to a port.
 * @param {number} port
 * @returns {{ occupied: boolean, port: number, process?: { pid: number, name?: string, command?: string, cwd?: string, isLucidClip: boolean } }}
 */
export function getProcessOnPort(port) {
  const pid = getPidOnPort(port);
  if (!pid) {
    return { occupied: false, port };
  }

  const details = getProcessDetails(pid);
  return {
    occupied: true,
    port,
    process: details,
  };
}
