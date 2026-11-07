import React from 'react';
import { useApp } from '@/context';
import { formatBytes } from '@/utils';
import { ShieldCheck, ShieldAlert, Database } from 'lucide-react';

export const AppFooter: React.FC = () => {
  const { settings, storageStats, unifiedHistory, selectedItem } = useApp();

  const isMonitoring = settings.clipboard.monitoringEnabled && !settings.privacy.pauseMonitoring;
  const dbBytes = storageStats?.dbSizeBytes ?? 0;

  return (
    <footer className="flex h-6 w-full items-center justify-between border-t border-graphite-border bg-graphite-sidebar px-3 text-[11px] text-graphite-text-muted select-none shrink-0 z-10">
      {/* Left: Monitoring status */}
      <div className="flex items-center gap-1.5">
        {isMonitoring ? (
          <>
            <ShieldCheck className="h-3 w-3 text-status-success" />
            <span className="text-graphite-text-secondary">Monitoring Active</span>
            <span className="hidden sm:inline text-graphite-text-muted">• Win32 Clipboard Hook</span>
          </>
        ) : (
          <>
            <ShieldAlert className="h-3 w-3 text-status-warning" />
            <span className="text-status-warning">Monitoring Paused</span>
          </>
        )}
      </div>

      {/* Center: Selection status */}
      <div className="hidden md:flex items-center gap-2">
        <span>{unifiedHistory.length} total entries</span>
        {selectedItem && (
          <>
            <span>•</span>
            <span className="text-graphite-text-secondary truncate max-w-[200px]">
              Selected:{' '}
              {selectedItem.kind === 'clipboard'
                ? selectedItem.contentType.toUpperCase()
                : 'SCREENSHOT'}
            </span>
          </>
        )}
      </div>

      {/* Right: Storage and privacy */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Database className="h-3 w-3 text-graphite-text-muted" />
          <span>SQLite: {formatBytes(dbBytes)}</span>
        </div>
        <span className="hidden lg:inline">• Privacy: Local-first</span>
      </div>
    </footer>
  );
};

