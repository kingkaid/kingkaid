//! HeyGem Docker Compose lifecycle management.
//!
//! Uses `docker compose` CLI via `std::process::Command`. Does NOT require
//! any Rust docker library — just shells out to the system binary.

use std::process::Command;

pub fn docker_available() -> bool {
    Command::new("docker")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn heygem_status() -> String {
    if !docker_available() {
        return "no-docker".to_string();
    }
    let out = Command::new("docker")
        .args(["ps", "--filter", "name=heygem", "--format", "{{.Status}}"])
        .output();
    match out {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if stdout.is_empty() {
                "down".to_string()
            } else if stdout.starts_with("Up") {
                "running".to_string()
            } else {
                "starting".to_string()
            }
        }
        _ => "down".to_string(),
    }
}
