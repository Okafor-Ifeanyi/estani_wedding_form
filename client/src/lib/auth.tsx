import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { Admin } from './types';

interface AuthValue {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Admin>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setAdmin(res.admin))
      .catch(() => {
        setToken(null);
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<Admin> => {
    const res = await api.login(email, password);
    setToken(res.token);
    setAdmin(res.admin);
    return res.admin;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return ctx;
}
