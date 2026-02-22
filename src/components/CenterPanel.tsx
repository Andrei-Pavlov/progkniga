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

  if (viewMode === 'mindmap') return <MindMapView />;
  if (viewMode === 'timeline') return <TimelineView />;
  if (viewMode === 'relationships') return <RelationshipMapView />;
  if (viewMode === 'worldmap') return <WorldMapView />;
  return <ChapterEditor focusMode={focusMode} />;
}
