import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AddPaymentModal({ loan, onClose, onSuccess }) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [offlineAmount, setOfflineAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [success, setSuccess] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);

  const amount = parseInt(offlineAmount || 0) + parseInt(onlineAmount || 0);

  const calculations = {
    weeksCovered: amount ? (amount / loan.weekly_amount).toFixed(1) : '0.0',
    newBalance: amount ? Math.max(0, loan.balance - amount) : loan.balance,
    remainingWeeks: amount
      ? Math.ceil((loan.balance - amount) / loan.weekly_amount)
      : loan.weeksRemaining,
    weekNumber: loan.payments.length + 1
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount > loan.balance) {
      alert('Payment amount cannot exceed loan balance');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loan_id: loan.id,
          amount: amount,
          offline_amount: parseInt(offlineAmount || 0),
          online_amount: parseInt(onlineAmount || 0),
          payment_date: paymentDate,
          payment_mode: paymentMode
        })
      });

      if (response.ok) {
        const data = await response.json();
        setLastPayment(data);
        setSuccess(true);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  };

  const sendWhatsAppMessage = () => {
    if (!lastPayment) return;

    const message = `Payment Receipt\n\nCustomer: ${lastPayment.customer_name}\nAmount: ₹${lastPayment.amount.toLocaleString('en-IN')}\nDate: ${new Date(lastPayment.payment_date).toLocaleDateString('en-IN')}\nWeek: ${lastPayment.week_number}\nBalance Remaining: ₹${lastPayment.balance_after.toLocaleString('en-IN')}\n\nThank you for your payment!`;

    const phoneNumber = lastPayment.customer_phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
    // Don't auto-close - let user click "Done" button
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add Payment</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Customer</label>
              <div className="customer-info-box">
                <div className="customer-info-name">{loan.customer_name}</div>
                <div className="customer-info-phone">📱 {loan.customer_phone}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input
                type="date"
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Offline Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={offlineAmount}
                onChange={(e) => setOfflineAmount(e.target.value)}
                placeholder="Enter offline collection"
                min="0"
                step="1"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Online Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={onlineAmount}
                onChange={(e) => setOnlineAmount(e.target.value)}
                placeholder="Enter online collection"
                min="0"
                step="1"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="mixed">Mixed (Cash + Online)</option>
              </select>
            </div>

            {amount > 0 && (
              <div className="calculation-box">
                <div style={{ fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                  Payment Summary
                </div>
                <div className="calc-row">
                  <span className="calc-label">Offline:</span>
                  <span className="calc-value">{formatCurrency(parseInt(offlineAmount || 0))}</span>
                </div>
                <div className="calc-row">
                  <span className="calc-label">Online:</span>
                  <span className="calc-value">{formatCurrency(parseInt(onlineAmount || 0))}</span>
                </div>
                <div className="calc-row" style={{ borderTop: '2px solid #e5e7eb', paddingTop: '8px', marginTop: '8px' }}>
                  <span className="calc-label" style={{ fontWeight: 700 }}>Total Amount:</span>
                  <span className="calc-value" style={{ fontWeight: 700, color: '#1e40af' }}>{formatCurrency(amount)}</span>
                </div>
                <div className="calc-row">
                  <span className="calc-label">Weeks covered:</span>
                  <span className="calc-value">{calculations.weeksCovered} week(s)</span>
                </div>
                <div className="calc-row">
                  <span className="calc-label">New balance:</span>
                  <span className="calc-value">{formatCurrency(calculations.newBalance)}</span>
                </div>
                <div className="calc-row">
                  <span className="calc-label">Week number:</span>
                  <span className="calc-value">Week {calculations.weekNumber}</span>
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ margin: '16px 0' }}>
              ✓ Record Payment
            </button>
          </form>
        ) : (
          <div style={{ padding: '24px' }}>
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
                Amount: ₹{lastPayment?.amount.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
                💡 <strong>Next Steps:</strong><br/>
                1. Click WhatsApp to send receipt<br/>
                2. Switch to WhatsApp tab and send message<br/>
                3. Return here and click Done
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={sendWhatsAppMessage}
                style={{
                  flex: 1,
                  background: '#25d366',
                  color: 'white',
                  border: 'none',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <svg
                  style={{ width: '20px', height: '20px' }}
                  fill="white"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp
              </button>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="btn-primary"
                style={{
                  flex: 1,
                  margin: 0
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddPaymentModal;
