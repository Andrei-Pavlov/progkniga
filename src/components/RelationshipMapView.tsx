import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useStore } from '../store';
import { MapCanvas, useMapCanvas } from './MapCanvas';

const RELATIONSHIP_TYPES = [
  'Друг',
  'Враг',
  'Семья',
  'Любовь',
  'Влюблённость',
  'Соратник',
  'Противник',
  'Наставник',
  'Опека',
  'Благодарность',
  'Поддержка',
  'Уважение',
  'Раздражение',
  'Зависть',
  'Вражда',
  'Презрение',
  'Страсть',
  'Страх',
  'Другое',
];

const ROLE_LABELS: Record<string, string> = {
  protagonist: 'Протагонист',
  antagonist: 'Антагонист',
  supporting: 'Второстепенный',
  minor: 'Эпизодический',
};

const EDGE_COLORS: Record<string, string> = {
  Любовь: '#ec4899',
  Влюблённость: '#f472b6',
  Страсть: '#db2777',
  Друг: '#22c55e',
  Соратник: '#10b981',
  Семья: '#3b82f6',
  Опека: '#6366f1',
  Благодарность: '#8b5cf6',
  Поддержка: '#a78bfa',
  Уважение: '#94a3b8',
  Враг: '#ef4444',
  Противник: '#dc2626',
  Вражда: '#7c3aed',
  Презрение: '#64748b',
  Раздражение: '#f59e0b',
  Зависть: '#eab308',
  Страх: '#78716c',
  Наставник: '#0ea5e9',
  Другое: '#94a3b8',
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
}

const NODE_SIZE = 72;
const SAVE_DEBOUNCE = 500;

