#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![analyzer_health])
        .run(tauri::generate_context!())
        .expect("failed to run HighlightSmith desktop shell");
}

#[tauri::command]
fn analyzer_health() -> &'static str {
    "analyzer bridge pending"
}
