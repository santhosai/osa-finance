import { useState, useMemo } from 'react';
import useSWR from 'swr';
import AddLoanModal from './AddLoanModal';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function MonthlyFinanceView({ navigateTo }) {
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);

  // Fetch all customers with loans
  const { data: allCustomers = [], error, isLoading, mutate } = useSWR(
    `${API_URL}/customers`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Filter only Monthly Finance loans
  const monthlyLoans = useMemo(() => {
    const loans = [];
    allCustomers.forEach(customer => {
      if (customer.loans && customer.loans.length > 0) {
        customer.loans.forEach(loan => {
          if (loan.loan_type === 'Monthly' && loan.status === 'active') {
            loans.push({
              ...loan,
              customer_name: customer.name,
              customer_phone: customer.phone,
              customer_id: customer.id
            });
          }
        });
      }
    });
    return loans.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  }, [allCustomers]);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const handleLoanClick = (loan) => {
    navigateTo('loan-details', loan.loan_id);
  };

  const handleRefresh = () => {
    mutate();
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="navbar" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <svg
            className="nav-icon"
            fill="white"
            viewBox="0 0 24 24"
            onClick={() => navigateTo('dashboard')}
            title="Back to Dashboard"
          >
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Monthly Finance</h2>
          <div style={{ width: '40px' }}></div>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Detail view for selected loan
  if (selectedLoan) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="navbar" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <svg
            className="nav-icon"
            fill="white"
            viewBox="0 0 24 24"
            onClick={() => setSelectedLoan(null)}
            title="Back to List"
          >
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>
            {selectedLoan.customer_name}
          </h2>
          <div style={{ width: '40px' }}></div>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Amount</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedLoan.loan_amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Monthly Payment</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedLoan.monthly_amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Balance</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(selectedLoan.balance)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Friend Name</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {selectedLoan.loan_name !== 'General Loan' ? selectedLoan.loan_name : '-'}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleLoanClick(selectedLoan)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              View Full Details & Payments →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="navbar" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('dashboard')}
          title="Back to Dashboard"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Monthly Finance</h2>
        <button
          onClick={handleRefresh}
          style={{
            background: '#047857',
            color: 'white',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          🔄
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
              💰 Monthly Finance ({monthlyLoans.length})
            </h3>
            <button
              onClick={() => setShowAddLoanModal(true)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              + Add Monthly Loan
            </button>
          </div>

          {monthlyLoans.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                No Monthly Finance loans yet
              </div>
              <div style={{ fontSize: '14px' }}>
                Click "+ Add Monthly Loan" to create your first one
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {monthlyLoans.map(loan => {
                const progress = ((loan.loan_amount - loan.balance) / loan.loan_amount) * 100;
                const monthsPaid = Math.floor((loan.loan_amount - loan.balance) / loan.monthly_amount);
                const totalMonths = Math.ceil(loan.loan_amount / loan.monthly_amount);

                return (
                  <div
                    key={loan.loan_id}
                    onClick={() => setSelectedLoan(loan)}
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                      borderRadius: '8px',
                      borderLeft: '4px solid #667eea',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(5px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      marginBottom: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b', marginBottom: '8px' }}>
                          {loan.customer_name}
                        </div>
                        {loan.loan_name && loan.loan_name !== 'General Loan' && (
                          <div style={{ fontSize: '14px', color: '#667eea', fontWeight: 600, marginBottom: '4px' }}>
                            Friend: {loan.loan_name}
                          </div>
                        )}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '8px',
                          fontSize: '13px',
                          color: '#64748b'
                        }}>
                          <div>
                            <strong>Amount:</strong> {formatCurrency(loan.loan_amount)}
                          </div>
                          <div>
                            <strong>Monthly:</strong> {formatCurrency(loan.monthly_amount)}
                          </div>
                          <div>
                            <strong>Balance:</strong> {formatCurrency(loan.balance)}
                          </div>
                          <div>
                            <strong>Started:</strong> {formatDate(loan.start_date)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#64748b',
                        marginBottom: '4px'
                      }}>
                        <span>Progress: {monthsPaid}/{totalMonths} months</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddLoanModal && (
        <AddLoanModal
          onClose={() => setShowAddLoanModal(false)}
          onSuccess={() => {
            setShowAddLoanModal(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}

export default MonthlyFinanceView;
