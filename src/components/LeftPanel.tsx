import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore, DEMO_LIMITS } from '../store';

interface Book {
  id: string;
  title: string;
  description?: string;
}

interface Chapter {
  id: string;
  book_id: string;
  title: string;
  sort_order: number;
  content: string;
}

export function LeftPanel() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const currentProject = useStore((s) => s.currentProject);
  const currentBookId = useStore((s) => s.currentBookId);
  const isDemoUser = useStore((s) => s.isDemoUser);
  const isDemo = isDemoUser;
  const setCurrentBookId = useStore((s) => s.setCurrentBookId);
  const selectedChapterId = useStore((s) => s.selectedChapterId);
  const setSelectedChapterId = useStore((s) => s.setSelectedChapterId);
  const leftPanelCollapsed = useStore((s) => s.leftPanelCollapsed);
  const setLeftPanelCollapsed = useStore((s) => s.setLeftPanelCollapsed);

  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const newChapterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setTimeout(() => newChapterInputRef.current?.focus(), 50);
    window.addEventListener('storyweaver-new-chapter', handler);
    return () => window.removeEventListener('storyweaver-new-chapter', handler);
  }, []);

  useEffect(() => {
    if (!currentProject) return;
    invoke<Book[]>('get_books')
      .then(setBooks)
      .catch(console.error);
  }, [currentProject]);

  const loadChapters = useCallback(() => {
    if (!currentBookId) {
      setChapters([]);
      return;
    }
    invoke<Chapter[]>('get_chapters', { bookId: currentBookId })
      .then(setChapters)
      .catch(console.error);
  }, [currentBookId]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter((c) => c.title.toLowerCase().includes(q));
  }, [chapters, searchQuery]);

  const atChapterLimit = isDemo && chapters.length >= DEMO_LIMITS.chapters;
  const handleAddChapter = async () => {
    if (!currentBookId || !newChapterTitle.trim() || atChapterLimit) return;
    try {
      const id = await invoke<string>('create_chapter', {
        bookId: currentBookId,
        title: newChapterTitle.trim(),
      });
      loadChapters();
      setNewChapterTitle('');
      setSelectedChapterId(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameChapter = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await invoke('update_chapter_title', { chapterId: id, title: newTitle.trim() });
      setEditingChapterId(null);
      loadChapters();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    try {
      await invoke('delete_chapter', { chapterId: id });
      if (selectedChapterId === id) setSelectedChapterId(null);
      setDeleteConfirm(null);
      loadChapters();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragStart = (e: React.DragEvent, chapterId: string) => {
    setDraggedChapterId(chapterId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chapterId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetChapterId: string) => {
    e.preventDefault();
    const sourceId = draggedChapterId;
    setDraggedChapterId(null);
    if (!sourceId || sourceId === targetChapterId || !currentBookId) return;
    const sourceIdx = chapters.findIndex((c) => c.id === sourceId);
    const targetIdx = chapters.findIndex((c) => c.id === targetChapterId);
    if (sourceIdx < 0 || targetIdx < 0) return;
    const newChapters = [...chapters];
    const [removed] = newChapters.splice(sourceIdx, 1);
    newChapters.splice(targetIdx, 0, removed);
    const newIds = newChapters.map((c) => c.id);
    try {
      await invoke('update_chapters_order', { bookId: currentBookId, chapterIds: newIds });
      loadChapters();
    } catch (err) {
      console.error(err);
    }
  };

  const currentBook = books.find((b) => b.id === currentBookId);

  const commonInputStyle = {
    padding: 6,
    fontSize: 12,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
  } as const;

  if (leftPanelCollapsed) {
    return (
      <div
        style={{
          width: 48,
          minWidth: 48,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 8,
        }}
      >
        <button
          onClick={() => setLeftPanelCollapsed(false)}
          title="Развернуть панель"
          style={{
            padding: 8,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          ▶
        </button>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['editor', 'mindmap', 'timeline', 'relationships', 'worldmap'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={mode === 'editor' ? 'Редактор' : mode === 'mindmap' ? 'MindMap' : mode === 'timeline' ? 'Таймлайн' : mode === 'relationships' ? 'Отношения' : 'Карта мира'}
              style={{
                padding: 8,
                fontSize: 11,
                background: viewMode === mode ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: viewMode === mode ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {mode === 'editor' ? '✎' : mode === 'mindmap' ? '⊙' : mode === 'timeline' ? '⏱' : mode === 'relationships' ? '👥' : '🗺'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Проект</h3>
        <button
          onClick={() => setLeftPanelCollapsed(true)}
          title="Свернуть панель"
          style={{
            padding: 4,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ◀
        </button>
      </div>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <select
          value={currentBookId || ''}
          onChange={(e) => setCurrentBookId(e.target.value || null)}
          style={{
            width: '100%',
            padding: 8,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          <option value="">Выберите книгу</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </div>

      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['editor', 'mindmap', 'timeline', 'relationships', 'worldmap'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={mode === 'relationships' ? 'Карта отношений' : mode === 'worldmap' ? 'Карта мира' : undefined}
              style={{
                padding: '8px 10px',
                fontSize: 11,
                background: viewMode === mode ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: viewMode === mode ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {mode === 'editor' ? 'Редактор' : mode === 'mindmap' ? 'MindMap' : mode === 'timeline' ? 'Таймлайн' : mode === 'relationships' ? 'Отношения' : 'Карта'}
            </button>
          ))}
        </div>
      </div>

      {currentBook && (
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Главы</h4>
          {isDemo && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Демо: {chapters.length}/{DEMO_LIMITS.chapters} глав</p>}
          <input
            type="text"
            placeholder="Поиск глав..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...commonInputStyle, width: '100%', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              ref={newChapterInputRef}
              type="text"
              placeholder="Новая глава (Ctrl+N)"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddChapter()}
              style={{ ...commonInputStyle, flex: 1 }}
            />
            <button
              onClick={handleAddChapter}
              disabled={atChapterLimit}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: atChapterLimit ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: atChapterLimit ? 'var(--text-secondary)' : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: atChapterLimit ? 'not-allowed' : 'pointer',
              }}
            >
              +
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredChapters.map((ch) => (
              <div
                key={ch.id}
                draggable
                onDragStart={(e) => handleDragStart(e, ch.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, ch.id)}
                style={{
                  padding: 8,
                  background: selectedChapterId === ch.id ? 'var(--bg-tertiary)' : 'transparent',
                  border: draggedChapterId === ch.id ? '2px dashed var(--accent)' : '1px solid transparent',
                  borderRadius: 6,
                  opacity: draggedChapterId === ch.id ? 0.7 : 1,
                  cursor: 'grab',
                }}
              >
                {editingChapterId === ch.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameChapter(ch.id, editingTitle);
                        if (e.key === 'Escape') setEditingChapterId(null);
                      }}
                      style={{ ...commonInputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => handleRenameChapter(ch.id, editingTitle)}
                      style={{ padding: '4px 8px', fontSize: 11, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4 }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingChapterId(null)}
                      style={{ padding: '4px 8px', fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => setSelectedChapterId(ch.id)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {ch.title}
                    </button>
                    <button
                      onClick={() => {
                        setEditingChapterId(ch.id);
                        setEditingTitle(ch.title);
                      }}
                      title="Переименовать"
                      style={{ padding: 2, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(ch.id)}
                      title="Удалить"
                      style={{ padding: 2, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 11 }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <p style={{ margin: '0 0 16px' }}>Удалить главу? Содержимое будет потеряно.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6 }}>
                Отмена
              </button>
              <button
                onClick={() => handleDeleteChapter(deleteConfirm)}
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
