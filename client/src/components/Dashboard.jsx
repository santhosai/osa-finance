import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AddCustomerModal from './AddCustomerModal';
import PaymentsThisWeekModal from './PaymentsThisWeekModal';
import DatabaseMonitorModal from './DatabaseMonitorModal';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function Dashboard({ navigateTo }) {
  // Theme and Language hooks
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentsThisWeekModal, setShowPaymentsThisWeekModal] = useState(false);
  const [showDatabaseMonitorModal, setShowDatabaseMonitorModal] = useState(false);
  const [showQuickRefModal, setShowQuickRefModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyPaymentsData, setWeeklyPaymentsData] = useState({ paidLoans: [], unpaidLoans: [], loading: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUnpaid, setSelectedUnpaid] = useState(new Set());
  const [quickPayConfirm, setQuickPayConfirm] = useState(null); // { loan, customer, amount, weekNumber }
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [undoPaymentConfirm, setUndoPaymentConfirm] = useState(null); // { loan, customer, paymentId }
  const [weeklyDiagnostic, setWeeklyDiagnostic] = useState(null); // Weekly loans overview
  const [showCharts, setShowCharts] = useState(false); // Toggle charts visibility

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
  const customersLength = customers?.length || 0;
  useEffect(() => {
    if (customersLength === 0) return;

    const fetchWeeklyPayments = async () => {
      setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: true });

      const selected = new Date(selectedDate + 'T00:00:00');
      const isSunday = selected.getDay() === 0;

      if (!isSunday) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }

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

      // Get all loan IDs that need payment check
      const loansToCheck = [];
      if (!Array.isArray(customers)) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }
      customers.forEach(customer => {
        if (!customer.loans || customer.loans.length === 0) return;
        customer.loans.forEach(loan => {
          if (loan.status === 'closed' || loan.loan_type !== 'Weekly' || loan.balance <= 0) return;

          // NEW LOGIC: Week number based on payments made, not calendar weeks
          // paymentsMade = how much collected / weekly amount
          const collected = loan.loan_amount - loan.balance;
          const paymentsMade = Math.floor(collected / loan.weekly_amount);
          const weekNumber = paymentsMade + 1; // Next week to pay

          // Show ALL loans with balance > 0 every Sunday (no more week 10 limit)
          // They owe money, so they should pay!
          loansToCheck.push({ customer, loan, weekNumber });
        });
      });

      if (loansToCheck.length === 0) {
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
        return;
      }

      // Batch fetch: get all payments for this date in one call
      try {
        const paymentsResponse = await fetch(`${API_URL}/payments-by-date?date=${sundayDate}`);
        const paymentsOnDate = paymentsResponse.ok ? await paymentsResponse.json() : [];

        // Create a Set of loan_ids that have payments on this date
        const paidLoanIds = new Set(paymentsOnDate.map(p => p.loan_id));

        const paidLoans = [];
        const unpaidLoans = [];

        loansToCheck.forEach(({ customer, loan, weekNumber }) => {
          const totalWeeks = 10;
          const remainingWeeks = totalWeeks - weekNumber;
          const isPaid = paidLoanIds.has(loan.loan_id);

          const result = {
            customer,
            loan,
            weekNumber,
            totalWeeks,
            remainingWeeks,
            paymentAmount: loan.weekly_amount,
            balance: loan.balance,
            isPaid
          };

          if (isPaid) {
            paidLoans.push(result);
          } else {
            unpaidLoans.push(result);
          }
        });

        setWeeklyPaymentsData({ paidLoans, unpaidLoans, loading: false });
      } catch (error) {
        console.error('Error fetching payments:', error);
        setWeeklyPaymentsData({ paidLoans: [], unpaidLoans: [], loading: false });
      }
    };

    fetchWeeklyPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, customersLength]);

  // Fetch weekly diagnostic data for overview
  useEffect(() => {
    const fetchDiagnostic = async () => {
      try {
        const response = await fetch(`${API_URL}/weekly-diagnostic`);
        if (response.ok) {
          const data = await response.json();
          // Calculate total balance from all loans
          const totalBalance = data.allLoans.reduce((sum, loan) => sum + loan.balance, 0);
          setWeeklyDiagnostic({
            ...data.summary,
            totalBalance,
            allLoans: data.allLoans
          });
        }
      } catch (error) {
        console.error('Error fetching diagnostic:', error);
      }
    };

    fetchDiagnostic();
  }, []); // Run on mount

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

  // Toggle selection of unpaid customer for WhatsApp share
  const toggleUnpaidSelection = (loanId) => {
    setSelectedUnpaid(prev => {
      const newSet = new Set(prev);
      if (newSet.has(loanId)) {
        newSet.delete(loanId);
      } else {
        newSet.add(loanId);
      }
      return newSet;
    });
  };

  // Select/Deselect all unpaid customers
  const toggleSelectAll = (unpaidLoans) => {
    if (selectedUnpaid.size === unpaidLoans.length) {
      setSelectedUnpaid(new Set());
    } else {
      setSelectedUnpaid(new Set(unpaidLoans.map(item => item.loan.loan_id)));
    }
  };

  // Share selected customers via WhatsApp
  const shareViaWhatsApp = (unpaidLoans) => {
    const selectedItems = unpaidLoans.filter(item => selectedUnpaid.has(item.loan.loan_id));
    if (selectedItems.length === 0) {
      alert('Please select at least one customer to share');
      return;
    }

    const dateStr = new Date(selectedDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let message = `📅 *Weekly Collection - ${dateStr}*\n\n`;
    message += `Total: ${selectedItems.length} customers\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    selectedItems.forEach((item, index) => {
      const loanName = item.loan.loan_name && item.loan.loan_name !== 'General Loan'
        ? ` (${item.loan.loan_name})`
        : '';
      message += `${index + 1}. *${item.customer.name}*${loanName}\n`;
      message += `   Week ${item.weekNumber}/10 • ₹${item.paymentAmount.toLocaleString('en-IN')}\n`;
      if (item.customer.phone) {
        message += `   📞 ${item.customer.phone}\n`;
      }
      message += `\n`;
    });

    const totalAmount = selectedItems.reduce((sum, item) => sum + item.paymentAmount, 0);
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Total to Collect: ₹${totalAmount.toLocaleString('en-IN')}*`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  // Quick Pay - record payment with one click
  const handleQuickPay = async () => {
    if (!quickPayConfirm || isPaymentLoading) return;

    setIsPaymentLoading(true);
    const { loan, amount } = quickPayConfirm;

    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loan.loan_id,
          amount: amount,
          payment_date: selectedDate,
          payment_method: 'Cash',
          notes: `Quick payment - Week ${quickPayConfirm.weekNumber}`
        })
      });

      if (response.ok) {
        // Refresh data
        mutate();
        mutateCustomers();
        // Reset state and trigger re-fetch of weekly payments
        setQuickPayConfirm(null);
        // Force refresh weekly payments data
        setWeeklyPaymentsData(prev => ({ ...prev, loading: true }));
      } else {
        const error = await response.json();
        alert('Payment failed: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Quick pay error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Undo Payment - delete the payment and mark as unpaid
  const handleUndoPayment = async () => {
    if (!undoPaymentConfirm || isPaymentLoading) return;

    setIsPaymentLoading(true);

    try {
      // First, get the payment ID for this loan on this date
      const paymentsResponse = await fetch(`${API_URL}/payments-by-date?date=${selectedDate}`);
      const payments = await paymentsResponse.json();
      const payment = payments.find(p => p.loan_id === undoPaymentConfirm.loan.loan_id);

      if (!payment) {
        alert('Payment not found');
        setIsPaymentLoading(false);
        return;
      }

      // Delete the payment
      const response = await fetch(`${API_URL}/payments/${payment.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh data
        mutate();
        mutateCustomers();
        setUndoPaymentConfirm(null);
        // Force refresh weekly payments data
        setWeeklyPaymentsData(prev => ({ ...prev, loading: true }));
      } else {
        const error = await response.json();
        alert('Failed to undo payment: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Undo payment error:', error);
      alert('Failed to undo payment. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
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
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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
            📊 {t('dashboard')}
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
            📅 {t('sundayCollections')}
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
            ⚠️ {t('overduePayments')}
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
            👥 {t('customers')}
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
            📅 {t('paymentTracker')}
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
            📝 {t('vaddiList')}
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
            📅 {t('weeklyFinance')}
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
            💰 {t('monthlyFinance')}
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
            📆 {t('dailyFinance')}
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
            💰 {t('investments')}
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
            📦 {t('archivedLoans')}
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
              👥 {t('userManagement')}
            </button>
          )}

          {/* Admin Profit - Password Protected */}
          <button
            onClick={() => { setShowSidebar(false); navigateTo('admin-profit'); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'background 0.15s',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)'}
            onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'}
          >
            🔐 {t('adminProfit')}
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
          🚪 {t('logout')}
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
            <h2 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: 700 }}>{t('dashboard')}</h2>
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
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>{t('activeLoans')}</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{stats.activeLoans}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                padding: '10px 12px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.2)',
                color: 'white'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: 600 }}>{t('totalOutstanding')}</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>
                  {formatCurrency(stats.outstanding || 0)}
                </div>
                <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '4px' }}>
                  <span>{t('weekly')}: {formatCurrency(stats.weeklyOutstanding || 0)}</span>
                  <span> | {t('monthly')}: {formatCurrency(stats.monthlyOutstanding || 0)}</span>
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
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('collected')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {formatCurrency(vaddiSummary.myProfit || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('myProfit')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fcd34d' }}>
                  {formatCurrency(vaddiSummary.friendShare || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('friend')}</div>
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
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('given')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fee2e2' }}>
                  {formatCurrency(dailySummary.total_outstanding || 0)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('outstanding')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#86efac' }}>
                  {dailySummary.active_loans || 0}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('active')}</div>
              </div>
            </div>
            {dailySummary.today_expected > 0 && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', opacity: 0.9 }}>
                Today: {formatCurrency(dailySummary.today_collected || 0)} / {formatCurrency(dailySummary.today_expected)} collected
              </div>
            )}
          </div>

          {/* Weekly Loans Overview Card */}
          {weeklyDiagnostic && (
            <div style={{
              background: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '10px',
              boxShadow: '0 4px 12px rgba(3, 105, 161, 0.3)',
              color: 'white'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', opacity: 0.95 }}>
                📊 {t('weeklyFinanceOverview')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    {formatCurrency(weeklyDiagnostic.totalLoanAmount)}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{t('totalGiven')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fcd34d' }}>
                    {formatCurrency(weeklyDiagnostic.totalBalance)}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{t('outstanding')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#86efac' }}>
                    {formatCurrency(weeklyDiagnostic.totalLoanAmount - weeklyDiagnostic.totalBalance)}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{t('collected')}</div>
                </div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '6px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px'
              }}>
                <span>
                  <strong>{weeklyDiagnostic.totalWeeklyLoans}</strong> active loans
                </span>
                <span style={{ opacity: 0.9 }}>
                  Weekly total: <strong>{formatCurrency(weeklyDiagnostic.totalWeeklyAmount)}</strong>/week
                </span>
              </div>
              {!weeklyPaymentsData.loading && (weeklyPaymentsData.paidLoans.length > 0 || weeklyPaymentsData.unpaidLoans.length > 0) && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  fontSize: '10px',
                  textAlign: 'center'
                }}>
                  📅 This Sunday: <strong>{weeklyPaymentsData.paidLoans.length + weeklyPaymentsData.unpaidLoans.length}</strong> of {weeklyDiagnostic.totalWeeklyLoans} loans due
                </div>
              )}
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
                📅 {t('weeklyPayments')}
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
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('collected')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>
                        {formatCurrency(unpaidTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('pending')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>
                        {formatCurrency(grandTotal)}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>{t('totalDue')}</div>
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
                      ✓ {t('paid').toUpperCase()} ({paidLoans.length})
                    </h4>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {paidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          style={{
                            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #6ee7b7',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                          }}
                        >
                          {/* Customer Info */}
                          <div
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => navigateTo('loan-details', loan.loan_id)}
                            onMouseOver={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1.02)';
                              e.currentTarget.parentElement.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1)';
                              e.currentTarget.parentElement.style.boxShadow = 'none';
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

                          {/* Undo Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoPaymentConfirm({ loan, customer, amount: paymentAmount, weekNumber });
                            }}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              borderRadius: '4px',
                              padding: '4px 6px',
                              cursor: 'pointer',
                              fontSize: '9px',
                              color: '#dc2626',
                              fontWeight: 600,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '1px'
                            }}
                            title="Undo this payment"
                          >
                            ↩️
                            <span>Undo</span>
                          </button>
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
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#991b1b'
                      }}>
                        ✗ {t('unpaid').toUpperCase()} ({unpaidLoans.length})
                      </h4>
                      {unpaidLoans.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            color: '#991b1b',
                            cursor: 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedUnpaid.size === unpaidLoans.length && unpaidLoans.length > 0}
                              onChange={() => toggleSelectAll(unpaidLoans)}
                              style={{ cursor: 'pointer' }}
                            />
                            All
                          </label>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Share Button */}
                    {selectedUnpaid.size > 0 && (
                      <button
                        onClick={() => shareViaWhatsApp(unpaidLoans)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)'
                        }}
                      >
                        📱 Share {selectedUnpaid.size} via WhatsApp
                      </button>
                    )}

                    <div style={{ display: 'grid', gap: '4px' }}>
                      {unpaidLoans.map(({ customer, loan, paymentAmount, weekNumber, totalWeeks, remainingWeeks, balance }) => (
                        <div
                          key={loan.loan_id}
                          style={{
                            background: getUnpaidCardColor(balance),
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: selectedUnpaid.has(loan.loan_id)
                              ? '2px solid #25D366'
                              : balance > 10000
                                ? '1px solid #fca5a5'
                                : balance > 5000
                                  ? '1px solid #fb923c'
                                  : '1px solid #fecaca',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px'
                          }}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedUnpaid.has(loan.loan_id)}
                            onChange={() => toggleUnpaidSelection(loan.loan_id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              cursor: 'pointer',
                              marginTop: '2px',
                              width: '16px',
                              height: '16px',
                              accentColor: '#25D366'
                            }}
                          />

                          {/* Customer Info */}
                          <div
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => navigateTo('loan-details', loan.loan_id)}
                            onMouseOver={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1.02)';
                              e.currentTarget.parentElement.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.parentElement.style.transform = 'scale(1)';
                              e.currentTarget.parentElement.style.boxShadow = 'none';
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

                          {/* Quick Pay Checkbox */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <input
                              type="checkbox"
                              onChange={() => setQuickPayConfirm({ loan, customer, amount: paymentAmount, weekNumber })}
                              checked={false}
                              style={{
                                cursor: 'pointer',
                                width: '18px',
                                height: '18px',
                                accentColor: '#10b981'
                              }}
                            />
                            <span style={{ fontSize: '8px', color: '#059669', fontWeight: 600 }}>Paid</span>
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

          {/* Charts Section */}
          <div style={{
            background: isDarkMode ? theme.backgroundCard : 'white',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '10px',
            boxShadow: isDarkMode ? theme.shadow : '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <div
              onClick={() => setShowCharts(!showCharts)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                marginBottom: showCharts ? '16px' : 0
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: isDarkMode ? theme.text : '#1e293b' }}>
                {language === 'ta' ? '📊 கடன் விநியோகம்' : '📊 Loan Distribution Chart'}
              </h3>
              <span style={{ fontSize: '16px', transition: 'transform 0.3s', transform: showCharts ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                {showCharts ? '▲' : '▼'}
              </span>
            </div>

            {showCharts && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Pie Chart - Loan Distribution */}
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: language === 'ta' ? 'வாராந்திர' : 'Weekly', value: stats?.total_loan_amount || 0 },
                          { name: language === 'ta' ? 'தினசரி' : 'Daily', value: dailySummary?.total_given || 0 },
                          { name: language === 'ta' ? 'வட்டி' : 'Vaddi', value: vaddiSummary?.totalAmount || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#22c55e" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart - Collections vs Outstanding */}
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: language === 'ta' ? 'வாராந்திர' : 'Weekly',
                          collected: (stats?.total_loan_amount || 0) - (stats?.total_balance || 0),
                          balance: stats?.total_balance || 0
                        },
                        {
                          name: language === 'ta' ? 'தினசரி' : 'Daily',
                          collected: (dailySummary?.total_given || 0) - (dailySummary?.total_outstanding || 0),
                          balance: dailySummary?.total_outstanding || 0
                        }
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                    >
                      <XAxis dataKey="name" tick={{ fill: isDarkMode ? theme.text : '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: isDarkMode ? theme.text : '#64748b', fontSize: 9 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="collected" name={language === 'ta' ? 'வசூல்' : 'Collected'} fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="balance" name={language === 'ta' ? 'நிலுவை' : 'Balance'} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Spacer for bottom bar */}
          <div style={{ height: '70px' }} />

        </div>
      </div>

      {/* Bottom Settings Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        zIndex: 100
      }}>
        {/* Dark Mode Toggle */}
        <div
          onClick={toggleDarkMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            transition: 'all 0.3s'
          }}
        >
          <span style={{ fontSize: '18px' }}>{isDarkMode ? '☀️' : '🌙'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? theme.text : '#374151' }}>
            {isDarkMode ? t('light') : t('dark')}
          </span>
        </div>

        {/* Language Toggle */}
        <div
          onClick={toggleLanguage}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            transition: 'all 0.3s'
          }}
        >
          <span style={{ fontSize: '18px' }}>🌐</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? theme.text : '#374151' }}>
            {language === 'en' ? 'தமிழ்' : 'English'}
          </span>
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

      {/* Quick Pay Confirmation Modal */}
      {quickPayConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setQuickPayConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Confirm Payment
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#065f46', marginBottom: '8px' }}>
                {quickPayConfirm.customer.name}
              </div>
              {quickPayConfirm.loan.loan_name && quickPayConfirm.loan.loan_name !== 'General Loan' && (
                <div style={{ fontSize: '12px', color: '#047857', marginBottom: '4px' }}>
                  {quickPayConfirm.loan.loan_name}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px' }}>
                Week {quickPayConfirm.weekNumber}/10
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#059669',
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px'
              }}>
                {formatCurrency(quickPayConfirm.amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '8px' }}>
                Payment Date: {new Date(selectedDate).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setQuickPayConfirm(null)}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  opacity: isPaymentLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleQuickPay}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isPaymentLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isPaymentLoading ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPaymentLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Paying...
                  </>
                ) : (
                  '✓ Confirm Paid'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Payment Confirmation Modal */}
      {undoPaymentConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setUndoPaymentConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
                Undo Payment?
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#7f1d1d', marginBottom: '8px' }}>
                {undoPaymentConfirm.customer.name}
              </div>
              {undoPaymentConfirm.loan.loan_name && undoPaymentConfirm.loan.loan_name !== 'General Loan' && (
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
                  {undoPaymentConfirm.loan.loan_name}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>
                Week {undoPaymentConfirm.weekNumber}/10
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#dc2626',
                textAlign: 'center',
                padding: '8px',
                background: 'white',
                borderRadius: '8px'
              }}>
                {formatCurrency(undoPaymentConfirm.amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', textAlign: 'center', marginTop: '8px' }}>
                This will delete the payment and mark as unpaid
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setUndoPaymentConfirm(null)}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  opacity: isPaymentLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUndoPayment}
                disabled={isPaymentLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isPaymentLoading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isPaymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isPaymentLoading ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPaymentLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Undoing...
                  </>
                ) : (
                  '↩️ Undo Payment'
                )}
              </button>
            </div>
          </div>
        </div>
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
