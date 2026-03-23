// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import '../styles/Dashboard.css';
import { BedDouble, CalendarCheck, Receipt, TrendingUp, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const [stats, setStats]     = useState(null);
  const [rooms, setRooms]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const roomsRes = await api.get('/rooms');
      setRooms(roomsRes.data.rooms || []);
      if (hasRole(['SUPER_ADMIN', 'ADMIN'])) {
        const billingRes = await api.get('/billing/summary');
        setStats(billingRes.data);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-center">Loading dashboard...</div>;

  const available    = rooms.filter(r => r.status === 'AVAILABLE').length;
  const occupied     = rooms.filter(r => r.status === 'OCCUPIED').length;
  const maintenance  = rooms.filter(r => r.status === 'MAINTENANCE').length;

  const roomStats = [
    { title: 'Total Rooms', value: rooms.length, icon: BedDouble, color: '#7F77DD', subtitle: 'All active rooms' },
    { title: 'Available',   value: available,    icon: BedDouble, color: '#1D9E75', subtitle: 'Ready for booking' },
    { title: 'Occupied',    value: occupied,     icon: CalendarCheck, color: '#378ADD', subtitle: 'Currently checked in' },
    { title: 'Maintenance', value: maintenance,  icon: AlertCircle,   color: '#EF9F27', subtitle: 'Under maintenance' },
  ];

  const revenueStats = stats ? [
    { title: 'Total Revenue', value: `₹${stats.totalRevenue?.toLocaleString()}`, icon: TrendingUp,   color: '#1D9E75', subtitle: 'All paid invoices' },
    { title: 'Pending',       value: `₹${stats.pendingRevenue?.toLocaleString()}`, icon: Receipt,    color: '#EF9F27', subtitle: 'Unpaid invoices' },
    { title: 'Bookings',      value: stats.totalBookings, icon: CalendarCheck,                       color: '#7F77DD', subtitle: `${stats.paidCount} paid · ${stats.unpaidCount} unpaid` },
    { title: 'Refunded',      value: `₹${stats.totalRefunded?.toLocaleString()}`, icon: Receipt,     color: '#E24B4A', subtitle: `${stats.refundedCount} refunds` },
  ] : [];

  const statusBadgeClass = {
    AVAILABLE:   'badge badge-available',
    OCCUPIED:    'badge badge-occupied',
    MAINTENANCE: 'badge badge-maintenance',
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h1>Welcome back, {user?.name} 👋</h1>
        <p>{new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      <h2 className="dashboard-section-title">Room overview</h2>
      <div className="stat-grid">
        {roomStats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="dashboard-stat-card">
              <div className="dashboard-stat-icon" style={{ backgroundColor: s.color + '20' }}>
                <Icon size={22} color={s.color} />
              </div>
              <div className="dashboard-stat-info">
                <p>{s.title}</p>
                <h3>{s.value}</h3>
                <span>{s.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>

      {hasRole(['SUPER_ADMIN', 'ADMIN']) && stats && (
        <>
          <h2 className="dashboard-section-title">Revenue overview</h2>
          <div className="stat-grid">
            {revenueStats.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="dashboard-stat-card">
                  <div className="dashboard-stat-icon" style={{ backgroundColor: s.color + '20' }}>
                    <Icon size={22} color={s.color} />
                  </div>
                  <div className="dashboard-stat-info">
                    <p>{s.title}</p>
                    <h3>{s.value}</h3>
                    <span>{s.subtitle}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="dashboard-section-title">Room status</h2>
      <div className="dashboard-table-card">
        <table className="data-table">
          <thead>
            <tr>
              {['Room', 'Type', 'Floor', 'Price', 'Status'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.slice(0, 8).map(room => (
              <tr key={room.id}>
                <td><strong>{room.roomNumber}</strong></td>
                <td>{room.type}</td>
                <td>Floor {room.floor}</td>
                <td>₹{Number(room.price).toLocaleString()}</td>
                <td>
                  <span className={statusBadgeClass[room.status] || 'badge'}>
                    <span className={`status-dot ${room.status?.toLowerCase()}`} />
                    {room.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}