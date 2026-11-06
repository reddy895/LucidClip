import React from 'react';
import {
  LayoutGrid,
  ClipboardList,
  Camera,
  Pin,
  Star,
  Settings,
  HardDrive,
} from 'lucide-react';
import { useApp } from '@/context';
import { NavigationSection } from '@/types';
import { SidebarItem } from './SidebarItem';
import { cn, formatBytes } from '@/utils';
import { Tooltip } from '@/components/ui';

export const Sidebar: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    clipboardItems,
    screenshotItems,
    unifiedHistory,
    isSidebarCollapsed,
    storageStats,
  } = useApp();

  const pinnedCount = unifiedHistory.filter((i) => i.isPinned).length;
  const favoriteCount = unifiedHistory.filter((i) => i.isFavorite).length;

  const navItems: {
    id: NavigationSection;
    label: string;
    icon: React.ReactNode;
    count?: number;
    shortcut?: string;
  }[] = [
    {
      id: 'all',
      label: 'All Items',
      icon: <LayoutGrid className="h-4 w-4" />,
      count: unifiedHistory.length,
      shortcut: 'Ctrl+1',
    },
    {
      id: 'clipboard',
      label: 'Clipboard',
      icon: <ClipboardList className="h-4 w-4" />,
      count: clipboardItems.length,
      shortcut: 'Ctrl+2',
    },
    {
      id: 'screenshots',
      label: 'Screenshots',
      icon: <Camera className="h-4 w-4" />,
      count: screenshotItems.length,
      shortcut: 'Ctrl+3',
    },
    {
      id: 'pinned',
      label: 'Pinned',
      icon: <Pin className="h-4 w-4" />,
      count: pinnedCount,
      shortcut: 'Ctrl+4',
    },
    {
      id: 'favorites',
      label: 'Favorites',
      icon: <Star className="h-4 w-4" />,
      count: favoriteCount,
      shortcut: 'Ctrl+5',
    },
  ];

  const totalBytes =
    (storageStats?.dbSizeBytes ?? 0) + (storageStats?.screenshotStorageBytes ?? 0);

  return (
    <aside
      className={cn(
        'flex h-full flex-col justify-between border-r border-graphite-border bg-graphite-sidebar transition-all duration-panel select-none shrink-0',
        isSidebarCollapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      {/* Top Header / Brand */}
      <div>
        <div
          className={cn(
            'flex h-12 items-center border-b border-graphite-border px-3.5',
            isSidebarCollapsed ? 'justify-center px-0' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Custom minimalist logo icon */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-[#191C20] border border-graphite-border text-accent">
              <svg
                width="15"
                height="15"
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

            {!isSidebarCollapsed && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[13.5px] font-semibold tracking-tight text-graphite-text-primary">
                  LucidClip
                </span>
                <span className="rounded bg-graphite-surface px-1 py-0.2 text-[10px] font-mono text-graphite-text-muted border border-graphite-border-subtle">
                  v1.0
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Primary Navigation List */}
        <nav className="flex flex-col gap-0.5 p-2" aria-label="Main Navigation">
          {navItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              count={item.count}
              shortcut={item.shortcut}
              isCollapsed={isSidebarCollapsed}
              isActive={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
        </nav>
      </div>

      {/* Bottom Footer Section */}
      <div className="border-t border-graphite-border p-2 flex flex-col gap-1">
        {/* Storage info pill */}
        {!isSidebarCollapsed ? (
          <div className="mb-1 flex items-center justify-between rounded-btn bg-graphite-surface px-2.5 py-1.5 text-[11px] text-graphite-text-secondary border border-graphite-border-subtle">
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-graphite-text-muted" />
              <span>Storage</span>
            </div>
            <span className="font-mono text-[10px] text-graphite-text-muted">
              {formatBytes(totalBytes)}
            </span>
          </div>
        ) : (
          <Tooltip content={`Storage: ${formatBytes(totalBytes)}`} side="right">
            <div className="flex h-8 w-full items-center justify-center text-graphite-text-muted">
              <HardDrive className="h-4 w-4" />
            </div>
          </Tooltip>
        )}

        {/* Settings row */}
        <SidebarItem
          id="settings"
          label="Settings"
          icon={<Settings className="h-4 w-4" />}
          shortcut="Ctrl+,"
          isCollapsed={isSidebarCollapsed}
          isActive={activeSection === 'settings'}
          onClick={() => setActiveSection('settings')}
        />
      </div>
    </aside>
  );
};
