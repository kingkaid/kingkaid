//! Device fingerprint generation — SHA256(platform + arch + hostname).
//!
//! Kept intentionally simple and stable across restarts. Does not use
//! hardware-specific IDs that may require admin privileges.

use sha2::{Digest, Sha256};

pub fn device_fingerprint() -> String {
    let platform = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let hostname = hostname_fallback();

    let raw = format!("{platform}|{arch}|{hostname}");
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

fn hostname_fallback() -> String {
    // Try common env vars; fall back to "unknown"
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}
