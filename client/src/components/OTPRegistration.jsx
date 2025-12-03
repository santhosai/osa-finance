import { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import { API_URL } from '../config';

function OTPRegistration({ onBackToLogin }) {
  const [step, setStep] = useState('form'); // 'form', 'otp', 'pending'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Setup reCAPTCHA
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
      });
    }
  };

  // Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!name.trim()) {
        setError('Please enter your name');
        setLoading(false);
        return;
      }

      if (!/^\d{10}$/.test(phone)) {
        setError('Please enter a valid 10-digit mobile number');
        setLoading(false);
        return;
      }

      const phoneNumber = `+91${phone}`;

      // Check if user already exists
      const checkResponse = await fetch(`${API_URL}/users/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        setError('This mobile number is already registered. Please login instead.');
        setLoading(false);
        return;
      }

      // Setup reCAPTCHA and send OTP
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);

      setConfirmationResult(result);
      setOtpSent(true);
      setLoading(false);
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
      setLoading(false);
    }
  };

  // Verify OTP and Register
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify OTP with Firebase
      await confirmationResult.confirm(otp);

      // Register user
      const registerResponse = await fetch(`${API_URL}/users/register-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.error || 'Registration failed');
      }

      // Show pending approval message
      setStep('pending');
      setLoading(false);
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated floating circles background */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        top: '-100px',
        left: '-100px',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        bottom: '-50px',
        right: '-50px',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />

      <div id="recaptcha-container"></div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '50px 40px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'slideIn 0.5s ease-out',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h1 style={{
            color: '#FF6B35',
            margin: '0 0 5px 0',
            fontSize: '32px',
            fontWeight: '800',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            OM SAI MURUGAN
          </h1>
          <p style={{
            color: '#667eea',
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            FINANCE
          </p>
          <div style={{
            width: '60px',
            height: '3px',
            background: 'linear-gradient(90deg, #FF6B35, #667eea)',
            margin: '15px auto 0',
            borderRadius: '2px'
          }} />
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#dc2626',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSendOTP}>
            <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '25px', fontSize: '20px' }}>
              Create New Account
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                Mobile Number
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  fontWeight: 600
                }}>
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 50px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  required
                  maxLength="10"
                />
              </div>
            </div>

            {!otpSent && (
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: loading ? '#cbd5e1' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: loading ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '15px'
                }}
              >
                {loading ? '⏳ Sending...' : '📱 Send OTP'}
              </button>
            )}

            {otpSent && (
              <>
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <p style={{ color: '#10b981', fontSize: '14px', marginBottom: '15px', fontWeight: 600 }}>
                    ✓ OTP sent to +91{phone}
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '20px',
                      textAlign: 'center',
                      letterSpacing: '8px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    required
                    maxLength="6"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyAndRegister}
                  disabled={loading || otp.length !== 6}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: loading || otp.length !== 6 ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  {loading ? 'Verifying...' : '✓ Verify & Register'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← Back to Login
            </button>
          </form>
        )}

        {step === 'pending' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
            <h3 style={{ color: '#1e293b', marginBottom: '10px' }}>Registration Successful!</h3>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
              Your account is pending admin approval. You'll be able to login once the admin approves your request.
            </p>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '20px' }}>
              Name: {name}<br/>
              Mobile: +91{phone}
            </p>
            <button
              onClick={onBackToLogin}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OTPRegistration;
