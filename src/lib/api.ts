/** API client helpers — talks to the Python sidecar over localhost HTTP. */

// In dev mode, the sidecar is started manually on port 8000.
// In production, Tauri exposes the real port via invoke("get_sidecar_port").
const DEV_SIDECAR_PORT = 8000;

let cachedPort: number | null = null;

async function resolveSidecarPort(): Promise<number> {
  if (cachedPort !== null) return cachedPort;
  try {
    // Only available inside Tauri
    const { invoke } = await import("@tauri-apps/api/core");
    cachedPort = (await invoke<number>("get_sidecar_port")) || DEV_SIDECAR_PORT;
  } catch {
    cachedPort = DEV_SIDECAR_PORT;
  }
  return cachedPort;
}

export async function apiBase(): Promise<string> {
  const port = await resolveSidecarPort();
  return `http://127.0.0.1:${port}/api`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = await apiBase();
  const r = await fetch(`${base}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = await apiBase();
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`${r.status}: ${detail}`);
  }
  return r.json();
}

export interface HealthResponse {
  sidecar: string;
  sensevoice: string;
  heygem: string;
  license: { valid: boolean; remaining_calls: number };
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}
