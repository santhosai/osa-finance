import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

const fetcher = (url) => fetch(url).then(res => res.json());

const UserManagement = ({ navigateTo }) => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [actionLoading, setActionLoading] = useState(null);

  const { data: users = [], isLoading, mutate } = useSWR(
    `${API_URL}/users`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');
  const rejectedUsers = users.filter(u => u.status === 'rejected');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApprove = async (userId) => {
    const adminPassword = localStorage.getItem('userRole') === 'admin' ? 'Omsaimurugan' : prompt('Enter admin password:');
    if (!adminPassword) return;

    setActionLoading(userId);
    try {
      const response = await fetch(`${API_URL}/users/${userId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: adminPassword })
      });

      if (response.ok) {
        alert('User approved successfully!');
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to approve user');
      }
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId) => {
    const confirmed = window.confirm('Are you sure you want to reject this user?');
    if (!confirmed) return;

    const adminPassword = localStorage.getItem('userRole') === 'admin' ? 'Omsaimurugan' : prompt('Enter admin password:');
    if (!adminPassword) return;

    setActionLoading(userId);
    try {
      const response = await fetch(`${API_URL}/users/${userId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: adminPassword })
      });

      if (response.ok) {
        alert('User rejected.');
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to reject user');
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Failed to reject user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId, userName) => {
    const confirmed = window.confirm(`Delete user "${userName}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    const adminPassword = localStorage.getItem('userRole') === 'admin' ? 'Omsaimurugan' : prompt('Enter admin password:');
    if (!adminPassword) return;

    setActionLoading(userId);
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: adminPassword })
      });

      if (response.ok) {
        alert('User deleted.');
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading users...</div>
        </div>
      </div>
    );
  }

  const renderUserCard = (user, showActions = false) => (
    <div
      key={user.id}
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
            {user.name}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {user.email}
          </div>
          {user.phone && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              📞 {user.phone}
            </div>
          )}
        </div>
        <div style={{
          background: user.status === 'pending' ? '#fef3c7' : user.status === 'approved' ? '#d1fae5' : '#fee2e2',
          color: user.status === 'pending' ? '#92400e' : user.status === 'approved' ? '#065f46' : '#b91c1c',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase'
        }}>
          {user.status}
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px' }}>
        Registered: {formatDate(user.created_at)}
        {user.last_login && (
          <span style={{ marginLeft: '12px' }}>
            Last login: {formatDate(user.last_login)}
          </span>
        )}
      </div>

      {showActions && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {user.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(user.id)}
                disabled={actionLoading === user.id}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: actionLoading === user.id ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: actionLoading === user.id ? 'not-allowed' : 'pointer'
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
                  background: actionLoading === user.id ? '#9ca3af' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: actionLoading === user.id ? 'not-allowed' : 'pointer'
                }}
              >
                ✕ Reject
              </button>
            </>
          )}
          {user.status === 'rejected' && (
            <button
              onClick={() => handleApprove(user.id)}
              disabled={actionLoading === user.id}
              style={{
                flex: 1,
                padding: '10px',
                background: actionLoading === user.id ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: actionLoading === user.id ? 'not-allowed' : 'pointer'
              }}
            >
              {actionLoading === user.id ? 'Processing...' : '✓ Approve Now'}
            </button>
          )}
          <button
            onClick={() => handleDelete(user.id, user.name)}
            disabled={actionLoading === user.id}
            style={{
              padding: '10px 16px',
              background: '#f3f4f6',
              color: '#6b7280',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: actionLoading === user.id ? 'not-allowed' : 'pointer'
            }}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button
          onClick={() => navigateTo('dashboard')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
            👥 User Management
          </h2>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginTop: '2px' }}>
            {users.length} total user{users.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e' }}>{pendingUsers.length}</div>
          <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Pending</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46' }}>{approvedUsers.length}</div>
          <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 600 }}>Approved</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b91c1c' }}>{rejectedUsers.length}</div>
          <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>Rejected</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          display: 'flex',
          background: '#e2e8f0',
          borderRadius: '10px',
          padding: '4px'
        }}>
          {['pending', 'approved', 'rejected'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#1e293b' : '#6b7280',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span style={{
                marginLeft: '6px',
                background: activeTab === tab ? '#667eea' : '#9ca3af',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '11px'
              }}>
                {tab === 'pending' ? pendingUsers.length : tab === 'approved' ? approvedUsers.length : rejectedUsers.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* User List */}
      <div style={{ padding: '16px' }}>
        {activeTab === 'pending' && (
          pendingUsers.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No pending requests</div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>
                New user registrations will appear here
              </div>
            </div>
          ) : (
            pendingUsers.map(user => renderUserCard(user, true))
          )
        )}

        {activeTab === 'approved' && (
          approvedUsers.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No approved users</div>
            </div>
          ) : (
            approvedUsers.map(user => renderUserCard(user, true))
          )
        )}

        {activeTab === 'rejected' && (
          rejectedUsers.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No rejected users</div>
            </div>
          ) : (
            rejectedUsers.map(user => renderUserCard(user, true))
          )
        )}
      </div>
    </div>
  );
};

export default UserManagement;
