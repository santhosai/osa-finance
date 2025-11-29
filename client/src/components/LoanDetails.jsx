import { useState } from 'react';
import useSWR from 'swr';
import AddPaymentModal from './AddPaymentModal';
import AddLoanModal from './AddLoanModal';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function LoanDetails({ loanId, navigateTo }) {
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Use SWR for automatic caching and re-fetching
  const { data: loan, error, isLoading, mutate } = useSWR(
    loanId ? `${API_URL}/loans/${loanId}` : null,
    fetcher,
    {
      refreshInterval: 0, // Don't auto-refresh (save bandwidth)
      revalidateOnFocus: true, // Refresh when user returns to tab
      dedupingInterval: 2000, // Prevent duplicate requests within 2s
    }
  );

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

  const updateLoanName = async (newName) => {
    try {
      const response = await fetch(`${API_URL}/loans/${loan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loan_name: newName
        })
      });

      if (response.ok) {
        mutate(); // SWR: Re-fetch data to show updated name
        alert('Loan name updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update loan name');
      }
    } catch (error) {
      console.error('Error updating loan name:', error);
      alert('Failed to update loan name');
    }
  };

  const openEditModal = () => {
    setEditFormData({
      loan_name: loan.loan_name || '',
      loan_given_date: loan.loan_given_date || '',
      start_date: loan.start_date || '',
      loan_amount: loan.loan_amount || 0,
      weekly_amount: loan.weekly_amount || 0,
      monthly_amount: loan.monthly_amount || 0,
      balance: loan.balance || 0
    });
    setShowEditLoanModal(true);
  };

  const updateLoanDetails = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`${API_URL}/loans/${loan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        mutate();
        setShowEditLoanModal(false);
        alert('Loan details updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update loan details');
      }
    } catch (error) {
      console.error('Error updating loan:', error);
      alert('Failed to update loan details');
    } finally {
      setIsUpdating(false);
    }
  };

  const sendWhatsAppMessage = (payment) => {
    const loanType = loan.loan_type || 'Weekly';
    const periodLabel = loanType === 'Weekly' ? 'Week' : 'Month';
    const periodNumber = payment.period_number || payment.week_number;

    const message = `Payment Receipt\n\nCustomer: ${loan.customer_name}\nAmount: ${formatCurrency(payment.amount)}\nDate: ${formatDate(payment.payment_date)}\n${periodLabel}: ${periodNumber}\nBalance Remaining: ${formatCurrency(payment.balance_after)}\n\nThank you for your payment!`;

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
        mutate(); // SWR: Re-fetch data automatically
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete payment');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Failed to delete payment');
    }
  };

  const closeLoan = async () => {
    const message = loan.balance > 0
      ? `Are you sure you want to close this loan?\n\nRemaining balance: ₹${loan.balance.toLocaleString('en-IN')}\n\nThis balance will be written off and the loan will be marked as closed.`
      : 'Are you sure you want to close this loan?';

    const confirmed = window.confirm(message);

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/loans/${loan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'closed'
        })
      });

      if (response.ok) {
        alert('Loan closed successfully!');
        navigateTo('customers');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to close loan');
      }
    } catch (error) {
      console.error('Error closing loan:', error);
      alert('Failed to close loan');
    }
  };

  const archiveLoan = async () => {
    const confirmed = window.confirm(
      `Archive this loan?\n\nThis will move the loan and all payment history to the archive.\n\n• Customer: ${loan.customer_name}\n• Amount: ₹${loan.loan_amount.toLocaleString('en-IN')}\n• Payments: ${loan.payments.length}\n\nYou can restore it later from the Archive section.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/loans/${loan.id}/archive`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('Loan archived successfully! You can find it in the Archive section.');
        navigateTo('customers');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to archive loan');
      }
    } catch (error) {
      console.error('Error archiving loan:', error);
      alert('Failed to archive loan');
    }
  };

  const downloadPaymentHistory = () => {
    const loanType = loan.loan_type || 'Weekly';
    const periodLabel = loanType === 'Weekly' ? 'Week' : 'Month';
    const paymentAmount = loanType === 'Weekly' ? loan.weekly_amount : loan.monthly_amount;

    // Create CSV content with more detailed information
    const csvHeader = `Payment Date,${periodLabel} Number,Amount Paid,${periodLabel}s Covered,Balance After Payment,Customer Name,Phone,Loan Start Date,Total Loan Amount,${periodLabel}ly Payment\n`;
    const csvRows = loan.payments.map(payment => {
      const date = payment.payment_date;
      return `${date},${payment.period_number || payment.week_number},${payment.amount},${payment.periods_covered || payment.weeks_covered},${payment.balance_after},${loan.customer_name},${loan.customer_phone},${loan.start_date},${loan.loan_amount},${paymentAmount}`;
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

  if (isLoading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6b7280'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          animation: 'spin 1s linear infinite'
        }}>⏳</div>
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading loan details...</div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!loan) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        background: 'white',
        margin: '16px',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
          Loan not found
        </div>
      </div>
    );
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
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#3b82f6',
          marginTop: '8px',
          padding: '8px 12px',
          background: '#dbeafe',
          borderRadius: '8px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          {loan.loan_name || 'General Loan'}
          <button
            onClick={() => {
              const newName = prompt('Enter loan name/responsible person:', loan.loan_name || '');
              if (newName !== null && newName.trim() !== '') {
                updateLoanName(newName.trim());
              }
            }}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Edit loan name"
          >
            ✏️ Edit
          </button>
        </div>

        {/* Loan Dates Section with Edit Button */}
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: '#f1f5f9',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: '#1e40af' }}>
                📅 {loan.loan_given_date ? formatDate(loan.loan_given_date) : 'Not Set'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Loan Given</div>
            </div>
            <div style={{ borderLeft: '1px solid #cbd5e1', margin: '0 8px', height: '30px' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: '#047857' }}>
                🗓️ {loan.start_date ? formatDate(loan.start_date) : 'Not Set'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Payments Start</div>
            </div>
          </div>
          <button
            onClick={openEditModal}
            style={{
              width: '100%',
              marginTop: '10px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            ✏️ Edit Loan Details
          </button>
        </div>

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
            <div className="loan-stat-value">
              {formatCurrency((loan.loan_type === 'Monthly' ? loan.monthly_amount : loan.weekly_amount) || 0)}
            </div>
            <div className="loan-stat-label">{loan.loan_type === 'Monthly' ? 'Monthly' : 'Weekly'}</div>
          </div>
          <div className="loan-stat">
            <div className="loan-stat-value">{loan.periodsRemaining || loan.weeksRemaining}</div>
            <div className="loan-stat-label">{loan.loan_type === 'Monthly' ? 'Months Left' : 'Weeks Left'}</div>
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

      <div style={{ display: 'flex', gap: '12px', padding: '16px', flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={() => setShowAddPaymentModal(true)} style={{ flex: 1, margin: 0, minWidth: '140px' }}>
          + Add Payment
        </button>

        <button
          onClick={() => setShowAddLoanModal(true)}
          style={{
            flex: 1,
            margin: 0,
            minWidth: '140px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          + Add Another Loan
        </button>

        {loan.status === 'active' && (
          <button
            onClick={closeLoan}
            style={{
              flex: 1,
              minWidth: '140px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#b91c1c'}
            onMouseOut={(e) => e.target.style.background = '#dc2626'}
          >
            ✓ Close Loan
          </button>
        )}

        {loan.status === 'closed' && (
          <button
            onClick={archiveLoan}
            style={{
              flex: 1,
              minWidth: '140px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            📦 Archive Loan
          </button>
        )}
      </div>

      {showAddPaymentModal && (
        <AddPaymentModal
          loan={loan}
          onClose={() => setShowAddPaymentModal(false)}
          onSuccess={() => {
            setShowAddPaymentModal(false);
            mutate(); // SWR: Re-fetch data automatically
          }}
        />
      )}

      {showAddLoanModal && (
        <AddLoanModal
          customerId={loan.customer_id}
          customerName={loan.customer_name}
          customerPhone={loan.customer_phone}
          onClose={() => setShowAddLoanModal(false)}
          onSuccess={() => {
            setShowAddLoanModal(false);
            alert('New loan added successfully! You can view it from the customer list.');
            navigateTo('customers');
          }}
        />
      )}

      {/* Edit Loan Modal */}
      {showEditLoanModal && (
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
          padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '16px 16px 0 0',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>✏️ Edit Loan Details</h3>
              <button
                onClick={() => setShowEditLoanModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >×</button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                  Loan Name
                </label>
                <input
                  type="text"
                  value={editFormData.loan_name}
                  onChange={(e) => setEditFormData({...editFormData, loan_name: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="e.g., General Loan"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                  📅 Loan Given Date
                </label>
                <input
                  type="date"
                  value={editFormData.loan_given_date}
                  onChange={(e) => setEditFormData({...editFormData, loan_given_date: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                  🗓️ Payment Start Date
                </label>
                <input
                  type="date"
                  value={editFormData.start_date}
                  onChange={(e) => setEditFormData({...editFormData, start_date: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    Loan Amount
                  </label>
                  <input
                    type="number"
                    value={editFormData.loan_amount}
                    onChange={(e) => setEditFormData({...editFormData, loan_amount: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    Balance
                  </label>
                  <input
                    type="number"
                    value={editFormData.balance}
                    onChange={(e) => setEditFormData({...editFormData, balance: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    Weekly Amount
                  </label>
                  <input
                    type="number"
                    value={editFormData.weekly_amount}
                    onChange={(e) => setEditFormData({...editFormData, weekly_amount: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    Monthly Amount
                  </label>
                  <input
                    type="number"
                    value={editFormData.monthly_amount}
                    onChange={(e) => setEditFormData({...editFormData, monthly_amount: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowEditLoanModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    background: 'white',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={updateLoanDetails}
                  disabled={isUpdating}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    background: isUpdating ? '#9ca3af' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: isUpdating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUpdating ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoanDetails;
