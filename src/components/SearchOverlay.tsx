import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';

interface SearchResult {
  type: 'chapter' | 'character' | 'location' | 'item' | 'faction' | 'lore';
  id: string;
  title: string;
  subtitle?: string;
  bookId?: string;
}

export function SearchOverlay() {
  const searchOpen = useStore((s) => s.searchOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const currentBookId = useStore((s) => s.currentBookId);
  const setSelectedChapterId = useStore((s) => s.setSelectedChapterId);
  const setViewMode = useStore((s) => s.setViewMode);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const search = useCallback(async () => {
    if (!query.trim() || !currentBookId) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const chapters = await invoke<{ id: string; title: string }[]>('get_chapters', { bookId: currentBookId });
      const characters = await invoke<{ id: string; name: string }[]>('get_characters', { bookId: currentBookId });
      const locations = await invoke<{ id: string; name: string }[]>('get_locations', { bookId: currentBookId });
      const items = await invoke<{ id: string; name: string }[]>('get_items', { bookId: currentBookId });
      const factions = await invoke<{ id: string; name: string }[]>('get_factions', { bookId: currentBookId });
      const lore = await invoke<{ id: string; title: string }[]>('get_lore_entries', { bookId: currentBookId });

      const q = query.toLowerCase().trim();
      const r: SearchResult[] = [];

      chapters.forEach((c) => {
        if (c.title.toLowerCase().includes(q)) r.push({ type: 'chapter', id: c.id, title: c.title, subtitle: 'Глава', bookId: currentBookId });
      });
      characters.forEach((c) => {
        if (c.name.toLowerCase().includes(q)) r.push({ type: 'character', id: c.id, title: c.name, subtitle: 'Персонаж', bookId: currentBookId });
      });
      locations.forEach((l) => {
        if (l.name.toLowerCase().includes(q)) r.push({ type: 'location', id: l.id, title: l.name, subtitle: 'Локация', bookId: currentBookId });
      });
      items.forEach((i) => {
        if (i.name.toLowerCase().includes(q)) r.push({ type: 'item', id: i.id, title: i.name, subtitle: 'Предмет', bookId: currentBookId });
      });
      factions.forEach((f) => {
        if (f.name.toLowerCase().includes(q)) r.push({ type: 'faction', id: f.id, title: f.name, subtitle: 'Фракция', bookId: currentBookId });
      });
      lore.forEach((e) => {
        if (e.title.toLowerCase().includes(q)) r.push({ type: 'lore', id: e.id, title: e.title, subtitle: 'Лор', bookId: currentBookId });
      });

      setResults(r);
      setSelectedIdx(0);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, currentBookId]);

  useEffect(() => {
    const t = setTimeout(search, 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => (document.querySelector('[data-search-input]') as HTMLInputElement)?.focus(), 50);
    }
  }, [searchOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (i < results.length - 1 ? i + 1 : 0));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => (i > 0 ? i - 1 : results.length - 1));
    }
    if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      const r = results[selectedIdx];
      if (r.type === 'chapter') {
        setSelectedChapterId(r.id);
        setViewMode('editor');
      }
      setSearchOpen(false);
    }
  };

  const typeLabels: Record<string, string> = {
    chapter: 'Глава',
    character: 'Персонаж',
    location: 'Локация',
    item: 'Предмет',
    faction: 'Фракция',
    lore: 'Лор',
  };

  if (!searchOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 1500,
      }}
      onClick={() => setSearchOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <input
            data-search-input
            type="text"
            placeholder="Поиск по главам, персонажам, локациям..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 16,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Поиск...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
              {query.trim() ? 'Ничего не найдено' : 'Введите запрос для поиска'}
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => {
                  if (r.type === 'chapter') {
                    setSelectedChapterId(r.id);
                    setViewMode('editor');
                  }
                  setSearchOpen(false);
                }}
                style={{
                  padding: '12px 16px',
                  background: i === selectedIdx ? 'var(--bg-tertiary)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 70 }}>{typeLabels[r.type]}</span>
                <span style={{ fontWeight: 500 }}>{r.title}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
