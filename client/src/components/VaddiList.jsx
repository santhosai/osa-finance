import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

const fetcher = (url) => fetch(url).then(res => res.json());

const VaddiList = ({ navigateTo }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Fetch entries with SWR
  const { data: entries = [], error, isLoading, mutate } = useSWR(`${API_URL}/vaddi-entries`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true
  });

  // Safe entries
  const safeEntries = Array.isArray(entries) ? entries.filter(e => e && e.id) : [];

  // Group entries by day
  const entriesByDay = {};
  for (let day = 1; day <= 31; day++) {
    entriesByDay[day] = safeEntries.filter(e => e.day === day);
  }

  // Calculate total amount for a day
  const getDayTotal = (day) => {
    return entriesByDay[day].reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  // Get customer count for a day
  const getDayCount = (day) => {
    return entriesByDay[day].length;
  };

  // Calculate grand total
  const calculateGrandTotal = () => {
    return safeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  // Open modal for a day
  const handleDayClick = (day) => {
    setSelectedDay(day);
    setShowModal(true);
    setFormData({ name: '', amount: '', phone: '' });
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedDay(null);
    setFormData({ name: '', amount: '', phone: '' });
  };

  // Add new entry for selected day
  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.amount || !formData.phone) {
      alert('Please fill all fields');
      return;
    }

    if (formData.phone.length !== 10) {
      alert('Phone number must be 10 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/vaddi-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: selectedDay,
          name: formData.name,
          amount: parseInt(formData.amount),
          phone: formData.phone
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add entry');
      }

      mutate();
      setFormData({ name: '', amount: '', phone: '' });
      alert('Entry added successfully!');
    } catch (error) {
      console.error('Error adding entry:', error);
      alert('Failed to add entry: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete entry (Full Settled)
  const handleDelete = async (id) => {
    if (!window.confirm('Mark as Full Settled and delete?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vaddi-entries/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      mutate();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry: ' + error.message);
    }
  };

  // Download CSV
  const handleDownload = () => {
    if (safeEntries.length === 0) {
      alert('No data to download');
      return;
    }

    const csvHeader = 'Day,Name,Amount,Phone\n';
    const csvRows = safeEntries.map(e => `${e.day},${e.name},₹${e.amount},${e.phone}`).join('\n');
    const csvContent = csvHeader + csvRows + `\n\nTotal Amount,₹${calculateGrandTotal()},,`;

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

  // Format amount to K (e.g., 5000 -> 5k)
  const formatAmount = (amount) => {
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(0)}k`;
    }
    return `₹${amount}`;
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Failed to load data</div>
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
              padding: '4px'
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700 }}>
            Vaddi List
          </h2>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Title Bar */}
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>📅 Vaddi List</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600
              }}>
                Total: ₹{calculateGrandTotal().toLocaleString('en-IN')}
              </div>
              <button
                onClick={handleDownload}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                📥 Download
              </button>
            </div>
          </div>

          {/* 31-Day Calendar Grid */}
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px'
            }}>
              {[...Array(31)].map((_, index) => {
                const day = index + 1;
                const dayTotal = getDayTotal(day);
                const dayCount = getDayCount(day);
                const hasData = dayCount > 0;

                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    style={{
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px 8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: hasData ? 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)' : 'white',
                      transition: 'all 0.2s',
                      minHeight: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: hasData ? '#667eea' : '#9ca3af',
                      marginBottom: '4px'
                    }}>
                      {day}
                    </div>
                    {hasData && (
                      <>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#059669',
                          marginBottom: '2px'
                        }}>
                          {formatAmount(dayTotal)}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#6b7280'
                        }}>
                          👥{dayCount}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Day Entries Modal */}
      {showModal && (
        <div
          style={{
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
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                📅 Day {selectedDay}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px'
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px' }}>
              {/* Add Entry Form */}
              <form onSubmit={handleAddEntry} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    👤 Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Customer name"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    💰 Amount
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="Amount in ₹"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#374151', fontSize: '14px' }}>
                    📱 Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="10 digits"
                    required
                    pattern="[0-9]{10}"
                    maxLength="10"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Adding...' : '➕ Add Entry'}
                </button>
              </form>

              {/* Entries List */}
              {entriesByDay[selectedDay].length > 0 && (
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Entries ({entriesByDay[selectedDay].length})
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {entriesByDay[selectedDay].map(entry => (
                      <div
                        key={entry.id}
                        style={{
                          padding: '12px',
                          background: 'linear-gradient(135deg, #f0f4ff 0%, #e6ecff 100%)',
                          borderRadius: '8px',
                          borderLeft: '3px solid #667eea'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>
                              {entry.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#059669', fontWeight: 600, marginBottom: '2px' }}>
                              ₹{entry.amount?.toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              📱 {entry.phone}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ✓ Full Settled
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {entriesByDay[selectedDay].length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '30px',
                  color: '#9ca3af',
                  fontStyle: 'italic'
                }}>
                  No entries for this day. Add your first entry above!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaddiList;
