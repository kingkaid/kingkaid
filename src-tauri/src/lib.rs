mod commands;
mod docker;
mod fingerprint;
mod sidecar;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Pick a free port for the sidecar; during dev the Python process is
    // started manually on this port via `uv run python main.py --port ...`.
    // In production (Stage 15) this module will also spawn the PyInstaller
    // binary via tauri_plugin_shell.
    let port = std::env::var("KINGKAID_SIDECAR_PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or_else(sidecar::pick_free_port);
    sidecar::set_port(port);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_device_fingerprint,
            get_sidecar_port,
            check_docker,
            heygem_status,
            start_heygem,
            stop_heygem,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
