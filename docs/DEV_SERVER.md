# Development Server Port Management & Process Lifecycle

This document describes how LucidClip manages its local development server, why port `1420` is strictly configured, and how port conflicts and orphaned processes are detected and resolved.

---

## 1. Architecture & Port Synchronization

LucidClip's desktop application consists of two communicating environments during development:
1. **Frontend Dev Server**: Vite serving React/TypeScript UI assets with Hot Module Replacement (HMR).
2. **Backend Desktop Shell**: Tauri 2 engine running Rust native services, hosting the webview.

### Strict Port Requirement (`1420`)
- **Tauri Configuration (`backend/tauri.conf.json`)**:
  `"build": { "devUrl": "http://localhost:1420" }`
- **Vite Configuration (`frontend/vite.config.ts`)**:
  `server: { port: 1420, strictPort: true }`
- **Canonical Configuration (`scripts/lib/config.mjs`)**:
  `DEV_SERVER_PORT = 1420`

### Why Port Shifting is Prohibited
In pure web applications, bundlers often silently shift to `1421` or `5173` if a port is occupied. **This behavior is prohibited in LucidClip.**
If Vite were to bind to any port other than `1420`, Tauri's desktop webview would fail to connect, showing a blank screen or `ERR_CONNECTION_REFUSED`. Both Vite and Tauri must strictly remain synchronized on port `1420`.

---

## 2. Process Lifecycle & Pre-Flight Checks

When you run `npm run dev`, the unified launcher (`scripts/dev.mjs`) executes:

1. **Configuration Validation**:
   Verifies that `backend/tauri.conf.json`, `frontend/vite.config.ts`, and `scripts/lib/config.mjs` agree on port `1420`.
2. **Pre-Flight Port Availability Probe**:
   Checks both IPv4 (`127.0.0.1`) and IPv6 (`::1`) on port `1420` before starting Tauri or spawning child processes.
3. **Diagnostic Conflict Reporting**:
   If port `1420` is occupied, the launcher inspects the system to discover:
   - Process ID (PID)
   - Process name
   - Command line arguments
   - Working directory
   - Classification (`LucidClip / Vite` vs `External application`)
4. **Actionable Resolution**:
   If the occupant is an orphaned LucidClip or Vite development process, the launcher recommends using the `--clean` flag or displays the exact shell command to terminate it manually.

---

## 3. Safe Cleanup (`--clean`)

To restart development when an earlier session or detached Vite instance is holding port `1420`:

```bash
npm run dev -- --clean
```

### Safety Policy
- **LucidClip / Vite Processes**: If the process command or directory matches LucidClip dev processes, `--clean` terminates the process tree cleanly.
- **Unrelated / External Processes**: If another tool, database, or application is using port `1420`, the launcher **strictly refuses** to terminate it. It informs the user and prints the PID so they can review and stop it safely.
- **Self-Protection**: The launcher never attempts to kill itself or its parent runner.

---

## 4. Signal Traps & Orphan Prevention

The launcher attaches listeners to `SIGINT` (Ctrl+C), `SIGTERM`, `SIGHUP`, `uncaughtException`, and `exit`:
- On Windows, `taskkill /pid <PID> /f /t` terminates the full process tree.
- On Linux and macOS, process groups are killed via negative PID signal delivery (`process.kill(-child.pid, signal)`), followed by a sweep of child PIDs via `pgrep`.
- Even if Tauri exits abnormally or crashes, the launcher guarantees that no orphaned Vite background processes remain detached.

---

## 5. Manual Troubleshooting

If you need to manually inspect or terminate a process listening on port `1420`:

### Windows (PowerShell or Command Prompt)
```powershell
# Identify the process occupying port 1420
netstat -ano | findstr :1420

# Inspect process details by PID
tasklist /fi "PID eq <PID>"

# Terminate process tree
taskkill /pid <PID> /f /t
```

### Linux / macOS (Terminal)
```bash
# Identify the process occupying port 1420
lsof -iTCP:1420 -sTCP:LISTEN -n -P
# or: ss -tulpn | grep 1420

# Terminate process
kill -9 <PID>
```

---

## 6. Regression Testing

Launcher lifecycle, port detection, and process termination are verified by the automated test suite:

```bash
npm test
```

This runs:
- `scripts/test/port-detector.test.mjs`: Tests port probing and timeout handling.
- `scripts/test/process-info.test.mjs`: Tests cross-platform PID, command line, and working directory resolution.
- `scripts/test/process-cleanup.test.mjs`: Tests process tree termination and foreign-process safety guards.
- `scripts/test/port-sync.test.mjs`: Verifies configuration consistency between Tauri and Vite.
- `scripts/test/error-reporter.test.mjs`: Tests diagnostic error message formatting.
- `scripts/test/port-conflict-regression.test.mjs`: Tests conflict detection and resolution paths.
- `scripts/test/launcher-lifecycle.test.mjs`: Tests command-line launcher execution, signal handling, and clean startup.
