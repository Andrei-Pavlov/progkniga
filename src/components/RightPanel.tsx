import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore, DEMO_LIMITS } from '../store';
import { LanguagesTab } from './LanguagesTab';
import { StatsTab } from './StatsTab';
import { CharacterStatsModal } from './CharacterStatsModal';

interface Character {
  id: string;
  name: string;
  description?: string;
  is_alive: boolean;
  faction_id?: string;
  location_id?: string;
  role?: string;
}

interface Location {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
}

interface Item {
  id: string;
  name: string;
  description?: string;
}

interface Faction {
  id: string;
  name: string;
  description?: string;
  leader_character_id?: string;
}

interface LoreEntry {
  id: string;
  title: string;
  content?: string;
  category?: string;
}

interface BookLanguage {
  id: string;
  book_id: string;
  name: string;
  description?: string;
}

interface EntityAppearance {
  chapter_id: string;
  chapter_title: string;
}

interface Chapter {
  id: string;
  title: string;
}

type EditingEntity =
  | { type: 'character'; data: Character }
  | { type: 'location'; data: Location }
  | { type: 'item'; data: Item }
  | { type: 'faction'; data: Faction }
  | { type: 'lore'; data: LoreEntry }
  | null;

const BASE_ROLES = ['protagonist', 'antagonist', 'supporting', 'minor'] as const;
const ROLE_LABELS: Record<string, string> = {
  protagonist: 'Протагонист',
  antagonist: 'Антагонист',
  supporting: 'Второстепенный',
  minor: 'Эпизодический',
};

const LORE_CATEGORIES = ['История', 'Магия', 'Культура', 'География', 'Прочее'];

