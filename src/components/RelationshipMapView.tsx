import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useStore } from '../store';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

interface CharacterNodeData {
  label: string;
  avatarUrl?: string | null;
  description?: string | null;
  factionName?: string;
  locationName?: string;
  role?: string | null;
  onAddAvatar?: (characterId: string) => void;
  characterId?: string;
}

function CharacterNode({ data }: { data: CharacterNodeData }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hasInfo = data.description || data.factionName || data.locationName || data.role;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
      onMouseEnter={() => setShowTooltip(!!hasInfo)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          position: 'relative',
          width: 72,
          height: 72,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--bg-tertiary)',
          border: '3px solid var(--accent)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          flexShrink: 0,
        }}
      >
        <Handle type="target" position={Position.Top} id="top" style={{ top: 0, width: 14, height: 14 }} />
        <Handle type="target" position={Position.Left} id="left" style={{ left: 0, width: 14, height: 14 }} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={{ bottom: 0, width: 14, height: 14 }} />
        <Handle type="source" position={Position.Right} id="right" style={{ right: 0, width: 14, height: 14 }} />
        {data.avatarUrl ? (
          <img
            src={data.avatarUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
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
            {data.label.charAt(0).toUpperCase()}
          </div>
        )}
        {data.onAddAvatar && data.characterId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onAddAvatar?.(data.characterId!);
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
        {data.label}
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
          {data.description && <div style={{ marginBottom: 6 }}>{data.description}</div>}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {data.factionName && <div>Фракция: {data.factionName}</div>}
            {data.locationName && <div>Локация: {data.locationName}</div>}
            {data.role && <div>Роль: {ROLE_LABELS[data.role] || data.role}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function RelationshipMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [editTypeA2B, setEditTypeA2B] = useState('');
  const [editTypeB2A, setEditTypeB2A] = useState('');
  const [editDescA2B, setEditDescA2B] = useState('');
  const [editDescB2A, setEditDescB2A] = useState('');

  const handleAddAvatar = useCallback(
    async (characterId: string) => {
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
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === characterId) {
                return { ...n, data: { ...n.data, avatarUrl: dataUrl } };
              }
              return n;
            })
          );
        }
      } catch (e) {
        console.error(e);
      }
    },
    [setNodes]
  );

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      character: (props) => (
        <CharacterNode
          {...props}
          data={{
            ...props.data,
            onAddAvatar: handleAddAvatar,
            characterId: props.id,
          }}
        />
      ),
    }),
    [handleAddAvatar]
  );

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

      const factionMap = new Map(facs.map((f) => [f.id, f.name]));
      const locationMap = new Map(locs.map((l) => [l.id, l.name]));

      const posMap = new Map<string, { x: number; y: number }>();
      let x = 0,
        y = 0;
      const getPos = (id: string) => {
        if (!posMap.has(id)) {
          posMap.set(id, { x: x * 180, y: y * 140 });
          x++;
          if (x > 4) {
            x = 0;
            y++;
          }
        }
        return posMap.get(id)!;
      };

      rels.forEach((r) => {
        getPos(r.character_a_id);
        getPos(r.character_b_id);
      });
      chars.forEach((c) => getPos(c.id));

      const nodeList: Node[] = chars.map((c) => {
        const pos = getPos(c.id);
        return {
          id: c.id,
          type: 'character',
          position: pos,
          data: {
            label: c.name,
            avatarUrl: c.avatar_url,
            description: c.description,
            factionName: c.faction_id ? factionMap.get(c.faction_id) : undefined,
            locationName: c.location_id ? locationMap.get(c.location_id) : undefined,
            role: c.role,
          },
        };
      });

      setNodes((prev) => {
        const posMap = new Map(prev.map((n) => [n.id, n.position]));
        return nodeList.map((n) => ({
          ...n,
          position: posMap.get(n.id) ?? n.position,
        }));
      });

      const edgeList: Edge[] = rels.map((r) => {
        const typeA2B = r.relationship_type_a_to_b ?? r.relationship_type;
        const typeB2A = r.relationship_type_b_to_a;
        const color = EDGE_COLORS[typeA2B || ''] || EDGE_COLORS[typeB2A || ''] || '#94a3b8';
        const labelParts = [typeA2B, typeB2A].filter(Boolean);
        return {
          id: r.id,
          source: r.character_a_id,
          target: r.character_b_id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: 2 },
          label: labelParts.length ? labelParts.join(' ↔ ') : '',
          labelStyle: { fill: 'var(--text-primary)', fontSize: 11 },
          labelBgStyle: { fill: 'var(--bg-tertiary)', fillOpacity: 0.9 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 6,
          data: {
            typeA2B: typeA2B || undefined,
            typeB2A: typeB2A || undefined,
            descA2B: r.description_a_to_b ?? r.description ?? undefined,
            descB2A: r.description_b_to_a ?? undefined,
            characterAId: r.character_a_id,
            characterBId: r.character_b_id,
          },
        };
      });

      setEdges(edgeList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentBookId, setNodes, setEdges]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onConnect = useCallback(
    async (params: Connection) => {
      if (!currentBookId || !params.source || !params.target) return;
      if (params.source === params.target) return;
      const sourceId = params.source;
      const targetId = params.target;
      const exists = edges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      );
      if (exists) return;
      try {
        const relId = await invoke<string>('create_character_relationship', {
          bookId: currentBookId,
          characterAId: sourceId,
          characterBId: targetId,
          relationshipType: null,
          description: null,
        });
        setEdges((eds) => [
          ...eds,
          {
            id: relId,
            source: sourceId,
            target: targetId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            label: '',
            labelStyle: { fill: 'var(--text-primary)', fontSize: 11 },
            labelBgStyle: { fill: 'var(--bg-tertiary)', fillOpacity: 0.9 },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 6,
            data: {
              typeA2B: undefined,
              typeB2A: undefined,
              descA2B: undefined,
              descB2A: undefined,
              characterAId: sourceId < targetId ? sourceId : targetId,
              characterBId: sourceId < targetId ? targetId : sourceId,
            },
          },
        ]);
      } catch (e) {
        console.error(e);
      }
    },
    [currentBookId, edges, setEdges]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    const d = (edge.data || {}) as Record<string, string | undefined>;
    setEditTypeA2B(d.typeA2B || '');
    setEditTypeB2A(d.typeB2A || '');
    setEditDescA2B(d.descA2B || '');
    setEditDescB2A(d.descB2A || '');
  }, []);

  const saveEdgeEdit = useCallback(async () => {
    if (!selectedEdge) return;
    try {
      await invoke('update_character_relationship_bidirectional', {
        relationship_id: selectedEdge.id,
        relationship_type_a_to_b: editTypeA2B.trim(),
        relationship_type_b_to_a: editTypeB2A.trim(),
        description_a_to_b: editDescA2B.trim(),
        description_b_to_a: editDescB2A.trim(),
      });
      const labelParts = [editTypeA2B.trim(), editTypeB2A.trim()].filter(Boolean);
      const newLabel = labelParts.length ? labelParts.join(' ↔ ') : '';
      const newColor = EDGE_COLORS[editTypeA2B.trim()] || EDGE_COLORS[editTypeB2A.trim()] || '#94a3b8';

      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdge.id
            ? {
                ...e,
                label: newLabel,
                data: {
                  ...e.data,
                  typeA2B: editTypeA2B.trim() || undefined,
                  typeB2A: editTypeB2A.trim() || undefined,
                  descA2B: editDescA2B.trim() || undefined,
                  descB2A: editDescB2A.trim() || undefined,
                },
                style: {
                  ...e.style,
                  stroke: newColor,
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: newColor },
              }
            : e
        )
      );
      setSelectedEdge(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedEdge, editTypeA2B, editTypeB2A, editDescA2B, editDescB2A, setEdges]);

  const deleteSelectedEdge = useCallback(async () => {
    if (!selectedEdge) return;
    try {
      await invoke('delete_character_relationship', { relationshipId: selectedEdge.id });
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
      setSelectedEdge(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedEdge, setEdges]);

  const edgeData = selectedEdge?.data as { characterAId?: string; characterBId?: string } | undefined;
  const idA = edgeData?.characterAId ?? selectedEdge?.source ?? '';
  const idB = edgeData?.characterBId ?? selectedEdge?.target ?? '';
  const charAName = characters.find((c) => c.id === idA)?.name ?? '';
  const charBName = characters.find((c) => c.id === idB)?.name ?? '';

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
          Карта отношений: перетащите от одного персонажа к другому. Клик по узлу — подсказка. Кнопка + — аватар.
        </span>
        {selectedEdge && (
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
              onClick={() => setSelectedEdge(null)}
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
        ) : nodes.length === 0 ? (
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
              Затем перетащите от одного персонажа к другому, чтобы создать связь
            </div>
          </div>
        ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => setSelectedEdge(null)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
          connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          style={{ background: 'var(--bg-primary)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
        )}
      </div>
    </div>
  );
}
