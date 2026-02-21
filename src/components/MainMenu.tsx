import { useEffect } from 'react';
import { useStore } from '../store';
import { useUpdater } from '../hooks/useUpdater';

interface MainMenuProps {
  onExportWord?: () => void;
}

export function MainMenu({ onExportWord }: MainMenuProps) {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setAuthenticated = useStore((s) => s.setAuthenticated);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const { update, checking, downloading, error, checkForUpdates, installAndRelaunch } = useUpdater();

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  const handleCloseProject = () => {
    setCurrentProject(null);
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setCurrentProject(null);
  };

  return (
    <div
      style={{
        height: 40,
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
          StoryWeaver
        </span>
        <button
          onClick={handleCloseProject}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          Сменить проект
        </button>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => setSearchOpen(true)}
          title="Поиск (Ctrl+F)"
          style={{
            padding: '4px 12px',
            fontSize: 13,
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          Поиск
        </button>
        {update ? (
          <button
            onClick={installAndRelaunch}
            disabled={downloading}
            title={`Доступна версия ${update.version}`}
            style={{
              padding: '4px 12px',
              fontSize: 13,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: downloading ? 'wait' : 'pointer',
            }}
          >
            {downloading ? 'Загрузка...' : `Обновление ${update.version}`}
          </button>
        ) : error ? (
          <button
            onClick={checkForUpdates}
            disabled={checking}
            title={error}
            style={{
              padding: '4px 12px',
              fontSize: 13,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px dashed var(--border)',
              borderRadius: 4,
              cursor: checking ? 'wait' : 'pointer',
            }}
          >
            {checking ? '...' : 'Проверить обновления'}
          </button>
        ) : (
          <button
            onClick={checkForUpdates}
            disabled={checking}
            style={{
              padding: '4px 12px',
              fontSize: 13,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: checking ? 'wait' : 'pointer',
            }}
          >
            {checking ? 'Проверка обновлений...' : 'Обновления'}
          </button>
        )}
        {onExportWord && (
          <button
            onClick={onExportWord}
            style={{
              padding: '4px 12px',
              fontSize: 13,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Экспорт в Word
          </button>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          Настройки
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
