import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import useSWR from 'swr';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function ExcelPaymentTracker({ navigateTo }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [loanType, setLoanType] = useState('All'); // 'All', 'Weekly', or 'Monthly'
  const [gridData, setGridData] = useState({ rows: [], dates: [] });
  const [loading, setLoading] = useState(true);

  // Fetch all customers with loans
  const { data: customers, error, isLoading } = useSWR(`${API_URL}/customers`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  // Process data for grid display
  useEffect(() => {
    if (!customers) return;

    const processData = async () => {
      setLoading(true);
      const rows = [];
      const allDates = new Set();

      // Fetch loan details for all matching loans
      const loanPromises = [];

      customers.forEach(customer => {
        if (customer.loans && customer.loans.length > 0) {
          customer.loans.forEach((loan) => {
            // Filter logic (strict separation - no duplicates):
            // 'All': Show everything
            // 'Weekly': Show Weekly OR old loans without type (old loans default to Weekly)
            // 'Monthly': Show ONLY Monthly (strict - no old loans)
            const matchesType = loanType === 'All' ? true :
                                loanType === 'Weekly' ? (!loan.loan_type || loan.loan_type === 'Weekly') :
                                loanType === 'Monthly' ? (loan.loan_type === 'Monthly') : false;
            const isActive = loan.balance > 0; // Show loans with remaining balance

            if (matchesType && isActive) {
              loanPromises.push(
                fetch(`${API_URL}/loans/${loan.loan_id}`)
                  .then(res => res.json())
                  .then(loanDetails => ({
                    customerName: customer.name,
                    friendName: loan.loan_name || '',
                    loanDetails
                  }))
              );
            }
          });
        }
      });

      const loansData = await Promise.all(loanPromises);

      loansData.forEach(({ customerName, friendName, loanDetails }) => {
        const paymentsByDate = {};

        if (loanDetails.payments) {
          loanDetails.payments.forEach(payment => {
            const date = new Date(payment.payment_date).toLocaleDateString('en-IN');
            allDates.add(date);
            paymentsByDate[date] = (paymentsByDate[date] || 0) + payment.amount;
          });
        }

        // Use LOAN's actual type, not filter selection!
        const loanActualType = loanDetails.loan_type || 'Weekly'; // Default to Weekly if not set
        const totalPeriods = loanActualType === 'Monthly' ? 5 : 10;
        const periodsPaid = loanDetails.payments ? loanDetails.payments.length : 0;

        rows.push({
          customerName,
          friendName,
          loanType: loanActualType, // Store actual loan type
          totalPeriods,
          periodsPaid,
          loanAmount: loanDetails.loan_amount,
          paymentsByDate,
          totalPaid: loanDetails.loan_amount - loanDetails.balance
        });
      });

      const sortedDates = Array.from(allDates).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/');
        const [dayB, monthB, yearB] = b.split('/');
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
      });

      setGridData({ rows, dates: sortedDates });
      setLoading(false);
    };

    processData();
  }, [customers, loanType]);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  const downloadExcel = () => {
    const { rows, dates } = gridData;

    // Create worksheet data
    const wsData = [];

    // Header row
    const headers = ['Date', 'Customer Name', 'Friend/Loan Name', 'Type', 'Periods', ...dates, 'Total Paid'];
    wsData.push(headers);

    // Data rows
    rows.forEach(row => {
      const rowData = [
        new Date().toLocaleDateString('en-IN'),
        row.customerName,
        row.friendName,
        row.loanType === 'Monthly' ? 'Monthly' : 'Weekly',
        `${row.periodsPaid}/${row.totalPeriods}`,
        ...dates.map(date => row.paymentsByDate[date] || 0),
        row.totalPaid
      ];
      wsData.push(rowData);
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 20 }, // Customer Name
      { wch: 15 }, // Friend Name
      { wch: 10 }, // Type
      { wch: 10 }, // Periods
      ...dates.map(() => ({ wch: 12 })), // Payment columns
      { wch: 15 } // Total Paid
    ];

    XLSX.utils.book_append_sheet(wb, ws, `${loanType} Tracker`);

    // Download
    const fileName = `${loanType}_Payment_Tracker_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
            onClick={() => { setShowSidebar(false); navigateTo('dashboard'); }}
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
            📊 Payment Tracker
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
            <h2 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: 700 }}>Excel Payment Tracker</h2>
          </div>

          <button
            onClick={downloadExcel}
            style={{
              background: '#047857',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📥 Download XLSX
          </button>
        </div>

        {/* Loan Type Selector */}
        <div style={{ padding: '12px', background: '#1e293b' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setLoanType('All')}
              style={{
                flex: 1,
                padding: '8px',
                background: loanType === 'All' ? '#10b981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📊 All Loans
            </button>
            <button
              onClick={() => setLoanType('Weekly')}
              style={{
                flex: 1,
                padding: '8px',
                background: loanType === 'Weekly' ? '#3b82f6' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📅 Weekly
            </button>
            <button
              onClick={() => setLoanType('Monthly')}
              style={{
                flex: 1,
                padding: '8px',
                background: loanType === 'Monthly' ? '#8b5cf6' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              💰 Monthly
            </button>
          </div>
        </div>

        {/* Payment Grid */}
        <div style={{ padding: '12px', overflowX: 'auto' }}>
          {(isLoading || loading) ? (
            <div style={{ color: 'white', textAlign: 'center', padding: '40px' }}>Loading...</div>
          ) : gridData.rows.length === 0 ? (
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              No {loanType.toLowerCase()} loans found. Add some loans to see the payment tracker!
            </div>
          ) : (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px'
                }}>
                  <thead>
                    <tr style={{ background: '#1e40af', color: 'white' }}>
                      <th style={{ padding: '10px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid #fff3' }}>Date</th>
                      <th style={{ padding: '10px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid #fff3' }}>Customer Name</th>
                      <th style={{ padding: '10px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid #fff3' }}>Friend/Loan Name</th>
                      <th style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid #fff3' }}>Type</th>
                      <th style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid #fff3' }}>Periods</th>
                      {gridData.dates.map((date, idx) => (
                        <th key={idx} style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap', borderRight: '1px solid #fff3' }}>{date}</th>
                      ))}
                      <th style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap', background: '#b45309' }}>Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          background: idx % 2 === 0 ? '#f9fafb' : '#fff',
                          borderBottom: '1px solid #e5e7eb'
                        }}
                      >
                        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {new Date().toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {row.customerName}
                        </td>
                        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {row.friendName || '-'}
                        </td>
                        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, color: row.loanType === 'Monthly' ? '#8b5cf6' : '#3b82f6' }}>
                          {row.loanType === 'Monthly' ? '💰 Monthly' : '📅 Weekly'}
                        </td>
                        <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600 }}>
                          {row.periodsPaid}/{row.totalPeriods}
                        </td>
                        {gridData.dates.map((date, dateIdx) => {
                          const amount = row.paymentsByDate[date] || 0;
                          return (
                            <td
                              key={dateIdx}
                              style={{
                                padding: '8px',
                                borderRight: '1px solid #e5e7eb',
                                textAlign: 'right',
                                background: amount > 0 ? '#d1fae5' : 'transparent',
                                fontWeight: amount > 0 ? 600 : 400,
                                color: amount > 0 ? '#065f46' : '#9ca3af',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}
                        <td style={{
                          padding: '8px',
                          textAlign: 'right',
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#92400e',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatCurrency(row.totalPaid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                padding: '12px',
                background: '#f9fafb',
                borderTop: '2px solid #e5e7eb',
                fontSize: '11px',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                📊 {gridData.rows.length} {loanType.toLowerCase()} loan{gridData.rows.length !== 1 ? 's' : ''} • Click "Download XLSX" to export to Excel
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExcelPaymentTracker;
