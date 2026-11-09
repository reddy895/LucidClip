import React from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '@/context';
import { Tooltip } from '@/components/ui';

export const AppHeader: React.FC = () => {
  const {
    settings,
    toggleMonitoring,
    openQuickAccess,
    isPreviewVisible,
    togglePreview,
    isSidebarCollapsed,
    toggleSidebar,
  } = useApp();

  const isMonitoring = settings.clipboard.monitoringEnabled && !settings.privacy.pauseMonitoring;

  return (
    <header className="flex h-11 w-full items-center justify-between border-b border-graphite-border bg-graphite-sidebar px-3 select-none shrink-0 z-20">
      {/* Left controls */}
      <div className="flex items-center gap-2">
        <Tooltip content={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} shortcut="Ctrl+B">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </Tooltip>

        {isSidebarCollapsed && (
          <div className="flex items-center gap-1.5 pl-1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-xs font-semibold tracking-tight text-graphite-text-primary">
              LucidClip
            </span>
          </div>
        )}
      </div>

      {/* Center status / quick access trigger */}
      <div className="flex items-center gap-2">
        <Tooltip content="Open Quick Access Launcher" shortcut="Alt+Space">
          <button
            type="button"
            onClick={openQuickAccess}
            className="flex h-7 items-center gap-1.5 rounded-btn bg-graphite-surface px-2.5 text-xs text-graphite-text-secondary border border-graphite-border hover:text-graphite-text-primary hover:bg-graphite-surface-elevated transition-colors"
          >
            <Command className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">Quick Access</span>
            <kbd className="ml-1 rounded bg-graphite-sidebar px-1 py-0.5 text-[10px] font-mono text-graphite-text-muted border border-graphite-border">
              Alt + Space
            </kbd>
          </button>
        </Tooltip>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        {/* Monitoring status indicator button */}
        <Tooltip
          content={isMonitoring ? 'Monitoring Active (Click to pause)' : 'Monitoring Paused (Click to resume)'}
        >
          <button
            type="button"
            onClick={toggleMonitoring}
            className="flex h-7 items-center gap-1.5 rounded-btn px-2 text-[11px] font-medium transition-colors border border-transparent hover:border-graphite-border"
          >
            {isMonitoring ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-status-success" />
                <span className="hidden md:inline text-graphite-text-secondary">Monitoring</span>
                <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-status-warning" />
                <span className="hidden md:inline text-status-warning">Paused</span>
                <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
              </>
            )}
          </button>
        </Tooltip>

        <div className="h-4 w-[1px] bg-graphite-border mx-1" />

        {/* Toggle right preview panel */}
        <Tooltip content={isPreviewVisible ? 'Hide preview panel' : 'Show preview panel'}>
          <button
            type="button"
            onClick={togglePreview}
            aria-label={isPreviewVisible ? 'Hide preview panel' : 'Show preview panel'}
            className="flex h-7 w-7 items-center justify-center rounded-btn text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover transition-colors"
          >
            {isPreviewVisible ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </Tooltip>

      </div>
    </header>
  );
};

