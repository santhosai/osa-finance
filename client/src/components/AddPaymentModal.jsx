import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AddPaymentModal({ loan, onClose, onSuccess }) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('offline');
  const [success, setSuccess] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);

  const calculations = {
    weeksCovered: amount ? (parseInt(amount) / loan.weekly_amount).toFixed(1) : '0.0',
    newBalance: amount ? Math.max(0, loan.balance - parseInt(amount)) : loan.balance,
    remainingWeeks: amount
      ? Math.ceil((loan.balance - parseInt(amount)) / loan.weekly_amount)
      : loan.weeksRemaining,
    weekNumber: loan.payments.length + 1
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || parseInt(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (parseInt(amount) > loan.balance) {
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
          amount: parseInt(amount),
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
    onSuccess();
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
              <label className="form-label">Payment Mode</label>
              <select
                className="form-input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                required
              >
                <option value="offline">Offline (Cash)</option>
                <option value="online">Online (UPI/Bank Transfer)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                step="1"
                required
              />
            </div>

            {amount && parseInt(amount) > 0 && (
              <div className="calculation-box">
                <div style={{ fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                  Payment Calculation
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
                  <span className="calc-label">Remaining weeks:</span>
                  <span className="calc-value">{calculations.remainingWeeks} weeks</span>
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
          <div>
            <div className="success-box">
              <div className="success-message">✓ Payment Recorded Successfully!</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={sendWhatsAppMessage}
                  style={{
                    flex: 1,
                    background: '#25d366',
                    color: 'white',
                    border: 'none',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  <svg
                    style={{
                      width: '20px',
                      height: '20px',
                      display: 'inline-block',
                      verticalAlign: 'middle',
                      marginRight: '8px'
                    }}
                    fill="white"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={onSuccess}
                  style={{
                    flex: 1,
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddPaymentModal;
