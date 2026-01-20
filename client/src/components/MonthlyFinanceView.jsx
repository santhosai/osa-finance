import { useState, useRef } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

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

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Generate payment schedule based on start date and total months
  const generatePaymentSchedule = () => {
    const schedule = [];
    const startDate = new Date(customer.start_date);
    const monthlyAmount = customer.monthly_amount;

    for (let i = 0; i < customer.total_months; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);

      // Check if this month's payment has been made based on balance
      const totalPaid = customer.loan_amount - customer.balance;
      const monthsPaid = Math.floor(totalPaid / monthlyAmount);
      const isPaid = i < monthsPaid;

      schedule.push({
        month: i + 1,
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

      // Send WhatsApp receipt if phone number exists
      if (customer.phone) {
        const newBalance = customer.balance - customer.monthly_amount;
        const message = `Payment Receipt - Monthly Finance

Customer: ${customer.name}
Month ${payment.month} Payment: ₹${customer.monthly_amount.toLocaleString('en-IN')}
Date: ${new Date().toLocaleDateString('en-IN')}
Remaining Balance: ₹${newBalance.toLocaleString('en-IN')}

Thank you for your payment!

- Om Sai Murugan Finance`;

        const cleanPhone = customer.phone.replace(/\D/g, '');
        const phoneWithCountryCode = `91${cleanPhone}`;
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      // Refresh data
      await onUpdate();

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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              {customer.name}
            </div>
            <div style={{ fontSize: '16px', color: '#64748b' }}>
              📱 {customer.phone}
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
                    Month {payment.month}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Due: {formatDate(payment.date)} | {formatCurrency(payment.amount)}
                  </div>
                </div>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlyFinanceView;
