import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface StatDef {
  id: string;
  name: string;
  max_value: number;
  sort_order: number;
}

export function StatsTab({
  currentBookId,
  loadData,
  commonInputStyle,
  commonBtnStyle,
}: {
  currentBookId: string | null;
  loadData: () => void;
  commonInputStyle: React.CSSProperties;
  commonBtnStyle: React.CSSProperties;
}) {
  const [stats, setStats] = useState<StatDef[]>([]);
  const [newName, setNewName] = useState('');
  const [newMax, setNewMax] = useState(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMax, setEditMax] = useState(10);

  useEffect(() => {
    if (!currentBookId) return;
    invoke<StatDef[]>('get_book_stat_definitions', { bookId: currentBookId })
      .then(setStats)
      .catch(console.error);
  }, [currentBookId, loadData]);

  const handleAdd = async () => {
    if (!currentBookId || !newName.trim()) return;
    await invoke('create_book_stat_definition', {
      bookId: currentBookId,
      name: newName.trim(),
      maxValue: newMax,
    });
    setNewName('');
    setNewMax(10);
    loadData();
    invoke<StatDef[]>('get_book_stat_definitions', { bookId: currentBookId }).then(setStats);
  };

  const startEdit = (s: StatDef) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditMax(s.max_value);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await invoke('update_book_stat_definition', {
      statId: editingId,
      name: editName,
      maxValue: editMax,
    });
    setEditingId(null);
    loadData();
    if (currentBookId) invoke<StatDef[]>('get_book_stat_definitions', { bookId: currentBookId }).then(setStats);
  };

  const handleDelete = async (id: string) => {
    await invoke('delete_book_stat_definition', { statId: id });
    loadData();
    if (currentBookId) invoke<StatDef[]>('get_book_stat_definitions', { bookId: currentBookId }).then(setStats);
  };

  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
        Характеристики для персонажей (сила, ловкость, удача и т.д.). Значения могут превышать макс.
      </p>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Название (Сила, Ловкость...)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={commonInputStyle}
          />
          <input
            type="number"
            placeholder="Макс"
            value={newMax}
            onChange={(e) => setNewMax(parseInt(e.target.value, 10) || 10)}
            min={1}
            style={{ ...commonInputStyle, width: 60 }}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!currentBookId || !newName.trim()}
          style={{
            padding: '8px 14px',
            background: currentBookId && newName.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: currentBookId && newName.trim() ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 6,
            cursor: currentBookId && newName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          + Добавить
        </button>
      </div>
      {stats.map((s) => (
        <div key={s.id} style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
          {editingId === s.id ? (
            <>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ ...commonInputStyle, width: '100%', marginBottom: 6 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Макс:</span>
                <input
                  type="number"
                  value={editMax}
                  onChange={(e) => setEditMax(parseInt(e.target.value, 10) || 10)}
                  min={1}
                  style={{ ...commonInputStyle, width: 60 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveEdit} style={{ ...commonBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}>
                  Сохранить
                </button>
                <button onClick={() => setEditingId(null)} style={commonBtnStyle}>
                  Отмена
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {s.name} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(макс. {s.max_value})</span>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => startEdit(s)} style={commonBtnStyle}>
                  Изменить
                </button>
                <button onClick={() => handleDelete(s.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>
                  Удалить
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
