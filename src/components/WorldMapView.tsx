import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';
import { MapCanvas, useMapCanvas } from './MapCanvas';

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

function DraggableLocation({
  loc,
  pos,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  loc: Location;
  pos: { x: number; y: number };
  dragging: boolean;
  onDragStart: (e: React.MouseEvent, id: string, offsetX: number, offsetY: number) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
}) {
  const ctx = useMapCanvas();
  const dragStartRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!ctx || !dragging) return;
    const handler = (e: MouseEvent) => {
      if (dragStartRef.current) {
        const { x, y } = ctx.screenToCanvas(e.clientX, e.clientY);
        onDragMove(loc.id, x - dragStartRef.current.offsetX, y - dragStartRef.current.offsetY);
      }
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [ctx, dragging, loc.id, onDragMove]);

  useEffect(() => {
    if (!dragging) return;
    const handler = () => {
      onDragEnd(loc.id);
      dragStartRef.current = null;
    };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [dragging, loc.id, onDragEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!ctx) return;
      const { x, y } = ctx.screenToCanvas(e.clientX, e.clientY);
      const offsetX = x - pos.x;
      const offsetY = y - pos.y;
      dragStartRef.current = { offsetX, offsetY };
      onDragStart(e, loc.id, offsetX, offsetY);
    },
    [ctx, loc.id, pos, onDragStart]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
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
        cursor: dragging ? 'grabbing' : 'grab',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {loc.name}
    </div>
  );
}

export function WorldMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
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

  const getPos = useCallback(
    (loc: Location) => ({
      x: loc.map_x ?? DEFAULT_X + locations.indexOf(loc) * 80,
      y: loc.map_y ?? DEFAULT_Y + (locations.indexOf(loc) % 3) * 60,
    }),
    [locations]
  );

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
          prev.map((l) => (l.id === id ? { ...l, map_x: x, map_y: y } : l))
        );
      } catch (e) {
        console.error(e);
      }
    },
    [currentBookId]
  );

  const handleDragStart = useCallback((_e: React.MouseEvent, id: string, _ox: number, _oy: number) => {
    setDragging(id);
  }, []);

  const handleDragMove = useCallback(
    (id: string, x: number, y: number) => {
      setLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, map_x: x, map_y: y } : l))
      );
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        savePosition(id, x, y);
        saveTimerRef.current = null;
      }, SAVE_DEBOUNCE);
    },
    [savePosition]
  );

  const handleDragEnd = useCallback(
    (id: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const loc = locations.find((l) => l.id === id);
        if (loc && loc.map_x != null && loc.map_y != null) {
          savePosition(id, loc.map_x, loc.map_y);
        }
        saveTimerRef.current = null;
      }
      setDragging(null);
    },
    [locations, savePosition]
  );

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
      >
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
        Карта мира: перетащите локации. Колёсико — зум, перетаскивание пустого места — панорама.
      </div>
      <MapCanvas>
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
          <>
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {locations
                .filter((loc) => loc.parent_id)
                .map((loc) => {
                  const parent = locations.find((l) => l.id === loc.parent_id!);
                  if (!parent) return null;
                  const from = getPos(loc);
                  const to = getPos(parent);
                  return (
                    <line
                      key={`${loc.id}-${parent.id}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      strokeOpacity={0.6}
                    />
                  );
                })}
            </svg>
            {locations.map((loc) => (
              <DraggableLocation
                key={loc.id}
                loc={loc}
                pos={getPos(loc)}
                dragging={dragging === loc.id}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            ))}
          </>
        )}
      </MapCanvas>
    </div>
  );
}
