// src/pages/Bookings.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Bookings.css';
import { Plus, RefreshCw } from 'lucide-react';

export default function Bookings() {
  const { hasRole } = useAuth();
  const [bookings, setBookings]   = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [filter, setFilter]       = useState('ALL');
  const [form, setForm] = useState({
    guestName:'', guestPhone:'', guestEmail:'',
    roomId:'', checkIn:'', checkOut:'', notes:'',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadBookings(); loadRooms(); }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings');
      setBookings(res.data.bookings || []);
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  };

  const loadRooms = async () => {
    try {
      const res = await api.get('/rooms?status=AVAILABLE');
      setRooms(res.data.rooms || []);
    } catch { console.error('Failed to load rooms'); }
  };

  const handleCreate = async () => {
    if (!form.guestName || !form.guestPhone || !form.roomId || !form.checkIn || !form.checkOut) {
      toast.error('Please fill all required fields'); return;
    }
    try {
      setSubmitting(true);
      await api.post('/bookings', { ...form, roomId: Number(form.roomId) });
      toast.success('Booking created!');
      setShowForm(false);
      setForm({ guestName:'', guestPhone:'', guestEmail:'', roomId:'', checkIn:'', checkOut:'', notes:'' });
      loadBookings(); loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSubmitting(false); }
  };

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/bookings/${id}/${action}`);
      toast.success(`${action} successful`);
      loadBookings(); loadRooms();
    } catch (err) { toast.error(err.response?.data?.message || `Failed to ${action}`); }
  };

  const filtered = filter === 'ALL' ? bookings : bookings.filter(b => b.status === filter);

  const statusBadgeClass = {
    PENDING:     'badge badge-pending',
    CONFIRMED:   'badge badge-confirmed',
    CHECKED_IN:  'badge badge-checked-in',
    CHECKED_OUT: 'badge badge-checked-out',
    CANCELLED:   'badge badge-cancelled',
  };

  return (
    <div className="bookings-page">
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p>{bookings.length} total bookings</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadBookings}>
            <RefreshCw size={15} /> Refresh
          </button>
          {hasRole(['SUPER_ADMIN','ADMIN','MANAGER']) && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              <Plus size={15} /> New Booking
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {['ALL','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED'].map(s => (
          <button key={s} className={`filter-tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s.replace('_',' ')}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="form-card">
          <h3>New Booking</h3>
          <div className="form-grid">
            {[
              {label:'Guest Name *',  key:'guestName',  type:'text'},
              {label:'Phone *',       key:'guestPhone', type:'text'},
              {label:'Email',         key:'guestEmail', type:'email'},
              {label:'Check-in *',    key:'checkIn',    type:'date'},
              {label:'Check-out *',   key:'checkOut',   type:'date'},
            ].map(f => (
              <div key={f.key} className="form-group">
                <label>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} />
              </div>
            ))}
            <div className="form-group">
              <label>Room *</label>
              <select value={form.roomId} onChange={e => setForm({...form, roomId: e.target.value})}>
                <option value="">Select a room</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} — {r.type} — ₹{Number(r.price).toLocaleString()}/night
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group span-2">
              <label>Notes (optional)</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Special requests..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Booking'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <p className="table-loading">Loading bookings...</p>
        ) : filtered.length === 0 ? (
          <p className="table-empty">No bookings found</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['#','Guest','Room','Check-in','Check-out','Amount','Status','Actions'].map(h => (
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
                  <td className="booking-date">{new Date(b.checkIn).toLocaleDateString('en-IN')}</td>
                  <td className="booking-date">{new Date(b.checkOut).toLocaleDateString('en-IN')}</td>
                  <td className="booking-amount">₹{Number(b.totalAmount).toLocaleString()}</td>
                  <td><span className={statusBadgeClass[b.status]}>{b.status?.replace('_',' ')}</span></td>
                  <td>
                    {hasRole(['SUPER_ADMIN','ADMIN','MANAGER']) && (
                      <div className="booking-action-group">
                        {b.status === 'CONFIRMED' && (
                          <button className="booking-checkin-btn" onClick={() => handleAction(b.id,'checkin')}>Check In</button>
                        )}
                        {b.status === 'CHECKED_IN' && (
                          <button className="booking-checkout-btn" onClick={() => handleAction(b.id,'checkout')}>Check Out</button>
                        )}
                        {['CONFIRMED','PENDING'].includes(b.status) && (
                          <button className="booking-cancel-btn" onClick={() => handleAction(b.id,'cancel')}>Cancel</button>
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