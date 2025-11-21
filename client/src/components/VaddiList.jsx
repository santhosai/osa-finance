import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

const VaddiList = ({ navigateTo }) => {
  const [formData, setFormData] = useState({
    name: '',
    principalAmount: '',
    monthlyInterest: '',
    date: '',
    phone: ''
  });
  const [showReminder, setShowReminder] = useState(false);
  const [todaysReminders, setTodaysReminders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Use SWR for data fetching with auto-refresh
  const { data: entries = [], error, isLoading, mutate } = useSWR(`${API_URL}/vaddi-entries`, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    revalidateOnFocus: true,
    dedupingInterval: 2000,
    onError: (err) => {
      console.error('SWR Error fetching vaddi entries:', err);
    }
  });

  // Ensure entries is always an array and filter out invalid entries
  const safeEntries = Array.isArray(entries)
    ? entries.filter(entry => {
        // Filter out entries that are null, undefined, or missing critical fields
        if (!entry || typeof entry !== 'object') {
          console.warn('Invalid entry (not an object):', entry);
          return false;
        }
        if (!entry.id || !entry.name || !entry.date) {
          console.warn('Entry missing required fields (id, name, or date):', entry);
          return false;
        }
        return true;
      })
    : [];

  // Log filtered entries count for debugging
  if (Array.isArray(entries) && entries.length !== safeEntries.length) {
    console.warn(`Filtered out ${entries.length - safeEntries.length} invalid entries`);
  }

  // Check for reminders on mount and when entries change
  useEffect(() => {
    if (safeEntries.length > 0) {
      checkReminders(safeEntries);
    }
  }, [safeEntries]);

  // Check for reminders on current date
  const checkReminders = (entriesList) => {
    const today = new Date().toISOString().split('T')[0];
    const reminders = entriesList.filter(entry => !entry.paid && entry.date === today);

    if (reminders.length > 0) {
      setTodaysReminders(reminders);
      setShowReminder(true);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Select contact from phone's contact list
  const selectFromContacts = async () => {
    // Check if Contact Picker API is supported
    if (!('contacts' in navigator)) {
      alert('Contact picker is not supported on this device/browser. Please use Chrome on Android for best experience.');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };

      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];

        // Extract phone number (remove all non-digits)
        let phone = '';
        if (contact.tel && contact.tel.length > 0) {
          phone = contact.tel[0].replace(/\D/g, ''); // Remove all non-digits
          // Get last 10 digits if number is longer (for country codes)
          if (phone.length > 10) {
            phone = phone.slice(-10);
          }
        }

        // Update form with contact data
        setFormData(prev => ({
          ...prev,
          name: contact.name && contact.name[0] ? contact.name[0] : prev.name,
          phone: phone
        }));
      }
    } catch (error) {
      // User cancelled the picker or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error selecting contact:', error);
        alert('Failed to select contact: ' + error.message);
      }
    }
  };

  // Add new entry
  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.principalAmount || !formData.monthlyInterest || !formData.date || !formData.phone) {
      alert('Please fill all required fields');
      return;
    }

    // Validate phone number
    if (formData.phone.length !== 10) {
      alert('Phone number must be 10 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // Refresh data
      mutate();

      // Reset form
      setFormData({ name: '', principalAmount: '', monthlyInterest: '', date: '', phone: '' });

      // Send WhatsApp notification if phone exists
      if (formData.phone) {
        const message = `New Vaddi Entry Created

Name: ${formData.name}
Principal Amount Lent: ₹${parseFloat(formData.principalAmount).toLocaleString('en-IN')}
Monthly Interest: ₹${parseFloat(formData.monthlyInterest).toLocaleString('en-IN')}
Start Date: ${new Date(formData.date).toLocaleDateString('en-IN')}

Please pay monthly interest until principal is returned.

- Om Sai Murugan Finance`;

        const cleanPhone = formData.phone.replace(/\D/g, '');
        const phoneWithCountryCode = `91${cleanPhone}`;
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error creating vaddi entry:', error);
      alert('Failed to create entry: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete entry
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete vaddi entry');
      }

      // Refresh data
      mutate();
    } catch (error) {
      console.error('Error deleting vaddi entry:', error);
      alert('Failed to delete entry: ' + error.message);
    }
  };

  // Mark as paid and send receipt
  const markAsPaid = async (entry) => {
    if (!entry.phone) {
      const confirmed = window.confirm('No phone number for this entry. Mark as paid anyway?');
      if (!confirmed) return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid: true,
          paidDate: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update vaddi entry');
      }

      // Refresh data
      mutate();

      // Send WhatsApp receipt if phone available
      if (entry.phone) {
        const principalAmount = entry.principalAmount || entry.amount || 0;
        const message = `Payment Receipt - Monthly Interest

Name: ${entry.name}
Amount Paid: ₹${principalAmount.toLocaleString('en-IN')}
Paid Date: ${new Date().toLocaleDateString('en-IN')}

Thank you for your payment!

- Om Sai Murugan Finance`;

        const cleanPhone = entry.phone.replace(/\D/g, '');
        const phoneWithCountryCode = `91${cleanPhone}`;
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to mark as paid: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Record interest payment
  const recordInterestPayment = async (entry) => {
    const principalAmount = entry.principalAmount || entry.amount || 0;
    const monthlyInterest = entry.monthlyInterest || 0;

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${entry.id}/interest-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: new Date().toISOString().split('T')[0],
          amount: monthlyInterest
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record interest payment');
      }

      // Refresh data
      mutate();

      // Send WhatsApp receipt if phone available
      if (entry.phone) {
        const message = `Payment Receipt - Monthly Interest

Name: ${entry.name}
Interest Paid: ₹${monthlyInterest.toLocaleString('en-IN')}
Payment Date: ${new Date().toLocaleDateString('en-IN')}
Principal Amount: ₹${principalAmount.toLocaleString('en-IN')}

Thank you for your payment!

- Om Sai Murugan Finance`;

        const cleanPhone = entry.phone.replace(/\D/g, '');
        const phoneWithCountryCode = `91${cleanPhone}`;
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      alert('Interest payment recorded successfully!');
    } catch (error) {
      console.error('Error recording interest payment:', error);
      alert('Failed to record interest payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark principal as returned
  const markPrincipalReturned = async (entry) => {
    const confirmed = window.confirm('Mark the principal amount as RETURNED? This means the customer has paid back the full amount.');
    if (!confirmed) return;

    const principalAmount = entry.principalAmount || entry.amount || 0;

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${entry.id}/principal-returned`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnDate: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark principal as returned');
      }

      // Refresh data
      mutate();

      // Send WhatsApp receipt if phone available
      if (entry.phone) {
        const message = `Receipt - Principal Amount Returned

Name: ${entry.name}
Principal Amount: ₹${principalAmount.toLocaleString('en-IN')}
Return Date: ${new Date().toLocaleDateString('en-IN')}

Thank you for returning the principal amount!

- Om Sai Murugan Finance`;

        const cleanPhone = entry.phone.replace(/\D/g, '');
        const phoneWithCountryCode = `91${cleanPhone}`;
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      alert('Principal marked as returned successfully!');
    } catch (error) {
      console.error('Error marking principal as returned:', error);
      alert('Failed to mark principal as returned: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Send WhatsApp reminder (for unpaid entries)
  const sendWhatsAppReminder = (entry) => {
    if (!entry.phone) {
      alert('No phone number available for this entry');
      return;
    }

    const principalAmount = entry.principalAmount || entry.amount || 0;
    const monthlyInterest = entry.monthlyInterest || 0;

    const message = `Payment Reminder - Monthly Interest

Name: ${entry.name}
Principal Amount: ₹${principalAmount.toLocaleString('en-IN')}
Monthly Interest Due: ₹${monthlyInterest.toLocaleString('en-IN')}

Please pay your monthly interest.

Thank you!

- Om Sai Murugan Finance`;

    const cleanPhone = entry.phone.replace(/\D/g, '');
    const phoneWithCountryCode = `91${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Open phone contact
  const openContact = (phone) => {
    if (!phone) {
      alert('No phone number available');
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  // Calculate total
  const calculateTotal = () => {
    return safeEntries.reduce((sum, entry) => {
      const amount = entry.principalAmount || entry.amount || 0;
      return sum + amount;
    }, 0);
  };

  // Download as CSV
  const handleDownload = () => {
    if (safeEntries.length === 0) {
      alert('No data to download');
      return;
    }

    const csvHeader = 'Name,Principal Amount,Monthly Interest,Start Date,Phone,Status\n';
    const csvRows = safeEntries.map(entry => {
      const principalAmount = entry.principalAmount || entry.amount || 0;
      const monthlyInterest = entry.monthlyInterest || 0;
      const isPaid = entry.principalReturned || entry.paid || false;
      return `${entry.name},₹${principalAmount},₹${monthlyInterest},${entry.date},${entry.phone || 'N/A'},${isPaid ? 'RETURNED' : 'ACTIVE'}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows + `\n\nTotal Amount,₹${calculateTotal()},,,,`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `vaddi_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading Vaddi List...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Failed to load Vaddi List</div>
          <button onClick={() => mutate()} style={{ marginTop: '16px', padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigateTo('dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>
            Vaddi List
            <span style={{
              marginLeft: '8px',
              fontSize: '11px',
              background: '#10b981',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600,
              verticalAlign: 'middle'
            }}>☁️ Firestore</span>
          </h2>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Reminder Popup */}
        {showReminder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setShowReminder(false)}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '15px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#667eea', marginBottom: '20px', fontSize: '24px', textAlign: 'center' }}>
              🔔 Payment Reminder
            </h2>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontWeight: 600, color: '#333', marginBottom: '15px', fontSize: '16px' }}>
                Today's Payments Due:
              </p>
              {todaysReminders.map(reminder => {
                const reminderAmount = reminder.principalAmount || reminder.amount || 0;
                return (
                  <div key={reminder.id} style={{
                    background: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    fontSize: '16px',
                    color: '#333',
                    borderLeft: '4px solid #667eea'
                  }}>
                    📌 <strong>{reminder.name}</strong> - ₹{reminderAmount.toLocaleString('en-IN')}
                  </div>
                );
              })}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '18px',
                marginTop: '15px'
              }}>
                <strong>Total Due: ₹{todaysReminders.reduce((sum, r) => {
                  const amount = r.principalAmount || r.amount || 0;
                  return sum + amount;
                }, 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setShowReminder(false)} style={{
                background: '#667eea',
                color: 'white',
                border: 'none',
                padding: '12px 40px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Tracker Card */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
            📊 Vaddi List
          </h3>
          <button
            onClick={handleDownload}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              opacity: loading ? 0.6 : 1
            }}
          >
            📥 Download CSV
          </button>
        </div>

        {/* Add Entry Form */}
        <form onSubmit={handleAddEntry} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '6px'
        }}>
          {/* Customer Name */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#374151', fontSize: '11px' }}>
              👤 Name *
            </label>
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={formData.name}
              onChange={handleInputChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Principal Amount */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#374151', fontSize: '11px' }}>
              💰 Principal *
            </label>
            <input
              type="number"
              name="principalAmount"
              placeholder="₹ Amount"
              value={formData.principalAmount}
              onChange={handleInputChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Monthly Interest */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#374151', fontSize: '11px' }}>
              📈 Interest *
            </label>
            <input
              type="number"
              name="monthlyInterest"
              placeholder="₹ /month"
              value={formData.monthlyInterest}
              onChange={handleInputChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Start Date */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#374151', fontSize: '11px' }}>
              📅 Date *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#374151', fontSize: '11px' }}>
              📱 Phone *
            </label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
              <input
                type="tel"
                name="phone"
                placeholder="10 digits"
                value={formData.phone}
                onChange={handleInputChange}
                required
                pattern="[0-9]{10}"
                maxLength="10"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                onClick={selectFromContacts}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: loading ? 0.6 : 1
                }}
                title="Select from Contacts"
              >
                👤
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" disabled={loading} style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '10px',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '12px',
            opacity: loading ? 0.6 : 1,
            alignSelf: 'end'
          }}>
            {loading ? 'Adding...' : '+ Add Entry'}
          </button>
        </form>

        {/* Entries List */}
        <div style={{ marginBottom: '16px' }}>
          {safeEntries.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '20px' }}>
              No entries yet. Add your first entry above!
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {safeEntries.map(entry => {
                // Handle both old and new field structures
                const principalAmount = entry.principalAmount || entry.amount || 0;
                const monthlyInterest = entry.monthlyInterest || 0;
                const isPrincipalReturned = entry.principalReturned || entry.paid || false;
                const interestPayments = entry.interestPayments || [];

                return (
                  <div key={entry.id} style={{
                    padding: '16px',
                    background: isPrincipalReturned
                      ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                      : 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                    borderRadius: '8px',
                    borderLeft: isPrincipalReturned ? '4px solid #10b981' : '4px solid #667eea',
                    opacity: isPrincipalReturned ? 0.7 : 1
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                            {entry.name}
                          </div>
                          {isPrincipalReturned && (
                            <span style={{
                              background: '#10b981',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              ✅ RETURNED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                          💰 Principal Amount: ₹{principalAmount.toLocaleString('en-IN')}
                        </div>
                        {monthlyInterest > 0 && (
                          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                            📈 Monthly Interest: ₹{monthlyInterest.toLocaleString('en-IN')}
                          </div>
                        )}
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                          📅 Start Date: {new Date(entry.date).toLocaleDateString('en-IN')}
                        </div>
                        {interestPayments.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
                            💸 Interest Payments: {interestPayments.length} payment{interestPayments.length !== 1 ? 's' : ''}
                          </div>
                        )}
                        {isPrincipalReturned && entry.principalReturnedDate && (
                          <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
                            ✅ Returned on: {new Date(entry.principalReturnedDate).toLocaleDateString('en-IN')}
                          </div>
                        )}
                        {entry.phone && (
                          <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>📱 Phone: {entry.phone}</span>
                            <button
                              onClick={() => openContact(entry.phone)}
                              style={{
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                              title="Call"
                            >
                              📞 Call
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {!isPrincipalReturned ? (
                          <>
                            <button
                              onClick={() => recordInterestPayment(entry)}
                              disabled={loading}
                              style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                fontSize: '13px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                opacity: loading ? 0.6 : 1
                              }}
                              title="Record monthly interest payment"
                            >
                              💰 Interest Paid
                            </button>
                            <button
                              onClick={() => markPrincipalReturned(entry)}
                              disabled={loading}
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                fontSize: '13px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                opacity: loading ? 0.6 : 1
                              }}
                              title="Mark principal amount as returned"
                            >
                              ✅ Principal Returned
                            </button>
                            {entry.phone && (
                              <button
                                onClick={() => sendWhatsAppReminder(entry)}
                                style={{
                                  background: '#25D366',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
                                }}
                                title="Send WhatsApp Reminder"
                              >
                                📲 Remind
                              </button>
                            )}
                          </>
                        ) : null}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          fontSize: '18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Overall Amount Summary */}
        {safeEntries.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', opacity: 0.9 }}>
              📊 Overall Summary
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', opacity: 0.9 }}>Total Entries:</span>
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{safeEntries.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', opacity: 0.9 }}>Entries with Phone:</span>
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{safeEntries.filter(e => e.phone).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', opacity: 0.9 }}>Paid Entries:</span>
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{safeEntries.filter(e => e.paid).length}</span>
              </div>
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.3)',
                paddingTop: '12px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '16px', fontWeight: 600 }}>Total Amount:</span>
                <span style={{ fontSize: '24px', fontWeight: 700 }}>₹{calculateTotal().toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default VaddiList;
