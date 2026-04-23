import { authStore } from "../features/auth/store/authStore";

const DEFAULT_API_BASE = "http://localhost:8000/api/v1";

export function normalizeApiBase(base: string | undefined): string {
    if (!base) {
        return DEFAULT_API_BASE;
    }

    const trimmed = base.trim().replace(/\/+$/, "");

    if (!trimmed) {
        return DEFAULT_API_BASE;
    }

    if (/\/api\/v1$/i.test(trimmed)) {
        return trimmed;
    }

    if (/\/api$/i.test(trimmed)) {
        return `${trimmed}/v1`;
    }

    try {
        const url = new URL(trimmed);
        const normalizedPath = url.pathname.replace(/\/+$/, "");

        if (!normalizedPath || normalizedPath === "/") {
            url.pathname = "/api/v1";
            return url.toString().replace(/\/$/, "");
        }
    } catch {
        return trimmed;
    }

    return trimmed;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        if (!res.ok) return null;
        const data = await res.json();
        authStore.setAccessToken(data.access_token ?? null);
        return data.access_token ?? null;
    } catch {
        return null;
    }
}

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
    retry = true
): Promise<T> {
    const response = await fetchWithAuth(path, options, retry);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(error.detail ?? "Request failed");
    }

    if (response.status === 204) return undefined as T;

    return response.json();
}

function resolveRequestUrl(path: string): string {
    if (/^https?:\/\//.test(path)) {
        return path;
    }

    if (path.startsWith("/")) {
        return `${API_BASE}${path}`;
    }

    return `${API_BASE}${path}`;
}

export async function fetchWithAuth(
    path: string,
    options: RequestInit = {},
    retry = true
): Promise<Response> {
    const headers = new Headers(options.headers ?? {});
    const isFormData = options.body instanceof FormData;

    if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    if (authStore.accessToken) {
        headers.set("Authorization", `Bearer ${authStore.accessToken}`);
    }

    const response = await fetch(resolveRequestUrl(path), {
        ...options,
        headers,
        credentials: "include",
    });

    if (response.status === 401 && retry) {
        // Deduplicate concurrent refresh attempts
        if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => {
                refreshPromise = null;
            });
        }
        const newToken = await refreshPromise;
        if (!newToken) {
            throw new Error("Session expired. Please sign in again.");
        }
        return fetchWithAuth(path, options, false);
    }

    return response;
}
