// src/pages/Billing.jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import '../styles/Billing.css';
import { RefreshCw } from 'lucide-react';

export default function Billing() {
  const [billings, setBillings] = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('ALL');

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
    } catch { toast.error('Failed to load billing'); }
    finally { setLoading(false); }
  };

  const handlePay = async (id) => {
    const method = prompt('Payment method (cash/card/upi):');
    if (!method) return;
    try {
      await api.patch(`/billing/${id}/pay`, { paymentMethod: method });
      toast.success('Payment processed!');
      loadAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDiscount = async (id) => {
    const discount = prompt('Enter discount amount (₹):');
    if (!discount) return;
    try {
      await api.patch(`/billing/${id}/discount`, { discount: Number(discount) });
      toast.success('Discount applied!');
      loadAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const filtered = filter === 'ALL' ? billings : billings.filter(b => b.paymentStatus === filter);

  const statusBadgeClass = {
    UNPAID:   'badge badge-unpaid',
    PAID:     'badge badge-paid',
    REFUNDED: 'badge badge-refunded',
  };

  return (
    <div className="billing-page">
      <div className="page-header">
        <div>
          <h1>Billing</h1>
          <p>Invoice and payment management</p>
        </div>
        <button className="btn btn-outline" onClick={loadAll}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="billing-summary-grid">
          {[
            { label:'Total Revenue',  value:`₹${summary.totalRevenue?.toLocaleString()}`,   cls:'revenue' },
            { label:'Pending',        value:`₹${summary.pendingRevenue?.toLocaleString()}`,  cls:'pending' },
            { label:'Refunded',       value:`₹${summary.totalRefunded?.toLocaleString()}`,   cls:'refunded' },
            { label:'Total Invoices', value:summary.totalBookings,                           cls:'total' },
          ].map(s => (
            <div key={s.label} className={`billing-summary-card ${s.cls}`}>
              <p>{s.label}</p>
              <h3>{s.value}</h3>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="filter-tabs">
        {['ALL','UNPAID','PAID','REFUNDED'].map(s => (
          <button key={s} className={`filter-tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <p className="table-loading">Loading billing...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Booking','Guest','Room','Amount','Tax','Discount','Total','Status','Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="booking-ref">#{b.bookingId}</td>
                  <td><strong>{b.booking?.guest?.name}</strong></td>
                  <td>Room {b.booking?.room?.roomNumber}</td>
                  <td>₹{Number(b.amount).toLocaleString()}</td>
                  <td style={{ color:'var(--text-muted)' }}>₹{Number(b.tax).toLocaleString()}</td>
                  <td className="billing-discount">
                    {Number(b.discount) > 0 ? `-₹${Number(b.discount).toLocaleString()}` : '—'}
                  </td>
                  <td className="billing-total">₹{Number(b.totalAmount).toLocaleString()}</td>
                  <td><span className={statusBadgeClass[b.paymentStatus]}>{b.paymentStatus}</span></td>
                  <td>
                    <div className="billing-action-group">
                      {b.paymentStatus === 'UNPAID' && (
                        <>
                          <button className="billing-pay-btn" onClick={() => handlePay(b.id)}>Pay</button>
                          <button className="billing-discount-btn" onClick={() => handleDiscount(b.id)}>Discount</button>
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