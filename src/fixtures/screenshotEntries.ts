import { ScreenshotEntry } from '@/types';

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function createSvgDataUri(title: string, subtitle: string, accentColor: string, lines: string[]): string {
  const contentLines = lines
    .map((line, i) => `<text x="28" y="${110 + i * 22}" fill="#A1A7B0" font-family="monospace" font-size="12">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380" fill="none">
    <rect width="600" height="380" rx="10" fill="#151719"/>
    <rect x="1" y="1" width="598" height="378" rx="9" stroke="#30363D" stroke-width="1.5"/>
    <rect width="600" height="42" rx="10" fill="#191C20"/>
    <circle cx="24" cy="21" r="5" fill="#E47777"/>
    <circle cx="42" cy="21" r="5" fill="#E5B567"/>
    <circle cx="60" cy="21" r="5" fill="#55B889"/>
    <text x="82" y="25" fill="#F3F4F6" font-family="sans-serif" font-weight="600" font-size="12">${title}</text>
    <rect x="500" y="12" width="76" height="18" rx="4" fill="${accentColor}" fill-opacity="0.2"/>
    <text x="538" y="25" fill="${accentColor}" font-family="sans-serif" font-weight="500" font-size="10" text-anchor="middle">${subtitle}</text>
    <line x1="0" y1="42" x2="600" y2="42" stroke="#30363D" stroke-width="1"/>
    ${contentLines}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_SCREENSHOT_ENTRIES: ScreenshotEntry[] = [
  {
    id: 'shot-001',
    thumbnailUrl: createSvgDataUri('Architecture Diagram — Tauri 2 + SQLite', 'DOCS', '#8B9CF7', [
      '[Desktop App] -> [Tauri Command Dispatcher]',
      '├── Clipboard Watcher (Win32 Hook)',
      '├── SQLite Storage Manager (WAL mode)',
      '└── Local OCR Engine (Offline Windows OCR)',
      'Status: All systems nominal'
    ]),
    fullImageUrl: createSvgDataUri('Architecture Diagram — Tauri 2 + SQLite', 'DOCS', '#8B9CF7', [
      '[Desktop App] -> [Tauri Command Dispatcher]',
      '├── Clipboard Watcher (Win32 Hook)',
      '├── SQLite Storage Manager (WAL mode)',
      '└── Local OCR Engine (Offline Windows OCR)',
      'Status: All systems nominal',
      'Memory footprint: ~38MB idle'
    ]),
    width: 1920,
    height: 1080,
    fileSizeBytes: 421800,
    ocrText: 'Desktop App -> Tauri Command Dispatcher\nClipboard Watcher (Win32 Hook)\nSQLite Storage Manager (WAL mode)\nLocal OCR Engine (Offline Windows OCR)\nStatus: All systems nominal\nMemory footprint: ~38MB idle',
    ocrStatus: 'completed',
    captureType: 'fullscreen',
    isPinned: true,
    isFavorite: true,
    createdAt: hoursAgo(1),
  },
  {
    id: 'shot-002',
    thumbnailUrl: createSvgDataUri('Terminal — Cargo Build Release', 'CLI', '#55B889', [
      '$ cargo build --release',
      '   Compiling lucidclip-core v0.1.0',
      '   Compiling tauri-plugin-clipboard v2.0.0',
      '    Finished release [optimized] target(s) in 18.42s',
      'Binary size: 8.4 MB'
    ]),
    fullImageUrl: createSvgDataUri('Terminal — Cargo Build Release', 'CLI', '#55B889', [
      '$ cargo build --release',
      '   Compiling lucidclip-core v0.1.0',
      '   Compiling tauri-plugin-clipboard v2.0.0',
      '    Finished release [optimized] target(s) in 18.42s',
      'Binary size: 8.4 MB'
    ]),
    width: 1280,
    height: 720,
    fileSizeBytes: 284500,
    ocrText: '$ cargo build --release\nCompiling lucidclip-core v0.1.0\nCompiling tauri-plugin-clipboard v2.0.0\nFinished release [optimized] target(s) in 18.42s\nBinary size: 8.4 MB',
    ocrStatus: 'completed',
    captureType: 'region',
    isPinned: false,
    isFavorite: true,
    createdAt: hoursAgo(3),
  },
  {
    id: 'shot-003',
    thumbnailUrl: createSvgDataUri('Database Query — Entries Indexing', 'SQL', '#E5B567', [
      'EXPLAIN QUERY PLAN',
      'SELECT id, content FROM clipboard_entries',
      'WHERE content_type = "code" AND is_pinned = 1',
      'SEARCH TABLE clipboard_entries USING INDEX idx_content_type'
    ]),
    fullImageUrl: createSvgDataUri('Database Query — Entries Indexing', 'SQL', '#E5B567', [
      'EXPLAIN QUERY PLAN',
      'SELECT id, content FROM clipboard_entries',
      'WHERE content_type = "code" AND is_pinned = 1',
      'SEARCH TABLE clipboard_entries USING INDEX idx_content_type'
    ]),
    width: 1440,
    height: 900,
    fileSizeBytes: 312000,
    ocrText: 'EXPLAIN QUERY PLAN\nSELECT id, content FROM clipboard_entries\nWHERE content_type = "code" AND is_pinned = 1\nSEARCH TABLE clipboard_entries USING INDEX idx_content_type',
    ocrStatus: 'completed',
    captureType: 'region',
    isPinned: false,
    isFavorite: false,
    createdAt: hoursAgo(7),
  },
  {
    id: 'shot-004',
    thumbnailUrl: createSvgDataUri('Windows Tray Context Menu Preview', 'UI', '#8B9CF7', [
      'LucidClip - Active',
      '--------------------------',
      'Open LucidClip (Alt + Space)',
      'Pause Monitoring',
      'Capture Screen (PrintScreen)',
      'Exit'
    ]),
    fullImageUrl: createSvgDataUri('Windows Tray Context Menu Preview', 'UI', '#8B9CF7', [
      'LucidClip - Active',
      '--------------------------',
      'Open LucidClip (Alt + Space)',
      'Pause Monitoring',
      'Capture Screen (PrintScreen)',
      'Exit'
    ]),
    width: 1920,
    height: 1080,
    fileSizeBytes: 395100,
    ocrText: 'LucidClip - Active\nOpen LucidClip (Alt + Space)\nPause Monitoring\nCapture Screen (PrintScreen)\nExit',
    ocrStatus: 'completed',
    captureType: 'fullscreen',
    isPinned: true,
    isFavorite: false,
    createdAt: daysAgo(1),
  },
  {
    id: 'shot-005',
    thumbnailUrl: createSvgDataUri('Privacy Guard — App Exclusion Filter', 'SECURITY', '#E47777', [
      'Excluded Applications Detected:',
      '- 1Password.exe [Ignored]',
      '- KeePass.exe   [Ignored]',
      '- Bitwarden.exe [Ignored]',
      'Data isolation verified. Zero leaks.'
    ]),
    fullImageUrl: createSvgDataUri('Privacy Guard — App Exclusion Filter', 'SECURITY', '#E47777', [
      'Excluded Applications Detected:',
      '- 1Password.exe [Ignored]',
      '- KeePass.exe   [Ignored]',
      '- Bitwarden.exe [Ignored]',
      'Data isolation verified. Zero leaks.'
    ]),
    width: 1366,
    height: 768,
    fileSizeBytes: 278000,
    ocrText: 'Excluded Applications Detected:\n- 1Password.exe [Ignored]\n- KeePass.exe [Ignored]\n- Bitwarden.exe [Ignored]\nData isolation verified. Zero leaks.',
    ocrStatus: 'completed',
    captureType: 'region',
    isPinned: false,
    isFavorite: false,
    createdAt: daysAgo(2),
  },
];

