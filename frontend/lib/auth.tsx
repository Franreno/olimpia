"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, setAccessToken } from "./api";

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  perfil: "admin" | "editor" | "pesquisador" | "gestor";
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
  });

  // On mount, attempt silent refresh to restore session
  useEffect(() => {
    api
      .post<{ access_token: string }>("/api/v1/auth/refresh")
      .then(async (r) => {
        setAccessToken(r.data.access_token);
        const me = await api.get<AuthUser>("/api/v1/auth/me");
        setState({ user: me.data, isLoading: false });
      })
      .catch(() => {
        setState({ user: null, isLoading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ access_token: string; user: AuthUser }>(
      "/api/v1/auth/login",
      { email, password }
    );
    setAccessToken(r.data.access_token);
    const me = await api.get<AuthUser>("/api/v1/auth/me");
    setState({ user: me.data, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } finally {
      setAccessToken(null);
      setState({ user: null, isLoading: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
