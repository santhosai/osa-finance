import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AdminCollections({ navigateTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const userRole = localStorage.getItem('userRole');

  const fetchAllCollections = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/admin/all-collections?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to fetch collections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const response = await fetch(
        `${API_URL}/user-collections/${userId}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const result = await response.json();
      setUserDetails(result);
    } catch (err) {
      console.error('Error fetching user details:', err);
    }
  };

  useEffect(() => {
    fetchAllCollections();
  }, [dateRange]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserDetails(selectedUser.user_id);
    }
  }, [selectedUser, dateRange]);

  const handleConfirmTransfer = async (transferId) => {
    try {
      const response = await fetch(`${API_URL}/user-transfers/${transferId}/confirm`, {
        method: 'PUT'
      });

      if (response.ok) {
        fetchUserDetails(selectedUser.user_id);
        fetchAllCollections();
      } else {
        alert('Failed to confirm transfer');
      }
    } catch (err) {
      alert('Error confirming transfer');
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

  if (userRole !== 'admin') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Admin access required</p>
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
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>User Collections</h1>
        </div>
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
      ) : data && (
        <>
          {/* Grand Total Summary */}
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '14px', opacity: 0.8, marginBottom: '12px' }}>OVERALL SUMMARY</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Total Collected</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(data.grandTotal?.totalCollected)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Total Transferred</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(data.grandTotal?.totalTransferred)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Balance with Users</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: data.grandTotal?.totalBalanceInHand > 0 ? '#fbbf24' : '#10b981' }}>
                  {formatCurrency(data.grandTotal?.totalBalanceInHand)}
                </div>
              </div>
            </div>
          </div>

          {/* Users List */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              Users ({data.users?.length || 0})
            </h3>
            {data.users?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.users.map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUser(user)}
                    style={{
                      background: selectedUser?.user_id === user.user_id ? '#3b82f6' : '#334155',
                      padding: '16px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>{user.user_name}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{user.user_phone}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: user.balanceInHand > 0 ? '#fbbf24' : '#10b981'
                        }}>
                          {formatCurrency(user.balanceInHand)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Balance</div>
                      </div>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      marginTop: '12px',
                      fontSize: '12px'
                    }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ color: '#94a3b8' }}>Collected</div>
                        <div style={{ fontWeight: 600 }}>{formatCurrency(user.totalCollected)}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ color: '#94a3b8' }}>Transferred</div>
                        <div style={{ fontWeight: 600 }}>{formatCurrency(user.totalTransferred)}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ color: '#94a3b8' }}>Payments</div>
                        <div style={{ fontWeight: 600 }}>{user.paymentsCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
                No user collections found for this period
              </p>
            )}
          </div>
        </>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          overflowY: 'auto',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              position: 'sticky',
              top: 0,
              background: '#0f172a',
              padding: '16px 0',
              zIndex: 10
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                {selectedUser.user_name}'s Collections
              </h2>
              <button
                onClick={() => { setSelectedUser(null); setUserDetails(null); }}
                style={{
                  background: '#475569',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            {userDetails ? (
              <>
                {/* User Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: '#3b82f6', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Collected</div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
                      {formatCurrency(userDetails.summary?.totalCollected)}
                    </div>
                  </div>
                  <div style={{ background: '#10b981', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Transferred</div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
                      {formatCurrency(userDetails.summary?.totalTransferred)}
                    </div>
                  </div>
                  <div style={{
                    background: userDetails.summary?.balanceInHand > 0 ? '#f59e0b' : '#6b7280',
                    padding: '16px',
                    borderRadius: '12px',
                    gridColumn: 'span 2'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Balance in Hand</div>
                    <div style={{ fontSize: '26px', fontWeight: 'bold' }}>
                      {formatCurrency(userDetails.summary?.balanceInHand)}
                    </div>
                  </div>
                </div>

                {/* Transfers - Admin can confirm */}
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                    Transfers ({userDetails.transfers?.length || 0})
                  </h3>
                  {userDetails.transfers?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {userDetails.transfers.map((transfer) => (
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
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{transfer.notes}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {transfer.status === 'confirmed' ? (
                              <span style={{
                                fontSize: '11px',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                background: '#065f46',
                                color: 'white'
                              }}>
                                ✓ Confirmed
                              </span>
                            ) : (
                              <button
                                onClick={() => handleConfirmTransfer(transfer.id)}
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  border: 'none',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Confirm
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>No transfers</p>
                  )}
                </div>

                {/* Payments collected */}
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                    Payments Collected ({userDetails.payments?.length || 0})
                  </h3>
                  {userDetails.payments?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                      {userDetails.payments.map((payment) => (
                        <div
                          key={payment.id}
                          style={{
                            background: '#334155',
                            padding: '10px',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{payment.customer_name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {payment.payment_date} • {payment.payment_mode}
                            </div>
                          </div>
                          <div style={{ fontWeight: 600, color: '#3b82f6', fontSize: '14px' }}>
                            {formatCurrency(payment.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>No payments collected</p>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading details...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCollections;
