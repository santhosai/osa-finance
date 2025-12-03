import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AdminApprovalPanel({ onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);
  const [error, setError] = useState('');

  const fetchPendingUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users/pending?admin_password=${encodeURIComponent(adminPassword)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch pending users');
      }

      const data = await response.json();
      setPendingUsers(data.users);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pending users:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!adminPassword) {
      setError('Please enter admin password');
      return;
    }
    setShowPasswordPrompt(false);
    fetchPendingUsers();
  };

  const handleApprove = async (userId) => {
    setActionLoading(userId);
    setError('');

    try {
      const response = await fetch(`${API_URL}/users/${userId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: adminPassword })
      });

      if (!response.ok) {
        throw new Error('Failed to approve user');
      }

      // Remove from list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      setActionLoading(null);
    } catch (err) {
      console.error('Error approving user:', err);
      setError(err.message);
      setActionLoading(null);
    }
  };

  const handleReject = async (userId) => {
    const confirmed = window.confirm('Are you sure you want to reject this user?');
    if (!confirmed) return;

    setActionLoading(userId);
    setError('');

    try {
      const response = await fetch(`${API_URL}/users/${userId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: adminPassword })
      });

      if (!response.ok) {
        throw new Error('Failed to reject user');
      }

      // Remove from list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      setActionLoading(null);
    } catch (err) {
      console.error('Error rejecting user:', err);
      setError(err.message);
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (showPasswordPrompt) {
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
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1e293b' }}>Admin Authentication</h3>

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

          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

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
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#1e293b' }}>Pending User Approvals</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            ×
          </button>
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading pending users...
          </div>
        ) : pendingUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              No pending approval requests
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b', marginBottom: '4px' }}>
                      {user.name}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '4px' }}>
                      📱 +91{user.phone}
                    </div>
                    {user.email && (
                      <div style={{ color: '#64748b', fontSize: '14px' }}>
                        📧 {user.email}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
                    {formatDate(user.created_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={actionLoading === user.id}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: actionLoading === user.id ? '#94a3b8' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {actionLoading === user.id ? 'Processing...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(user.id)}
                    disabled={actionLoading === user.id}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: actionLoading === user.id ? '#94a3b8' : '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {actionLoading === user.id ? 'Processing...' : '✕ Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminApprovalPanel;
