import { useEffect } from 'react';
import { useApp } from '@/context';

export function useDesktopShortcuts(): void {
  const {
    openQuickAccess,
    closeQuickAccess,
    isQuickAccessOpen,
    toggleSidebar,
    togglePreview,
    setActiveSection,
    setSearchQuery,
  } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger navigation shortcuts if typing in input or textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Alt + Space (Quick Access)
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        if (isQuickAccessOpen) {
          closeQuickAccess();
        } else {
          openQuickAccess();
        }
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        if (isQuickAccessOpen) {
          e.preventDefault();
          closeQuickAccess();
          return;
        }
        if (isInput) {
          // Blur input
          target.blur();
          return;
        }
      }

      // If user is focused on an input/textarea, do not intercept single-letter shortcuts
      if (isInput && !e.ctrlKey && !e.metaKey) {
        return;
      }

      // Search focus: "/" or "Ctrl+F"
      if ((e.key === '/' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[type="text"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl/Cmd + P: Toggle preview panel
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        togglePreview();
        return;
      }

      // Ctrl/Cmd + ,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setActiveSection('settings');
        return;
      }

      // Ctrl/Cmd + 1-5 navigation
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveSection('all');
            break;
          case '2':
            e.preventDefault();
            setActiveSection('clipboard');
            break;
          case '3':
            e.preventDefault();
            setActiveSection('screenshots');
            break;
          case '4':
            e.preventDefault();
            setActiveSection('pinned');
            break;
          case '5':
            e.preventDefault();
            setActiveSection('favorites');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isQuickAccessOpen,
    openQuickAccess,
    closeQuickAccess,
    toggleSidebar,
    togglePreview,
    setActiveSection,
    setSearchQuery,
  ]);
}

