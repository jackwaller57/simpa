// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod simconnect_data;
mod check_simconnect_status;

use std::sync::Arc;
use tauri::Manager;

use crate::simconnect_data::{
    start_simconnect_data_collection,
    stop_simconnect_data_collection,
    SimConnectState,
};
use crate::check_simconnect_status::check_simconnect_status;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Manage an Arc<SimConnectState> so it can be safely shared in commands
        .manage(Arc::new(SimConnectState::new()))
        .invoke_handler(
            tauri::generate_handler![
                start_simconnect_data_collection,
                stop_simconnect_data_collection,
                check_simconnect_status
            ]
        )
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