export function RightPanel() {
  const currentBookId = useStore((s) => s.currentBookId);
  const isDemoUser = useStore((s) => s.isDemoUser);
  const isDemo = isDemoUser;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>([]);
  const [languages, setLanguages] = useState<BookLanguage[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<EditingEntity>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'items' | 'factions' | 'lore' | 'languages' | 'stats'>('characters');
  const [appearances, setAppearances] = useState<EntityAppearance[]>([]);
  const [showAppearancesFor, setShowAppearancesFor] = useState<{ type: string; id: string; name: string } | null>(null);
  const [statsModalCharacter, setStatsModalCharacter] = useState<{ id: string; name: string } | null>(null);

  const loadData = useCallback(() => {
    if (!currentBookId) return;
    invoke<Character[]>('get_characters', { bookId: currentBookId }).then(setCharacters).catch(console.error);
    invoke<Location[]>('get_locations', { bookId: currentBookId }).then(setLocations).catch(console.error);
    invoke<Item[]>('get_items', { bookId: currentBookId }).then(setItems).catch(console.error);
    invoke<Faction[]>('get_factions', { bookId: currentBookId }).then(setFactions).catch(console.error);
    invoke<LoreEntry[]>('get_lore_entries', { bookId: currentBookId }).then(setLoreEntries).catch(console.error);
    invoke<BookLanguage[]>('get_book_languages', { bookId: currentBookId }).then(setLanguages).catch(console.error);
    invoke<Chapter[]>('get_chapters', { bookId: currentBookId }).then(setChapters).catch(console.error);
  }, [currentBookId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filterList = <T extends { name: string }>(list: T[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((x) => x.name.toLowerCase().includes(q));
  };

  const filteredCharacters = useMemo(() => filterList(characters), [characters, searchQuery]);
  const customRoles = useMemo(() => {
    const used = new Set(characters.map((c) => c.role).filter(Boolean) as string[]);
    return [...used].filter((r) => !BASE_ROLES.includes(r as typeof BASE_ROLES[number])).sort();
  }, [characters]);
  const filteredItems = useMemo(() => filterList(items), [items, searchQuery]);
  const filteredFactions = useMemo(() => filterList(factions), [factions, searchQuery]);
  const filteredLore = useMemo(() => {
    if (!searchQuery.trim()) return loreEntries;
    const q = searchQuery.toLowerCase();
    return loreEntries.filter((x) => x.title.toLowerCase().includes(q) || (x.content || '').toLowerCase().includes(q));
  }, [loreEntries, searchQuery]);

  const locationsByParent = useMemo(() => {
    const map = new Map<string | null, Location[]>();
    locations.forEach((l) => {
      const pid = l.parent_id ?? null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(l);
    });
    map.forEach((v) => v.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [locations]);

  const renderLocationTree = (parentId: string | null, depth: number): React.ReactNode => {
    const children = locationsByParent.get(parentId) || [];
    return children
      .filter((l) => !searchQuery.trim() || l.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((l) => (
        <div key={l.id} style={{ marginLeft: depth * 16 }}>
          <div
            style={{
              padding: 10,
              background: 'var(--bg-tertiary)',
              borderRadius: 8,
              marginBottom: 6,
              fontSize: 13,
            }}
          >
            {editing?.type === 'location' && editing.data.id === l.id ? (
              <LocationEditForm
                loc={editing.data}
                locations={locations}
                onSave={(name, desc, pid) => {
                  invoke('update_location', {
                    locationId: l.id,
                    name,
                    description: desc,
                    parentId: pid ?? undefined,
                  }).then(loadData);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <LocationCard
                loc={l}
                locations={locations}
                onEdit={() => setEditing({ type: 'location', data: { ...l } })}
                onDelete={() => setDeleteConfirm(`location:${l.id}`)}
                onInsert={() => window.dispatchEvent(new CustomEvent('storyweaver-insert-text', { detail: { text: l.name } }))}
                onShowAppearances={() => loadAppearances('location', l.id, l.name)}
              />
            )}
          </div>
          {renderLocationTree(l.id, depth + 1)}
        </div>
      ));
  };

  const loadAppearances = (entityType: string, entityId: string, name: string) => {
    if (!currentBookId) return;
    invoke<EntityAppearance[]>('get_entity_appearances', {
      bookId: currentBookId,
      entityType,
      entityId,
    })
      .then((a) => {
        setAppearances(a);
        setShowAppearancesFor({ type: entityType, id: entityId, name });
      })
      .catch(console.error);
  };

  const addAppearance = (entityType: string, entityId: string, chapterId: string) => {
    invoke('add_entity_appearance', { entityType, entityId, chapterId }).then(() => {
      loadAppearances(entityType, entityId, showAppearancesFor?.name || '');
    });
  };

  const removeAppearance = (entityType: string, entityId: string, chapterId: string) => {
    invoke('remove_entity_appearance', { entityType, entityId, chapterId }).then(() => {
      loadAppearances(entityType, entityId, showAppearancesFor?.name || '');
    });
  };

  const handleDelete = async (kind: string, id: string) => {
    try {
      if (kind === 'character') await invoke('delete_character', { characterId: id });
      else if (kind === 'location') await invoke('delete_location', { locationId: id });
      else if (kind === 'item') await invoke('delete_item', { itemId: id });
      else if (kind === 'faction') await invoke('delete_faction', { factionId: id });
      else if (kind === 'lore') await invoke('delete_lore_entry', { loreId: id });
      else if (kind === 'language') await invoke('delete_book_language', { languageId: id });
      setDeleteConfirm(null);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const tabs = [
    { id: 'characters' as const, label: 'Персонажи' },
    { id: 'locations' as const, label: 'Локации' },
    { id: 'items' as const, label: 'Предметы' },
    { id: 'factions' as const, label: 'Фракции' },
    { id: 'lore' as const, label: 'Лор' },
    { id: 'languages' as const, label: 'Языки' },
    { id: 'stats' as const, label: 'Статистика' },
  ];

  const commonInputStyle = {
    padding: 8,
    fontSize: 13,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
  } as const;

  const commonBtnStyle = {
    padding: '4px 10px',
    fontSize: 11,
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
  } as const;

  return (
    <div
      style={{
        width: 360,
        minWidth: 360,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>База мира</h3>
        <input
          type="text"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...commonInputStyle, width: '100%', marginTop: 10 }}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setEditing(null);
              setShowAppearancesFor(null);
              setActiveTab(t.id);
            }}
            style={{
              padding: '8px 12px',
              fontSize: 12,
              background: activeTab === t.id ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {activeTab === 'characters' && (
          <CharactersTab
            characters={filteredCharacters}
            factions={factions}
            customRoles={customRoles}
            locations={locations}
            editing={editing}
            setEditing={setEditing}
            loadData={loadData}
            currentBookId={currentBookId}
            onDelete={(id) => setDeleteConfirm(`character:${id}`)}
            onInsert={(name) => window.dispatchEvent(new CustomEvent('storyweaver-insert-text', { detail: { text: name } }))}
            onShowAppearances={loadAppearances}
            onShowStats={(id, name) => setStatsModalCharacter({ id, name })}
            commonInputStyle={commonInputStyle}
            commonBtnStyle={commonBtnStyle}
            isDemo={isDemo}
            limit={DEMO_LIMITS.entities}
          />
        )}
        {activeTab === 'locations' && (
          <div>
            <AddLocationForm
              locations={locations}
              currentBookId={currentBookId}
              loadData={loadData}
              commonInputStyle={commonInputStyle}
              isDemo={isDemo}
              limit={DEMO_LIMITS.entities}
            />
            {renderLocationTree(null, 0)}
          </div>
        )}
        {activeTab === 'items' && (
          <ItemsTab
            items={filteredItems}
            editing={editing}
            setEditing={setEditing}
            loadData={loadData}
            currentBookId={currentBookId}
            onDelete={(id) => setDeleteConfirm(`item:${id}`)}
            onInsert={(name) => window.dispatchEvent(new CustomEvent('storyweaver-insert-text', { detail: { text: name } }))}
            onShowAppearances={loadAppearances}
            commonInputStyle={commonInputStyle}
            commonBtnStyle={commonBtnStyle}
            isDemo={isDemo}
            limit={DEMO_LIMITS.entities}
          />
        )}
        {activeTab === 'factions' && (
          <FactionsTab
            factions={filteredFactions}
            characters={characters}
            editing={editing}
            setEditing={setEditing}
            loadData={loadData}
            currentBookId={currentBookId}
            onDelete={(id) => setDeleteConfirm(`faction:${id}`)}
            onInsert={(name) => window.dispatchEvent(new CustomEvent('storyweaver-insert-text', { detail: { text: name } }))}
            onShowAppearances={loadAppearances}
            commonInputStyle={commonInputStyle}
            commonBtnStyle={commonBtnStyle}
            isDemo={isDemo}
            limit={DEMO_LIMITS.entities}
          />
        )}
        {activeTab === 'lore' && (
          <LoreTab
            entries={filteredLore}
            editing={editing}
            setEditing={setEditing}
            loadData={loadData}
            currentBookId={currentBookId}
            onDelete={(id) => setDeleteConfirm(`lore:${id}`)}
            commonInputStyle={commonInputStyle}
            commonBtnStyle={commonBtnStyle}
            isDemo={isDemo}
            limit={DEMO_LIMITS.entities}
          />
        )}
        {activeTab === 'languages' && (
          <LanguagesTab
            languages={languages}
            loadData={loadData}
            currentBookId={currentBookId}
            onDelete={(id) => setDeleteConfirm(`language:${id}`)}
            onInsertConverted={(text) => window.dispatchEvent(new CustomEvent('storyweaver-insert-text', { detail: { text } }))}
            commonInputStyle={commonInputStyle}
            commonBtnStyle={commonBtnStyle}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab
            currentBookId={currentBookId}
            loadData={loadData}
            commonInputStyle={commonInputStyle}
            commonBtnStyle={commonBtnStyle}
          />
        )}
      </div>

      {statsModalCharacter && currentBookId && (
        <CharacterStatsModal
          characterId={statsModalCharacter.id}
          characterName={statsModalCharacter.name}
          bookId={currentBookId}
          onClose={() => setStatsModalCharacter(null)}
        />
      )}

      {showAppearancesFor && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: 200,
            background: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border)',
            padding: 12,
            overflow: 'auto',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Появления: {showAppearancesFor.name}</strong>
            <button onClick={() => setShowAppearancesFor(null)} style={commonBtnStyle}>
              ✕
            </button>
          </div>
          {appearances.map((a) => (
            <div key={a.chapter_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span>{a.chapter_title}</span>
              <button
                onClick={() => removeAppearance(showAppearancesFor.type, showAppearancesFor.id, a.chapter_id)}
                style={{ ...commonBtnStyle, color: 'var(--error)' }}
              >
                Убрать
              </button>
            </div>
          ))}
          <select
            onChange={(e) => {
              const chId = e.target.value;
              if (chId) addAppearance(showAppearancesFor.type, showAppearancesFor.id, chId);
              e.target.value = '';
            }}
            style={{ ...commonInputStyle, width: '100%', marginTop: 8 }}
          >
            <option value="">+ Добавить появление в главе</option>
            {chapters
              .filter((c) => !appearances.some((a) => a.chapter_id === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
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
            <p style={{ margin: '0 0 16px' }}>Удалить? Это действие нельзя отменить.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={commonBtnStyle}>
                Отмена
              </button>
              <button
                onClick={() => {
                  const [kind, id] = deleteConfirm.split(':');
                  handleDelete(kind, id);
                }}
                style={{ ...commonBtnStyle, background: 'var(--error)', color: 'white', border: 'none' }}
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

function CharactersTab({
  characters,
  factions,
  locations,
  customRoles,
  editing,
  setEditing,
  loadData,
  currentBookId,
  onDelete,
  onInsert,
  onShowAppearances,
  onShowStats,
  commonInputStyle,
  commonBtnStyle,
  isDemo,
  limit,
}: {
  characters: Character[];
  factions: Faction[];
  locations: Location[];
  customRoles: string[];
  editing: EditingEntity;
  setEditing: (e: EditingEntity) => void;
  loadData: () => void;
  currentBookId: string | null;
  onDelete: (id: string) => void;
  onInsert: (name: string) => void;
  onShowAppearances: (type: string, id: string, name: string) => void;
  onShowStats: (id: string, name: string) => void;
  commonInputStyle: React.CSSProperties;
  commonBtnStyle: React.CSSProperties;
  isDemo?: boolean;
  limit?: number;
}) {
  const [newName, setNewName] = useState('');
  const atLimit = isDemo && limit !== undefined && characters.length >= limit;
  const handleAdd = async () => {
    if (!currentBookId || !newName.trim() || atLimit) return;
    await invoke('create_character', { bookId: currentBookId, name: newName.trim(), description: null });
    setNewName('');
    loadData();
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        {isDemo && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Демо: {characters.length}/{limit} персонажей</p>}
        <input
          placeholder="Имя персонажа"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={commonInputStyle}
        />
        <button onClick={handleAdd} disabled={atLimit} style={{ marginTop: 6, padding: '8px 14px', background: atLimit ? 'var(--bg-tertiary)' : 'var(--accent)', color: atLimit ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: 6, cursor: atLimit ? 'not-allowed' : 'pointer' }}>
          + Добавить
        </button>
      </div>
      {characters.map((c) => (
        <div key={c.id} style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
          {editing?.type === 'character' && editing.data.id === c.id ? (
            <>
              <input
                value={editing.data.name}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })}
                style={{ ...commonInputStyle, width: '100%', marginBottom: 8 }}
              />
              <textarea
                value={editing.data.description || ''}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })}
                placeholder="Описание"
                rows={3}
                style={{ ...commonInputStyle, width: '100%', marginBottom: 8, resize: 'vertical' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={editing.data.is_alive}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, is_alive: e.target.checked } })}
                />
                Жив
              </label>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Фракция:</span>
                <select
                  value={editing.data.faction_id || ''}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, faction_id: e.target.value || undefined } })}
                  style={{ ...commonInputStyle, width: '100%' }}
                >
                  <option value="">—</option>
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Локация:</span>
                <select
                  value={editing.data.location_id || ''}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, location_id: e.target.value || undefined } })}
                  style={{ ...commonInputStyle, width: '100%' }}
                >
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Роль:</span>
                <select
                  value={
                    editing.data.role === '__custom_input__' ? '__custom__' :
                    editing.data.role && BASE_ROLES.includes(editing.data.role as typeof BASE_ROLES[number]) ? editing.data.role :
                    editing.data.role && customRoles.includes(editing.data.role) ? editing.data.role :
                    editing.data.role ? '__custom__' : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') {
                      setEditing({ ...editing, data: { ...editing.data, role: '__custom_input__' } });
                    } else {
                      setEditing({ ...editing, data: { ...editing.data, role: v || undefined } });
                    }
                  }}
                  style={{ ...commonInputStyle, width: '100%' }}
                >
                  <option value="">—</option>
                  {BASE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                  {customRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="__custom__">+ Своя роль...</option>
                </select>
                {(editing.data.role === '__custom_input__' || (editing.data.role && !BASE_ROLES.includes(editing.data.role as typeof BASE_ROLES[number]) && !customRoles.includes(editing.data.role))) && (
                  <input
                    type="text"
                    placeholder="Введите роль"
                    value={editing.data.role === '__custom_input__' ? '' : (editing.data.role || '')}
                    onChange={(e) => setEditing({ ...editing, data: { ...editing.data, role: e.target.value.trim() || '__custom_input__' } })}
                    style={{ ...commonInputStyle, width: '100%', marginTop: 6 }}
                    autoFocus={editing.data.role === '__custom_input__'}
                  />
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() =>
                    invoke('update_character', {
                      characterId: c.id,
                      name: editing.data.name,
                      description: editing.data.description,
                      isAlive: editing.data.is_alive,
                      factionId: editing.data.faction_id ?? null,
                      locationId: editing.data.location_id ?? null,
                      role: editing.data.role === '__custom_input__' ? null : (editing.data.role ?? null),
                    }).then(() => {
                      setEditing(null);
                      loadData();
                    })
                  }
                  style={{ ...commonBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}
                >
                  Сохранить
                </button>
                <button onClick={() => setEditing(null)} style={commonBtnStyle}>
                  Отмена
                </button>
                <button onClick={() => onDelete(c.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>
                  Удалить
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
              {c.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{c.description}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {c.is_alive ? '● Жив' : '● Мёртв'}
                {c.role && ` • ${ROLE_LABELS[c.role] || c.role}`}
                {c.faction_id && ` • ${factions.find((f) => f.id === c.faction_id)?.name}`}
                {c.location_id && ` • ${locations.find((l) => l.id === c.location_id)?.name}`}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setEditing({ type: 'character', data: { ...c } })} style={commonBtnStyle}>
                  Редактировать
                </button>
                <button onClick={() => onShowStats(c.id, c.name)} style={commonBtnStyle}>
                  Статистика
                </button>
                <button onClick={() => onInsert(c.name)} style={commonBtnStyle}>
                  Вставить
                </button>
                <button onClick={() => onShowAppearances('character', c.id, c.name)} style={commonBtnStyle}>
                  Появления
                </button>
                <button onClick={() => onDelete(c.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>
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

function LocationCard({
  loc,
  locations,
  onEdit,
  onDelete,
  onInsert,
  onShowAppearances,
}: {
  loc: Location;
  locations: Location[];
  onEdit: () => void;
  onDelete: () => void;
  onInsert: () => void;
  onShowAppearances: () => void;
}) {
  const parentName = loc.parent_id ? locations.find((l) => l.id === loc.parent_id)?.name : null;
  return (
    <>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{loc.name}</div>
      {parentName && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>↳ {parentName}</div>}
      {loc.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{loc.description}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onEdit} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
          Редактировать
        </button>
        <button onClick={onInsert} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
          Вставить
        </button>
        <button onClick={onShowAppearances} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
          Появления
        </button>
        <button onClick={onDelete} style={{ padding: '4px 10px', fontSize: 11, color: 'var(--error)', background: 'transparent', border: 'none' }}>
          Удалить
        </button>
      </div>
    </>
  );
}

function LocationEditForm({
  loc,
  locations,
  onSave,
  onCancel,
}: {
  loc: Location;
  locations: Location[];
  onSave: (name: string, desc: string, parentId: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(loc.name);
  const [desc, setDesc] = useState(loc.description || '');
  const [parentId, setParentId] = useState<string | null>(loc.parent_id || null);
  return (
    <>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: 6, marginBottom: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4 }} />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание" rows={2} style={{ width: '100%', padding: 6, marginBottom: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4, resize: 'vertical' }} />
      <select value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)} style={{ width: '100%', padding: 6, marginBottom: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4 }}>
        <option value="">Корневая</option>
        {locations.filter((l) => l.id !== loc.id).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(name, desc, parentId)} style={{ padding: '4px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4 }}>
          Сохранить
        </button>
        <button onClick={onCancel} style={{ padding: '4px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
          Отмена
        </button>
      </div>
    </>
  );
}

function AddLocationForm({
  locations,
  currentBookId,
  loadData,
  commonInputStyle,
  isDemo,
  limit,
}: {
  locations: Location[];
  currentBookId: string | null;
  loadData: () => void;
  commonInputStyle: React.CSSProperties;
  isDemo?: boolean;
  limit?: number;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const atLimit = isDemo && limit !== undefined && locations.length >= limit;
  const handleAdd = async () => {
    if (!currentBookId || !name.trim() || atLimit) return;
    await invoke('create_location', { bookId: currentBookId, name: name.trim(), parentId: parentId, description: desc.trim() || null });
    setName('');
    setDesc('');
    setParentId(null);
    loadData();
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {isDemo && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Демо: {locations.length}/{limit} локаций</p>}
      <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} style={commonInputStyle} />
      <textarea placeholder="Описание" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ ...commonInputStyle, width: '100%', marginTop: 6, resize: 'vertical' }} />
      <select value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)} style={{ ...commonInputStyle, width: '100%', marginTop: 6 }}>
        <option value="">Корневая</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button onClick={handleAdd} disabled={atLimit} style={{ marginTop: 6, padding: '8px 14px', background: atLimit ? 'var(--bg-tertiary)' : 'var(--accent)', color: atLimit ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: 6, cursor: atLimit ? 'not-allowed' : 'pointer' }}>
        + Добавить
      </button>
    </div>
  );
}

function ItemsTab({
  items,
  editing,
  setEditing,
  loadData,
  currentBookId,
  onDelete,
  onInsert,
  onShowAppearances,
  commonInputStyle,
  commonBtnStyle,
  isDemo,
  limit,
}: {
  items: Item[];
  editing: EditingEntity;
  setEditing: (e: EditingEntity) => void;
  loadData: () => void;
  currentBookId: string | null;
  onDelete: (id: string) => void;
  onInsert: (name: string) => void;
  onShowAppearances: (type: string, id: string, name: string) => void;
  commonInputStyle: React.CSSProperties;
  commonBtnStyle: React.CSSProperties;
  isDemo?: boolean;
  limit?: number;
}) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const atLimit = isDemo && limit !== undefined && items.length >= limit;
  const handleAdd = async () => {
    if (!currentBookId || !newName.trim() || atLimit) return;
    await invoke('create_item', { bookId: currentBookId, name: newName.trim(), description: newDesc.trim() || null });
    setNewName('');
    setNewDesc('');
    loadData();
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        {isDemo && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Демо: {items.length}/{limit} предметов</p>}
        <input placeholder="Название предмета" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} style={commonInputStyle} />
        <textarea placeholder="Описание" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} style={{ ...commonInputStyle, width: '100%', marginTop: 6, resize: 'vertical' }} />
        <button onClick={handleAdd} disabled={atLimit} style={{ marginTop: 6, padding: '8px 14px', background: atLimit ? 'var(--bg-tertiary)' : 'var(--accent)', color: atLimit ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: 6, cursor: atLimit ? 'not-allowed' : 'pointer' }}>
          + Добавить
        </button>
      </div>
      {items.map((i) => (
        <div key={i.id} style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
          {editing?.type === 'item' && editing.data.id === i.id ? (
            <>
              <input value={editing.data.name} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} style={{ ...commonInputStyle, width: '100%', marginBottom: 8 }} />
              <textarea value={editing.data.description || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} placeholder="Описание" rows={3} style={{ ...commonInputStyle, width: '100%', marginBottom: 8, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => invoke('update_item', { itemId: i.id, name: editing.data.name, description: editing.data.description }).then(() => { setEditing(null); loadData(); })} style={{ ...commonBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}>
                  Сохранить
                </button>
                <button onClick={() => setEditing(null)} style={commonBtnStyle}>Отмена</button>
                <button onClick={() => onDelete(i.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>Удалить</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{i.name}</div>
              {i.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{i.description}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setEditing({ type: 'item', data: { ...i } })} style={commonBtnStyle}>Редактировать</button>
                <button onClick={() => onInsert(i.name)} style={commonBtnStyle}>Вставить</button>
                <button onClick={() => onShowAppearances('item', i.id, i.name)} style={commonBtnStyle}>Появления</button>
                <button onClick={() => onDelete(i.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>Удалить</button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}

function FactionsTab({
  factions,
  characters,
  editing,
  setEditing,
  loadData,
  currentBookId,
  onDelete,
  onInsert,
  onShowAppearances,
  commonInputStyle,
  commonBtnStyle,
  isDemo,
  limit,
}: {
  factions: Faction[];
  characters: Character[];
  editing: EditingEntity;
  setEditing: (e: EditingEntity) => void;
  loadData: () => void;
  currentBookId: string | null;
  onDelete: (id: string) => void;
  onInsert: (name: string) => void;
  onShowAppearances: (type: string, id: string, name: string) => void;
  commonInputStyle: React.CSSProperties;
  commonBtnStyle: React.CSSProperties;
  isDemo?: boolean;
  limit?: number;
}) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const atLimit = isDemo && limit !== undefined && factions.length >= limit;
  const handleAdd = async () => {
    if (!currentBookId || !newName.trim() || atLimit) return;
    await invoke('create_faction', { bookId: currentBookId, name: newName.trim(), description: newDesc.trim() || null });
    setNewName('');
    setNewDesc('');
    loadData();
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        {isDemo && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Демо: {factions.length}/{limit} фракций</p>}
        <input placeholder="Название фракции" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} style={commonInputStyle} />
        <textarea placeholder="Описание" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} style={{ ...commonInputStyle, width: '100%', marginTop: 6, resize: 'vertical' }} />
        <button onClick={handleAdd} disabled={atLimit} style={{ marginTop: 6, padding: '8px 14px', background: atLimit ? 'var(--bg-tertiary)' : 'var(--accent)', color: atLimit ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: 6, cursor: atLimit ? 'not-allowed' : 'pointer' }}>
          + Добавить
        </button>
      </div>
      {factions.map((f) => (
        <div key={f.id} style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
          {editing?.type === 'faction' && editing.data.id === f.id ? (
            <>
              <input value={editing.data.name} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} style={{ ...commonInputStyle, width: '100%', marginBottom: 8 }} />
              <textarea value={editing.data.description || ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} placeholder="Описание" rows={3} style={{ ...commonInputStyle, width: '100%', marginBottom: 8, resize: 'vertical' }} />
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Лидер:</span>
                <select
                  value={editing.data.leader_character_id || ''}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, leader_character_id: e.target.value || undefined } })}
                  style={{ ...commonInputStyle, width: '100%' }}
                >
                  <option value="">—</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() =>
                    invoke('update_faction', { factionId: f.id, name: editing.data.name, description: editing.data.description, leaderCharacterId: editing.data.leader_character_id ?? null }).then(() => {
                      setEditing(null);
                      loadData();
                    })
                  }
                  style={{ ...commonBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}
                >
                  Сохранить
                </button>
                <button onClick={() => setEditing(null)} style={commonBtnStyle}>Отмена</button>
                <button onClick={() => onDelete(f.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>Удалить</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.name}</div>
              {f.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.description}</div>}
              {f.leader_character_id && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Лидер: {characters.find((c) => c.id === f.leader_character_id)?.name}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setEditing({ type: 'faction', data: { ...f } })} style={commonBtnStyle}>Редактировать</button>
                <button onClick={() => onInsert(f.name)} style={commonBtnStyle}>Вставить</button>
                <button onClick={() => onShowAppearances('faction', f.id, f.name)} style={commonBtnStyle}>Появления</button>
                <button onClick={() => onDelete(f.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>Удалить</button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}

function LoreTab({
  entries,
  editing,
  setEditing,
  loadData,
  currentBookId,
  onDelete,
  commonInputStyle,
  commonBtnStyle,
  isDemo,
  limit,
}: {
  entries: LoreEntry[];
  editing: EditingEntity;
  setEditing: (e: EditingEntity) => void;
  loadData: () => void;
  currentBookId: string | null;
  onDelete: (id: string) => void;
  commonInputStyle: React.CSSProperties;
  commonBtnStyle: React.CSSProperties;
  isDemo?: boolean;
  limit?: number;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const atLimit = isDemo && limit !== undefined && entries.length >= limit;
  const handleAdd = async () => {
    if (!currentBookId || !newTitle.trim() || atLimit) return;
    await invoke('create_lore_entry', { bookId: currentBookId, title: newTitle.trim(), content: newContent.trim(), category: newCategory.trim() || null });
    setNewTitle('');
    setNewContent('');
    setNewCategory('');
    loadData();
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        {isDemo && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Демо: {entries.length}/{limit} записей лора</p>}
        <input placeholder="Заголовок" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={commonInputStyle} />
        <textarea placeholder="Содержание" value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={3} style={{ ...commonInputStyle, width: '100%', marginTop: 6, resize: 'vertical' }} />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ ...commonInputStyle, width: '100%', marginTop: 6 }}>
          <option value="">Категория</option>
          {LORE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button onClick={handleAdd} disabled={atLimit} style={{ marginTop: 6, padding: '8px 14px', background: atLimit ? 'var(--bg-tertiary)' : 'var(--accent)', color: atLimit ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: 6, cursor: atLimit ? 'not-allowed' : 'pointer' }}>
          + Добавить
        </button>
      </div>
      {entries.map((e) => (
        <div key={e.id} style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
          {editing?.type === 'lore' && editing.data.id === e.id ? (
            <>
              <input value={editing.data.title} onChange={(ev) => setEditing({ ...editing, data: { ...editing.data, title: ev.target.value } })} style={{ ...commonInputStyle, width: '100%', marginBottom: 8 }} />
              <textarea value={editing.data.content || ''} onChange={(ev) => setEditing({ ...editing, data: { ...editing.data, content: ev.target.value } })} placeholder="Содержание" rows={4} style={{ ...commonInputStyle, width: '100%', marginBottom: 8, resize: 'vertical' }} />
              <select value={editing.data.category || ''} onChange={(ev) => setEditing({ ...editing, data: { ...editing.data, category: ev.target.value || undefined } })} style={{ ...commonInputStyle, width: '100%', marginBottom: 8 }}>
                <option value="">Категория</option>
                {LORE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() =>
                    invoke('update_lore_entry', { loreId: e.id, title: editing.data.title, content: editing.data.content, category: editing.data.category ?? null }).then(() => {
                      setEditing(null);
                      loadData();
                    })
                  }
                  style={{ ...commonBtnStyle, background: 'var(--accent)', color: 'white', border: 'none' }}
                >
                  Сохранить
                </button>
                <button onClick={() => setEditing(null)} style={commonBtnStyle}>Отмена</button>
                <button onClick={() => onDelete(e.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>Удалить</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{e.title}</div>
              {e.category && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginRight: 8 }}>{e.category}</span>}
              {e.content && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{(e.content || '').slice(0, 100)}{(e.content?.length || 0) > 100 ? '...' : ''}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setEditing({ type: 'lore', data: { ...e } })} style={commonBtnStyle}>Редактировать</button>
                <button onClick={() => onDelete(e.id)} style={{ ...commonBtnStyle, color: 'var(--error)' }}>Удалить</button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