function DraggableCharacterNode({
  char,
  pos,
  factionName,
  locationName,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAddAvatar,
  onNodeClick,
  connectMode,
  isConnectSource,
}: {
  char: Character;
  pos: { x: number; y: number };
  factionName?: string;
  locationName?: string;
  dragging: boolean;
  onDragStart: (e: React.MouseEvent, id: string, offsetX: number, offsetY: number) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  onAddAvatar: (characterId: string) => void;
  onNodeClick: (id: string) => void;
  connectMode: boolean;
  isConnectSource: boolean;
}) {
  const ctx = useMapCanvas();
  const dragStartRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const hasInfo = char.description || factionName || locationName || char.role;

  useEffect(() => {
    if (!ctx || !dragging) return;
    const handler = (e: MouseEvent) => {
      if (dragStartRef.current) {
        const { x, y } = ctx.screenToCanvas(e.clientX, e.clientY);
        onDragMove(char.id, x - dragStartRef.current.offsetX, y - dragStartRef.current.offsetY);
      }
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [ctx, dragging, char.id, onDragMove]);

  useEffect(() => {
    if (!dragging) return;
    const handler = () => {
      onDragEnd(char.id);
      dragStartRef.current = null;
    };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [dragging, char.id, onDragEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!ctx) return;
      if (connectMode) {
        onNodeClick(char.id);
        return;
      }
      const { x, y } = ctx.screenToCanvas(e.clientX, e.clientY);
      const offsetX = x - pos.x;
      const offsetY = y - pos.y;
      dragStartRef.current = { offsetX, offsetY };
      onDragStart(e, char.id, offsetX, offsetY);
    },
    [ctx, char.id, pos, onDragStart, onNodeClick, connectMode]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowTooltip(!!hasInfo)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: connectMode ? 'pointer' : dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: NODE_SIZE,
          height: NODE_SIZE,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--bg-tertiary)',
          border: isConnectSource ? '4px solid var(--accent)' : '3px solid var(--accent)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          flexShrink: 0,
        }}
      >
        {char.avatar_url ? (
          <img
            src={char.avatar_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {char.name.charAt(0).toUpperCase()}
          </div>
        )}
        {!connectMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddAvatar(char.id);
            }}
            title="Добавить аватар"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            +
          </button>
        )}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textAlign: 'center',
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {char.name}
      </div>
      {showTooltip && hasInfo && (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: '100%',
            marginTop: 4,
            padding: 10,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontSize: 12,
            color: 'var(--text-primary)',
            maxWidth: 220,
            whiteSpace: 'pre-wrap',
          }}
        >
          {char.description && <div style={{ marginBottom: 6 }}>{char.description}</div>}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {factionName && <div>Фракция: {factionName}</div>}
            {locationName && <div>Локация: {locationName}</div>}
            {char.role && <div>Роль: {ROLE_LABELS[char.role] || char.role}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function RelationshipMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [factions, setFactions] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [editTypeA2B, setEditTypeA2B] = useState('');
  const [editTypeB2A, setEditTypeB2A] = useState('');
  const [editDescA2B, setEditDescA2B] = useState('');
  const [editDescB2A, setEditDescB2A] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      const [chars, rels, facs, locs] = await Promise.all([
        invoke<Character[]>('get_characters', { bookId: currentBookId }),
        invoke<Relationship[]>('get_character_relationships', { bookId: currentBookId }),
        invoke<{ id: string; name: string }[]>('get_factions', { bookId: currentBookId }),
        invoke<{ id: string; name: string }[]>('get_locations', { bookId: currentBookId }),
      ]);
      setCharacters(chars);
      setRelationships(rels);
      setFactions(facs);
      setLocations(locs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentBookId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const factionMap = new Map(factions.map((f) => [f.id, f.name]));
  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  const getPos = useCallback(
    (char: Character) => {
      const idx = characters.indexOf(char);
      const defaultX = 200 + (idx % 5) * 180;
      const defaultY = 200 + Math.floor(idx / 5) * 140;
      return {
        x: char.map_x ?? defaultX,
        y: char.map_y ?? defaultY,
      };
    },
    [characters]
  );

  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    characters.forEach((c) => m.set(c.id, getPos(c)));
    return m;
  }, [characters, getPos]);

  const savePosition = useCallback(
    async (characterId: string, x: number, y: number) => {
      try {
        await invoke('update_character_map_position', {
          character_id: characterId,
          map_x: x,
          map_y: y,
        });
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  const handleDragStart = useCallback((_e: React.MouseEvent, id: string, _ox: number, _oy: number) => {
    setDragging(id);
  }, []);

  const handleDragMove = useCallback(
    (id: string, x: number, y: number) => {
      setCharacters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, map_x: x, map_y: y } : c))
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
        const char = characters.find((c) => c.id === id);
        if (char && char.map_x != null && char.map_y != null) {
          savePosition(id, char.map_x, char.map_y);
        }
        saveTimerRef.current = null;
      }
      setDragging(null);
    },
    [characters, savePosition]
  );

  const handleAddAvatar = useCallback(async (characterId: string) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      });
      if (selected && typeof selected === 'string') {
        const dataUrl = await invoke<string>('read_file_as_base64', { path: selected });
        await invoke('update_character_avatar', { characterId, avatarUrl: dataUrl });
        setCharacters((prev) =>
          prev.map((c) => (c.id === characterId ? { ...c, avatar_url: dataUrl } : c))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleNodeClickInConnectMode = useCallback(
    async (id: string) => {
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
      try {
        const relId = await invoke<string>('create_character_relationship', {
          bookId: currentBookId,
          characterAId: connectSourceId,
          characterBId: id,
          relationshipType: null,
          description: null,
        });
        setRelationships((prev) => [
          ...prev,
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
          },
        ]);
      } catch (e) {
        console.error(e);
      }
      setConnectSourceId(null);
      setConnectMode(false);
    },
    [connectSourceId, currentBookId, relationships]
  );

  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (connectMode) return;
      if ((e.target as HTMLElement).closest('[data-relationship-node]')) return;
      setSelectedRelId(null);
    },
    [connectMode]
  );

  const selectedRel = relationships.find((r) => r.id === selectedRelId);
  const edgeData = selectedRel
    ? {
        id: selectedRel.id,
        charAId: selectedRel.character_a_id,
        charBId: selectedRel.character_b_id,
      }
    : null;
  const charAName = edgeData
    ? characters.find((c) => c.id === edgeData.charAId)?.name ?? ''
    : '';
  const charBName = edgeData
    ? characters.find((c) => c.id === edgeData.charBId)?.name ?? ''
    : '';

  const saveEdgeEdit = useCallback(async () => {
    if (!selectedRelId) return;
    try {
      await invoke('update_character_relationship_bidirectional', {
        relationship_id: selectedRelId,
        relationship_type_a_to_b: editTypeA2B.trim(),
        relationship_type_b_to_a: editTypeB2A.trim(),
        description_a_to_b: editDescA2B.trim(),
        description_b_to_a: editDescB2A.trim(),
      });
      setRelationships((prev) =>
        prev.map((r) =>
          r.id === selectedRelId
            ? {
                ...r,
                relationship_type_a_to_b: editTypeA2B.trim() || null,
                relationship_type_b_to_a: editTypeB2A.trim() || null,
                description_a_to_b: editDescA2B.trim() || null,
                description_b_to_a: editDescB2A.trim() || null,
              }
            : r
        )
      );
      setSelectedRelId(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedRelId, editTypeA2B, editTypeB2A, editDescA2B, editDescB2A]);

  const deleteSelectedEdge = useCallback(async () => {
    if (!selectedRelId) return;
    try {
      await invoke('delete_character_relationship', { relationshipId: selectedRelId });
      setRelationships((prev) => prev.filter((r) => r.id !== selectedRelId));
      setSelectedRelId(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedRelId]);

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-header)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Карта отношений: перетащите узлы. Колёсико — зум, перетаскивание пустого места — панорама.
        </span>
        <button
          onClick={() => {
            setConnectMode((v) => !v);
            setConnectSourceId(null);
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
          {connectMode
            ? connectSourceId
              ? 'Кликните второго персонажа'
              : 'Кликните первого персонажа'
            : 'Связать'}
        </button>
        {connectMode && (
          <button
            onClick={() => {
              setConnectMode(false);
              setConnectSourceId(null);
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
        )}
        {selectedRelId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {charAName} ↔ {charBName}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={editTypeA2B}
                onChange={(e) => setEditTypeA2B(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  minWidth: 120,
                }}
              >
                <option value="">— {charAName} → {charBName}</option>
                {RELATIONSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={editDescA2B}
                onChange={(e) => setEditDescA2B(e.target.value)}
                placeholder="Описание"
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  width: 100,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={editTypeB2A}
                onChange={(e) => setEditTypeB2A(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  minWidth: 120,
                }}
              >
                <option value="">— {charBName} → {charAName}</option>
                {RELATIONSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={editDescB2A}
                onChange={(e) => setEditDescB2A(e.target.value)}
                placeholder="Описание"
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  width: 100,
                }}
              />
            </div>
            <button
              onClick={saveEdgeEdit}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Сохранить
            </button>
            <button
              onClick={deleteSelectedEdge}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: 'var(--error)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Удалить
            </button>
            <button
              onClick={() => setSelectedRelId(null)}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {!currentBookId ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              fontSize: 15,
            }}
          >
            Выберите книгу в левой панели
          </div>
        ) : characters.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              fontSize: 15,
            }}
          >
            <div>Добавьте персонажей в базе мира (правая панель)</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Нажмите «Связать» и выберите двух персонажей для создания связи
            </div>
          </div>
        ) : (
          <MapCanvas canvasWidth={2000} canvasHeight={2000}>
            <div
              onClick={handlePaneClick}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
              }}
            >
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
                {relationships.map((r) => {
                  const a = posMap.get(r.character_a_id);
                  const b = posMap.get(r.character_b_id);
                  if (!a || !b) return null;
                  const typeA2B = r.relationship_type_a_to_b ?? r.relationship_type;
                  const typeB2A = r.relationship_type_b_to_a;
                  const color =
                    EDGE_COLORS[typeA2B || ''] || EDGE_COLORS[typeB2A || ''] || '#94a3b8';
                  return (
                    <line
                      key={r.id}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={color}
                      strokeWidth={selectedRelId === r.id ? 4 : 2}
                      strokeOpacity={selectedRelId === r.id ? 1 : 0.8}
                    />
                  );
                })}
              </svg>
              <svg
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'stroke',
                  cursor: 'pointer',
                }}
              >
                {relationships.map((r) => {
                  const a = posMap.get(r.character_a_id);
                  const b = posMap.get(r.character_b_id);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={r.id}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={16}
                      data-rel-id={r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRelId(r.id);
                        const typeA2B = r.relationship_type_a_to_b ?? r.relationship_type ?? '';
                        const typeB2A = r.relationship_type_b_to_a ?? '';
                        setEditTypeA2B(typeA2B);
                        setEditTypeB2A(typeB2A);
                        setEditDescA2B(r.description_a_to_b ?? r.description ?? '');
                        setEditDescB2A(r.description_b_to_a ?? '');
                      }}
                    />
                  );
                })}
              </svg>
              {characters.map((char) => (
                <div key={char.id} data-relationship-node="1">
                  <DraggableCharacterNode
                    char={char}
                    pos={getPos(char)}
                    factionName={char.faction_id ? factionMap.get(char.faction_id) : undefined}
                    locationName={char.location_id ? locationMap.get(char.location_id) : undefined}
                    dragging={dragging === char.id}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onAddAvatar={handleAddAvatar}
                    onNodeClick={handleNodeClickInConnectMode}
                    connectMode={connectMode}
                    isConnectSource={connectSourceId === char.id}
                  />
                </div>
              ))}
            </div>
          </MapCanvas>
        )}
      </div>
    </div>
  );
}
