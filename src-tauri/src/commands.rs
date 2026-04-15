//! Tauri commands exposed to the frontend via `invoke()`.

use crate::{docker, fingerprint, sidecar};

#[tauri::command]
pub fn get_device_fingerprint() -> String {
    fingerprint::device_fingerprint()
}

#[tauri::command]
pub fn get_sidecar_port() -> u16 {
    sidecar::get_port()
}

#[tauri::command]
pub fn check_docker() -> bool {
    docker::docker_available()
}

#[tauri::command]
pub fn heygem_status() -> String {
    docker::heygem_status()
}

#[tauri::command]
pub async fn start_heygem() -> Result<(), String> {
    // Placeholder: in Stage 4 this will invoke `docker compose up -d`
    // against the bundled resources/heygem-compose.yml
    Ok(())
}

#[tauri::command]
pub async fn stop_heygem() -> Result<(), String> {
    Ok(())
}
