import { ClipboardContentType } from '@/types';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

export function detectContentType(text: string): {
  type: ClipboardContentType;
  language?: string;
} {
  const trimmed = text.trim();

  // URL check
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed) || /^www\.[^\s$.?#].[^\s]*$/i.test(trimmed)) {
    return { type: 'url' };
  }

  // JSON check
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { type: 'json', language: 'json' };
    } catch {
      // not valid JSON, continue checking
    }
  }

  // Code checks
  if (
    trimmed.includes('import ') ||
    trimmed.includes('export ') ||
    trimmed.includes('function ') ||
    trimmed.includes('const ') ||
    trimmed.includes('let ') ||
    trimmed.includes('class ') ||
    trimmed.includes('def ') ||
    trimmed.includes('fn ') ||
    trimmed.includes('curl ') ||
    trimmed.includes('git ') ||
    trimmed.includes('npm ') ||
    trimmed.includes('SELECT ') ||
    trimmed.includes('<html') ||
    trimmed.includes('/>')
  ) {
    if (trimmed.includes('git ') || trimmed.includes('npm ') || trimmed.includes('curl ') || trimmed.startsWith('$')) {
      return { type: 'code', language: 'bash' };
    }
    if (trimmed.includes('fn ') || trimmed.includes('let mut ') || trimmed.includes('pub struct ')) {
      return { type: 'code', language: 'rust' };
    }
    if (trimmed.includes('def ') || (trimmed.includes('import ') && trimmed.includes(':'))) {
      return { type: 'code', language: 'python' };
    }
    if (trimmed.includes('interface ') || trimmed.includes(': string') || trimmed.includes(': number')) {
      return { type: 'code', language: 'typescript' };
    }
    if (trimmed.includes('SELECT ') || trimmed.includes('FROM ') || trimmed.includes('WHERE ')) {
      return { type: 'code', language: 'sql' };
    }
    return { type: 'code', language: 'javascript' };
  }

  // Multiline check
  if (trimmed.includes('\n')) {
    return { type: 'multiline' };
  }

  return { type: 'text' };
}

