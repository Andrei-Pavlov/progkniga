import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useStore } from '../store';
import { MapCanvas, useMapCanvas } from './MapCanvas';

const RELATIONSHIP_TYPES = [
  'Друг', 'Враг', 'Семья', 'Любовь', 'Влюблённость', 'Соратник', 'Противник',
  'Наставник', 'Опека', 'Благодарность', 'Поддержка', 'Уважение', 'Раздражение',
  'Зависть', 'Вражда', 'Презрение', 'Страсть', 'Страх', 'Братская любовь', 'Другое',
];

const LINE_TYPES = [
  { value: 'solid', label: 'Сплошная' },
  { value: 'dashed', label: 'Пунктирная' },
];

const PRESET_COLORS = [
  '#ec4899', '#f472b6', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6', '#ef4444',
  '#7c3aed', '#f59e0b', '#eab308', '#94a3b8', '#78716c', '#0ea5e9',
];

const EDGE_COLORS: Record<string, string> = {
  Любовь: '#ec4899', Влюблённость: '#f472b6', Страсть: '#db2777',
  Друг: '#22c55e', Соратник: '#10b981', Семья: '#3b82f6', Опека: '#6366f1',
  Благодарность: '#8b5cf6', Поддержка: '#a78bfa', Уважение: '#94a3b8',
  Враг: '#ef4444', Противник: '#dc2626', Вражда: '#7c3aed', Презрение: '#64748b',
  Раздражение: '#f59e0b', Зависть: '#eab308', Страх: '#78716c', Наставник: '#0ea5e9',
  'Братская любовь': '#3b82f6', Другое: '#94a3b8',
};

interface Character {
  id: string;
  name: string;
  description?: string | null;
  faction_id?: string | null;
  location_id?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  map_x?: number | null;
  map_y?: number | null;
}

interface Relationship {
  id: string;
  character_a_id: string;
  character_b_id: string;
  relationship_type: string | null;
  description: string | null;
  relationship_type_a_to_b?: string | null;
  relationship_type_b_to_a?: string | null;
  description_a_to_b?: string | null;
  description_b_to_a?: string | null;
  line_color?: string | null;
  line_type?: string | null;
}

interface Faction {
  id: string;
  name: string;
}

const SAVE_DEBOUNCE = 500;

function CharacterNode({
  char,
  pos,
  selected,
  connectSource,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onClick,
  onAddAvatar,
}: {
  char: Character;
  pos: { x: number; y: number };
  selected: boolean;
  connectSource: boolean;
  dragging: boolean;
  onDragStart: (e: React.MouseEvent, id: string, ox: number, oy: number) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onClick: (id: string) => void;
  onAddAvatar: (id: string) => void;
}) {
  const ctx = useMapCanvas();
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!ctx || !dragging) return;
    const h = (e: MouseEvent) => {
      if (dragRef.current) {
        const { x, y } = ctx.screenToCanvas(e.clientX, e.clientY);
        onDragMove(char.id, x - dragRef.current.ox, y - dragRef.current.oy);
      }
    };
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, [ctx, dragging, char.id, onDragMove]);

  useEffect(() => {
    if (!dragging) return;
    const h = () => {
      onDragEnd(char.id);
      dragRef.current = null;
    };
    window.addEventListener('mouseup', h);
    return () => window.removeEventListener('mouseup', h);
  }, [dragging, char.id, onDragEnd]);

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!ctx) return;
      const { x, y } = ctx.screenToCanvas(e.clientX, e.clientY);
      dragRef.current = { ox: x - pos.x, oy: y - pos.y };
      onDragStart(e, char.id, dragRef.current.ox, dragRef.current.oy);
    },
    [ctx, char.id, pos, onDragStart]
  );

  return (
    <div
      onMouseDown={onDown}
      onClick={(e) => {
        e.stopPropagation();
        onClick(char.id);
      }}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        width: 64,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--bg-tertiary)',
          border: selected || connectSource ? '3px solid var(--accent)' : '2px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {char.avatar_url ? (
          <img src={char.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-secondary)',
            }}
          >
            {char.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textAlign: 'center',
          background: 'rgba(0,0,0,0.6)',
          padding: '2px 6px',
          borderRadius: 4,
        }}
      >
        {char.name}
      </div>
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddAvatar(char.id);
          }}
          style={{
            marginTop: 4,
            width: '100%',
            padding: '4px 8px',
            fontSize: 11,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          + Аватар
        </button>
      )}
    </div>
  );
}

