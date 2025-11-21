import { useState, useEffect } from 'react';
import AddPaymentModal from './AddPaymentModal';
import { API_URL } from '../config';

function SundayCollections({ navigateTo }) {
  const [selectedSunday, setSelectedSunday] = useState(getNextSunday());
  const [sundayCustomers, setSundayCustomers] = useState([]);
  const [loadingSundayCustomers, setLoadingSundayCustomers] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 20;
  const [dateError, setDateError] = useState('');

  // Helper function to get next Sunday
  function getNextSunday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday.toISOString().split('T')[0];
  }

  useEffect(() => {
    fetchSundayCustomers();
  }, [selectedSunday]);

  const fetchSundayCustomers = async () => {
    // Validate that selected date is a Sunday
    const selectedDate = new Date(selectedSunday + 'T00:00:00');
    if (selectedDate.getDay() !== 0) {
      setDateError('⚠️ Please select a Sunday. Collections are only on Sundays.');
      setSundayCustomers([]);
      return;
    }
    setDateError('');

    setLoadingSundayCustomers(true);
    try {
      const response = await fetch(`${API_URL}/customers`);
      const allCustomers = await response.json();

      // Collect all weekly loans from all customers
      const weeklyLoansPromises = [];

      allCustomers.forEach(customer => {
        if (customer.loans && customer.loans.length > 0) {
          customer.loans.forEach(loan => {
            // Only show Weekly loans with balance > 0
            const isWeekly = !loan.loan_type || loan.loan_type === 'Weekly';
            const hasBalance = loan.balance > 0;

            if (isWeekly && hasBalance) {
              const promise = (async () => {
                try {
                  const loanResponse = await fetch(`${API_URL}/loans/${loan.loan_id}`);
                  const loanData = await loanResponse.json();

                  // Check if customer has already paid on the selected Sunday
                  // Normalize dates to YYYY-MM-DD format for accurate comparison
                  const paidOnSelectedSunday = loanData.payments?.some(
                    payment => {
                      const paymentDate = payment.payment_date?.split('T')[0]; // Extract date part only
                      return paymentDate === selectedSunday;
                    }
                  );

                  // Calculate which week number this would be
                  const startDate = new Date(loanData.start_date);
                  const selectedDate = new Date(selectedSunday);
                  const weeksDiff = Math.floor((selectedDate - startDate) / (7 * 24 * 60 * 60 * 1000));

                  // Include all loans with balance > 0
                  // Loans continue showing until fully paid, regardless of week number
                  if (weeksDiff >= 0) {
                    return {
                      name: customer.name,
                      phone: customer.phone,
                      weeklyAmount: loan.weekly_amount || loanData.weekly_amount,
                      weekNumber: weeksDiff + 1,
                      isPaid: paidOnSelectedSunday,
                      loanId: loan.loan_id,
                      customerId: customer.id,
                      loanName: loan.loan_name || 'General Loan'
                    };
                  }
                  return null;
                } catch (error) {
                  console.error('Error fetching loan details:', error);
                  return null;
                }
              })();
              weeklyLoansPromises.push(promise);
            }
          });
        }
      });

      const results = await Promise.all(weeklyLoansPromises);
      const dueCustomers = results.filter(c => c !== null);
      setSundayCustomers(dueCustomers);
      setCurrentPage(1); // Reset to page 1 when date changes
    } catch (error) {
      console.error('Error fetching Sunday customers:', error);
    } finally {
      setLoadingSundayCustomers(false);
    }
  };

  const handlePayNow = async (customer) => {
    try {
      const response = await fetch(`${API_URL}/loans/${customer.loanId}`);
      const loanData = await response.json();
      setSelectedCustomerForPayment(loanData);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error fetching loan details:', error);
      alert('Failed to load payment form. Please try again.');
    }
  };

  const downloadSundayCollection = () => {
    const date = new Date(selectedSunday);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const csvHeader = 'Customer Name,Phone,Weekly Amount,Week Number,Status\n';
    const csvRows = sundayCustomers.map(customer =>
      `${customer.name},${customer.phone},${customer.weeklyAmount},${customer.weekNumber},${customer.isPaid ? 'PAID' : 'UNPAID'}`
    ).join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Sunday_Collection_${selectedSunday}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = sundayCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(sundayCustomers.length / customersPerPage);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const totalCustomers = sundayCustomers.length;
  const paidCount = sundayCustomers.filter(c => c.isPaid).length;
  const unpaidCount = sundayCustomers.filter(c => !c.isPaid).length;
  const expectedCollection = sundayCustomers.filter(c => !c.isPaid).reduce((sum, c) => sum + c.weeklyAmount, 0);

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
        <h2>Sunday Collections</h2>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={downloadSundayCollection}
          title="Download CSV"
        >
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f2937' }}>
            Select Sunday
          </label>
          <input
            type="date"
            value={selectedSunday}
            onChange={(e) => setSelectedSunday(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: dateError ? '2px solid #dc2626' : '1px solid #d1d5db',
              fontSize: '16px',
              backgroundColor: dateError ? '#fef2f2' : 'white'
            }}
          />
          {dateError && (
            <div style={{
              marginTop: '8px',
              padding: '12px',
              background: '#fee2e2',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '14px',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {dateError}
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Total Customers</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>{totalCustomers}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Expected Collection</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#047857' }}>
                ₹{expectedCollection.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Paid</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>{paidCount}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>✗</span>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Unpaid</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{unpaidCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer List */}
        {loadingSundayCustomers ? (
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
            <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading customers...</div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : sundayCustomers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
              No customers have payments due on this Sunday
            </div>
          </div>
        ) : (
          <>
            {currentCustomers.map((customer, index) => (
              <div
                key={index}
                style={{
                  background: customer.isPaid
                    ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                    : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                  border: `2px solid ${customer.isPaid ? '#10b981' : '#ef4444'}`,
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  position: 'relative',
                  boxShadow: customer.isPaid
                    ? '0 2px 8px rgba(16, 185, 129, 0.15)'
                    : '0 2px 8px rgba(239, 68, 68, 0.15)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: customer.isPaid
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '12px' }}>
                    {customer.isPaid ? '✓' : '✗'}
                  </span>
                  {customer.isPaid ? 'PAID' : 'UNPAID'}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '80px' }}>
                  <div style={{
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '6px',
                    fontSize: '15px',
                    letterSpacing: '-0.01em'
                  }}>
                    {indexOfFirstCustomer + index + 1}. {customer.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 500
                  }}>
                    📱 {customer.phone} • Week {customer.weekNumber}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <div style={{
                    fontWeight: 800,
                    fontSize: '18px',
                    color: customer.isPaid ? '#059669' : '#dc2626',
                    letterSpacing: '-0.02em',
                    marginTop: '24px'
                  }}>
                    ₹{customer.weeklyAmount.toLocaleString('en-IN')}
                  </div>
                  {!customer.isPaid && (
                    <button
                      onClick={() => handlePayNow(customer)}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '7px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 3px 8px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.2s ease',
                        letterSpacing: '0.3px'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = 'translateY(-2px) scale(1.03)';
                        e.target.style.boxShadow = '0 5px 12px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = 'translateY(0) scale(1)';
                        e.target.style.boxShadow = '0 3px 8px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      💰 Pay
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                padding: '24px 16px',
                marginBottom: '20px'
              }}>
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: currentPage === 1 ? '#e5e7eb' : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    color: currentPage === 1 ? '#9ca3af' : 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    boxShadow: currentPage === 1 ? 'none' : '0 4px 12px rgba(30, 64, 175, 0.25)'
                  }}
                >
                  ← Previous
                </button>

                <div style={{
                  padding: '10px 16px',
                  background: 'white',
                  borderRadius: '8px',
                  fontWeight: 600,
                  color: '#1f2937',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: currentPage === totalPages ? '#e5e7eb' : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    color: currentPage === totalPages ? '#9ca3af' : 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    boxShadow: currentPage === totalPages ? 'none' : '0 4px 12px rgba(30, 64, 175, 0.25)'
                  }}
                >
                  Next →
                </button>
              </div>
            )}

            {/* Count info */}
            <div style={{
              textAlign: 'center',
              padding: '12px',
              color: '#6b7280',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              Showing {indexOfFirstCustomer + 1}-{Math.min(indexOfLastCustomer, sundayCustomers.length)} of {sundayCustomers.length} customers
            </div>
          </>
        )}
      </div>

      {showPaymentModal && selectedCustomerForPayment && (
        <AddPaymentModal
          loan={selectedCustomerForPayment}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedCustomerForPayment(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedCustomerForPayment(null);
            fetchSundayCustomers();
          }}
        />
      )}
    </div>
  );
}

export default SundayCollections;
