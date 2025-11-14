import { useState, useEffect } from 'react';
import AddCustomerModal from './AddCustomerModal';
import { API_URL } from '../config';

function Dashboard({ navigateTo }) {
  const [stats, setStats] = useState(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    fetchStats();

    // Auto-refresh stats every 5 seconds when on dashboard
    const interval = setInterval(() => {
      fetchStats();
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: showSidebar ? '0' : '-250px',
          top: 0,
          width: '250px',
          height: '100vh',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          transition: 'left 0.3s ease',
          zIndex: 1000,
          boxShadow: '2px 0 10px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
          <h3 style={{ color: '#ff6b35', margin: 0, fontSize: '20px', fontWeight: 700 }}>OM SAI MURUGAN</h3>
          <p style={{ color: '#94a3b8', margin: '5px 0 0', fontSize: '12px' }}>FINANCE</p>
        </div>

        <div style={{ padding: '10px 0' }}>
          <button
            onClick={() => { setShowSidebar(false); }}
            style={{
              width: '100%',
              padding: '15px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#5568d3'}
            onMouseOut={(e) => e.target.style.background = '#667eea'}
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
      <div style={{ flex: 1, padding: '0' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '24px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ☰
            </button>
            <h2 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: 700 }}>Dashboard</h2>
          </div>

          <button
            onClick={handleRefresh}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ padding: '24px' }}>
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
                color: 'white'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: 600 }}>Active Loans</div>
                <div style={{ fontSize: '36px', fontWeight: 700 }}>{stats.activeLoans}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(245, 158, 11, 0.3)',
                color: 'white'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: 600 }}>Outstanding</div>
                <div style={{ fontSize: '36px', fontWeight: 700 }}>{formatCurrency(stats.outstanding)}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)',
                color: 'white'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: 600 }}>Payments This Week</div>
                <div style={{ fontSize: '36px', fontWeight: 700 }}>{stats.paymentsThisWeek}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(236, 72, 153, 0.3)',
                color: 'white'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: 600 }}>Total Customers</div>
                <div style={{ fontSize: '36px', fontWeight: 700 }}>{stats.totalCustomers}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
                color: 'white'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: 600 }}>💳 Online Collection</div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{formatCurrency(stats.onlineCollection || 0)}</div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                padding: '24px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(20, 184, 166, 0.3)',
                color: 'white'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: 600 }}>💰 Offline Collection</div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{formatCurrency(stats.offlineCollection || 0)}</div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowAddCustomerModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                }}
              >
                ➕ Add New Customer
              </button>

              <button
                onClick={() => navigateTo('customers')}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                }}
              >
                👥 View All Customers
              </button>
            </div>
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
    </div>
  );
}

export default Dashboard;
