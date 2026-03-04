import { useMemo } from 'react';

interface StatDef {
  id: string;
  name: string;
  max_value: number;
}

interface VersionData {
  id: string;
  label: string;
  values: Record<string, number>;
}

interface CharacterStatsRadarProps {
  stats: StatDef[];
  versions: VersionData[];
  selectedVersionId: string | null;
  size?: number;
}

/** Radar chart: круг = max, точки могут выходить за круг. Несколько версий = несколько полигонов. */
export function CharacterStatsRadar({
  stats,
  versions,
  selectedVersionId,
  size = 220,
}: CharacterStatsRadarProps) {
  const { polygons, maxRadius, axisPoints } = useMemo(() => {
    if (stats.length === 0) return { polygons: [], maxRadius: 0, axisPoints: [] };

    const center = size / 2;
    const maxRadius = size * 0.35;
    const angleStep = (2 * Math.PI) / stats.length;

    const axisPoints = stats.map((s, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      return {
        id: s.id,
        name: s.name,
        max: s.max_value,
        x: center + maxRadius * Math.cos(angle),
        y: center + maxRadius * Math.sin(angle),
        angle,
      };
    });

    const valueToRadius = (statId: string, value: number) => {
      const stat = stats.find((s) => s.id === statId);
      if (!stat) return 0;
      const r = (value / stat.max_value) * maxRadius;
      return r;
    };

    const polygons = versions.map((v) => {
      const isSelected = v.id === selectedVersionId;
      const points = axisPoints
        .map((a) => {
          const val = v.values[a.id] ?? 0;
          const r = valueToRadius(a.id, val);
          const x = center + r * Math.cos(a.angle);
          const y = center + r * Math.sin(a.angle);
          return `${x},${y}`;
        })
        .join(' ');
      return { id: v.id, points, isSelected };
    });

    return { polygons, maxRadius, axisPoints };
  }, [stats, versions, selectedVersionId, size]);

  if (stats.length === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
        Добавьте статы в книге
      </div>
    );
  }

  const center = size / 2;
  const rings = 5;

  return (
    <svg width={size} height={size} style={{ display: 'block', overflow: 'visible' }} viewBox={`0 0 ${size} ${size}`}>
      {/* Концентрические кольца (макс = граница круга) */}
      {Array.from({ length: rings }).map((_, i) => {
        const r = (maxRadius * (i + 1)) / rings;
        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.5}
            opacity={0.6}
          />
        );
      })}

      {/* Оси */}
      {axisPoints.map((a) => (
        <line
          key={a.id}
          x1={center}
          y1={center}
          x2={a.x}
          y2={a.y}
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.6}
        />
      ))}

      {/* Полигоны версий (невыбранные — бледнее) */}
      {polygons.map((p) => (
        <polygon
          key={p.id}
          points={p.points}
          fill={p.isSelected ? 'var(--accent)' : 'var(--accent)'}
          fillOpacity={p.isSelected ? 0.35 : 0.12}
          stroke="var(--accent)"
          strokeWidth={p.isSelected ? 2 : 1}
          strokeOpacity={p.isSelected ? 1 : 0.5}
        />
      ))}

      {/* Подписи */}
      {axisPoints.map((a) => (
        <text
          key={a.id}
          x={center + (maxRadius + 18) * Math.cos(a.angle)}
          y={center + (maxRadius + 18) * Math.sin(a.angle)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="var(--text-secondary)"
        >
          {a.name}
        </text>
      ))}
    </svg>
  );
}
