// Persistent auth session (survives reloads and offline use).

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface Establishment {
  id: string;
  name: string;
  country?: string | null;
}

export interface Session {
  token: string;
  user: AuthUser;
  establishment: Establishment;
}

const TOKEN_KEY = 'lg_token';
const USER_KEY = 'lg_user';
const EST_KEY = 'lg_establishment';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredSession(): Session | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  const estRaw = localStorage.getItem(EST_KEY);
  if (!token || !userRaw || !estRaw) return null;
  try {
    return { token, user: JSON.parse(userRaw), establishment: JSON.parse(estRaw) };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  localStorage.setItem(EST_KEY, JSON.stringify(session.establishment));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EST_KEY);
}

/** Fired by the API client when a token is rejected (expired / invalid). */
export const UNAUTHORIZED_EVENT = 'lg-unauthorized';
