import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const RECENT_KEY = 'storyweaver_recent_projects';
const RECENT_MAX = 10;

interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

function loadRecent(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRecent(list: RecentProject[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
}

function addRecent(path: string, name: string) {
  const list = loadRecent().filter((p) => p.path !== path);
  list.unshift({ path, name, lastOpened: Date.now() });
  saveRecent(list);
}

interface ProjectSelectProps {
  onSelect: (path: string) => void;
}

export function ProjectSelect({ onSelect }: ProjectSelectProps) {
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        await invoke('open_project', { path: selected });
        const books = await invoke<{ title: string }[]>('get_books').catch(() => []);
        const name = books[0]?.title || selected.split(/[/\\]/).pop() || selected;
        addRecent(selected, name);
        setRecent(loadRecent());
        onSelect(selected);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) {
      setError('Введите название проекта');
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        await invoke<string>('create_project', {
          path: selected,
          title: newProjectTitle.trim(),
        });
        await invoke('open_project', { path: selected });
        addRecent(selected, newProjectTitle.trim());
        setRecent(loadRecent());
        onSelect(selected);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      await invoke('open_project', { path });
      const books = await invoke<{ title: string }[]>('get_books').catch(() => []);
      const name = books[0]?.title || path.split(/[/\\]/).pop() || path;
      addRecent(path, name);
      setRecent(loadRecent());
      onSelect(path);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 24,
      }}
    >
      <h1 style={{ fontSize: 28, margin: 0 }}>Выберите проект</h1>
      {error && (
        <div style={{ color: 'var(--error)', fontSize: 14 }}>{error}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button
          onClick={handleOpenProject}
          style={{
            padding: '14px 40px',
            fontSize: 16,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
          }}
        >
          Открыть существующий проект
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Название книги"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            style={{
              padding: 12,
              fontSize: 14,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              minWidth: 200,
            }}
          />
          <button
            onClick={handleCreateProject}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            Создать проект
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: 24, width: '100%', maxWidth: 400 }}>
          <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
            Недавние проекты
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((p) => (
              <button
                key={p.path}
                onClick={() => handleOpenRecent(p.path)}
                style={{
                  padding: '12px 16px',
                  fontSize: 14,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
