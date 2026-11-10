import React, { useState } from 'react';
import { useApp } from '@/context';
import {
  SectionHeader,
  Toggle,
  Select,
  Input,
  Button,
  Badge,
  ConfirmationModal,
} from '@/components/ui';
import { SettingsSection } from '@/components/settings';
import {
  Sliders,
  ClipboardList,
  Camera,
  Keyboard,
  Shield,
  Info,
  RotateCcw,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  Activity,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/utils';

type SettingsTab = 'general' | 'clipboard' | 'screenshots' | 'shortcuts' | 'privacy' | 'about';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetSettings,
    clearClipboardHistory,
    clipboardDiagnostics,
    monitorStatus,
    setMonitoringEnabled,
    refreshClipboardStatus,
    captureClipboardNow,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [newExclusionApp, setNewExclusionApp] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const monitoringSupported =
    monitorStatus?.supported ?? clipboardDiagnostics?.monitoring_supported ?? true;
  const monitoringStopped = monitorStatus
    ? monitorStatus.supported &&
      !monitorStatus.running &&
      (monitorStatus.started_at !== null || monitorStatus.last_error !== null)
    : false;
  const monitoringActive = monitorStatus
    ? monitorStatus.running && !monitorStatus.paused
    : settings.clipboard.monitoringEnabled && !settings.privacy.pauseMonitoring;
  const monitoringBadge = !monitoringSupported
    ? { label: 'Unsupported', variant: 'error' as const }
    : monitoringStopped
      ? { label: 'Stopped', variant: 'error' as const }
      : monitoringActive
        ? { label: 'Active', variant: 'success' as const }
        : { label: 'Paused', variant: 'warning' as const };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Sliders className="h-4 w-4" /> },
    { id: 'clipboard', label: 'Clipboard', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'screenshots', label: 'Screenshots', icon: <Camera className="h-4 w-4" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="h-4 w-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield className="h-4 w-4" /> },
    { id: 'about', label: 'About', icon: <Info className="h-4 w-4" /> },
  ];

  const handleAddExclusion = () => {
    const trimmed = newExclusionApp.trim();
    if (!trimmed) return;
    const current = settings.clipboard.excludedApps || [];
    if (!current.includes(trimmed)) {
      updateSettings({
        clipboard: {
          ...settings.clipboard,
          excludedApps: [...current, trimmed],
        },
      });
    }
    setNewExclusionApp('');
  };

  const handleRemoveExclusion = (app: string) => {
    updateSettings({
      clipboard: {
        ...settings.clipboard,
        excludedApps: settings.clipboard.excludedApps.filter((a) => a !== app),
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <SectionHeader
        title="Settings"
        description="Configure application preferences, hotkeys, and privacy boundaries."
        actions={
          <Button
            variant="subtle"
            size="sm"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => setIsResetModalOpen(true)}
          >
            Reset to Defaults
          </Button>
        }
      />

      {/* Main Settings Layout: Sub-sidebar + Content Area */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row gap-6 pt-2">
        {/* Navigation column */}
        <div className="w-full md:w-48 shrink-0 flex md:flex-col gap-1 overflow-x-auto select-none border-b md:border-b-0 md:border-r border-graphite-border pb-3 md:pb-0 md:pr-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-btn px-2.5 text-xs font-medium transition-colors duration-micro outline-none text-left shrink-0',
                  isActive
                    ? 'bg-graphite-surface-elevated text-accent border border-graphite-border shadow-sm'
                    : 'text-graphite-text-secondary hover:text-graphite-text-primary hover:bg-graphite-hover border border-transparent'
                )}
              >
                <span className={isActive ? 'text-accent' : 'text-graphite-text-muted'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          {activeTab === 'general' && (
            <div className="flex flex-col">
              <SettingsSection
                title="System Integration"
                description="Controls how LucidClip starts with Windows."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Launch at Windows startup
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Register LucidClip to launch when the current Windows user signs in.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.general.launchOnStartup}
                    onChange={(checked) =>
                      updateSettings({ general: { ...settings.general, launchOnStartup: checked } })
                    }
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Appearance & View Defaults"
                description="Configure visual theme and initial navigation view."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Interface Theme
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Dark graphite native desktop palette.
                    </div>
                  </div>
                  <Badge variant="default" size="sm">
                    Dark Graphite (Default)
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Default Startup View
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      The initial view presented when the main window opens.
                    </div>
                  </div>
                  <Select
                    value={settings.general.defaultView}
                    onChange={(val) =>
                      updateSettings({
                        general: {
                          ...settings.general,
                          defaultView: val as 'all' | 'clipboard' | 'screenshots' | 'pinned' | 'favorites',
                        },
                      })
                    }
                    options={[
                      { value: 'all', label: 'All Items' },
                      { value: 'clipboard', label: 'Clipboard History' },
                      { value: 'screenshots', label: 'Screenshots' },
                      { value: 'pinned', label: 'Pinned Items' },
                      { value: 'favorites', label: 'Favorites' },
                    ]}
                    className="w-40"
                  />
                </div>
              </SettingsSection>
            </div>
          )}

          {activeTab === 'clipboard' && (
            <div className="flex flex-col">
              <SettingsSection
                title="Clipboard Monitoring"
                description="Manage background clipboard change detection."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-graphite-text-primary">
                      Enable clipboard monitoring
                      <Badge variant={monitoringBadge.variant} size="sm">
                        {monitoringBadge.label}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Automatically store supported text, code, and links copied to the clipboard.
                    </div>
                  </div>
                  <Toggle
                    checked={monitoringActive}
                    disabled={!monitoringSupported || monitoringStopped}
                    onChange={(checked) => setMonitoringEnabled(checked)}
                    aria-label="Enable clipboard monitoring"
                  />
                </div>

                {!monitoringSupported && (
                  <div className="flex items-start gap-2 rounded-btn border border-status-error/30 bg-status-error-bg p-3 text-[11px] text-status-error">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      This environment has no usable clipboard backend. The desktop app needs a
                      Windows session with access to the clipboard API, or a Linux session with a
                      GTK clipboard provider.
                    </span>
                  </div>
                )}

                {monitoringStopped && (
                  <div className="flex items-start gap-2 rounded-btn border border-status-error/30 bg-status-error-bg p-3 text-[11px] text-status-error">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      The clipboard monitor started but is no longer running. Restart LucidClip to
                      recover it. {monitorStatus?.last_error ?? ''}
                    </span>
                  </div>
                )}

                <div className="rounded-btn border border-graphite-border bg-graphite-surface p-3 text-[11px] text-graphite-text-muted">
                  Copying identical text again refreshes its timestamp instead of creating a
                  duplicate history row.
                </div>
              </SettingsSection>

              <SettingsSection
                title="Backend Diagnostics"
                description="Local, content-free information about the active clipboard integration."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={() => void refreshClipboardStatus()}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Activity className="h-3.5 w-3.5" />}
                    isLoading={isCapturing}
                    disabled={!monitoringSupported || monitoringStopped}
                    onClick={async () => {
                      setIsCapturing(true);
                      try {
                        await captureClipboardNow();
                      } finally {
                        setIsCapturing(false);
                      }
                    }}
                  >
                    Capture now
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['Backend', clipboardDiagnostics?.backend ?? monitorStatus?.backend ?? 'Unknown'],
                    ['Session', clipboardDiagnostics?.session ?? monitorStatus?.session ?? 'Unknown'],
                    ['Desktop', clipboardDiagnostics?.desktop ?? 'Unknown'],
                    ['Captures', monitorStatus ? String(monitorStatus.captures) : '0'],
                    [
                      'Text',
                      clipboardDiagnostics?.supports_text ? 'Supported' : 'Not supported',
                    ],
                    [
                      'Images',
                      clipboardDiagnostics?.supports_images ? 'Supported' : 'Not supported',
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-btn border border-graphite-border bg-graphite-surface px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="text-graphite-text-muted">{label}</span>
                      <span className="font-mono text-graphite-text-secondary">{value}</span>
                    </div>
                  ))}
                </div>

                {monitorStatus?.last_error && (
                  <div className="rounded-btn border border-status-error/30 bg-status-error-bg p-3 text-[11px] text-status-error">
                    Last monitor error: {monitorStatus.last_error}
                  </div>
                )}

                {clipboardDiagnostics && clipboardDiagnostics.diagnostics.length > 0 && (
                  <ul className="flex flex-col gap-1 text-[11px] text-graphite-text-muted">
                    {clipboardDiagnostics.diagnostics.map((line) => (
                      <li key={line} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-graphite-text-muted" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsSection>

              <SettingsSection
                title="History Retention"
                description="Configure local database size limits and retention policies."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Maximum history entries
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Older unpinned, non-favorite entries are purged when this limit is reached.
                    </div>
                  </div>
                  <Select
                    value={settings.clipboard.maxHistoryItems.toString()}
                    onChange={(val) =>
                      updateSettings({
                        clipboard: { ...settings.clipboard, maxHistoryItems: parseInt(val, 10) },
                      })
                    }
                    options={[
                      { value: '100', label: '100 items' },
                      { value: '250', label: '250 items' },
                      { value: '500', label: '500 items' },
                      { value: '1000', label: '1,000 items' },
                    ]}
                    className="w-36"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Auto-cleanup age
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Automatically purge unpinned entries older than specified days.
                    </div>
                  </div>
                  <Select
                    value={settings.clipboard.autoCleanupDays.toString()}
                    onChange={(val) =>
                      updateSettings({
                        clipboard: { ...settings.clipboard, autoCleanupDays: parseInt(val, 10) },
                      })
                    }
                    options={[
                      { value: '7', label: '7 days' },
                      { value: '14', label: '14 days' },
                      { value: '30', label: '30 days' },
                      { value: '90', label: '90 days' },
                    ]}
                    className="w-36"
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Application Exclusions"
                description="Prevent copying content originating from sensitive applications (e.g. password managers)."
              >
                <div className="flex gap-2">
                  <Input
                    value={newExclusionApp}
                    onChange={(e) => setNewExclusionApp(e.target.value)}
                    placeholder="e.g. KeePass.exe, Bitwarden.exe"
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={handleAddExclusion}
                    disabled={!newExclusionApp.trim()}
                  >
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {settings.clipboard.excludedApps.map((app) => (
                    <span
                      key={app}
                      className="inline-flex items-center gap-1.5 rounded-btn bg-graphite-surface px-2.5 py-1 text-xs text-graphite-text-secondary border border-graphite-border"
                    >
                      <span>{app}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExclusion(app)}
                        className="text-graphite-text-muted hover:text-status-error transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </SettingsSection>
            </div>
          )}

          {activeTab === 'screenshots' && (
            <div className="flex flex-col">
              <SettingsSection
                title="Screenshot Storage"
                description="Captured images are stored inside the LucidClip application data folder."
              >
                <div className="rounded-btn border border-graphite-border bg-graphite-surface p-3 text-xs text-graphite-text-secondary">
                  <p className="font-medium text-graphite-text-primary mb-1">
                    Local image storage
                  </p>
                  <p className="text-graphite-text-muted leading-relaxed">
                    Originals and thumbnails are written to the app data directory and served
                    through Tauri's scoped asset protocol. Screenshot text extraction is not
                    available in this build, so captures are stored as images only.
                  </p>
                </div>
              </SettingsSection>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="flex flex-col">
              <SettingsSection
                title="Keyboard Shortcuts"
                description="Shortcuts are active while the LucidClip window is focused."
              >
                {[
                  { label: 'Quick Access Launcher', description: 'Open or close the search overlay.', keys: settings.shortcuts.quickAccess },
                  { label: 'Focus Search', description: 'Move focus to the current view search field.', keys: 'Ctrl+F or /' },
                  { label: 'Toggle Sidebar', description: 'Collapse or expand the navigation sidebar.', keys: 'Ctrl+B' },
                  { label: 'Toggle Preview Panel', description: 'Show or hide the item preview panel.', keys: 'Ctrl+P' },
                  { label: 'Open Settings', description: 'Switch directly to the settings view.', keys: 'Ctrl+,' },
                  { label: 'Navigate Views', description: 'Jump between the five main sections.', keys: 'Ctrl+1 to Ctrl+5' },
                ].map((shortcut) => (
                  <div key={shortcut.label} className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-medium text-graphite-text-primary">
                        {shortcut.label}
                      </div>
                      <div className="text-[11px] text-graphite-text-muted">
                        {shortcut.description}
                      </div>
                    </div>
                    <kbd className="rounded-btn bg-graphite-surface px-2.5 py-1 text-xs font-mono text-graphite-text-primary border border-graphite-border">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </SettingsSection>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="flex flex-col">
              <SettingsSection
                title="Privacy & Data Boundaries"
                description="LucidClip is strictly local-first. No accounts, telemetry, or cloud synchronization."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Pause All Monitoring
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Temporarily disable all clipboard change listeners.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.privacy.pauseMonitoring}
                    onChange={(checked) =>
                      updateSettings({
                        privacy: { ...settings.privacy, pauseMonitoring: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Password Manager Protection
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Automatically ignore clipboards marked with concealed passwords.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.privacy.excludePasswordManagers}
                    onChange={(checked) =>
                      updateSettings({
                        privacy: { ...settings.privacy, excludePasswordManagers: checked },
                      })
                    }
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Danger Zone"
                description="Irreversible local data deletion operations."
              >
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-medium text-status-error">
                      Delete Stored Clipboard Data
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Permanently wipes unpinned entries from local SQLite storage.
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setIsClearDataModalOpen(true)}
                  >
                    Clear History
                  </Button>
                </div>
              </SettingsSection>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="flex flex-col">
              <SettingsSection
                title="About LucidClip"
                description="A privacy-first Windows desktop clipboard and screenshot history manager."
              >
                <div className="flex items-center gap-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-btn bg-[#191C20] border border-graphite-border text-accent">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="M9 14l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-graphite-text-primary">
                      LucidClip Desktop
                    </div>
                    <div className="text-xs text-graphite-text-muted">
                      Version {__APP_VERSION__}
                    </div>
                  </div>
                </div>

                <div className="rounded-btn bg-graphite-surface p-3 border border-graphite-border text-xs text-graphite-text-secondary leading-relaxed">
                  <p className="font-medium text-graphite-text-primary mb-1">
                    Design & Architecture Principles:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-graphite-text-muted">
                    <li>Local-first architecture powered by Tauri 2 + SQLite.</li>
                    <li>Restrained dark graphite visual identity matching DESIGN.md.</li>
                    <li>Offline-only processing — no remote telemetry or cloud databases.</li>
                    <li>Engineered for daily use by engineers, designers, and researchers.</li>
                  </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-[11px] text-graphite-text-muted">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                  <span>Targets Windows 10 / 11 64-bit</span>
                </div>
              </SettingsSection>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={async () => {
          await resetSettings();
          setIsResetModalOpen(false);
        }}
        title="Reset Settings to Defaults"
        description="Are you sure you want to reset all preferences, hotkeys, and limits to their original desktop defaults?"
        confirmText="Reset Defaults"
      />

      <ConfirmationModal
        isOpen={isClearDataModalOpen}
        onClose={() => setIsClearDataModalOpen(false)}
        onConfirm={async () => {
          await clearClipboardHistory();
          setIsClearDataModalOpen(false);
        }}
        title="Clear Stored History"
        description="Are you sure you want to permanently clear your stored clipboard entries? Pinned entries will not be removed."
        confirmText="Clear Stored Data"
        isDestructive={true}
      />
    </div>
  );
};

