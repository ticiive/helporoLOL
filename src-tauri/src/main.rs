// Esconde o console extra no Windows em release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    helporolol_lib::run()
}
