import { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import { API_URL } from '../config';

function OTPRegistration({ onBackToLogin }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Setup reCAPTCHA
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
      });
    }
  };

  // Send OTP
  const handleSendOTP = async () => {
    setError('');
    setLoading(true);

    try {
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

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
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
      if (otp.length !== 6) {
        setError('Please enter 6-digit OTP');
        setLoading(false);
        return;
      }

      // Verify OTP with Firebase
      await confirmationResult.confirm(otp);
      setOtpVerified(true);

      // Register user with password
      const registerResponse = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || '',
          password,
          phone_verified: true
        })
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.error || 'Registration failed');
      }

      setRegistrationComplete(true);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Registration failed. Please try again.');
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
        @keyframes fly-inside {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(30px, -20px) rotate(15deg);
          }
          50% {
            transform: translate(-20px, -40px) rotate(-15deg);
          }
          75% {
            transform: translate(40px, -30px) rotate(20deg);
          }
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
        zIndex: 1,
        overflow: 'hidden'
      }}>
        {/* Butterflies INSIDE the card */}
        <div style={{
          position: 'absolute',
          left: '10%',
          top: '15%',
          fontSize: '25px',
          opacity: 0.3,
          pointerEvents: 'none',
          animation: 'fly-inside 10s infinite ease-in-out 0s'
        }}>🦋</div>
        <div style={{
          position: 'absolute',
          right: '10%',
          top: '40%',
          fontSize: '22px',
          opacity: 0.3,
          pointerEvents: 'none',
          animation: 'fly-inside 12s infinite ease-in-out 3s'
        }}>🦋</div>
        <div style={{
          position: 'absolute',
          left: '15%',
          bottom: '20%',
          fontSize: '28px',
          opacity: 0.3,
          pointerEvents: 'none',
          animation: 'fly-inside 14s infinite ease-in-out 6s'
        }}>🦋</div>

        <div style={{ textAlign: 'center', marginBottom: '35px', position: 'relative', zIndex: 10 }}>
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

        {!registrationComplete ? (
          <>
            <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '25px', fontSize: '20px', position: 'relative', zIndex: 10 }}>
              Create New Account
            </h2>

            {error && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                color: '#dc2626',
                fontSize: '14px',
                position: 'relative',
                zIndex: 10
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyAndRegister} style={{ position: 'relative', zIndex: 10 }}>
              {/* Name */}
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
                  required
                />
              </div>

              {/* Mobile Number */}
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
                    required
                    maxLength="10"
                  />
                </div>
                {!otpSent && (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading || !name || !phone || !password}
                    style={{
                      marginTop: '10px',
                      padding: '10px 20px',
                      background: loading || !name || !phone || !password ? '#cbd5e1' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: loading || !name || !phone || !password ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? '⏳ Sending...' : '📱 Send OTP'}
                  </button>
                )}
              </div>

              {/* OTP Input (shown after OTP sent) */}
              {otpSent && !otpVerified && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                    Enter OTP
                  </label>
                  <p style={{ color: '#10b981', fontSize: '13px', marginBottom: '10px' }}>
                    ✓ OTP sent to +91{phone} (Check SMS)
                  </p>
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
                    required
                    maxLength="6"
                  />
                </div>
              )}

              {/* Email */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                  Create Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password (min 6 chars)"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                  required
                  minLength="6"
                />
              </div>

              {/* Register Button */}
              {otpSent && (
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: loading || otp.length !== 6 ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                    marginBottom: '15px'
                  }}
                >
                  {loading ? 'Registering...' : '✓ Register'}
                </button>
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
          </>
        ) : (
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
            <h3 style={{ color: '#1e293b', marginBottom: '10px' }}>Registration Successful!</h3>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
              Your account is pending admin approval. You'll be able to login with your mobile number and password once approved.
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
