import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function PaymentsThisWeekModal({ onClose }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentsThisWeek();
  }, []);

  const fetchPaymentsThisWeek = async () => {
    setLoading(true);
    try {
      // Get date from 7 days ago
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      // Fetch all payments from the last 7 days
      const response = await fetch(`${API_URL}/customers`);
      const customers = await response.json();

      const paymentPromises = customers.map(async (customer) => {
        if (customer.loan_id) {
          try {
            const loanResponse = await fetch(`${API_URL}/loans/${customer.loan_id}`);
            const loanData = await loanResponse.json();

            // Filter payments from last 7 days
            const recentPayments = loanData.payments?.filter(payment => {
              return payment.payment_date >= weekAgoStr;
            }) || [];

            // Map to include customer info
            return recentPayments.map(payment => ({
              ...payment,
              customerName: customer.name,
              customerPhone: customer.phone
            }));
          } catch (error) {
            console.error('Error fetching loan:', error);
            return [];
          }
        }
        return [];
      });

      const results = await Promise.all(paymentPromises);
      const allPayments = results.flat();

      // Sort by date (newest first)
      allPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

      setPayments(allPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Payments This Week</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
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
            <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading payments...</div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : payments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
              No payments in the last 7 days
            </div>
          </div>
        ) : (
          <>
            <div style={{
              background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '16px',
              color: 'white'
            }}>
              <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>Total Collected</div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                {payments.length} payment{payments.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {payments.map((payment, index) => (
                <div
                  key={index}
                  style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '10px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 700,
                        color: '#1f2937',
                        fontSize: '15px',
                        marginBottom: '4px'
                      }}>
                        {payment.customerName}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        📱 {payment.customerPhone}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        📅 {formatDate(payment.payment_date)} • Week {payment.week_number}
                      </div>
                    </div>
                    <div style={{
                      textAlign: 'right'
                    }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#047857',
                        marginBottom: '4px'
                      }}>
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </div>
                      {payment.payment_mode && (
                        <div style={{
                          fontSize: '11px',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}>
                          {payment.payment_mode.replace('_', ' ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {(payment.offline_amount > 0 || payment.online_amount > 0) && (
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #f3f4f6',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {payment.offline_amount > 0 && (
                        <div>
                          💵 Offline: ₹{payment.offline_amount.toLocaleString('en-IN')}
                        </div>
                      )}
                      {payment.online_amount > 0 && (
                        <div>
                          💳 Online: ₹{payment.online_amount.toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentsThisWeekModal;
