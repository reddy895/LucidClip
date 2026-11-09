import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  NavigationSection,
  HistoryItem,
  ClipboardEntry,
  ScreenshotEntry,
  SearchFilterType,
  SortOrder,
  AppSettings,
  CaptureType,
  ScreenshotRegion,
} from '@/types';
import {
  clipboardService,
  screenshotService,
  settingsService,
  storageService,
  isTauri,
  StorageStats,
  DEFAULT_SETTINGS,
} from '@/services';
import { listen } from '@tauri-apps/api/event';
import { useToast } from './ToastContext';

interface AppContextValue {
  // Navigation & Layout
  activeSection: NavigationSection;
  setActiveSection: (sec: NavigationSection) => void;
  selectedItem: HistoryItem | null;
  setSelectedItem: (item: HistoryItem | null) => void;
  isPreviewVisible: boolean;
  setIsPreviewVisible: (visible: boolean) => void;
  togglePreview: () => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Search & Filter
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchFilter: SearchFilterType;
  setSearchFilter: (f: SearchFilterType) => void;
  sortOrder: SortOrder;
  setSortOrder: (s: SortOrder) => void;

  // Quick Access
  isQuickAccessOpen: boolean;
  setIsQuickAccessOpen: (open: boolean) => void;
  openQuickAccess: () => void;
  closeQuickAccess: () => void;

  // Data
  clipboardItems: ClipboardEntry[];
  screenshotItems: ScreenshotEntry[];
  unifiedHistory: HistoryItem[];
  settings: AppSettings;
  storageStats: StorageStats | null;
  isLoading: boolean;

  // Actions
  refreshData: () => Promise<void>;
  copyItem: (item: HistoryItem) => Promise<boolean>;
  togglePin: (item: HistoryItem) => Promise<void>;
  toggleFavorite: (item: HistoryItem) => Promise<void>;
  deleteItem: (item: HistoryItem) => Promise<boolean>;
  clearClipboardHistory: () => Promise<void>;
  captureScreenshot: (type: CaptureType) => Promise<void>;
  regionCaptureSource: ScreenshotEntry | null;
  cancelRegionCapture: () => Promise<void>;
  confirmRegionCapture: (region: ScreenshotRegion) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  toggleMonitoring: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();

