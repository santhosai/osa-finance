import { useState } from 'react';
import { API_URL } from '../config';

function EditCustomerModal({ customer, activeTab, onClose, onSuccess }) {
  const [name, setName] = useState(customer.name || '');
  const [phone, setPhone] = useState(customer.phone || '');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !phone) {
      alert('Please fill in all fields');
      return;
    }

    // Validate phone number (should be 10 digits)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      let url, body;

      if (activeTab === 'monthly') {
        // Monthly Finance: update name/phone only — keep all financial data unchanged
        url = `${API_URL}/monthly-finance/customers/${customer.id}`;
        body = {
          name: name.trim(),
          phone: cleanPhone,
          loan_amount: customer.loan_amount,
          monthly_amount: customer.monthly_amount,
          total_months: customer.total_months,
          start_date: customer.start_date,
          loan_given_date: customer.loan_given_date || customer.start_date,
        };
      } else {
        // Weekly: update name and phone only
        url = `${API_URL}/customers/${customer.id}`;
        body = { name: name.trim(), phone: cleanPhone };
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Customer</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter customer name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter 10-digit phone number"
              pattern="[0-9]{10}"
              required
            />
            <small style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              Enter 10-digit mobile number without country code
            </small>
          </div>

          <button type="submit" className="btn-primary" style={{ margin: '16px 0' }}>
            Update Customer
          </button>
        </form>
      </div>
    </div>
  );
}

export default EditCustomerModal;
