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
            ("factions", "leader_character_id", "ALTER TABLE factions ADD COLUMN leader_character_id TEXT REFERENCES characters(id)"),
            ("locations", "map_x", "ALTER TABLE locations ADD COLUMN map_x REAL"),
            ("locations", "map_y", "ALTER TABLE locations ADD COLUMN map_y REAL"),
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
        Ok(())
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }
}
