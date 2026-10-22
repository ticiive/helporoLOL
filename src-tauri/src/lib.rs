mod lcu;
mod live;

pub fn run() {
    tauri::Builder::default()
        .setup(|_| {
            live::serve(); // página do timer manual na rede de casa
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![lcu::champ_select, lcu::current_summoner, lcu::match_history, live::timer_url])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o helporoLOL");
}
