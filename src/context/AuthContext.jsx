// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load — restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('hotel_token');
    const savedUser  = localStorage.getItem('hotel_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // LOGIN — called from Login page
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;

    // Save to state
    setToken(token);
    setUser(user);

    // Save to localStorage for page refresh persistence
    localStorage.setItem('hotel_token', token);
    localStorage.setItem('hotel_user', JSON.stringify(user));

    return user; // return role so Login page can redirect correctly
  };

  // LOGOUT — clear everything
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('hotel_token');
    localStorage.removeItem('hotel_user');
  };

  // Check if user has a specific role
  const hasRole = (roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    hasRole,
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Custom hook — use anywhere: const { user, login } = useAuth()
export const useAuth = () => useContext(AuthContext);