import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface ProjectSelectProps {
  onSelect: (path: string) => void;
}

export function ProjectSelect({ onSelect }: ProjectSelectProps) {
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        await invoke('open_project', { path: selected });
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
        onSelect(selected);
      }
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
    </div>
  );
}
