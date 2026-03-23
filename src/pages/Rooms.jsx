// src/pages/Rooms.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, RefreshCw } from 'lucide-react';

export default function Rooms() {
  const { hasRole } = useAuth();
  const [rooms, setRooms]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState('ALL');
  const [form, setForm]         = useState({
    roomNumber: '', type: 'Single',
    floor: 1, price: '', description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rooms?isActive=true');
      setRooms(res.data.rooms || []);
    } catch (err) {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.roomNumber || !form.price) {
      toast.error('Room number and price are required');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/rooms', form);
      toast.success(`Room ${form.roomNumber} created!`);
      setShowForm(false);
      setForm({ roomNumber: '', type: 'Single', floor: 1, price: '', description: '' });
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/rooms/${id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id, roomNumber) => {
    if (!confirm(`Deactivate room ${roomNumber}?`)) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success(`Room ${roomNumber} deactivated`);
      loadRooms();
    } catch (err) {
      toast.error('Failed to deactivate room');
    }
  };

  const filteredRooms = filter === 'ALL'
    ? rooms
    : rooms.filter(r => r.status === filter);

  const statusColor = {
    AVAILABLE:   { bg: '#e8f8f2', color: '#1D9E75' },
    OCCUPIED:    { bg: '#e8f0fb', color: '#378ADD' },
    MAINTENANCE: { bg: '#fff8e8', color: '#EF9F27' },
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
            Rooms
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
            {rooms.length} total rooms
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadRooms} style={{
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
              <Plus size={15} /> Add Room
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['ALL', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '7px 16px', borderRadius: '20px', fontSize: '13px',
            fontWeight: 500, cursor: 'pointer', border: 'none',
            backgroundColor: filter === s ? '#7F77DD' : '#f0f0f0',
            color: filter === s ? '#fff' : '#555',
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Create Room Form */}
      {showForm && (
        <div style={{
          backgroundColor: '#fff', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>
            Add New Room
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
          }}>
            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Room Number
              </label>
              <input
                value={form.roomNumber}
                onChange={e => setForm({...form, roomNumber: e.target.value})}
                placeholder="101"
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Type
              </label>
              <select
                value={form.type}
                onChange={e => setForm({...form, type: e.target.value})}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              >
                {['Single', 'Double', 'Suite', 'Deluxe'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Floor
              </label>
              <input
                type="number"
                value={form.floor}
                onChange={e => setForm({...form, floor: Number(e.target.value)})}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Price per night (₹)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm({...form, price: Number(e.target.value)})}
                placeholder="1500"
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Description (optional)
              </label>
              <input
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Room description..."
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={handleCreate} disabled={submitting} style={{
              padding: '9px 20px', borderRadius: '8px',
              border: 'none', background: '#7F77DD', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600,
            }}>
              {submitting ? 'Creating...' : 'Create Room'}
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

      {/* Rooms Grid */}
      {loading ? (
        <p style={{ color: '#888' }}>Loading rooms...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '16px',
        }}>
          {filteredRooms.map(room => (
            <div key={room.id} style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderTop: `4px solid ${statusColor[room.status]?.color}`,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                  Room {room.roomNumber}
                </h3>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px',
                  fontSize: '11px', fontWeight: 600,
                  backgroundColor: statusColor[room.status]?.bg,
                  color: statusColor[room.status]?.color,
                }}>
                  {room.status}
                </span>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#555' }}>
                {room.type} · Floor {room.floor}
              </p>
              <p style={{
                margin: '0 0 16px',
                fontSize: '18px', fontWeight: 700, color: '#7F77DD',
              }}>
                ₹{Number(room.price).toLocaleString()}/night
              </p>

              {/* Status change buttons */}
              {hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']
                    .filter(s => s !== room.status)
                    .map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(room.id, s)}
                        style={{
                          padding: '4px 10px', borderRadius: '6px',
                          border: `1px solid ${statusColor[s]?.color}`,
                          background: statusColor[s]?.bg,
                          color: statusColor[s]?.color,
                          cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                        }}
                      >
                        → {s}
                      </button>
                    ))}
                  {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                    <button
                      onClick={() => handleDelete(room.id, room.roomNumber)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid #E24B4A',
                        background: '#fee8e8', color: '#E24B4A',
                        cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                      }}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}