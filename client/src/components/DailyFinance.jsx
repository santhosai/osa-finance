import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

const fetcher = (url) => fetch(url).then(res => res.json());

const DailyFinance = ({ navigateTo }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showLoanDetailsModal, setShowLoanDetailsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', aadhar: '', photo: '', signature: '' });
  const [loanForm, setLoanForm] = useState({ customer_id: '', asked_amount: '', loan_given_date: '', start_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('collections'); // 'collections', 'customers', 'all-loans'
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const signatureCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Fetch daily summary
  const { data: summary = {}, mutate: mutateSummary } = useSWR(
    `${API_URL}/daily-summary`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  // Fetch collections for selected date
  const { data: collections = [], mutate: mutateCollections } = useSWR(
    `${API_URL}/daily-collections/${selectedDate}`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  // Fetch all daily customers
  const { data: customers = [], mutate: mutateCustomers } = useSWR(
    `${API_URL}/daily-customers`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Handle mark payment
  const handleMarkPayment = async (loanId, dailyAmount) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/daily-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loanId,
          amount: dailyAmount,
          payment_date: selectedDate
        })
      });

      if (response.ok) {
        mutateCollections();
        mutateSummary();
        mutateCustomers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle add customer
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/daily-customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm)
      });

      if (response.ok) {
        setShowAddCustomerModal(false);
        setCustomerForm({ name: '', phone: '', aadhar: '', photo: '', signature: '' });
        setIsDrawingSignature(false);
        mutateCustomers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add customer');
      }
    } catch (error) {
      console.error('Add customer error:', error);
      alert('Failed to add customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle add loan
  const handleAddLoan = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${API_URL}/daily-loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: loanForm.customer_id,
          asked_amount: Number(loanForm.asked_amount),
          loan_given_date: loanForm.loan_given_date || today,
          start_date: loanForm.start_date || today
        })
      });

      if (response.ok) {
        setShowAddLoanModal(false);
        setLoanForm({ customer_id: '', asked_amount: '', loan_given_date: '', start_date: '' });
        mutateCustomers();
        mutateCollections();
        mutateSummary();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add loan');
      }
    } catch (error) {
      console.error('Add loan error:', error);
      alert('Failed to add loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View loan details
  const handleViewLoan = async (loanId) => {
    try {
      const response = await fetch(`${API_URL}/daily-loans/${loanId}`);
      if (response.ok) {
        const loan = await response.json();
        setSelectedLoan(loan);
        setShowLoanDetailsModal(true);
      }
    } catch (error) {
      console.error('Error fetching loan:', error);
    }
  };

  // Delete payment
  const handleDeletePayment = async (paymentId) => {
    if (!confirm('Delete this payment?')) return;

    try {
      const response = await fetch(`${API_URL}/daily-payments/${paymentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh loan details
        if (selectedLoan) {
          const loanResponse = await fetch(`${API_URL}/daily-loans/${selectedLoan.id}`);
          if (loanResponse.ok) {
            setSelectedLoan(await loanResponse.json());
          }
        }
        mutateCollections();
        mutateSummary();
        mutateCustomers();
      }
    } catch (error) {
      console.error('Delete payment error:', error);
    }
  };

  // Delete customer
  const handleDeleteCustomer = async (customerId, customerName) => {
    if (!confirm(`Delete customer "${customerName}" and ALL their loans/payments? This cannot be undone!`)) return;

    try {
      const response = await fetch(`${API_URL}/daily-customers/${customerId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        mutateCustomers();
        mutateSummary();
        mutateCollections();
        alert('Customer deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Delete customer error:', error);
      alert('Failed to delete customer');
    }
  };

  // Delete loan
  const handleDeleteLoan = async (loanId) => {
    if (!confirm('Delete this loan and all its payments? This cannot be undone!')) return;

    try {
      const response = await fetch(`${API_URL}/daily-loans/${loanId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setShowLoanDetailsModal(false);
        setSelectedLoan(null);
        mutateCustomers();
        mutateSummary();
        mutateCollections();
        alert('Loan deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete loan');
      }
    } catch (error) {
      console.error('Delete loan error:', error);
      alert('Failed to delete loan');
    }
  };

  // WhatsApp reminder
  const sendWhatsAppReminder = (phone, name, amount, dayNumber) => {
    const message = `Hi ${name}, your daily payment of ${formatCurrency(amount)} (Day ${dayNumber}/100) is due today. Please pay. - OSM Finance`;
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Navigate dates
  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // Calculate stats for selected date
  const unpaidCollections = collections.filter(c => !c.is_paid);
  const paidCollections = collections.filter(c => c.is_paid);
  const totalExpectedToday = collections.reduce((sum, c) => sum + c.daily_amount, 0);
  const totalCollectedToday = paidCollections.reduce((sum, c) => sum + c.daily_amount, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#1e293b' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        padding: '16px',
        color: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigateTo('dashboard')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Back
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Daily Finance</h1>
          <div style={{ width: '60px' }}></div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: 'white'
        }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Total Given</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(summary.total_given)}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: 'white'
        }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Outstanding</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(summary.total_outstanding)}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: 'white'
        }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Active Loans</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{summary.active_loans || 0}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: 'white'
        }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Closed Loans</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{summary.closed_loans || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px', display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['collections', 'customers', 'all-loans'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? '#f59e0b' : '#334155',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'collections' ? 'Today' : tab === 'all-loans' ? 'All Loans' : tab}
          </button>
        ))}
      </div>

      {/* Collections Tab */}
      {activeTab === 'collections' && (
        <>
          {/* Date Navigator */}
          <div style={{
            padding: '0 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <button
              onClick={() => changeDate(-1)}
              style={{
                background: '#475569',
                border: 'none',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              &lt;
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                flex: 1,
                background: '#334155',
                border: 'none',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '16px',
                textAlign: 'center'
              }}
            />
            <button
              onClick={() => changeDate(1)}
              style={{
                background: '#475569',
                border: 'none',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              &gt;
            </button>
          </div>

          {/* Collection Summary for Date */}
          <div style={{
            margin: '0 16px 16px',
            padding: '12px 16px',
            background: '#334155',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>Expected</div>
              <div style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalExpectedToday)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>Collected</div>
              <div style={{ color: '#10b981', fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalCollectedToday)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>Pending</div>
              <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 700 }}>{unpaidCollections.length}</div>
            </div>
          </div>

          {/* Unpaid Collections */}
          {unpaidCollections.length > 0 && (
            <div style={{ padding: '0 16px' }}>
              <h3 style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px' }}>
                Pending ({unpaidCollections.length})
              </h3>
              {unpaidCollections.map(c => (
                <div
                  key={c.loan_id}
                  style={{
                    background: '#334155',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    borderLeft: '4px solid #ef4444'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '16px' }}>{c.customer_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>{c.customer_phone}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '18px' }}>{formatCurrency(c.daily_amount)}</div>
                      <div style={{ color: '#94a3b8', fontSize: '12px' }}>Day {c.day_number}/100</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleMarkPayment(c.loan_id, c.daily_amount)}
                      disabled={isSubmitting}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#10b981',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => sendWhatsAppReminder(c.customer_phone, c.customer_name, c.daily_amount, c.day_number)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#25d366',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleViewLoan(c.loan_id)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#475569',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paid Collections */}
          {paidCollections.length > 0 && (
            <div style={{ padding: '0 16px', marginTop: '16px' }}>
              <h3 style={{ color: '#10b981', fontSize: '14px', marginBottom: '12px' }}>
                Paid ({paidCollections.length})
              </h3>
              {paidCollections.map(c => (
                <div
                  key={c.loan_id}
                  style={{
                    background: '#334155',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    borderLeft: '4px solid #10b981',
                    opacity: 0.7
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600 }}>{c.customer_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>Day {c.day_number}/100</div>
                    </div>
                    <div style={{ color: '#10b981', fontWeight: 700 }}>{formatCurrency(c.daily_amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {collections.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No collections for this date
            </div>
          )}
        </>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={() => setShowAddCustomerModal(true)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: '2px dashed #475569',
              background: 'transparent',
              color: '#f59e0b',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              marginBottom: '16px'
            }}
          >
            + Add Daily Customer
          </button>

          {customers.map(customer => (
            <div
              key={customer.id}
              style={{
                background: '#334155',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '16px' }}>{customer.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>{customer.phone}</div>
                  <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '4px' }}>
                    {customer.total_loans} active loan{customer.total_loans !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(customer.total_outstanding)}</div>
                  <button
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setLoanForm({ customer_id: customer.id, asked_amount: '', loan_given_date: new Date().toISOString().split('T')[0], start_date: new Date().toISOString().split('T')[0] });
                      setShowAddLoanModal(true);
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#f59e0b',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + New Loan
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                    style={{
                      marginTop: '8px',
                      marginLeft: '8px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Customer's loans */}
              {customer.loans && customer.loans.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #475569' }}>
                  {customer.loans.map(loan => (
                    <div
                      key={loan.id}
                      onClick={() => handleViewLoan(loan.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                        {formatCurrency(loan.asked_amount)} loan
                      </div>
                      <div style={{ color: '#ef4444', fontSize: '13px' }}>
                        Bal: {formatCurrency(loan.balance)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {customers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No daily customers yet
            </div>
          )}
        </div>
      )}

      {/* All Loans Tab */}
      {activeTab === 'all-loans' && (
        <div style={{ padding: '0 16px' }}>
          {customers.flatMap(c => (c.loans || []).map(loan => ({
            ...loan,
            customer_name: c.name,
            customer_phone: c.phone
          }))).map(loan => (
            <div
              key={loan.id}
              onClick={() => handleViewLoan(loan.id)}
              style={{
                background: '#334155',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 600 }}>{loan.customer_name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                    Asked: {formatCurrency(loan.asked_amount)} | Given: {formatCurrency(loan.given_amount)}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {formatCurrency(loan.daily_amount)}/day x 100 days | Started: {loan.start_date}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(loan.balance)}</div>
                  <div style={{
                    color: loan.status === 'active' ? '#10b981' : '#94a3b8',
                    fontSize: '12px'
                  }}>
                    {loan.status}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
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
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '20px' }}>Add Daily Customer</h2>
            <form onSubmit={handleAddCustomer} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Name *</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#334155',
                    color: 'white',
                    fontSize: '16px'
                  }}
                  placeholder="Customer name"
                />
              </div>

              {/* Phone */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Phone *</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value.replace(/\D/g, '') })}
                  required
                  maxLength="10"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#334155',
                    color: 'white',
                    fontSize: '16px'
                  }}
                  placeholder="10-digit mobile"
                />
              </div>

              {/* Aadhar Number */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Aadhar Number</label>
                <input
                  type="text"
                  value={customerForm.aadhar}
                  onChange={(e) => setCustomerForm({ ...customerForm, aadhar: e.target.value.replace(/\D/g, '') })}
                  maxLength="12"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#334155',
                    color: 'white',
                    fontSize: '16px'
                  }}
                  placeholder="12-digit Aadhar number"
                />
              </div>

              {/* Customer Photo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Customer Photo</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="photoCapture"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          // Compress the image
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxSize = 400;
                            let width = img.width;
                            let height = img.height;
                            if (width > height && width > maxSize) {
                              height = (height * maxSize) / width;
                              width = maxSize;
                            } else if (height > maxSize) {
                              width = (width * maxSize) / height;
                              height = maxSize;
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            setCustomerForm({ ...customerForm, photo: canvas.toDataURL('image/jpeg', 0.7) });
                          };
                          img.src = reader.result;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('photoCapture').click()}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#3b82f6',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    📷 Camera / Gallery
                  </button>
                  {customerForm.photo && (
                    <button
                      type="button"
                      onClick={() => setCustomerForm({ ...customerForm, photo: '' })}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#ef4444',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {customerForm.photo && (
                  <img src={customerForm.photo} alt="Customer" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                )}
              </div>

              {/* Signature */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Signature</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsDrawingSignature(true)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#10b981',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ✍️ Draw Signature
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    id="signatureUpload"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxSize = 300;
                            let width = img.width;
                            let height = img.height;
                            if (width > height && width > maxSize) {
                              height = (height * maxSize) / width;
                              width = maxSize;
                            } else if (height > maxSize) {
                              width = (width * maxSize) / height;
                              height = maxSize;
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            setCustomerForm({ ...customerForm, signature: canvas.toDataURL('image/jpeg', 0.7) });
                          };
                          img.src = reader.result;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('signatureUpload').click()}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#8b5cf6',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    📁 Upload Image
                  </button>
                </div>
                {customerForm.signature && !isDrawingSignature && (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={customerForm.signature} alt="Signature" style={{ width: '150px', height: '80px', objectFit: 'contain', background: 'white', borderRadius: '8px', padding: '4px' }} />
                    <button
                      type="button"
                      onClick={() => setCustomerForm({ ...customerForm, signature: '' })}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: 'none',
                        background: '#ef4444',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Signature Drawing Canvas */}
                {isDrawingSignature && (
                  <div style={{ marginTop: '12px' }}>
                    <canvas
                      ref={signatureCanvasRef}
                      width={280}
                      height={150}
                      style={{ background: 'white', borderRadius: '8px', touchAction: 'none' }}
                      onMouseDown={(e) => {
                        setIsDrawing(true);
                        const canvas = signatureCanvasRef.current;
                        const ctx = canvas.getContext('2d');
                        const rect = canvas.getBoundingClientRect();
                        ctx.beginPath();
                        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawing) return;
                        const canvas = signatureCanvasRef.current;
                        const ctx = canvas.getContext('2d');
                        const rect = canvas.getBoundingClientRect();
                        ctx.lineWidth = 2;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = '#000';
                        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                        ctx.stroke();
                      }}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        setIsDrawing(true);
                        const canvas = signatureCanvasRef.current;
                        const ctx = canvas.getContext('2d');
                        const rect = canvas.getBoundingClientRect();
                        const touch = e.touches[0];
                        ctx.beginPath();
                        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                      }}
                      onTouchMove={(e) => {
                        e.preventDefault();
                        if (!isDrawing) return;
                        const canvas = signatureCanvasRef.current;
                        const ctx = canvas.getContext('2d');
                        const rect = canvas.getBoundingClientRect();
                        const touch = e.touches[0];
                        ctx.lineWidth = 2;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = '#000';
                        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                        ctx.stroke();
                      }}
                      onTouchEnd={() => setIsDrawing(false)}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const canvas = signatureCanvasRef.current;
                          const ctx = canvas.getContext('2d');
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#475569',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const canvas = signatureCanvasRef.current;
                          setCustomerForm({ ...customerForm, signature: canvas.toDataURL('image/png') });
                          setIsDrawingSignature(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#10b981',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Save Signature
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDrawingSignature(false)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#ef4444',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setIsDrawingSignature(false);
                    setCustomerForm({ name: '', phone: '', aadhar: '', photo: '', signature: '' });
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#475569',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#f59e0b',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? 'Adding...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Loan Modal */}
      {showAddLoanModal && (
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
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h2 style={{ color: 'white', marginBottom: '8px', fontSize: '20px' }}>Add Daily Loan</h2>
            {selectedCustomer && (
              <p style={{ color: '#f59e0b', marginBottom: '20px' }}>For: {selectedCustomer.name}</p>
            )}
            <form onSubmit={handleAddLoan}>
              {!selectedCustomer && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Customer *</label>
                  <select
                    value={loanForm.customer_id}
                    onChange={(e) => setLoanForm({ ...loanForm, customer_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#334155',
                      color: 'white',
                      fontSize: '16px'
                    }}
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                  Asked Amount *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={loanForm.asked_amount}
                  onChange={(e) => setLoanForm({ ...loanForm, asked_amount: e.target.value.replace(/\D/g, '') })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#334155',
                    color: 'white',
                    fontSize: '16px'
                  }}
                  placeholder="e.g., 10000"
                />
                {loanForm.asked_amount && (
                  <div style={{ color: '#10b981', fontSize: '13px', marginTop: '8px' }}>
                    Give: {formatCurrency(Math.floor(loanForm.asked_amount * 0.9))} |
                    Daily: {formatCurrency(Math.floor(loanForm.asked_amount / 100))} x 100 days
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Loan Given Date *</label>
                <input
                  type="date"
                  value={loanForm.loan_given_date}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_given_date: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#334155',
                    color: 'white',
                    fontSize: '16px'
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '11px' }}>When you gave the money</small>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Payment Start Date</label>
                <input
                  type="date"
                  value={loanForm.start_date}
                  onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#334155',
                    color: 'white',
                    fontSize: '16px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLoanModal(false);
                    setSelectedCustomer(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#475569',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#f59e0b',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Details Modal */}
      {showLoanDetailsModal && selectedLoan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 1000,
          overflow: 'auto'
        }}>
          <div style={{ padding: '16px', minHeight: '100%' }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: 'white', margin: 0, fontSize: '20px' }}>Loan Details</h2>
              <button
                onClick={() => {
                  setShowLoanDetailsModal(false);
                  setSelectedLoan(null);
                }}
                style={{
                  background: '#475569',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            {/* Loan Info */}
            <div style={{
              background: '#334155',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                {selectedLoan.customer_name}
              </div>
              <div style={{ color: '#94a3b8', marginBottom: '4px' }}>{selectedLoan.customer_phone}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Asked</div>
                  <div style={{ color: 'white', fontWeight: 600 }}>{formatCurrency(selectedLoan.asked_amount)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Given</div>
                  <div style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(selectedLoan.given_amount)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Daily Amount</div>
                  <div style={{ color: '#f59e0b', fontWeight: 600 }}>{formatCurrency(selectedLoan.daily_amount)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Balance</div>
                  <div style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(selectedLoan.balance)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Days Paid</div>
                  <div style={{ color: 'white', fontWeight: 600 }}>{selectedLoan.days_paid || 0} / 100</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Status</div>
                  <div style={{
                    color: selectedLoan.status === 'active' ? '#10b981' : '#94a3b8',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {selectedLoan.status}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '12px', color: '#94a3b8', fontSize: '13px' }}>
                Started: {selectedLoan.start_date}
              </div>
              <button
                onClick={() => handleDeleteLoan(selectedLoan.id)}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete This Loan
              </button>
            </div>

            {/* Payment History */}
            <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '12px' }}>
              Payment History ({selectedLoan.payments?.length || 0})
            </h3>
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {(selectedLoan.payments || []).map(payment => (
                <div
                  key={payment.id}
                  style={{
                    background: '#334155',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ color: 'white', fontWeight: 600 }}>Day {payment.day_number}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>{payment.payment_date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(payment.amount)}</div>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      style={{
                        background: '#ef4444',
                        border: 'none',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {(!selectedLoan.payments || selectedLoan.payments.length === 0) && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                  No payments recorded yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom padding */}
      <div style={{ height: '100px' }}></div>
    </div>
  );
};

export default DailyFinance;
