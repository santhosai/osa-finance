import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AddLoanModal({ customerId, customerName, customerPhone, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [loanAmount, setLoanAmount] = useState('');
  const [weeklyAmount, setWeeklyAmount] = useState('');
  const [loanGivenDate, setLoanGivenDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!customerId) {
      fetchCustomers();
    }
  }, [customerId]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API_URL}/customers`);
      const data = await response.json();
      // Filter out customers who already have active loans
      const availableCustomers = data.filter((c) => !c.loan_id);
      setCustomers(availableCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const totalWeeks = loanAmount && weeklyAmount ? Math.ceil(parseInt(loanAmount) / parseInt(weeklyAmount)) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }

    if (!loanAmount || parseInt(loanAmount) <= 0) {
      alert('Please enter a valid loan amount');
      return;
    }

    if (!weeklyAmount || parseInt(weeklyAmount) <= 0) {
      alert('Please enter a valid weekly payment amount');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          loan_amount: parseInt(loanAmount),
          weekly_amount: parseInt(weeklyAmount),
          loan_given_date: loanGivenDate,
          start_date: startDate
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create loan');
      }
    } catch (error) {
      console.error('Error creating loan:', error);
      alert('Failed to create loan');
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add New Loan</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer</label>
            {customerId ? (
              <div className="customer-info-box">
                <div className="customer-info-name">{customerName}</div>
                <div className="customer-info-phone">📱 {customerPhone}</div>
              </div>
            ) : (
              <select
                className="form-input"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Loan Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="Enter loan amount"
              min="1"
              step="1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Weekly Payment (₹)</label>
            <input
              type="number"
              className="form-input"
              value={weeklyAmount}
              onChange={(e) => setWeeklyAmount(e.target.value)}
              placeholder="Enter weekly payment amount"
              min="1"
              step="1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Loan Given Date</label>
            <input
              type="date"
              className="form-input"
              value={loanGivenDate}
              onChange={(e) => setLoanGivenDate(e.target.value)}
              required
            />
            <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              When you actually gave them the money
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              When they start paying weekly (usually next Sunday)
            </small>
          </div>

          {loanAmount && weeklyAmount && parseInt(loanAmount) > 0 && parseInt(weeklyAmount) > 0 && (
            <div className="calculation-box">
              <div style={{ fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                Loan Summary
              </div>
              <div className="calc-row">
                <span className="calc-label">Total loan amount:</span>
                <span className="calc-value">{formatCurrency(parseInt(loanAmount))}</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">Weekly payment:</span>
                <span className="calc-value">{formatCurrency(parseInt(weeklyAmount))}</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">Total weeks:</span>
                <span className="calc-value">{totalWeeks} weeks</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">Estimated completion:</span>
                <span className="calc-value">
                  {new Date(
                    new Date(startDate).getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ margin: '16px 0' }}>
            Create Loan
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddLoanModal;
