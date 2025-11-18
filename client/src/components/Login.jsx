import { useState } from 'react';
import './Login.css';

// PASSWORD VERSION - Change this when you change password to logout all devices
const PASSWORD_VERSION = '2025-01-18-v2'; // Updated with new password "vimala"

function Login({ onLogin }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    // Check credentials - PASSWORD CHANGED TO "vimala"
    if (userId === 'omsairam' && password === 'vimala') {
      // Store password version to invalidate old sessions
      localStorage.setItem('passwordVersion', PASSWORD_VERSION);
      onLogin(true);
    } else {
      setError('Invalid User ID or Password');
      setTimeout(() => setError(''), 3000);
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

        <div className="welcome-text">Welcome to Finance Management System</div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="login-label">User ID</label>
            <input
              type="text"
              className="login-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter User ID"
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
            LOGIN
          </button>
        </form>

        <div className="login-footer">
          Powered by Om Sai Murugan Finance © 2025
        </div>
      </div>
    </div>
  );
}

export default Login;
