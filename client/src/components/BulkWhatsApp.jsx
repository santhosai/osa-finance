import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function BulkWhatsApp({ onClose }) {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchAllCustomers();
  }, []);

  const fetchAllCustomers = async () => {
    setLoading(true);
    try {
      // Fetch regular customers and monthly finance customers
      const [customersResponse, monthlyResponse] = await Promise.all([
        fetch(`${API_URL}/customers`),
        fetch(`${API_URL}/monthly-finance/customers`)
      ]);

      const regularCustomers = await customersResponse.json();
      const monthlyCustomers = await monthlyResponse.json();

      const allCustomers = [];
      const seenPhones = new Set();

      // Add regular customers (Weekly, Daily, Interest)
      for (const customer of regularCustomers) {
        if (!customer.phone || seenPhones.has(customer.phone)) continue;

        // Check if customer has active loans
        const hasActiveLoans = customer.loans && customer.loans.some(
          loan => loan.balance > 0 && loan.status !== 'closed'
        );

        if (hasActiveLoans) {
          const loanTypes = [];
          customer.loans.forEach(loan => {
            if (loan.balance > 0 && loan.status !== 'closed') {
              if (!loanTypes.includes(loan.loan_type)) {
                loanTypes.push(loan.loan_type);
              }
            }
          });

          allCustomers.push({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            type: loanTypes.join(', ')
          });
          seenPhones.add(customer.phone);
        }
      }

      // Add monthly finance customers
      for (const customer of monthlyCustomers) {
        if (!customer.phone || seenPhones.has(customer.phone)) continue;

        if (customer.balance > 0) {
          allCustomers.push({
            id: `monthly-${customer.id}`,
            name: customer.name,
            phone: customer.phone,
            type: 'Monthly Finance'
          });
          seenPhones.add(customer.phone);
        }
      }

      // Sort by name
      allCustomers.sort((a, b) => a.name.localeCompare(b.name));

      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const sendBulkMessages = () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    if (customers.length === 0) {
      alert('No customers to send messages to');
      return;
    }

    const confirmed = window.confirm(
      `Send message to ${customers.length} customer(s)?${selectedImage ? '\n\nNote: You will need to manually attach the image in each WhatsApp chat.' : ''}`
    );

    if (!confirmed) return;

    setSending(true);

    // Send messages with stagger
    customers.forEach((customer, index) => {
      setTimeout(() => {
        const cleanPhone = customer.phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }, index * 1000); // Stagger by 1 second
    });

    // Show completion message
    setTimeout(() => {
      setSending(false);
      alert('All WhatsApp chats opened! Please manually attach the image if needed.');
    }, customers.length * 1000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: 700,
              color: '#1e293b'
            }}>
              📱 Bulk WhatsApp Messages
            </h2>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#64748b'
            }}>
              Send festival wishes or announcements to all customers
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: sending ? 'not-allowed' : 'pointer',
              color: '#6b7280',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Customer Count */}
        <div style={{
          padding: '16px 20px',
          background: '#f0f9ff',
          borderBottom: '1px solid #bae6fd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#0369a1'
          }}>
            {loading ? 'Loading customers...' : `${customers.length} customer(s) will receive the message`}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {/* Message Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Message *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message here...&#10;&#10;Example:&#10;🎉 Happy Pongal! 🎉&#10;&#10;Wishing you and your family a prosperous Pongal festival!&#10;&#10;- Om Sai Murugan Finance"
              disabled={sending}
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginTop: '6px'
            }}>
              {message.length} characters
            </div>
          </div>

          {/* Image Upload */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Attach Image (Optional)
            </label>

            {!imagePreview ? (
              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                {/* Gallery Upload */}
                <label style={{
                  flex: 1,
                  padding: '16px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  background: '#f9fafb',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => !sending && (e.target.style.borderColor = '#3b82f6')}
                onMouseLeave={(e) => !sending && (e.target.style.borderColor = '#d1d5db')}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={sending}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    Choose from Gallery
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    JPG, PNG (Max 5MB)
                  </div>
                </label>

                {/* Camera Capture */}
                <label style={{
                  flex: 1,
                  padding: '16px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  background: '#f9fafb',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => !sending && (e.target.style.borderColor = '#10b981')}
                onMouseLeave={(e) => !sending && (e.target.style.borderColor = '#d1d5db')}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    disabled={sending}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    Take Photo
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Use Camera
                  </div>
                </label>
              </div>
            ) : (
              /* Image Preview */
              <div style={{
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                padding: '16px',
                background: '#f9fafb'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151'
                  }}>
                    Image Preview
                  </div>
                  <button
                    onClick={removeImage}
                    disabled={sending}
                    style={{
                      padding: '6px 12px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    background: '#fff'
                  }}
                />
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fcd34d',
                  fontSize: '12px',
                  color: '#92400e'
                }}>
                  ⚠️ Note: You will need to manually attach this image in each WhatsApp chat that opens.
                </div>
              </div>
            )}
          </div>

          {/* Customer List Preview */}
          {!loading && customers.length > 0 && (
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px'
              }}>
                Recipients ({customers.length})
              </div>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: '#f9fafb'
              }}>
                {customers.map((customer, index) => (
                  <div
                    key={customer.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: index < customers.length - 1 ? '1px solid #e5e7eb' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1e293b'
                      }}>
                        {customer.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>
                        {customer.phone} • {customer.type}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '18px'
                    }}>
                      ✅
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Action Buttons */}
        <div style={{
          padding: '16px 20px',
          borderTop: '2px solid #e5e7eb',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              flex: 1,
              padding: '14px',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: sending ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={sendBulkMessages}
            disabled={sending || !message.trim() || customers.length === 0}
            style={{
              flex: 2,
              padding: '14px',
              background: sending || !message.trim() || customers.length === 0
                ? '#9ca3af'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: sending || !message.trim() || customers.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: sending || !message.trim() || customers.length === 0
                ? 'none'
                : '0 4px 16px rgba(16, 185, 129, 0.3)'
            }}
          >
            {sending ? '📤 Opening WhatsApp Chats...' : `📱 Send to ${customers.length} Customer(s)`}
          </button>
        </div>

        {/* Info Footer */}
        <div style={{
          padding: '10px 20px',
          background: '#f0f9ff',
          borderTop: '1px solid #bae6fd',
          fontSize: '11px',
          color: '#0369a1',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          ℹ️ Multiple WhatsApp tabs will open. Messages will be pre-filled, but you'll need to manually send each one and attach images if selected.
        </div>
      </div>
    </div>
  );
}

export default BulkWhatsApp;
