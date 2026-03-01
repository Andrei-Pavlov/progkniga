-- StoryWeaver SQLite Schema
-- All entities have UUID, relational links, and appearance tracking

-- Projects/Books
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chapters
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scenes (within chapters)
CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Characters (faction_id, location_id, role added via migration)
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_alive INTEGER NOT NULL DEFAULT 1,
    death_chapter_id TEXT REFERENCES chapters(id),
    death_scene_id TEXT REFERENCES scenes(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Locations (hierarchical, map_x/map_y for world map)
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    map_x REAL,
    map_y REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Items (with ownership timeline)
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Item ownership timeline
CREATE TABLE IF NOT EXISTS item_ownership (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    owner_character_id TEXT REFERENCES characters(id),
    owner_location_id TEXT REFERENCES locations(id),
    from_chapter_id TEXT REFERENCES chapters(id),
    from_scene_id TEXT REFERENCES scenes(id),
    to_chapter_id TEXT REFERENCES chapters(id),
    to_scene_id TEXT REFERENCES scenes(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(item_id, from_chapter_id, from_scene_id)
);

-- Factions (leader_character_id added via migration)
CREATE TABLE IF NOT EXISTS factions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lore entries
CREATE TABLE IF NOT EXISTS lore_entries (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Timeline events
CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    chapter_id TEXT REFERENCES chapters(id),
    scene_id TEXT REFERENCES scenes(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Timeline event participants (many-to-many)
CREATE TABLE IF NOT EXISTS timeline_event_characters (
    event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, character_id)
);
CREATE INDEX IF NOT EXISTS idx_timeline_event_characters_event ON timeline_event_characters(event_id);

-- Character relationships (for relationship map)
CREATE TABLE IF NOT EXISTS character_relationships (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    character_a_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    character_b_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    relationship_type TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(character_a_id, character_b_id),
    CHECK(character_a_id < character_b_id)
);

-- MindMap nodes
CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL CHECK (node_type IN ('plot', 'character', 'arc', 'secret')),
    label TEXT NOT NULL,
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    linked_chapter_id TEXT REFERENCES chapters(id),
    linked_character_id TEXT REFERENCES characters(id),
    linked_location_id TEXT REFERENCES locations(id),
    linked_item_id TEXT REFERENCES items(id),
    linked_faction_id TEXT REFERENCES factions(id),
    data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MindMap edges
CREATE TABLE IF NOT EXISTS mindmap_edges (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    target_node_id TEXT NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    edge_type TEXT,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_node_id, target_node_id)
);

-- Entity appearances (automatic tracking)
CREATE TABLE IF NOT EXISTS entity_appearances (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('character', 'location', 'item', 'faction')),
    entity_id TEXT NOT NULL,
    chapter_id TEXT REFERENCES chapters(id),
    scene_id TEXT REFERENCES scenes(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entity_type, entity_id, chapter_id, scene_id)
);

-- Auth token storage (encrypted at application layer)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token_encrypted TEXT NOT NULL,
    tribute_valid_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Book languages (рунические, вымышленные и т.д.)
CREATE TABLE IF NOT EXISTS book_languages (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Character mappings: любой символ (латиница, кириллица и т.д.) → символ языка
CREATE TABLE IF NOT EXISTS book_language_mappings (
    id TEXT PRIMARY KEY,
    language_id TEXT NOT NULL REFERENCES book_languages(id) ON DELETE CASCADE,
    source_char TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(language_id, source_char)
);

-- Word mappings (опционально): слово → символ или последовательность
CREATE TABLE IF NOT EXISTS book_language_words (
    id TEXT PRIMARY KEY,
    language_id TEXT NOT NULL REFERENCES book_languages(id) ON DELETE CASCADE,
    source_word TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(language_id, source_word)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_book_languages_book ON book_languages(book_id);
CREATE INDEX IF NOT EXISTS idx_book_language_mappings_lang ON book_language_mappings(language_id);
CREATE INDEX IF NOT EXISTS idx_book_language_words_lang ON book_language_words(language_id);
CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_characters_book ON characters(book_id);
CREATE INDEX IF NOT EXISTS idx_locations_book ON locations(book_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_items_book ON items(book_id);
CREATE INDEX IF NOT EXISTS idx_item_ownership_item ON item_ownership(item_id);
CREATE INDEX IF NOT EXISTS idx_factions_book ON factions(book_id);
CREATE INDEX IF NOT EXISTS idx_lore_book ON lore_entries(book_id);
CREATE INDEX IF NOT EXISTS idx_timeline_book ON timeline_events(book_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_book ON character_relationships(book_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_book ON mindmap_nodes(book_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_edges_book ON mindmap_edges(book_id);
CREATE INDEX IF NOT EXISTS idx_entity_appearances_entity ON entity_appearances(entity_type, entity_id);
