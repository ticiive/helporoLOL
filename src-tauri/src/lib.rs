mod lcu;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![lcu::champ_select, lcu::current_summoner, lcu::match_history])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o helporoLOL");
}
