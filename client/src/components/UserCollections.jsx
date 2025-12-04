import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function UserCollections({ navigateTo }) {
  const [collections, setCollections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMode, setTransferMode] = useState('bank');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    endDate: new Date().toISOString().split('T')[0] // Today
  });

  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/user-collections/${userId}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const data = await response.json();
      setCollections(data);
    } catch (err) {
      setError('Failed to fetch collections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchCollections();
    }
  }, [userId, dateRange]);

  const handleRecordTransfer = async (e) => {
    e.preventDefault();
    if (!transferAmount || Number(transferAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/user-transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          amount: Number(transferAmount),
          transfer_date: transferDate,
          transfer_mode: transferMode,
          notes: transferNotes
        })
      });

      if (response.ok) {
        alert('Transfer recorded successfully!');
        setShowTransferModal(false);
        setTransferAmount('');
        setTransferNotes('');
        fetchCollections();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to record transfer');
      }
    } catch (err) {
      alert('Error recording transfer');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransfer = async (transferId) => {
    if (!confirm('Are you sure you want to delete this transfer?')) return;

    try {
      const response = await fetch(`${API_URL}/user-transfers/${transferId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCollections();
      } else {
        alert('Failed to delete transfer');
      }
    } catch (err) {
      alert('Error deleting transfer');
      console.error(err);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (!userId || userRole === 'admin') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>This page is for users only. Admin can view all collections from the Admin Collections page.</p>
        <button onClick={() => navigateTo('dashboard')} style={{ marginTop: '20px', padding: '10px 20px' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigateTo('dashboard')}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>My Collections</h1>
        </div>
        <button
          onClick={() => setShowTransferModal(true)}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + Record Transfer
        </button>
      </div>

      {/* Date Filter */}
      <div style={{
        background: '#1e293b',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '16px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>From</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            style={{
              display: 'block',
              padding: '8px',
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: 'white',
              marginTop: '4px'
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>To</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            style={{
              display: 'block',
              padding: '8px',
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: 'white',
              marginTop: '4px'
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>{error}</div>
      ) : collections && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Collected</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(collections.summary?.totalCollected)}</div>
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                Cash: {formatCurrency(collections.summary?.cashCollected)} | Online: {formatCurrency(collections.summary?.onlineCollected)}
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Transferred to Admin</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(collections.summary?.totalTransferred)}</div>
            </div>
            <div style={{
              background: collections.summary?.balanceInHand > 0
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              padding: '16px',
              borderRadius: '12px',
              gridColumn: 'span 2'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Balance in Hand</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(collections.summary?.balanceInHand)}</div>
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                This amount should be transferred to admin
              </div>
            </div>
          </div>

          {/* Transfers History */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Transfers to Admin ({collections.transfers?.length || 0})
            </h3>
            {collections.transfers?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {collections.transfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    style={{
                      background: '#334155',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(transfer.amount)}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {transfer.transfer_date} • {transfer.transfer_mode?.toUpperCase()}
                      </div>
                      {transfer.notes && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{transfer.notes}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: transfer.status === 'confirmed' ? '#065f46' : '#92400e',
                        color: 'white'
                      }}>
                        {transfer.status === 'confirmed' ? '✓ Confirmed' : 'Pending'}
                      </span>
                      {transfer.status !== 'confirmed' && (
                        <button
                          onClick={() => handleDeleteTransfer(transfer.id)}
                          style={{
                            background: '#dc2626',
                            border: 'none',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No transfers recorded yet</p>
            )}
          </div>

          {/* Collections/Payments */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              Collections ({collections.payments?.length || 0})
            </h3>
            {collections.payments?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {collections.payments.slice(0, 50).map((payment) => (
                  <div
                    key={payment.id}
                    style={{
                      background: '#334155',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{payment.customer_name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {payment.payment_date} • {payment.payment_mode?.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#3b82f6' }}>
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))}
                {collections.payments.length > 50 && (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '10px' }}>
                    Showing 50 of {collections.payments.length} payments
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No collections found for this period</p>
            )}
          </div>
        </>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
              Record Transfer to Admin
            </h2>
            <form onSubmit={handleRecordTransfer}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#94a3b8' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Enter amount"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#94a3b8' }}>
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#94a3b8' }}>
                  Transfer Mode
                </label>
                <select
                  value={transferMode}
                  onChange={(e) => setTransferMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px'
                  }}
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#94a3b8' }}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g., Reference number"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Record Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserCollections;
