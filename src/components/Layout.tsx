import { useState, useEffect } from 'react';
import { LeftPanel } from './LeftPanel';
import { CenterPanel } from './CenterPanel';
import { RightPanel } from './RightPanel';
import { MainMenu } from './MainMenu';
import { SettingsModal } from './SettingsModal';
import { SearchOverlay } from './SearchOverlay';
import { BongoCat } from './BongoCat';
import { ToastContainer } from './Toast';
import { useStore } from '../store';

export function Layout() {
  const viewMode = useStore((s) => s.viewMode);
  const focusMode = useStore((s) => s.focusMode);
  const setFocusMode = useStore((s) => s.setFocusMode);
  const setLeftPanelCollapsed = useStore((s) => s.setLeftPanelCollapsed);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const [exportCallback, setExportCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          window.dispatchEvent(new Event('storyweaver-save-chapter'));
        }
        if (e.key === 'n') {
          e.preventDefault();
          setFocusMode(false);
          setLeftPanelCollapsed(false);
          setTimeout(() => window.dispatchEvent(new Event('storyweaver-new-chapter')), 150);
        }
        if (e.key === 'f') {
          e.preventDefault();
          if (e.shiftKey) {
            setFocusMode(!useStore.getState().focusMode);
          } else {
            setSearchOpen(true);
          }
        }
        if (e.key === ',') {
          e.preventDefault();
          setSettingsOpen(true);
        }
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSettingsOpen, setSearchOpen, setFocusMode, setLeftPanelCollapsed]);

  const hidePanels = focusMode && viewMode === 'editor';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {!hidePanels && <MainMenu onExportWord={exportCallback ?? undefined} />}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!hidePanels && <LeftPanel />}
        <CenterPanel viewMode={viewMode} onExportReady={setExportCallback} focusMode={hidePanels} />
        {!hidePanels && <RightPanel />}
      </div>
      <SettingsModal />
      <SearchOverlay />
      <ToastContainer />
      <BongoCat />
    </div>
  );
}
