/**
 * LucidClip Actionable Error Reporter
 *
 * Formats structured, actionable diagnostic messages for development startup issues.
 */

const isWindows = process.platform === 'win32';

/**
 * Formats a comprehensive, actionable port conflict error message.
 * @param {{ port: number, process?: { pid: number, name?: string, command?: string, cwd?: string, isLucidClip: boolean } }} conflict
 * @returns {string}
 */
export function formatPortConflictError(conflict) {
  const { port, process: proc } = conflict;
  const lines = [];

  lines.push('================================================================');
  lines.push(' [LucidClip] Development Server Port Conflict Detected');
  lines.push(` Port ${port} is already in use and cannot be bound by Vite.`);
  lines.push('================================================================\n');

  lines.push(' Diagnostic Information:');
  lines.push(`   Target Port:     ${port}`);

  if (proc?.pid) {
    lines.push(`   Process ID:      ${proc.pid}`);
    if (proc.name) {
      lines.push(`   Process Name:    ${proc.name}`);
    }
    if (proc.command) {
      // Truncate overly long command lines for readability
      const cmdDisplay =
        proc.command.length > 80
          ? `${proc.command.slice(0, 77)}...`
          : proc.command;
      lines.push(`   Command Line:    ${cmdDisplay}`);
    }
    if (proc.cwd) {
      lines.push(`   Working Dir:     ${proc.cwd}`);
    }
    lines.push(
      `   Classification:  ${
        proc.isLucidClip
          ? 'Identified as a previous LucidClip / Vite development process'
          : 'External application (Protected: will not be terminated automatically)'
      }`
    );
  } else {
    lines.push('   Process ID:      Unknown (check system permissions)');
  }

  lines.push('\n Why this occurs:');
  lines.push(
    `   LucidClip's desktop Tauri engine and Vite frontend are both strictly`
  );
  lines.push(
    `   configured to use port ${port} so the desktop window, IPC, and HMR`
  );
  lines.push(
    '   remain synchronized. Port shifting is disabled to prevent desktop devUrl mismatch.\n'
  );

  lines.push(' How to resolve:');
  if (proc?.pid) {
    if (proc.isLucidClip) {
      lines.push('   Option 1 (Automated):');
      lines.push('     Start with the --clean flag to safely stop the previous session:');
      lines.push('       npm run dev -- --clean\n');
      lines.push('   Option 2 (Manual):');
      if (isWindows) {
        lines.push(`     Run in PowerShell: Stop-Process -Id ${proc.pid} -Force`);
        lines.push(`     Or in Command Prompt: taskkill /pid ${proc.pid} /f`);
      } else {
        lines.push(`     Run in terminal: kill -9 ${proc.pid}`);
      }
    } else {
      lines.push('   An unrelated application is occupying this port.');
      lines.push('   To prevent accidental data loss, LucidClip will not kill it.');
      if (isWindows) {
        lines.push(`   Close that application or run: taskkill /pid ${proc.pid} /f`);
      } else {
        lines.push(`   Close that application or run: kill -9 ${proc.pid}`);
      }
    }
  } else {
    lines.push(`   Free port ${port} by stopping any background process using it.`);
  }

  lines.push('================================================================');
  return lines.join('\n');
}

