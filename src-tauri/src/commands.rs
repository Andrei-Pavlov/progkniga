use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub db: Mutex<Option<crate::db_commands::DbState>>,
}

#[tauri::command]
pub fn get_app_data_path(app_handle: tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle.path().app_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_version(app_handle: tauri::AppHandle) -> String {
    app_handle.package_info().version.to_string()
}

/// URL auth-service. По умолчанию localhost. Для сборки под раздачу:
/// AUTH_SERVICE_URL=https://ваш-сервер.railway.app npm run tauri build
fn auth_service_url() -> &'static str {
    option_env!("AUTH_SERVICE_URL").unwrap_or("http://127.0.0.1:3847")
}

#[tauri::command]
pub async fn poll_auth_session(session_id: String) -> Result<bool, String> {
    let url = format!(
        "{}/auth/session/{}",
        auth_service_url().trim_end_matches('/'),
        session_id.trim()
    );
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Auth service: {}", e))?;
    let json: serde_json::Value = res.json().await.map_err(|e| format!("Parse: {}", e))?;
    Ok(json
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

#[tauri::command]
pub fn open_telegram_auth(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_project(state: State<AppState>, path: String) -> Result<(), String> {
    let mut db_guard = state.db.lock().expect("db lock");
    *db_guard = Some(crate::db_commands::open_project(&path)?);
    Ok(())
}

#[tauri::command]
pub fn create_project(
    state: State<AppState>,
    path: String,
    title: String,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    crate::db_commands::create_project(&path, &id, &title)?;
    let mut db_guard = state.db.lock().expect("db lock");
    *db_guard = Some(crate::db_commands::open_project(&path)?);
    Ok(id)
}

#[tauri::command]
pub fn get_books(state: State<AppState>) -> Result<Vec<crate::db_commands::Book>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_books(db)
}

#[tauri::command]
pub fn create_chapter(
    state: State<AppState>,
    book_id: String,
    title: String,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_chapter(db, &book_id, &title)
}

#[tauri::command]
pub fn update_chapter_content(
    state: State<AppState>,
    chapter_id: String,
    content: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_chapter_content(db, &chapter_id, &content)
}

#[tauri::command]
pub fn get_chapter(
    state: State<AppState>,
    chapter_id: String,
) -> Result<crate::db_commands::Chapter, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_chapter(db, &chapter_id)
}

#[tauri::command]
pub fn get_chapters(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<crate::db_commands::Chapter>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_chapters(db, &book_id)
}

#[tauri::command]
pub fn create_character(
    state: State<AppState>,
    book_id: String,
    name: String,
    description: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_character(db, &book_id, &name, description.as_deref())
}

#[tauri::command]
pub fn get_locations(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<crate::db_commands::Location>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_locations(db, &book_id)
}

#[tauri::command]
pub fn create_location(
    state: State<AppState>,
    book_id: String,
    name: String,
    parent_id: Option<String>,
    description: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_location(
        db,
        &book_id,
        &name,
        parent_id.as_deref(),
        description.as_deref(),
    )
}

#[tauri::command]
pub fn update_location(
    state: State<AppState>,
    location_id: String,
    name: Option<String>,
    description: Option<String>,
    parent_id: Option<Option<String>>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_location(
        db,
        &location_id,
        name.as_deref(),
        description.as_deref(),
        parent_id,
    )
}

#[tauri::command]
pub fn update_item(
    state: State<AppState>,
    item_id: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_item(db, &item_id, name.as_deref(), description.as_deref())
}

#[tauri::command]
pub fn update_faction(
    state: State<AppState>,
    faction_id: String,
    name: Option<String>,
    description: Option<String>,
    leader_character_id: Option<Option<String>>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_faction(
        db,
        &faction_id,
        name.as_deref(),
        description.as_deref(),
        leader_character_id,
    )
}

#[tauri::command]
pub fn get_items(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<crate::db_commands::Item>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_items(db, &book_id)
}

#[tauri::command]
pub fn create_item(
    state: State<AppState>,
    book_id: String,
    name: String,
    description: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_item(db, &book_id, &name, description.as_deref())
}

#[tauri::command]
pub fn get_factions(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<crate::db_commands::Faction>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_factions(db, &book_id)
}

#[tauri::command]
pub fn create_faction(
    state: State<AppState>,
    book_id: String,
    name: String,
    description: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_faction(db, &book_id, &name, description.as_deref())
}

#[tauri::command]
pub fn get_timeline_events(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<crate::db_commands::TimelineEvent>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_timeline_events(db, &book_id)
}

#[tauri::command]
pub fn create_timeline_event(
    state: State<AppState>,
    book_id: String,
    title: String,
    description: Option<String>,
    chapter_id: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_timeline_event(
        db,
        &book_id,
        &title,
        description.as_deref(),
        chapter_id.as_deref(),
    )
}

#[tauri::command]
pub fn get_characters(
    state: State<AppState>,
    book_id: String,
) -> Result<Vec<crate::db_commands::Character>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_characters(db, &book_id)
}

