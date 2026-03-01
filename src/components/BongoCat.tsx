import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

// luinbytes/bongocat — кот; ayangweb/BongoCat — клавиатура
const IMG = {
  rest: '/img/bongo-cat/cat-rest.png',
  left: '/img/bongo-cat/cat-left.png',
  right: '/img/bongo-cat/cat-right.png',
  keyboard: '/img/bongo-cat/background.png',
};

export function BongoCat() {
  const enabled = useStore((s) => s.bongoCatEnabled);
  const position = useStore((s) => s.bongoCatPosition);
  const setPosition = useStore((s) => s.setBongoCatPosition);
  const [pose, setPose] = useState<'rest' | 'left' | 'right'>('rest');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; elX: number; elY: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F5') return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPose((prev) => (prev === 'left' ? 'right' : 'left'));
      timeoutRef.current = setTimeout(() => {
        setPose('rest');
        timeoutRef.current = null;
      }, 80);
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget.getBoundingClientRect();
    dragStartRef.current = { x: e.clientX, y: e.clientY, elX: el.left, elY: el.top };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setPosition({ x: start.elX + dx, y: start.elY + dy });
    };
    const onUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, setPosition]);

  if (!enabled) return null;

  const src = IMG[pose];

  const CARD_WIDTH = 264;
  const CARD_HEIGHT = 220;
  const defaultX = typeof window !== 'undefined' ? (window.innerWidth - CARD_WIDTH) / 2 : 0;
  const defaultY = typeof window !== 'undefined' ? window.innerHeight - 16 - CARD_HEIGHT : 0;
  const x = position?.x ?? defaultX;
  const y = position?.y ?? defaultY;

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 900,
        userSelect: 'none',
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: 12,
          borderRadius: 12,
          background: 'rgba(30, 30, 36, 0.95)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          cursor: isDragging ? 'grabbing' : 'grab',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ position: 'relative', width: 240 }}>
          {/* Клавиатура — сначала (слой ниже) */}
          <img
            src={IMG.keyboard}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              opacity: 1,
            }}
          />
          {/* Кот — поверх клавиатуры, только кот крутится */}
          <img
            src={src}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              marginTop: -163,
              position: 'relative',
              zIndex: 1,
              transform: 'rotate(-3deg)',
              transformOrigin: 'bottom center',
            }}
          />
        </div>
      </div>
    </div>
  );
}
