// src/pages/Bookings.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, RefreshCw } from 'lucide-react';

export default function Bookings() {
  const { hasRole } = useAuth();
  const [bookings, setBookings]   = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [filter, setFilter]       = useState('ALL');
  const [form, setForm]           = useState({
    guestName: '', guestPhone: '', guestEmail: '',
    roomId: '', checkIn: '', checkOut: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBookings();
    loadRooms();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings');
      setBookings(res.data.bookings || []);
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await api.get('/rooms?status=AVAILABLE');
      setRooms(res.data.rooms || []);
    } catch (err) {
      console.error('Failed to load rooms');
    }
  };

  const handleCreate = async () => {
    if (!form.guestName || !form.guestPhone || !form.roomId ||
        !form.checkIn || !form.checkOut) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/bookings', {
        ...form,
        roomId: Number(form.roomId),
      });
      toast.success('Booking created successfully!');
      setShowForm(false);
      setForm({
        guestName: '', guestPhone: '', guestEmail: '',
        roomId: '', checkIn: '', checkOut: '', notes: '',
      });
      loadBookings();
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/bookings/${id}/${action}`);
      toast.success(`Booking ${action} successful`);
      loadBookings();
      loadRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action}`);
    }
  };

  const filteredBookings = filter === 'ALL'
    ? bookings
    : bookings.filter(b => b.status === filter);

  const statusColor = {
    PENDING:      { bg: '#fff8e8', color: '#EF9F27' },
    CONFIRMED:    { bg: '#e8f0fb', color: '#378ADD' },
    CHECKED_IN:   { bg: '#e8f8f2', color: '#1D9E75' },
    CHECKED_OUT:  { bg: '#f0f0f0', color: '#888' },
    CANCELLED:    { bg: '#fee8e8', color: '#E24B4A' },
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
            Bookings
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
            {bookings.length} total bookings
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadBookings} style={{
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
              <Plus size={15} /> New Booking
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['ALL', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '7px 14px', borderRadius: '20px', fontSize: '12px',
            fontWeight: 500, cursor: 'pointer', border: 'none',
            backgroundColor: filter === s ? '#7F77DD' : '#f0f0f0',
            color: filter === s ? '#fff' : '#555',
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Create Booking Form */}
      {showForm && (
        <div style={{
          backgroundColor: '#fff', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>
            New Booking
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
          }}>
            {[
              { label: 'Guest Name *', key: 'guestName', type: 'text' },
              { label: 'Phone *', key: 'guestPhone', type: 'text' },
              { label: 'Email', key: 'guestEmail', type: 'email' },
              { label: 'Check-in Date *', key: 'checkIn', type: 'date' },
              { label: 'Check-out Date *', key: 'checkOut', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: 500, marginBottom: '6px', color: '#555',
                }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={e => setForm({...form, [f.key]: e.target.value})}
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
                Room *
              </label>
              <select
                value={form.roomId}
                onChange={e => setForm({...form, roomId: e.target.value})}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #ddd', borderRadius: '8px',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              >
                <option value="">Select a room</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} — {r.type} — ₹{Number(r.price).toLocaleString()}/night
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: 500, marginBottom: '6px', color: '#555',
              }}>
                Notes (optional)
              </label>
              <input
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="Special requests..."
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
              {submitting ? 'Creating...' : 'Create Booking'}
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

      {/* Bookings Table */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        {loading ? (
          <p style={{ padding: '24px', color: '#888' }}>Loading bookings...</p>
        ) : filteredBookings.length === 0 ? (
          <p style={{ padding: '24px', color: '#888', textAlign: 'center' }}>
            No bookings found
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                {['Ref', 'Guest', 'Room', 'Check-in', 'Check-out', 'Amount', 'Status', 'Actions'].map(h => (
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
              {filteredBookings.map((b, i) => (
                <tr key={b.id} style={{
                  borderTop: '1px solid #f0f0f0',
                  backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                }}>
                  <td style={{
                    padding: '12px 16px',
                    fontSize: '12px', color: '#888', fontFamily: 'monospace',
                  }}>
                    #{b.id}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: '14px' }}>
                      {b.guest?.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                      {b.guest?.phone}
                    </p>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    Room {b.room?.roomNumber}
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888', fontWeight: 400 }}>
                      {b.room?.type}
                    </p>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#555' }}>
                    {new Date(b.checkIn).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#555' }}>
                    {new Date(b.checkOut).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    ₹{Number(b.totalAmount).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px',
                      fontSize: '11px', fontWeight: 600,
                      backgroundColor: statusColor[b.status]?.bg,
                      color: statusColor[b.status]?.color,
                    }}>
                      {b.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']) && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {b.status === 'CONFIRMED' && (
                          <button onClick={() => handleAction(b.id, 'checkin')}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              border: 'none', background: '#e8f8f2',
                              color: '#1D9E75', cursor: 'pointer',
                              fontSize: '11px', fontWeight: 600,
                            }}>
                            Check In
                          </button>
                        )}
                        {b.status === 'CHECKED_IN' && (
                          <button onClick={() => handleAction(b.id, 'checkout')}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              border: 'none', background: '#e8f0fb',
                              color: '#378ADD', cursor: 'pointer',
                              fontSize: '11px', fontWeight: 600,
                            }}>
                            Check Out
                          </button>
                        )}
                        {['CONFIRMED', 'PENDING'].includes(b.status) && (
                          <button onClick={() => handleAction(b.id, 'cancel')}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              border: 'none', background: '#fee8e8',
                              color: '#E24B4A', cursor: 'pointer',
                              fontSize: '11px', fontWeight: 600,
                            }}>
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