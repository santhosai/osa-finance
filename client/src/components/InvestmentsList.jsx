import { useState } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

const InvestmentsList = ({ navigateTo }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, returned
  const [formData, setFormData] = useState({
    investorName: '',
    phone: '',
    investmentAmount: '',
    investmentDate: new Date().toISOString().split('T')[0],
    returnAmount: '',
    expectedReturnDate: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch investments with SWR
  const { data: investments = [], error: fetchError, isLoading, mutate } = useSWR(
    `${API_URL}/investments`,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Calculate statistics
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.investmentAmount, 0);
  const pendingInvestments = investments.filter(inv => inv.status === 'pending');
  const returnedInvestments = investments.filter(inv => inv.status === 'returned');
  const totalPending = pendingInvestments.reduce((sum, inv) => sum + inv.returnAmount, 0);
  const totalReturned = returnedInvestments.reduce((sum, inv) => sum + inv.returnAmount, 0);

  // Filter investments
  const filteredInvestments = investments.filter(inv => {
    if (filter === 'pending') return inv.status === 'pending';
    if (filter === 'returned') return inv.status === 'returned';
    return true;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Select contact from phone's contact list
  const selectFromContacts = async () => {
    if (!('contacts' in navigator)) {
      alert('Contact picker is not supported on this device/browser. Please use Chrome on Android for best experience.');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        let phone = '';
        if (contact.tel && contact.tel.length > 0) {
          phone = contact.tel[0].replace(/\D/g, '');
          if (phone.length > 10) {
            phone = phone.slice(-10);
          }
        }

        setFormData(prev => ({
          ...prev,
          investorName: contact.name && contact.name[0] ? contact.name[0] : prev.investorName,
          phone: phone
        }));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting contact:', error);
        alert('Failed to select contact: ' + error.message);
      }
    }
  };

  // Add new investment
  const handleAddInvestment = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.investorName || !formData.investmentAmount || !formData.returnAmount ||
        !formData.investmentDate || !formData.expectedReturnDate) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add investment');
      }

      // Reset form
      setFormData({
        investorName: '',
        phone: '',
        investmentAmount: '',
        investmentDate: new Date().toISOString().split('T')[0],
        returnAmount: '',
        expectedReturnDate: '',
        notes: ''
      });
      setShowAddForm(false);
      mutate(); // Refresh data
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark investment as returned
  const handleMarkAsReturned = async (investmentId) => {
    if (!confirm('Mark this investment as returned?')) return;

    try {
      const response = await fetch(`${API_URL}/investments/${investmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'returned' })
      });

      if (!response.ok) throw new Error('Failed to update investment');
      mutate(); // Refresh data
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Delete investment
  const handleDelete = async (investmentId) => {
    if (!confirm('Are you sure you want to delete this investment record?')) return;

    try {
      const response = await fetch(`${API_URL}/investments/${investmentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete investment');
      mutate(); // Refresh data
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
        <div className="navbar">
          <svg className="nav-icon" fill="white" viewBox="0 0 24 24" onClick={() => navigateTo('dashboard')}>
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>💰 Investments</h2>
          <div style={{ width: '40px' }}></div>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
      <div className="navbar">
        <svg className="nav-icon" fill="white" viewBox="0 0 24 24" onClick={() => navigateTo('dashboard')}>
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>💰 Investments</h2>
        <svg className="nav-icon" fill="white" viewBox="0 0 24 24" onClick={() => mutate()}>
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
        </svg>
      </div>

      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Total Invested</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(totalInvestments)}</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{investments.length} records</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Pending Return</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(totalPending)}</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{pendingInvestments.length} pending</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Returned</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(totalReturned)}</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>{returnedInvestments.length} completed</div>
          </div>
        </div>

        {/* Filter Tabs & Add Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'pending', 'returned'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? 'white' : 'rgba(255, 255, 255, 0.3)',
                  color: filter === f ? '#d97706' : 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}
              >
                {f === 'all' ? `All (${investments.length})` :
                 f === 'pending' ? `Pending (${pendingInvestments.length})` :
                 `Returned (${returnedInvestments.length})`}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: 'white',
              color: '#d97706',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            + Add Investment
          </button>
        </div>

        {/* Investments List */}
        {filteredInvestments.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '60px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
              No {filter === 'all' ? '' : filter} investments
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Click "Add Investment" to record a new investment
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredInvestments.map(investment => (
              <div
                key={investment.id}
                style={{
                  background: investment.status === 'returned'
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: investment.status === 'returned' ? '2px solid #10b981' : '2px solid #dc2626'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '18px',
                      color: investment.status === 'returned' ? '#065f46' : '#7f1d1d',
                      marginBottom: '4px'
                    }}>
                      {investment.investorName}
                    </div>
                    {investment.phone && (
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                        📱 <a href={`tel:${investment.phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                          {investment.phone}
                        </a>
                      </div>
                    )}
                  </div>
                  <div style={{
                    background: investment.status === 'returned' ? '#10b981' : '#dc2626',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {investment.status === 'returned' ? '✓ Returned' : '⏳ Pending'}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  marginBottom: '12px',
                  fontSize: '13px'
                }}>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>Investment</div>
                    <div style={{ fontWeight: 700, color: '#1f2937' }}>{formatCurrency(investment.investmentAmount)}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>{formatDate(investment.investmentDate)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>Return Amount</div>
                    <div style={{ fontWeight: 700, color: '#1f2937' }}>{formatCurrency(investment.returnAmount)}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {investment.status === 'returned' && investment.returnedDate
                        ? `Returned: ${formatDate(investment.returnedDate)}`
                        : `Due: ${formatDate(investment.expectedReturnDate)}`}
                    </div>
                  </div>
                </div>

                {investment.notes && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#4b5563',
                    marginBottom: '12px'
                  }}>
                    📝 {investment.notes}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  {investment.status === 'pending' && (
                    <button
                      onClick={() => handleMarkAsReturned(investment.id)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      ✓ Mark as Returned
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(investment.id)}
                    style={{
                      flex: investment.status === 'pending' ? 'none' : 1,
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Investment Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
                Add New Investment
              </h2>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            {error && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleAddInvestment}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Investor Name *
                </label>
                <input
                  type="text"
                  name="investorName"
                  value={formData.investorName}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Phone Number (Optional)
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    pattern="[0-9]{10}"
                    maxLength="10"
                    disabled={loading}
                    placeholder="10-digit number"
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={selectFromContacts}
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      opacity: loading ? 0.6 : 1
                    }}
                    title="Select from Contacts"
                  >
                    👤 Contacts
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Investment Amount (₹) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    name="investmentAmount"
                    value={formData.investmentAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      handleInputChange({ target: { name: 'investmentAmount', value } });
                    }}
                    autoComplete="off"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Return Amount (₹) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    name="returnAmount"
                    value={formData.returnAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      handleInputChange({ target: { name: 'returnAmount', value } });
                    }}
                    autoComplete="off"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Investment Date *
                  </label>
                  <input
                    type="date"
                    name="investmentDate"
                    value={formData.investmentDate}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Expected Return Date *
                  </label>
                  <input
                    type="date"
                    name="expectedReturnDate"
                    value={formData.expectedReturnDate}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  disabled={loading}
                  rows="3"
                  placeholder="Any special terms or notes..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setError('');
                  }}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    background: loading ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Adding...' : 'Add Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentsList;
