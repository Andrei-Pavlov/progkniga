import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface MapCanvasContextValue {
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  screenToCanvas: (clientX: number, clientY: number) => { x: number; y: number };
}

const MapCanvasContext = createContext<MapCanvasContextValue | null>(null);

export function useMapCanvas() {
  const ctx = useContext(MapCanvasContext);
  return ctx;
}

export interface MapCanvasProps {
  children: React.ReactNode;
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Контейнер с zoom и pan. Все координаты — в пространстве canvas.
 * Дочерние компоненты могут использовать useMapCanvas() для screenToCanvas.
 */
export function MapCanvas({
  children,
  canvasWidth = 3000,
  canvasHeight = 3000,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [zoom, pan]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.3, Math.min(2, z + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      const isBg = t === containerRef.current || t.dataset?.mapCanvasBg === '1' || t.dataset?.mapCanvasContent === '1';
      if (isBg) {
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return;
      setPan({
        x: panStartRef.current.panX + e.clientX - panStartRef.current.x,
        y: panStartRef.current.panY + e.clientY - panStartRef.current.y,
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const ctxValue: MapCanvasContextValue = {
    containerRef,
    zoom,
    pan,
    screenToCanvas,
  };

  return (
    <MapCanvasContext.Provider value={ctxValue}>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: isPanning ? 'grabbing' : 'default',
        }}
      >
        <div
          data-map-canvas-bg="1"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-primary)',
            backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div
          data-map-canvas-content="1"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: canvasWidth,
            height: canvasHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
      </div>
    </MapCanvasContext.Provider>
  );
}
