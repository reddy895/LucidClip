#!/usr/bin/env node

/**
 * Validates the repository layout and the contracts between the Tauri
 * configuration, the Vite frontend, and the root package scripts.
 *
 * Exposed as a module so the automated test suite can assert the same rules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(__filename), '..');

function readJson(filePath, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    errors.push(`Cannot read ${filePath}: ${err.message}`);
    return null;
  }
}

function extractPort(source) {
  const match = source.match(/port\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractUrlPort(url) {
  try {
    return Number(new URL(url).port);
  } catch {
    return null;
  }
}

export function validateProjectLayout(rootDir = defaultRoot) {
  const errors = [];
  const packagePath = path.join(rootDir, 'package.json');
  const frontendPackagePath = path.join(rootDir, 'frontend', 'package.json');
  const cargoPath = path.join(rootDir, 'backend', 'Cargo.toml');
  const tauriConfigPath = path.join(rootDir, 'backend', 'tauri.conf.json');
  const viteConfigPath = path.join(rootDir, 'frontend', 'vite.config.ts');
  const capabilitiesPath = path.join(rootDir, 'backend', 'capabilities', 'default.json');
  const devLauncherPath = path.join(rootDir, 'scripts', 'dev.mjs');

  for (const required of [
    packagePath,
    frontendPackagePath,
    cargoPath,
    tauriConfigPath,
    viteConfigPath,
    capabilitiesPath,
    devLauncherPath,
  ]) {
    if (!fs.existsSync(required)) {
      errors.push(`Missing required file: ${path.relative(rootDir, required)}`);
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  const rootPackage = readJson(packagePath, errors);
  const tauriConfig = readJson(tauriConfigPath, errors);

  if (rootPackage) {
    const scripts = rootPackage.scripts ?? {};
    for (const script of ['dev', 'dev:frontend', 'build:frontend']) {
      if (typeof scripts[script] !== 'string' || scripts[script].trim() === '') {
        errors.push(`Root package.json is missing the "${script}" script.`);
      }
    }
    if (scripts.dev !== 'node ./scripts/dev.mjs') {
      errors.push('Root "dev" script must invoke node ./scripts/dev.mjs.');
    }
  }

  if (tauriConfig) {
    const build = tauriConfig.build ?? {};
    if (build.beforeDevCommand !== 'npm run dev:frontend') {
      errors.push('tauri.conf.json beforeDevCommand must resolve from the repository root.');
    }
    if (build.beforeBuildCommand !== 'npm run build:frontend') {
      errors.push('tauri.conf.json beforeBuildCommand must resolve from the repository root.');
    }
    if (typeof build.devUrl !== 'string') {
      errors.push('tauri.conf.json is missing build.devUrl.');
    }

    const expectedDist = path.resolve(rootDir, 'backend', build.frontendDist ?? '');
    const expectedDistDir = path.resolve(rootDir, 'frontend', 'dist');
    if (expectedDist !== expectedDistDir) {
      errors.push(
        `frontendDist must resolve to ${expectedDistDir} but resolves to ${expectedDist}.`
      );
    }

    const devPort = extractUrlPort(build.devUrl);
    const vitePort = extractPort(fs.readFileSync(viteConfigPath, 'utf8'));
    if (devPort === null) {
      errors.push(`Cannot determine the port from devUrl "${build.devUrl}".`);
    } else if (vitePort !== null && devPort !== vitePort) {
      errors.push(
        `Tauri devUrl port ${devPort} does not match the Vite server port ${vitePort}.`
      );
    }
  }

  const launcher = fs.readFileSync(devLauncherPath, 'utf8');
  if (/\/home\/|\/Users\/|[A-Za-z]:\\/.test(launcher)) {
    errors.push('The development launcher contains a machine-specific absolute path.');
  }
  if (!launcher.includes("path.dirname(__filename), '..'")) {
    errors.push('The development launcher must resolve the repository root from its own location.');
  }

  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const errors = validateProjectLayout();
  if (errors.length > 0) {
    console.error('[LucidClip] Project layout validation failed:');
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }
  console.log('[LucidClip] Project layout and launcher configuration are valid.');
}
