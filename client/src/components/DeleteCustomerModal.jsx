import { useState } from 'react';
import { API_URL } from '../config';

function DeleteCustomerModal({ customer, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.preventDefault();

    // Check password
    if (password !== 'chilom') {
      setError('Incorrect password');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/customers/${customer.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete customer');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      setError('Failed to delete customer');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: '#dc2626' }}>Delete Customer</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '8px' }}>
            ⚠️ Warning: This action cannot be undone!
          </div>
          <div style={{ color: '#7f1d1d', fontSize: '14px' }}>
            Deleting this customer will also permanently delete:
          </div>
          <ul style={{ color: '#7f1d1d', fontSize: '14px', marginTop: '8px', paddingLeft: '20px' }}>
            <li>All associated loans</li>
            <li>All payment records</li>
            <li>All customer data</li>
          </ul>
        </div>

        <div style={{
          background: '#f3f4f6',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
            Customer Name:
          </div>
          <div style={{ fontSize: '18px', color: '#4b5563' }}>{customer.name}</div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            📱 {customer.phone}
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleDelete}>
          <div className="form-group">
            <label className="form-label">
              Enter Password to Confirm
            </label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter delete password"
              required
              autoFocus
            />
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Enter the special password to confirm deletion
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: '12px',
                background: isDeleting ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeleteCustomerModal;
