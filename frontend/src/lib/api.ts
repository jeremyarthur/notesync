const API_ROOT = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");
const TIMEOUT_MS = 90000;

export function getApiBase(): string {
  return API_ROOT;
}

/** Resuelve una ruta ("/notes") contra la raiz del API, en dev ("/api") o prod (host). */
function resolveUrl(path: string): string {
  if (API_ROOT.startsWith("http")) {
    return API_ROOT.endsWith("/api") ? `${API_ROOT}${path}` : `${API_ROOT}/api${path}`;
  }
  return `${API_ROOT}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("El servidor tardó demasiado en responder");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Error del servidor" }));
    throw new Error(String(body.detail ?? "Error inesperado"));
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};