import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertToLanguage } from '../services/bookLanguages';

interface BookLanguage {
  id: string;
  book_id: string;
  name: string;
  description?: string;
}

interface BookLanguageMapping {
  id: string;
  language_id: string;
  source_char: string;
  symbol: string;
}

export function LanguagesTab({
  languages,
  loadData,
  currentBookId,
  onDelete,
  onInsertConverted,
  commonInputStyle,
  commonBtnStyle,
}: {
  languages: BookLanguage[];
  loadData: () => void;
  currentBookId: string | null;
  onDelete: (id: string) => void;
  onInsertConverted: (text: string) => void;
  commonInputStyle: React.CSSProperties;
  commonBtnStyle: React.CSSProperties;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMappings, setEditMappings] = useState<{ source_char: string; symbol: string }[]>([]);
  const [insertLangId, setInsertLangId] = useState<string | null>(null);
  const [insertText, setInsertText] = useState('');

  const loadMappings = useCallback(
    async (langId: string) => {
      const m = await invoke<BookLanguageMapping[]>('get_book_language_mappings', { languageId: langId });
      return m.map((x) => ({ source_char: x.source_char, symbol: x.symbol }));
    },
    []
  );

  const startEdit = async (lang: BookLanguage) => {
    setEditingId(lang.id);
    setEditName(lang.name);
    const m = await loadMappings(lang.id);
    setEditMappings(m.length ? m : [{ source_char: '', symbol: '' }]);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await invoke('update_book_language', { languageId: editingId, name: editName });
    await invoke('set_book_language_mappings', {
      languageId: editingId,
      mappings: editMappings.filter((r) => r.source_char || r.symbol).map((r) => [r.source_char, r.symbol] as [string, string]),
    });
    setEditingId(null);
    loadData();
  };

  const addMappingRow = () => setEditMappings([...editMappings, { source_char: '', symbol: '' }]);
  const removeMappingRow = (i: number) => setEditMappings(editMappings.filter((_, idx) => idx !== i));
  const updateMapping = (i: number, field: 'source_char' | 'symbol', val: string) => {
    const next = [...editMappings];
    next[i] = { ...next[i], [field]: val };
    setEditMappings(next);
  };

  const handleInsert = async () => {
    if (!insertLangId || !insertText.trim()) return;
    const mappings = await loadMappings(insertLangId);
    const converted = convertToLanguage(
      insertText,
      mappings.map((m) => ({ id: '', language_id: insertLangId, source_char: m.source_char, symbol: m.symbol }))
    );
    onInsertConverted(converted);
    setInsertText('');
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Название языка (напр. Руны)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && currentBookId && newName.trim()) {
              invoke('create_book_language', { bookId: currentBookId, name: newName.trim(), description: null }).then(() => {
                setNewName('');
                loadData();
              });
            }
          }}
          style={commonInputStyle}
        />
        <button
          onClick={async () => {
            if (!currentBookId || !newName.trim()) return;
            await invoke('create_book_language', { bookId: currentBookId, name: newName.trim(), description: null });
            setNewName('');
            loadData();
          }}
          style={{ marginTop: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          + Добавить язык
        </button>
      </div>

      {/* Вставка в текст */}
      {languages.length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Вставить в текст</div>
          <select
            value={insertLangId || ''}
            onChange={(e) => setInsertLangId(e.target.value || null)}
            style={{ ...commonInputStyle, width: '100%', marginBottom: 6 }}
          >
            <option value="">Выберите язык</option>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              placeholder="Введите текст (любой язык)"
              value={insertText}
              onChange={(e) => setInsertText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
              style={{ ...commonInputStyle, flex: 1 }}
            />
            <button
              onClick={handleInsert}
              disabled={!insertLangId || !insertText.trim()}
              style={{
                padding: '8px 12px',
                background: insertLangId && insertText.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: insertLangId && insertText.trim() ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                cursor: insertLangId && insertText.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Вставить
            </button>
          </div>
        </div>
      )}

      {languages.map((lang) => (
        <div key={lang.id} style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
          {editingId === lang.id ? (
            <>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Название"
                style={{ ...commonInputStyle, width: '100%', marginBottom: 12 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Маппинг: символ → символ языка (латиница, кириллица, любой алфавит)
              </div>
              {editMappings.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input
                    placeholder="A"
                    value={row.source_char}
                    onChange={(e) => updateMapping(i, 'source_char', e.target.value)}
                    style={{ ...commonInputStyle, width: 48, textAlign: 'center' }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>→</span>
                  <input
                    placeholder="ᚫ"
                    value={row.symbol}
                    onChange={(e) => updateMapping(i, 'symbol', e.target.value)}
                    style={{ ...commonInputStyle, width: 48, textAlign: 'center', fontFamily: 'serif' }}
                  />
                  <button onClick={() => removeMappingRow(i)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={addMappingRow} style={{ ...commonBtnStyle, marginBottom: 12 }}>
                + Строка
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveEdit} style={{ ...commonBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}>
                  Сохранить
                </button>
                <button onClick={() => setEditingId(null)} style={commonBtnStyle}>
                  Отмена
                </button>
                <button onClick={() => onDelete(lang.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>
                  Удалить
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{lang.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => startEdit(lang)} style={commonBtnStyle}>
                  Редактировать
                </button>
                <button onClick={() => onDelete(lang.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>
                  Удалить
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