  const [activeSection, setActiveSection] = useState<NavigationSection>('all');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);

  const [clipboardItems, setClipboardItems] = useState<ClipboardEntry[]>([]);
  const [screenshotItems, setScreenshotItems] = useState<ScreenshotEntry[]>([]);
  const [regionCaptureSource, setRegionCaptureSource] = useState<ScreenshotEntry | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [clips, shots, currentSettings, stats] = await Promise.all([
        clipboardService.getHistory(),
        screenshotService.getScreenshots(),
        settingsService.getSettings(),
        storageService.getStorageUsage(),
      ]);

      setClipboardItems(clips);
      setScreenshotItems(shots);
      setSettings(currentSettings);
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to load application data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen('clipboard://new-entry', () => {
      void refreshData();
    })
      .then((dispose) => {
        if (cancelled) {
          dispose();
        } else {
          unlisten = dispose;
        }
      })
      .catch((err) => {
        console.error('[LucidClip] Failed to subscribe to clipboard events', err);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshData]);

  const togglePreview = () => setIsPreviewVisible((prev) => !prev);
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const openQuickAccess = () => setIsQuickAccessOpen(true);
  const closeQuickAccess = () => setIsQuickAccessOpen(false);

  const reportActionError = (action: string, err: unknown) => {
    console.error(`[LucidClip] ${action} failed`, err);
    toast.error(`${action} failed. Please try again.`);
  };

  const copyItem = async (item: HistoryItem): Promise<boolean> => {
    try {
      if (item.kind === 'clipboard') {
        const success = await clipboardService.copyToClipboard(item.content);
        if (success) {
          toast.success('Copied to clipboard.');
        } else {
          toast.error('Failed to copy to clipboard.');
        }
        return success;
      }

      const success = await screenshotService.copyImageToClipboard(item.id);
      if (success) {
        toast.success('Screenshot copied to clipboard.');
      } else {
        toast.error('Failed to copy screenshot to clipboard.');
      }
      return success;
    } catch (err) {
      reportActionError('Copy', err);
      return false;
    }
  };

  const togglePin = async (item: HistoryItem) => {
    try {
      if (item.kind === 'clipboard') {
        const updated = await clipboardService.togglePin(item.id);
        setClipboardItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (selectedItem?.id === updated.id) {
          setSelectedItem({ kind: 'clipboard', ...updated });
        }
        toast.info(updated.isPinned ? 'Item pinned.' : 'Item unpinned.');
      } else {
        const updated = await screenshotService.togglePin(item.id);
        setScreenshotItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        if (selectedItem?.id === updated.id) {
          setSelectedItem({ kind: 'screenshot', ...updated });
        }
        toast.info(updated.isPinned ? 'Screenshot pinned.' : 'Screenshot unpinned.');
      }
    } catch (err) {
      reportActionError('Pin update', err);
    }
  };

  const toggleFavorite = async (item: HistoryItem) => {
    try {
      if (item.kind === 'clipboard') {
        const updated = await clipboardService.toggleFavorite(item.id);
        setClipboardItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (selectedItem?.id === updated.id) {
          setSelectedItem({ kind: 'clipboard', ...updated });
        }
        toast.info(updated.isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
      } else {
        const updated = await screenshotService.toggleFavorite(item.id);
        setScreenshotItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        if (selectedItem?.id === updated.id) {
          setSelectedItem({ kind: 'screenshot', ...updated });
        }
        toast.info(updated.isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
      }
    } catch (err) {
      reportActionError('Favorite update', err);
    }
  };

  const deleteItem = async (item: HistoryItem): Promise<boolean> => {
    try {
      if (item.kind === 'clipboard') {
        const success = await clipboardService.deleteEntry(item.id);
        if (success) {
          setClipboardItems((prev) => prev.filter((c) => c.id !== item.id));
          if (selectedItem?.id === item.id) setSelectedItem(null);
          toast.info('Item deleted.');
        } else {
          toast.error('Failed to delete item.');
        }
        return success;
      }

      const success = await screenshotService.deleteScreenshot(item.id);
      if (success) {
        setScreenshotItems((prev) => prev.filter((s) => s.id !== item.id));
        if (selectedItem?.id === item.id) setSelectedItem(null);
        toast.info('Screenshot deleted.');
      } else {
        toast.error('Failed to delete screenshot.');
      }
      return success;
    } catch (err) {
      reportActionError('Delete', err);
      return false;
    }
  };

  const clearClipboardHistory = async () => {
    try {
      await clipboardService.clearHistory();
      const updated = await clipboardService.getHistory();
      setClipboardItems(updated);
      if (selectedItem?.kind === 'clipboard' && !selectedItem.isPinned) {
        setSelectedItem(null);
      }
      toast.info('Clipboard history cleared (pinned preserved).');
    } catch (err) {
      reportActionError('Clear clipboard history', err);
    }
  };

  const captureScreenshot = async (type: CaptureType) => {
    try {
      if (type === 'region') {
        const source = await screenshotService.beginRegionCapture();
        setRegionCaptureSource(source);
        return;
      }

      const shot = await screenshotService.captureScreen(type);
      setScreenshotItems((prev) => [shot, ...prev]);
      setSelectedItem({ kind: 'screenshot', ...shot });
      toast.success('Screenshot saved.');
    } catch (err) {
      reportActionError('Screenshot capture', err);
      throw err;
    }
  };

  const cancelRegionCapture = async () => {
    const source = regionCaptureSource;
    setRegionCaptureSource(null);
    if (!source) return;

    try {
      await screenshotService.deleteScreenshot(source.id);
    } catch (err) {
      console.error('[LucidClip] Failed to discard region capture source', err);
    }
  };

  const confirmRegionCapture = async (region: ScreenshotRegion) => {
    const source = regionCaptureSource;
    if (!source) return;

    try {
      const shot = await screenshotService.cropScreenshot(source.id, region, true);
      setScreenshotItems((prev) => [
        shot,
        ...prev.filter((item) => item.id !== source.id),
      ]);
      setRegionCaptureSource(null);
      setSelectedItem({ kind: 'screenshot', ...shot });
      toast.success('Region screenshot saved.');
    } catch (err) {
      reportActionError('Region capture', err);
      throw err;
    }
  };

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const updated = await settingsService.updateSettings(partial);
    setSettings(updated);
    toast.info('Settings saved.');
  };

  const resetSettings = async () => {
    const reset = await settingsService.resetToDefaults();
    setSettings(reset);
    toast.info('Settings reset to defaults.');
  };

  const toggleMonitoring = async () => {
    const nextState = !settings.clipboard.monitoringEnabled;
    const updated = await settingsService.updateSettings({
      clipboard: { ...settings.clipboard, monitoringEnabled: nextState },
      privacy: { ...settings.privacy, pauseMonitoring: !nextState },
    });
    setSettings(updated);
    toast.info(nextState ? 'Monitoring active.' : 'Monitoring paused.');
  };

  const unifiedHistory: HistoryItem[] = [
    ...clipboardItems.map((c) => ({ kind: 'clipboard' as const, ...c })),
    ...screenshotItems.map((s) => ({ kind: 'screenshot' as const, ...s })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        selectedItem,
        setSelectedItem,
        isPreviewVisible,
        setIsPreviewVisible,
        togglePreview,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        searchQuery,
        setSearchQuery,
        searchFilter,
        setSearchFilter,
        sortOrder,
        setSortOrder,
        isQuickAccessOpen,
        setIsQuickAccessOpen,
        openQuickAccess,
        closeQuickAccess,
        clipboardItems,
        screenshotItems,
        unifiedHistory,
        settings,
        storageStats,
        isLoading,
        refreshData,
        copyItem,
        togglePin,
        toggleFavorite,
        deleteItem,
        clearClipboardHistory,
        captureScreenshot,
        regionCaptureSource,
        cancelRegionCapture,
        confirmRegionCapture,
        updateSettings,
        resetSettings,
        toggleMonitoring,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

