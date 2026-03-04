import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CharacterStatsRadar } from './CharacterStatsRadar';

interface StatDef {
  id: string;
  name: string;
  max_value: number;
}

interface StatVersion {
  id: string;
  label: string;
  sort_order: number;
}

interface CharacterStatsModalProps {
  characterId: string;
  characterName: string;
  bookId: string;
  onClose: () => void;
}

export function CharacterStatsModal({ characterId, characterName, bookId, onClose }: CharacterStatsModalProps) {
  const [stats, setStats] = useState<StatDef[]>([]);
  const [versions, setVersions] = useState<StatVersion[]>([]);
  const [valuesByVersion, setValuesByVersion] = useState<Record<string, Record<string, number>>>({});
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [newVersionLabel, setNewVersionLabel] = useState('');

  const loadData = useCallback(async () => {
    const [s, v] = await Promise.all([
      invoke<StatDef[]>('get_book_stat_definitions', { bookId }),
      invoke<StatVersion[]>('get_character_stat_versions', { characterId }),
    ]);
    setStats(s);
    setVersions(v);
    if (v.length > 0 && !selectedVersionId) {
      setSelectedVersionId(v[0].id);
    }
    const vals: Record<string, Record<string, number>> = {};
    for (const ver of v) {
      const vs = await invoke<{ stat_definition_id: string; value: number }[]>('get_character_stat_values', {
        versionId: ver.id,
      });
      vals[ver.id] = {};
      vs.forEach((x) => (vals[ver.id][x.stat_definition_id] = x.value));
    }
    setValuesByVersion(vals);
  }, [bookId, characterId, selectedVersionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedVersionId && valuesByVersion[selectedVersionId]) {
      const base: Record<string, number> = {};
      stats.forEach((s) => (base[s.id] = valuesByVersion[selectedVersionId][s.id] ?? 0));
      setEditValues(base);
    } else {
      const base: Record<string, number> = {};
      stats.forEach((s) => (base[s.id] = 0));
      setEditValues(base);
    }
  }, [selectedVersionId, valuesByVersion, stats]);

  const handleSaveValues = async () => {
    if (!selectedVersionId) return;
    const pairs = Object.entries(editValues).map(([k, v]) => [k, v] as [string, number]);
    await invoke('set_character_stat_values', { versionId: selectedVersionId, values: pairs });
    loadData();
  };

  const handleAddVersion = async () => {
    if (!newVersionLabel.trim()) return;
    const id = await invoke<string>('create_character_stat_version', {
      characterId,
      label: newVersionLabel.trim(),
    });
    setNewVersionLabel('');
    setSelectedVersionId(id);
    const prevVersion = versions[versions.length - 1];
    const prevValues = prevVersion ? valuesByVersion[prevVersion.id] : {};
    const pairs = stats.map((s) => [s.id, prevValues[s.id] ?? 0] as [string, number]);
    await invoke('set_character_stat_values', { versionId: id, values: pairs });
    loadData();
  };

  const handleDeleteVersion = async () => {
    if (!selectedVersionId) return;
    await invoke('delete_character_stat_version', { versionId: selectedVersionId });
    const next = versions.filter((v) => v.id !== selectedVersionId)[0];
    setSelectedVersionId(next?.id ?? null);
    loadData();
  };

  const versionData = versions.map((v) => ({
    id: v.id,
    label: v.label,
    values: valuesByVersion[v.id] ?? {},
  }));

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
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Статистика: {characterName}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)' }}>
            ✕
          </button>
        </div>

        {stats.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Добавьте характеристики в книге (вкладка «Статистика»).
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <CharacterStatsRadar
                stats={stats}
                versions={versionData}
                selectedVersionId={selectedVersionId}
                size={240}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Версия (снимок прогресса)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={selectedVersionId || ''}
                  onChange={(e) => setSelectedVersionId(e.target.value || null)}
                  style={{
                    padding: 8,
                    fontSize: 13,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    flex: 1,
                    minWidth: 120,
                  }}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Новая версия"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVersion()}
                  style={{
                    padding: 8,
                    fontSize: 13,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    width: 120,
                  }}
                />
                <button
                  onClick={handleAddVersion}
                  disabled={!newVersionLabel.trim()}
                  style={{
                    padding: '8px 12px',
                    background: newVersionLabel.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: newVersionLabel.trim() ? 'white' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: newVersionLabel.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  + Версия
                </button>
                {versions.length > 1 && (
                  <button
                    onClick={handleDeleteVersion}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--error)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Значения (могут превышать макс.)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 100, fontSize: 13 }}>{s.name}</span>
                    <input
                      type="number"
                      value={editValues[s.id] ?? 0}
                      onChange={(e) => setEditValues({ ...editValues, [s.id]: parseFloat(e.target.value) || 0 })}
                      min={0}
                      step={0.5}
                      style={{
                        padding: 6,
                        fontSize: 13,
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text-primary)',
                        width: 70,
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ {s.max_value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveValues}
                style={{
                  marginTop: 12,
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Сохранить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
