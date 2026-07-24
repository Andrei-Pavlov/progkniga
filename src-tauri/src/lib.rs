#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod db_commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState {
            db: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_data_path,
            commands::get_app_version,
            commands::get_auth_service_url,
            commands::poll_auth_session,
            commands::web_auth_login,
            commands::web_auth_me,
            commands::open_telegram_auth,
            commands::open_project,
            commands::create_project,
            commands::get_books,
            commands::create_chapter,
            commands::update_chapter_content,
            commands::get_chapter,
            commands::get_chapters,
            commands::create_character,
            commands::get_characters,
            commands::get_locations,
            commands::create_location,
            commands::update_location,
            commands::update_location_map_position,
            commands::get_character_relationships,
            commands::create_character_relationship,
            commands::update_character_relationship,
            commands::update_character_relationship_bidirectional,
            commands::delete_character_relationship,
            commands::update_character_avatar,
            commands::update_character_map_position,
            commands::get_items,
            commands::create_item,
            commands::update_item,
            commands::get_factions,
            commands::create_faction,
            commands::update_faction,
            commands::get_timeline_events,
            commands::create_timeline_event,
            commands::update_character,
            commands::delete_chapter,
            commands::update_chapter_order,
            commands::update_chapters_order,
            commands::update_timeline_event,
            commands::delete_timeline_event,
            commands::get_timeline_event_character_ids,
            commands::set_timeline_event_characters,
            commands::update_chapter_title,
            commands::delete_character,
            commands::delete_location,
            commands::delete_item,
            commands::delete_faction,
            commands::get_lore_entries,
            commands::create_lore_entry,
            commands::update_lore_entry,
            commands::delete_lore_entry,
            commands::get_entity_appearances,
            commands::add_entity_appearance,
            commands::remove_entity_appearance,
            commands::write_file,
            commands::read_file_as_base64,
            commands::get_mindmap_data,
            commands::save_mindmap_data,
            commands::get_book_languages,
            commands::create_book_language,
            commands::update_book_language,
            commands::delete_book_language,
            commands::get_book_language_mappings,
            commands::set_book_language_mappings,
            commands::get_book_language_words,
            commands::set_book_language_words,
            commands::get_book_stat_definitions,
            commands::create_book_stat_definition,
            commands::update_book_stat_definition,
            commands::delete_book_stat_definition,
            commands::get_character_stat_versions,
            commands::create_character_stat_version,
            commands::update_character_stat_version_label,
            commands::delete_character_stat_version,
            commands::get_character_stat_values,
            commands::set_character_stat_values,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
