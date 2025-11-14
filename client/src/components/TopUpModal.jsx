import { useState } from 'react';
import { API_URL } from '../config';

function TopUpModal({ loan, onClose, onSuccess }) {
  const [topUpAmount, setTopUpAmount] = useState('');

  const newLoanAmount = topUpAmount ? loan.loan_amount + parseInt(topUpAmount) : loan.loan_amount;
  const newBalance = topUpAmount ? loan.balance + parseInt(topUpAmount) : loan.balance;
  const additionalWeeks = topUpAmount ? Math.ceil(parseInt(topUpAmount) / loan.weekly_amount) : 0;
  const newTotalWeeks = Math.ceil(newLoanAmount / loan.weekly_amount);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!topUpAmount || parseInt(topUpAmount) <= 0) {
      alert('Please enter a valid top-up amount');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/loans/${loan.id}/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseInt(topUpAmount)
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to top up loan');
      }
    } catch (error) {
      console.error('Error topping up loan:', error);
      alert('Failed to top up loan');
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Top-up Loan</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer</label>
            <div className="customer-info-box">
              <div className="customer-info-name">{loan.customer_name}</div>
              <div className="customer-info-phone">📱 {loan.customer_phone}</div>
            </div>
          </div>

          <div
            style={{
              background: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}
          >
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Current Balance
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
              {formatCurrency(loan.balance)}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Top-up Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Enter additional loan amount"
              min="0"
              step="100"
              required
            />
          </div>

          {topUpAmount && parseInt(topUpAmount) > 0 && (
            <div className="calculation-box">
              <div style={{ fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                After Top-up
              </div>
              <div className="calc-row">
                <span className="calc-label">New total loan:</span>
                <span className="calc-value">{formatCurrency(newLoanAmount)}</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">New balance:</span>
                <span className="calc-value">{formatCurrency(newBalance)}</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">Additional weeks:</span>
                <span className="calc-value">+{additionalWeeks} weeks</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">Total weeks remaining:</span>
                <span className="calc-value">{Math.ceil(newBalance / loan.weekly_amount)} weeks</span>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ margin: '16px 0' }}>
            Confirm Top-up
          </button>
        </form>
      </div>
    </div>
  );
}

export default TopUpModal;
