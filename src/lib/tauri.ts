/** Tauri Rust command bridge. Falls back to no-op stubs in a plain browser. */

export async function getDeviceFingerprint(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("get_device_fingerprint");
  } catch {
    // Dev fallback (non-Tauri browser) — a stable per-browser id
    const key = "kingkaid-dev-fingerprint";
    let fp = localStorage.getItem(key);
    if (!fp) {
      fp = "dev-" + Math.random().toString(36).slice(2, 18).padEnd(16, "0");
      localStorage.setItem(key, fp);
    }
    return fp;
  }
}

export async function checkDocker(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("check_docker");
  } catch {
    return false;
  }
}

export async function heygemStatus(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("heygem_status");
  } catch {
    return "down";
  }
}
