// src/pages/Rooms.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Rooms.css';
import { Plus, RefreshCw, User, CalendarCheck } from 'lucide-react';

export default function Rooms() {
  const { hasRole } = useAuth();
  const [rooms, setRooms]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [filter, setFilter]         = useState('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    roomNumber: '', type: 'Single', floor: 1, price: '', description: '',
  });

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rooms?isActive=true');
      setRooms(res.data.rooms || []);
    } catch {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.roomNumber || !form.price) {
      toast.error('Room number and price required');
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

  // ── KEY FIX: handleStatusChange only allows AVAILABLE / MAINTENANCE ──
  //
  //  OLD (WRONG): staff could click "→ OCCUPIED" manually, bypassing the
  //    booking system and causing the room to disappear from the booking
  //    dropdown incorrectly.
  //
  //  NEW (CORRECT): the "→ OCCUPIED" button is completely removed from the
  //    UI. OCCUPIED is set only by the check-in flow in bookings.service.ts.
  //    Staff can only manually switch between AVAILABLE ↔ MAINTENANCE.
  //    If they try to mark a room OCCUPIED via API directly, the backend
  //    will reject it with a clear error message.
  //
  const handleStatusChange = async (id, status, roomNumber) => {
    const label = status === 'MAINTENANCE'
      ? `Put Room ${roomNumber} into maintenance?`
      : `Mark Room ${roomNumber} as available?`;

    if (!confirm(label)) return;

    try {
      await api.patch(`/rooms/${id}/status`, { status });
      toast.success(`Room ${roomNumber} → ${status}`);
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id, num) => {
    if (!confirm(`Deactivate Room ${num}? This cannot be undone.`)) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success(`Room ${num} deactivated`);
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate');
    }
  };

  const filteredRooms = filter === 'ALL'
    ? rooms
    : rooms.filter(r => r.status === filter);

  const statusBadgeClass = {
    AVAILABLE:   'badge badge-available',
    OCCUPIED:    'badge badge-occupied',
    MAINTENANCE: 'badge badge-maintenance',
  };

  return (
    <div className="rooms-page">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Rooms</h1>
          <p>{rooms.length} total rooms</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadRooms}>
            <RefreshCw size={15} /> Refresh
          </button>
          {hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) && (
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus size={15} /> Add Room
            </button>
          )}
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="filter-tabs">
        {['ALL', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].map(s => (
          <button
            key={s}
            className={`filter-tab${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Create Room Form ─────────────────────────────── */}
      {showForm && (
        <div className="form-card">
          <h3>Add New Room</h3>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Room Number</label>
              <input
                value={form.roomNumber}
                onChange={e => setForm({ ...form, roomNumber: e.target.value })}
                placeholder="101"
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                {['Single', 'Double', 'Suite', 'Deluxe'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Floor</label>
              <input
                type="number"
                value={form.floor}
                onChange={e => setForm({ ...form, floor: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Price per night (₹)</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                placeholder="1500"
              />
            </div>
            <div className="form-group span-2">
              <label>Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Room description..."
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Room'}
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

      {/* ── Rooms Grid ───────────────────────────────────── */}
      {loading ? (
        <p className="table-loading">Loading rooms...</p>
      ) : filteredRooms.length === 0 ? (
        <p className="table-empty">No rooms found</p>
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map(room => (
            <div key={room.id} className={`room-card ${room.status?.toLowerCase()}`}>

              {/* Card Header */}
              <div className="room-card-header">
                <span className="room-card-number">Room {room.roomNumber}</span>
                <span className={statusBadgeClass[room.status]}>
                  {room.status}
                </span>
              </div>

              {/* Room Info */}
              <p className="room-card-info">{room.type} · Floor {room.floor}</p>
              <p className="room-card-price">
                ₹{Number(room.price).toLocaleString()}/night
              </p>

              {/* ── KEY FIX: Show who is in the room if OCCUPIED ────── */}
              {room.status === 'OCCUPIED' && room.currentGuest && (
                <div className="room-current-guest">
                  <User size={12} />
                  <span>{room.currentGuest}</span>
                </div>
              )}

              {/* ── Show future booking count ─────────────────────── */}
              {room.activeBookingsCount > 0 && room.status !== 'OCCUPIED' && (
                <div className="room-booking-count">
                  <CalendarCheck size={12} />
                  <span>
                    {room.activeBookingsCount} upcoming booking
                    {room.activeBookingsCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* ── KEY FIX: Action Buttons ─────────────────────────
                  OCCUPIED button is completely removed.
                  - AVAILABLE room  → can go to MAINTENANCE only
                  - OCCUPIED room   → no manual buttons (system controlled)
                  - MAINTENANCE room → can go to AVAILABLE only
                  Staff who need to check out a guest must use the Bookings page.
              ─────────────────────────────────────────────────────── */}
              {hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) && (
                <div className="room-card-actions">

                  {/* AVAILABLE → can only go to MAINTENANCE */}
                  {room.status === 'AVAILABLE' && (
                    <button
                      className="room-status-btn to-maintenance"
                      onClick={() => handleStatusChange(room.id, 'MAINTENANCE', room.roomNumber)}
                    >
                      → MAINTENANCE
                    </button>
                  )}

                  {/* OCCUPIED → no manual status buttons at all */}
                  {room.status === 'OCCUPIED' && (
                    <p className="room-status-note">
                      ⚠️ Check out guest via <strong>Bookings</strong> page
                    </p>
                  )}

                  {/* MAINTENANCE → can only go back to AVAILABLE */}
                  {room.status === 'MAINTENANCE' && (
                    <button
                      className="room-status-btn to-available"
                      onClick={() => handleStatusChange(room.id, 'AVAILABLE', room.roomNumber)}
                    >
                      → AVAILABLE
                    </button>
                  )}

                  {/* Deactivate — SUPER_ADMIN and ADMIN only */}
                  {hasRole(['SUPER_ADMIN', 'ADMIN']) && room.status !== 'OCCUPIED' && (
                    <button
                      className="room-status-btn deactivate"
                      onClick={() => handleDelete(room.id, room.roomNumber)}
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