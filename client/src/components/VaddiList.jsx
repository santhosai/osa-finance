import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

// Fetcher function for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

const VaddiList = ({ navigateTo }) => {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: '',
    expectedReturnMonth: '',
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
  });

  // Check for reminders on mount and when entries change
  useEffect(() => {
    if (entries.length > 0) {
      checkReminders(entries);
    }
  }, [entries]);

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

    if (!formData.name || !formData.amount || !formData.date || !formData.expectedReturnMonth) {
      alert('Please fill all required fields');
      return;
    }

    // Validate phone if provided
    if (formData.phone && formData.phone.length !== 10) {
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
        throw new Error('Failed to create vaddi entry');
      }

      // Refresh data
      mutate();

      // Reset form
      setFormData({ name: '', amount: '', date: '', expectedReturnMonth: '', phone: '' });

      // Send WhatsApp notification if phone exists
      if (formData.phone) {
        const message = `New Vaddi Entry Created

Name: ${formData.name}
Interest Amount: ₹${parseFloat(formData.amount).toLocaleString('en-IN')}
Interest Date: ${new Date(formData.date).toLocaleDateString('en-IN')}
Expected Return: ${new Date(formData.expectedReturnMonth + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}

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
        const message = `Payment Receipt - Monthly Interest

Name: ${entry.name}
Amount Paid: ₹${entry.amount.toLocaleString('en-IN')}
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

  // Send WhatsApp reminder (for unpaid entries)
  const sendWhatsAppReminder = (entry) => {
    if (!entry.phone) {
      alert('No phone number available for this entry');
      return;
    }

    const message = `Reminder: Your interest payment of ₹${entry.amount.toLocaleString('en-IN')} is due today.

Expected return month: ${new Date(entry.expectedReturnMonth + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}

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
    return entries.reduce((sum, entry) => sum + entry.amount, 0);
  };

  // Download as CSV
  const handleDownload = () => {
    if (entries.length === 0) {
      alert('No data to download');
      return;
    }

    const csvHeader = 'Name,Amount,Date,Expected Return Month,Phone,Status\n';
    const csvRows = entries.map(entry =>
      `${entry.name},₹${entry.amount},${entry.date},${entry.expectedReturnMonth},${entry.phone || 'N/A'},${entry.paid ? 'PAID' : 'UNPAID'}`
    ).join('\n');

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
              {todaysReminders.map(reminder => (
                <div key={reminder.id} style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  fontSize: '16px',
                  color: '#333',
                  borderLeft: '4px solid #667eea'
                }}>
                  📌 <strong>{reminder.name}</strong> - ₹{reminder.amount.toLocaleString('en-IN')}
                </div>
              ))}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '18px',
                marginTop: '15px'
              }}>
                <strong>Total Due: ₹{todaysReminders.reduce((sum, r) => sum + r.amount, 0).toLocaleString('en-IN')}</strong>
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
          gap: '12px',
          marginBottom: '20px',
          padding: '16px',
          background: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <input
            type="text"
            name="name"
            placeholder="Name *"
            value={formData.name}
            onChange={handleInputChange}
            required
            disabled={loading}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <input
            type="number"
            name="amount"
            placeholder="Amount *"
            value={formData.amount}
            onChange={handleInputChange}
            required
            disabled={loading}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <input
            type="date"
            name="date"
            placeholder="Interest Date *"
            value={formData.date}
            onChange={handleInputChange}
            required
            disabled={loading}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <input
            type="month"
            name="expectedReturnMonth"
            placeholder="Expected Return Month *"
            value={formData.expectedReturnMonth}
            onChange={handleInputChange}
            required
            disabled={loading}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
            <input
              type="tel"
              name="phone"
              placeholder="Phone *"
              value={formData.phone}
              onChange={handleInputChange}
              required
              pattern="[0-9]{10}"
              maxLength="10"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
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
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: loading ? 0.6 : 1
              }}
              title="Select from Contacts"
            >
              👤 Contacts
            </button>
          </div>
          <button type="submit" disabled={loading} style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            opacity: loading ? 0.6 : 1
          }}>
            {loading ? 'Adding...' : '+ Add Entry'}
          </button>
        </form>

        {/* Entries List */}
        <div style={{ marginBottom: '16px' }}>
          {entries.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '20px' }}>
              No entries yet. Add your first entry above!
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {entries.map(entry => (
                <div key={entry.id} style={{
                  padding: '16px',
                  background: entry.paid
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                  borderRadius: '8px',
                  borderLeft: entry.paid ? '4px solid #10b981' : '4px solid #667eea',
                  opacity: entry.paid ? 0.7 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                          {entry.name}
                        </div>
                        {entry.paid && (
                          <span style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            ✓ PAID
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                        💰 Amount: ₹{entry.amount.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                        📅 Interest Date: {new Date(entry.date).toLocaleDateString('en-IN')}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                        📆 Expected Return: {new Date(entry.expectedReturnMonth + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}
                      </div>
                      {entry.paid && entry.paidDate && (
                        <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
                          ✓ Paid on: {new Date(entry.paidDate).toLocaleDateString('en-IN')}
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
                      {!entry.paid ? (
                        <>
                          <button
                            onClick={() => markAsPaid(entry)}
                            disabled={loading}
                            style={{
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '14px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              opacity: loading ? 0.6 : 1
                            }}
                            title="Mark as Paid & Send Receipt"
                          >
                            ✓ Mark Paid
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
                                fontSize: '14px',
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
              ))}
            </div>
          )}
        </div>

        {/* Overall Amount Summary */}
        {entries.length > 0 && (
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
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{entries.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', opacity: 0.9 }}>Entries with Phone:</span>
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{entries.filter(e => e.phone).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', opacity: 0.9 }}>Paid Entries:</span>
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{entries.filter(e => e.paid).length}</span>
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
