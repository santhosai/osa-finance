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
  const [showQuickRefModal, setShowQuickRefModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyPaymentsData, setWeeklyPaymentsData] = useState({ paidLoans: [], unpaidLoans: [], loading: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

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

  // Get current month for Vaddi summary
  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  // Fetch Vaddi monthly summary
  const { data: vaddiSummary = {} } = useSWR(`${API_URL}/vaddi-summary?month=${currentMonth}`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  // Fetch Daily Finance summary
  const { data: dailySummary = {} } = useSWR(`${API_URL}/daily-summary`, fetcher, {
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

      // Use selectedDate directly - already in YYYY-MM-DD format, no timezone conversion needed
      const sundayDate = selectedDate;

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
                  console.log(`🔍 Loan ${loan.loan_id} (${customer.name}) - ${loanData.payments?.length || 0} payments, checking against ${sundayDate}`);
                  const isPaid = loanData.payments?.some(payment => {
                    const paymentDate = payment.payment_date?.split('T')[0];
                    const matches = paymentDate === sundayDate;
                    console.log(`  Payment: ${payment.payment_date} → ${paymentDate} === ${sundayDate}? ${matches}`);
                    return matches;
                  }) || false;
                  console.log(`  Result: isPaid = ${isPaid}`);

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
            onClick={() => { setShowSidebar(false); navigateTo('daily-finance'); }}
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
            📆 Daily Finance
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

          <button
            onClick={() => { setShowSidebar(false); navigateTo('archived-loans'); }}
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
            📦 Archived Loans
          </button>

          {localStorage.getItem('userRole') === 'admin' && (
            <button
              onClick={() => { setShowSidebar(false); navigateTo('user-management'); }}
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
              👥 User Management
            </button>
          )}

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

          {/* Search Bar */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '200px', margin: '0 8px' }}>
            <input
              type="text"
              placeholder="🔍 Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchResults(e.target.value.length > 0);
              }}
              onFocus={() => setShowSearchResults(searchTerm.length > 0)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                outline: 'none'
              }}
            />
            {/* Search Results Dropdown */}
            {showSearchResults && searchTerm.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 1001,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}
              >
                {(() => {
                  const searchLower = searchTerm.toLowerCase();
                  const results = customers
                    .filter(customer =>
                      customer.name.toLowerCase().includes(searchLower) ||
                      (customer.phone && customer.phone.includes(searchTerm)) ||
                      (customer.loans && customer.loans.some(loan =>
                        (loan.loan_name && loan.loan_name.toLowerCase().includes(searchLower))
                      ))
                    )
                    .slice(0, 10);

                  if (results.length === 0) {
                    return (
                      <div style={{ padding: '12px', color: '#6b7280', textAlign: 'center', fontSize: '12px' }}>
                        No results found
                      </div>
                    );
                  }

                  return results.map(customer => (
                    <div
                      key={customer.customer_id}
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchTerm('');
                        if (customer.loans && customer.loans.length > 0) {
                          navigateTo('loan-details', customer.loans[0].loan_id);
                        } else {
                          navigateTo('customers');
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>
                        {customer.name}
                      </div>
                      {customer.phone && (
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>
                          📞 {customer.phone}
                        </div>
                      )}
                      {customer.loans && customer.loans.length > 0 && (
                        <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>
                          {customer.loans.filter(l => l.status === 'active').length} active loan(s)
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Quick Reference Button */}
          <button
            onClick={() => setShowQuickRefModal(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Quick Reference - All Customers"
          >
            📋 Quick Ref
          </button>

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

            </div>
          )}

          {/* Vaddi Monthly Summary Card */}
          <div
            onClick={() => navigateTo('vaddi-list')}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              padding: '12px 14px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '10px',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.95 }}>
                💰 Vaddi - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Tap to view →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatCurrency(vaddiSummary.totalCollected || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Total</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {formatCurrency(vaddiSummary.myProfit || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>My Profit</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fcd34d' }}>
                  {formatCurrency(vaddiSummary.friendShare || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Friend</div>
              </div>
            </div>
            {vaddiSummary.paymentCount > 0 && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', opacity: 0.9 }}>
                {vaddiSummary.paymentCount} payments recorded this month
              </div>
            )}
          </div>

          {/* Daily Finance Summary Card */}
          <div
            onClick={() => navigateTo('daily-finance')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '12px 14px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '10px',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.95 }}>
                📆 Daily Finance (100 Days)
              </div>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Tap to view →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatCurrency(dailySummary.total_given || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Given</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fee2e2' }}>
                  {formatCurrency(dailySummary.total_outstanding || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Outstanding</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {dailySummary.active_loans || 0}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Active</div>
              </div>
            </div>
            {dailySummary.today_expected > 0 && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', opacity: 0.9 }}>
                Today: {formatCurrency(dailySummary.today_collected || 0)} / {formatCurrency(dailySummary.today_expected)} collected
              </div>
            )}
          </div>

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

              // Calculate totals
              const paidTotal = paidLoans.reduce((sum, item) => sum + item.paymentAmount, 0);
              const unpaidTotal = unpaidLoans.reduce((sum, item) => sum + item.paymentAmount, 0);
              const grandTotal = paidTotal + unpaidTotal;

              return (
                <div>
                  {/* Total Summary */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '10px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px',
                    color: 'white'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#86efac' }}>
                        {formatCurrency(paidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>Collected</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>
                        {formatCurrency(unpaidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>Pending</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>
                        {formatCurrency(grandTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>Total Due</div>
                    </div>
                  </div>
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
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {paidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          onClick={() => navigateTo('loan-details', loan.loan_id)}
                          style={{
                            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                            padding: '6px 8px',
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
                          <div style={{ fontWeight: 700, fontSize: '11px', color: '#065f46', marginBottom: '2px' }}>
                            {customer.name}
                            {loan.loan_name && loan.loan_name !== 'General Loan' && (
                              <span style={{ fontSize: '10px', color: '#047857', fontWeight: 500, marginLeft: '4px' }}>
                                • {loan.loan_name}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600, marginBottom: '1px' }}>
                            Week {weekNumber}/{totalWeeks} • {formatCurrency(paymentAmount)}
                          </div>
                          <div style={{ fontSize: '9px', color: '#059669', fontWeight: 500 }}>
                            Bal: {formatCurrency(balance)} • {remainingWeeks}w left
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
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {unpaidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          onClick={() => navigateTo('loan-details', loan.loan_id)}
                          style={{
                            background: getUnpaidCardColor(balance),
                            padding: '6px 8px',
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
                          <div style={{ fontWeight: 700, fontSize: '11px', color: '#7f1d1d', marginBottom: '2px' }}>
                            {customer.name}
                            {loan.loan_name && loan.loan_name !== 'General Loan' && (
                              <span style={{ fontSize: '10px', color: '#991b1b', fontWeight: 500, marginLeft: '4px' }}>
                                • {loan.loan_name}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 600, marginBottom: '1px' }}>
                            Week {weekNumber}/{totalWeeks} • {formatCurrency(paymentAmount)}
                          </div>
                          <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700 }}>
                            ⚠️ {formatCurrency(balance)} • {remainingWeeks}w left
                          </div>
                        </div>
                      ))}
                    </div>
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

      {showQuickRefModal && (
        <QuickReferenceModal
          customers={customers}
          onClose={() => setShowQuickRefModal(false)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

// Quick Reference Modal Component
function QuickReferenceModal({ customers, onClose, formatCurrency }) {
  // Get all customers with active loans
  const customersWithLoans = customers
    .filter(customer => customer.loans && customer.loans.length > 0)
    .flatMap(customer =>
      customer.loans
        .filter(loan => loan.status === 'active' && loan.balance > 0)
        .map(loan => ({
          name: customer.name,
          friendName: loan.loan_name || 'General Loan',
          amountGot: loan.loan_amount,
          balance: loan.balance
        }))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            📋 Quick Reference - All Active Loans
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Table Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {customersWithLoans.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#6b7280'
              }}
            >
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>No Active Loans</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                All loans are either closed or paid off
              </div>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}
            >
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', color: 'white' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '13px',
                      borderTopLeftRadius: '8px'
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    Friend Name
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    Amount Got
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: '13px',
                      borderTopRightRadius: '8px'
                    }}
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {customersWithLoans.map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      background: index % 2 === 0 ? '#f9fafb' : 'white',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: 600, color: '#1e293b' }}>
                      {row.name}
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>
                      {row.friendName}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: '#059669'
                      }}
                    >
                      {formatCurrency(row.amountGot)}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: row.balance > 5000 ? '#dc2626' : '#f59e0b'
                      }}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
                  <td
                    colSpan="2"
                    style={{
                      padding: '12px',
                      fontWeight: 700,
                      color: '#1e293b',
                      fontSize: '15px',
                      borderBottomLeftRadius: '8px'
                    }}
                  >
                    Total ({customersWithLoans.length} loans)
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#059669',
                      fontSize: '15px'
                    }}
                  >
                    {formatCurrency(customersWithLoans.reduce((sum, row) => sum + row.amountGot, 0))}
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#dc2626',
                      fontSize: '15px',
                      borderBottomRightRadius: '8px'
                    }}
                  >
                    {formatCurrency(customersWithLoans.reduce((sum, row) => sum + row.balance, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
