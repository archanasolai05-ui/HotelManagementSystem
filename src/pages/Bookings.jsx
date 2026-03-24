// src/pages/Bookings.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Bookings.css';
import { Plus, RefreshCw } from 'lucide-react';

export default function Bookings() {
  const { user, hasRole } = useAuth();

  const [bookings, setBookings]               = useState([]);
  const [rooms, setRooms]                     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [showForm, setShowForm]               = useState(false);
  const [filter, setFilter]                   = useState('ALL');
  const [submitting, setSubmitting]           = useState(false);
  const [bookedRanges, setBookedRanges]       = useState([]);
  const [availabilityMsg, setAvailabilityMsg] = useState('');
  const [checkingAvail, setCheckingAvail]     = useState(false);

  // ── Staff permission flags loaded from API ─────────────────────────
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);

  const [form, setForm] = useState({
    guestName:  '',
    guestPhone: '',
    guestEmail: '',
    roomId:     '',
    checkIn:    '',
    checkOut:   '',
    notes:      '',
  });

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadBookings();
    loadRooms();
    // For USER role, fetch their individual permission overrides
   if (user?.role === 'USER' || user?.role === 'STAFF') {
  loadUserPermissions();
}
  }, [user]);

  // ── Fetch staff permissions ────────────────────────────────────────
  // Checks user-level overrides first, then falls back to role-level.
  // This matches how PermissionsGuard works on the backend.
  const loadUserPermissions = async () => {
  try {
    const res = await api.get(`/permissions/user/${user.id}`);

    console.log("FINAL USER PERMISSIONS:", res.data);

    const perms = res.data.permissions || [];

    const createPerm = perms.find(
      (p) => p.module === 'bookings' && p.action === 'create'
    );

    const updatePerm = perms.find(
      (p) => p.module === 'bookings' && p.action === 'update'
    );

    setCanCreate(createPerm?.isEnabled ?? false);
    setCanUpdate(updatePerm?.isEnabled ?? false);

  } catch (err) {
    console.error('Permission load failed:', err);
    setCanCreate(false);
    setCanUpdate(false);
  }
};

  const loadBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings');
      setBookings(res.data.bookings || []);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await api.get('/rooms?isActive=true');
      const allRooms = res.data.rooms || [];
      setRooms(allRooms.filter(r => r.status !== 'MAINTENANCE'));
    } catch {
      console.error('Failed to load rooms');
    }
  };

  const handleRoomChange = async (roomId) => {
    setForm(f => ({ ...f, roomId, checkIn: '', checkOut: '' }));
    setAvailabilityMsg('');
    setBookedRanges([]);
    if (!roomId) return;
    try {
      const res = await api.get(`/bookings/room/${roomId}/booked-dates`);
      setBookedRanges(res.data.bookedRanges || []);
    } catch {
      console.warn('Could not fetch booked dates');
    }
  };

  const checkAvailability = useCallback(async (roomId, checkIn, checkOut) => {
    if (!roomId || !checkIn || !checkOut) return;
    if (new Date(checkOut) <= new Date(checkIn)) return;
    try {
      setCheckingAvail(true);
      setAvailabilityMsg('');
      const res = await api.get('/bookings/availability', {
        params: { roomId, checkIn, checkOut },
      });
      if (!res.data.available) {
        const c    = res.data.conflict;
        const cin  = new Date(c.checkIn).toLocaleDateString('en-IN');
        const cout = new Date(c.checkOut).toLocaleDateString('en-IN');
        setAvailabilityMsg(`⚠️ Room already booked from ${cin} to ${cout}. Please choose different dates.`);
      } else {
        setAvailabilityMsg('✅ Room is available for selected dates!');
      }
    } catch {
      // silently ignore
    } finally {
      setCheckingAvail(false);
    }
  }, []);

  const getMinCheckOut = () => {
    if (!form.checkIn) return todayStr;
    const minDefault = new Date(form.checkIn);
    minDefault.setDate(minDefault.getDate() + 1);
    return minDefault.toISOString().split('T')[0];
  };

  const handleCheckInChange = (val) => {
    setForm(f => ({ ...f, checkIn: val, checkOut: '' }));
    setAvailabilityMsg('');
    if (form.checkOut) checkAvailability(form.roomId, val, form.checkOut);
  };

  const handleCheckOutChange = (val) => {
    setForm(f => ({ ...f, checkOut: val }));
    setAvailabilityMsg('');
    checkAvailability(form.roomId, form.checkIn, val);
  };

  const handleCreate = async () => {
    if (!form.guestName || !form.guestPhone || !form.roomId ||
        !form.checkIn   || !form.checkOut) {
      toast.error('Please fill all required fields');
      return;
    }
    const checkIn  = new Date(form.checkIn);
    const checkOut = new Date(form.checkOut);
    if (checkOut <= checkIn) {
      toast.error('Check-out date must be after check-in date');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) {
      toast.error('Check-in date cannot be in the past');
      return;
    }
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (nights < 1) {
      toast.error('Minimum stay is 1 night');
      return;
    }
    if (availabilityMsg.startsWith('⚠️')) {
      toast.error('Please choose available dates before booking');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/bookings', { ...form, roomId: Number(form.roomId) });
      const selectedRoom = rooms.find(r => r.id === Number(form.roomId));
      const amount = nights * Number(selectedRoom?.price || 0);
      toast.success(`Booking created! ${nights} night(s) — ₹${amount.toLocaleString()}`);
      setShowForm(false);
      resetForm();
      loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      guestName: '', guestPhone: '', guestEmail: '',
      roomId: '', checkIn: '', checkOut: '', notes: '',
    });
    setBookedRanges([]);
    setAvailabilityMsg('');
  };

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/bookings/${id}/${action}`);
      toast.success(`${action.replace(/^\w/, c => c.toUpperCase())} successful`);
      loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action}`);
    }
  };

  const filtered = filter === 'ALL'
    ? bookings
    : bookings.filter(b => b.status === filter);

  const statusBadgeClass = {
    PENDING:     'badge badge-pending',
    CONFIRMED:   'badge badge-confirmed',
    CHECKED_IN:  'badge badge-checked-in',
    CHECKED_OUT: 'badge badge-checked-out',
    CANCELLED:   'badge badge-cancelled',
  };

  const getNightsPreview = () => {
    if (!form.checkIn || !form.checkOut || !form.roomId) return null;
    const nights = Math.ceil(
      (new Date(form.checkOut) - new Date(form.checkIn)) / (1000 * 60 * 60 * 24),
    );
    const room   = rooms.find(r => r.id === Number(form.roomId));
    const amount = nights > 0 ? nights * Number(room?.price || 0) : 0;
    return nights > 0 ? { nights, amount } : null;
  };

  const preview = getNightsPreview();

  // ── Derived permission flags ───────────────────────────────────────
  const isManagerOrAbove = hasRole(['SUPERADMIN', 'ADMIN', 'MANAGER']);
  const isStaff          = hasRole(['STAFF']);
  const showNewBookingBtn = isManagerOrAbove || isStaff || canCreate;
  const showActions       = isManagerOrAbove || isStaff || canUpdate;

  return (
    <div className="bookings-page">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p>{bookings.length} total bookings</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadBookings}>
            <RefreshCw size={15} /> Refresh
          </button>
          {showNewBookingBtn && (
            <button
              className="btn btn-primary"
              onClick={() => { setShowForm(!showForm); resetForm(); }}
            >
              <Plus size={15} /> New Booking
            </button>
          )}
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="filter-tabs">
        {['ALL', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map(s => (
          <button
            key={s}
            className={`filter-tab${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* ── Create Booking Form ──────────────────────────── */}
      {showForm && (
        <div className="form-card">
          <h3>New Booking</h3>
          <div className="form-grid">

            <div className="form-group">
              <label>Guest Name *</label>
              <input
                type="text"
                value={form.guestName}
                onChange={e => setForm({ ...form, guestName: e.target.value })}
                placeholder="Full name"
              />
            </div>

            <div className="form-group">
              <label>Phone *</label>
              <input
                type="text"
                value={form.guestPhone}
                onChange={e => setForm({ ...form, guestPhone: e.target.value })}
                placeholder="10-digit phone number"
              />
            </div>

            <div className="form-group">
              <label>Email (optional)</label>
              <input
                type="email"
                value={form.guestEmail}
                onChange={e => setForm({ ...form, guestEmail: e.target.value })}
                placeholder="guest@email.com"
              />
            </div>

            <div className="form-group">
              <label>Room *</label>
              <select
                value={form.roomId}
                onChange={e => handleRoomChange(e.target.value)}
              >
                <option value="">
                  {rooms.length === 0 ? 'No rooms available' : 'Select a room'}
                </option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} — {r.type} — Floor {r.floor} —
                    ₹{Number(r.price).toLocaleString()}/night
                    {r.status === 'OCCUPIED' ? ' (Currently Occupied)' : ''}
                  </option>
                ))}
              </select>
              {bookedRanges.length > 0 && (
                <div className="booked-ranges-info">
                  <small>
                    <strong>Booked periods (unavailable):</strong>
                    {bookedRanges.map((r, i) => (
                      <span key={i} className="booked-range-badge">
                        {new Date(r.checkIn).toLocaleDateString('en-IN')}
                        {' → '}
                        {new Date(r.checkOut).toLocaleDateString('en-IN')}
                      </span>
                    ))}
                  </small>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Check-in Date *</label>
              <input
                type="date"
                value={form.checkIn}
                min={todayStr}
                onChange={e => handleCheckInChange(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Check-out Date *</label>
              <input
                type="date"
                value={form.checkOut}
                min={getMinCheckOut()}
                onChange={e => handleCheckOutChange(e.target.value)}
                disabled={!form.checkIn}
              />
            </div>

            {form.roomId && form.checkIn && form.checkOut && (
              <div className="form-group span-2">
                {checkingAvail ? (
                  <div className="availability-checking">Checking availability...</div>
                ) : availabilityMsg ? (
                  <div className={`availability-msg ${availabilityMsg.startsWith('✅') ? 'available' : 'unavailable'}`}>
                    {availabilityMsg}
                  </div>
                ) : null}
              </div>
            )}

            {preview && (
              <div className="form-group span-2">
                <div className="booking-preview">
                  <span>🌙 {preview.nights} night{preview.nights > 1 ? 's' : ''}</span>
                  <span>
                    Base: ₹{preview.amount.toLocaleString()} +
                    Tax (18%): ₹{Math.round(preview.amount * 0.18).toLocaleString()} =
                    <strong> ₹{Math.round(preview.amount * 1.18).toLocaleString()}</strong>
                  </span>
                </div>
              </div>
            )}

            <div className="form-group span-2">
              <label>Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Special requests, early check-in, etc."
              />
            </div>

          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={submitting || availabilityMsg.startsWith('⚠️')}
            >
              {submitting ? 'Creating...' : 'Create Booking'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Bookings Table ───────────────────────────────── */}
      <div className="table-wrapper">
        {loading ? (
          <p className="table-loading">Loading bookings...</p>
        ) : filtered.length === 0 ? (
          <p className="table-empty">No bookings found</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['#', 'Guest', 'Room', 'Check-in', 'Check-out', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="booking-ref">#{b.id}</td>
                  <td>
                    <p className="booking-guest-name">{b.guest?.name}</p>
                    <p className="booking-guest-phone">{b.guest?.phone}</p>
                  </td>
                  <td>
                    <p className="booking-room-number">Room {b.room?.roomNumber}</p>
                    <p className="booking-room-type">{b.room?.type}</p>
                  </td>
                  <td className="booking-date">
                    {new Date(b.checkIn).toLocaleDateString('en-IN')}
                  </td>
                  <td className="booking-date">
                    {new Date(b.checkOut).toLocaleDateString('en-IN')}
                  </td>
                  <td className="booking-amount">
                    ₹{Number(b.totalAmount).toLocaleString()}
                  </td>
                  <td>
                    <span className={statusBadgeClass[b.status] || 'badge'}>
                      {b.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {showActions && (
                      <div className="booking-action-group">
                        {b.status === 'CONFIRMED' && (
                          <button
                            className="booking-checkin-btn"
                            onClick={() => handleAction(b.id, 'checkin')}
                          >
                            Check In
                          </button>
                        )}
                        {b.status === 'CHECKED_IN' && (
                          <button
                            className="booking-checkout-btn"
                            onClick={() => handleAction(b.id, 'checkout')}
                          >
                            Check Out
                          </button>
                        )}
                        {['CONFIRMED', 'PENDING'].includes(b.status) && (
                          <button
                            className="booking-cancel-btn"
                            onClick={() => handleAction(b.id, 'cancel')}
                          >
                            Cancel
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
    </div>
  );
}