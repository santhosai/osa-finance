import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AddCustomerModal from './AddCustomerModal';
import PaymentsThisWeekModal from './PaymentsThisWeekModal';
import DatabaseMonitorModal from './DatabaseMonitorModal';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function Dashboard({ navigateTo }) {
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentsThisWeekModal, setShowPaymentsThisWeekModal] = useState(false);
  const [showDatabaseMonitorModal, setShowDatabaseMonitorModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyPaymentsData, setWeeklyPaymentsData] = useState({ paidLoans: [], unpaidLoans: [], loading: true });

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

  // Fetch weekly payments data when selectedDate or customers change
  useEffect(() => {
    const fetchWeeklyPayments = async () => {
      setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: true });

      const selected = new Date(selectedDate + 'T00:00:00');
      const isSunday = selected.getDay() === 0;

      if (!isSunday || customers.length === 0) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }

      const sundayDate = selected.toISOString().split('T')[0];

      // Helper to get first payment Sunday
      const getFirstPaymentSunday = (startDateStr) => {
        const date = new Date(startDateStr + 'T00:00:00');
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) return date;
        const daysUntilSunday = 7 - dayOfWeek;
        const firstSunday = new Date(date);
        firstSunday.setDate(date.getDate() + daysUntilSunday);
        return firstSunday;
      };

      const paidLoans = [];
      const unpaidLoans = [];

      // Fetch loan details for each customer's loans
      const promises = [];

      customers.forEach(customer => {
        if (!customer.loans || customer.loans.length === 0) return;

        customer.loans.forEach(loan => {
          if (loan.status === 'closed' || loan.loan_type !== 'Weekly' || loan.balance <= 0) return;

          const firstPaymentSunday = getFirstPaymentSunday(loan.start_date);
          const daysDiff = Math.floor((selected - firstPaymentSunday) / (24 * 60 * 60 * 1000));

          // Only show if it's a payment Sunday for this loan
          if (daysDiff >= 0 && daysDiff % 7 === 0) {
            const weekNumber = (daysDiff / 7) + 1;
            if (weekNumber <= 10) { // 10 weeks total
              const promise = fetch(`${API_URL}/loans/${loan.loan_id}`)
                .then(res => res.json())
                .then(loanData => {
                  // Check if payment was made ON this specific Sunday
                  const isPaid = loanData.payments?.some(payment => {
                    const paymentDate = payment.payment_date?.split('T')[0];
                    return paymentDate === sundayDate;
                  }) || false;

                  // Calculate total weeks and remaining weeks
                  const totalWeeks = 10; // Weekly loans are 10 weeks
                  const remainingWeeks = totalWeeks - weekNumber;

                  return {
                    customer,
                    loan: { ...loan, ...loanData },
                    weekNumber,
                    totalWeeks,
                    remainingWeeks,
                    paymentAmount: loan.weekly_amount,
                    balance: loan.balance,
                    isPaid
                  };
                })
                .catch(err => {
                  console.error('Error fetching loan:', err);
                  return null;
                });

              promises.push(promise);
            }
          }
        });
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null);

      validResults.forEach(result => {
        if (result.isPaid) {
          paidLoans.push(result);
        } else {
          unpaidLoans.push(result);
        }
      });

      setWeeklyPaymentsData({ paidLoans, unpaidLoans, loading: false });
    };

    fetchWeeklyPayments();
  }, [selectedDate, customers]);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Helper function to determine card background color based on outstanding balance
  const getUnpaidCardColor = (balance) => {
    if (balance > 10000) {
      return 'linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%)'; // Red for high balance
    }
    if (balance > 5000) {
      return 'linear-gradient(135deg, #fed7aa 0%, #fb923c 100%)'; // Orange for medium balance
    }
    return 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'; // Light red for low balance
  };

  const handleRefresh = () => {
    mutate(); // SWR: Re-fetch stats
    mutateCustomers(); // SWR: Re-fetch customers
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  // Check if backup reminder should be shown
  const shouldShowBackupReminder = () => {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const lastDownload = localStorage.getItem('lastBackupDownload');

    // Show reminder if:
    // 1. Never downloaded before, OR
    // 2. Haven't downloaded this month yet
    return !lastDownload || !lastDownload.startsWith(currentMonth);
  };

  const [showBackupReminder, setShowBackupReminder] = useState(shouldShowBackupReminder());

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

      // Record download date and hide backup reminder
      const today = new Date();
      const downloadDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      localStorage.setItem('lastBackupDownload', downloadDate);
      setShowBackupReminder(false);
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

          <button
            onClick={() => { setShowSidebar(false); navigateTo('investments'); }}
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
            💰 Investments
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

          {/* Database Size Monitor */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              minWidth: '80px',
              cursor: 'pointer'
            }}
            onClick={() => setShowDatabaseMonitorModal(true)}
            title="Click to view details and add notes. Auto-refreshes every 30s"
          >
            {stats && stats.database ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                  <span>💾</span>
                  <span>{stats.database.estimatedSizeMB}MB / {stats.database.limitMB}MB</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(stats.database.usagePercent, 100)}%`,
                      height: '100%',
                      background: stats.database.usagePercent > 80 ? '#ef4444' : stats.database.usagePercent > 60 ? '#f59e0b' : '#10b981',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </>
            ) : (
              <span>Loading...</span>
            )}
          </div>
        </div>

        {/* Monthly Backup Reminder Banner */}
        {showBackupReminder && (
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            padding: '12px 16px',
            margin: '10px 10px 0 10px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'slideIn 0.3s ease'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                🔔 Monthly Backup Reminder
              </div>
              <div style={{ color: 'white', fontSize: '11px', opacity: 0.95 }}>
                Download your data backup to keep your records safe
              </div>
            </div>
            <button
              onClick={downloadAllData}
              style={{
                background: 'white',
                color: '#d97706',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              📥 Download Now
            </button>
          </div>
        )}

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

              // Show loading state while fetching payment data
              if (weeklyPaymentsData.loading) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#6b7280',
                    fontSize: '13px'
                  }}>
                    Loading payments...
                  </div>
                );
              }

              // Use data from state (fetched in useEffect)
              const { paidLoans, unpaidLoans } = weeklyPaymentsData;

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
                      {paidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          onClick={() => navigateTo('loan-details', loan.loan_id)}
                          style={{
                            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                            padding: '10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: '1px solid #6ee7b7',
                            transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#065f46', marginBottom: '6px' }}>
                            {customer.name}
                          </div>
                          <div style={{ display: 'grid', gap: '3px', fontSize: '11px' }}>
                            <div style={{ color: '#047857', fontWeight: 600 }}>
                              📅 Week {weekNumber} of {totalWeeks}
                            </div>
                            <div style={{ color: '#059669', fontWeight: 600 }}>
                              💰 Payment: {formatCurrency(paymentAmount)}
                            </div>
                            <div style={{ color: '#0d9488', fontWeight: 600 }}>
                              💵 Balance: {formatCurrency(balance)}
                            </div>
                            <div style={{ color: '#0891b2', fontWeight: 600 }}>
                              ⏳ Remaining: {remainingWeeks} week{remainingWeeks !== 1 ? 's' : ''}
                            </div>
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
                      {unpaidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          onClick={() => navigateTo('loan-details', loan.loan_id)}
                          style={{
                            background: getUnpaidCardColor(balance),
                            padding: '10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: balance > 10000
                              ? '1px solid #fca5a5'
                              : balance > 5000
                                ? '1px solid #fb923c'
                                : '1px solid #fecaca',
                            transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#7f1d1d', marginBottom: '6px' }}>
                            {customer.name}
                          </div>
                          <div style={{ display: 'grid', gap: '3px', fontSize: '11px' }}>
                            <div style={{ color: '#991b1b', fontWeight: 600 }}>
                              📅 Week {weekNumber} of {totalWeeks}
                            </div>
                            <div style={{ color: '#b91c1c', fontWeight: 600 }}>
                              💰 Due: {formatCurrency(paymentAmount)}
                            </div>
                            <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>
                              ⚠️ Outstanding: {formatCurrency(balance)}
                            </div>
                            <div style={{ color: '#ea580c', fontWeight: 600 }}>
                              ⏳ Remaining: {remainingWeeks} week{remainingWeeks !== 1 ? 's' : ''}
                            </div>
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

      {showDatabaseMonitorModal && (
        <DatabaseMonitorModal
          stats={stats}
          onClose={() => setShowDatabaseMonitorModal(false)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

export default Dashboard;
