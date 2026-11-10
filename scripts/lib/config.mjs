/**
 * LucidClip Development Server Configuration
 *
 * Central source of truth for the local development server port and URLs.
 * Ensures Vite and Tauri always use the same synchronized port.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
export const rootDir = path.resolve(path.dirname(__filename), '../..');
export const backendDir = path.join(rootDir, 'backend');
export const frontendDir = path.join(rootDir, 'frontend');

export const DEV_SERVER_PORT = 1420;
export const DEV_SERVER_HOST = '127.0.0.1';
export const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

/**
 * Reads the configured port from backend/tauri.conf.json.
 * @returns {number|null}
 */
export function getTauriDevPort() {
  const tauriConfPath = path.join(backendDir, 'tauri.conf.json');
  if (!fs.existsSync(tauriConfPath)) return null;

  try {
    const content = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    const devUrl = content?.build?.devUrl;
    if (!devUrl) return null;
    const url = new URL(devUrl);
    return parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80);
  } catch {
    return null;
  }
}

/**
 * Reads the configured port from frontend/vite.config.ts.
 * @returns {number|null}
 */
export function getViteDevPort() {
  const viteConfigPath = path.join(frontendDir, 'vite.config.ts');
  if (!fs.existsSync(viteConfigPath)) return null;

  try {
    const content = fs.readFileSync(viteConfigPath, 'utf8');
    const portMatch = content.match(/port:\s*(\d+)/);
    return portMatch ? parseInt(portMatch[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Verifies that Vite and Tauri configurations agree on the development port.
 * @returns {{ valid: boolean, expected: number, vitePort: number|null, tauriPort: number|null, errors: string[] }}
 */
export function validatePortConfig() {
  const tauriPort = getTauriDevPort();
  const vitePort = getViteDevPort();
  const errors = [];

  if (tauriPort === null) {
    errors.push('Could not determine devUrl port from backend/tauri.conf.json');
  } else if (tauriPort !== DEV_SERVER_PORT) {
    errors.push(
      `backend/tauri.conf.json devUrl is configured for port ${tauriPort}, but expected canonical port ${DEV_SERVER_PORT}.`
    );
  }

  if (vitePort === null) {
    errors.push('Could not determine server.port from frontend/vite.config.ts');
  } else if (vitePort !== DEV_SERVER_PORT) {
    errors.push(
      `frontend/vite.config.ts server.port is configured for port ${vitePort}, but expected canonical port ${DEV_SERVER_PORT}.`
    );
  }

  return {
    valid: errors.length === 0,
    expected: DEV_SERVER_PORT,
    vitePort,
    tauriPort,
    errors,
  };
}
