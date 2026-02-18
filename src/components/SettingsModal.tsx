import { useState } from 'react';
import { useStore, type Theme, type AccentColor } from '../store';

const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Garamond, serif', label: 'Garamond' },
  { value: "'Palatino Linotype', serif", label: 'Palatino' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: 'Arial, sans-serif', label: 'Arial' },
];

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Тёмная' },
  { value: 'light', label: 'Светлая' },
  { value: 'system', label: 'Системная' },
];

const ACCENT_OPTIONS: { value: AccentColor; label: string }[] = [
  { value: 'indigo', label: 'Индиго' },
  { value: 'emerald', label: 'Изумруд' },
  { value: 'amber', label: 'Янтарь' },
  { value: 'rose', label: 'Роза' },
];

const TEXT_WIDTH_OPTIONS = [
  { value: 0, label: 'На всю ширину' },
  { value: 600, label: '600px' },
  { value: 720, label: '720px' },
  { value: 800, label: '800px' },
  { value: 900, label: '900px' },
];

type Tab = 'editor' | 'appearance';

export function SettingsModal() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const editorFontFamily = useStore((s) => s.editorFontFamily);
  const editorFontSize = useStore((s) => s.editorFontSize);
  const editorLineHeight = useStore((s) => s.editorLineHeight);
  const editorTextMaxWidth = useStore((s) => s.editorTextMaxWidth);
  const autoSaveDelay = useStore((s) => s.autoSaveDelay);
  const theme = useStore((s) => s.theme);
  const accent = useStore((s) => s.accent);
  const focusMode = useStore((s) => s.focusMode);
  const setEditorFontFamily = useStore((s) => s.setEditorFontFamily);
  const setEditorFontSize = useStore((s) => s.setEditorFontSize);
  const setEditorLineHeight = useStore((s) => s.setEditorLineHeight);
  const setEditorTextMaxWidth = useStore((s) => s.setEditorTextMaxWidth);
  const setAutoSaveDelay = useStore((s) => s.setAutoSaveDelay);
  const setTheme = useStore((s) => s.setTheme);
  const setAccent = useStore((s) => s.setAccent);
  const setFocusMode = useStore((s) => s.setFocusMode);

  const [tab, setTab] = useState<Tab>('editor');

  if (!settingsOpen) return null;

  const inputStyle = {
    width: '100%',
    padding: 10,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 14,
  } as const;

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    color: 'var(--text-secondary)',
  } as const;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'toast-in 0.2s ease-out',
      }}
      onClick={() => setSettingsOpen(false)}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 24,
          minWidth: 420,
          maxWidth: 480,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0', fontSize: 18 }}>Настройки</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['editor', 'appearance'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                background: tab === t ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: tab === t ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {t === 'editor' ? 'Редактор' : 'Внешний вид'}
            </button>
          ))}
        </div>

        {tab === 'editor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Шрифт редактора</label>
              <select value={editorFontFamily} onChange={(e) => setEditorFontFamily(e.target.value)} style={inputStyle}>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Размер шрифта: {editorFontSize}px</label>
              <input
                type="range"
                min={12}
                max={24}
                value={editorFontSize}
                onChange={(e) => setEditorFontSize(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Межстрочный интервал: {editorLineHeight}</label>
              <input
                type="range"
                min={1.2}
                max={2.5}
                step={0.1}
                value={editorLineHeight}
                onChange={(e) => setEditorLineHeight(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Ширина текста</label>
              <select value={editorTextMaxWidth} onChange={(e) => setEditorTextMaxWidth(Number(e.target.value))} style={inputStyle}>
                {TEXT_WIDTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Автосохранение: {autoSaveDelay} мс</label>
              <input
                type="range"
                min={300}
                max={3000}
                step={100}
                value={autoSaveDelay}
                onChange={(e) => setAutoSaveDelay(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Режим фокуса (скрывать панели при редактировании)</span>
            </label>
          </div>
        )}

        {tab === 'appearance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Тема</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} style={inputStyle}>
                {THEME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Акцентный цвет</label>
              <select value={accent} onChange={(e) => setAccent(e.target.value as AccentColor)} style={inputStyle}>
                {ACCENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setSettingsOpen(false)}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
