// src/pages/Users.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { UserPlus, Power, PowerOff, RefreshCw } from 'lucide-react';

export default function Users() {
  const { user, hasRole } = useAuth();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({
    name: '', email: '', password: '', role: 'USER',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all fields');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/auth/register', form);
      toast.success(`${form.role} created successfully!`);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'USER' });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (id, name) => {
    try {
      await api.patch(`/auth/users/${id}/disable`);
      toast.success(`${name} has been disabled`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable user');
    }
  };

  const handleEnable = async (id, name) => {
    try {
      await api.patch(`/auth/users/${id}/enable`);
      toast.success(`${name} has been enabled`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enable user');
    }
  };

  // Role options based on current user's role
  const getRoleOptions = () => {
    if (user?.role === 'SUPER_ADMIN') return ['ADMIN', 'MANAGER', 'USER'];
    if (user?.role === 'ADMIN')       return ['MANAGER', 'USER'];
    if (user?.role === 'MANAGER')     return ['USER'];
    return [];
  };

  const roleBadge = {
    SUPER_ADMIN: { bg: '#f0eeff', color: '#7F77DD' },
    ADMIN:       { bg: '#e8f0fb', color: '#378ADD' },
    MANAGER:     { bg: '#e8f8f2', color: '#1D9E75' },
    USER:        { bg: '#edf7e0', color: '#639922' },
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700 }}>
            Users
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
            Manage users in your branch
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadUsers} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '8px',
            border: '1px solid #ddd', background: '#fff',
            cursor: 'pointer', fontSize: '14px',
          }}>
            <RefreshCw size={15} /> Refresh
          </button>
          {hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) && (
            <button onClick={() => setShowForm(!showForm)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', borderRadius: '8px',
              border: 'none', background: '#7F77DD', color: '#fff',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}>
              <UserPlus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>
            Create New User
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Password', key: 'password', type: 'password' },
            ].map(field => (
              <div key={field.key}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: 500, marginBottom: '6px', color: '#555',
                }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={e => setForm({...form, [field.key]: e.target.value})}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: '1px solid #ddd', borderRadius: '8px',
                    fontSize: '14px', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Role
              </label>
              <select
                value={form.role}
                onChange={e => setForm({...form, role: e.target.value})}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              >
                {getRoleOptions().map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={handleCreate} disabled={submitting} style={{
              padding: '9px 20px', borderRadius: '8px',
              border: 'none', background: '#7F77DD', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600,
            }}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '9px 20px', borderRadius: '8px',
              border: '1px solid #ddd', background: '#fff',
              cursor: 'pointer', fontSize: '14px',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        {loading ? (
          <p style={{ padding: '24px', color: '#888' }}>Loading users...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '13px', fontWeight: 600, color: '#555',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{
                  borderTop: '1px solid #f0f0f0',
                  backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    {u.name}
                    {u.id === user?.id && (
                      <span style={{
                        marginLeft: '8px', fontSize: '11px',
                        color: '#888',
                      }}>
                        (you)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px',
                      fontSize: '12px', fontWeight: 600,
                      backgroundColor: roleBadge[u.role]?.bg,
                      color: roleBadge[u.role]?.color,
                    }}>
                      {u.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px',
                      fontSize: '12px', fontWeight: 600,
                      backgroundColor: u.isActive ? '#e8f8f2' : '#fee8e8',
                      color: u.isActive ? '#1D9E75' : '#E24B4A',
                    }}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {/* Don't show action buttons for yourself */}
                    {u.id !== user?.id && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {u.isActive ? (
                          <button
                            onClick={() => handleDisable(u.id, u.name)}
                            style={{
                              display: 'flex', alignItems: 'center',
                              gap: '4px', padding: '5px 10px',
                              borderRadius: '6px', border: 'none',
                              background: '#fee8e8', color: '#E24B4A',
                              cursor: 'pointer', fontSize: '12px',
                            }}
                          >
                            <PowerOff size={12} /> Disable
                          </button>
                        ) : (
                          hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                            <button
                              onClick={() => handleEnable(u.id, u.name)}
                              style={{
                                display: 'flex', alignItems: 'center',
                                gap: '4px', padding: '5px 10px',
                                borderRadius: '6px', border: 'none',
                                background: '#e8f8f2', color: '#1D9E75',
                                cursor: 'pointer', fontSize: '12px',
                              }}
                            >
                              <Power size={12} /> Enable
                            </button>
                          )
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
    </div>
  );
}