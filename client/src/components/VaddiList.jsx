import { useState, useEffect } from 'react';

const VaddiList = ({ navigateTo }) => {
  const [entries, setEntries] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: '',
    expectedReturnMonth: '',
    phone: ''
  });
  const [showReminder, setShowReminder] = useState(false);
  const [todaysReminders, setTodaysReminders] = useState([]);

  // Load entries from localStorage on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem('monthlyTrackerEntries');
    if (savedEntries) {
      const parsedEntries = JSON.parse(savedEntries);
      setEntries(parsedEntries);
      checkReminders(parsedEntries);
    }
  }, []);

  // Check for reminders on current date
  const checkReminders = (entriesList) => {
    const today = new Date().toISOString().split('T')[0];
    const reminders = entriesList.filter(entry => entry.date === today);

    if (reminders.length > 0) {
      setTodaysReminders(reminders);
      setShowReminder(true);
    }
  };

  // Save entries to localStorage
  const saveEntries = (newEntries) => {
    localStorage.setItem('monthlyTrackerEntries', JSON.stringify(newEntries));
    setEntries(newEntries);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new entry (allows duplicates)
  const handleAddEntry = (e) => {
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

    const newEntry = {
      id: Date.now(),
      name: formData.name,
      amount: parseFloat(formData.amount),
      date: formData.date,
      expectedReturnMonth: formData.expectedReturnMonth,
      phone: formData.phone || '',
      paid: false,
      paidDate: null
    };

    const updatedEntries = [...entries, newEntry];
    // Sort by date
    updatedEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    saveEntries(updatedEntries);

    // Reset form
    setFormData({ name: '', amount: '', date: '', expectedReturnMonth: '', phone: '' });
  };

  // Delete entry
  const handleDelete = (id) => {
    const updatedEntries = entries.filter(entry => entry.id !== id);
    saveEntries(updatedEntries);
  };

  // Mark as paid and send receipt
  const markAsPaid = (entry) => {
    if (!entry.phone) {
      const confirmed = window.confirm('No phone number for this entry. Mark as paid anyway?');
      if (!confirmed) return;
    }

    const updatedEntries = entries.map(e => {
      if (e.id === entry.id) {
        return { ...e, paid: true, paidDate: new Date().toISOString().split('T')[0] };
      }
      return e;
    });
    saveEntries(updatedEntries);

    // Send WhatsApp receipt if phone available
    if (entry.phone) {
      const message = `Payment Receipt - Monthly Interest\n\nName: ${entry.name}\nAmount Paid: ₹${entry.amount.toLocaleString('en-IN')}\nPaid Date: ${new Date().toLocaleDateString('en-IN')}\n\nThank you for your payment!\n\n- Om Sai Murugan Finance`;
      const whatsappUrl = `https://wa.me/91${entry.phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  // Send WhatsApp reminder (for unpaid entries)
  const sendWhatsAppReminder = (entry) => {
    if (!entry.phone) {
      alert('No phone number available for this entry');
      return;
    }

    const message = `Reminder: Your interest payment of ₹${entry.amount.toLocaleString('en-IN')} is due today.\n\nExpected return month: ${entry.expectedReturnMonth}\n\nThank you!`;
    const whatsappUrl = `https://wa.me/91${entry.phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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

    const csvHeader = 'Name,Amount,Date,Expected Return Month,Phone\n';
    const csvRows = entries.map(entry =>
      `${entry.name},₹${entry.amount},${entry.date},${entry.expectedReturnMonth},${entry.phone || 'N/A'}`
    ).join('\n');

    const csvContent = csvHeader + csvRows + `\n\nTotal Amount,₹${calculateTotal()},,`;

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
            }}>v3.0 📱</span>
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
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
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
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone (Optional)"
            value={formData.phone}
            onChange={handleInputChange}
            pattern="[0-9]{10}"
            maxLength="10"
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <button type="submit" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}>
            + Add Entry
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
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
                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                          📱 Phone: {entry.phone}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!entry.paid ? (
                        <>
                          <button
                            onClick={() => markAsPaid(entry)}
                            style={{
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
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
