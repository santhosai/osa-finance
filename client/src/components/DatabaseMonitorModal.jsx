import { useState, useEffect } from 'react';

function DatabaseMonitorModal({ stats, onClose, onRefresh }) {
  const [notes, setNotes] = useState('');
  const [lastSaved, setLastSaved] = useState(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('databaseMonitorNotes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
    const savedTime = localStorage.getItem('databaseMonitorNotesTime');
    if (savedTime) {
      setLastSaved(savedTime);
    }
  }, []);

  // Save notes to localStorage
  const handleSaveNotes = () => {
    localStorage.setItem('databaseMonitorNotes', notes);
    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    localStorage.setItem('databaseMonitorNotesTime', now);
    setLastSaved(now);
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getUsageColor = (percent) => {
    if (percent > 80) return '#ef4444'; // Red
    if (percent > 60) return '#f59e0b'; // Yellow
    return '#10b981'; // Green
  };

  const getUsageStatus = (percent) => {
    if (percent > 80) return { text: 'Critical', color: '#dc2626' };
    if (percent > 60) return { text: 'Warning', color: '#d97706' };
    return { text: 'Healthy', color: '#059669' };
  };

  const database = stats?.database || {};
  const usageStatus = getUsageStatus(database.usagePercent || 0);

  return (
    <div
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
        zIndex: 2000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              💾 Database Monitor
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              Database usage and maintenance notes
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {/* Overall Status */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: `2px solid ${usageStatus.color}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Database Status
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: usageStatus.color }}>
                  {usageStatus.text}
                </div>
              </div>
              <button
                onClick={onRefresh}
                style={{
                  background: '#0369a1',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>

            {/* Usage Bar */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  {database.estimatedSizeMB}MB used
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                  {database.limitMB}MB total
                </span>
              </div>
              <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(database.usagePercent || 0, 100)}%`,
                    height: '100%',
                    background: getUsageColor(database.usagePercent || 0),
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                {database.usagePercent?.toFixed(2)}% used
              </div>
            </div>
          </div>

          {/* Collections Breakdown */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              📊 Collections Breakdown
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              {database.collections && Object.entries(database.collections).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                    {value.toLocaleString()} docs
                  </span>
                </div>
              ))}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)',
                  color: 'white',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Total Documents
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>
                  {database.totalDocuments?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Notepad Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                📝 Maintenance Notes
              </h4>
              {lastSaved && (
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  Last saved: {lastSaved}
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Type your database maintenance notes here...&#10;&#10;Example:&#10;- Backup taken on 15 Jan 2025&#10;- Database cleanup performed&#10;- Observed high usage, monitor closely"
              style={{
                width: '100%',
                height: '150px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={handleSaveNotes}
              style={{
                marginTop: '8px',
                background: '#059669',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              💾 Save Notes
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div
          style={{
            background: '#f8fafc',
            padding: '12px 20px',
            borderRadius: '0 0 12px 12px',
            borderTop: '1px solid #e2e8f0'
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.5' }}>
            💡 <strong>Tip:</strong> Firestore free tier allows 500MB. Auto-refreshes every 30 seconds.
            Download monthly backups to keep your data safe.
          </div>
        </div>
      </div>
    </div>
  );
}

export default DatabaseMonitorModal;
