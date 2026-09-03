import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      setToken(token);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const stored = localStorage.getItem('lovic_token');
    if (!stored) {
      setLoading(false);
      return;
    }

    // Un error transitorio (429/red/5xx) NO debe cerrar sesión: reintentamos antes de rendirnos.
    // Un 401 real ya redirige a /login desde api.js.
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const d = await api.auth.me();
          setUser(d.user);
          break;
        } catch (_) {
          if (attempt === 2) { setUser(null); break; }
          await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      setLoading(false);
    })();
  }, []);

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
