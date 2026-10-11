import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../config';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BALANCE_CHECK_STRINGS } from '../utils/balanceCheckStrings';

function BalanceCheck() {
  // Check if QR print mode
  const [searchParams] = useSearchParams();
  const isQRMode = searchParams.get('mode') === 'qr';
  const phoneFromUrl = searchParams.get('phone');

  const [phoneNumber, setPhoneNumber] = useState(phoneFromUrl || '');
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [error, setError] = useState('');
  const [expandedLoans, setExpandedLoans] = useState({});
  const [expandedLinked, setExpandedLinked] = useState({});

  // UPI Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null); // { amount, customerName, loanType }

  // Display language — English by default, the customer can switch to Tamil
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('balanceCheckLang') === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });
  const t = BALANCE_CHECK_STRINGS[lang];

  const changeLang = (next) => {
    setLang(next);
    try {
      localStorage.setItem('balanceCheckLang', next);
    } catch {
      // storage unavailable (private mode) — the choice just won't be remembered
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  const summarizeLoanKinds = (loans) => {
    const counts = {};
    loans.forEach(l => { counts[l.kind] = (counts[l.kind] || 0) + 1; });
    const parts = Object.entries(counts).map(([kind, count]) => count > 1 ? `${count} ${t.loanKinds[kind]}` : t.loanKinds[kind]);
    return `${parts.join(' + ')} ${loans.length > 1 ? t.loansWord : t.loanWord}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Loan names are free text typed by the admin; only the default one is translated
  const loanNameLabel = (name) => name === 'General Loan' ? t.generalLoan : name;
  const payModeLabel = (mode) => t.payModes[(mode || 'cash').toLowerCase()] || mode || 'cash';

  const checkBalance = async (phone) => {
    if (phone.length !== 10) {
      setError('errInvalidPhone');
      return;
    }

    setLoading(true);
    setError('');
    setCustomerData(null);

    try {
      // Single optimized API call - fetches only this customer's data
      const response = await fetch(`${API_URL}/balance-check/${phone}`);

      if (response.status === 404) {
        setError('errNotFound');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Server error');
      }

      const data = await response.json();
      setCustomerData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError('errFetch');
      setLoading(false);
    }
  };

  const handleCheckBalance = (e) => {
    e.preventDefault();
    checkBalance(phoneNumber);
  };

  // A receipt/QR can deep-link straight to a customer's balance via
  // ?phone=XXXXXXXXXX, skipping the manual "enter your number" step.
  useEffect(() => {
    if (phoneFromUrl && phoneFromUrl.length === 10) {
      checkBalance(phoneFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setPhoneNumber('');
    setCustomerData(null);
    setError('');
    setExpandedLoans({});
    setExpandedLinked({});
  };

  const toggleLoan = (loanType, loanIndex) => {
    const key = `${loanType}-${loanIndex}`;
    setExpandedLoans(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleLinked = (customerId) => {
    setExpandedLinked(prev => ({ ...prev, [customerId]: !prev[customerId] }));
  };

  // Open payment modal for a loan
  const handlePayNow = (loan, loanType) => {
    setSelectedLoan({ ...loan, loanType });
    setShowPaymentModal(true);
    setPaymentScreenshot(null);
  };

  // Handle screenshot file selection
  const handleScreenshotChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file is an image
      if (!file.type.startsWith('image/')) {
        alert(t.alertImageOnly);
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(t.alertFileSize);
        return;
      }
      setPaymentScreenshot(file);
    }
  };

  // Submit payment request
  const handleSubmitPayment = async (skipScreenshot = false) => {
    if (!selectedLoan) {
      alert(t.alertLoanMissing);
      return;
    }

    // If no screenshot and not skipping, ask for confirmation
    if (!paymentScreenshot && !skipScreenshot) {
      const proceed = window.confirm(t.confirmNoScreenshot);
      if (!proceed) return;
    }

    setPaymentSubmitting(true);

    try {
      // Determine amount based on loan type
      let amount = 0;
      let loanType = selectedLoan.loanType;

      if (loanType === 'monthly') {
        amount = selectedLoan.monthlyAmount;
        loanType = 'Monthly';
      } else if (loanType === 'weekly') {
        amount = selectedLoan.weeklyAmount;
        loanType = 'Weekly';
      } else if (loanType === 'daily') {
        amount = selectedLoan.dailyAmount;
        loanType = 'Daily';
      } else if (loanType === 'interest') {
        amount = selectedLoan.monthlyInterest;
        loanType = 'Vaddi';
      }

      // Validate minimum amount (UPI usually requires minimum ₹10)
      if (amount < 10) {
        alert(t.alertMinAmount);
        setPaymentSubmitting(false);
        return;
      }

      let downloadURL = null;

      // Only upload screenshot if provided
      if (paymentScreenshot) {
        try {
          setUploading(true);

          // Upload with timeout (30 seconds)
          const timestamp = Date.now();
          const fileName = `payment-proofs/${selectedLoan.loanId}_${timestamp}.jpg`;
          const storageRef = ref(storage, fileName);

          // Create upload promise with timeout
          const uploadPromise = uploadBytes(storageRef, paymentScreenshot);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Upload timeout')), 30000)
          );

          await Promise.race([uploadPromise, timeoutPromise]);
          downloadURL = await getDownloadURL(storageRef);
          setUploading(false);
        } catch (uploadError) {
          console.error('Screenshot upload failed:', uploadError);
          setUploading(false);

          // Ask if they want to continue without screenshot
          const continueWithout = window.confirm(t.confirmUploadFailed);
          if (!continueWithout) {
            setPaymentSubmitting(false);
            return;
          }
          downloadURL = null;
        }
      }

      // Submit payment request to API
      // Use loanId for regular loans, id for monthly finance loans
      const loanIdentifier = selectedLoan.loanId || selectedLoan.id || `${loanType}_${phoneNumber}`;

      const response = await fetch(`${API_URL}/pending-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: phoneNumber,
          customer_name: customerData.name,
          customer_phone: phoneNumber,
          loan_id: loanIdentifier,
          loan_type: loanType,
          amount: amount,
          payment_proof_url: downloadURL || 'NO_SCREENSHOT_UPLOADED'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to submit payment request');
      }

      await response.json();

      // Success - auto-send WhatsApp to admin and show success modal
      setShowPaymentModal(false);
      setSelectedLoan(null);
      setPaymentScreenshot(null);

      const successData = {
        amount: amount,
        customerName: customerData.name,
        loanType: loanType
      };
      setPaymentSuccess(successData);

      // Auto-send WhatsApp notification to admin
      const message = `🔔 *புதிய பணம் செலுத்தப்பட்டது!*

👤 வாடிக்கையாளர்: ${successData.customerName}
💰 தொகை: ₹${successData.amount?.toLocaleString('en-IN')}
📋 வகை: ${loanType === 'weekly' ? 'வாராந்திர கடன்' :
                loanType === 'monthly' ? 'மாதாந்திர கடன்' :
                loanType === 'daily' ? 'தினசரி கடன்' :
                loanType === 'vaddi' ? 'வட்டி கடன்' : loanType}
⏰ நேரம்: ${new Date().toLocaleString('en-IN')}

தயவுசெய்து ஆப்பில் சரிபார்த்து அனுமதிக்கவும் 🙏`;

      const whatsappUrl = `https://wa.me/918667510724?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error submitting payment:', error);
      alert(t.alertSubmitFailed(error.message));
    } finally {
      setPaymentSubmitting(false);
      setUploading(false);
    }
  };

  // QR Code Print Mode
  if (isQRMode) {
    const portalUrl = 'https://osa-finance.vercel.app/balance-check';
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(portalUrl)}&format=png`;

    return (
      <div style={{
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'white',
        minHeight: '100vh'
      }}>
        {/* Print Button - hidden in print */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }} className="no-print">
          <button
            onClick={() => window.print()}
            style={{
              padding: '12px 40px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🖨️ Print this Sheet
          </button>
        </div>

        {/* Printable Content */}
        <div style={{
          border: '3px solid #1e293b',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center'
        }}>
          {/* Business Name */}
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#1e293b',
            marginBottom: '8px',
            letterSpacing: '1px'
          }}>
            OM SAI MURUGAN FINANCE
          </div>
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '30px',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '20px'
          }}>
            Customer Self-Service Portal
          </div>

          {/* QR Code */}
          <div style={{ marginBottom: '24px' }}>
            <img
              src={qrApiUrl}
              alt="Scan to check your loan status"
              style={{
                width: '280px',
                height: '280px',
                border: '4px solid #1e293b',
                borderRadius: '12px',
                padding: '8px',
                background: 'white'
              }}
            />
          </div>

          {/* Scan Instruction */}
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '8px'
          }}>
            📱 Scan this QR Code
          </div>
          <div style={{
            fontSize: '15px',
            color: '#475569',
            marginBottom: '24px'
          }}>
            Use your phone camera or any QR scanner app
          </div>

          {/* Instructions Box */}
          <div style={{
            background: '#f0f9ff',
            border: '2px solid #bae6fd',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'left',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0369a1', marginBottom: '12px' }}>
              How to Use:
            </div>
            <div style={{ fontSize: '14px', color: '#334155', lineHeight: '2' }}>
              1. Scan the QR code above with your phone<br />
              2. Enter your registered mobile number<br />
              3. View your loan details & payment history<br />
              4. Pay directly using UPI and submit transaction ID<br />
              5. Admin will verify and confirm your payment
            </div>
          </div>

          {/* Tamil Instructions */}
          <div style={{
            background: '#fef3c7',
            border: '2px solid #fcd34d',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'left',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', marginBottom: '12px' }}>
              பயன்படுத்துவது எப்படி:
            </div>
            <div style={{ fontSize: '14px', color: '#78350f', lineHeight: '2' }}>
              1. மேலே உள்ள QR கோடை உங்கள் போனில் ஸ்கேன் செய்யவும்<br />
              2. உங்கள் பதிவு செய்த மொபைல் எண்ணை உள்ளிடவும்<br />
              3. உங்கள் கடன் விவரங்கள் & பணம் செலுத்திய வரலாறு பார்க்கவும்<br />
              4. UPI மூலம் நேரடியாக பணம் செலுத்தி Transaction ID சமர்ப்பிக்கவும்<br />
              5. Admin சரிபார்த்து உங்கள் பணம் செலுத்தியதை உறுதிப்படுத்துவார்
            </div>
          </div>

          {/* URL fallback */}
          <div style={{
            fontSize: '13px',
            color: '#64748b',
            borderTop: '2px solid #e2e8f0',
            paddingTop: '16px'
          }}>
            Or visit: <strong style={{ color: '#1e293b' }}>osa-finance.vercel.app/balance-check</strong>
          </div>
        </div>

        {/* Print styles */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0; padding: 0; }
            @page { margin: 10mm; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        color: 'white',
        marginBottom: '30px',
        paddingTop: '20px'
      }}>
        {/* Language toggle — English by default */}
        <div style={{ maxWidth: '500px', margin: '0 auto 14px auto', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', padding: '3px' }}>
            {[['en', 'English'], ['ta', 'தமிழ்']].map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => changeLang(code)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: lang === code ? 'white' : 'transparent',
                  color: lang === code ? '#5b4bc4' : 'white'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <h1 style={{
          fontSize: lang === 'ta' ? '22px' : '28px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          textShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          🏦 {t.brand}
        </h1>
        <p style={{
          fontSize: '16px',
          margin: 0,
          opacity: 0.95
        }}>
          {t.subtitle}
        </p>
      </div>

      {/* Main Container */}
      <div style={{
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        {!customerData ? (
          /* Phone Number Input Form */
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                margin: '0 auto 16px auto',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
              }}>
                📱
              </div>
              <h2 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#1e293b',
                margin: '0 0 8px 0'
              }}>
                {t.enterPhone}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                {t.enterPhoneSub}
              </p>
            </div>

            <form onSubmit={handleCheckBalance}>
              <input
                type="tel"
                placeholder={t.phonePlaceholder}
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setPhoneNumber(value);
                    setError('');
                  }
                }}
                maxLength={10}
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '18px',
                  textAlign: 'center',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                  marginBottom: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />

              {error && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  {t[error] || error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phoneNumber.length !== 10}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: loading || phoneNumber.length !== 10
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: loading || phoneNumber.length !== 10 ? 'not-allowed' : 'pointer',
                  boxShadow: loading || phoneNumber.length !== 10
                    ? 'none'
                    : '0 4px 16px rgba(102, 126, 234, 0.4)',
                  transition: 'transform 0.2s'
                }}
                onMouseDown={(e) => {
                  if (!loading && phoneNumber.length === 10) {
                    e.target.style.transform = 'scale(0.98)';
                  }
                }}
                onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
              >
                {loading ? t.checking : t.checkBalance}
              </button>
            </form>

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#0369a1',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                🔒 {t.secureNote}
              </p>
            </div>
          </div>
        ) : (
          /* Customer Data Display */
          <div>
            {/* Customer Info Header */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '8px'
              }}>
                👋 {t.welcome(customerData.name)}
              </div>
              <div style={{
                fontSize: '16px',
                color: '#64748b',
                marginBottom: '16px'
              }}>
                📱 {customerData.phone}
              </div>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 24px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t.checkAnother}
              </button>
            </div>

            {/* Monthly Finance Loans — a single loan renders as a full open
                card as before; multiple people sharing this number (each
                monthlyLoan.name is a different person) render as click-to-
                expand rows instead, same pattern as the weekly named groups. */}
            {customerData.monthlyFinanceLoans.length === 1 && (() => {
              const monthlyLoan = customerData.monthlyFinanceLoans[0];
              const loanKey = 'monthly-0';
              const isExpanded = expandedLoans[loanKey];
              const payments = monthlyLoan.payments || [];
              const totalPaid = monthlyLoan.loanAmount - monthlyLoan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '32px' }}>💰</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        {t.monthlyFinance}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {t.paymentDay(monthlyLoan.paymentDay)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '4px' }}>{t.loanAmount}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.loanAmount)}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>{t.balanceDue}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.balance)}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>{t.monthlyPayment}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.monthlyAmount)}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#faf5ff', borderRadius: '8px', border: '1px solid #d8b4fe' }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>{t.totalMonths}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{t.months(monthlyLoan.totalMonths)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                    <div>📅 {t.loanGiven}: {formatDate(monthlyLoan.loanGivenDate)}</div>
                    <div>🗓️ {t.emiStart}: {formatDate(monthlyLoan.startDate)}</div>
                    {monthlyLoan.currentMonth > 0 && (
                      <div>📊 {t.currentMonth(monthlyLoan.currentMonth, monthlyLoan.totalMonths)}</div>
                    )}
                    <div>💵 {t.totalPaid}: {formatCurrency(totalPaid)} ({t.paymentsCount(paymentsCompleted)})</div>
                  </div>

                  {monthlyLoan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(monthlyLoan, 'monthly')}
                      style={{
                        marginTop: '12px', width: '100%', padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white', border: 'none', borderRadius: '10px',
                        fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 {t.payNowUpi}
                    </button>
                  )}

                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('monthly', 0)}
                      style={{
                        marginTop: '8px', width: '100%', padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white', border: 'none', borderRadius: '8px',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {t.historyToggle(isExpanded, payments.length)}
                    </button>
                  )}

                  {isExpanded && payments.length > 0 && (
                    <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>📜 {t.paymentTimeline}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {payments.map((payment, paymentIndex) => (
                          <div key={payment.id || paymentIndex} style={{
                            padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>✅ {t.paymentNo(payments.length - paymentIndex)}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📅 {formatDate(payment.payment_date)}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>💳 {payModeLabel(payment.payment_mode)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(payment.amount)}</div>
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{t.balance}: {formatCurrency(payment.balance_after)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px', padding: '12px', background: '#fef3c7', borderRadius: '8px',
                      border: '1px solid #fcd34d', fontSize: '12px', color: '#92400e', textAlign: 'center'
                    }}>
                      ℹ️ {t.noPayments}
                    </div>
                  )}
                </div>
              );
            })()}

            {customerData.monthlyFinanceLoans.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '12px', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.9)', marginBottom: '10px', paddingLeft: '4px',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  💰 {t.monthlyFinance} ({customerData.monthlyFinanceLoans.length})
                </div>
                {customerData.monthlyFinanceLoans.map((monthlyLoan) => {
                  const groupKey = `monthly-group-${monthlyLoan.id}`;
                  const isOpen = !!expandedLinked[groupKey];
                  const payments = monthlyLoan.payments || [];
                  const totalPaid = monthlyLoan.loanAmount - monthlyLoan.balance;

                  return (
                    <div key={monthlyLoan.id} style={{
                      background: 'white', borderRadius: '14px', marginBottom: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden',
                      borderLeft: '4px solid #d97706'
                    }}>
                      <div
                        onClick={() => toggleLinked(groupKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '14px', flexShrink: 0
                        }}>
                          {(monthlyLoan.name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{monthlyLoan.name}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{t.monthlyFinance}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '9.5px', color: '#92400e', fontWeight: 700 }}>{t.balance.toUpperCase()}</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.balance)}</div>
                        </div>
                        <div style={{
                          fontSize: '12px', color: '#64748b',
                          transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease'
                        }}>▼</div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1.5px dashed #e5e7eb', marginTop: '2px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                            <div style={{ padding: '10px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                              <div style={{ fontSize: '10px', color: '#0369a1', marginBottom: '3px' }}>{t.loanAmount.toUpperCase()}</div>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.loanAmount)}</div>
                            </div>
                            <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                              <div style={{ fontSize: '10px', color: '#92400e', marginBottom: '3px' }}>{t.balanceDue.toUpperCase()}</div>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.balance)}</div>
                            </div>
                            <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                              <div style={{ fontSize: '10px', color: '#166534', marginBottom: '3px' }}>{t.monthlyPayment.toUpperCase()}</div>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(monthlyLoan.monthlyAmount)}</div>
                            </div>
                            <div style={{ padding: '10px', background: '#faf5ff', borderRadius: '8px', border: '1px solid #d8b4fe' }}>
                              <div style={{ fontSize: '10px', color: '#6b21a8', marginBottom: '3px' }}>{t.totalMonths.toUpperCase()}</div>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{t.months(monthlyLoan.totalMonths)}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#64748b' }}>
                            📅 {t.loanGivenLine(formatDate(monthlyLoan.loanGivenDate), formatDate(monthlyLoan.startDate))}
                            {monthlyLoan.currentMonth ? ` · ${t.monthOf(monthlyLoan.currentMonth, monthlyLoan.totalMonths)}` : ''}
                            {' '}· {t.totalPaidInline} {formatCurrency(totalPaid)} ({t.paymentsCount(payments.length)})
                          </div>

                          {monthlyLoan.balance > 0 && (
                            <button
                              onClick={() => handlePayNow(monthlyLoan, 'monthly')}
                              style={{
                                marginTop: '10px', width: '100%', padding: '11px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white', border: 'none', borderRadius: '9px',
                                fontSize: '13.5px', fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              💳 {t.payNowUpi}
                            </button>
                          )}

                          {payments.length > 0 ? (
                            <div style={{ marginTop: '10px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
                                {t.paymentHistory}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {[...payments].reverse().map((payment, pIdx) => (
                                  <div key={payment.id || pIdx} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '9px 10px', background: '#f8fafc', borderRadius: '7px', border: '1px solid #e5e7eb'
                                  }}>
                                    <div>
                                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1e293b' }}>✅ {formatDate(payment.payment_date)}</div>
                                      <div style={{ fontSize: '10px', color: '#64748b' }}>💳 {payModeLabel(payment.payment_mode)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(payment.amount)}</div>
                                      <div style={{ fontSize: '9.5px', color: '#64748b' }}>{t.balance}: {formatCurrency(payment.balance_after)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              marginTop: '10px', padding: '10px', background: '#fef3c7', borderRadius: '8px',
                              border: '1px solid #fcd34d', fontSize: '11.5px', color: '#92400e', textAlign: 'center'
                            }}>
                              ℹ️ {t.noPayments}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Named Groups — this account has multiple loans under different
                people's names (a shared family/contact number), so show each
                person as its own click-to-expand row instead of a flat list. */}
            {customerData.namedGroups && customerData.namedGroups.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '12px', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.9)', marginBottom: '10px', paddingLeft: '4px',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  📅 {t.weeklyLoans} ({customerData.namedGroups.length})
                </div>
                {customerData.namedGroups.map((grp) => {
                  const groupKey = `group-${grp.name}`;
                  const isOpen = !!expandedLinked[groupKey];
                  const allLoans = [
                    ...grp.weeklyLoans.map(l => ({ ...l, kind: 'Weekly', unitAmount: l.weeklyAmount, unitLabel: t.weeklyPayment, loanType: 'weekly' })),
                    ...grp.dailyLoans.map(l => ({ ...l, kind: 'Daily', unitAmount: l.dailyAmount, unitLabel: t.dailyPayment, loanType: 'daily' })),
                    ...grp.interestLoans.map(l => ({ ...l, kind: 'Interest', unitAmount: l.monthlyInterest, unitLabel: t.monthlyInterest, loanType: 'interest' }))
                  ];
                  const totalBalance = allLoans.reduce((sum, l) => sum + (l.balance || 0), 0);

                  return (
                    <div key={grp.name} style={{
                      background: 'white',
                      borderRadius: '14px',
                      marginBottom: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      borderLeft: '4px solid #667eea'
                    }}>
                      <div
                        onClick={() => toggleLinked(groupKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '14px 16px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '14px', flexShrink: 0
                        }}>
                          {(grp.name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{grp.name}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {summarizeLoanKinds(allLoans)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '9.5px', color: '#92400e', fontWeight: 700 }}>{t.balance.toUpperCase()}</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(totalBalance)}</div>
                        </div>
                        <div style={{
                          fontSize: '12px', color: '#64748b',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease'
                        }}>▼</div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1.5px dashed #e5e7eb', marginTop: '2px' }}>
                          {allLoans.map((loan, li) => (
                            <div key={loan.loanId || li} style={{ marginTop: '14px' }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '10px'
                              }}>
                                <div style={{ padding: '10px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                  <div style={{ fontSize: '10px', color: '#0369a1', marginBottom: '3px' }}>{t.loanAmount.toUpperCase()}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(loan.loanAmount)}</div>
                                </div>
                                <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                                  <div style={{ fontSize: '10px', color: '#92400e', marginBottom: '3px' }}>{t.balanceDue.toUpperCase()}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(loan.balance)}</div>
                                </div>
                                <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac', gridColumn: '1 / -1' }}>
                                  <div style={{ fontSize: '10px', color: '#166534', marginBottom: '3px' }}>{loan.unitLabel.toUpperCase()}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(loan.unitAmount)}</div>
                                </div>
                              </div>
                              <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#64748b' }}>
                                📅 {t.startedLine(formatDate(loan.startDate), (loan.payments || []).length)}
                              </div>

                              {loan.balance > 0 && (
                                <button
                                  onClick={() => handlePayNow(loan, loan.loanType)}
                                  style={{
                                    marginTop: '10px',
                                    width: '100%',
                                    padding: '11px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '9px',
                                    fontSize: '13.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  💳 {t.payNowUpi}
                                </button>
                              )}

                              {loan.payments && loan.payments.length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
                                    {t.paymentHistory}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {[...loan.payments].reverse().map((payment, pIdx) => (
                                      <div
                                        key={payment.id || pIdx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '9px 10px',
                                          background: '#f8fafc',
                                          borderRadius: '7px',
                                          border: '1px solid #e5e7eb'
                                        }}
                                      >
                                        <div>
                                          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1e293b' }}>
                                            ✅ {formatDate(payment.payment_date)}
                                          </div>
                                          <div style={{ fontSize: '10px', color: '#64748b' }}>💳 {payModeLabel(payment.payment_mode)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(payment.amount)}</div>
                                          <div style={{ fontSize: '9.5px', color: '#64748b' }}>{t.balance}: {formatCurrency(payment.balance_after)}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weekly Loans */}
            {customerData.weeklyLoans.length > 0 && customerData.weeklyLoans.map((loan, index) => {
              const loanKey = `weekly-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = loan.payments || [];
              const totalPaid = loan.loanAmount - loan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={index} style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '32px' }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        {t.weeklyLoan} {customerData.weeklyLoans.length > 1 ? `(${index + 1})` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {loanNameLabel(loan.loanName)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div style={{
                      padding: '12px',
                      background: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd'
                    }}>
                      <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '4px' }}>
                        {t.loanAmount}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.loanAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>
                        {t.balanceDue}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.balance)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                        {t.weeklyPayment}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.weeklyAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#faf5ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                        {t.startDate}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatDate(loan.startDate)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <div>💵 {t.totalPaid}: {formatCurrency(totalPaid)} ({t.paymentsCount(paymentsCompleted)})</div>
                  </div>

                  {/* Pay Now Button */}
                  {loan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(loan, 'weekly')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 {t.payNowUpi}
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('weekly', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {t.historyToggle(isExpanded, payments.length)}
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 {t.paymentTimeline}
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ {t.paymentNo(payments.length - paymentIndex)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payModeLabel(payment.payment_mode)}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                {t.balance}: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ {t.noPayments}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Daily Loans */}
            {customerData.dailyLoans.length > 0 && customerData.dailyLoans.map((loan, index) => {
              const loanKey = `daily-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = loan.payments || [];
              const totalPaid = loan.loanAmount - loan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={index} style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '32px' }}>📆</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        {t.dailyLoan} {customerData.dailyLoans.length > 1 ? `(${index + 1})` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {loanNameLabel(loan.loanName)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div style={{
                      padding: '12px',
                      background: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd'
                    }}>
                      <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '4px' }}>
                        {t.loanAmount}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.loanAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>
                        {t.balanceDue}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.balance)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                        {t.dailyPayment}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.dailyAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#faf5ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                        {t.startDate}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatDate(loan.startDate)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <div>💵 {t.totalPaid}: {formatCurrency(totalPaid)} ({t.paymentsCount(paymentsCompleted)})</div>
                  </div>

                  {/* Pay Now Button */}
                  {loan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(loan, 'daily')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 {t.payNowUpi}
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('daily', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {t.historyToggle(isExpanded, payments.length)}
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 {t.paymentTimeline}
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ {t.paymentNo(payments.length - paymentIndex)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payModeLabel(payment.payment_mode)}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                {t.balance}: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ {t.noPayments}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Interest Loans */}
            {customerData.interestLoans.length > 0 && customerData.interestLoans.map((loan, index) => {
              const loanKey = `interest-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = loan.payments || [];
              const totalPaid = loan.loanAmount - loan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={index} style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '32px' }}>💵</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        {t.interestLoan} {customerData.interestLoans.length > 1 ? `(${index + 1})` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {loanNameLabel(loan.loanName)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div style={{
                      padding: '12px',
                      background: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd'
                    }}>
                      <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '4px' }}>
                        {t.principalAmount}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.loanAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>
                        {t.balanceDue}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.balance)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                        {t.interestRate}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {loan.interestRate}% {t.perMonth}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#faf5ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                        {t.monthlyInterest}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.monthlyInterest)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <div>📅 {t.startDate}: {formatDate(loan.startDate)}</div>
                    <div>💵 {t.totalPaid}: {formatCurrency(totalPaid)} ({t.paymentsCount(paymentsCompleted)})</div>
                  </div>

                  {/* Pay Now Button */}
                  {loan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(loan, 'interest')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 {t.payInterestUpi}
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('interest', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {t.historyToggle(isExpanded, payments.length)}
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 {t.paymentTimeline}
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ {t.paymentNo(payments.length - paymentIndex)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payModeLabel(payment.payment_mode)}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                {t.balance}: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ {t.noPayments}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Auto Finance Loans */}
            {customerData.autoFinanceLoans && customerData.autoFinanceLoans.length > 0 && customerData.autoFinanceLoans.map((autoLoan, index) => {
              const loanKey = `auto-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = autoLoan.payments || [];
              const progressPercent = Math.round((autoLoan.paidEmis / autoLoan.tenureMonths) * 100);

              return (
                <div key={autoLoan.id || index} style={{
                  background: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  marginBottom: '16px'
                }}>
                  {/* Loan Header */}
                  <div
                    onClick={() => setExpandedLoans(prev => ({ ...prev, [loanKey]: !prev[loanKey] }))}
                    style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #065f46 100%)',
                      padding: '16px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600 }}>
                          🚗 {t.vehicleLoan}
                        </div>
                        <div style={{ color: 'white', fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                          {autoLoan.loanName}
                        </div>
                        {autoLoan.vehicleReg && (
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>
                            {autoLoan.vehicleReg}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>
                          {formatCurrency(autoLoan.emiAmount)}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>{t.emiPerMonth}</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>
                          {t.emisPaid(autoLoan.paidEmis, autoLoan.tenureMonths)}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>{progressPercent}%</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '4px', height: '6px' }}>
                        <div style={{
                          background: '#fbbf24',
                          borderRadius: '4px',
                          height: '100%',
                          width: `${progressPercent}%`,
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Loan Details */}
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>{t.loanAmount}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(autoLoan.loanAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>{t.totalPayable}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(autoLoan.totalPayable)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>{t.balance}</span>
                      <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '16px' }}>{formatCurrency(autoLoan.balance)}</span>
                    </div>

                    {/* Pay Now Button */}
                    <button
                      onClick={() => {
                        setSelectedLoan({
                          ...autoLoan,
                          loanType: 'auto-finance',
                          monthlyAmount: autoLoan.emiAmount
                        });
                        setShowPaymentModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #0d9488 0%, #065f46 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginTop: '12px'
                      }}
                    >
                      💰 {t.payEmiNow}
                    </button>

                    {/* Payment History Toggle */}
                    {payments.length > 0 && (
                      <button
                        onClick={() => setExpandedLoans(prev => ({ ...prev, [loanKey]: !prev[loanKey] }))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'transparent',
                          color: '#0d9488',
                          border: '1px solid #0d9488',
                          borderRadius: '8px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          marginTop: '8px'
                        }}
                      >
                        {isExpanded ? '▲' : '▼'} {t.historyToggle(isExpanded, payments.length)}
                      </button>
                    )}
                  </div>

                  {/* Payment History */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 16px' }}>
                      {payments.map((payment, pIdx) => (
                        <div key={pIdx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: pIdx < payments.length - 1 ? '1px solid #f1f5f9' : 'none',
                          fontSize: '13px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{t.emiNo(payment.emi_number)}</div>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>
                              {new Date(payment.payment_date).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600, color: '#059669' }}>{formatCurrency(payment.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No Loans Message */}
            {customerData.monthlyFinanceLoans.length === 0 &&
             customerData.weeklyLoans.length === 0 &&
             customerData.dailyLoans.length === 0 &&
             customerData.interestLoans.length === 0 &&
             (!customerData.autoFinanceLoans || customerData.autoFinanceLoans.length === 0) &&
             (!customerData.linkedCustomers || customerData.linkedCustomers.length === 0) &&
             (!customerData.namedGroups || customerData.namedGroups.length === 0) && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '40px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                  {t.noActiveLoans}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  {t.noActiveLoansSub}
                </div>
              </div>
            )}

            {/* Linked Accounts — other people who share this phone number,
                each with their own independent loan(s) and history */}
            {customerData.linkedCustomers && customerData.linkedCustomers.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.85)',
                  marginBottom: '10px',
                  paddingLeft: '4px'
                }}>
                  {t.alsoLinked(customerData.linkedCustomers.length)}
                </div>

                {customerData.linkedCustomers.map((lc) => {
                  const isOpen = !!expandedLinked[lc.customerId];
                  const allLoans = [
                    ...lc.weeklyLoans.map(l => ({ ...l, kind: 'Weekly', unitAmount: l.weeklyAmount, unitLabel: t.weeklyPayment, loanType: 'weekly' })),
                    ...lc.dailyLoans.map(l => ({ ...l, kind: 'Daily', unitAmount: l.dailyAmount, unitLabel: t.dailyPayment, loanType: 'daily' })),
                    ...lc.interestLoans.map(l => ({ ...l, kind: 'Interest', unitAmount: l.monthlyInterest, unitLabel: t.monthlyInterest, loanType: 'interest' }))
                  ];
                  const totalBalance = allLoans.reduce((sum, l) => sum + (l.balance || 0), 0);

                  return (
                    <div key={lc.customerId} style={{
                      background: 'white',
                      borderRadius: '14px',
                      marginBottom: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      overflow: 'hidden'
                    }}>
                      <div
                        onClick={() => toggleLinked(lc.customerId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '14px 16px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '14px', flexShrink: 0
                        }}>
                          {(lc.name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{lc.name}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {summarizeLoanKinds(allLoans)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '9.5px', color: '#92400e', fontWeight: 700 }}>{t.balance.toUpperCase()}</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(totalBalance)}</div>
                        </div>
                        <div style={{
                          fontSize: '12px', color: '#64748b',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease'
                        }}>▼</div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1.5px dashed #e5e7eb', marginTop: '2px' }}>
                          {allLoans.map((loan, li) => (
                            <div key={loan.loanId || li} style={{ marginTop: '14px' }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '10px'
                              }}>
                                <div style={{ padding: '10px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                  <div style={{ fontSize: '10px', color: '#0369a1', marginBottom: '3px' }}>{t.loanAmount.toUpperCase()}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(loan.loanAmount)}</div>
                                </div>
                                <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                                  <div style={{ fontSize: '10px', color: '#92400e', marginBottom: '3px' }}>{t.balanceDue.toUpperCase()}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(loan.balance)}</div>
                                </div>
                                <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac', gridColumn: '1 / -1' }}>
                                  <div style={{ fontSize: '10px', color: '#166534', marginBottom: '3px' }}>{loan.unitLabel.toUpperCase()}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(loan.unitAmount)}</div>
                                </div>
                              </div>
                              <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#64748b' }}>
                                📅 {t.startedLine(formatDate(loan.startDate), (loan.payments || []).length)}
                              </div>

                              {loan.balance > 0 && (
                                <button
                                  onClick={() => handlePayNow(loan, loan.loanType)}
                                  style={{
                                    marginTop: '10px',
                                    width: '100%',
                                    padding: '11px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '9px',
                                    fontSize: '13.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  💳 {t.payNowUpi}
                                </button>
                              )}

                              {loan.payments && loan.payments.length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
                                    {t.paymentHistory}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {[...loan.payments].reverse().map((payment, pIdx) => (
                                      <div
                                        key={payment.id || pIdx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '9px 10px',
                                          background: '#f8fafc',
                                          borderRadius: '7px',
                                          border: '1px solid #e5e7eb'
                                        }}
                                      >
                                        <div>
                                          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1e293b' }}>
                                            ✅ {formatDate(payment.payment_date)}
                                          </div>
                                          <div style={{ fontSize: '10px', color: '#64748b' }}>💳 {payModeLabel(payment.payment_mode)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(payment.amount)}</div>
                                          <div style={{ fontSize: '9.5px', color: '#64748b' }}>{t.balance}: {formatCurrency(payment.balance_after)}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '16px',
              marginTop: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '8px'
              }}>
                {t.queries}
              </div>
              <a
                href="tel:+918667510724"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                📞 +91 8667510724
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div style={{
        textAlign: 'center',
        color: 'white',
        marginTop: '40px',
        opacity: 0.9,
        fontSize: '12px'
      }}>
        <p style={{ margin: 0 }}>{t.copyright}</p>
      </div>

      {/* UPI Payment Modal */}
      {showPaymentModal && selectedLoan && (
        <div
          onClick={() => !uploading && !paymentSubmitting && setShowPaymentModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '450px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: 700,
                color: '#1e293b'
              }}>
                {t.payViaUpi}
              </h3>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {loanNameLabel(selectedLoan.loanName) || t.loanPayment}
              </div>
            </div>

            {/* Payment Details */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>{t.amountToPay}</span>
                <span style={{ fontWeight: 700, fontSize: '18px', color: '#10b981' }}>
                  {selectedLoan.loanType === 'monthly' && formatCurrency(selectedLoan.monthlyAmount)}
                  {selectedLoan.loanType === 'weekly' && formatCurrency(selectedLoan.weeklyAmount)}
                  {selectedLoan.loanType === 'daily' && formatCurrency(selectedLoan.dailyAmount)}
                  {selectedLoan.loanType === 'interest' && formatCurrency(selectedLoan.monthlyInterest)}
                  {selectedLoan.loanType === 'auto-finance' && formatCurrency(selectedLoan.emiAmount || selectedLoan.monthlyAmount)}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>{t.currentBalance}</span>
                <span style={{ fontWeight: 600, fontSize: '16px', color: '#475569' }}>
                  {formatCurrency(selectedLoan.balance)}
                </span>
              </div>
            </div>

            {/* UPI Details */}
            <div style={{
              background: '#dcfce7',
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#166534', marginBottom: '12px' }}>
                📱 {t.payToUpi}
              </div>
              <div style={{
                background: 'white',
                padding: '10px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '15px',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center',
                marginBottom: '6px'
              }}>
                santhokam@okicici
              </div>
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>{t.or}</div>
              <div style={{
                background: 'white',
                padding: '10px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '15px',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                8667510724@pthdfc
              </div>
              <button
                onClick={() => {
                  const amount = selectedLoan.loanType === 'monthly' ? selectedLoan.monthlyAmount :
                                selectedLoan.loanType === 'weekly' ? selectedLoan.weeklyAmount :
                                selectedLoan.loanType === 'daily' ? selectedLoan.dailyAmount :
                                selectedLoan.loanType === 'auto-finance' ? (selectedLoan.emiAmount || selectedLoan.monthlyAmount) :
                                selectedLoan.monthlyInterest;
                  const upiLink = `upi://pay?pa=santhokam@okicici&pn=Om%20Sai%20Murugan%20Finance&am=${amount}&cu=INR&tn=${selectedLoan.loanName}%20Payment`;
                  window.open(upiLink, '_blank');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t.openUpiApp}
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#92400e'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>📋 {t.instructionsTitle}</div>
              <ol style={{ margin: '0', paddingLeft: '20px' }}>
                {t.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
              <div style={{
                marginTop: '12px',
                padding: '8px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                fontSize: '11px'
              }}>
                <strong>{t.noteLabel}</strong> {t.noteText}
              </div>
            </div>

            {/* Screenshot Upload */}
            <div style={{
              marginBottom: '20px'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '8px'
              }}>
                {t.uploadLabel} <span style={{ color: '#64748b', fontWeight: 400 }}>{t.optional}</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                disabled={uploading || paymentSubmitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              />
              {paymentScreenshot && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#dcfce7',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#166534'
                }}>
                  ✓ {t.screenshotSelected} {paymentScreenshot.name}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentScreenshot(null);
                }}
                disabled={uploading || paymentSubmitting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: uploading || paymentSubmitting ? 'not-allowed' : 'pointer',
                  opacity: uploading || paymentSubmitting ? 0.5 : 1
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleSubmitPayment(false)}
                disabled={uploading || paymentSubmitting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: uploading || paymentSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: uploading || paymentSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: uploading || paymentSubmitting ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                {uploading ? t.uploading : paymentSubmitting ? t.submitting : t.submitPayment}
              </button>
            </div>

            {/* Note */}
            <div style={{
              marginTop: '16px',
              fontSize: '11px',
              color: '#64748b',
              textAlign: 'center'
            }}>
              {t.verifyNote}
            </div>
          </div>
        </div>
      )}

      {/* Payment Success Modal with WhatsApp */}
      {paymentSuccess && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Success Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '40px'
            }}>
              ✓
            </div>

            <h2 style={{
              color: '#1e293b',
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 0 10px'
            }}>
              {t.paymentSubmitted}
            </h2>

            <p style={{
              color: '#64748b',
              fontSize: '14px',
              margin: '0 0 20px',
              lineHeight: 1.5
            }}>
              {t.amount}: <strong style={{ color: '#059669' }}>₹{paymentSuccess.amount?.toLocaleString('en-IN')}</strong><br />
              {t.customer}: <strong>{paymentSuccess.customerName}</strong>
            </p>

            {/* WhatsApp auto-sent confirmation */}
            <div style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: 'white',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              {t.adminNotified}
            </div>

            <p style={{
              color: '#64748b',
              fontSize: '12px',
              margin: '0 0 16px'
            }}>
              {t.sendWhatsappNote}
            </p>

            {/* Done Button */}
            <button
              onClick={() => setPaymentSuccess(null)}
              style={{
                width: '100%',
                padding: '14px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BalanceCheck;
