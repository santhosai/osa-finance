import { useState } from 'react';
import { API_URL } from '../config';
import './Login.css';

// PASSWORD VERSION - Change this when you change password to logout all devices
const PASSWORD_VERSION = '2025-01-27-v2';

function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'admin'
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState(''); // email or phone for login
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper to check if a string is likely a phone number
  const isPhoneNumber = (value) => /^\d{10}$/.test(value);

  const handleAdminLogin = (e) => {
    e.preventDefault();

    // Admin login with hardcoded credentials
    if (userId === 'omsairam' && password === 'SAnt@#21') {
      // Store password version and admin flag
      localStorage.setItem('passwordVersion', PASSWORD_VERSION);
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('userName', 'Admin');
      onLogin(true);
    } else {
      setError('Invalid Admin ID or Password');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUserLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Determine if loginIdentifier is email or phone
      const loginData = isPhoneNumber(loginIdentifier)
        ? { phone: loginIdentifier, password }
        : { email: loginIdentifier, password };

      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (response.ok) {
        // Store user info
        localStorage.setItem('passwordVersion', PASSWORD_VERSION);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userId', data.user.id);
        onLogin(true);
      } else {
        setError(data.error || 'Login failed');
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Connection error. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validate at least email or phone is provided
    if (!email && !phone) {
      setError('Please provide either Email or Mobile number');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    // Validate phone format if provided
    if (phone && !isPhoneNumber(phone)) {
      setError('Mobile number must be 10 digits');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email || '', phone: phone || '', password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Registration successful! Please wait for admin approval.');
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setTimeout(() => {
          setMode('login');
          setSuccess('');
        }, 5000);
      } else {
        setError(data.error || 'Registration failed');
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Connection error. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="company-header">
          <div className="company-name-container">
            <div className="company-name">OM SAI MURUGAN</div>
            <div className="company-type">FINANCE</div>
          </div>
        </div>

        <div className="welcome-text">
          {mode === 'login' && 'Welcome Back! Please login'}
          {mode === 'register' && 'Create New Account'}
          {mode === 'admin' && 'Admin Login'}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#d1fae5',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 600
          }}>
            {success}
          </div>
        )}

        {/* User Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleUserLogin} className="login-form">
            <div className="form-group">
              <label className="login-label">Email or Mobile</label>
              <input
                type="text"
                className="login-input"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Enter email or 10-digit mobile"
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="login-label">Password</label>
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'LOGGING IN...' : 'LOGIN'}
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#667eea',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'underline'
                }}
              >
                Create New Account
              </button>
            </div>

            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('admin'); setError(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Admin Login
              </button>
            </div>
          </form>
        )}

        {/* Admin Login Form */}
        {mode === 'admin' && (
          <form onSubmit={handleAdminLogin} className="login-form">
            <div className="form-group">
              <label className="login-label">Admin ID</label>
              <input
                type="text"
                className="login-input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter Admin ID"
                required
              />
            </div>

            <div className="form-group">
              <label className="login-label">Password</label>
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                required
              />
            </div>

            <button type="submit" className="login-button">
              ADMIN LOGIN
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#667eea',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ← Back to User Login
              </button>
            </div>
          </form>
        )}

        {/* Registration Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label className="login-label">Full Name *</label>
              <input
                type="text"
                className="login-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
                disabled={isLoading}
              />
            </div>

            <div style={{
              padding: '8px 12px',
              background: '#e0e7ff',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#4338ca',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              Provide either Email or Mobile (at least one required)
            </div>

            <div className="form-group">
              <label className="login-label">Email</label>
              <input
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="login-label">Mobile Number</label>
              <input
                type="tel"
                className="login-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit mobile"
                maxLength="10"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="login-label">Password *</label>
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password (min 6 chars)"
                required
                minLength="6"
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'REGISTERING...' : 'REGISTER'}
            </button>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#fef3c7',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#92400e',
              textAlign: 'center'
            }}>
              After registration, admin must approve your account before you can login.
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#667eea',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          Powered by Om Sai Murugan Finance © 2025
        </div>
      </div>
    </div>
  );
}

export default Login;
