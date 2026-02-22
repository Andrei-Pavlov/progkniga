use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

use crate::db::Database;

pub struct DbState {
    pub db: Database,
    #[allow(dead_code)]
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub book_id: String,
    pub title: String,
    pub sort_order: i32,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub book_id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_alive: bool,
    pub faction_id: Option<String>,
    pub location_id: Option<String>,
    pub role: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub map_x: Option<f64>,
    #[serde(default)]
    pub map_y: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MindMapNode {
    pub id: String,
    pub node_type: String,
    pub label: String,
    pub position_x: f64,
    pub position_y: f64,
    pub linked_chapter_id: Option<String>,
    pub linked_character_id: Option<String>,
    pub linked_location_id: Option<String>,
    pub linked_item_id: Option<String>,
    pub linked_faction_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MindMapEdge {
    pub id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub edge_type: Option<String>,
    pub label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Location {
    pub id: String,
    pub book_id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub map_x: Option<f64>,
    pub map_y: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterRelationship {
    pub id: String,
    pub character_a_id: String,
    pub character_b_id: String,
    pub relationship_type: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub relationship_type_a_to_b: Option<String>,
    #[serde(default)]
    pub relationship_type_b_to_a: Option<String>,
    #[serde(default)]
    pub description_a_to_b: Option<String>,
    #[serde(default)]
    pub description_b_to_a: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub book_id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Faction {
    pub id: String,
    pub book_id: String,
    pub name: String,
    pub description: Option<String>,
    pub leader_character_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: String,
    pub book_id: String,
    pub title: String,
    pub description: Option<String>,
    pub chapter_id: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MindMapData {
    pub nodes: Vec<MindMapNode>,
    pub edges: Vec<MindMapEdge>,
}

#[derive(Debug, Deserialize)]
pub struct MindMapNodeInput {
    pub id: Option<String>,
    pub node_type: String,
    pub label: String,
    pub position_x: f64,
    pub position_y: f64,
    pub linked_chapter_id: Option<String>,
    pub linked_character_id: Option<String>,
    pub linked_location_id: Option<String>,
    pub linked_item_id: Option<String>,
    pub linked_faction_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MindMapEdgeInput {
    pub id: Option<String>,
    pub source_node_id: String,
    pub target_node_id: String,
    pub edge_type: Option<String>,
    pub label: Option<String>,
}

pub fn open_project(path: &str) -> Result<DbState, String> {
    let db_path = Path::new(path).join("storyweaver.db");
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;
    Ok(DbState {
        db,
        path: path.to_string(),
    })
}

pub fn create_project(path: &str, id: &str, title: &str) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    let db_path = Path::new(path).join("storyweaver.db");
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;
    let conn = db.conn();
    conn.execute("INSERT INTO books (id, title) VALUES (?1, ?2)", [id, title])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_books(state: &DbState) -> Result<Vec<Book>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT id, title, description FROM books ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let books = stmt
        .query_map([], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(books)
}

pub fn create_chapter(state: &DbState, book_id: &str, title: &str) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters WHERE book_id = ?1",
            [book_id],
            |row| row.get(0),
        )
        .unwrap_or(1);
    conn.execute(
        "INSERT INTO chapters (id, book_id, title, sort_order) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, book_id, title, max_order],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_chapter_content(
    state: &DbState,
    chapter_id: &str,
    content: &str,
) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE chapters SET content = ?1, updated_at = datetime('now') WHERE id = ?2",
        [content, chapter_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_chapter(state: &DbState, chapter_id: &str) -> Result<Chapter, String> {
    let conn = state.db.conn();
    conn.query_row(
        "SELECT id, book_id, title, sort_order, content FROM chapters WHERE id = ?1",
        [chapter_id],
        |row| {
            Ok(Chapter {
                id: row.get(0)?,
                book_id: row.get(1)?,
                title: row.get(2)?,
                sort_order: row.get(3)?,
                content: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn get_chapters(state: &DbState, book_id: &str) -> Result<Vec<Chapter>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT id, book_id, title, sort_order, content FROM chapters WHERE book_id = ?1 ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    let chapters = stmt
        .query_map([book_id], |row| {
            Ok(Chapter {
                id: row.get(0)?,
                book_id: row.get(1)?,
                title: row.get(2)?,
                sort_order: row.get(3)?,
                content: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(chapters)
}

pub fn create_character(
    state: &DbState,
    book_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT INTO characters (id, book_id, name, description) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, book_id, name, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_character(
    state: &DbState,
    character_id: &str,
    name: Option<&str>,
    description: Option<&str>,
    is_alive: Option<bool>,
    faction_id: Option<Option<String>>,
    location_id: Option<Option<String>>,
    role: Option<Option<String>>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(n) = name {
        conn.execute(
            "UPDATE characters SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![n, character_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = description {
        conn.execute(
            "UPDATE characters SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![d, character_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(alive) = is_alive {
        conn.execute(
            "UPDATE characters SET is_alive = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![if alive { 1 } else { 0 }, character_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(fid) = faction_id {
        conn.execute(
            "UPDATE characters SET faction_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![fid.as_deref(), character_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(lid) = location_id {
        conn.execute(
            "UPDATE characters SET location_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![lid.as_deref(), character_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(r) = role {
        conn.execute(
            "UPDATE characters SET role = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![r.as_deref(), character_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update_character_avatar(state: &DbState, character_id: &str, avatar_url: Option<&str>) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE characters SET avatar_url = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![avatar_url, character_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_character_map_position(
    state: &DbState,
    character_id: &str,
    map_x: f64,
    map_y: f64,
) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE characters SET map_x = ?1, map_y = ?2, updated_at = datetime('now') WHERE id = ?3",
        rusqlite::params![map_x, map_y, character_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_chapter(state: &DbState, chapter_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE timeline_events SET chapter_id = NULL WHERE chapter_id = ?1",
        [chapter_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE mindmap_nodes SET linked_chapter_id = NULL WHERE linked_chapter_id = ?1",
        [chapter_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chapters WHERE id = ?1", [chapter_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_chapter_order(
    state: &DbState,
    chapter_id: &str,
    sort_order: i32,
) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE chapters SET sort_order = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![sort_order, chapter_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_chapters_order(
    state: &DbState,
    book_id: &str,
    chapter_ids: &[String],
) -> Result<(), String> {
    let conn = state.db.conn();
    for (idx, id) in chapter_ids.iter().enumerate() {
        conn.execute(
            "UPDATE chapters SET sort_order = ?1, updated_at = datetime('now') WHERE id = ?2 AND book_id = ?3",
            rusqlite::params![idx as i32, id, book_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update_chapter_title(state: &DbState, chapter_id: &str, title: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE chapters SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
        [title, chapter_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_characters(state: &DbState, book_id: &str) -> Result<Vec<Character>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT id, book_id, name, description, is_alive, faction_id, location_id, role, avatar_url, map_x, map_y FROM characters WHERE book_id = ?1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    let chars = stmt
        .query_map([book_id], |row| {
            Ok(Character {
                id: row.get(0)?,
                book_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                is_alive: row.get::<_, i32>(4)? != 0,
                faction_id: row.get(5)?,
                location_id: row.get(6)?,
                role: row.get(7)?,
                avatar_url: row.get(8).ok().flatten(),
                map_x: row.get(9).ok().flatten(),
                map_y: row.get(10).ok().flatten(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(chars)
}

pub fn get_mindmap_data(state: &DbState, book_id: &str) -> Result<MindMapData, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, node_type, label, position_x, position_y, linked_chapter_id, linked_character_id, linked_location_id, linked_item_id, linked_faction_id FROM mindmap_nodes WHERE book_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let nodes = stmt
        .query_map([book_id], |row| {
            Ok(MindMapNode {
                id: row.get(0)?,
                node_type: row.get(1)?,
                label: row.get(2)?,
                position_x: row.get(3)?,
                position_y: row.get(4)?,
                linked_chapter_id: row.get(5)?,
                linked_character_id: row.get(6)?,
                linked_location_id: row.get(7)?,
                linked_item_id: row.get(8)?,
                linked_faction_id: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, source_node_id, target_node_id, edge_type, label FROM mindmap_edges WHERE book_id = ?1")
        .map_err(|e| e.to_string())?;
    let edges = stmt
        .query_map([book_id], |row| {
            Ok(MindMapEdge {
                id: row.get(0)?,
                source_node_id: row.get(1)?,
                target_node_id: row.get(2)?,
                edge_type: row.get(3)?,
                label: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(MindMapData { nodes, edges })
}

pub fn get_locations(state: &DbState, book_id: &str) -> Result<Vec<Location>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT id, book_id, parent_id, name, description, map_x, map_y FROM locations WHERE book_id = ?1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([book_id], |row| {
            Ok(Location {
                id: row.get(0)?,
                book_id: row.get(1)?,
                parent_id: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                map_x: row.get(5).ok().flatten(),
                map_y: row.get(6).ok().flatten(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn create_location(
    state: &DbState,
    book_id: &str,
    name: &str,
    parent_id: Option<&str>,
    description: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT INTO locations (id, book_id, parent_id, name, description) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, book_id, parent_id, name, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_location(
    state: &DbState,
    location_id: &str,
    name: Option<&str>,
    description: Option<&str>,
    parent_id: Option<Option<String>>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(n) = name {
        conn.execute(
            "UPDATE locations SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![n, location_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = description {
        conn.execute(
            "UPDATE locations SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![d, location_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(pid) = parent_id {
        conn.execute(
            "UPDATE locations SET parent_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![pid.as_deref(), location_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update_location_map_position(
    state: &DbState,
    location_id: &str,
    map_x: f64,
    map_y: f64,
) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE locations SET map_x = ?1, map_y = ?2, updated_at = datetime('now') WHERE id = ?3",
        rusqlite::params![map_x, map_y, location_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_character_relationships(
    state: &DbState,
    book_id: &str,
) -> Result<Vec<CharacterRelationship>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, character_a_id, character_b_id, relationship_type, description,
                    relationship_type_a_to_b, relationship_type_b_to_a, description_a_to_b, description_b_to_a
             FROM character_relationships WHERE book_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([book_id], |row| {
            Ok(CharacterRelationship {
                id: row.get(0)?,
                character_a_id: row.get(1)?,
                character_b_id: row.get(2)?,
                relationship_type: row.get(3)?,
                description: row.get(4)?,
                relationship_type_a_to_b: row.get(5).ok().flatten(),
                relationship_type_b_to_a: row.get(6).ok().flatten(),
                description_a_to_b: row.get(7).ok().flatten(),
                description_b_to_a: row.get(8).ok().flatten(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn create_character_relationship(
    state: &DbState,
    book_id: &str,
    character_a_id: &str,
    character_b_id: &str,
    relationship_type: Option<&str>,
    description: Option<&str>,
) -> Result<String, String> {
    let (a, b) = if character_a_id < character_b_id {
        (character_a_id, character_b_id)
    } else {
        (character_b_id, character_a_id)
    };
    let (type_a2b, type_b2a, desc_a2b, desc_b2a) = if character_a_id < character_b_id {
        (relationship_type, None, description, None)
    } else {
        (None, relationship_type, None, description)
    };
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT INTO character_relationships (id, book_id, character_a_id, character_b_id, relationship_type, description, relationship_type_a_to_b, relationship_type_b_to_a, description_a_to_b, description_b_to_a)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![id, book_id, a, b, relationship_type, description, type_a2b, type_b2a, desc_a2b, desc_b2a],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_character_relationship(
    state: &DbState,
    relationship_id: &str,
    relationship_type: Option<&str>,
    description: Option<&str>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(t) = relationship_type {
        conn.execute(
            "UPDATE character_relationships SET relationship_type = ?1, relationship_type_a_to_b = COALESCE(relationship_type_a_to_b, ?1), updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![t, relationship_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = description {
        conn.execute(
            "UPDATE character_relationships SET description = ?1, description_a_to_b = COALESCE(description_a_to_b, ?1), updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![d, relationship_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update_character_relationship_bidirectional(
    state: &DbState,
    relationship_id: &str,
    relationship_type_a_to_b: Option<String>,
    relationship_type_b_to_a: Option<String>,
    description_a_to_b: Option<String>,
    description_b_to_a: Option<String>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(v) = relationship_type_a_to_b {
        let db_val: Option<&str> = if v.trim().is_empty() { None } else { Some(&v) };
        conn.execute(
            "UPDATE character_relationships SET relationship_type_a_to_b = ?1, relationship_type = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![db_val, relationship_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = relationship_type_b_to_a {
        let db_val: Option<&str> = if v.trim().is_empty() { None } else { Some(&v) };
        conn.execute(
            "UPDATE character_relationships SET relationship_type_b_to_a = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![db_val, relationship_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = description_a_to_b {
        let db_val: Option<&str> = if v.trim().is_empty() { None } else { Some(&v) };
        conn.execute(
            "UPDATE character_relationships SET description_a_to_b = ?1, description = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![db_val, relationship_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = description_b_to_a {
        let db_val: Option<&str> = if v.trim().is_empty() { None } else { Some(&v) };
        conn.execute(
            "UPDATE character_relationships SET description_b_to_a = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![db_val, relationship_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn delete_character_relationship(state: &DbState, relationship_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute("DELETE FROM character_relationships WHERE id = ?1", [relationship_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_items(state: &DbState, book_id: &str) -> Result<Vec<Item>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, book_id, name, description FROM items WHERE book_id = ?1 ORDER BY name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([book_id], |row| {
            Ok(Item {
                id: row.get(0)?,
                book_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn create_item(
    state: &DbState,
    book_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT INTO items (id, book_id, name, description) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, book_id, name, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn get_factions(state: &DbState, book_id: &str) -> Result<Vec<Faction>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT id, book_id, name, description, leader_character_id FROM factions WHERE book_id = ?1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([book_id], |row| {
            Ok(Faction {
                id: row.get(0)?,
                book_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                leader_character_id: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn create_faction(
    state: &DbState,
    book_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT INTO factions (id, book_id, name, description) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, book_id, name, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_item(
    state: &DbState,
    item_id: &str,
    name: Option<&str>,
    description: Option<&str>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(n) = name {
        conn.execute(
            "UPDATE items SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![n, item_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = description {
        conn.execute(
            "UPDATE items SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![d, item_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update_faction(
    state: &DbState,
    faction_id: &str,
    name: Option<&str>,
    description: Option<&str>,
    leader_character_id: Option<Option<String>>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(n) = name {
        conn.execute(
            "UPDATE factions SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![n, faction_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = description {
        conn.execute(
            "UPDATE factions SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![d, faction_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(lid) = leader_character_id {
        conn.execute("UPDATE factions SET leader_character_id = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![lid.as_deref(), faction_id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_timeline_events(state: &DbState, book_id: &str) -> Result<Vec<TimelineEvent>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT id, book_id, title, description, chapter_id, sort_order FROM timeline_events WHERE book_id = ?1 ORDER BY sort_order, title")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([book_id], |row| {
            Ok(TimelineEvent {
                id: row.get(0)?,
                book_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                chapter_id: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn create_timeline_event(
    state: &DbState,
    book_id: &str,
    title: &str,
    description: Option<&str>,
    chapter_id: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM timeline_events WHERE book_id = ?1",
            [book_id],
            |row| row.get(0),
        )
        .unwrap_or(1);
    conn.execute(
        "INSERT INTO timeline_events (id, book_id, title, description, chapter_id, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, book_id, title, description, chapter_id, max_order],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_timeline_event(
    state: &DbState,
    event_id: &str,
    title: Option<&str>,
    description: Option<&str>,
    chapter_id: Option<Option<String>>,
    sort_order: Option<i32>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(t) = title {
        conn.execute(
            "UPDATE timeline_events SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![t, event_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = description {
        conn.execute("UPDATE timeline_events SET description = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![d, event_id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(cid) = chapter_id {
        conn.execute("UPDATE timeline_events SET chapter_id = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![cid.as_deref(), event_id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(ord) = sort_order {
        conn.execute("UPDATE timeline_events SET sort_order = ?1, updated_at = datetime('now') WHERE id = ?2", rusqlite::params![ord, event_id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn delete_timeline_event(state: &DbState, event_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute("DELETE FROM timeline_events WHERE id = ?1", [event_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_character(state: &DbState, character_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute("DELETE FROM characters WHERE id = ?1", [character_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_location(state: &DbState, location_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE locations SET parent_id = NULL WHERE parent_id = ?1",
        [location_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM locations WHERE id = ?1", [location_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_item(state: &DbState, item_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute("DELETE FROM items WHERE id = ?1", [item_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_faction(state: &DbState, faction_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "UPDATE characters SET faction_id = NULL WHERE faction_id = ?1",
        [faction_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE factions SET leader_character_id = NULL WHERE id = ?1",
        [faction_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM factions WHERE id = ?1", [faction_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreEntry {
    pub id: String,
    pub book_id: String,
    pub title: String,
    pub content: Option<String>,
    pub category: Option<String>,
}

pub fn get_lore_entries(
    state: &DbState,
    book_id: &str,
    category: Option<&str>,
) -> Result<Vec<LoreEntry>, String> {
    let conn = state.db.conn();
    let rows: Vec<LoreEntry> = if let Some(cat) = category {
        let mut stmt = conn
            .prepare("SELECT id, book_id, title, content, category FROM lore_entries WHERE book_id = ?1 AND category = ?2 ORDER BY title")
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map(rusqlite::params![book_id, cat], |row| {
                Ok(LoreEntry {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    category: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        mapped
            .collect::<Result<Vec<_>, rusqlite::Error>>()
            .map_err(|e| e.to_string())?
    } else {
        let mut stmt = conn
            .prepare("SELECT id, book_id, title, content, category FROM lore_entries WHERE book_id = ?1 ORDER BY category, title")
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map([book_id], |row| {
                Ok(LoreEntry {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    category: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        mapped
            .collect::<Result<Vec<_>, rusqlite::Error>>()
            .map_err(|e| e.to_string())?
    };
    Ok(rows)
}

pub fn create_lore_entry(
    state: &DbState,
    book_id: &str,
    title: &str,
    content: &str,
    category: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT INTO lore_entries (id, book_id, title, content, category) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, book_id, title, content, category],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn update_lore_entry(
    state: &DbState,
    lore_id: &str,
    title: Option<&str>,
    content: Option<&str>,
    category: Option<Option<String>>,
) -> Result<(), String> {
    let conn = state.db.conn();
    if let Some(t) = title {
        conn.execute(
            "UPDATE lore_entries SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![t, lore_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(c) = content {
        conn.execute(
            "UPDATE lore_entries SET content = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![c, lore_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(cat) = category {
        conn.execute(
            "UPDATE lore_entries SET category = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![cat.as_deref(), lore_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn delete_lore_entry(state: &DbState, lore_id: &str) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute("DELETE FROM lore_entries WHERE id = ?1", [lore_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityAppearance {
    pub chapter_id: String,
    pub chapter_title: String,
}

pub fn get_entity_appearances(
    state: &DbState,
    book_id: &str,
    entity_type: &str,
    entity_id: &str,
) -> Result<Vec<EntityAppearance>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.title FROM entity_appearances ea
             JOIN chapters c ON c.id = ea.chapter_id
             WHERE ea.entity_type = ?1 AND ea.entity_id = ?2 AND c.book_id = ?3
             ORDER BY c.sort_order",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![entity_type, entity_id, book_id], |row| {
            Ok(EntityAppearance {
                chapter_id: row.get(0)?,
                chapter_title: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

pub fn add_entity_appearance(
    state: &DbState,
    entity_type: &str,
    entity_id: &str,
    chapter_id: &str,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let conn = state.db.conn();
    conn.execute(
        "INSERT OR IGNORE INTO entity_appearances (id, entity_type, entity_id, chapter_id) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, entity_type, entity_id, chapter_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_entity_appearance(
    state: &DbState,
    entity_type: &str,
    entity_id: &str,
    chapter_id: &str,
) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute(
        "DELETE FROM entity_appearances WHERE entity_type = ?1 AND entity_id = ?2 AND chapter_id = ?3",
        rusqlite::params![entity_type, entity_id, chapter_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn save_mindmap_data(
    state: &DbState,
    book_id: &str,
    nodes: &[MindMapNodeInput],
    edges: &[MindMapEdgeInput],
) -> Result<(), String> {
    let conn = state.db.conn();
    conn.execute("DELETE FROM mindmap_nodes WHERE book_id = ?1", [book_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM mindmap_edges WHERE book_id = ?1", [book_id])
        .map_err(|e| e.to_string())?;

    for node in nodes {
        let id = node
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO mindmap_nodes (id, book_id, node_type, label, position_x, position_y, linked_chapter_id, linked_character_id, linked_location_id, linked_item_id, linked_faction_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                id,
                book_id,
                node.node_type,
                node.label,
                node.position_x,
                node.position_y,
                node.linked_chapter_id,
                node.linked_character_id,
                node.linked_location_id,
                node.linked_item_id,
                node.linked_faction_id,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    for edge in edges {
        let id = edge
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO mindmap_edges (id, book_id, source_node_id, target_node_id, edge_type, label) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                id,
                book_id,
                edge.source_node_id,
                edge.target_node_id,
                edge.edge_type,
                edge.label,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
