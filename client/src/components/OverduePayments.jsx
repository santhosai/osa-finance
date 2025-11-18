import { useState, useEffect } from 'react';
import AddPaymentModal from './AddPaymentModal';
import { API_URL } from '../config';

function OverduePayments({ navigateTo }) {
  const [overdueCustomers, setOverdueCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    fetchOverdueCustomers();
  }, []);

  const fetchOverdueCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/customers`);
      const allCustomers = await response.json();

      // Filter customers with active loans
      const customersWithLoans = allCustomers.filter(c => c.loan_id && c.balance > 0);

      // Get overdue details for each customer
      const overduePromises = customersWithLoans.map(async (customer) => {
        try {
          const loanResponse = await fetch(`${API_URL}/loans/${customer.loan_id}`);
          const loanData = await loanResponse.json();

          // Calculate weeks since loan started
          const startDate = new Date(loanData.start_date);
          const today = new Date();
          const weeksSinceStart = Math.floor((today - startDate) / (7 * 24 * 60 * 60 * 1000));

          // Count how many payments should have been made (weeks that have passed)
          const expectedPayments = weeksSinceStart;

          // Count actual payments made
          const actualPayments = loanData.payments?.length || 0;

          // Calculate missed payments
          const missedPayments = Math.max(0, expectedPayments - actualPayments);

          // Only include if they have missed payments
          if (missedPayments > 0) {
            // Find the last Sunday they should have paid
            const lastExpectedSunday = new Date(today);
            const dayOfWeek = lastExpectedSunday.getDay();
            const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
            lastExpectedSunday.setDate(lastExpectedSunday.getDate() - daysToLastSunday);

            // Check if they paid on the last expected Sunday
            const lastSundayStr = lastExpectedSunday.toISOString().split('T')[0];
            const paidLastSunday = loanData.payments?.some(
              payment => payment.payment_date === lastSundayStr
            );

            // Calculate overdue amount
            const overdueAmount = missedPayments * customer.weekly_amount;

            // Get last payment date
            const lastPayment = loanData.payments && loanData.payments.length > 0
              ? loanData.payments[loanData.payments.length - 1]
              : null;

            return {
              customerId: customer.id,
              name: customer.name,
              phone: customer.phone,
              weeklyAmount: customer.weekly_amount,
              balance: customer.balance,
              missedPayments,
              overdueAmount,
              lastPaymentDate: lastPayment?.payment_date || null,
              loanId: customer.loan_id,
              loanData,
              weeksSinceStart,
              paidLastSunday
            };
          }
          return null;
        } catch (error) {
          console.error('Error fetching loan details:', error);
          return null;
        }
      });

      const results = await Promise.all(overduePromises);
      const overdue = results.filter(c => c !== null);

      // Sort by most missed payments first
      overdue.sort((a, b) => b.missedPayments - a.missedPayments);

      setOverdueCustomers(overdue);
    } catch (error) {
      console.error('Error fetching overdue customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = (customer) => {
    setSelectedLoan(customer.loanData);
    setShowPaymentModal(true);
  };

  const handleCall = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const formatLastPayment = (dateString) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const today = new Date();
    const daysAgo = Math.floor((today - date) / (24 * 60 * 60 * 1000));

    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    if (daysAgo < 14) return '1 week ago';
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const totalOverdueAmount = overdueCustomers.reduce((sum, c) => sum + c.overdueAmount, 0);
  const totalMissedPayments = overdueCustomers.reduce((sum, c) => sum + c.missedPayments, 0);

  return (
    <div>
      <div className="navbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('dashboard')}
          title="Back to Dashboard"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2>Overdue Payments</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Summary Stats */}
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
        }}>
          <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>Total Overdue</div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            ₹{totalOverdueAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', opacity: 0.9 }}>
            <div>👥 {overdueCustomers.length} customers</div>
            <div>📅 {totalMissedPayments} missed payments</div>
          </div>
        </div>

        {/* Customer List */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              animation: 'spin 1s linear infinite'
            }}>⏳</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading overdue customers...</div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : overdueCustomers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#059669', marginBottom: '8px' }}>
              All Caught Up!
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              No customers have overdue payments
            </div>
          </div>
        ) : (
          <>
            {overdueCustomers.map((customer, index) => (
              <div
                key={customer.customerId}
                style={{
                  background: 'white',
                  border: '2px solid #fca5a5',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '12px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'inline-block',
                      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 700,
                      marginBottom: '6px'
                    }}>
                      ⚠️ {customer.missedPayments} WEEK{customer.missedPayments > 1 ? 'S' : ''} OVERDUE
                    </div>
                    <div style={{
                      fontWeight: 700,
                      color: '#1f2937',
                      fontSize: '16px',
                      marginBottom: '4px'
                    }}>
                      {index + 1}. {customer.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginBottom: '2px'
                    }}>
                      📱 {customer.phone}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      💰 ₹{customer.weeklyAmount.toLocaleString('en-IN')} per week
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      color: '#dc2626',
                      marginBottom: '2px'
                    }}>
                      ₹{customer.overdueAmount.toLocaleString('en-IN')}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      fontWeight: 600
                    }}>
                      OVERDUE
                    </div>
                  </div>
                </div>

                <div style={{
                  background: '#fef2f2',
                  padding: '10px',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Last Payment:</span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>
                      {formatLastPayment(customer.lastPaymentDate)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Remaining Balance:</span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>
                      ₹{customer.balance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePayNow(customer)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 3px 8px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 5px 12px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 3px 8px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    💰 Record Payment
                  </button>
                  <button
                    onClick={() => handleCall(customer.phone)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 3px 8px rgba(59, 130, 246, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 5px 12px rgba(59, 130, 246, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 3px 8px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    📞 Call Now
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {showPaymentModal && selectedLoan && (
        <AddPaymentModal
          loan={selectedLoan}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedLoan(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedLoan(null);
            fetchOverdueCustomers();
          }}
        />
      )}
    </div>
  );
}

export default OverduePayments;
