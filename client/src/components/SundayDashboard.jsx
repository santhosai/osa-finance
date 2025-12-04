import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import {
  getThisSunday,
  getLastSunday,
  getNextSunday,
  getPreviousSunday,
  formatSundayDisplay,
  formatDateForAPI,
  getUpcomingSundays,
  getRelativeSundayLabel,
  isToday
} from '../utils/sundayHelpers';
import * as XLSX from 'xlsx';

function SundayDashboard({ navigateTo }) {
  const [selectedSunday, setSelectedSunday] = useState(formatDateForAPI(getThisSunday()));
  const [sundayData, setSundayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    fetchSundayData();
  }, [selectedSunday]);

  const fetchSundayData = async () => {
    setLoading(true);
    try {
      // Fetch data for selected Sunday
      const response = await fetch(`${API_URL}/sunday-data?date=${selectedSunday}`);
      const data = await response.json();
      setSundayData(data);
    } catch (error) {
      console.error('Error fetching Sunday data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const date = new Date(e.target.value);
    if (date.getDay() !== 0) {
      alert('Please select a Sunday!');
      return;
    }
    setSelectedSunday(e.target.value);
  };

  const navigateToSunday = (direction) => {
    const currentDate = new Date(selectedSunday);
    if (direction === 'prev') {
      const prevSunday = getPreviousSunday(currentDate);
      setSelectedSunday(formatDateForAPI(prevSunday));
    } else {
      const nextSunday = getNextSunday(currentDate);
      setSelectedSunday(formatDateForAPI(nextSunday));
    }
  };

  const jumpToSunday = (type) => {
    let targetSunday;
    if (type === 'last') {
      targetSunday = getLastSunday();
    } else if (type === 'this') {
      targetSunday = getThisSunday();
    } else if (type === 'next') {
      targetSunday = getNextSunday(new Date());
    }
    setSelectedSunday(formatDateForAPI(targetSunday));
  };

  const downloadTXT = () => {
    if (!sundayData || !sundayData.customers) return;

    let content = `Payment Collection - ${formatSundayDisplay(selectedSunday)}\n`;
    content += `=`.repeat(50) + '\n\n';

    sundayData.customers.forEach((customer, index) => {
      content += `${index + 1}. ${customer.name} - ₹${customer.weeklyAmount.toLocaleString('en-IN')}`;
      content += customer.paidOnDate ? ' ✓ PAID' : ' ✗ PENDING';
      content += `\n`;
    });

    content += `\n` + `=`.repeat(50) + '\n';
    content += `Total Customers: ${sundayData.customers.length}\n`;
    content += `Paid: ${sundayData.paidCount}\n`;
    content += `Pending: ${sundayData.unpaidCount}\n`;
    content += `Expected Collection: ₹${sundayData.expectedCollection.toLocaleString('en-IN')}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Collection_${selectedSunday}.txt`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadXLSX = () => {
    if (!sundayData || !sundayData.customers) return;

    const worksheetData = [
      ['Payment Collection Report'],
      [`Date: ${formatSundayDisplay(selectedSunday)}`],
      [],
      ['Customer Name', 'Phone', 'Week Number', 'Weekly Amount', 'Balance', 'Status', 'Paid Amount']
    ];

    sundayData.customers.forEach(customer => {
      worksheetData.push([
        customer.name,
        customer.phone,
        `Week ${customer.weekNumber}/${customer.totalWeeks}`,
        customer.weeklyAmount,
        customer.balance,
        customer.paidOnDate ? 'PAID' : 'PENDING',
        customer.paidAmount || 0
      ]);
    });

    worksheetData.push([]);
    worksheetData.push(['Summary']);
    worksheetData.push(['Total Customers', sundayData.customers.length]);
    worksheetData.push(['Paid', sundayData.paidCount]);
    worksheetData.push(['Pending', sundayData.unpaidCount]);
    worksheetData.push(['Expected Collection', sundayData.expectedCollection]);
    worksheetData.push(['Actual Collection', sundayData.actualCollection]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Collection');

    XLSX.writeFile(workbook, `Collection_${selectedSunday}.xlsx`);
  };

  const markAsPaid = async (customerId, loanId, weeklyAmount) => {
    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loan_id: loanId,
          amount: weeklyAmount,
          payment_date: selectedSunday,
          collected_by: localStorage.getItem('userId') || '',
          collected_by_name: localStorage.getItem('userName') || ''
        })
      });

      if (response.ok) {
        fetchSundayData(); // Refresh data
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  };

  const sendWhatsAppReminder = (customer) => {
    const message = `Reminder: Payment Due\n\nHello ${customer.name},\n\nYour weekly payment of ₹${customer.weeklyAmount.toLocaleString('en-IN')} is due this Sunday (${formatSundayDisplay(selectedSunday)}).\n\nWeek ${customer.weekNumber}/${customer.totalWeeks}\nRemaining Balance: ₹${customer.balance.toLocaleString('en-IN')}\n\nThank you!`;

    const phoneNumber = customer.phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const upcomingSundays = getUpcomingSundays(4);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Sidebar */}
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
            📅 Sunday Collections
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
            👥 All Customers
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
            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>Sunday Collections</h2>
          </div>

          <button
            onClick={fetchSundayData}
            style={{
              background: '#10b981',
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

        <div style={{ padding: '16px' }}>
          {/* Sunday Selector */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
              Select Sunday
            </h3>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => jumpToSunday('last')}
                style={{
                  padding: '10px 16px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Last Sunday
              </button>
              <button
                onClick={() => jumpToSunday('this')}
                style={{
                  padding: '10px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                This Sunday
              </button>
              <button
                onClick={() => jumpToSunday('next')}
                style={{
                  padding: '10px 16px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Next Sunday
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => navigateToSunday('prev')}
                style={{
                  padding: '10px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ◀
              </button>

              <input
                type="date"
                value={selectedSunday}
                onChange={handleDateChange}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  fontSize: '16px',
                  fontWeight: 600
                }}
              />

              <button
                onClick={() => navigateToSunday('next')}
                style={{
                  padding: '10px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ▶
              </button>
            </div>

            <div style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
              {getRelativeSundayLabel(selectedSunday)}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'white', fontSize: '18px' }}>
              Loading...
            </div>
          ) : sundayData ? (
            <>
              {/* Key Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
                    Customers Due
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{sundayData.customersDue || 0}</div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
                    Expected Collection
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>
                    {formatCurrency(sundayData.expectedCollection || 0)}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
                    Paid / Pending
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>
                    {sundayData.paidCount || 0} / {sundayData.unpaidCount || 0}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
                    Overall Outstanding
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>
                    {formatCurrency(sundayData.overallOutstanding || 0)}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
                  color: 'white'
                }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
                    Active Loans
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{sundayData.activeLoans || 0}</div>
                </div>
              </div>

              {/* Download Buttons */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                display: 'flex',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <button
                  onClick={downloadTXT}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  📄 Download TXT
                </button>
                <button
                  onClick={downloadXLSX}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  📊 Download Excel
                </button>
              </div>

              {/* Upcoming Sundays */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                  Upcoming Sundays
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {upcomingSundays.map((sunday, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedSunday(formatDateForAPI(sunday))}
                      style={{
                        padding: '16px',
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        border: '2px solid transparent'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = '#667eea';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                        {formatSundayDisplay(sunday)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Click to view
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment List */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                  Payments for {formatSundayDisplay(selectedSunday)}
                </h3>

                {sundayData.customers && sundayData.customers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sundayData.customers.map((customer) => (
                      <div
                        key={customer.id}
                        style={{
                          padding: '16px',
                          background: customer.paidOnDate ? '#d1fae5' : '#fff7ed',
                          borderRadius: '8px',
                          border: customer.paidOnDate ? '2px solid #10b981' : '2px solid #f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: '14px', color: '#6b7280' }}>
                            📱 {customer.phone}
                          </div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            Week {customer.weekNumber}/{customer.totalWeeks} • {formatCurrency(customer.weeklyAmount)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: customer.paidOnDate ? '#10b981' : '#f59e0b',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '14px'
                          }}>
                            {customer.paidOnDate ? '✓ Paid' : '✗ Pending'}
                          </div>

                          {!customer.paidOnDate && (
                            <>
                              <button
                                onClick={() => markAsPaid(customer.id, customer.loanId, customer.weeklyAmount)}
                                style={{
                                  padding: '8px 16px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                Mark Paid
                              </button>
                              <button
                                onClick={() => sendWhatsAppReminder(customer)}
                                style={{
                                  padding: '8px 16px',
                                  background: '#25d366',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                📱 Remind
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280',
                    background: '#f3f4f6',
                    borderRadius: '8px'
                  }}>
                    No customers with payments due on this Sunday
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SundayDashboard;
