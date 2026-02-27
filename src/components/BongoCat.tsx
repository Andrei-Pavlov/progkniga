import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

const IMG = {
  cat: '/img/bongo-cat/cat.png',
  keyboard: '/img/bongo-cat/keyboard.png',
  pawLeft: '/img/bongo-cat/paw-left.png',
  pawRight: '/img/bongo-cat/paw-right.png',
};

export function BongoCat() {
  const enabled = useStore((s) => s.bongoCatEnabled);
  const [hit, setHit] = useState<'left' | 'right' | null>(null);
  const hitCount = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F5') return;
      hitCount.current += 1;
      setHit(hitCount.current % 2 === 0 ? 'left' : 'right');
      setTimeout(() => setHit(null), 100);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);

  if (!enabled) return null;

  const leftPawDown = hit === 'left';
  const rightPawDown = hit === 'right';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 900,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 180,
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
        }}
      >
        {/* Cat face */}
        <img
          src={IMG.cat}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
        />
        {/* Keyboard */}
        <img
          src={IMG.keyboard}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            marginTop: -8,
          }}
        />
        {/* Left paw - overlay, animated */}
        <img
          src={IMG.pawLeft}
          alt=""
          style={{
            position: 'absolute',
            left: '15%',
            bottom: '22%',
            width: '28%',
            height: 'auto',
            transform: leftPawDown ? 'translateY(8px)' : 'translateY(0)',
            transition: 'transform 0.05s ease-out',
          }}
        />
        {/* Right paw - overlay, animated */}
        <img
          src={IMG.pawRight}
          alt=""
          style={{
            position: 'absolute',
            right: '15%',
            bottom: '22%',
            width: '28%',
            height: 'auto',
            transform: rightPawDown ? 'translateY(8px)' : 'translateY(0)',
            transition: 'transform 0.05s ease-out',
          }}
        />
      </div>
    </div>
  );
}
