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

    api.auth.me()
      .then(d => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
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
