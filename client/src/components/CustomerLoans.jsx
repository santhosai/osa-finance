import { useState, useMemo } from 'react';
import useSWR from 'swr';
import AddLoanModal from './AddLoanModal';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function CustomerLoans({ navigateTo, customerId }) {
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);

  // Use SWR for automatic caching and re-fetching
  const { data: allCustomers = [], error, isLoading, mutate } = useSWR(`${API_URL}/customers`, fetcher, {
    refreshInterval: 0, // Don't auto-refresh (save bandwidth)
    revalidateOnFocus: true, // Refresh when user returns to tab
    dedupingInterval: 2000, // Prevent duplicate requests within 2s
  });

  // Find the specific customer from the list
  const customer = useMemo(() => {
    return allCustomers.find(c => c.id === customerId);
  }, [allCustomers, customerId]);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const handleLoanClick = (loanId) => {
    navigateTo('loan-details', loanId);
  };

  if (isLoading) {
    return (
      <div>
        <div className="navbar">
          <svg
            className="nav-icon"
            fill="white"
            viewBox="0 0 24 24"
            onClick={() => navigateTo('customers')}
            title="Back to Customers"
          >
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <h2>Customer Loans</h2>
          <div style={{ width: '40px' }}></div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div>
        <div className="navbar">
          <svg
            className="nav-icon"
            fill="white"
            viewBox="0 0 24 24"
            onClick={() => navigateTo('customers')}
            title="Back to Customers"
          >
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <h2>Customer Not Found</h2>
          <div style={{ width: '40px' }}></div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'white',
          margin: '16px',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
            Customer not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="navbar">
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('customers')}
          title="Back to Customers"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2>{customer.name}</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Customer Info Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        margin: '16px',
        padding: '24px',
        borderRadius: '12px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          {customer.name}
        </div>
        <div style={{ fontSize: '16px', marginBottom: '16px', opacity: 0.9 }}>
          📱 {customer.phone}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginTop: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Active Loans</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{customer.total_active_loans}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Total Balance</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(customer.total_balance)}</div>
          </div>
        </div>
      </div>

      {/* Add Another Loan Button */}
      <button
        onClick={() => setShowAddLoanModal(true)}
        style={{
          width: 'calc(100% - 32px)',
          margin: '0 16px 16px 16px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          border: 'none',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          transition: 'all 0.2s'
        }}
      >
        + Add Another Loan
      </button>

      {/* Loans List */}
      <div style={{ padding: '0 16px 80px 16px' }}>
        {customer.loans && customer.loans.length > 0 ? (
          customer.loans.map((loan, index) => {
            const loanType = loan.loan_type || 'Weekly';
            const progress = ((loan.loan_amount - loan.balance) / loan.loan_amount) * 100;
            const paymentAmount = loanType === 'Weekly' ? loan.weekly_amount : loan.monthly_amount;
            const periodsPaid = Math.floor((loan.loan_amount - loan.balance) / paymentAmount);
            const totalPeriods = Math.ceil(loan.loan_amount / paymentAmount);

            return (
              <div
                key={loan.loan_id}
                onClick={() => handleLoanClick(loan.loan_id)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '2px solid transparent'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '16px',
                      color: '#3b82f6',
                      marginBottom: '4px',
                      fontWeight: 600
                    }}>
                      {loan.loan_name || `Loan #${index + 1}`}
                    </div>
                    <div style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#1f2937'
                    }}>
                      {formatCurrency(loan.loan_amount)}
                    </div>
                  </div>
                  <div style={{
                    background: loan.balance === 0 ? '#d1fae5' : '#dbeafe',
                    color: loan.balance === 0 ? '#065f46' : '#1e40af',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {loan.balance === 0 ? 'Paid Off' : 'Active'}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Balance
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626' }}>
                      {formatCurrency(loan.balance)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      {loanType === 'Weekly' ? 'Weekly' : 'Monthly'}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#059669' }}>
                      {formatCurrency(paymentAmount)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '6px'
                  }}>
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div style={{
                    height: '8px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                      transition: 'width 0.3s'
                    }}></div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  <div>
                    <div>Start Date</div>
                    <div style={{ color: '#1f2937', fontWeight: 600 }}>
                      {formatDate(loan.start_date)}
                    </div>
                  </div>
                  <div>
                    <div>Last Payment</div>
                    <div style={{ color: '#1f2937', fontWeight: 600 }}>
                      {formatDate(loan.last_payment_date)}
                    </div>
                  </div>
                  <div>
                    <div>{loanType === 'Weekly' ? 'Weeks' : 'Months'}</div>
                    <div style={{ color: '#1f2937', fontWeight: 600 }}>
                      {periodsPaid}/{totalPeriods}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: 'white',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
              No active loans
            </div>
          </div>
        )}
      </div>

      {showAddLoanModal && (
        <AddLoanModal
          customerId={customer.id}
          customerName={customer.name}
          customerPhone={customer.phone}
          onClose={() => setShowAddLoanModal(false)}
          onSuccess={() => {
            setShowAddLoanModal(false);
            mutate(); // SWR: Re-fetch data automatically
          }}
        />
      )}
    </div>
  );
}

export default CustomerLoans;
