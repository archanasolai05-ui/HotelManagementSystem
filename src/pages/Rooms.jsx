// src/pages/Rooms.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Rooms.css';
import { Plus, RefreshCw } from 'lucide-react';

export default function Rooms() {
  const { hasRole } = useAuth();
  const [rooms, setRooms]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState('ALL');
  const [form, setForm] = useState({ roomNumber:'', type:'Single', floor:1, price:'', description:'' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rooms?isActive=true');
      setRooms(res.data.rooms || []);
    } catch { toast.error('Failed to load rooms'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.roomNumber || !form.price) {
      toast.error('Room number and price required'); return;
    }
    try {
      setSubmitting(true);
      await api.post('/rooms', form);
      toast.success(`Room ${form.roomNumber} created!`);
      setShowForm(false);
      setForm({ roomNumber:'', type:'Single', floor:1, price:'', description:'' });
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSubmitting(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/rooms/${id}/status`, { status });
      toast.success(`Status → ${status}`);
      loadRooms();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id, num) => {
    if (!confirm(`Deactivate room ${num}?`)) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success(`Room ${num} deactivated`);
      loadRooms();
    } catch { toast.error('Failed'); }
  };

  const filteredRooms = filter === 'ALL' ? rooms : rooms.filter(r => r.status === filter);

  const statusBadgeClass = {
    AVAILABLE:   'badge badge-available',
    OCCUPIED:    'badge badge-occupied',
    MAINTENANCE: 'badge badge-maintenance',
  };

  return (
    <div className="rooms-page">
      <div className="page-header">
        <div>
          <h1>Rooms</h1>
          <p>{rooms.length} total rooms</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadRooms}>
            <RefreshCw size={15} /> Refresh
          </button>
          {hasRole(['SUPER_ADMIN','ADMIN','MANAGER']) && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              <Plus size={15} /> Add Room
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {['ALL','AVAILABLE','OCCUPIED','MAINTENANCE'].map(s => (
          <button
            key={s}
            className={`filter-tab${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="form-card">
          <h3>Add New Room</h3>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Room Number</label>
              <input value={form.roomNumber} onChange={e => setForm({...form, roomNumber: e.target.value})} placeholder="101" />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {['Single','Double','Suite','Deluxe'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Floor</label>
              <input type="number" value={form.floor} onChange={e => setForm({...form, floor: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Price per night (₹)</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} placeholder="1500" />
            </div>
            <div className="form-group span-2">
              <label>Description (optional)</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Room description..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Room'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rooms grid */}
      {loading ? (
        <p className="table-loading">Loading rooms...</p>
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map(room => (
            <div key={room.id} className={`room-card ${room.status?.toLowerCase()}`}>
              <div className="room-card-header">
                <span className="room-card-number">Room {room.roomNumber}</span>
                <span className={statusBadgeClass[room.status]}>{room.status}</span>
              </div>
              <p className="room-card-info">{room.type} · Floor {room.floor}</p>
              <p className="room-card-price">₹{Number(room.price).toLocaleString()}/night</p>
              {hasRole(['SUPER_ADMIN','ADMIN','MANAGER']) && (
                <div className="room-card-actions">
                  {['AVAILABLE','OCCUPIED','MAINTENANCE']
                    .filter(s => s !== room.status)
                    .map(s => (
                      <button
                        key={s}
                        className={`room-status-btn to-${s.toLowerCase()}`}
                        onClick={() => handleStatusChange(room.id, s)}
                      >
                        → {s}
                      </button>
                    ))}
                  {hasRole(['SUPER_ADMIN','ADMIN']) && (
                    <button className="room-status-btn deactivate" onClick={() => handleDelete(room.id, room.roomNumber)}>
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