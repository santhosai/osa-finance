import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import AddCustomerModal from './AddCustomerModal';

function AddLoanModal({ customerId, customerName, customerPhone, onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [loanType, setLoanType] = useState('Weekly'); // Weekly or Monthly
  const [loanName, setLoanName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [weeklyAmount, setWeeklyAmount] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [loanGivenDate, setLoanGivenDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  useEffect(() => {
    if (!customerId) {
      fetchCustomers();
    }
  }, [customerId]);

  // Auto-calculate payment amount when loan amount or loan type changes
  useEffect(() => {
    if (loanAmount && parseInt(loanAmount) > 0) {
      if (loanType === 'Weekly') {
        const calculatedWeekly = Math.ceil(parseInt(loanAmount) / 10);
        setWeeklyAmount(calculatedWeekly.toString());
      } else if (loanType === 'Monthly') {
        const calculatedMonthly = Math.ceil(parseInt(loanAmount) / 5);
        setMonthlyAmount(calculatedMonthly.toString());
      }
    }
  }, [loanAmount, loanType]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API_URL}/customers`);
      const data = await response.json();
      // Show ALL customers - they can have multiple loans
      // Sort by name for easier selection
      const sortedCustomers = data.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(sortedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  // Calculate total periods based on loan type
  const totalPeriods = loanAmount && (
    loanType === 'Weekly' && weeklyAmount ? Math.ceil(parseInt(loanAmount) / parseInt(weeklyAmount)) :
    loanType === 'Monthly' && monthlyAmount ? Math.ceil(parseInt(loanAmount) / parseInt(monthlyAmount)) : 0
  );

  const sendWhatsAppMessage = async (customerId, loanAmount, paymentAmount, loanType) => {
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

      // Format the message based on loan type
      let message;
      if (loanType === 'Weekly') {
        message = `HI ${customerData.name},

You have received a loan of ₹${parseInt(loanAmount).toLocaleString('en-IN')} from Om Sai Murugan Finance.

Weekly payment: ₹${parseInt(paymentAmount).toLocaleString('en-IN')}
Payment starts from: ${new Date(startDate).toLocaleDateString('en-IN')}

Thank you for choosing our service!

- Om Sai Murugan Finance`;
      } else if (loanType === 'Monthly') {
        message = `HI ${customerData.name},

You have received a loan of ₹${parseInt(loanAmount).toLocaleString('en-IN')} from Om Sai Murugan Finance.

Monthly payment: ₹${parseInt(paymentAmount).toLocaleString('en-IN')}
Total months: 5
Payment starts from: ${new Date(startDate).toLocaleDateString('en-IN')}

Thank you for choosing our service!

- Om Sai Murugan Finance`;
      }

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

    // Validate based on loan type
    if (loanType === 'Weekly') {
      if (!weeklyAmount || parseInt(weeklyAmount) <= 0) {
        alert('Please enter a valid weekly payment amount');
        return;
      }
    } else if (loanType === 'Monthly') {
      if (!monthlyAmount || parseInt(monthlyAmount) <= 0) {
        alert('Please enter a valid monthly payment amount');
        return;
      }
    }

    try {
      const response = await fetch(`${API_URL}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          loan_name: loanName.trim() || 'General Loan', // Default if empty
          loan_type: loanType,
          loan_amount: parseInt(loanAmount),
          weekly_amount: loanType === 'Weekly' ? parseInt(weeklyAmount) : 0,
          monthly_amount: loanType === 'Monthly' ? parseInt(monthlyAmount) : 0,
          loan_given_date: loanGivenDate,
          start_date: startDate
        })
      });

      if (response.ok) {
        // Send WhatsApp message to customer
        const paymentAmount = loanType === 'Weekly' ? weeklyAmount : monthlyAmount;
        await sendWhatsAppMessage(selectedCustomerId, loanAmount, paymentAmount, loanType);

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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <select
                  className="form-input"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  style={{ flex: 1 }}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.phone})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 16px',
                    cursor: 'pointer',
                    fontSize: '20px',
                    fontWeight: 600,
                    minWidth: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  title="Add new customer"
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Loan Type</label>
            <select
              className="form-input"
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              required
              style={{ fontSize: '14px', fontWeight: 600 }}
            >
              <option value="Weekly">Weekly Finance (10 weeks)</option>
              <option value="Monthly">Monthly Finance (5 months)</option>
            </select>
            <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              {loanType === 'Weekly' ? '10 weekly payments on Sundays' : '5 monthly payments (any date)'}
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Friend Name</label>
            <input
              type="text"
              className="form-input"
              value={loanName}
              onChange={(e) => setLoanName(e.target.value)}
              placeholder="e.g., Ravi, Lakshmi, Karthik"
              maxLength="50"
            />
            <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              Optional - helps identify loan when customer has multiple loans
            </small>
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

          {loanType === 'Weekly' && (
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
          )}

          {loanType === 'Monthly' && (
            <div className="form-group">
              <label className="form-label">Monthly Payment (₹)</label>
              <input
                type="number"
                className="form-input"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                placeholder="Auto-calculated (Loan ÷ 5)"
                min="1"
                step="1"
                required
              />
              <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                Auto-calculated as Loan Amount ÷ 5 months (editable)
              </small>
            </div>
          )}

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
              {loanType === 'Weekly'
                ? 'When they start paying weekly (must be a Sunday)'
                : 'When they start paying monthly (any date)'}
            </small>
          </div>

          {loanAmount && ((loanType === 'Weekly' && weeklyAmount && parseInt(weeklyAmount) > 0) ||
                          (loanType === 'Monthly' && monthlyAmount && parseInt(monthlyAmount) > 0)) &&
           parseInt(loanAmount) > 0 && (
            <div className="calculation-box">
              <div style={{ fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                Loan Summary
              </div>
              <div className="calc-row">
                <span className="calc-label">Total loan amount:</span>
                <span className="calc-value">{formatCurrency(parseInt(loanAmount))}</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">{loanType === 'Weekly' ? 'Weekly payment:' : 'Monthly payment:'}</span>
                <span className="calc-value">
                  {formatCurrency(parseInt(loanType === 'Weekly' ? weeklyAmount : monthlyAmount))}
                </span>
              </div>
              <div className="calc-row">
                <span className="calc-label">{loanType === 'Weekly' ? 'Total weeks:' : 'Total months:'}</span>
                <span className="calc-value">{totalPeriods} {loanType === 'Weekly' ? 'weeks' : 'months'}</span>
              </div>
              <div className="calc-row">
                <span className="calc-label">Estimated completion:</span>
                <span className="calc-value">
                  {new Date(
                    new Date(startDate).getTime() +
                    totalPeriods * (loanType === 'Weekly' ? 7 : 30) * 24 * 60 * 60 * 1000
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

      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={(newCustomerId) => {
            setShowAddCustomerModal(false);
            // Refresh customer list
            fetchCustomers();
            // Auto-select the newly created customer
            if (newCustomerId) {
              setSelectedCustomerId(newCustomerId);
            }
          }}
        />
      )}
    </div>
  );
}

export default AddLoanModal;
