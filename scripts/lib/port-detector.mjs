/**
 * LucidClip Port Availability Detector
 *
 * Probes TCP port availability across localhost before starting servers.
 * Pure Node.js implementation without external dependencies.
 */

import net from 'node:net';

/**
 * Checks if a TCP port is currently free on a specific host/interface.
 * @param {number} port
 * @param {string} host
 * @returns {Promise<{ available: boolean, code?: string, port: number, host: string }>}
 */
export function checkSingleHostPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      resolve({
        available: false,
        code: err.code || 'UNKNOWN',
        port,
        host,
      });
    });

    server.once('listening', () => {
      server.close(() => {
        resolve({
          available: true,
          port,
          host,
        });
      });
    });

    try {
      server.listen({
        port,
        host,
        exclusive: true,
      });
    } catch (err) {
      resolve({
        available: false,
        code: err.code || 'UNKNOWN',
        port,
        host,
      });
    }
  });
}

/**
 * Checks if a port is completely available on localhost interfaces (127.0.0.1 and ::1).
 * @param {number} port
 * @returns {Promise<{ available: boolean, occupiedOn?: string, port: number }>}
 */
export async function isPortAvailable(port) {
  // Probe IPv4 loopback
  const ipv4Result = await checkSingleHostPort(port, '127.0.0.1');
  if (!ipv4Result.available) {
    return { available: false, occupiedOn: '127.0.0.1', port };
  }

  // Probe IPv6 loopback (if supported on machine)
  const ipv6Result = await checkSingleHostPort(port, '::1');
  if (!ipv6Result.available && ipv6Result.code !== 'EADDRNOTAVAIL') {
    return { available: false, occupiedOn: '::1', port };
  }

  return { available: true, port };
}

/**
 * Waits until a port becomes available or times out.
 * @param {number} port
 * @param {number} timeoutMs
 * @param {number} intervalMs
 * @returns {Promise<boolean>}
 */
export async function waitUntilPortFree(port, timeoutMs = 3000, intervalMs = 150) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await isPortAvailable(port);
    if (status.available) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
