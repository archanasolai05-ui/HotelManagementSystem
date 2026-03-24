// src/pages/Users.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Users.css';
import { UserPlus, Power, PowerOff, RefreshCw, ShieldCheck, X } from 'lucide-react';

// ── Helper: display label for role ───────────────────────
const getRoleLabel = (role) => {
  if (role === 'USER') return 'STAFF';
  return role?.replace('_', ' ') || role;
};

export default function Users() {
  const { user, hasRole } = useAuth();
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms]       = useState([]);
  const [allPerms, setAllPerms]         = useState([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'USER',
  });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // ── Open permissions panel ────────────────────────────
  const openPermissions = async (targetUser) => {
    setSelectedUser(targetUser);
    setPermsLoading(true);
    try {
      const [roleRes, userRes] = await Promise.all([
        api.get(`/permissions/role/${targetUser.role}`),
        api.get(`/permissions/user/${targetUser.id}`),
      ]);

      const grouped = roleRes.data.permissions || {};
      const flatPerms = [];
      Object.entries(grouped).forEach(([module, perms]) => {
        perms.forEach(p => {
          flatPerms.push({
            id:          p.permissionId,
            module,
            action:      p.action,
            description: p.description,
            roleEnabled: p.isEnabled, // Store role-level status
          });
        });
      });

      setAllPerms(flatPerms);
      setUserPerms(userRes.data.permissions || []);
    } catch (err) {
      console.error('Permission load error:', err);
      toast.error('Failed to load permissions');
    } finally {
      setPermsLoading(false);
    }
  };

  // ── Toggle permission for user ────────────────────────
  const handleToggle = async (permissionId, currentEffectiveValue, module, action) => {
    // Find the permission to check if role-level allows toggling
    const perm = allPerms.find(p => p.id === permissionId);
    if (!perm?.roleEnabled) {
      toast.error('Cannot modify permission disabled by Super Admin');
      return;
    }

    try {
      await api.patch(`/permissions/user/${selectedUser.id}/toggle`, {
        permissionId,
        isEnabled: !currentEffectiveValue,
      });
      toast.success(
        `${module} → ${action} ${!currentEffectiveValue ? 'enabled' : 'disabled'}`,
      );
      // Reload permissions to reflect changes
      const res = await api.get(`/permissions/user/${selectedUser.id}`);
      setUserPerms(res.data.permissions || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  // ── Create user ───────────────────────────────────────
  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all fields');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/auth/register', form);
      // Show "Staff" instead of "User" in success toast
      const displayRole = form.role === 'USER' ? 'Staff' : form.role;
      toast.success(`${displayRole} created successfully!`);
      setShowForm(false);
      setForm({ name:'', email:'', password:'', role:'USER' });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Disable user ──────────────────────────────────────
  const handleDisable = async (id, name) => {
    try {
      await api.patch(`/auth/users/${id}/disable`);
      toast.success(`${name} has been disabled`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable');
    }
  };

  // ── Enable user ───────────────────────────────────────
  const handleEnable = async (id, name) => {
    try {
      await api.patch(`/auth/users/${id}/enable`);
      toast.success(`${name} has been enabled`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enable');
    }
  };

  const getRoleOptions = () => {
    if (user?.role === 'SUPER_ADMIN') return ['ADMIN', 'MANAGER', 'USER'];
    if (user?.role === 'ADMIN')       return ['MANAGER', 'USER'];
    if (user?.role === 'MANAGER')     return ['USER'];
    return [];
  };

  const roleBadgeClass = {
    SUPER_ADMIN: 'badge badge-super-admin',
    ADMIN:       'badge badge-admin',
    MANAGER:     'badge badge-manager',
    USER:        'badge badge-user',
  };

  const moduleColor = {
    rooms:    '#7F77DD',
    bookings: '#378ADD',
    billing:  '#1D9E75',
    users:    '#EF9F27',
    reports:  '#E24B4A',
    staff:    '#D4537E',
  };

  const groupedPerms = allPerms.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="users-page">

      {/* ── Header ────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Manage users in your branch</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadUsers}>
            <RefreshCw size={15} /> Refresh
          </button>
          {hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) && (
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(!showForm)}
            >
              <UserPlus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* ── Create User Form ──────────────────────────── */}
      {showForm && (
        <div className="form-card">
          <h3>Create New User</h3>
          <div className="form-grid">
            {[
              { label: 'Full Name', key: 'name',     type: 'text' },
              { label: 'Email',     key: 'email',    type: 'email' },
              { label: 'Password',  key: 'password', type: 'password' },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label>{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={e => setForm({...form, [f.key]: e.target.value})}
                />
              </div>
            ))}
            <div className="form-group">
              <label>Role</label>
              <select
                value={form.role}
                onChange={e => setForm({...form, role: e.target.value})}
              >
                {getRoleOptions().map(r => (
                  // Show "STAFF" in dropdown for USER role
                  <option key={r} value={r}>
                    {r === 'USER' ? 'STAFF' : r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create User'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Users Table ───────────────────────────────── */}
      <div className="table-wrapper">
        {loading ? (
          <p className="table-loading">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="table-empty">No users found</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === user?.id && (
                      <span className="user-you-tag">(you)</span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={roleBadgeClass[u.role] || 'badge'}>
                      {/* Display USER as STAFF, others as-is */}
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-active' : 'badge-disabled'}`}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    {u.id !== user?.id && (
                      <div className="action-group">

                        {/* Disable / Enable */}
                        {u.isActive ? (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDisable(u.id, u.name)}
                          >
                            <PowerOff size={11} /> Disable
                          </button>
                        ) : (
                          hasRole(['SUPER_ADMIN', 'ADMIN']) ? (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleEnable(u.id, u.name)}
                            >
                              <Power size={11} /> Enable
                            </button>
                          ) : (
                            <span className="contact-admin-msg">
                              Contact Admin to enable
                            </span>
                          )
                        )}

                        {/* Permissions button — only for USER/STAFF role */}
                        {u.role === 'USER' && (
                          <button
                            className="btn btn-sm"
                            style={{
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                            }}
                            onClick={() => openPermissions(u)}
                          >
                            <ShieldCheck size={11} /> Permissions
                          </button>
                        )}

                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Permissions Slide Panel ───────────────────── */}
      {selectedUser && (
        <>
          {/* Overlay */}
          <div
            className="perm-overlay"
            onClick={() => setSelectedUser(null)}
          />

          {/* Panel */}
          <div className="perm-panel">

            {/* Panel header */}
            <div className="perm-panel-header">
              <div>
                <h3>Permissions — {selectedUser.name}</h3>
                <p>Toggle features for this staff member</p>
              </div>
              <button
                className="perm-close-btn"
                onClick={() => setSelectedUser(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning note */}
            <div className="perm-note">
              You can only enable permissions that you yourself have access to.
              Permissions disabled by Super Admin cannot be overridden.
            </div>

            {/* Permission toggles */}
            {permsLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Loading permissions...
              </p>
            ) : Object.keys(groupedPerms).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                No permissions available.
              </p>
            ) : (
              Object.entries(groupedPerms).map(([module, perms]) => (
                <div key={module}>
                  <h4
                    className="perm-module-title"
                    style={{
                      color: moduleColor[module] || '#555',
                      borderBottomColor:
                        (moduleColor[module] || '#ccc') + '55',
                    }}
                  >
                    {module}
                  </h4>

                  {perms.map(perm => {
                    const override = userPerms.find(
                      up => up.permissionId === perm.id,
                    );

                    // Calculate effective permission status:
                    // 1. If role-level is disabled, permission is disabled (no override possible)
                    // 2. If role-level is enabled, use user-level override or default to enabled
                    const effectiveEnabled = perm.roleEnabled
                      ? (override?.isEnabled ?? true)  // Role enabled, check override or default to enabled
                      : false;  // Role disabled, cannot be enabled

                    return (
                      <div key={perm.id} className="toggle-wrap">
                        <div className="toggle-info">
                          <p>{perm.action}</p>
                          {perm.description && (
                            <span>{perm.description}</span>
                          )}
                          {!perm.roleEnabled && (
                            <span style={{ color: 'var(--danger)', fontSize: '12px' }}>
                              (Disabled by Super Admin)
                            </span>
                          )}
                        </div>
                        <button
                          className={`toggle-btn ${effectiveEnabled ? 'on' : 'off'}`}
                          onClick={() => handleToggle(
                            perm.id,
                            effectiveEnabled,
                            module,
                            perm.action,
                          )}
                          disabled={!perm.roleEnabled} // Cannot toggle if role-level is disabled
                        >
                          <span className="toggle-knob" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}