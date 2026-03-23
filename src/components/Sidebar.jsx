// src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Sidebar.css';
import {
  LayoutDashboard, Users, BedDouble,
  CalendarCheck, Receipt, ShieldCheck, LogOut,
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard, roles: ['SUPER_ADMIN','ADMIN','MANAGER','USER'] },
    { label: 'Users',       path: '/users',       icon: Users,           roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { label: 'Rooms',       path: '/rooms',       icon: BedDouble,       roles: ['SUPER_ADMIN','ADMIN','MANAGER','USER'] },
    { label: 'Bookings',    path: '/bookings',    icon: CalendarCheck,   roles: ['SUPER_ADMIN','ADMIN','MANAGER','USER'] },
    { label: 'Billing',     path: '/billing',     icon: Receipt,         roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { label: 'Permissions', path: '/permissions', icon: ShieldCheck,     roles: ['SUPER_ADMIN','ADMIN'] },
  ];

  const roleBadgeClass = {
    SUPER_ADMIN: 'super-admin',
    ADMIN:       'admin',
    MANAGER:     'manager',
    USER:        'user',
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <h2>🏨 Hotel Manager</h2>
        <p>Management System</p>
      </div>

      {/* User info */}
      <div className="sidebar-user">
        <p className="sidebar-user-name">{user?.name}</p>
        <span className={`sidebar-role-badge ${roleBadgeClass[user?.role] || 'user'}`}>
          {user?.role?.replace('_', ' ')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menuItems
          .filter(item => hasRole(item.roles))
          .map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}