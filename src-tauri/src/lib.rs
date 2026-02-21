#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod db_commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_app::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState {
            db: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_data_path,
            commands::poll_auth_session,
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
            commands::get_mindmap_data,
            commands::save_mindmap_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
