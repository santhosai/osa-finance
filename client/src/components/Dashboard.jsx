import { useState, useEffect } from 'react';
import AddCustomerModal from './AddCustomerModal';
import PaymentsThisWeekModal from './PaymentsThisWeekModal';
import { API_URL } from '../config';

function Dashboard({ navigateTo }) {
  const [stats, setStats] = useState(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentsThisWeekModal, setShowPaymentsThisWeekModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [monthlyFinanceBalance, setMonthlyFinanceBalance] = useState(0);

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
    calculateMonthlyFinanceBalance();

    // Auto-refresh stats every 5 seconds when on dashboard
    const interval = setInterval(() => {
      fetchStats();
      calculateMonthlyFinanceBalance();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
            onClick={() => { setShowSidebar(false); navigateTo('sunday-collections'); }}
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
            📅 Sunday Collections
          </button>

          <button
            onClick={() => { setShowSidebar(false); navigateTo('overdue-payments'); }}
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
            ⚠️ Overdue Payments
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

              <div
                onClick={() => setShowPaymentsThisWeekModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(4, 120, 87, 0.35)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 120, 87, 0.25)';
                }}
              >
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
                  Payments This Week
                  <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.8 }}>👆 Click to view</span>
                </div>
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

      {showPaymentsThisWeekModal && (
        <PaymentsThisWeekModal
          onClose={() => setShowPaymentsThisWeekModal(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
