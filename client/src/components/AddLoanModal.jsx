import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AddLoanModal({ customerId, customerName, customerPhone, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [loanAmount, setLoanAmount] = useState('');
  const [weeklyAmount, setWeeklyAmount] = useState('');
  const [loanGivenDate, setLoanGivenDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!customerId) {
      fetchCustomers();
    }
  }, [customerId]);

  // Auto-calculate weekly amount when loan amount changes (loan ÷ 10 weeks)
  useEffect(() => {
    if (loanAmount && parseInt(loanAmount) > 0) {
      const calculatedWeekly = Math.ceil(parseInt(loanAmount) / 10);
      setWeeklyAmount(calculatedWeekly.toString());
    }
  }, [loanAmount]);

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

  const sendWhatsAppMessage = async (customerId, loanAmount, weeklyAmount) => {
    try {
      // Get customer details
      let customerData;
      if (customerName && customerPhone) {
        // Already have customer data from props
        customerData = { name: customerName, phone: customerPhone };
      } else {
        // Fetch customer details
        const response = await fetch(`${API_URL}/customers/${customerId}`);
        customerData = await response.json();
      }

      // Format the message
      const message = `HI ${customerData.name},

You have received a loan of ₹${parseInt(loanAmount).toLocaleString('en-IN')} from Om Sai Murugan Finance.

Weekly payment: ₹${parseInt(weeklyAmount).toLocaleString('en-IN')}
Payment starts from: ${new Date(startDate).toLocaleDateString('en-IN')}

Thank you for choosing our service!

- Om Sai Murugan Finance`;

      // Open WhatsApp with pre-filled message
      // Remove any non-digits and ensure 10 digits
      const cleanPhone = customerData.phone.replace(/\D/g, '');
      const phoneWithCountryCode = `91${cleanPhone}`; // Add India country code
      const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;

      // Open in new tab
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      // Don't show error to user - WhatsApp message is optional
    }
  };

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
        // Send WhatsApp message to customer
        await sendWhatsAppMessage(selectedCustomerId, loanAmount, weeklyAmount);

        // Show success message and keep modal open
        setShowSuccess(true);
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
    <div className="modal-overlay" onClick={showSuccess ? () => { onSuccess(); onClose(); } : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{showSuccess ? '✅ Loan Created!' : 'Add New Loan'}</h3>
          <button className="close-btn" onClick={() => { onSuccess(); onClose(); }}>
            ×
          </button>
        </div>

        {showSuccess ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{
              background: '#d1fae5',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#065f46', marginBottom: '8px' }}>
                Loan Created Successfully!
              </div>
              <div style={{ fontSize: '14px', color: '#059669' }}>
                WhatsApp message opened in new tab
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
                1. Switch to WhatsApp tab<br/>
                2. Send the pre-filled message<br/>
                3. Return here and click Close
              </div>
            </div>

            <button
              onClick={() => { onSuccess(); onClose(); }}
              className="btn-primary"
              style={{ margin: 0, width: '100%' }}
            >
              Close
            </button>
          </div>
        ) : (
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
              placeholder="Auto-calculated (Loan ÷ 10)"
              min="1"
              step="1"
              required
            />
            <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              Auto-calculated as Loan Amount ÷ 10 weeks (editable)
            </small>
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
        )}
      </div>
    </div>
  );
}

export default AddLoanModal;
