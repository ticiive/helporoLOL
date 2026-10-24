mod lcu;
mod live;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|_| {
            live::serve(); // página do timer manual na rede de casa
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![lcu::champ_select, lcu::current_summoner, lcu::match_history, lcu::gameflow_phase, lcu::set_rune_page, lcu::set_item_set, lcu::match_game, lcu::match_timeline, live::timer_url])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o helporoLOL");
}