#[tauri::command]
pub fn get_mindmap_data(
    state: State<AppState>,
    book_id: String,
) -> Result<crate::db_commands::MindMapData, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_mindmap_data(db, &book_id)
}

#[tauri::command]
pub fn write_file(path: String, content_base64: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content_base64)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_character(
    state: State<AppState>,
    character_id: String,
    name: Option<String>,
    description: Option<String>,
    is_alive: Option<bool>,
    faction_id: Option<Option<String>>,
    location_id: Option<Option<String>>,
    role: Option<Option<String>>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_character(
        db,
        &character_id,
        name.as_deref(),
        description.as_deref(),
        is_alive,
        faction_id,
        location_id,
        role,
    )
}

#[tauri::command]
pub fn delete_character(state: State<AppState>, character_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_character(db, &character_id)
}

#[tauri::command]
pub fn delete_location(state: State<AppState>, location_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_location(db, &location_id)
}

#[tauri::command]
pub fn delete_item(state: State<AppState>, item_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_item(db, &item_id)
}

#[tauri::command]
pub fn delete_faction(state: State<AppState>, faction_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_faction(db, &faction_id)
}

#[tauri::command]
pub fn delete_chapter(state: State<AppState>, chapter_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_chapter(db, &chapter_id)
}

#[tauri::command]
pub fn update_chapter_order(
    state: State<AppState>,
    chapter_id: String,
    sort_order: i32,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_chapter_order(db, &chapter_id, sort_order)
}

#[tauri::command]
pub fn update_chapters_order(
    state: State<AppState>,
    book_id: String,
    chapter_ids: Vec<String>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_chapters_order(db, &book_id, &chapter_ids)
}

#[tauri::command]
pub fn update_timeline_event(
    state: State<AppState>,
    event_id: String,
    title: Option<String>,
    description: Option<String>,
    chapter_id: Option<Option<String>>,
    sort_order: Option<i32>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_timeline_event(
        db,
        &event_id,
        title.as_deref(),
        description.as_deref(),
        chapter_id,
        sort_order,
    )
}

#[tauri::command]
pub fn delete_timeline_event(state: State<AppState>, event_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_timeline_event(db, &event_id)
}

#[tauri::command]
pub fn update_chapter_title(
    state: State<AppState>,
    chapter_id: String,
    title: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_chapter_title(db, &chapter_id, &title)
}

#[tauri::command]
pub fn get_lore_entries(
    state: State<AppState>,
    book_id: String,
    category: Option<String>,
) -> Result<Vec<crate::db_commands::LoreEntry>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_lore_entries(db, &book_id, category.as_deref())
}

#[tauri::command]
pub fn create_lore_entry(
    state: State<AppState>,
    book_id: String,
    title: String,
    content: String,
    category: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::create_lore_entry(db, &book_id, &title, &content, category.as_deref())
}

#[tauri::command]
pub fn update_lore_entry(
    state: State<AppState>,
    lore_id: String,
    title: Option<String>,
    content: Option<String>,
    category: Option<Option<String>>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::update_lore_entry(
        db,
        &lore_id,
        title.as_deref(),
        content.as_deref(),
        category,
    )
}

#[tauri::command]
pub fn delete_lore_entry(state: State<AppState>, lore_id: String) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::delete_lore_entry(db, &lore_id)
}

#[tauri::command]
pub fn get_entity_appearances(
    state: State<AppState>,
    book_id: String,
    entity_type: String,
    entity_id: String,
) -> Result<Vec<crate::db_commands::EntityAppearance>, String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::get_entity_appearances(db, &book_id, &entity_type, &entity_id)
}

#[tauri::command]
pub fn add_entity_appearance(
    state: State<AppState>,
    entity_type: String,
    entity_id: String,
    chapter_id: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::add_entity_appearance(db, &entity_type, &entity_id, &chapter_id)
}

#[tauri::command]
pub fn remove_entity_appearance(
    state: State<AppState>,
    entity_type: String,
    entity_id: String,
    chapter_id: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::remove_entity_appearance(db, &entity_type, &entity_id, &chapter_id)
}

#[tauri::command]
pub fn save_mindmap_data(
    state: State<AppState>,
    book_id: String,
    nodes: Vec<crate::db_commands::MindMapNodeInput>,
    edges: Vec<crate::db_commands::MindMapEdgeInput>,
) -> Result<(), String> {
    let db_guard = state.db.lock().expect("db lock");
    let db = db_guard.as_ref().ok_or("No project open")?;
    crate::db_commands::save_mindmap_data(db, &book_id, &nodes, &edges)
}
