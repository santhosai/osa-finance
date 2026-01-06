import { useState, useEffect } from 'react';
import { API_URL } from '../config';

// Message templates
const getChitMessage = (data, language, quickNote) => {
  const { chitName, chitNumber, memberName, amount, month, date } = data;

  if (language === 'tamil') {
    let msg = `*சீட்டு பணம் ரசீது*\n\n`;
    msg += `சீட்டு: ${chitName}\n`;
    if (chitNumber) msg += `சீட்டு எண்: ${chitNumber}\n`;
    msg += `உறுப்பினர்: ${memberName}\n`;
    msg += `தொகை: ${amount}\n`;
    msg += `மாதம்: ${month}\n`;
    msg += `தேதி: ${date}\n\n`;
    msg += `வணக்கம்!\nஇந்த மாதம் சீட்டு பணம் பெறப்பட்டது நன்றி\n- ஓம் சாய் முருகன்`;
    if (quickNote) msg += `\n\n${quickNote}`;
    return msg;
  } else {
    let msg = `*Chit Payment Receipt*\n\n`;
    msg += `Chit: ${chitName}\n`;
    if (chitNumber) msg += `Chit No: ${chitNumber}\n`;
    msg += `Member: ${memberName}\n`;
    msg += `Amount: ${amount}\n`;
    msg += `Month: ${month}\n`;
    msg += `Date: ${date}\n\n`;
    msg += `Thank you!\n- Om Sai Murugan`;
    if (quickNote) msg += `\n\n${quickNote}`;
    return msg;
  }
};

const getLoanMessage = (data, language, quickNote) => {
  const { customerName, loanName, amount, weekNumber, balance, date } = data;

  if (language === 'tamil') {
    let msg = `*கடன் பணம் ரசீது*\n\n`;
    msg += `வாடிக்கையாளர்: ${customerName}\n`;
    if (loanName) msg += `கடன்: ${loanName}\n`;
    msg += `தொகை: ${amount}\n`;
    if (weekNumber) msg += `வாரம்: ${weekNumber}\n`;
    msg += `மீதி: ${balance}\n`;
    msg += `தேதி: ${date}\n\n`;
    msg += `நன்றி!\n- ஓம் சாய் முருகன்`;
    if (quickNote) msg += `\n\n${quickNote}`;
    return msg;
  } else {
    let msg = `*Loan Payment Receipt*\n\n`;
    msg += `Customer: ${customerName}\n`;
    if (loanName) msg += `Loan: ${loanName}\n`;
    msg += `Amount: ${amount}\n`;
    if (weekNumber) msg += `Week: ${weekNumber}\n`;
    msg += `Balance: ${balance}\n`;
    msg += `Date: ${date}\n\n`;
    msg += `Thank you!\n- Om Sai Murugan`;
    if (quickNote) msg += `\n\n${quickNote}`;
    return msg;
  }
};

function WhatsAppModal({
  isOpen,
  onClose,
  onSend,
  phone,
  messageType, // 'chit' or 'loan'
  messageData  // data for message template
}) {
  const [language, setLanguage] = useState('english');
  const [quickNote, setQuickNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/whatsapp-settings`);
      if (response.ok) {
        const data = await response.json();
        setLanguage(data.language || 'english');
        setQuickNote(data.quick_note || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/whatsapp-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, quick_note: quickNote })
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleSend = async () => {
    setLoading(true);

    // Save settings for next time
    await saveSettings();

    // Generate message based on type
    let message = '';
    if (messageType === 'chit') {
      message = getChitMessage(messageData, language, quickNote);
    } else {
      message = getLoanMessage(messageData, language, quickNote);
    }

    // Open WhatsApp
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      window.open(`https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(message)}`, '_blank');
    }

    setLoading(false);
    onSend && onSend();
    onClose();
  };

  const handleSkip = () => {
    onSend && onSend();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        width: '100%',
        maxWidth: '350px'
      }}>
        <h3 style={{ margin: '0 0 15px', fontSize: '16px', color: '#1e293b', textAlign: 'center' }}>
          Send WhatsApp Receipt
        </h3>

        {/* Language Selection */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
            Language
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setLanguage('english')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: language === 'english' ? '2px solid #10b981' : '1px solid #e2e8f0',
                background: language === 'english' ? '#ecfdf5' : 'white',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                color: language === 'english' ? '#059669' : '#64748b'
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('tamil')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: language === 'tamil' ? '2px solid #10b981' : '1px solid #e2e8f0',
                background: language === 'tamil' ? '#ecfdf5' : 'white',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                color: language === 'tamil' ? '#059669' : '#64748b'
              }}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* Quick Note */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>
            Quick Note (Optional)
          </label>
          <textarea
            placeholder="e.g., Happy New Year 2026!"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            rows={2}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              resize: 'none'
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              color: '#64748b'
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            {loading ? 'Sending...' : 'Send WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppModal;
