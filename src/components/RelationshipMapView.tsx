import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useStore } from '../store';
import ForceGraph2D from 'react-force-graph-2d';

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

const NODE_R = 36;

interface GraphNode {
  id: string;
  name: string;
  avatar_url?: string | null;
  character: Character;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  relationship: Relationship;
}

export function RelationshipMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [factions, setFactions] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [editTypeA2B, setEditTypeA2B] = useState('');
  const [editTypeB2A, setEditTypeB2A] = useState('');
  const [editDescA2B, setEditDescA2B] = useState('');
  const [editDescB2A, setEditDescB2A] = useState('');
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, forceUpdate] = useState(0);

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

  const factionMap = useMemo(() => new Map(factions.map((f) => [f.id, f.name])), [factions]);
  const locationMap = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = characters.map((c, idx) => {
      const hasPos = c.map_x != null && c.map_y != null;
      const defaultX = (idx % 5) * 200 - 400;
      const defaultY = Math.floor(idx / 5) * 150 - 200;
      return {
        id: c.id,
        name: c.name,
        avatar_url: c.avatar_url,
        character: c,
        ...(hasPos ? { x: c.map_x!, y: c.map_y!, fx: c.map_x!, fy: c.map_y! } : { x: defaultX, y: defaultY }),
      };
    });
    const links: GraphLink[] = relationships.map((r) => ({
      id: r.id,
      source: r.character_a_id,
      target: r.character_b_id,
      relationship: r,
    }));
    return { nodes, links };
  }, [characters, relationships]);

  const savePosition = useCallback(
    async (characterId: string, x: number, y: number) => {
      try {
        await invoke('update_character_map_position', {
          character_id: characterId,
          map_x: x,
          map_y: y,
        });
        setCharacters((prev) =>
          prev.map((c) => (c.id === characterId ? { ...c, map_x: x, map_y: y } : c))
        );
      } catch (e) {
        console.error(e);
      }
    },
    []
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

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (connectMode) {
        if (!connectSourceId) {
          setConnectSourceId(node.id);
          return;
        }
        if (connectSourceId === node.id) {
          setConnectSourceId(null);
          return;
        }
        const exists = relationships.some(
          (r) =>
            (r.character_a_id === connectSourceId && r.character_b_id === node.id) ||
            (r.character_a_id === node.id && r.character_b_id === connectSourceId)
        );
        if (exists) {
          setConnectSourceId(null);
          setConnectMode(false);
          return;
        }
        invoke<string>('create_character_relationship', {
          bookId: currentBookId,
          characterAId: connectSourceId,
          characterBId: node.id,
          relationshipType: null,
          description: null,
        })
          .then((relId) => {
            setRelationships((prev) => [
              ...prev,
              {
                id: relId,
                character_a_id: connectSourceId,
                character_b_id: node.id,
                relationship_type: null,
                description: null,
                relationship_type_a_to_b: null,
                relationship_type_b_to_a: null,
                description_a_to_b: null,
                description_b_to_a: null,
              },
            ]);
          })
          .catch(console.error);
        setConnectSourceId(null);
        setConnectMode(false);
      } else {
        setSelectedNodeId(node.id);
        setSelectedRelId(null);
      }
    },
    [connectMode, connectSourceId, currentBookId, relationships]
  );

  const handleNodeRightClick = useCallback(
    (node: GraphNode, e: MouseEvent) => {
      e.preventDefault();
      handleAddAvatar(node.id);
    },
    [handleAddAvatar]
  );

  const handleNodeDragEnd = useCallback(
    (node: GraphNode) => {
      const n = node as GraphNode & { x?: number; y?: number };
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      savePosition(node.id, x, y);
    },
    [savePosition]
  );

  const handleLinkClick = useCallback((link: GraphLink) => {
    const r = link.relationship;
    setSelectedRelId(r.id);
    setSelectedNodeId(null);
    setEditTypeA2B(r.relationship_type_a_to_b ?? r.relationship_type ?? '');
    setEditTypeB2A(r.relationship_type_b_to_a ?? '');
    setEditDescA2B(r.description_a_to_b ?? r.description ?? '');
    setEditDescB2A(r.description_b_to_a ?? '');
  }, []);

  const selectedRel = relationships.find((r) => r.id === selectedRelId);
  const charAName = selectedRel
    ? characters.find((c) => c.id === selectedRel.character_a_id)?.name ?? ''
    : '';
  const charBName = selectedRel
    ? characters.find((c) => c.id === selectedRel.character_b_id)?.name ?? ''
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

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x?: number; y?: number };
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const isConnectSource = connectSourceId === node.id;
      const isSelected = selectedNodeId === node.id;
      const label = node.name;
      const fontSize = Math.max(14, 16 / globalScale);
      ctx.font = `600 ${fontSize}px Sans-Serif`;

      ctx.save();
      ctx.translate(x, y);

      ctx.beginPath();
      ctx.arc(0, -10, NODE_R, 0, 2 * Math.PI);
      ctx.fillStyle = 'var(--bg-tertiary)';
      ctx.fill();
      ctx.strokeStyle = isConnectSource || isSelected ? 'var(--accent)' : 'var(--border)';
      ctx.lineWidth = isConnectSource || isSelected ? 4 : 2;
      ctx.stroke();

      if (node.avatar_url) {
        let img = imgCache.current.get(node.avatar_url);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => forceUpdate((n) => n + 1);
          img.src = node.avatar_url;
          imgCache.current.set(node.avatar_url, img);
        }
        if (img.complete && img.naturalWidth) {
          ctx.beginPath();
          ctx.arc(0, -10, NODE_R - 2, 0, 2 * Math.PI);
          ctx.clip();
          ctx.drawImage(img, -NODE_R + 2, -10 - NODE_R + 2, (NODE_R - 2) * 2, (NODE_R - 2) * 2);
          ctx.restore();
          ctx.save();
          ctx.translate(x, y);
        } else {
          ctx.fillStyle = 'var(--text-secondary)';
          ctx.font = `24px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label.charAt(0).toUpperCase(), 0, -10);
        }
      } else {
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = `24px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.charAt(0).toUpperCase(), 0, -10);
      }

      const textWidth = ctx.measureText(label).width;
      const pad = 6;
      const boxW = textWidth + pad * 2;
      const boxH = fontSize + pad;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(-boxW / 2, NODE_R - 2, boxW, boxH);
      ctx.strokeStyle = 'var(--accent)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-boxW / 2, NODE_R - 2, boxW, boxH);
      ctx.fillStyle = 'var(--text-primary)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, 0, NODE_R + 2);

      ctx.restore();
    },
    [connectSourceId, selectedNodeId]
  );

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      const n = node as GraphNode & { x?: number; y?: number };
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      ctx.beginPath();
      ctx.arc(x, y - 10, NODE_R + 8, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const linkCanvasObject = useCallback(
    (
      link: GraphLink & { source?: { x?: number; y?: number }; target?: { x?: number; y?: number } },
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const src = link.source as { x?: number; y?: number };
      const tgt = link.target as { x?: number; y?: number };
      const x1 = src?.x ?? 0;
      const y1 = src?.y ?? 0;
      const x2 = tgt?.x ?? 0;
      const y2 = tgt?.y ?? 0;
      const r = link.relationship;
      const typeA2B = r.relationship_type_a_to_b ?? r.relationship_type;
      const typeB2A = r.relationship_type_b_to_a;
      const color =
        EDGE_COLORS[typeA2B || ''] || EDGE_COLORS[typeB2A || ''] || '#94a3b8';
      const isSelected = selectedRelId === link.id;
      const lineW = isSelected ? 5 : 4;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.globalAlpha = 1;
      ctx.stroke();

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const label = [typeA2B, typeB2A].filter(Boolean).join(' ↔ ') || 'Связь';
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `${fontSize}px Sans-Serif`;
      const tw = ctx.measureText(label).width;
      const pad = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(midX - tw / 2 - pad, midY - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
      ctx.restore();
    },
    [selectedRelId]
  );

  const linkPointerAreaPaint = useCallback(
    (
      link: GraphLink & { source?: { x?: number; y?: number }; target?: { x?: number; y?: number } },
      color: string,
      ctx: CanvasRenderingContext2D,
      _globalScale: number
    ) => {
      const src = link.source as { x?: number; y?: number };
      const tgt = link.target as { x?: number; y?: number };
      const x1 = src?.x ?? 0;
      const y1 = src?.y ?? 0;
      const x2 = tgt?.x ?? 0;
      const y2 = tgt?.y ?? 0;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
      ctx.fillStyle = color;
      ctx.fillRect(-len / 2, -12, len, 24);
      ctx.restore();
    },
    []
  );

  const nodeLabel = useCallback(
    (node: GraphNode) => {
      const c = node.character;
      const parts: string[] = [c.name];
      if (c.description) parts.push(c.description);
      if (c.faction_id && factionMap.has(c.faction_id))
        parts.push(`Фракция: ${factionMap.get(c.faction_id)}`);
      if (c.location_id && locationMap.has(c.location_id))
        parts.push(`Локация: ${locationMap.get(c.location_id)}`);
      if (c.role) parts.push(`Роль: ${ROLE_LABELS[c.role] || c.role}`);
      return parts.join('\n');
    },
    [factionMap, locationMap]
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
          Клик по узлу — выбрать. Клик по линии — изменить связь. Перетащите узлы, колёсико — зум.
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
        {selectedNodeId && (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {characters.find((c) => c.id === selectedNodeId)?.name}
            </span>
            <button
              onClick={() => {
                handleAddAvatar(selectedNodeId);
              }}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Добавить аватар
            </button>
            <button
              onClick={() => setSelectedNodeId(null)}
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
              Снять выбор
            </button>
          </>
        )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {charAName} ↔ {charBName}
            </span>
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
          <ForceGraph2D
            graphData={graphData}
            nodeId="id"
            linkSource="source"
            linkTarget="target"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode="replace"
            nodePointerAreaPaint={nodePointerAreaPaint}
            nodeLabel={nodeLabel}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode="replace"
            linkPointerAreaPaint={linkPointerAreaPaint}
            linkHoverPrecision={20}
            onNodeClick={(node) => handleNodeClick(node as GraphNode)}
            onNodeRightClick={(node, e) => handleNodeRightClick(node as GraphNode, e)}
            onNodeDragEnd={(node) => handleNodeDragEnd(node as GraphNode)}
            onLinkClick={(link) => handleLinkClick(link as GraphLink)}
            onBackgroundClick={() => {
              setSelectedRelId(null);
              setSelectedNodeId(null);
            }}
            backgroundColor="var(--bg-primary)"
            minZoom={0.2}
            maxZoom={4}
          />
        )}
      </div>
    </div>
  );
}
