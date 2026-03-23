// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  BedDouble,
  CalendarCheck,
  Receipt,
  Users,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

// Reusable stat card component
function StatCard({ title, value, icon: Icon, color, subtitle }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        backgroundColor: color + '20',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <p style={{
          margin: '0 0 4px',
          fontSize: '13px',
          color: '#888',
          fontWeight: 500,
        }}>
          {title}
        </p>
        <h3 style={{
          margin: '0 0 4px',
          fontSize: '26px',
          fontWeight: 700,
          color: '#1a1a2e',
        }}>
          {value}
        </h3>
        {subtitle && (
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const [stats, setStats]   = useState(null);
  const [rooms, setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load rooms — available to all roles
      const roomsRes = await api.get('/rooms');
      setRooms(roomsRes.data.rooms || []);

      // Load billing summary — only for Admin and above
      if (hasRole(['SUPER_ADMIN', 'ADMIN'])) {
        const billingRes = await api.get('/billing/summary');
        setStats(billingRes.data);
      }

    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        fontSize: '16px',
        color: '#888',
      }}>
        Loading dashboard...
      </div>
    );
  }

  // Room stats
  const availableRooms  = rooms.filter(r => r.status === 'AVAILABLE').length;
  const occupiedRooms   = rooms.filter(r => r.status === 'OCCUPIED').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE').length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          margin: '0 0 6px',
          fontSize: '24px',
          fontWeight: 700,
          color: '#1a1a2e',
        }}>
          Welcome back, {user?.name} 👋
        </h1>
        <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Room Stats — visible to all */}
      <h2 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: '#444',
        marginBottom: '16px',
      }}>
        Room Overview
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <StatCard
          title="Total Rooms"
          value={rooms.length}
          icon={BedDouble}
          color="#7F77DD"
          subtitle="All active rooms"
        />
        <StatCard
          title="Available"
          value={availableRooms}
          icon={BedDouble}
          color="#1D9E75"
          subtitle="Ready for booking"
        />
        <StatCard
          title="Occupied"
          value={occupiedRooms}
          icon={CalendarCheck}
          color="#378ADD"
          subtitle="Currently checked in"
        />
        <StatCard
          title="Maintenance"
          value={maintenanceRooms}
          icon={AlertCircle}
          color="#EF9F27"
          subtitle="Under maintenance"
        />
      </div>

      {/* Billing Stats — only for Admin and Super Admin */}
      {hasRole(['SUPER_ADMIN', 'ADMIN']) && stats && (
        <>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#444',
            marginBottom: '16px',
          }}>
            Revenue Overview
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}>
            <StatCard
              title="Total Revenue"
              value={`₹${stats.totalRevenue?.toLocaleString()}`}
              icon={TrendingUp}
              color="#1D9E75"
              subtitle="All paid invoices"
            />
            <StatCard
              title="Pending Revenue"
              value={`₹${stats.pendingRevenue?.toLocaleString()}`}
              icon={Receipt}
              color="#EF9F27"
              subtitle="Unpaid invoices"
            />
            <StatCard
              title="Total Bookings"
              value={stats.totalBookings}
              icon={CalendarCheck}
              color="#7F77DD"
              subtitle={`${stats.paidCount} paid · ${stats.unpaidCount} unpaid`}
            />
            <StatCard
              title="Refunded"
              value={`₹${stats.totalRefunded?.toLocaleString()}`}
              icon={Receipt}
              color="#E24B4A"
              subtitle={`${stats.refundedCount} refunds`}
            />
          </div>
        </>
      )}

      {/* Room status table */}
      <h2 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: '#444',
        marginBottom: '16px',
      }}>
        Room Status
      </h2>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              {['Room', 'Type', 'Floor', 'Price', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#555',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.slice(0, 8).map((room, i) => (
              <tr key={room.id} style={{
                borderTop: '1px solid #f0f0f0',
                backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
              }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  {room.roomNumber}
                </td>
                <td style={{ padding: '12px 16px', color: '#555' }}>
                  {room.type}
                </td>
                <td style={{ padding: '12px 16px', color: '#555' }}>
                  Floor {room.floor}
                </td>
                <td style={{ padding: '12px 16px', color: '#555' }}>
                  ₹{Number(room.price).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor:
                      room.status === 'AVAILABLE'   ? '#e8f8f2' :
                      room.status === 'OCCUPIED'    ? '#e8f0fb' :
                      '#fff8e8',
                    color:
                      room.status === 'AVAILABLE'   ? '#1D9E75' :
                      room.status === 'OCCUPIED'    ? '#378ADD' :
                      '#EF9F27',
                  }}>
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