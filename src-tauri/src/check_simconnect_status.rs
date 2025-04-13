use std::sync::Arc;
use tauri::State;
use crate::simconnect_data::SimConnectState;

#[tauri::command]
pub fn check_simconnect_status(state: State<Arc<SimConnectState>>) -> bool {
    *state.running.lock().unwrap()
} 