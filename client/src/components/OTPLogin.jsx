import { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import { API_URL } from '../config';

function OTPLogin({ onLoginSuccess }) {
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'pending', 'name'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

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
      // Validate phone number
      if (!/^\d{10}$/.test(phone)) {
        setError('Please enter a valid 10-digit mobile number');
        setLoading(false);
        return;
      }

      const phoneNumber = `+91${phone}`;

      // Check if user exists
      const checkResponse = await fetch(`${API_URL}/users/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        // Existing user - check status
        if (checkData.status === 'pending') {
          setStep('pending');
          setLoading(false);
          return;
        }
        if (checkData.status === 'rejected') {
          setError('Your account has been rejected. Please contact admin.');
          setLoading(false);
          return;
        }
        // Approved user - proceed with OTP
        setIsNewUser(false);
      } else {
        // New user - will need to enter name after OTP
        setIsNewUser(true);
      }

      // Setup reCAPTCHA and send OTP
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);

      setConfirmationResult(result);
      // Use checkData.exists directly instead of isNewUser state (which hasn't updated yet)
      setStep(checkData.exists ? 'otp' : 'name');
      setLoading(false);
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
      setLoading(false);
    }
  };

  // Handle name submission for new users
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setStep('otp');
    setError('');
  };

  // Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify OTP with Firebase
      await confirmationResult.confirm(otp);

      if (isNewUser) {
        // Register new user
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
      } else {
        // Existing user - login
        const loginResponse = await fetch(`${API_URL}/users/login-with-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });

        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
          throw new Error(loginData.error || 'Login failed');
        }

        // Save login state
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userData', JSON.stringify(loginData.user));

        onLoginSuccess();
      }
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

        {step === 'phone' && (
          <form onSubmit={handleSendOTP}>
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
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  required
                  maxLength="10"
                />
              </div>
            </div>

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
                letterSpacing: '1px'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              {loading ? '⏳ Sending...' : '📱 Send OTP'}
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit}>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                OTP sent to +91{phone}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                Your Name
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

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Continue
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP}>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                OTP sent to +91{phone}
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
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError('');
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Change Number
            </button>
          </form>
        )}

        {step === 'pending' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
            <h3 style={{ color: '#1e293b', marginBottom: '10px' }}>Waiting for Approval</h3>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
              Your account is pending admin approval. You'll be able to access the application once the admin approves your request.
            </p>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '20px' }}>
              Mobile: +91{phone}
            </p>
            <button
              onClick={() => {
                setStep('phone');
                setPhone('');
                setName('');
                setOtp('');
                setError('');
              }}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: 'transparent',
                color: '#3b82f6',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Try Different Number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OTPLogin;
