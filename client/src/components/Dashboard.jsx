import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AddCustomerModal from './AddCustomerModal';
import PaymentsThisWeekModal from './PaymentsThisWeekModal';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function Dashboard({ navigateTo }) {
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentsThisWeekModal, setShowPaymentsThisWeekModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Use SWR for automatic caching and re-fetching
  const { data: stats, error, isLoading, mutate } = useSWR(`${API_URL}/stats`, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    revalidateOnFocus: true, // Auto-refresh when user returns to tab
    dedupingInterval: 2000, // Prevent duplicate requests within 2s
  });

  // Fetch customers with loans for the table
  const { data: customers = [], mutate: mutateCustomers } = useSWR(`${API_URL}/customers`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleRefresh = () => {
    mutate(); // SWR: Re-fetch stats
    mutateCustomers(); // SWR: Re-fetch customers
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  const downloadAllData = async () => {
    try {
      const response = await fetch(`${API_URL}/customers`);
      const customers = await response.json();

      // Fetch detailed info for each loan
      const loanDetailsPromises = [];
      const customerLoanMap = [];

      for (const customer of customers) {
        if (customer.loans && customer.loans.length > 0) {
          for (const loan of customer.loans) {
            const promise = fetch(`${API_URL}/loans/${loan.loan_id}`)
              .then(res => res.json())
              .then(loanData => ({
                customerName: customer.name,
                customerPhone: customer.phone,
                loanData
              }));
            loanDetailsPromises.push(promise);
          }
        } else {
          // Customer with no loans
          customerLoanMap.push({
            customerName: customer.name,
            customerPhone: customer.phone,
            loanData: null
          });
        }
      }

      const loansWithDetails = await Promise.all(loanDetailsPromises);
      const allRows = [...customerLoanMap, ...loansWithDetails];

      const csvHeader = 'Customer Name,Phone,Loan Name,Loan Amount,Balance,Weekly Payment,Status,Total Paid,Progress %,Start Date,Last Payment Date,Weeks Remaining,Expected Completion Date\n';

      const csvRows = allRows.map(row => {
        if (row.loanData) {
          const loan = row.loanData;
          const totalPaid = loan.loan_amount - loan.balance;
          const progress = ((totalPaid / loan.loan_amount) * 100).toFixed(1);
          const lastPayment = loan.payments && loan.payments.length > 0 ? loan.payments[0].payment_date : 'No payments';
          const weeksRemaining = loan.weeksRemaining || 0;
          const startDate = loan.start_date || '';
          const expectedDate = startDate ? new Date(startDate) : null;
          if (expectedDate) {
            expectedDate.setDate(expectedDate.getDate() + (loan.totalWeeks * 7));
          }
          const expectedCompletion = expectedDate ? expectedDate.toISOString().split('T')[0] : '-';
          const loanName = loan.loan_name || 'General Loan';
          return `${row.customerName},${row.customerPhone},${loanName},${loan.loan_amount},${loan.balance},${loan.weekly_amount},${loan.status},${totalPaid},${progress}%,${startDate},${lastPayment},${weeksRemaining},${expectedCompletion}`;
        } else {
          return `${row.customerName},${row.customerPhone},No Active Loan,-,-,-,-,-,-,-,-,-,-`;
        }
      }).join('\n');

      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `All_Customers_Report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading data:', error);
      alert('Failed to download report');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Menu Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: showSidebar ? '0' : '-280px',
          top: 0,
          width: '280px',
          maxWidth: '80vw',
          height: '100vh',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          transition: 'left 0.3s ease',
          zIndex: 1000,
          boxShadow: '2px 0 10px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ padding: '14px', borderBottom: '1px solid #334155' }}>
          <h3 style={{ color: '#d97706', margin: 0, fontSize: '16px', fontWeight: 700 }}>OM SAI MURUGAN</h3>
          <p style={{ color: '#94a3b8', margin: '3px 0 0', fontSize: '10px' }}>FINANCE</p>
        </div>

        <div style={{ padding: '6px 0' }}>
          <button
            onClick={() => { setShowSidebar(false); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#1e40af',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#1e3a8a'}
            onMouseOut={(e) => e.target.style.background = '#1e40af'}
          >
            📊 Dashboard
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('sunday-collections'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📅 Sunday Collections
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('overdue-payments'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            ⚠️ Overdue Payments
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('customers'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            👥 Customers
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('payment-tracker'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📅 Payment Tracker
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('vaddi-list'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📝 Vaddi List
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('weekly-finance'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📅 Weekly Finance
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('monthly-finance'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            💰 Monthly Finance
          </button>

        </div>

        <button
          onClick={handleLogout}
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '14px',
            right: '14px',
            padding: '10px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          🚪 Logout
        </button>
      </div>

      {/* Overlay */}
      {showSidebar && (
        <div
          onClick={() => setShowSidebar(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999
          }}
        />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, padding: '0', width: '100%' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ☰
            </button>
            <h2 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: 700 }}>Dashboard</h2>
          </div>

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
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            🔄
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ padding: '10px' }}>
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '8px',
              marginBottom: '10px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                padding: '10px 12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(30, 64, 175, 0.2)',
                color: 'white'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>Active Loans</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats.activeLoans}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                padding: '10px 12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.2)',
                color: 'white'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>Total Outstanding</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>
                  {formatCurrency(stats.outstanding || 0)}
                </div>
                <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '4px' }}>
                  <span>Weekly: {formatCurrency(stats.weeklyOutstanding || 0)}</span>
                  <span> | Monthly: {formatCurrency(stats.monthlyOutstanding || 0)}</span>
                </div>
              </div>

              <div
                onClick={() => setShowPaymentsThisWeekModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 120, 87, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(4, 120, 87, 0.2)';
                }}
              >
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>
                  Payments This Week
                  <span style={{ marginLeft: '4px', fontSize: '9px', opacity: 0.8 }}>👆 Click</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats.paymentsThisWeek}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                padding: '10px 12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(71, 85, 105, 0.2)',
                color: 'white'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>Total Customers</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats.totalCustomers}</div>
              </div>
            </div>
          )}

          {/* Weekly Payments Table */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 700,
                color: '#1e293b'
              }}>
                📅 Weekly Payments
              </h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1e293b'
                }}
              />
            </div>

{(() => {
              // Get the selected date and check if it's a Sunday
              const selected = new Date(selectedDate + 'T00:00:00');
              const isSunday = selected.getDay() === 0;

              if (!isSunday) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600
                  }}>
                    ⚠️ Please select a Sunday. Collections are only on Sundays.
                  </div>
                );
              }

              // Get the Sunday's date for comparison
              const sundayDate = selected.toISOString().split('T')[0];

              // Helper function to get the first payment Sunday on or after the start date
              const getFirstPaymentSunday = (startDateStr) => {
                const date = new Date(startDateStr + 'T00:00:00');
                const dayOfWeek = date.getDay();

                if (dayOfWeek === 0) {
                  // Start date is already a Sunday
                  return date;
                } else {
                  // Move to next Sunday
                  const daysUntilSunday = 7 - dayOfWeek;
                  const firstSunday = new Date(date);
                  firstSunday.setDate(date.getDate() + daysUntilSunday);
                  return firstSunday;
                }
              };

              // Collect loans with payments due on this Sunday
              const paidLoans = [];
              const unpaidLoans = [];

              customers.forEach(customer => {
                if (!customer.loans || customer.loans.length === 0) return;

                customer.loans.forEach(loan => {
                  if (loan.status === 'closed') return;

                  // Only process Weekly loans (Monthly loans are collected on any day)
                  if (loan.loan_type !== 'Weekly') return;

                  // Get the first payment Sunday for this loan
                  const firstPaymentSunday = getFirstPaymentSunday(loan.start_date);

                  // Calculate days from first payment Sunday to selected Sunday
                  const daysDiff = Math.floor((selected - firstPaymentSunday) / (24 * 60 * 60 * 1000));

                  // Check if selected date is exactly a payment Sunday for this loan
                  // (must be 0, 7, 14, 21, ... days from first payment Sunday)
                  if (daysDiff >= 0 && daysDiff % 7 === 0) {
                    const weekNumber = (daysDiff / 7) + 1; // 1-indexed week number
                    const totalWeeks = 10; // Weekly loans are always 10 weeks

                    // Only show if within the loan period
                    if (weekNumber <= totalWeeks) {
                      // Check if payment was made for this week
                      const paymentAmount = loan.weekly_amount;
                      const totalPaid = loan.loan_amount - loan.balance;
                      const actualPayments = Math.floor(totalPaid / paymentAmount);
                      const isPaid = actualPayments >= weekNumber;

                      const loanData = {
                        customer,
                        loan,
                        weekNumber,
                        paymentAmount
                      };

                      if (isPaid) {
                        paidLoans.push(loanData);
                      } else {
                        unpaidLoans.push(loanData);
                      }
                    }
                  }
                });
              });

              if (paidLoans.length === 0 && unpaidLoans.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#6b7280',
                    fontSize: '13px'
                  }}>
                    No payments due for this Sunday
                  </div>
                );
              }

              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  overflowX: 'auto'
                }}>
                  {/* PAID Column */}
                  <div style={{
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    padding: '10px',
                    minWidth: '250px'
                  }}>
                    <h4 style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#065f46',
                      textAlign: 'center'
                    }}>
                      ✓ PAID ({paidLoans.length})
                    </h4>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {paidLoans.map(({ customer, loan, paymentAmount }) => (
                        <div
                          key={loan.loan_id}
                          onClick={() => navigateTo('loan-details', loan.loan_id)}
                          style={{
                            background: 'white',
                            padding: '8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: '1px solid #d1fae5',
                            transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.2)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b', marginBottom: '2px' }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                            {formatCurrency(paymentAmount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* UNPAID Column */}
                  <div style={{
                    background: '#fef2f2',
                    borderRadius: '8px',
                    padding: '10px',
                    minWidth: '250px'
                  }}>
                    <h4 style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#991b1b',
                      textAlign: 'center'
                    }}>
                      ✗ UNPAID ({unpaidLoans.length})
                    </h4>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {unpaidLoans.map(({ customer, loan, paymentAmount }) => (
                        <div
                          key={loan.loan_id}
                          onClick={() => navigateTo('loan-details', loan.loan_id)}
                          style={{
                            background: 'white',
                            padding: '8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: '1px solid #fecaca',
                            transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.2)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b', marginBottom: '2px' }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                            {formatCurrency(paymentAmount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={() => {
            setShowAddCustomerModal(false);
            mutate(); // SWR: Re-fetch data automatically
          }}
        />
      )}

      {showPaymentsThisWeekModal && (
        <PaymentsThisWeekModal
          onClose={() => setShowPaymentsThisWeekModal(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
