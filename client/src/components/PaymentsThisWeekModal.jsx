import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function PaymentsThisWeekModal({ onClose }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPaymentsForDate();
  }, [selectedDate]);

  const fetchPaymentsForDate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/customers`);
      const customers = await response.json();

      const paidPayments = [];

      for (const customer of customers) {
        if (!customer.loans || customer.loans.length === 0) continue;

        for (const loan of customer.loans) {
          try {
            const loanResponse = await fetch(`${API_URL}/loans/${loan.loan_id}`);
            const loanData = await loanResponse.json();

            // Find payments on selected date
            const datePayments = loanData.payments?.filter(payment => {
              const paymentDate = payment.payment_date?.split('T')[0];
              return paymentDate === selectedDate;
            }) || [];

            datePayments.forEach(payment => {
              paidPayments.push({
                customerName: customer.name,
                friendName: loan.loan_name && loan.loan_name !== 'General Loan' ? loan.loan_name : null,
                amount: payment.amount
              });
            });
          } catch (error) {
            console.error('Error fetching loan:', error);
          }
        }
      }

      setPayments(paidPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3 className="modal-title">💰 Payments Collected</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Date Selector */}
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            📅 Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <div style={{ fontSize: '18px' }}>⏳ Loading...</div>
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>No payments on this date</div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div style={{ padding: '20px', overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderRadius: '8px 0 0 0' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Friend Name</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, borderRadius: '0 8px 0 0' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={index} style={{
                      background: index % 2 === 0 ? '#f9fafb' : 'white',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#1f2937' }}>{payment.customerName}</td>
                      <td style={{ padding: '12px', color: '#6b7280', fontStyle: payment.friendName ? 'normal' : 'italic' }}>
                        {payment.friendName || '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '0 0 12px 12px'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Total Collected ({payments.length})</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>₹{totalCollected.toLocaleString('en-IN')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentsThisWeekModal;
