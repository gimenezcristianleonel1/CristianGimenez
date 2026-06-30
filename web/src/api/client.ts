import { clearSession, getToken, UNAUTHORIZED_EVENT } from '../auth/storage';

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Thin fetch wrapper. Throws {@link ApiError} for non-2xx responses. */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const token = getToken();

  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    // A 401 on an authenticated request means the session is no longer valid:
    // clear it and let the app return to the login screen.
    if (res.status === 401 && token) {
      clearSession();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? formatMessage((data as { message: unknown }).message)
        : res.statusText) || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

/** Lightweight connectivity probe against the health endpoint. */
export async function ping(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await api('/health', { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const apiBaseUrl = BASE_URL;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatMessage(message: unknown): string {
  return Array.isArray(message) ? message.join(', ') : String(message);
}
