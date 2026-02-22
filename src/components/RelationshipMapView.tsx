import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

interface Character {
  id: string;
  name: string;
}

interface Relationship {
  id: string;
  character_a_id: string;
  character_b_id: string;
  relationship_type: string | null;
  description: string | null;
}

function CharacterNode({ data }: { data: { label: string } }) {
  return (
    <div
      style={{
        padding: '12px 20px',
        background: 'var(--bg-tertiary)',
        border: '2px solid #22c55e',
        borderRadius: 12,
        minWidth: 120,
        textAlign: 'center',
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
      {data.label}
    </div>
  );
}

export function RelationshipMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeLabel, setEdgeLabel] = useState('');

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      character: (props) => <CharacterNode {...props} />,
    }),
    []
  );

  const loadData = useCallback(async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      const [chars, rels] = await Promise.all([
        invoke<Character[]>('get_characters', { bookId: currentBookId }),
        invoke<Relationship[]>('get_character_relationships', { bookId: currentBookId }),
      ]);
      const posMap = new Map<string, { x: number; y: number }>();
      let x = 0,
        y = 0;
      const getPos = (id: string) => {
        if (!posMap.has(id)) {
          posMap.set(id, { x: x * 200, y: y * 120 });
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
          data: { label: c.name },
        };
      });

      const edgeList: Edge[] = rels.map((r) => ({
        id: r.id,
        source: r.character_a_id,
        target: r.character_b_id,
        label: r.relationship_type || '',
        type: 'smoothstep',
        data: { relationshipType: r.relationship_type, description: r.description },
      }));

      setNodes(nodeList);
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
      try {
        await invoke('create_character_relationship', {
          bookId: currentBookId,
          characterAId: params.source,
          characterBId: params.target,
          relationshipType: null,
          description: null,
        });
        loadData();
      } catch (e) {
        console.error(e);
      }
    },
    [currentBookId, loadData]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    const label = (edge.data as { relationshipType?: string })?.relationshipType ?? edge.label;
    setEdgeLabel(typeof label === 'string' ? label : '');
  }, []);

  const saveEdgeLabel = useCallback(async () => {
    if (!selectedEdge) return;
    try {
      await invoke('update_character_relationship', {
        relationshipId: selectedEdge.id,
        relationshipType: edgeLabel.trim() || null,
        description: null,
      });
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdge.id ? { ...e, label: edgeLabel.trim() } : e
        )
      );
      setSelectedEdge(null);
    } catch (e) {
      console.error(e);
    }
  }, [selectedEdge, edgeLabel, setEdges]);

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

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
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
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Карта отношений: соедините персонажей, перетащите от одного к другому
        </span>
        {selectedEdge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={edgeLabel}
              onChange={(e) => setEdgeLabel(e.target.value)}
              placeholder="Тип связи (друг, враг...)"
              style={{
                padding: '6px 12px',
                fontSize: 13,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                minWidth: 180,
              }}
            />
            <button
              onClick={saveEdgeLabel}
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          style={{ background: 'var(--bg-primary)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
