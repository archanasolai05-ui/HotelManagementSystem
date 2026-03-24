// src/pages/Permissions.jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Permissions.css';
import { RefreshCw } from 'lucide-react';

// Display label: USER → STAFF (value stays 'USER' for API calls)
const getRoleLabel = (role) => role === 'USER' ? 'STAFF' : role;

export default function Permissions() {
  const [selectedRole, setSelectedRole] = useState('MANAGER');
  const [permissions, setPermissions]   = useState({});
  const [loading, setLoading]           = useState(true);
  const [toggling, setToggling]         = useState(null);

  useEffect(() => { loadRolePermissions(); }, [selectedRole]);

  const loadRolePermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/permissions/role/${selectedRole}`);
      setPermissions(res.data.permissions || {});
    } catch { toast.error('Failed to load permissions'); }
    finally { setLoading(false); }
  };

  const handleToggle = async (permissionId, currentValue, module, action) => {
    try {
      setToggling(permissionId);
      await api.patch(`/permissions/role/${selectedRole}/toggle`, {
        permissionId,
        isEnabled: !currentValue,
      });
      // Show "STAFF" in toast instead of "USER"
      toast.success(
        `${module} → ${action} ${!currentValue ? 'enabled' : 'disabled'} for ${getRoleLabel(selectedRole)}`
      );
      loadRolePermissions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed');
    } finally { setToggling(null); }
  };

  return (
    <div className="permissions-page">
      <div className="page-header">
        <div>
          <h1>Permissions</h1>
          <p>Toggle feature access per role — changes reflect instantly</p>
        </div>
        <button className="btn btn-outline" onClick={loadRolePermissions}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Role selector */}
      <div className="role-selector">
        {['ADMIN', 'MANAGER', 'USER'].map(role => (
          <button
            key={role}
            className={`role-btn${selectedRole === role ? ' active' : ''}`}
            onClick={() => setSelectedRole(role)}
          >
            {getRoleLabel(role)}  {/* Shows STAFF instead of USER */}
          </button>
        ))}
      </div>

      {/* Permission module cards */}
      {loading ? (
        <p className="table-loading">Loading permissions...</p>
      ) : (
        <div className="perm-modules-grid">
          {Object.entries(permissions).map(([module, perms]) => (
            <div key={module} className={`perm-module-card ${module}`}>
              <div className="perm-module-header">
                <h3 className={module}>{module}</h3>
              </div>
              <div className="perm-module-body">
                {perms.map(perm => (
                  <div key={perm.permissionId} className="toggle-wrap">
                    <div className="toggle-info">
                      <p>{perm.action}</p>
                      {perm.description && <span>{perm.description}</span>}
                    </div>
                    <button
                      className={`toggle-btn ${perm.isEnabled ? 'on' : 'off'}`}
                      onClick={() => handleToggle(perm.permissionId, perm.isEnabled, module, perm.action)}
                      disabled={toggling === perm.permissionId}
                    >
                      <span className="toggle-knob" />
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