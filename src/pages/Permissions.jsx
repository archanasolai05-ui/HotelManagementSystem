// src/pages/Permissions.jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

export default function Permissions() {
  const [selectedRole, setSelectedRole]   = useState('MANAGER');
  const [permissions, setPermissions]     = useState({});
  const [loading, setLoading]             = useState(true);
  const [toggling, setToggling]           = useState(null);

  useEffect(() => { loadRolePermissions(); }, [selectedRole]);

  const loadRolePermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/permissions/role/${selectedRole}`);
      setPermissions(res.data.permissions || {});
    } catch (err) {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (permissionId, currentValue, module, action) => {
    try {
      setToggling(permissionId);
      await api.patch(`/permissions/role/${selectedRole}/toggle`, {
        permissionId,
        isEnabled: !currentValue,
      });
      toast.success(
        `${module} → ${action} ${!currentValue ? 'enabled' : 'disabled'} for ${selectedRole}`
      );
      loadRolePermissions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed');
    } finally {
      setToggling(null);
    }
  };

  const moduleColors = {
    rooms:    '#7F77DD',
    bookings: '#378ADD',
    billing:  '#1D9E75',
    users:    '#EF9F27',
    reports:  '#E24B4A',
    staff:    '#D4537E',
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700 }}>
            Permissions
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
            Toggle feature access per role — changes reflect instantly
          </p>
        </div>
        <button onClick={loadRolePermissions} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '9px 16px', borderRadius: '8px',
          border: '1px solid #ddd', background: '#fff',
          cursor: 'pointer', fontSize: '14px',
        }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Role selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
        {['ADMIN', 'MANAGER', 'USER'].map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            style={{
              padding: '10px 24px', borderRadius: '8px',
              border: selectedRole === role
                ? '2px solid #7F77DD'
                : '2px solid #e0e0e0',
              background: selectedRole === role ? '#f0eeff' : '#fff',
              color: selectedRole === role ? '#7F77DD' : '#555',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Permissions by module */}
      {loading ? (
        <p style={{ color: '#888' }}>Loading permissions...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}>
          {Object.entries(permissions).map(([module, perms]) => (
            <div key={module} style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderTop: `4px solid ${moduleColors[module] || '#888'}`,
            }}>
              {/* Module header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f0f0f0',
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  color: moduleColors[module] || '#333',
                }}>
                  {module}
                </h3>
              </div>

              {/* Permission rows */}
              <div>
                {perms.map(perm => (
                  <div key={perm.permissionId} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: '1px solid #f9f9f9',
                  }}>
                    <div>
                      <p style={{
                        margin: '0 0 2px',
                        fontSize: '14px',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                      }}>
                        {perm.action}
                      </p>
                      {perm.description && (
                        <p style={{
                          margin: 0, fontSize: '12px', color: '#aaa',
                        }}>
                          {perm.description}
                        </p>
                      )}
                    </div>

                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(
                        perm.permissionId,
                        perm.isEnabled,
                        module,
                        perm.action,
                      )}
                      disabled={toggling === perm.permissionId}
                      style={{
                        width: '48px',
                        height: '26px',
                        borderRadius: '13px',
                        border: 'none',
                        cursor: toggling === perm.permissionId
                          ? 'not-allowed'
                          : 'pointer',
                        backgroundColor: perm.isEnabled ? '#1D9E75' : '#ddd',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: '3px',
                        left: perm.isEnabled ? '25px' : '3px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}