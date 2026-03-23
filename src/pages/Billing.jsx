// src/pages/Billing.jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

export default function Billing() {
  const [billings, setBillings]   = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('ALL');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [billRes, sumRes] = await Promise.all([
        api.get('/billing'),
        api.get('/billing/summary'),
      ]);
      setBillings(billRes.data.billings || []);
      setSummary(sumRes.data);
    } catch (err) {
      toast.error('Failed to load billing');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (id) => {
    const method = prompt('Payment method (cash/card/upi):');
    if (!method) return;
    try {
      await api.patch(`/billing/${id}/pay`, { paymentMethod: method });
      toast.success('Payment processed!');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  const handleDiscount = async (id) => {
    const discount = prompt('Enter discount amount (₹):');
    if (!discount) return;
    try {
      await api.patch(`/billing/${id}/discount`, { discount: Number(discount) });
      toast.success('Discount applied!');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply discount');
    }
  };

  const filtered = filter === 'ALL'
    ? billings
    : billings.filter(b => b.paymentStatus === filter);

  const statusColor = {
    UNPAID:   { bg: '#fff8e8', color: '#EF9F27' },
    PAID:     { bg: '#e8f8f2', color: '#1D9E75' },
    REFUNDED: { bg: '#fee8e8', color: '#E24B4A' },
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
            Billing
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
            Invoice and payment management
          </p>
        </div>
        <button onClick={loadAll} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '9px 16px', borderRadius: '8px',
          border: '1px solid #ddd', background: '#fff',
          cursor: 'pointer', fontSize: '14px',
        }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px', marginBottom: '28px',
        }}>
          {[
            { label: 'Total Revenue', value: `₹${summary.totalRevenue?.toLocaleString()}`, color: '#1D9E75' },
            { label: 'Pending', value: `₹${summary.pendingRevenue?.toLocaleString()}`, color: '#EF9F27' },
            { label: 'Refunded', value: `₹${summary.totalRefunded?.toLocaleString()}`, color: '#E24B4A' },
            { label: 'Total Invoices', value: summary.totalBookings, color: '#7F77DD' },
          ].map(s => (
            <div key={s.label} style={{
              backgroundColor: '#fff', borderRadius: '12px',
              padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${s.color}`,
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#888' }}>
                {s.label}
              </p>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: s.color }}>
                {s.value}
              </h3>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['ALL', 'UNPAID', 'PAID', 'REFUNDED'].map(s => (
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

      {/* Billing Table */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        {loading ? (
          <p style={{ padding: '24px', color: '#888' }}>Loading billing...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                {['Booking', 'Guest', 'Room', 'Amount', 'Tax', 'Discount', 'Total', 'Status', 'Actions'].map(h => (
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
              {filtered.map((b, i) => (
                <tr key={b.id} style={{
                  borderTop: '1px solid #f0f0f0',
                  backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                }}>
                  <td style={{
                    padding: '12px 16px',
                    fontSize: '12px', color: '#888', fontFamily: 'monospace',
                  }}>
                    #{b.bookingId}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    {b.booking?.guest?.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#555' }}>
                    Room {b.booking?.room?.roomNumber}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    ₹{Number(b.amount).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#888' }}>
                    ₹{Number(b.tax).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#1D9E75' }}>
                    {Number(b.discount) > 0 ? `-₹${Number(b.discount).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                    ₹{Number(b.totalAmount).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px',
                      fontSize: '11px', fontWeight: 600,
                      backgroundColor: statusColor[b.paymentStatus]?.bg,
                      color: statusColor[b.paymentStatus]?.color,
                    }}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {b.paymentStatus === 'UNPAID' && (
                        <>
                          <button onClick={() => handlePay(b.id)} style={{
                            padding: '4px 10px', borderRadius: '6px',
                            border: 'none', background: '#e8f8f2',
                            color: '#1D9E75', cursor: 'pointer',
                            fontSize: '11px', fontWeight: 600,
                          }}>
                            Pay
                          </button>
                          <button onClick={() => handleDiscount(b.id)} style={{
                            padding: '4px 10px', borderRadius: '6px',
                            border: 'none', background: '#e8f0fb',
                            color: '#378ADD', cursor: 'pointer',
                            fontSize: '11px', fontWeight: 600,
                          }}>
                            Discount
                          </button>
                        </>
                      )}
                    </div>
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