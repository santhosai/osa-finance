import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AddCustomerModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isContactPickerSupported, setIsContactPickerSupported] = useState(false);

  // Check if Contact Picker API is supported (Android Chrome)
  useEffect(() => {
    setIsContactPickerSupported('contacts' in navigator && 'ContactsManager' in window);
  }, []);

  const pickContact = async () => {
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];

        // Set name
        if (contact.name && contact.name.length > 0) {
          setName(contact.name[0]);
        }

        // Set phone (clean it to get only digits)
        if (contact.tel && contact.tel.length > 0) {
          const phoneNumber = contact.tel[0].replace(/\D/g, '');
          // Take last 10 digits if phone has country code
          const cleanPhone = phoneNumber.length > 10 ? phoneNumber.slice(-10) : phoneNumber;
          setPhone(cleanPhone);
        }
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      // User cancelled or error occurred - do nothing
    }
  };

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
      // First, check if a customer with this phone already exists
      const checkResponse = await fetch(`${API_URL}/customers?search=${cleanPhone}`);
      if (checkResponse.ok) {
        const existingCustomers = await checkResponse.json();
        const customerWithSamePhone = existingCustomers.find(c => c.phone === cleanPhone);

        if (customerWithSamePhone) {
          // Customer already exists - show helpful message
          const confirmAddLoan = window.confirm(
            `Customer "${customerWithSamePhone.name}" with phone ${cleanPhone} already exists.\n\n` +
            `To add a new loan for this customer:\n` +
            `1. Close this dialog\n` +
            `2. Click "Add Loan" button\n` +
            `3. Select "${customerWithSamePhone.name}" from the customer dropdown\n\n` +
            `Click OK to close this dialog.`
          );
          if (confirmAddLoan) {
            onClose();
          }
          return;
        }
      }

      // No existing customer found - proceed to create new customer
      const response = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Pass the new customer ID to onSuccess
        onSuccess(data.id);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add New Customer</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isContactPickerSupported && (
            <button
              type="button"
              onClick={pickContact}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '16px',
                boxShadow: '0 3px 8px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 5px 12px rgba(59, 130, 246, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 3px 8px rgba(59, 130, 246, 0.3)';
              }}
            >
              📱 Pick from Phone Contacts
            </button>
          )}

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
            Add Customer
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddCustomerModal;
