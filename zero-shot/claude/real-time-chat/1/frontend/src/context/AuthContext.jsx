import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('chat_token');
      const raw   = localStorage.getItem('chat_user');
      if (token && raw) return { token, ...JSON.parse(raw) };
    } catch {
      localStorage.removeItem('chat_token');
      localStorage.removeItem('chat_user');
    }
    return null;
  });

  const login = useCallback((token, userId, username) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify({ userId, username }));
    setUser({ token, userId, username });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
