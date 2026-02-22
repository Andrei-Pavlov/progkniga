import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';

interface Location {
  id: string;
  name: string;
  parent_id: string | null;
  map_x: number | null;
  map_y: number | null;
}

const DEFAULT_X = 400;
const DEFAULT_Y = 300;
const SAVE_DEBOUNCE = 500;

export function WorldMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLocations = useCallback(async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      const locs = await invoke<Location[]>('get_locations', { bookId: currentBookId });
      setLocations(locs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentBookId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const getPos = (loc: Location) => ({
    x: loc.map_x ?? DEFAULT_X + locations.indexOf(loc) * 80,
    y: loc.map_y ?? DEFAULT_Y + (locations.indexOf(loc) % 3) * 60,
  });

  const savePosition = useCallback(
    async (id: string, x: number, y: number) => {
      if (!currentBookId) return;
      try {
        await invoke('update_location_map_position', {
          locationId: id,
          mapX: x,
          mapY: y,
        });
        setLocations((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, map_x: x, map_y: y } : l
          )
        );
      } catch (e) {
        console.error(e);
      }
    },
    [currentBookId]
  );

  const getContainerRect = useCallback(() => {
    if (!containerRef.current) return { left: 0, top: 0 };
    const r = containerRef.current.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, loc: Location) => {
      e.preventDefault();
      const pos = getPos(loc);
      const rect = getContainerRect();
      setDragging(loc.id);
      setDragOffset({
        x: e.clientX - rect.left - pos.x,
        y: e.clientY - rect.top - pos.y,
      });
    },
    [locations, getContainerRect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      const loc = locations.find((l) => l.id === dragging);
      if (!loc) return;
      const rect = getContainerRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;
      setLocations((prev) =>
        prev.map((l) =>
          l.id === dragging ? { ...l, map_x: newX, map_y: newY } : l
        )
      );
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        savePosition(dragging, newX, newY);
        saveTimerRef.current = null;
      }, SAVE_DEBOUNCE);
    },
    [dragging, dragOffset, locations, savePosition, getContainerRect]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      const loc = locations.find((l) => l.id === dragging);
      if (loc && loc.map_x != null && loc.map_y != null) {
        savePosition(dragging, loc.map_x, loc.map_y);
      }
      saveTimerRef.current = null;
    }
    setDragging(null);
  }, [dragging, locations, savePosition]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Загрузка...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-header)',
          fontSize: 14,
          color: 'var(--text-secondary)',
        }}
      >
        Карта мира: перетащите локации для размещения на карте
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          background:
            'radial-gradient(circle at 50% 50%, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
        }}
        onMouseLeave={handleMouseUp}
      >
        {locations.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--text-secondary)',
              fontSize: 15,
            }}
          >
            Добавьте локации в базе мира
          </div>
        ) : (
          locations.map((loc) => {
            const pos = getPos(loc);
            return (
              <div
                key={loc.id}
                onMouseDown={(e) => handleMouseDown(e, loc)}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, -50%)',
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '2px solid var(--accent)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  cursor: dragging === loc.id ? 'grabbing' : 'grab',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {loc.name}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
