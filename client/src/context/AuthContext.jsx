import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('cmo_user') || localStorage.getItem('cmo_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('cmo_token') || localStorage.getItem('cmo_token') || null;
  });
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  const login = (userData, authToken, remember = false) => {
    setUser(userData);
    setToken(authToken);
    const prevLogin = localStorage.getItem('cmo_has_logged_in');
    if (!prevLogin) { setIsFirstLogin(true); localStorage.setItem('cmo_has_logged_in', 'true'); }
    if (remember) {
      localStorage.setItem('cmo_token', authToken);
      localStorage.setItem('cmo_user', JSON.stringify(userData));
    } else {
      sessionStorage.setItem('cmo_token', authToken);
      sessionStorage.setItem('cmo_user', JSON.stringify(userData));
    }
  };

  const logout = () => {
    setUser(null); setToken(null);
    sessionStorage.removeItem('cmo_token'); sessionStorage.removeItem('cmo_user');
    localStorage.removeItem('cmo_token'); localStorage.removeItem('cmo_user');
  };

  const updateUser = (userData) => {
    setUser(userData);
    const storage = localStorage.getItem('cmo_token') ? localStorage : sessionStorage;
    storage.setItem('cmo_user', JSON.stringify(userData));
  };

  const hasAccess = (page) => {
    if (!user) return false;
    const restricted = ['users', 'report', 'settings', 'account'];
    if (user.role === 'user' && restricted.includes(page)) return false;
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, hasAccess, isFirstLogin, setIsFirstLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
