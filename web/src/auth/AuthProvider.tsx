import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { clearAllData } from '../db/db';
import {
  clearSession,
  getStoredSession,
  saveSession,
  UNAUTHORIZED_EVENT,
  type AuthUser,
  type Establishment,
  type Session,
} from './storage';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  establishment: Establishment;
  isNewUser: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  establishmentName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  establishment: Establishment | null;
  isAuthenticated: boolean;
  /** Registers a new email + password account. */
  register: (input: RegisterInput) => Promise<void>;
  /** Logs in with email + password. */
  loginWithEmail: (email: string, password: string) => Promise<void>;
  /** Exchanges a Google ID token for our session (optional). */
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getStoredSession());

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // Persists a successful login response and wipes cached data when a
  // different establishment signs in on this device (anti cross-tenant leak).
  const applyLogin = useCallback(async (res: LoginResponse) => {
    const next: Session = {
      token: res.accessToken,
      user: res.user,
      establishment: res.establishment,
    };
    const previous = getStoredSession();
    if (previous && previous.establishment.id !== next.establishment.id) {
      await clearAllData();
    }
    saveSession(next);
    setSession(next);
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await api<LoginResponse>('/auth/register', { method: 'POST', body: input });
      await applyLogin(res);
    },
    [applyLogin],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await applyLogin(res);
    },
    [applyLogin],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const res = await api<LoginResponse>('/auth/google', { method: 'POST', body: { idToken } });
      await applyLogin(res);
    },
    [applyLogin],
  );

  // The API client fires this when a token is rejected (expired/invalid).
  useEffect(() => {
    const handler = () => setSession(null);
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        establishment: session?.establishment ?? null,
        isAuthenticated: !!session,
        register,
        loginWithEmail,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
