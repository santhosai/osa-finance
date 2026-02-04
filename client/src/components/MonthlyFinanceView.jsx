import { useState, useRef } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';
import PrintReceipt from './PrintReceipt';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function MonthlyFinanceView({ navigateTo }) {
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'calendar'
  const [selectedDay, setSelectedDay] = useState(null); // For calendar day modal
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    loanAmount: '',
    totalMonths: 5,
    startDate: new Date().toISOString().split('T')[0],
    loanGivenDate: new Date().toISOString().split('T')[0]
  });

  // Fetch Monthly Finance customers from separate collection
  const { data: monthlyCustomers = [], error, isLoading, mutate } = useSWR(
    `${API_URL}/monthly-finance/customers`,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true, // Auto-refresh when user returns to tab
      dedupingInterval: 2000,
    }
  );

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const handleRefresh = () => {
    mutate();
  };

  // Get payment day from start_date (day of month when payment is due)
  const getPaymentDay = (startDate) => {
    if (!startDate) return 1;
    return new Date(startDate).getDate();
  };

  // Group active customers by their payment day
  const activeCustomers = monthlyCustomers.filter(c => c.status === 'active');
  const customersByDay = {};
  for (let day = 1; day <= 31; day++) {
    customersByDay[day] = activeCustomers.filter(c => getPaymentDay(c.start_date) === day);
  }

  // Get total balance for a day
  const getDayTotal = (day) => {
    return customersByDay[day].reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
  };

  // Get customer count for a day
  const getDayCount = (day) => {
    return customersByDay[day].length;
  };

  // Handle day click in calendar
  const handleDayClick = (day) => {
    if (customersByDay[day].length > 0) {
      setSelectedDay(day);
    }
  };

  // ESC/POS Commands for Thermal Printer
  const ESC = '\x1B';
  const GS = '\x1D';
  const THERMAL_COMMANDS = {
    INIT: ESC + '@',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_LEFT: ESC + 'a' + '\x00',
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
    DOUBLE_HEIGHT: GS + '!' + '\x10',
    NORMAL_SIZE: GS + '!' + '\x00',
    FEED: ESC + 'd' + '\x03',
    PARTIAL_CUT: GS + 'V' + '\x01',
    LINE: '--------------------------------\n'
  };

  // Print Monthly Finance Audit Report (Thermal)
  const printMonthlyAuditThermal = async () => {
    try {
      if (!navigator.bluetooth) {
        alert('Bluetooth not supported. Use a Bluetooth-enabled browser.');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ]
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }

      if (!characteristic) {
        alert('Printer not compatible');
        return;
      }

      // Generate Audit Report
      let receipt = THERMAL_COMMANDS.INIT;
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += THERMAL_COMMANDS.DOUBLE_HEIGHT;
      receipt += 'MONTHLY FINANCE\n';
      receipt += 'AUDIT REPORT\n';
      receipt += THERMAL_COMMANDS.NORMAL_SIZE;
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
      receipt += THERMAL_COMMANDS.LINE;

      // Summary
      const totalCustomers = activeCustomers.length;
      const totalLoanAmount = activeCustomers.reduce((sum, c) => sum + (c.loan_amount || 0), 0);
      const totalPaid = activeCustomers.reduce((sum, c) => sum + (c.loan_amount - c.balance), 0);
      const totalBalance = activeCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);
      const monthlyCollection = activeCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);

      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += 'SUMMARY\n';
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += THERMAL_COMMANDS.ALIGN_LEFT;
      receipt += `Customers: ${totalCustomers}\n`;
      receipt += `Total Loan: Rs.${totalLoanAmount.toLocaleString('en-IN')}\n`;
      receipt += `Total Paid: Rs.${totalPaid.toLocaleString('en-IN')}\n`;
      receipt += `Total Balance: Rs.${totalBalance.toLocaleString('en-IN')}\n`;
      receipt += `Monthly EMI: Rs.${monthlyCollection.toLocaleString('en-IN')}\n`;
      receipt += THERMAL_COMMANDS.LINE;

      // Customer List
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += THERMAL_COMMANDS.BOLD_ON;
      receipt += 'CUSTOMER LIST\n';
      receipt += THERMAL_COMMANDS.BOLD_OFF;
      receipt += THERMAL_COMMANDS.ALIGN_LEFT;

      activeCustomers.forEach((customer, idx) => {
        const paid = customer.loan_amount - customer.balance;
        receipt += `${idx + 1}. ${customer.name}\n`;
        receipt += `   Ph: ${customer.phone || '-'}\n`;
        receipt += `   Day: ${getPaymentDay(customer.start_date)} | EMI: Rs.${(customer.monthly_amount || 0).toLocaleString('en-IN')}\n`;
        receipt += `   Loan: Rs.${(customer.loan_amount || 0).toLocaleString('en-IN')}\n`;
        receipt += `   Paid: Rs.${paid.toLocaleString('en-IN')}\n`;
        receipt += `   Balance: Rs.${(customer.balance || 0).toLocaleString('en-IN')}\n`;
        receipt += '- - - - - - - - - - - - - -\n';
      });

      receipt += THERMAL_COMMANDS.LINE;
      receipt += THERMAL_COMMANDS.ALIGN_CENTER;
      receipt += 'Om Sai Murugan Finance\n';
      receipt += 'Ph: 8667510724\n';
      receipt += THERMAL_COMMANDS.FEED;
      receipt += THERMAL_COMMANDS.PARTIAL_CUT;

      // Send to printer
      const encoder = new TextEncoder();
      const bytes = encoder.encode(receipt);
      const chunkSize = 100;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      alert('Audit report printed!');
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        console.error('Print error:', error);
        alert('Print failed: ' + error.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="navbar" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <svg
            className="nav-icon"
            fill="white"
            viewBox="0 0 24 24"
            onClick={() => navigateTo('dashboard')}
            title="Back to Dashboard"
          >
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Monthly Finance</h2>
          <div style={{ width: '40px' }}></div>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Handler to update data and refresh selected customer
  const handleCustomerUpdate = async () => {
    try {
      // Force re-fetch and wait for new data
      const newData = await mutate(undefined, { revalidate: true });
      console.log('Mutate returned:', newData);

      // Update selectedCustomer with fresh data from server
      if (selectedCustomer && newData && Array.isArray(newData)) {
        const updatedCustomer = newData.find(c => c.id === selectedCustomer.id);
        console.log('Updated customer found:', updatedCustomer);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
        }
      } else {
        // If mutate didn't return data, manually fetch
        console.log('Mutate returned no data, fetching manually...');
        const response = await fetch(`${API_URL}/monthly-finance/customers`);
        const freshData = await response.json();
        if (selectedCustomer && freshData && Array.isArray(freshData)) {
          const updatedCustomer = freshData.find(c => c.id === selectedCustomer.id);
          if (updatedCustomer) {
            setSelectedCustomer(updatedCustomer);
          }
        }
      }
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  // Detail view for selected customer
  if (selectedCustomer) {
    return <MonthlyFinanceDetailView customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} onUpdate={handleCustomerUpdate} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="navbar" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('dashboard')}
          title="Back to Dashboard"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>Monthly Finance</h2>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={handleRefresh}
          title="Refresh"
        >
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
        </svg>
      </div>

      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
              💰 Monthly Finance ({monthlyCustomers.length})
            </h3>
            <button
              onClick={() => setShowAddCustomerForm(true)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              + Add Monthly Customer
            </button>
          </div>

          {/* Tab Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '8px'
          }}>
            <button
              onClick={() => setActiveTab('list')}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                background: activeTab === 'list' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: activeTab === 'list' ? 'white' : '#64748b'
              }}
            >
              📋 List View
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                background: activeTab === 'calendar' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: activeTab === 'calendar' ? 'white' : '#64748b'
              }}
            >
              📅 Calendar View
            </button>
          </div>

          {monthlyCustomers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                No Monthly Finance customers yet
              </div>
              <div style={{ fontSize: '14px' }}>
                Click "+ Add Monthly Customer" to create your first one
              </div>
            </div>
          ) : activeTab === 'list' ? (
            /* LIST VIEW */
            <div style={{ display: 'grid', gap: '10px' }}>
              {monthlyCustomers.map(customer => {
                const progress = ((customer.loan_amount - customer.balance) / customer.loan_amount) * 100;
                const monthsPaid = Math.floor((customer.loan_amount - customer.balance) / customer.monthly_amount);
                const totalMonths = customer.total_months;

                return (
                  <div
                    key={customer.id}
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                      borderRadius: '8px',
                      borderLeft: '4px solid #667eea',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => setSelectedCustomer(customer)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateX(5px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b', marginBottom: '8px' }}>
                          {customer.name}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                          📱 {customer.phone}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <div>
                            <strong>Amount:</strong> {formatCurrency(customer.loan_amount)}
                          </div>
                          <div>
                            <strong>Balance:</strong> <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(customer.balance)}</span>
                          </div>
                          <div>
                            <strong>Monthly:</strong> {formatCurrency(customer.monthly_amount)}
                          </div>
                          <div>
                            <strong>Started:</strong> {formatDate(customer.start_date)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        <span>Progress: {monthsPaid}/{totalMonths} months</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* CALENDAR VIEW */
            <div>
              {/* Summary Header */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                color: 'white'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 700 }}>{activeCustomers.length}</div>
                    <div style={{ fontSize: '11px', opacity: 0.9 }}>Active Customers</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 700 }}>
                      {formatCurrency(activeCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0))}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.9 }}>Monthly Collection</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 700 }}>
                      {formatCurrency(activeCustomers.reduce((sum, c) => sum + (c.balance || 0), 0))}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.9 }}>Total Balance</div>
                  </div>
                </div>
                {/* Audit Print Button */}
                <button
                  onClick={printMonthlyAuditThermal}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🖨️ Print Audit Report (All Customers)
                </button>
              </div>

              {/* 31-Day Calendar Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px'
              }}>
                {[...Array(31)].map((_, index) => {
                  const day = index + 1;
                  const dayTotal = getDayTotal(day);
                  const dayCount = getDayCount(day);
                  const hasData = customersByDay[day].length > 0;
                  const today = new Date().getDate();

                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(day)}
                      style={{
                        border: day === today ? '2px solid #667eea' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '10px 6px',
                        textAlign: 'center',
                        cursor: hasData ? 'pointer' : 'default',
                        background: hasData
                          ? 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)'
                          : day === today ? '#fef3c7' : 'white',
                        transition: 'all 0.2s',
                        minHeight: '70px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (hasData) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: hasData ? '#667eea' : day === today ? '#d97706' : '#9ca3af',
                        marginBottom: '4px'
                      }}>
                        {day}
                      </div>
                      {hasData && (
                        <>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#059669',
                            marginBottom: '2px'
                          }}>
                            {formatCurrency(dayTotal)}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#6b7280'
                          }}>
                            👥 {dayCount}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{
                marginTop: '12px',
                display: 'flex',
                gap: '16px',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#6b7280'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '12px', height: '12px', background: '#fef3c7', border: '1px solid #d97706', borderRadius: '2px' }}></div>
                  Today
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '12px', height: '12px', background: 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)', border: '1px solid #667eea', borderRadius: '2px' }}></div>
                  Has Customers
                </div>
              </div>

              {/* Customer List with Scrolling */}
              <div style={{
                marginTop: '20px',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                {/* List Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  padding: '12px 16px',
                  color: 'white',
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  <div>Customer</div>
                  <div style={{ textAlign: 'right' }}>Paid</div>
                  <div style={{ textAlign: 'right' }}>Balance</div>
                </div>

                {/* Scrollable Customer List */}
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {activeCustomers.map((customer, idx) => {
                    const paid = customer.loan_amount - customer.balance;
                    return (
                      <div
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr',
                          gap: '8px',
                          padding: '12px 16px',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: idx % 2 === 0 ? 'white' : '#f8fafc',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f8fafc'}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Day {getPaymentDay(customer.start_date)} | {formatCurrency(customer.monthly_amount)}/mo
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#059669', fontSize: '14px', alignSelf: 'center' }}>
                          {formatCurrency(paid)}
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626', fontSize: '14px', alignSelf: 'center' }}>
                          {formatCurrency(customer.balance)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* List Footer */}
                <div style={{
                  background: '#f1f5f9',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderTop: '2px solid #e5e7eb'
                }}>
                  <div style={{ color: '#1e293b' }}>Total ({activeCustomers.length})</div>
                  <div style={{ textAlign: 'right', color: '#059669' }}>
                    {formatCurrency(activeCustomers.reduce((sum, c) => sum + (c.loan_amount - c.balance), 0))}
                  </div>
                  <div style={{ textAlign: 'right', color: '#dc2626' }}>
                    {formatCurrency(activeCustomers.reduce((sum, c) => sum + c.balance, 0))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '16px 20px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  Day {selectedDay} - Payment Due
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  {customersByDay[selectedDay]?.length || 0} customers | {formatCurrency(getDayTotal(selectedDay))} expected
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  fontSize: '20px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Customer List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              {customersByDay[selectedDay]?.map(customer => {
                const progress = ((customer.loan_amount - customer.balance) / customer.loan_amount) * 100;
                const monthsPaid = Math.floor((customer.loan_amount - customer.balance) / customer.monthly_amount);

                return (
                  <div
                    key={customer.id}
                    style={{
                      padding: '14px',
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      borderLeft: '4px solid #667eea',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedCustomer(customer);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                          {customer.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          📱 {customer.phone}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#667eea' }}>
                          {formatCurrency(customer.monthly_amount)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Monthly
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                      <span>Balance: {formatCurrency(customer.balance)}</span>
                      <span>{monthsPaid}/{customer.total_months} paid ({Math.round(progress)}%)</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: '#e2e8f0',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showAddCustomerForm && (
        <AddMonthlyCustomerModal
          formData={formData}
          setFormData={setFormData}
          onClose={() => {
            setShowAddCustomerForm(false);
            setFormData({
              name: '',
              phone: '',
              loanAmount: '',
              totalMonths: 5,
              startDate: new Date().toISOString().split('T')[0]
            });
          }}
          onSuccess={() => {
            setShowAddCustomerForm(false);
            setFormData({
              name: '',
              phone: '',
              loanAmount: '',
              totalMonths: 5,
              startDate: new Date().toISOString().split('T')[0]
            });
            mutate();
          }}
        />
      )}
    </div>
  );
}

// Modal component for adding Monthly Finance customers
function AddMonthlyCustomerModal({ formData, setFormData, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const monthlyInstallment = formData.loanAmount && formData.totalMonths > 0
    ? Math.round(parseFloat(formData.loanAmount) / formData.totalMonths)
    : 0;

  // Select contact from phone's contact list
  const selectFromContacts = async () => {
    // Check if Contact Picker API is supported
    if (!('contacts' in navigator)) {
      alert('Contact picker is not supported on this device/browser. Please use Chrome on Android for best experience.');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };

      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];

        // Extract phone number (remove all non-digits)
        let phone = '';
        if (contact.tel && contact.tel.length > 0) {
          phone = contact.tel[0].replace(/\D/g, ''); // Remove all non-digits
          // Get last 10 digits if number is longer (for country codes)
          if (phone.length > 10) {
            phone = phone.slice(-10);
          }
        }

        // Update form with contact data
        setFormData({
          ...formData,
          name: contact.name && contact.name[0] ? contact.name[0] : formData.name,
          phone: phone
        });
      }
    } catch (error) {
      // User cancelled the picker or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error selecting contact:', error);
        alert('Failed to select contact: ' + error.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      // Create Monthly Finance customer using new API endpoint
      const response = await fetch(`${API_URL}/monthly-finance/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          loan_amount: parseFloat(formData.loanAmount),
          monthly_amount: monthlyInstallment,
          total_months: formData.totalMonths,
          start_date: formData.startDate,
          loan_given_date: formData.loanGivenDate
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create Monthly Finance customer');
      }

      // Send WhatsApp loan creation message if phone number exists
      if (formData.phone) {
        const message = `Loan Agreement - Monthly Finance

Customer: ${formData.name}
Loan Amount: ₹${parseFloat(formData.loanAmount).toLocaleString('en-IN')}
Monthly Payment: ₹${monthlyInstallment.toLocaleString('en-IN')}
Total Months: ${formData.totalMonths}
Start Date: ${new Date(formData.startDate).toLocaleDateString('en-IN')}

You have received a loan of ₹${parseFloat(formData.loanAmount).toLocaleString('en-IN')} from Om Sai Murugan Finance.
Monthly payment: ₹${monthlyInstallment.toLocaleString('en-IN')}
Total months: ${formData.totalMonths}

Thank you for choosing us!

- Om Sai Murugan Finance`;

        const cleanPhone = formData.phone.replace(/\D/g, '');
        const phoneWithCountryCode = `91${cleanPhone}`;
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating Monthly Finance customer:', err);
      setError(err.message || 'Failed to create Monthly Finance customer');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            Add Monthly Finance Customer
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Customer Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Phone Number *
            </label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                pattern="[0-9]{10}"
                maxLength="10"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <button
                type="button"
                onClick={selectFromContacts}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: loading ? 0.6 : 1
                }}
                title="Select from Contacts"
              >
                👤 Contacts
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Loan Amount (₹) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.loanAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, loanAmount: value });
              }}
              autoComplete="off"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Total Months *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.totalMonths}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, totalMonths: parseInt(value) || 5 });
              }}
              autoComplete="off"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{
            background: '#f0f9ff',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '4px' }}>
              Monthly Installment (Auto-calculated)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a8a' }}>
              ₹{monthlyInstallment.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Loan Given Date * (When money was given)
            </label>
            <input
              type="date"
              value={formData.loanGivenDate}
              onChange={(e) => setFormData({ ...formData, loanGivenDate: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Payment Start Date * (When EMI starts)
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                background: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Detail view component for a single Monthly Finance customer
function MonthlyFinanceDetailView({ customer, onBack, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [processingMonth, setProcessingMonth] = useState(null); // Track which month is being processed
  const isProcessingRef = useRef(false); // Ref for immediate check (faster than state)
  const [printData, setPrintData] = useState(null); // For print receipt - same as Weekly
  const [showSendChoice, setShowSendChoice] = useState(false); // Show WhatsApp/Print choice modal
  const [pendingPaymentData, setPendingPaymentData] = useState(null); // Store payment data for choice modal
  const [showEditModal, setShowEditModal] = useState(false); // Show edit modal

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Generate payment schedule based on start date and total months
  // First payment is on start_date (not 1 month after)
  const generatePaymentSchedule = () => {
    const schedule = [];
    const startDate = new Date(customer.start_date);
    const monthlyAmount = customer.monthly_amount;

    for (let i = 0; i < customer.total_months; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i); // First payment on start_date

      // Check if this month's payment has been made based on balance
      const totalPaid = customer.loan_amount - customer.balance;
      const monthsPaid = Math.floor(totalPaid / monthlyAmount);
      const isPaid = i < monthsPaid;

      // Get month name
      const monthName = paymentDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

      schedule.push({
        month: i + 1,
        monthName: monthName,
        date: paymentDate.toISOString().split('T')[0],
        amount: monthlyAmount,
        paid: isPaid
      });
    }

    return schedule;
  };

  const paymentSchedule = generatePaymentSchedule();
  const progress = ((customer.loan_amount - customer.balance) / customer.loan_amount) * 100;
  const monthsPaid = paymentSchedule.filter(p => p.paid).length;

  const handlePaymentToggle = async (monthIndex) => {
    // CRITICAL: Use ref for immediate check (prevents race condition)
    if (isProcessingRef.current) {
      console.log('Payment already in progress, ignoring click');
      return;
    }

    // Also check state-based loading
    if (loading) return;

    const payment = paymentSchedule[monthIndex];

    if (payment.paid) {
      // Cannot un-mark payments - would need delete payment API
      alert('Cannot un-mark paid payments. Please contact support if you need to reverse a payment.');
      return;
    }

    // Set ref IMMEDIATELY before any async operation
    isProcessingRef.current = true;

    try {
      setLoading(true);
      setProcessingMonth(monthIndex);

      // Add payment via API
      const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: customer.monthly_amount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'cash'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record payment');
      }

      // Calculate new balance
      const newBalance = customer.balance - customer.monthly_amount;

      // Refresh data
      await onUpdate();

      // Store payment data and show choice modal
      setPendingPaymentData({
        customerName: customer.name,
        phone: customer.phone,
        loanType: 'Monthly Finance',
        amountPaid: customer.monthly_amount,
        loanAmount: customer.loan_amount,
        totalPaid: customer.loan_amount - newBalance,
        balance: newBalance,
        monthlyAmount: customer.monthly_amount,
        monthNumber: payment.month,
        date: new Date().toISOString()
      });
      setShowSendChoice(true);

    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment: ' + error.message);
    } finally {
      // Always reset both ref and state
      isProcessingRef.current = false;
      setLoading(false);
      setProcessingMonth(null);
    }
  };

  // Undo last payment
  const handleUndoPayment = async () => {
    if (loading) return;

    const confirmUndo = window.confirm(
      `Are you sure you want to undo the last payment of ${formatCurrency(customer.monthly_amount)} for ${customer.name}?`
    );

    if (!confirmUndo) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}/undo-payment`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to undo payment');
      }

      alert('Last payment undone successfully!');
      await onUpdate();
    } catch (error) {
      console.error('Error undoing payment:', error);
      alert('Failed to undo payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete customer
  const handleDeleteCustomer = async () => {
    if (loading) return;

    const confirmDelete = window.confirm(
      `⚠️ WARNING: Are you sure you want to DELETE "${customer.name}"?\n\nThis will permanently delete:\n- Customer record\n- All payment history\n\nThis action CANNOT be undone!`
    );

    if (!confirmDelete) return;

    // Double confirmation for safety
    const doubleConfirm = window.confirm(
      `FINAL CONFIRMATION\n\nYou are about to permanently delete "${customer.name}" and all their data.\n\nType OK to proceed.`
    );

    if (!doubleConfirm) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer');
      }

      alert('Customer deleted successfully!');
      onBack(); // Go back to customer list
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle WhatsApp send
  const sendWhatsApp = () => {
    if (!pendingPaymentData || !pendingPaymentData.phone) return;

    const message = `Payment Receipt - Monthly Finance

Customer: ${pendingPaymentData.customerName}
Month ${pendingPaymentData.monthNumber} Payment: Rs.${pendingPaymentData.amountPaid.toLocaleString('en-IN')}
Date: ${new Date().toLocaleDateString('en-IN')}
Remaining Balance: Rs.${pendingPaymentData.balance.toLocaleString('en-IN')}

Thank you for your payment!

- Om Sai Murugan Finance`;

    const cleanPhone = pendingPaymentData.phone.replace(/\D/g, '');
    const phoneWithCountryCode = `91${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle choice selection
  const handleChoiceSelect = (choice) => {
    if (choice === 'whatsapp' || choice === 'both') {
      sendWhatsApp();
    }
    if (choice === 'print' || choice === 'both') {
      setPrintData({
        type: 'payment',
        data: pendingPaymentData
      });
    }
    setShowSendChoice(false);
    setPendingPaymentData(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* WhatsApp/Print Choice Modal */}
      {showSendChoice && pendingPaymentData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '320px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '20px',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Payment Recorded!</div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>
                {formatCurrency(pendingPaymentData.amountPaid)} received
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', marginBottom: '16px' }}>
                How would you like to send receipt?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => handleChoiceSelect('whatsapp')}
                  style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  📱 WhatsApp Only
                </button>

                <button
                  onClick={() => handleChoiceSelect('print')}
                  style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🖨️ Thermal Print Only
                </button>

                <button
                  onClick={() => handleChoiceSelect('both')}
                  style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  📱🖨️ Both WhatsApp + Print
                </button>

                <button
                  onClick={() => handleChoiceSelect('skip')}
                  style={{
                    padding: '12px',
                    background: '#f3f4f6',
                    color: '#6b7280',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="navbar" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={onBack}
          title="Back to List"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>{customer.name}</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* Customer Info Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                {customer.name}
              </div>
              <div style={{ fontSize: '16px', color: '#64748b' }}>
                📱 {customer.phone}
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ✏️ Edit
            </button>
          </div>

          {/* Loan Dates Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bfdbfe'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginBottom: '4px' }}>💰 Loan Given Date</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatDate(customer.loan_given_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginBottom: '4px' }}>📅 Payment Start Date</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatDate(customer.start_date)}</div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            color: 'white'
          }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Total Amount</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(customer.loan_amount)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Balance</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(customer.balance)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Monthly Payment</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(customer.monthly_amount)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Progress</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{monthsPaid}/{customer.total_months} months</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
              <span>Loan Progress</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div style={{
              width: '100%',
              height: '10px',
              background: '#e2e8f0',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Undo Button */}
          {monthsPaid > 0 && (
            <button
              onClick={handleUndoPayment}
              disabled={loading}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '12px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Processing...
                </>
              ) : (
                <>↩️ Undo Last Payment</>
              )}
            </button>
          )}

          {/* Delete Customer Button */}
          <button
            onClick={handleDeleteCustomer}
            disabled={loading}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '12px',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🗑️ Delete Customer
          </button>
        </div>

        {/* Payment Schedule */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
            📅 Payment Schedule
          </h3>

          <div style={{ display: 'grid', gap: '10px' }}>
            {paymentSchedule.map((payment, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  background: payment.paid
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${payment.paid ? '#10b981' : '#ef4444'}`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>
                    Month {payment.month} - {payment.monthName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Due: {formatDate(payment.date)} | {formatCurrency(payment.amount)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Print button for paid months - same as Weekly */}
                  {payment.paid && (
                    <button
                      onClick={() => setPrintData({
                        type: 'payment',
                        data: {
                          customerName: customer.name,
                          phone: customer.phone,
                          loanType: 'Monthly',
                          loanAmount: customer.loan_amount,
                          amountPaid: customer.monthly_amount,
                          totalPaid: payment.month * customer.monthly_amount,
                          balance: customer.loan_amount - (payment.month * customer.monthly_amount),
                          monthNumber: payment.month,
                          date: payment.date
                        }
                      })}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Print Receipt"
                    >
                      🖨️ Print
                    </button>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', cursor: loading ? 'not-allowed' : 'pointer', gap: '8px' }}>
                    {processingMonth === index ? (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        border: '3px solid #e2e8f0',
                        borderTopColor: '#10b981',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : (
                      <input
                        type="checkbox"
                        checked={payment.paid}
                        onChange={() => handlePaymentToggle(index)}
                        disabled={loading || payment.paid}
                        style={{
                          width: '24px',
                          height: '24px',
                          cursor: loading || payment.paid ? 'not-allowed' : 'pointer',
                          accentColor: '#10b981'
                        }}
                      />
                    )}
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: processingMonth === index ? '#6366f1' : (payment.paid ? '#10b981' : '#ef4444')
                    }}>
                      {processingMonth === index ? 'Saving...' : (payment.paid ? 'Paid' : 'Unpaid')}
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print Receipt Modal - same as Weekly */}
      {printData && (
        <PrintReceipt
          type={printData.type}
          data={printData.data}
          onClose={() => setPrintData(null)}
        />
      )}

      {/* Edit Customer Modal */}
      {showEditModal && (
        <EditMonthlyCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

// Modal component for editing Monthly Finance customers
function EditMonthlyCustomerModal({ customer, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: customer.name || '',
    phone: customer.phone || '',
    loanAmount: customer.loan_amount?.toString() || '',
    totalMonths: customer.total_months || 5,
    startDate: customer.start_date || new Date().toISOString().split('T')[0],
    loanGivenDate: customer.loan_given_date || customer.start_date || new Date().toISOString().split('T')[0]
  });

  const monthlyInstallment = formData.loanAmount && formData.totalMonths > 0
    ? Math.round(parseFloat(formData.loanAmount) / formData.totalMonths)
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/monthly-finance/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          loan_amount: parseFloat(formData.loanAmount),
          monthly_amount: monthlyInstallment,
          total_months: formData.totalMonths,
          start_date: formData.startDate,
          loan_given_date: formData.loanGivenDate
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update customer');
      }

      onSuccess();
    } catch (err) {
      console.error('Error updating customer:', err);
      setError(err.message || 'Failed to update customer');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            ✏️ Edit Monthly Finance Customer
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Customer Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              pattern="[0-9]{10}"
              maxLength="10"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Loan Amount (₹) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.loanAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, loanAmount: value });
              }}
              autoComplete="off"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Total Months *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.totalMonths}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, totalMonths: parseInt(value) || 5 });
              }}
              autoComplete="off"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{
            background: '#f0f9ff',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '4px' }}>
              Monthly Installment (Auto-calculated)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a8a' }}>
              ₹{monthlyInstallment.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Loan Given Date * (When money was given)
            </label>
            <input
              type="date"
              value={formData.loanGivenDate}
              onChange={(e) => setFormData({ ...formData, loanGivenDate: e.target.value })}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Payment Start Date * (When EMI starts)
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                background: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Updating...' : 'Update Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MonthlyFinanceView;
