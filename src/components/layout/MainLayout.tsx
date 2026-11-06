import React from 'react';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { useApp } from '@/context';
import { cn } from '@/utils';

export interface MainLayoutProps {
  children: React.ReactNode;
  previewPanel?: React.ReactNode;
  footer?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  previewPanel,
  footer,
}) => {
  const { isPreviewVisible } = useApp();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-graphite-bg text-graphite-text-primary select-none">
      {/* Top Application Header */}
      <AppHeader />

      {/* Main Three-Panel Body */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Center Main Workspace */}
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-graphite-bg">
          <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
            {children}
          </div>
        </main>

        {/* Right Preview Panel (Collapsible) */}
        {previewPanel && (
          <aside
            aria-label="Context Preview Panel"
            className={cn(
              'border-l border-graphite-border bg-graphite-sidebar transition-all duration-panel overflow-hidden shrink-0',
              isPreviewVisible ? 'w-[320px] lg:w-[350px] opacity-100' : 'w-0 opacity-0 pointer-events-none border-l-0'
            )}
          >
            <div className="h-full w-[320px] lg:w-[350px] overflow-y-auto">
              {previewPanel}
            </div>
          </aside>
        )}
      </div>

      {/* Optional App Footer */}
      {footer}
    </div>
  );
};

