export function isShortcutMatch(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+').map((p) => p.trim().toLowerCase());
  const hasCtrl = parts.includes('ctrl') || parts.includes('control');
  const hasShift = parts.includes('shift');
  const hasAlt = parts.includes('alt');
  const hasMeta = parts.includes('meta') || parts.includes('cmd');

  if (hasCtrl !== e.ctrlKey) return false;
  if (hasShift !== e.shiftKey) return false;
  if (hasAlt !== e.altKey) return false;
  if (hasMeta !== e.metaKey) return false;

  const keyPart = parts.find((p) => !['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd'].includes(p));
  if (!keyPart) return true;

  if (keyPart === 'space' && e.code === 'Space') return true;
  if (keyPart === 'enter' && e.key === 'Enter') return true;
  if (keyPart === 'escape' && e.key === 'Escape') return true;

  return e.key.toLowerCase() === keyPart;
}

export function formatShortcutDisplay(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => {
      const p = part.trim();
      if (p.toLowerCase() === 'ctrl') return 'Ctrl';
      if (p.toLowerCase() === 'alt') return 'Alt';
      if (p.toLowerCase() === 'shift') return 'Shift';
      if (p.toLowerCase() === 'space') return 'Space';
      return p.toUpperCase();
    })
    .join(' + ');
}