export function RelationshipMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [editTypeA2B, setEditTypeA2B] = useState('');
  const [editTypeB2A, setEditTypeB2A] = useState('');
  const [editDescA2B, setEditDescA2B] = useState('');
  const [editDescB2A, setEditDescB2A] = useState('');
  const [editLineColor, setEditLineColor] = useState('#94a3b8');
  const [editLineType, setEditLineType] = useState('solid');
  const [collapsedA, setCollapsedA] = useState(false);
  const [collapsedB, setCollapsedB] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      const [chars, rels, facs] = await Promise.all([
        invoke<Character[]>('get_characters', { bookId: currentBookId }),
        invoke<Relationship[]>('get_character_relationships', { bookId: currentBookId }),
        invoke<Faction[]>('get_factions', { bookId: currentBookId }),
      ]);
      setCharacters(chars);
      setRelationships(rels);
      setFactions(facs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentBookId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const posMap = useCallback(
    (c: Character) => {
      const i = characters.indexOf(c);
      const dx = 150;
      const dy = 120;
      return {
        x: c.map_x ?? 80 + (i % 4) * dx,
        y: c.map_y ?? 80 + Math.floor(i / 4) * dy,
      };
    },
    [characters]
  );

  const getLineColor = useCallback((r: Relationship) => {
    if (r.line_color) return r.line_color;
    const typeA2B = r.relationship_type_a_to_b ?? r.relationship_type;
    const typeB2A = r.relationship_type_b_to_a;
    return EDGE_COLORS[typeA2B || ''] || EDGE_COLORS[typeB2A || ''] || '#94a3b8';
  }, []);

  const factionGroups = useMemo(() => {
    const map = new Map<string, Character[]>();
    characters.forEach((c) => {
      if (c.faction_id) {
        const list = map.get(c.faction_id) ?? [];
        list.push(c);
        map.set(c.faction_id, list);
      }
    });
    return Array.from(map.entries())
      .filter(([, list]) => list.length >= 2)
      .map(([fid, list]) => ({ factionId: fid, chars: list }));
  }, [characters]);

  const savePos = useCallback(async (id: string, x: number, y: number) => {
    try {
      await invoke('update_character_map_position', { character_id: id, map_x: x, map_y: y });
      setCharacters((p) => p.map((c) => (c.id === id ? { ...c, map_x: x, map_y: y } : c)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const onDragStart = useCallback((_e: React.MouseEvent, id: string) => {
    setDragging(id);
  }, []);

  const onDragMove = useCallback(
    (id: string, x: number, y: number) => {
      setCharacters((p) => p.map((c) => (c.id === id ? { ...c, map_x: x, map_y: y } : c)));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => savePos(id, x, y), SAVE_DEBOUNCE);
    },
    [savePos]
  );

  const onDragEnd = useCallback(
    (id: string) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const c = characters.find((x) => x.id === id);
        if (c?.map_x != null && c?.map_y != null) savePos(id, c.map_x, c.map_y);
        saveTimer.current = null;
      }
      setDragging(null);
    },
    [characters, savePos]
  );

  const onNodeClick = useCallback(
    (id: string) => {
      if (connectMode) {
        if (!connectSourceId) {
          setConnectSourceId(id);
          return;
        }
        if (connectSourceId === id) {
          setConnectSourceId(null);
          return;
        }
        const exists = relationships.some(
          (r) =>
            (r.character_a_id === connectSourceId && r.character_b_id === id) ||
            (r.character_a_id === id && r.character_b_id === connectSourceId)
        );
        if (exists) {
          setConnectSourceId(null);
          setConnectMode(false);
          return;
        }
        invoke<string>('create_character_relationship', {
          bookId: currentBookId,
          characterAId: connectSourceId,
          characterBId: id,
          relationshipType: null,
          description: null,
        })
          .then((relId) => {
            setRelationships((p) => [
              ...p,
              {
                id: relId,
                character_a_id: connectSourceId,
                character_b_id: id,
                relationship_type: null,
                description: null,
                relationship_type_a_to_b: null,
                relationship_type_b_to_a: null,
                description_a_to_b: null,
                description_b_to_a: null,
                line_color: null,
                line_type: null,
              },
            ]);
          })
          .catch(console.error);
        setConnectSourceId(null);
        setConnectMode(false);
      } else {
        setSelectedNodeId(id);
        setSelectedRelId(null);
      }
    },
    [connectMode, connectSourceId, currentBookId, relationships]
  );

  const onAddAvatar = useCallback(async (id: string) => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      });
      if (path && typeof path === 'string') {
        const dataUrl = await invoke<string>('read_file_as_base64', { path });
        await invoke('update_character_avatar', { characterId: id, avatarUrl: dataUrl });
        setCharacters((p) => p.map((c) => (c.id === id ? { ...c, avatar_url: dataUrl } : c)));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const selectedRel = relationships.find((r) => r.id === selectedRelId);
  const charA = selectedRel ? characters.find((c) => c.id === selectedRel.character_a_id) : null;
  const charB = selectedRel ? characters.find((c) => c.id === selectedRel.character_b_id) : null;
  const charAName = charA?.name ?? '';
  const charBName = charB?.name ?? '';

  const openRelPanel = useCallback((r: Relationship) => {
    setSelectedRelId(r.id);
    setSelectedNodeId(null);
    setEditTypeA2B(r.relationship_type_a_to_b ?? r.relationship_type ?? '');
    setEditTypeB2A(r.relationship_type_b_to_a ?? '');
    setEditDescA2B(r.description_a_to_b ?? r.description ?? '');
    setEditDescB2A(r.description_b_to_a ?? '');
    setEditLineColor(getLineColor(r));
    setEditLineType(r.line_type || 'solid');
    setCollapsedA(false);
    setCollapsedB(false);
  }, [getLineColor]);

  const saveEdge = useCallback(async () => {
    if (!selectedRelId) return;
    try {
      await invoke('update_character_relationship_bidirectional', {
        relationship_id: selectedRelId,
        relationship_type_a_to_b: editTypeA2B.trim(),
        relationship_type_b_to_a: editTypeB2A.trim(),
        description_a_to_b: editDescA2B.trim(),
        description_b_to_a: editDescB2A.trim(),
        line_color: editLineColor,
        line_type: editLineType,
      });
      setRelationships((p) =>
        p.map((r) =>
          r.id === selectedRelId
            ? {
                ...r,
                relationship_type_a_to_b: editTypeA2B.trim() || null,
                relationship_type_b_to_a: editTypeB2A.trim() || null,
                description_a_to_b: editDescA2B.trim() || null,
                description_b_to_a: editDescB2A.trim() || null,
                line_color: editLineColor,
                line_type: editLineType,
              }
            : r
        )
      );
      setSelectedRelId(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedRelId, editTypeA2B, editTypeB2A, editDescA2B, editDescB2A, editLineColor, editLineType]);

  const deleteEdge = useCallback(async () => {
    if (!selectedRelId) return;
    try {
      await invoke('delete_character_relationship', { relationshipId: selectedRelId });
      setRelationships((p) => p.filter((r) => r.id !== selectedRelId));
      setSelectedRelId(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedRelId]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Загрузка...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-header)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Клик по узлу — выбрать, «+ Аватар» — фото. Клик по линии — панель связи.
          </span>
          <button
            onClick={() => {
              setConnectMode((v) => !v);
              setConnectSourceId(null);
              setSelectedNodeId(null);
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: connectMode ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: connectMode ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {connectMode ? (connectSourceId ? 'Выберите второго' : 'Выберите первого') : 'Связать'}
          </button>
          {connectMode && (
            <button onClick={() => { setConnectMode(false); setConnectSourceId(null); }} style={{ padding: '6px 12px', fontSize: 12, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
              Отмена
            </button>
          )}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {!currentBookId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 15 }}>
              Выберите книгу
            </div>
          ) : characters.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 15 }}>
              <div>Добавьте персонажей в базе мира</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Нажмите «Связать» и выберите двух персонажей</div>
            </div>
          ) : (
            <MapCanvas canvasWidth={1200} canvasHeight={800}>
              <div
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedRelId(null);
                }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {factionGroups.map(({ factionId, chars: list }) => {
                    const faction = factions.find((f) => f.id === factionId);
                    if (!faction || list.length < 2) return null;
                    const positions = list.map((c) => posMap(c));
                    const minX = Math.min(...positions.map((p) => p.x)) - 50;
                    const maxX = Math.max(...positions.map((p) => p.x)) + 50;
                    const minY = Math.min(...positions.map((p) => p.y)) - 60;
                    const maxY = Math.max(...positions.map((p) => p.y)) + 60;
                    return (
                      <g key={factionId}>
                        <rect
                          x={minX}
                          y={minY}
                          width={maxX - minX}
                          height={maxY - minY}
                          rx={12}
                          ry={12}
                          fill="rgba(59, 130, 246, 0.08)"
                          stroke="rgba(59, 130, 246, 0.5)"
                          strokeWidth={2}
                        />
                        <text x={minX + 8} y={minY - 8} fontSize={11} fill="var(--text-secondary)" fontWeight={600}>
                          {faction.name.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                  {relationships.map((r) => {
                    const a = characters.find((c) => c.id === r.character_a_id);
                    const b = characters.find((c) => c.id === r.character_b_id);
                    if (!a || !b) return null;
                    const p1 = posMap(a);
                    const p2 = posMap(b);
                    const color = getLineColor(r);
                    const dash = (r.line_type || 'solid') === 'dashed' ? '8,4' : 'none';
                    const isSelected = selectedRelId === r.id;
                    const typeA2B = r.relationship_type_a_to_b ?? r.relationship_type ?? '';
                    const typeB2A = r.relationship_type_b_to_a ?? '';
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const ux = dx / len;
                    const uy = dy / len;
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    const labelOffset = 12;
                    const posA2B = { x: midX + ux * labelOffset, y: midY + uy * labelOffset };
                    const posB2A = { x: midX - ux * labelOffset, y: midY - uy * labelOffset };
                    const angle = Math.atan2(dy, dx);
                    const deg = (angle * 180) / Math.PI;
                    return (
                      <g key={r.id}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke={color}
                          strokeWidth={isSelected ? 5 : 3}
                          strokeOpacity={0.95}
                          strokeDasharray={dash}
                        />
                        {typeA2B && (
                          <g transform={`translate(${posA2B.x}, ${posA2B.y}) rotate(${deg})`}>
                            <text fontSize={10} fill={color} textAnchor="middle" fontWeight={600}>
                              {typeA2B} →
                            </text>
                          </g>
                        )}
                        {typeB2A && (
                          <g transform={`translate(${posB2A.x}, ${posB2A.y}) rotate(${deg + 180})`}>
                            <text fontSize={10} fill={color} textAnchor="middle" fontWeight={600}>
                              {typeB2A} →
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'stroke', cursor: 'pointer' }}>
                  {relationships.map((r) => {
                    const a = characters.find((c) => c.id === r.character_a_id);
                    const b = characters.find((c) => c.id === r.character_b_id);
                    if (!a || !b) return null;
                    const p1 = posMap(a);
                    const p2 = posMap(b);
                    return (
                      <line
                        key={r.id}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="transparent"
                        strokeWidth={24}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRelPanel(r);
                        }}
                      />
                    );
                  })}
                </svg>
                {characters.map((c) => (
                  <CharacterNode
                    key={c.id}
                    char={c}
                    pos={posMap(c)}
                    selected={selectedNodeId === c.id}
                    connectSource={connectSourceId === c.id}
                    dragging={dragging === c.id}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                    onClick={onNodeClick}
                    onAddAvatar={onAddAvatar}
                  />
                ))}
              </div>
            </MapCanvas>
          )}
        </div>
      </div>
      {selectedRelId && charA && charB && (
        <div
          style={{
            width: 320,
            minWidth: 320,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-header)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {charAName} & {charBName}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Тип линии</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={editLineType}
                  onChange={(e) => setEditLineType(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}
                >
                  {LINE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => setEditLineColor(hex)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: hex,
                        border: editLineColor === hex ? '2px solid white' : '1px solid var(--border)',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setCollapsedA(!collapsedA)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                Точка зрения {charAName}
                <span>{collapsedA ? '▶' : '▼'}</span>
              </button>
              {!collapsedA && (
                <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--accent)' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Чувство</label>
                  <select
                    value={editTypeA2B}
                    onChange={(e) => setEditTypeA2B(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', marginBottom: 8 }}
                  >
                    <option value="">—</option>
                    {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Детали</label>
                  <textarea
                    value={editDescA2B}
                    onChange={(e) => setEditDescA2B(e.target.value)}
                    placeholder="Описание чувств и отношений..."
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setCollapsedB(!collapsedB)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                Точка зрения {charBName}
                <span>{collapsedB ? '▶' : '▼'}</span>
              </button>
              {!collapsedB && (
                <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--accent)' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Чувство</label>
                  <select
                    value={editTypeB2A}
                    onChange={(e) => setEditTypeB2A(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', marginBottom: 8 }}
                  >
                    <option value="">—</option>
                    {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Детали</label>
                  <textarea
                    value={editDescB2A}
                    onChange={(e) => setEditDescB2A(e.target.value)}
                    placeholder="Описание чувств и отношений..."
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={saveEdge} style={{ flex: 1, padding: '10px 16px', fontSize: 13, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Сохранить
              </button>
              <button onClick={deleteEdge} style={{ padding: '10px 16px', fontSize: 13, background: 'var(--error)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Удалить
              </button>
              <button onClick={() => setSelectedRelId(null)} style={{ padding: '10px 16px', fontSize: 13, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
