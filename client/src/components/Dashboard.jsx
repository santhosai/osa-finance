import { useState, useEffect } from 'react';
import AddCustomerModal from './AddCustomerModal';
import AddPaymentModal from './AddPaymentModal';
import { API_URL } from '../config';

function Dashboard({ navigateTo }) {
  const [stats, setStats] = useState(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedSunday, setSelectedSunday] = useState(getNextSunday());
  const [sundayCustomers, setSundayCustomers] = useState([]);
  const [monthlyFinanceBalance, setMonthlyFinanceBalance] = useState(0);
  const [loadingSundayCustomers, setLoadingSundayCustomers] = useState(false);

  // Helper function to get next Sunday
  function getNextSunday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday.toISOString().split('T')[0];
  }

  const calculateMonthlyFinanceBalance = () => {
    try {
      const monthlyFinanceData = localStorage.getItem('monthlyFinanceCustomers');
      if (monthlyFinanceData) {
        const customers = JSON.parse(monthlyFinanceData);
        const totalBalance = customers.reduce((sum, customer) => sum + (customer.balance || 0), 0);
        setMonthlyFinanceBalance(totalBalance);
      } else {
        setMonthlyFinanceBalance(0);
      }
    } catch (error) {
      console.error('Error calculating monthly finance balance:', error);
      setMonthlyFinanceBalance(0);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSundayCustomers();
    calculateMonthlyFinanceBalance();

    // Auto-refresh stats every 5 seconds when on dashboard
    const interval = setInterval(() => {
      fetchStats();
      calculateMonthlyFinanceBalance();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchSundayCustomers();
  }, [selectedSunday]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleRefresh = () => {
    fetchStats();
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  const handlePayNow = async (customer) => {
    try {
      // Fetch full loan details first
      const response = await fetch(`${API_URL}/loans/${customer.loanId}`);
      const loanData = await response.json();
      setSelectedCustomerForPayment(loanData);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error fetching loan details:', error);
      alert('Failed to load payment form. Please try again.');
    }
  };

  const fetchSundayCustomers = async () => {
    setLoadingSundayCustomers(true);
    try {
      const response = await fetch(`${API_URL}/customers`);
      const allCustomers = await response.json();

      // Filter customers with active loans
      const customersWithLoans = allCustomers.filter(c => c.loan_id && c.balance > 0);

      // Get payment details for each customer
      const customerPromises = customersWithLoans.map(async (customer) => {
        const loanResponse = await fetch(`${API_URL}/loans/${customer.loan_id}`);
        const loanData = await loanResponse.json();

        // Check if customer has already paid on the selected Sunday
        const paidOnSelectedSunday = loanData.payments?.some(
          payment => payment.payment_date === selectedSunday
        );

        // Calculate which week number this would be
        const startDate = new Date(loanData.start_date);
        const selectedDate = new Date(selectedSunday);
        const weeksDiff = Math.floor((selectedDate - startDate) / (7 * 24 * 60 * 60 * 1000));

        // Include if within 10 weeks (both paid and unpaid)
        if (weeksDiff >= 0 && weeksDiff < 10) {
          return {
            name: customer.name,
            phone: customer.phone,
            weeklyAmount: customer.weekly_amount,
            weekNumber: weeksDiff + 1,
            isPaid: paidOnSelectedSunday,
            loanId: customer.loan_id,
            customerId: customer.id
          };
        }
        return null;
      });

      const results = await Promise.all(customerPromises);
      const dueCustomers = results.filter(c => c !== null);
      setSundayCustomers(dueCustomers);
    } catch (error) {
      console.error('Error fetching Sunday customers:', error);
    } finally {
      setLoadingSundayCustomers(false);
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

    const totalExpected = sundayCustomers.reduce((sum, c) => sum + c.weeklyAmount, 0);

    let content = `Om Sai Ayyanar Finance - SSS Brothers\n`;
    content += `Collections Due: ${formattedDate}\n`;
    content += `${'━'.repeat(60)}\n\n`;

    sundayCustomers.forEach((customer, index) => {
      const amount = `₹${customer.weeklyAmount.toLocaleString('en-IN')}`;
      content += `${(index + 1).toString().padStart(2, ' ')}. ${customer.name.padEnd(20, ' ')} - ${amount}\n`;
    });

    content += `\n${'━'.repeat(60)}\n`;
    content += `Total: ${sundayCustomers.length} customers\n`;
    content += `Expected Collection: ₹${totalExpected.toLocaleString('en-IN')}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Collections_${selectedSunday}.txt`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllData = async () => {
    try {
      const response = await fetch(`${API_URL}/customers`);
      const customers = await response.json();

      const customerPromises = customers.map(async (customer) => {
        if (customer.loan_id) {
          const loanResponse = await fetch(`${API_URL}/loans/${customer.loan_id}`);
          const loanData = await loanResponse.json();
          return { ...customer, loanDetails: loanData };
        }
        return customer;
      });

      const customersWithDetails = await Promise.all(customerPromises);
      const csvHeader = 'Customer Name,Phone,Loan Amount,Balance,Weekly Payment,Status,Total Paid,Progress %,Start Date,Last Payment Date,Weeks Remaining,Expected Completion Date\n';

      const csvRows = customersWithDetails.map(customer => {
        if (customer.loan_id) {
          const totalPaid = customer.loan_amount - customer.balance;
          const progress = ((totalPaid / customer.loan_amount) * 100).toFixed(1);
          const lastPayment = customer.last_payment_date || 'No payments';
          const weeksRemaining = customer.loanDetails?.weeksRemaining || 0;
          const startDate = customer.loanDetails?.start_date || '';
          const expectedDate = startDate ? new Date(startDate) : null;
          if (expectedDate) {
            expectedDate.setDate(expectedDate.getDate() + (customer.loanDetails?.totalWeeks * 7));
          }
          const expectedCompletion = expectedDate ? expectedDate.toISOString().split('T')[0] : '-';
          return `${customer.name},${customer.phone},${customer.loan_amount},${customer.balance},${customer.weekly_amount},${customer.status},${totalPaid},${progress}%,${startDate},${lastPayment},${weeksRemaining},${expectedCompletion}`;
        } else {
          return `${customer.name},${customer.phone},No Active Loan,-,-,-,-,-,-,-,-,-`;
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
        <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
          <h3 style={{ color: '#d97706', margin: 0, fontSize: '20px', fontWeight: 700 }}>OM SAI MURUGAN</h3>
          <p style={{ color: '#94a3b8', margin: '5px 0 0', fontSize: '12px' }}>FINANCE</p>
        </div>

        <div style={{ padding: '10px 0' }}>
          <button
            onClick={() => { setShowSidebar(false); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: '#1e40af',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#1e3a8a'}
            onMouseOut={(e) => e.target.style.background = '#1e40af'}
          >
            📊 Dashboard
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('customers'); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            👥 Customers
          </button>

          <button
            onClick={() => { setShowSidebar(false); setShowAddCustomerModal(true); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            ➕ Add Customer
          </button>

          <button
            onClick={() => { setShowSidebar(false); downloadAllData(); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📥 Export Data
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('payment-tracker'); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
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
              padding: '15px 20px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#334155'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            📝 Vaddi List
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('monthly-finance'); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: 'transparent',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
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
            bottom: '20px',
            left: '20px',
            right: '20px',
            padding: '12px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
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
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '24px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ☰
            </button>
            <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Dashboard</h2>
          </div>

          <button
            onClick={handleRefresh}
            style={{
              background: '#047857',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔄
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ padding: '16px' }}>
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(30, 64, 175, 0.25)',
                color: 'white'
              }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>Active Loans</div>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.activeLoans}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(180, 83, 9, 0.25)',
                color: 'white'
              }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>Total Outstanding</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                  {formatCurrency((stats.outstanding || 0) + monthlyFinanceBalance)}
                </div>
                <div style={{
                  fontSize: '11px',
                  opacity: 0.85,
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  paddingTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Weekly Finance:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(stats.outstanding || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Monthly Finance:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(monthlyFinanceBalance)}</span>
                  </div>
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
                color: 'white'
              }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>Payments This Week</div>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.paymentsThisWeek}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(71, 85, 105, 0.25)',
                color: 'white'
              }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>Total Customers</div>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.totalCustomers}</div>
              </div>
            </div>
          )}

          {/* Sunday Collections Section */}
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Sunday Collections</h3>
              <button
                onClick={downloadSundayCollection}
                disabled={sundayCustomers.length === 0}
                style={{
                  background: sundayCustomers.length === 0 ? '#9ca3af' : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: sundayCustomers.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: sundayCustomers.length === 0 ? 'none' : '0 2px 8px rgba(30, 64, 175, 0.3)'
                }}
              >
                📥 Download
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                Select Sunday
              </label>
              <input
                type="date"
                value={selectedSunday}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (date.getDay() === 0) {
                    setSelectedSunday(e.target.value);
                  } else {
                    alert('Please select a Sunday');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              background: '#f3f4f6',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>Total Customers:</span>
                <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '14px' }}>{sundayCustomers.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: '#047857', fontSize: '14px' }}>✓ Paid:</span>
                <span style={{ fontWeight: 700, color: '#047857', fontSize: '14px' }}>
                  {sundayCustomers.filter(c => c.isPaid).length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '14px' }}>✗ Unpaid:</span>
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '14px' }}>
                  {sundayCustomers.filter(c => !c.isPaid).length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #d1d5db' }}>
                <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>Expected Collection:</span>
                <span style={{ fontWeight: 700, color: '#047857', fontSize: '14px' }}>
                  ₹{sundayCustomers.filter(c => !c.isPaid).reduce((sum, c) => sum + c.weeklyAmount, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {loadingSundayCustomers ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6b7280'
              }}>
                <div style={{
                  fontSize: '36px',
                  marginBottom: '12px',
                  animation: 'spin 1s linear infinite'
                }}>⏳</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading customers...</div>
                <style>{`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : sundayCustomers.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {sundayCustomers.map((customer, index) => (
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
                        {index + 1}. {customer.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: 500
                      }}>
                        📱 {customer.phone} • Week {customer.weekNumber}/10
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
              </div>
            ) : (
              <div style={{
                background: '#f3f4f6',
                padding: '24px',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                No customers have payments due on this Sunday
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={() => {
            setShowAddCustomerModal(false);
            fetchStats();
          }}
        />
      )}

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
            fetchStats();
            fetchSundayCustomers();
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
