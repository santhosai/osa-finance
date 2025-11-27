import { useState } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

const fetcher = (url) => fetch(url).then(res => res.json());

const ArchivedLoans = ({ navigateTo }) => {
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: archivedLoans = [], isLoading, mutate } = useSWR(
    `${API_URL}/archived-loans`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  const restoreLoan = async (loanId) => {
    const confirmed = window.confirm(
      'Restore this loan?\n\nThis will move the loan back to active loans with all its payment history.'
    );

    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const response = await fetch(`${API_URL}/archived-loans/${loanId}/restore`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('Loan restored successfully!');
        setSelectedLoan(null);
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to restore loan');
      }
    } catch (error) {
      console.error('Error restoring loan:', error);
      alert('Failed to restore loan');
    } finally {
      setIsRestoring(false);
    }
  };

  const deletePermanently = async (loanId) => {
    const confirmed = window.confirm(
      '⚠️ DELETE PERMANENTLY?\n\nThis will permanently delete this archived loan and ALL its payment history.\n\nThis action CANNOT be undone!'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'Are you ABSOLUTELY SURE?\n\nType "yes" in your mind and click OK to proceed.'
    );

    if (!doubleConfirm) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/archived-loans/${loanId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Archived loan deleted permanently.');
        setSelectedLoan(null);
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete loan');
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
      alert('Failed to delete loan');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading archived loans...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button
          onClick={() => navigateTo('dashboard')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
            📦 Archived Loans
          </h2>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginTop: '2px' }}>
            {archivedLoans.length} archived loan{archivedLoans.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {archivedLoans.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
              No Archived Loans
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Closed loans that you archive will appear here
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {archivedLoans.map(loan => (
              <div
                key={loan.id}
                onClick={() => setSelectedLoan(loan)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                      {loan.customer_name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      📞 {loan.customer_phone}
                    </div>
                    {loan.loan_name && loan.loan_name !== 'General Loan' && (
                      <div style={{ fontSize: '12px', color: '#6366f1', marginTop: '4px', fontWeight: 600 }}>
                        {loan.loan_name}
                      </div>
                    )}
                  </div>
                  <div style={{
                    background: '#f0f9ff',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#3b82f6',
                    fontWeight: 600
                  }}>
                    {loan.loan_type || 'Weekly'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                      {formatCurrency(loan.loan_amount)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>Loan Amount</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#f0fdf4', borderRadius: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                      {formatCurrency(loan.total_paid)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>Paid</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#fef2f2', borderRadius: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>
                      {formatCurrency(loan.balance)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>Balance</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    📅 Archived: {formatDate(loan.archived_at)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    💳 {loan.total_payments} payment{loan.total_payments !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLoan && (
        <div
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
            padding: '16px'
          }}
          onClick={() => setSelectedLoan(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              padding: '20px',
              borderRadius: '16px 16px 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>
                    {selectedLoan.customer_name}
                  </h3>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>
                    📞 {selectedLoan.customer_phone}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLoan(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px' }}>
              {/* Loan Info */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                  Loan Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Loan Amount</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {formatCurrency(selectedLoan.loan_amount)}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Balance</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: selectedLoan.balance > 0 ? '#ef4444' : '#10b981' }}>
                      {formatCurrency(selectedLoan.balance)}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Type</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {selectedLoan.loan_type || 'Weekly'}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Payments</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {selectedLoan.total_payments}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                  Timeline
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Loan Given:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{formatDate(selectedLoan.loan_given_date)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Start Date:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{formatDate(selectedLoan.start_date)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Archived:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{formatDate(selectedLoan.archived_at)}</span>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              {selectedLoan.payments && selectedLoan.payments.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                    Payment History ({selectedLoan.payments.length})
                  </div>
                  <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    {selectedLoan.payments
                      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                      .map((payment, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderBottom: index < selectedLoan.payments.length - 1 ? '1px solid #f3f4f6' : 'none',
                          fontSize: '13px'
                        }}
                      >
                        <span style={{ color: '#6b7280' }}>{formatDate(payment.payment_date)}</span>
                        <span style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'grid', gap: '10px' }}>
                <button
                  onClick={() => restoreLoan(selectedLoan.id)}
                  disabled={isRestoring}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: isRestoring ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: isRestoring ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isRestoring ? 'Restoring...' : '↩️ Restore Loan'}
                </button>
                <button
                  onClick={() => deletePermanently(selectedLoan.id)}
                  disabled={isDeleting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: isDeleting ? '#9ca3af' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: isDeleting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isDeleting ? 'Deleting...' : '🗑️ Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedLoans;
