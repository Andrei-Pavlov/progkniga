import { useEffect } from 'react';
import { ChapterEditor } from './ChapterEditor';
import { MindMapView } from './MindMapView';
import { TimelineView } from './TimelineView';
import { RelationshipMapView } from './RelationshipMapView';
import { WorldMapView } from './WorldMapView';

interface CenterPanelProps {
  viewMode: 'editor' | 'mindmap' | 'timeline' | 'relationships' | 'worldmap';
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

  const content =
    viewMode === 'mindmap' ? <MindMapView /> :
    viewMode === 'timeline' ? <TimelineView /> :
    viewMode === 'relationships' ? <RelationshipMapView /> :
    viewMode === 'worldmap' ? <WorldMapView /> :
    <ChapterEditor focusMode={focusMode} />;

  return (
    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}>
      {content}
    </div>
  );
}
