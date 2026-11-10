import React from 'react';
import { useApp } from '@/context';
import { formatBytes } from '@/utils';
import { ShieldCheck, ShieldAlert, Database } from 'lucide-react';

export const AppFooter: React.FC = () => {
  const {
    settings,
    monitorStatus,
    clipboardDiagnostics,
    storageStats,
    unifiedHistory,
    selectedItem,
  } = useApp();

  const monitoringUnsupported = monitorStatus ? !monitorStatus.supported : false;
  const monitoringStopped = monitorStatus
    ? monitorStatus.supported &&
      !monitorStatus.running &&
      (monitorStatus.started_at !== null || monitorStatus.last_error !== null)
    : false;
  const isMonitoring = monitorStatus
    ? monitorStatus.running && !monitorStatus.paused
    : settings.clipboard.monitoringEnabled && !settings.privacy.pauseMonitoring;
  const monitorLabel = monitoringUnsupported
    ? 'Monitoring Unavailable'
    : monitoringStopped
      ? 'Monitoring Stopped'
      : isMonitoring
        ? 'Monitoring Active'
        : 'Monitoring Paused';
  const dbBytes = storageStats?.dbSizeBytes ?? 0;

  return (
    <footer className="flex h-6 w-full items-center justify-between border-t border-graphite-border bg-graphite-sidebar px-3 text-[11px] text-graphite-text-muted select-none shrink-0 z-10">
      {/* Left: Monitoring status */}
      <div className="flex items-center gap-1.5">
        {monitoringUnsupported || monitoringStopped ? (
          <>
            <ShieldAlert className="h-3 w-3 text-status-error" />
            <span className="text-status-error">{monitorLabel}</span>
          </>
        ) : isMonitoring ? (
          <>
            <ShieldCheck className="h-3 w-3 text-status-success" />
            <span className="text-graphite-text-secondary">{monitorLabel}</span>
            <span className="hidden sm:inline text-graphite-text-muted">
              • {clipboardDiagnostics?.backend ?? 'Native'} clipboard monitor
            </span>
          </>
        ) : (
          <>
            <ShieldAlert className="h-3 w-3 text-status-warning" />
            <span className="text-status-warning">{monitorLabel}</span>
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

