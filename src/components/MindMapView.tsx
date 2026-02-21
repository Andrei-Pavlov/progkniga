import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';
import ReactFlow, {
  Node,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  BackgroundVariant,
  ConnectionMode,
  Handle,
  Position,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

const NODE_TYPES_COLORS: Record<string, string> = {
  plot: '#6366f1',
  character: '#22c55e',
  arc: '#f59e0b',
  secret: '#ef4444',
};

function MindMapNode({
  data,
  id,
  onLabelChange,
}: {
  data: { label: string; nodeType?: string };
  id: string;
  onLabelChange?: (id: string, newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const color = NODE_TYPES_COLORS[data.nodeType || 'plot'] || NODE_TYPES_COLORS.plot;

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    if (label.trim() && label !== data.label) {
      onLabelChange?.(id, label.trim());
    } else {
      setLabel(data.label);
    }
  };

  return (
    <div
      style={{
        padding: '10px 18px',
        background: 'var(--bg-tertiary)',
        border: `2px solid ${color}`,
        borderRadius: 10,
        minWidth: 100,
        textAlign: 'center',
        color: 'var(--text-primary)',
        fontSize: 13,
        boxShadow: 'var(--shadow)',
        position: 'relative',
      }}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          style={{
            width: '100%',
            padding: 4,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}

export function MindMapView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      mindmap: (props) => (
        <MindMapNode
          {...props}
          onLabelChange={(nodeId, newLabel) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
              )
            );
          }}
        />
      ),
    }),
    [setNodes]
  );

  const [chapters, setChapters] = useState<{ id: string; title: string }[]>([]);
  const setSelectedChapterId = useStore((s) => s.setSelectedChapterId);
  const setViewMode = useStore((s) => s.setViewMode);
  const isDraggingRef = useRef(false);
  const mindMapRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<{ screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number } } | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

  const loadMindMap = useCallback(async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      const [data, chaps] = await Promise.all([
        invoke<{
          nodes: Array<{ id: string; node_type: string; label: string; position_x: number; position_y: number; linked_chapter_id?: string | null }>;
          edges: Array<{ id: string; source_node_id: string; target_node_id: string; label?: string }>;
        }>('get_mindmap_data', { bookId: currentBookId }),
        invoke<{ id: string; title: string }[]>('get_chapters', { bookId: currentBookId }),
      ]);
      setChapters(chaps);

      const posCount = new Map<string, number>();
      const getOffset = (x: number, y: number) => {
        const key = `${x},${y}`;
        const n = posCount.get(key) ?? 0;
        posCount.set(key, n + 1);
        return n;
      };
      setNodes(
        data.nodes.map((n) => {
          const dup = getOffset(n.position_x, n.position_y);
          const offset = dup > 0 ? { x: dup * 130, y: dup * 80 } : { x: 0, y: 0 };
          return {
            id: n.id,
            type: 'mindmap',
            position: { x: n.position_x + offset.x, y: n.position_y + offset.y },
            data: { label: n.label, nodeType: n.node_type, linkedChapterId: n.linked_chapter_id },
          };
        })
      );
      setEdges(
        data.edges.map((e) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          label: e.label,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentBookId]);

  useEffect(() => {
    loadMindMap();
  }, [loadMindMap]);

  useEffect(() => {
    const onMouseUp = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (mindMapRef.current && !mindMapRef.current.contains(e.target as HTMLElement)) {
        clearSelection();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [clearSelection]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedIds = new Set<string>();
      for (const c of changes) {
        if (c.type === 'remove' && 'id' in c && c.id) removedIds.add(c.id);
      }
      // Защита: при drag+delete не удалять (баг: экран чернеет)
      const duringDrag = isDraggingRef.current;
      const wouldRemoveAll = nodes.length > 0 && removedIds.size >= nodes.length;
      const skipRemove = duringDrag || wouldRemoveAll;
      const filteredChanges = skipRemove
        ? changes.filter((c) => c.type !== 'remove')
        : changes;
      const effectiveRemoved = skipRemove ? new Set<string>() : removedIds;
      if (effectiveRemoved.size > 0) {
        setEdges((eds) => eds.filter((e) => !effectiveRemoved.has(e.source) && !effectiveRemoved.has(e.target)));
      }
      onNodesChange(filteredChanges);
    },
    [onNodesChange, setEdges, nodes.length]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds));
    },
    [setEdges]
  );

  const deleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedNodes.length > 0) {
      const ids = new Set(selectedNodes.map((n) => n.id));
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !e.selected && !ids.has(e.source) && !ids.has(e.target)));
    } else if (selectedEdges.length > 0) {
      const edgeIds = new Set(selectedEdges.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !edgeIds.has(e.id)));
    }
  }, [nodes, edges, setNodes, setEdges]);

  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      isDraggingRef.current = false;
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
      );
    },
    [setNodes]
  );

  const saveMindMap = useCallback(async () => {
    if (!currentBookId) return;
    const nodeInputs = nodes.map((n) => ({
      id: n.id,
      node_type: (n.data as { nodeType?: string }).nodeType || 'plot',
      label: (n.data as { label: string }).label,
      position_x: n.position.x,
      position_y: n.position.y,
      linked_chapter_id: (n.data as { linkedChapterId?: string }).linkedChapterId || null,
      linked_character_id: null,
      linked_location_id: null,
      linked_item_id: null,
      linked_faction_id: null,
    }));
    const edgeInputs = edges.map((e) => ({
      id: e.id,
      source_node_id: e.source,
      target_node_id: e.target,
      edge_type: null,
      label: e.label || null,
    }));
    try {
      await invoke('save_mindmap_data', {
        bookId: currentBookId,
        nodes: nodeInputs,
        edges: edgeInputs,
      });
    } catch (err) {
      console.error(err);
    }
  }, [currentBookId, nodes, edges]);

  useEffect(() => {
    const timer = setTimeout(saveMindMap, 1500);
    return () => clearTimeout(timer);
  }, [nodes, edges, saveMindMap]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const changeNodeType = useCallback(
    (nodeId: string, newType: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, nodeType: newType } } : n
        )
      );
    },
    [setNodes]
  );

  const changeNodeChapter = useCallback(
    (nodeId: string, chapterId: string | null) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, linkedChapterId: chapterId || undefined } } : n
        )
      );
    },
    [setNodes]
  );

  const openLinkedChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setViewMode('editor');
  };

  const addNode = useCallback(
    (type: string) => {
      const id = `node-${Date.now()}`;
      const pos = pendingPositionRef.current;
      pendingPositionRef.current = null;
      const position = pos ?? { x: 150, y: 150 };
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'mindmap',
          position,
          data: { label: 'Новый узел', nodeType: type },
        },
      ]);
    },
    [setNodes]
  );

  if (!currentBookId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 15,
        }}
      >
        Выберите книгу для MindMap
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        Загрузка MindMap...
      </div>
    );
  }

  return (
    <div ref={mindMapRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Клик по пустому месту → кнопка типа (Сюжет и т.д.) — узел появится там. Двойной клик — переименовать. Delete — удалить.
        </span>
        <button
          onClick={deleteSelected}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          Удалить выбранное
        </button>
        {selectedNode && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Тип:</span>
              {(['plot', 'character', 'arc', 'secret'] as const).map((type) => (
              <button
                key={type}
                onClick={() => changeNodeType(selectedNodeId!, type)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: (selectedNode?.data as { nodeType?: string })?.nodeType === type ? NODE_TYPES_COLORS[type] : 'var(--bg-tertiary)',
                  color: (selectedNode?.data as { nodeType?: string })?.nodeType === type ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${NODE_TYPES_COLORS[type]}`,
                  borderRadius: 4,
                }}
              >
                {type === 'plot' ? 'Сюжет' : type === 'character' ? 'Персонаж' : type === 'arc' ? 'Арка' : 'Секрет'}
              </button>
            ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Глава:</span>
              <select
                value={(selectedNode.data as { linkedChapterId?: string }).linkedChapterId || ''}
                onChange={(e) => changeNodeChapter(selectedNodeId!, e.target.value || null)}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  minWidth: 120,
                }}
              >
                <option value="">— Не привязана</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>
              {(selectedNode.data as { linkedChapterId?: string }).linkedChapterId && (
                <button
                  onClick={() => openLinkedChapter((selectedNode.data as { linkedChapterId?: string }).linkedChapterId!)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                  }}
                >
                  Открыть →
                </button>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['plot', 'character', 'arc', 'secret'] as const).map((type) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                background: NODE_TYPES_COLORS[type],
                color: 'white',
                border: 'none',
                borderRadius: 6,
              }}
            >
              + {type === 'plot' ? 'Сюжет' : type === 'character' ? 'Персонаж' : type === 'arc' ? 'Арка' : 'Секрет'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
          onEdgeClick={() => setSelectedNodeId(null)}
          onPaneClick={(e) => {
            setSelectedNodeId(null);
            if (rfInstanceRef.current) {
              pendingPositionRef.current = rfInstanceRef.current.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
              });
            }
          }}
          onInit={(inst) => { rfInstanceRef.current = inst; }}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          style={{ background: 'var(--bg-primary)' }}
        >
          <Controls />
          <MiniMap
            nodeColor={(n) => NODE_TYPES_COLORS[(n.data as { nodeType?: string }).nodeType || 'plot'] || '#6366f1'}
            maskColor="rgba(0,0,0,0.7)"
          />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
