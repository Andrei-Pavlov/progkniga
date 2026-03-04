use rusqlite::{Connection, Result as SqlResult};
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &Path) -> SqlResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(path)?;
        Self::init_schema(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn init_schema(conn: &Connection) -> SqlResult<()> {
        conn.execute_batch(include_str!("../../src/database/schema.sql"))?;
        Self::run_migrations(conn)?;
        Ok(())
    }

    fn run_migrations(conn: &Connection) -> SqlResult<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS character_relationships (
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
            )",
            [],
        )
        .ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_relationships_book ON character_relationships(book_id)",
            [],
        )
        .ok();

        for (table, column, sql) in [
            ("characters", "faction_id", "ALTER TABLE characters ADD COLUMN faction_id TEXT REFERENCES factions(id)"),
            ("characters", "location_id", "ALTER TABLE characters ADD COLUMN location_id TEXT REFERENCES locations(id)"),
            ("characters", "role", "ALTER TABLE characters ADD COLUMN role TEXT"),
            ("characters", "avatar_url", "ALTER TABLE characters ADD COLUMN avatar_url TEXT"),
            ("characters", "map_x", "ALTER TABLE characters ADD COLUMN map_x REAL"),
            ("characters", "map_y", "ALTER TABLE characters ADD COLUMN map_y REAL"),
            ("factions", "leader_character_id", "ALTER TABLE factions ADD COLUMN leader_character_id TEXT REFERENCES characters(id)"),
            ("locations", "map_x", "ALTER TABLE locations ADD COLUMN map_x REAL"),
            ("locations", "map_y", "ALTER TABLE locations ADD COLUMN map_y REAL"),
            ("character_relationships", "relationship_type_a_to_b", "ALTER TABLE character_relationships ADD COLUMN relationship_type_a_to_b TEXT"),
            ("character_relationships", "relationship_type_b_to_a", "ALTER TABLE character_relationships ADD COLUMN relationship_type_b_to_a TEXT"),
            ("character_relationships", "description_a_to_b", "ALTER TABLE character_relationships ADD COLUMN description_a_to_b TEXT"),
            ("character_relationships", "description_b_to_a", "ALTER TABLE character_relationships ADD COLUMN description_b_to_a TEXT"),
            ("character_relationships", "line_color", "ALTER TABLE character_relationships ADD COLUMN line_color TEXT"),
            ("character_relationships", "line_type", "ALTER TABLE character_relationships ADD COLUMN line_type TEXT"),
        ] {
            let exists: i32 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?",
                rusqlite::params![table, column],
                |r| r.get(0),
            ).unwrap_or(0);
            if exists == 0 {
                conn.execute(sql, [])?;
            }
        }
        // Migrate old relationship_type/description to bidirectional columns
        conn.execute(
            "UPDATE character_relationships SET relationship_type_a_to_b = relationship_type, description_a_to_b = description
             WHERE relationship_type_a_to_b IS NULL AND relationship_type IS NOT NULL",
            [],
        ).ok();
        // Timeline event characters (many-to-many)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS timeline_event_characters (
                event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
                character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                PRIMARY KEY (event_id, character_id)
            )",
            [],
        ).ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_timeline_event_characters_event ON timeline_event_characters(event_id)",
            [],
        ).ok();
        // Book languages
        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_languages (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        ).ok();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_language_mappings (
                id TEXT PRIMARY KEY,
                language_id TEXT NOT NULL REFERENCES book_languages(id) ON DELETE CASCADE,
                source_char TEXT NOT NULL,
                symbol TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(language_id, source_char)
            )",
            [],
        ).ok();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_language_words (
                id TEXT PRIMARY KEY,
                language_id TEXT NOT NULL REFERENCES book_languages(id) ON DELETE CASCADE,
                source_word TEXT NOT NULL,
                symbol TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(language_id, source_word)
            )",
            [],
        ).ok();
        conn.execute("CREATE INDEX IF NOT EXISTS idx_book_languages_book ON book_languages(book_id)", []).ok();
        conn.execute("CREATE INDEX IF NOT EXISTS idx_book_language_mappings_lang ON book_language_mappings(language_id)", []).ok();
        conn.execute("CREATE INDEX IF NOT EXISTS idx_book_language_words_lang ON book_language_words(language_id)", []).ok();
        // Character stats
        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_stat_definitions (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                max_value INTEGER NOT NULL DEFAULT 10,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(book_id, name)
            )",
            [],
        ).ok();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS character_stat_versions (
                id TEXT PRIMARY KEY,
                character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                label TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        ).ok();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS character_stat_values (
                id TEXT PRIMARY KEY,
                version_id TEXT NOT NULL REFERENCES character_stat_versions(id) ON DELETE CASCADE,
                stat_definition_id TEXT NOT NULL REFERENCES book_stat_definitions(id) ON DELETE CASCADE,
                value REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(version_id, stat_definition_id)
            )",
            [],
        ).ok();
        conn.execute("CREATE INDEX IF NOT EXISTS idx_book_stat_definitions_book ON book_stat_definitions(book_id)", []).ok();
        conn.execute("CREATE INDEX IF NOT EXISTS idx_character_stat_versions_character ON character_stat_versions(character_id)", []).ok();
        conn.execute("CREATE INDEX IF NOT EXISTS idx_character_stat_values_version ON character_stat_values(version_id)", []).ok();
        Ok(())
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }
}
