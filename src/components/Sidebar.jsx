// src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  BedDouble,
  CalendarCheck,
  Receipt,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Menu items — each has a roles array
  // Item only shows if user's role is in the array
  const menuItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
    },
    {
      label: 'Users',
      path: '/users',
      icon: Users,
      roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    },
    {
      label: 'Rooms',
      path: '/rooms',
      icon: BedDouble,
      roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
    },
    {
      label: 'Bookings',
      path: '/bookings',
      icon: CalendarCheck,
      roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
    },
    {
      label: 'Billing',
      path: '/billing',
      icon: Receipt,
      roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    },
    {
      label: 'Permissions',
      path: '/permissions',
      icon: ShieldCheck,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
  ];

  // Role badge colors
  const roleBadgeColor = {
    SUPER_ADMIN: '#7F77DD',
    ADMIN:       '#378ADD',
    MANAGER:     '#1D9E75',
    USER:        '#639922',
  };

  return (
    <div style={{
      width: '240px',
      minHeight: '100vh',
      backgroundColor: '#1a1a2e',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      position: 'fixed',
      left: 0,
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          🏨 Hotel Manager
        </h2>
        <p style={{
          margin: '8px 0 0',
          fontSize: '12px',
          opacity: 0.6,
        }}>
          Management System
        </p>
      </div>

      {/* User info */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
          {user?.name}
        </p>
        <span style={{
          display: 'inline-block',
          marginTop: '4px',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: roleBadgeColor[user?.role] + '33',
          color: roleBadgeColor[user?.role],
          border: `1px solid ${roleBadgeColor[user?.role]}`,
        }}>
          {user?.role?.replace('_', ' ')}
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {menuItems
          .filter(item => hasRole(item.roles))
          // ↑ Only show menu items the user's role can access
          .map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                  textDecoration: 'none',
                  borderLeft: isActive
                    ? '3px solid #7F77DD'
                    : '3px solid transparent',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                })}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
      </nav>

      {/* Logout */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '10px 0',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}