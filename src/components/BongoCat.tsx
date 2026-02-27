import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

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

  const leftPawY = hit === 'left' ? 78 : 68;
  const rightPawY = hit === 'right' ? 78 : 68;

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
      <svg
        width={180}
        height={110}
        viewBox="0 0 180 110"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
      >
        {/* Keyboard */}
        <rect x={15} y={82} width={150} height={24} rx={4} fill="#2a2a2a" stroke="#444" strokeWidth={1} />
        <rect x={20} y={87} width={140} height={14} rx={2} fill="#1a1a1a" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
          <rect key={i} x={25 + i * 10} y={89} width={7} height={10} rx={1} fill="#333" />
        ))}

        {/* Cat face */}
        <ellipse cx={90} cy={40} rx={38} ry={32} fill="#f0e6d8" stroke="#d4c4a8" strokeWidth={2} />
        <ellipse cx={52} cy={22} rx={14} ry={20} fill="#f0e6d8" stroke="#d4c4a8" strokeWidth={2} transform="rotate(-25 52 22)" />
        <ellipse cx={128} cy={22} rx={14} ry={20} fill="#f0e6d8" stroke="#d4c4a8" strokeWidth={2} transform="rotate(25 128 22)" />
        <ellipse cx={78} cy={37} rx={5} ry={6} fill="#333" />
        <ellipse cx={102} cy={37} rx={5} ry={6} fill="#333" />
        <ellipse cx={90} cy={48} rx={7} ry={5} fill="#333" />

        {/* Left arm + paw */}
        <line x1={58} y1={58} x2={38} y2={leftPawY} stroke="#d4c4a8" strokeWidth={5} strokeLinecap="round" style={{ transition: 'all 0.05s' }} />
        <ellipse cx={38} cy={leftPawY} rx={14} ry={10} fill="#f0e6d8" stroke="#d4c4a8" strokeWidth={1.5} style={{ transition: 'all 0.05s' }} />

        {/* Right arm + paw */}
        <line x1={122} y1={58} x2={142} y2={rightPawY} stroke="#d4c4a8" strokeWidth={5} strokeLinecap="round" style={{ transition: 'all 0.05s' }} />
        <ellipse cx={142} cy={rightPawY} rx={14} ry={10} fill="#f0e6d8" stroke="#d4c4a8" strokeWidth={1.5} style={{ transition: 'all 0.05s' }} />
      </svg>
    </div>
  );
}
