import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function SendWishes({ onClose }) {
  const [step, setStep] = useState(1); // 1=compose, 2=preview, 3=send
  const [image, setImage] = useState(null);
  const [message1, setMessage1] = useState('');
  const [message2, setMessage2] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState(new Set());

  // Fetch all unique contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      // Fetch each endpoint separately with error handling
      const safeFetch = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return [];
          return await res.json();
        } catch (e) {
          console.error(`Failed to fetch ${url}:`, e);
          return [];
        }
      };

      const [customers, monthlyCustomers, dailyCustomers, vaddiEntries] = await Promise.all([
        safeFetch(`${API_URL}/customers`),
        safeFetch(`${API_URL}/monthly-finance/customers`),
        safeFetch(`${API_URL}/daily-customers`),
        safeFetch(`${API_URL}/vaddi-entries`)
      ]);

      // Fetch chit members separately
      let chitMembers = [];
      try {
        const groupsRes = await fetch(`${API_URL}/chit-groups`);
        if (groupsRes.ok) {
          const groups = await groupsRes.json();
          for (const group of groups) {
            const membersRes = await fetch(`${API_URL}/chit-groups/${group.id}/members`);
            if (membersRes.ok) {
              const members = await membersRes.json();
              chitMembers.push(...members);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch chit members:', e);
      }

      // Debug logging
      console.log('Customers:', customers?.length || 0);
      console.log('Monthly:', monthlyCustomers?.length || 0);
      console.log('Daily:', dailyCustomers?.length || 0);
      console.log('Vaddi:', vaddiEntries?.length || 0);
      console.log('Chit:', chitMembers?.length || 0);

      // Collect all contacts
      const allContacts = [];

      // Ensure arrays exist before forEach
      (Array.isArray(customers) ? customers : []).forEach(c => {
        if (c.phone && String(c.phone).length >= 10) {
          allContacts.push({ name: c.name || 'Unknown', phone: String(c.phone).replace(/\D/g, '').slice(-10) });
        }
      });

      (Array.isArray(monthlyCustomers) ? monthlyCustomers : []).forEach(c => {
        if (c.phone && String(c.phone).length >= 10) {
          allContacts.push({ name: c.name || 'Unknown', phone: String(c.phone).replace(/\D/g, '').slice(-10) });
        }
      });

      (Array.isArray(dailyCustomers) ? dailyCustomers : []).forEach(c => {
        if (c.phone && String(c.phone).length >= 10) {
          allContacts.push({ name: c.name || 'Unknown', phone: String(c.phone).replace(/\D/g, '').slice(-10) });
        }
      });

      (Array.isArray(vaddiEntries) ? vaddiEntries : []).forEach(c => {
        if (c.phone && String(c.phone).length >= 10) {
          allContacts.push({ name: c.name || 'Unknown', phone: String(c.phone).replace(/\D/g, '').slice(-10) });
        }
      });

      (Array.isArray(chitMembers) ? chitMembers : []).forEach(c => {
        if (c.phone && String(c.phone).length >= 10) {
          allContacts.push({ name: c.name || 'Unknown', phone: String(c.phone).replace(/\D/g, '').slice(-10) });
        }
      });

      // Remove duplicates by phone
      const uniqueMap = new Map();
      allContacts.forEach(c => {
        if (!uniqueMap.has(c.phone)) {
          uniqueMap.set(c.phone, c);
        }
      });

      console.log('Total contacts found:', allContacts.length);
      console.log('Unique contacts:', uniqueMap.size);

      const sortedContacts = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setContacts(sortedContacts);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      alert('Error loading contacts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  const getFullMessage = () => {
    let msg = '';
    if (message1) msg += message1;
    if (message2) msg += (msg ? '\n\n' : '') + message2;
    return msg;
  };

  const openWhatsApp = (phone, name) => {
    const message = getFullMessage();
    const personalizedMsg = message.replace(/{name}/gi, name);
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(personalizedMsg)}`;
    window.open(url, '_blank');
    setSentTo(prev => new Set([...prev, phone]));
  };

  const goToPreview = () => {
    if (!message1 && !message2 && !image) {
      alert('Please add at least a message or image');
      return;
    }
    setStep(2);
  };

  const goToSend = () => {
    fetchContacts();
    setStep(3);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '10px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #374151',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
              {step === 1 ? '📝 Compose Message' : step === 2 ? '👁️ Preview' : '📤 Send to Customers'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
              Step {step} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '6px'
            }}
          >
            ×
          </button>
        </div>

        {/* Step 1: Compose */}
        {step === 1 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {/* Image Upload */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>
                📷 Add Image (Optional)
              </label>
              {image ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={image} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px' }} />
                  <button
                    onClick={removeImage}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label style={{
                  display: 'block',
                  padding: '30px',
                  border: '2px dashed #4b5563',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: '#9ca3af'
                }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
                  Tap to select image
                </label>
              )}
              <p style={{ color: '#6b7280', fontSize: '11px', marginTop: '6px' }}>
                Note: You'll need to attach image manually in WhatsApp after clicking send
              </p>
            </div>

            {/* Message 1 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>
                ✍️ Message Line 1
              </label>
              <textarea
                value={message1}
                onChange={(e) => setMessage1(e.target.value)}
                placeholder="e.g., Happy Pongal! 🌾🎉"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '60px'
                }}
              />
            </div>

            {/* Message 2 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>
                ✍️ Message Line 2 (Optional)
              </label>
              <textarea
                value={message2}
                onChange={(e) => setMessage2(e.target.value)}
                placeholder="e.g., Wishing you prosperity and happiness! - Om Sai Murugan Finance"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '60px'
                }}
              />
            </div>

            <p style={{ color: '#10b981', fontSize: '11px', background: '#064e3b', padding: '8px 12px', borderRadius: '6px' }}>
              💡 Tip: Use {'{name}'} in your message to personalize with customer name
            </p>

            {/* Next Button */}
            <button
              onClick={goToPreview}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Preview Message →
            </button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <div style={{
              background: '#0d1117',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '10px' }}>
                Message Preview:
              </div>

              {image && (
                <div style={{ marginBottom: '12px' }}>
                  <img src={image} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                  <p style={{ color: '#f59e0b', fontSize: '11px', marginTop: '6px' }}>
                    ⚠️ Attach this image manually in WhatsApp
                  </p>
                </div>
              )}

              <div style={{
                background: '#dcf8c6',
                color: '#1f2937',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                maxWidth: '85%',
                marginLeft: 'auto'
              }}>
                {getFullMessage() || '(No message)'}
              </div>

              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '10px', textAlign: 'right' }}>
                — How it will look in WhatsApp
              </div>
            </div>

            {/* Example with name */}
            {getFullMessage().includes('{name}') && (
              <div style={{
                background: '#1e3a5f',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ color: '#60a5fa', fontSize: '11px', marginBottom: '8px' }}>
                  Example for "Vijay":
                </div>
                <div style={{ color: 'white', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                  {getFullMessage().replace(/{name}/gi, 'Vijay')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ← Edit
              </button>
              <button
                onClick={goToSend}
                style={{
                  flex: 2,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Confirm & Show Customers →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Send */}
        {step === 3 && (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Stats Bar */}
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ color: '#a7f3d0', fontSize: '11px' }}>Total Customers</div>
                <div style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>{contacts.length}</div>
              </div>
              <div>
                <div style={{ color: '#a7f3d0', fontSize: '11px' }}>Sent</div>
                <div style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>{sentTo.size}</div>
              </div>
              <div>
                <div style={{ color: '#a7f3d0', fontSize: '11px' }}>Remaining</div>
                <div style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>{contacts.length - sentTo.size}</div>
              </div>
            </div>

            {/* Back Button */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #374151' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '8px 16px',
                  background: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Preview
              </button>
            </div>

            {/* Customer List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                  Loading customers...
                </div>
              ) : contacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📭</div>
                  No customers found
                </div>
              ) : (
                contacts.map((contact, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: sentTo.has(contact.phone) ? '#064e3b' : (idx % 2 === 0 ? '#374151' : 'transparent'),
                      borderRadius: '8px',
                      marginBottom: '4px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: sentTo.has(contact.phone) ? '#10b981' : 'white',
                        fontSize: '14px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {sentTo.has(contact.phone) && <span>✓</span>}
                        {contact.name}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        {contact.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => openWhatsApp(contact.phone, contact.name)}
                      style={{
                        padding: '10px 16px',
                        background: sentTo.has(contact.phone)
                          ? '#374151'
                          : 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>📱</span>
                      {sentTo.has(contact.phone) ? 'Resend' : 'Send'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Image Reminder */}
            {image && (
              <div style={{
                padding: '12px 16px',
                background: '#78350f',
                borderTop: '1px solid #92400e'
              }}>
                <div style={{ color: '#fbbf24', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📷</span>
                  Remember to attach your image in WhatsApp after sending!
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SendWishes;
