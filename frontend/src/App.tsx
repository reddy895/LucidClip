import React, { useEffect } from 'react';
import { ToastProvider, AppProvider, useApp } from '@/context';
import { MainLayout, AppFooter } from '@/components/layout';
import { PreviewPanel } from '@/components/preview';
import { QuickAccessOverlay } from '@/components/quick-access';
import { useDesktopShortcuts } from '@/hooks';
import {
  AllItemsView,
  ClipboardView,
  ScreenshotsView,
  PinnedView,
  FavoritesView,
  SettingsView,
} from '@/pages';

const AppContent: React.FC = () => {
  const { activeSection, setIsSidebarCollapsed, setIsPreviewVisible } = useApp();

  // Initialize global desktop keyboard shortcuts
  useDesktopShortcuts();

  // Responsive desktop window resize listener for standard Windows resolutions
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Below 1280px width, collapse preview panel initially to prevent horizontal crunch
      if (width < 1200) {
        setIsPreviewVisible(false);
      }
      // Below 960px width, collapse sidebar
      if (width < 960) {
        setIsSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsSidebarCollapsed, setIsPreviewVisible]);

  const renderActiveView = () => {
    switch (activeSection) {
      case 'all':
        return <AllItemsView />;
      case 'clipboard':
        return <ClipboardView />;
      case 'screenshots':
        return <ScreenshotsView />;
      case 'pinned':
        return <PinnedView />;
      case 'favorites':
        return <FavoritesView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <AllItemsView />;
    }
  };

  return (
    <>
      <MainLayout
        previewPanel={activeSection !== 'settings' ? <PreviewPanel /> : undefined}
        footer={<AppFooter />}
      >
        {renderActiveView()}
      </MainLayout>

      {/* Floating Quick Access Overlay */}
      <QuickAccessOverlay />
    </>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}
