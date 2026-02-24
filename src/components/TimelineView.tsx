import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';

interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  chapter_id?: string;
  sort_order: number;
}

interface Chapter {
  id: string;
  title: string;
}

interface Character {
  id: string;
  name: string;
}

export function TimelineView() {
  const currentBookId = useStore((s) => s.currentBookId);
  const setSelectedChapterId = useStore((s) => s.setSelectedChapterId);
  const setViewMode = useStore((s) => s.setViewMode);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [eventCharacterIds, setEventCharacterIds] = useState<Record<string, string[]>>({});
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editChapterId, setEditChapterId] = useState<string>('');
  const [editCharacterIds, setEditCharacterIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentBookId) {
      setEvents([]);
      setChapters([]);
      setCharacters([]);
      setEventCharacterIds({});
      return;
    }
    try {
      const [evs, chs, chrs] = await Promise.all([
        invoke<TimelineEvent[]>('get_timeline_events', { bookId: currentBookId }),
        invoke<Chapter[]>('get_chapters', { bookId: currentBookId }),
        invoke<Character[]>('get_characters', { bookId: currentBookId }),
      ]);
      setEvents(evs);
      setChapters(chs);
      setCharacters(chrs);
      const ids: Record<string, string[]> = {};
      await Promise.all(
        evs.map(async (ev) => {
          const cids = await invoke<string[]>('get_timeline_event_character_ids', { eventId: ev.id });
          ids[ev.id] = cids;
        })
      );
      setEventCharacterIds(ids);
    } catch (e) {
      console.error(e);
    }
  }, [currentBookId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async () => {
    if (!currentBookId || !newTitle.trim()) return;
    try {
      const eventId = await invoke<string>('create_timeline_event', {
        bookId: currentBookId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        chapterId: selectedChapter || null,
      });
      if (selectedCharacterIds.length > 0) {
        await invoke('set_timeline_event_characters', { eventId, characterIds: selectedCharacterIds });
      }
      setNewTitle('');
      setNewDesc('');
      setSelectedChapter('');
      setSelectedCharacterIds([]);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (eventId: string) => {
    try {
      await invoke('update_timeline_event', {
        eventId,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        chapterId: editChapterId || null,
      });
      await invoke('set_timeline_event_characters', { eventId, characterIds: editCharacterIds });
      setEditingEventId(null);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await invoke('delete_timeline_event', { eventId });
      setDeleteConfirm(null);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const openChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setViewMode('editor');
  };

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
        Выберите книгу для таймлайна
      </div>
    );
  }

  const commonInputStyle = {
    padding: 10,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 14,
  } as const;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Таймлайн событий</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Событие</label>
            <input
              type="text"
              placeholder="Название события"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              style={{ ...commonInputStyle, minWidth: 200 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Описание</label>
            <textarea
              placeholder="Описание (опционально)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              style={{ ...commonInputStyle, minWidth: 180, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Глава</label>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              style={{ ...commonInputStyle, minWidth: 150 }}
            >
              <option value="">— Не привязано</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Персонажи (опционально)</label>
            <select
              multiple
              value={selectedCharacterIds}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                setSelectedCharacterIds(opts);
              }}
              style={{ ...commonInputStyle, minWidth: 180, height: 80 }}
            >
              {characters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ctrl+клик для выбора нескольких</span>
          </div>
          <button
            onClick={handleAdd}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
            }}
          >
            Добавить
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Добавьте события в таймлайн. Они помогут отслеживать хронологию сюжета.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: 16,
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  borderLeft: '4px solid var(--accent)',
                }}
              >
                {editingEventId === ev.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Название события"
                      style={commonInputStyle}
                    />
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Описание (опционально)"
                      rows={3}
                      style={{ ...commonInputStyle, resize: 'vertical' }}
                    />
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Глава</label>
                      <select value={editChapterId} onChange={(e) => setEditChapterId(e.target.value)} style={commonInputStyle}>
                        <option value="">— Не привязано</option>
                        {chapters.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Персонажи (опционально)</label>
                      <select
                        multiple
                        value={editCharacterIds}
                        onChange={(e) => setEditCharacterIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                        style={{ ...commonInputStyle, width: '100%', height: 80 }}
                      >
                        {characters.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.name}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ctrl+клик для выбора нескольких</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleUpdate(ev.id)}
                        style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6 }}
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditingEventId(null)}
                        style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6 }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{ev.title}</div>
                    {ev.description && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ev.description}</div>
                    )}
                    {ev.chapter_id && (
                      <button
                        onClick={() => openChapter(ev.chapter_id!)}
                        style={{
                          fontSize: 11,
                          color: 'var(--accent)',
                          marginTop: 6,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Глава: {chapters.find((c) => c.id === ev.chapter_id)?.title || '—'} →
                      </button>
                    )}
                    {(eventCharacterIds[ev.id]?.length ?? 0) > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                        Персонажи: {(eventCharacterIds[ev.id] || [])
                          .map((cid) => characters.find((c) => c.id === cid)?.name ?? '?')
                          .join(', ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => {
                          setEditingEventId(ev.id);
                          setEditTitle(ev.title);
                          setEditDesc(ev.description || '');
                          setEditChapterId(ev.chapter_id || '');
                          setEditCharacterIds(eventCharacterIds[ev.id] || []);
                        }}
                        style={{ padding: '4px 10px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4 }}
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(ev.id)}
                        style={{ padding: '4px 10px', fontSize: 12, color: 'var(--error)', background: 'none', border: 'none' }}
                      >
                        Удалить
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              padding: 24,
              borderRadius: 12,
              maxWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 16px' }}>Удалить событие?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6 }}>
                Отмена
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: '8px 16px', background: 'var(--error)', color: 'white', border: 'none', borderRadius: 6 }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
