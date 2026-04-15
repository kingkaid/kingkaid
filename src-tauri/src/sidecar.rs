//! Python sidecar process manager.
//!
//! In dev mode, we rely on the user starting `uv run python main.py` manually
//! and pointing to a well-known port. In production, a PyInstaller binary
//! `api-<target>` is bundled under `src-tauri/bin/` and spawned as an
//! externalBin via `tauri_plugin_shell::ShellExt`.

use once_cell::sync::OnceCell;
use std::sync::Mutex;

pub static SIDECAR_PORT: OnceCell<Mutex<u16>> = OnceCell::new();

pub fn set_port(port: u16) {
    let cell = SIDECAR_PORT.get_or_init(|| Mutex::new(0));
    *cell.lock().unwrap() = port;
}

pub fn get_port() -> u16 {
    SIDECAR_PORT
        .get()
        .and_then(|m| m.lock().ok().map(|g| *g))
        .unwrap_or(8000)
}

/// Pick a free local TCP port.
pub fn pick_free_port() -> u16 {
    portpicker::pick_unused_port().unwrap_or(8000)
}
