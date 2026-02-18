import { useEffect } from 'react';
import { ChapterEditor } from './ChapterEditor';
import { MindMapView } from './MindMapView';
import { TimelineView } from './TimelineView';

interface CenterPanelProps {
  viewMode: 'editor' | 'mindmap' | 'timeline';
  onExportReady?: (cb: (() => void) | null) => void;
  focusMode?: boolean;
}

export function CenterPanel({ viewMode, onExportReady, focusMode }: CenterPanelProps) {
  useEffect(() => {
    if (viewMode === 'editor') {
      onExportReady?.(() => {
        const ev = new CustomEvent('storyweaver-export-word');
        window.dispatchEvent(ev);
      });
    } else {
      onExportReady?.(null);
    }
    return () => onExportReady?.(null);
  }, [viewMode, onExportReady]);

  if (viewMode === 'mindmap') {
    return <MindMapView />;
  }
  if (viewMode === 'timeline') {
    return <TimelineView />;
  }
  return <ChapterEditor focusMode={focusMode} />;
}
