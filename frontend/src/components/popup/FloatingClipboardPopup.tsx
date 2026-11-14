import React, { useEffect } from 'react';
import { useApp } from '@/context';

export interface FloatingClipboardPopupProps {
  children?: React.ReactNode;
}

export const FloatingClipboardPopup: React.FC<FloatingClipboardPopupProps> = ({ children }) => {
  const { clipboardItems, monitorStatus } = useApp();

  // Auto-dismiss on window blur (clicking outside the floating window)
  useEffect(() => {
    const handleBlur = () => {
      // If we are in Tauri runtime, invoke hide_clipboard_popup
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('hide_clipboard_popup').catch(() => {});
        });
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  const isMonitoring = monitorStatus ? (monitorStatus.running && !monitorStatus.paused) : true;

  return (
    <div
      className="flex flex-col w-full h-screen bg-[#111315] text-[#F3F4F6] border border-[#30363D] rounded-xl shadow-2xl overflow-hidden select-none font-sans"
      data-testid="floating-clipboard-popup"
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {children ? (
          children
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A7B0]">
            <p className="text-sm font-medium text-[#F3F4F6]">LucidClip Floating History</p>
            <p className="text-xs text-[#A1A7B0] mt-1">
              {clipboardItems.length} entries available &bull; Monitoring {isMonitoring ? 'Active' : 'Paused'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingClipboardPopup;
