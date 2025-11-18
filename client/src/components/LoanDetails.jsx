import { useState, useEffect } from 'react';
import AddPaymentModal from './AddPaymentModal';
import { API_URL } from '../config';

function LoanDetails({ loanId, navigateTo }) {
  const [loan, setLoan] = useState(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  useEffect(() => {
    fetchLoanDetails();
  }, [loanId]);

  const fetchLoanDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/loans/${loanId}`);
      const data = await response.json();
      setLoan(data);
    } catch (error) {
      console.error('Error fetching loan details:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const sendWhatsAppMessage = (payment) => {
    const message = `Payment Receipt\n\nCustomer: ${loan.customer_name}\nAmount: ${formatCurrency(payment.amount)}\nDate: ${formatDate(payment.payment_date)}\nWeek: ${payment.week_number}\nBalance Remaining: ${formatCurrency(payment.balance_after)}\n\nThank you for your payment!`;

    const phoneNumber = loan.customer_phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  const deletePayment = async (paymentId) => {
    const confirmed = window.confirm('Are you sure you want to delete this payment? This will update the balance and all records.');

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh loan details to update balance, progress, etc.
        fetchLoanDetails();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete payment');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Failed to delete payment');
    }
  };

  const downloadPaymentHistory = () => {
    // Create CSV content with more detailed information
    const csvHeader = 'Payment Date,Week Number,Amount Paid,Weeks Covered,Balance After Payment,Customer Name,Phone,Loan Start Date,Total Loan Amount,Weekly Payment\n';
    const csvRows = loan.payments.map(payment => {
      const date = payment.payment_date;
      return `${date},${payment.week_number},${payment.amount},${payment.weeks_covered},${payment.balance_after},${loan.customer_name},${loan.customer_phone},${loan.start_date},${loan.loan_amount},${loan.weekly_amount}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Payment_History_${loan.customer_name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!loan) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="navbar">
        <svg
          className="nav-icon"
          fill="white"
          viewBox="0 0 24 24"
          onClick={() => navigateTo('customers')}
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <h2>Loan Details</h2>
        <svg className="nav-icon" fill="white" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </div>

      <div className="loan-summary">
        <div className="loan-customer">{loan.customer_name}</div>
        <div className="loan-phone">📱 {loan.customer_phone}</div>

        <div className="loan-amount-grid">
          <div className="loan-stat">
            <div className="loan-stat-value">{formatCurrency(loan.loan_amount)}</div>
            <div className="loan-stat-label">Loan Amount</div>
          </div>
          <div className="loan-stat">
            <div className="loan-stat-value">{formatCurrency(loan.balance)}</div>
            <div className="loan-stat-label">Balance</div>
          </div>
          <div className="loan-stat">
            <div className="loan-stat-value">{formatCurrency(loan.weekly_amount)}</div>
            <div className="loan-stat-label">Weekly</div>
          </div>
          <div className="loan-stat">
            <div className="loan-stat-value">{loan.weeksRemaining}</div>
            <div className="loan-stat-label">Weeks Left</div>
          </div>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-label">
          <span>
            <strong>Progress</strong>
          </span>
          <span className={`badge ${loan.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
            {loan.status.toUpperCase()}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${loan.progressPercent}%` }}></div>
        </div>
        <div className="progress-label">
          <span>{formatCurrency(loan.totalPaid)} paid</span>
          <span>{Math.round(loan.progressPercent)}% complete</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
        <div className="section-title" style={{ padding: 0 }}>Payment History</div>
        {loan.payments.length > 0 && (
          <button
            onClick={downloadPaymentHistory}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Export
          </button>
        )}
      </div>

      <div className="payment-table">
        <div className="table-row table-header">
          <div>Date</div>
          <div>Amount</div>
          <div>Balance</div>
          <div></div>
        </div>
        {loan.payments.map((payment) => (
          <div key={payment.id} className="table-row">
            <div className="table-cell">{formatDate(payment.payment_date)}</div>
            <div className="table-cell">{formatCurrency(payment.amount)}</div>
            <div className="table-cell">{formatCurrency(payment.balance_after)}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="whatsapp-btn" onClick={() => sendWhatsAppMessage(payment)}>
                <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </button>
              <button
                onClick={() => deletePayment(payment.id)}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#b91c1c'}
                onMouseOut={(e) => e.target.style.background = '#dc2626'}
                title="Delete Payment"
              >
                <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={() => setShowAddPaymentModal(true)}>
        + Add Payment
      </button>

      {showAddPaymentModal && (
        <AddPaymentModal
          loan={loan}
          onClose={() => setShowAddPaymentModal(false)}
          onSuccess={() => {
            setShowAddPaymentModal(false);
            fetchLoanDetails();
          }}
        />
      )}
    </div>
  );
}

export default LoanDetails;
