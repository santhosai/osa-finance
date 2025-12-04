import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function PaymentTracker({ navigateTo }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchPaymentStatus();
  }, [selectedDate]);

  const fetchPaymentStatus = async () => {
    setLoading(true);
    try {
      // Get all customers with loans
      const customersResponse = await fetch(`${API_URL}/customers`);
      const allCustomers = await customersResponse.json();

      // For each customer, check all their active loans
      const loanStatusPromises = [];

      allCustomers.forEach((customer) => {
        // Check if customer has loans array (new structure)
        if (!customer.loans || customer.loans.length === 0) return;

        // For each active loan
        customer.loans.forEach((loan) => {
          if (loan.balance === 0) return; // Skip completed loans

          const promise = fetch(`${API_URL}/loans/${loan.loan_id}`)
            .then(res => res.json())
            .then(loanData => {
              // Check if any payment was made on selected date
              const paidOnDate = loanData.payments?.some(
                payment => payment.payment_date === selectedDate
              );

              // Get the actual payment amount if paid
              const paymentOnDate = loanData.payments?.find(
                payment => payment.payment_date === selectedDate
              );

              return {
                id: loan.loan_id,
                name: customer.name,
                phone: customer.phone,
                loan_id: loan.loan_id,
                loan_name: loan.loan_name || 'General Loan',
                loan_type: loan.loan_type || 'Weekly',
                paidOnDate,
                paidAmount: paymentOnDate?.amount || 0,
                offlineAmount: paymentOnDate?.offline_amount || 0,
                onlineAmount: paymentOnDate?.online_amount || 0,
                paymentAmount: loan.loan_type === 'Monthly' ? loan.monthly_amount : loan.weekly_amount,
                weeklyAmount: loan.weekly_amount,
                monthlyAmount: loan.monthly_amount,
                balance: loan.balance
              };
            });

          loanStatusPromises.push(promise);
        });
      });

      const results = await Promise.all(loanStatusPromises);
      setCustomers(results);
    } catch (error) {
      console.error('Error fetching payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    const csvHeader = 'Customer Name,Phone,Loan Type,Payment Amount,Balance,Paid Amount,Status\n';
    const csvRows = customers.map(customer => {
      const status = customer.paidOnDate ? 'PAID' : 'NOT PAID';
      return `${customer.name},${customer.phone},${customer.loan_type},${customer.paymentAmount},${customer.balance},${customer.paidAmount},${status}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Payment_Report_${selectedDate}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const paidCount = customers.filter(c => c.paidOnDate).length;
  const unpaidCount = customers.filter(c => !c.paidOnDate).length;

  // Calculate collection totals
  const offlineTotal = customers.reduce((sum, c) => sum + (c.offlineAmount || 0), 0);
  const onlineTotal = customers.reduce((sum, c) => sum + (c.onlineAmount || 0), 0);
  const totalCollection = offlineTotal + onlineTotal;

  const handleCustomerClick = (customer) => {
    if (!customer.paidOnDate) {
      setSelectedCustomer(customer);
      setShowPaymentModal(true);
    }
  };

  return (
    <div>
      <div className="navbar">
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('dashboard')}
          title="Back to Dashboard"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2>Payment Tracker</h2>
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={downloadReport}
          title="Download Report"
        >
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f2937' }}>
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #e5e7eb',
              fontSize: '16px',
              fontWeight: 600
            }}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{paidCount}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Paid</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{unpaidCount}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Not Paid</div>
          </div>
        </div>

        {/* Collection Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(71, 85, 105, 0.25)'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Offline Collection</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(offlineTotal)}</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(30, 64, 175, 0.25)'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Online Collection</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(onlineTotal)}</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
            padding: '16px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Collection</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(totalCollection)}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            Loading...
          </div>
        ) : customers.length === 0 ? (
          <div style={{
            background: '#f3f4f6',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            No customers with active loans
          </div>
        ) : (
          customers.map((customer) => (
            <div
              key={customer.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
                  {customer.name}
                </div>
                {customer.loan_name && customer.loan_name !== 'General Loan' && (
                  <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600, marginBottom: '4px' }}>
                    {customer.loan_name}
                  </div>
                )}
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  📱 {customer.phone}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                  {customer.loan_type === 'Monthly' ? 'Monthly' : 'Weekly'}: {formatCurrency(customer.paymentAmount)} | Balance: {formatCurrency(customer.balance)}
                </div>
              </div>

              <div
                onClick={() => handleCustomerClick(customer)}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: customer.paidOnDate ? '#d1fae5' : '#fee2e2',
                  fontSize: '28px',
                  cursor: customer.paidOnDate ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {customer.paidOnDate ? '✓' : '✗'}
              </div>
            </div>
          ))
        )}
      </div>

      {showPaymentModal && selectedCustomer && (
        <PaymentModal
          customer={selectedCustomer}
          selectedDate={selectedDate}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedCustomer(null);
            fetchPaymentStatus();
          }}
        />
      )}
    </div>
  );
}

// Payment Modal Component
function PaymentModal({ customer, selectedDate, onClose, onSuccess }) {
  const [offlineAmount, setOfflineAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  const totalAmount = parseInt(offlineAmount || 0) + parseInt(onlineAmount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (totalAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (totalAmount > customer.balance) {
      alert('Payment amount cannot exceed loan balance');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loan_id: customer.loan_id,
          amount: totalAmount,
          offline_amount: parseInt(offlineAmount || 0),
          online_amount: parseInt(onlineAmount || 0),
          payment_date: selectedDate,
          payment_mode: paymentMode,
          collected_by: localStorage.getItem('userId') || '',
          collected_by_name: localStorage.getItem('userName') || ''
        })
      });

      if (response.ok) {
        // Show success screen with Done/WhatsApp options
        setPaymentData({
          amount: totalAmount,
          offlineAmount: parseInt(offlineAmount || 0),
          onlineAmount: parseInt(onlineAmount || 0),
          date: selectedDate
        });
        setShowSuccess(true);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppMessage = () => {
    const message = `Payment Receipt

Customer: ${customer.name}
${customer.loan_name && customer.loan_name !== 'General Loan' ? `Loan: ${customer.loan_name}\n` : ''}Amount Paid: ₹${paymentData.amount.toLocaleString('en-IN')}
Date: ${new Date(paymentData.date).toLocaleDateString('en-IN')}
Balance Remaining: ₹${(customer.balance - paymentData.amount).toLocaleString('en-IN')}

Thank you for your payment!

- Om Sai Murugan Finance`;

    const cleanPhone = customer.phone.replace(/\D/g, '');
    const phoneWithCountryCode = `91${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div
      onClick={onClose}
      style={{
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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
            {showSuccess ? '✅ Payment Recorded!' : 'Record Payment'}
          </h3>
          <button
            onClick={() => { onSuccess(); onClose(); }}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '0',
              width: '32px',
              height: '32px'
            }}
          >
            ×
          </button>
        </div>

        {showSuccess ? (
          // Success Screen
          <div>
            <div style={{
              background: '#d1fae5',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#065f46', marginBottom: '8px' }}>
                Payment Recorded Successfully!
              </div>
              <div style={{ fontSize: '14px', color: '#059669' }}>
                Amount: ₹{paymentData.amount.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#6b7280',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
              <button
                onClick={() => {
                  sendWhatsAppMessage();
                  onSuccess();
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📱 WhatsApp
              </button>
            </div>
          </div>
        ) : (
          // Payment Form
          <div>

        <div style={{
          background: '#f3f4f6',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
            {customer.name}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            📱 {customer.phone}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            {customer.loan_type === 'Monthly' ? 'Monthly' : 'Weekly'}: {formatCurrency(customer.paymentAmount)}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            Balance: {formatCurrency(customer.balance)}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f2937' }}>
              Offline Amount (₹)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={offlineAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setOfflineAmount(value);
              }}
              placeholder="Enter offline collection"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f2937' }}>
              Online Amount (₹)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={onlineAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setOnlineAmount(value);
              }}
              placeholder="Enter online collection"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f2937' }}>
              Payment Mode
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="mixed">Mixed (Cash + Online)</option>
            </select>
          </div>

          <div style={{
            background: '#f1f5f9',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #1e40af'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
              Payment Summary
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>Offline:</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(parseInt(offlineAmount || 0))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>Online:</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(parseInt(onlineAmount || 0))}</span>
            </div>
            <div style={{ borderTop: '2px solid #1e40af', marginTop: '8px', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                <span style={{ fontWeight: 700, color: '#1f2937' }}>Total Amount:</span>
                <span style={{ fontWeight: 700, color: '#1e40af' }}>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                background: 'white',
                color: '#6b7280',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totalAmount <= 0}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: loading || totalAmount <= 0 ? '#9ca3af' : 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading || totalAmount <= 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentTracker;
