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
import { SettingsSection } from '@/components/settings/SettingsSection';
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
} from 'lucide-react';
import { cn } from '@/utils';

type SettingsTab = 'general' | 'clipboard' | 'screenshots' | 'shortcuts' | 'privacy' | 'about';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetSettings,
    clearClipboardHistory,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [newExclusionApp, setNewExclusionApp] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

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
                description="Controls how LucidClip interacts with Windows startup and system tray."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Launch at Windows startup
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Start LucidClip minimized in the background on user login.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.general.launchOnStartup}
                    onChange={(checked) =>
                      updateSettings({ general: { ...settings.general, launchOnStartup: checked } })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Minimize to system tray
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Closing the window keeps the application running in the notification area.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.general.minimizeToTray}
                    onChange={(checked) =>
                      updateSettings({ general: { ...settings.general, minimizeToTray: checked } })
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
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Enable clipboard monitoring
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Automatically store supported text, code, and links copied to the clipboard.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.clipboard.monitoringEnabled}
                    onChange={(checked) =>
                      updateSettings({
                        clipboard: { ...settings.clipboard, monitoringEnabled: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Ignore consecutive duplicates
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Do not add duplicate entries if the exact same content is copied consecutively.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.clipboard.ignoreDuplicates}
                    onChange={(checked) =>
                      updateSettings({
                        clipboard: { ...settings.clipboard, ignoreDuplicates: checked },
                      })
                    }
                  />
                </div>
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
                      Older non-pinned entries are purged when this limit is reached.
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
                title="Screenshot Storage & OCR"
                description="Configure local screenshot file storage and offline OCR extraction."
              >
                <div className="flex flex-col gap-1 py-1">
                  <div className="text-xs font-medium text-graphite-text-primary">
                    Default Save Directory
                  </div>
                  <div className="text-[11px] text-graphite-text-muted mb-1.5">
                    Local folder where screenshot image files are saved.
                  </div>
                  <Input
                    value={settings.screenshots.saveDirectory}
                    onChange={(e) =>
                      updateSettings({
                        screenshots: { ...settings.screenshots, saveDirectory: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Local OCR text extraction
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Extract text from captured screenshots completely offline.
                    </div>
                  </div>
                  <Toggle
                    checked={settings.screenshots.enableOcr}
                    onChange={(checked) =>
                      updateSettings({
                        screenshots: { ...settings.screenshots, enableOcr: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      OCR Language Model
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Language model used for offline text recognition.
                    </div>
                  </div>
                  <Select
                    value={settings.screenshots.ocrLanguage}
                    onChange={(val) =>
                      updateSettings({
                        screenshots: { ...settings.screenshots, ocrLanguage: val },
                      })
                    }
                    options={[
                      { value: 'en-US', label: 'English (US)' },
                      { value: 'en-GB', label: 'English (UK)' },
                      { value: 'de-DE', label: 'German' },
                      { value: 'fr-FR', label: 'French' },
                    ]}
                    className="w-36"
                  />
                </div>
              </SettingsSection>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="flex flex-col">
              <SettingsSection
                title="Keyboard Shortcuts"
                description="Global and local hotkeys for instant desktop productivity."
              >
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Quick Access Launcher
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Opens the centered quick search and clipboard retrieval window.
                    </div>
                  </div>
                  <kbd className="rounded-btn bg-graphite-surface px-2.5 py-1 text-xs font-mono text-graphite-text-primary border border-graphite-border">
                    {settings.shortcuts.quickAccess}
                  </kbd>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Capture Full Screen
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Instantly snapshot the entire active monitor and process OCR.
                    </div>
                  </div>
                  <kbd className="rounded-btn bg-graphite-surface px-2.5 py-1 text-xs font-mono text-graphite-text-primary border border-graphite-border">
                    {settings.shortcuts.captureFullscreen}
                  </kbd>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-xs font-medium text-graphite-text-primary">
                      Capture Selected Region
                    </div>
                    <div className="text-[11px] text-graphite-text-muted">
                      Select a bounding box area on screen to capture.
                    </div>
                  </div>
                  <kbd className="rounded-btn bg-graphite-surface px-2.5 py-1 text-xs font-mono text-graphite-text-primary border border-graphite-border">
                    {settings.shortcuts.captureRegion}
                  </kbd>
                </div>
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
                      Version 1.0.0 (Production Desktop Build)
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
                  <span>Windows 10 / 11 64-bit Compatible</span>
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
