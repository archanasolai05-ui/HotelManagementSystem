// src/context/PermissionContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]         = useState(false);

  // Load permissions whenever user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPermissions();
    } else {
      setPermissions([]);
    }
  }, [isAuthenticated, user]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      // Get profile which includes permissions
      const response = await api.get('/auth/profile');
      const userPerms = response.data.permissions || [];
      setPermissions(userPerms);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has a specific permission
  // First checks user-level override, then role-level
  const hasPermission = (module, action) => {
    // Super Admin has all permissions
    if (user?.role === 'SUPER_ADMIN') return true;

    // Check user-level permission override
    const userPerm = permissions.find(
      p => p.permission.module === module &&
           p.permission.action === action,
    );

    if (userPerm) return userPerm.isEnabled;

    // If no override — default based on role
    // This is a frontend approximation
    // The backend guard is the true enforcer
    return false;
  };

  const value = {
    permissions,
    loading,
    hasPermission,
    reloadPermissions: loadPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermission = () => useContext(PermissionContext);