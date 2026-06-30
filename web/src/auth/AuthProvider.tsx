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

interface AuthContextValue {
  user: AuthUser | null;
  establishment: Establishment | null;
  isAuthenticated: boolean;
  /** Exchanges a Google ID token for our session. */
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

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await api<LoginResponse>('/auth/google', {
      method: 'POST',
      body: { idToken },
    });
    const next: Session = {
      token: res.accessToken,
      user: res.user,
      establishment: res.establishment,
    };

    // If a different establishment logs in on this device, drop cached data
    // so tenants never see each other's records.
    const previous = getStoredSession();
    if (previous && previous.establishment.id !== next.establishment.id) {
      await clearAllData();
    }

    saveSession(next);
    setSession(next);
  }, []);

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
