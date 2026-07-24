import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(48, Math.max(22, Math.floor((w * h) / 38000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.8,
        a: 0.15 + Math.random() * 0.35,
      }));
    };

    const drawOrb = (x: number, y: number, radius: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, color.replace('ALPHA', String(alpha)));
      g.addColorStop(1, color.replace('ALPHA', '0'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const frame = () => {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);

      // Soft drifting indigo / violet orbs (app accent family)
      drawOrb(
        w * 0.2 + Math.sin(t * 0.7) * 40,
        h * 0.2 + Math.cos(t * 0.5) * 30,
        Math.max(w, h) * 0.42,
        'rgba(99, 102, 241, ALPHA)',
        0.16
      );
      drawOrb(
        w * 0.82 + Math.cos(t * 0.55) * 50,
        h * 0.28 + Math.sin(t * 0.65) * 35,
        Math.max(w, h) * 0.36,
        'rgba(129, 140, 248, ALPHA)',
        0.12
      );
      drawOrb(
        w * 0.55 + Math.sin(t * 0.4) * 60,
        h * 0.85 + Math.cos(t * 0.45) * 40,
        Math.max(w, h) * 0.4,
        'rgba(67, 56, 202, ALPHA)',
        0.1
      );

      // Subtle grid drift
      ctx.save();
      ctx.strokeStyle = 'rgba(39, 39, 42, 0.55)';
      ctx.lineWidth = 1;
      const gap = 56;
      const ox = (t * 12) % gap;
      const oy = (t * 8) % gap;
      ctx.beginPath();
      for (let x = -gap + ox; x < w + gap; x += gap) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = -gap + oy; y < h + gap; y += gap) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      ctx.restore();

      // Particles + links
      for (const p of particles) {
        p.x += p.vx + Math.sin(t + p.y * 0.01) * 0.05;
        p.y += p.vy + Math.cos(t + p.x * 0.01) * 0.05;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.12 * (1 - dist / 130)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = `rgba(228, 228, 231, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    frame();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="bg-stage" aria-hidden>
      <canvas ref={canvasRef} className="bg-canvas" />
      <div className="bg-vignette" />
      <div className="bg-scan" />
    </div>
  );
}
