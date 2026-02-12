import { useState, useEffect } from 'react';

function VercelMonitorModal({ onClose }) {
  const [notes, setNotes] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vercelData, setVercelData] = useState(null);
  const [error, setError] = useState(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('vercelMonitorNotes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
    const savedTime = localStorage.getItem('vercelMonitorNotesTime');
    if (savedTime) {
      setLastSaved(savedTime);
    }
  }, []);

  // Fetch Vercel usage data
  useEffect(() => {
    fetchVercelUsage();
  }, []);

  const fetchVercelUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      // Note: This requires Vercel API token to be set up in backend
      // For now, we'll show manual tracking with localStorage
      const savedData = localStorage.getItem('vercelUsageData');
      if (savedData) {
        setVercelData(JSON.parse(savedData));
      } else {
        // Default data structure
        setVercelData({
          bandwidthUsed: 0, // GB
          bandwidthLimit: 100, // GB
          deploymentsCount: 0,
          deploymentsLimit: 100,
          lastUpdated: new Date().toISOString(),
          isManual: true
        });
      }
    } catch (err) {
      console.error('Error fetching Vercel usage:', err);
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  // Save notes to localStorage
  const handleSaveNotes = () => {
    localStorage.setItem('vercelMonitorNotes', notes);
    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    localStorage.setItem('vercelMonitorNotesTime', now);
    setLastSaved(now);
  };

  // Update bandwidth manually
  const handleUpdateBandwidth = () => {
    const input = prompt('Enter current bandwidth usage in GB (check Vercel dashboard):');
    if (input !== null && input !== '') {
      const bandwidth = parseFloat(input);
      if (!isNaN(bandwidth)) {
        const updatedData = {
          ...vercelData,
          bandwidthUsed: bandwidth,
          lastUpdated: new Date().toISOString(),
          isManual: true
        };
        setVercelData(updatedData);
        localStorage.setItem('vercelUsageData', JSON.stringify(updatedData));
        alert('✅ Bandwidth usage updated!');
      } else {
        alert('❌ Please enter a valid number');
      }
    }
  };

  const getUsageColor = (percent) => {
    if (percent > 80) return '#ef4444'; // Red
    if (percent > 60) return '#f59e0b'; // Yellow
    return '#10b981'; // Green
  };

  const getUsageStatus = (percent) => {
    if (percent > 80) return { text: 'Critical ⚠️', color: '#dc2626', bg: '#fee2e2' };
    if (percent > 60) return { text: 'Warning ⚡', color: '#d97706', bg: '#fef3c7' };
    return { text: 'Healthy ✅', color: '#059669', bg: '#d1fae5' };
  };

  const bandwidthPercent = vercelData ? (vercelData.bandwidthUsed / vercelData.bandwidthLimit) * 100 : 0;
  const usageStatus = getUsageStatus(bandwidthPercent);
  const remainingBandwidth = vercelData ? vercelData.bandwidthLimit - vercelData.bandwidthUsed : 100;

  // Estimate days until limit (assuming current rate)
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysElapsed = Math.max(1, Math.ceil((today - monthStart) / (1000 * 60 * 60 * 24)));
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - daysElapsed;
  const dailyAverage = vercelData ? vercelData.bandwidthUsed / daysElapsed : 0;
  const projectedTotal = dailyAverage * daysInMonth;
  const willExceed = projectedTotal > 100;

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
            background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
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
              ▲ Vercel Monitor
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              Bandwidth usage and deployment tracking
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Loading usage data...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
              {error}
            </div>
          ) : (
            <>
              {/* Status Card */}
              <div
                style={{
                  background: usageStatus.bg,
                  border: `2px solid ${usageStatus.color}`,
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Overall Status
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: usageStatus.color }}>
                      {usageStatus.text}
                    </div>
                  </div>
                  <div style={{ fontSize: '40px' }}>
                    {bandwidthPercent > 80 ? '🚨' : bandwidthPercent > 60 ? '⚠️' : '✅'}
                  </div>
                </div>
              </div>

              {/* Bandwidth Usage */}
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
                    📊 Bandwidth Usage
                  </h4>
                  <button
                    type="button"
                    onClick={handleUpdateBandwidth}
                    style={{
                      background: '#0891b2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Update
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: '#6b7280' }}>Used this month</span>
                    <span style={{ fontWeight: 700, color: getUsageColor(bandwidthPercent) }}>
                      {vercelData.bandwidthUsed.toFixed(2)} GB / {vercelData.bandwidthLimit} GB
                    </span>
                  </div>
                  <div style={{ background: '#e5e7eb', borderRadius: '8px', height: '20px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, bandwidthPercent)}%`,
                        height: '100%',
                        background: getUsageColor(bandwidthPercent),
                        borderRadius: '8px',
                        transition: 'width 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {bandwidthPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Remaining</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>
                      {remainingBandwidth.toFixed(2)} GB
                    </div>
                  </div>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Days Left</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#3b82f6' }}>
                      {daysRemaining} days
                    </div>
                  </div>
                </div>
              </div>

              {/* Projections */}
              <div
                style={{
                  background: willExceed ? '#fef3c7' : '#d1fae5',
                  border: `1px solid ${willExceed ? '#f59e0b' : '#10b981'}`,
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '16px'
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#374151' }}>
                  📈 Usage Projection
                </h4>
                <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.6 }}>
                  <div><strong>Daily Average:</strong> {dailyAverage.toFixed(2)} GB/day</div>
                  <div><strong>Projected Total:</strong> {projectedTotal.toFixed(2)} GB this month</div>
                  {willExceed ? (
                    <div style={{ color: '#d97706', fontWeight: 700, marginTop: '8px' }}>
                      ⚠️ Warning: You may exceed 100 GB limit!
                    </div>
                  ) : (
                    <div style={{ color: '#059669', fontWeight: 700, marginTop: '8px' }}>
                      ✅ You're on track to stay within limit
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Tips */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #3b82f6',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '16px'
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#1e40af' }}>
                  💡 Tips to Reduce Bandwidth
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#374151', lineHeight: 1.8 }}>
                  <li>Increase auto-refresh interval (30s → 90s)</li>
                  <li>Use pagination for customer lists</li>
                  <li>Enable browser caching</li>
                  <li>Serve documents from Firebase directly</li>
                  <li>Disable auto-refresh when not needed</li>
                </ul>
              </div>

              {/* How to Check Vercel Dashboard */}
              <div
                style={{
                  background: '#f3f4f6',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '16px'
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#374151' }}>
                  📱 How to Check Vercel Dashboard
                </h4>
                <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#6b7280', lineHeight: 1.8 }}>
                  <li>Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#0891b2' }}>vercel.com/dashboard</a></li>
                  <li>Select your project (osa-finance or server)</li>
                  <li>Click "Analytics" or "Usage"</li>
                  <li>Check "Bandwidth" section</li>
                  <li>Update the value here using "Update" button above</li>
                </ol>
              </div>

              {/* Last Updated */}
              {vercelData.lastUpdated && (
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px', textAlign: 'center' }}>
                  Last updated: {new Date(vercelData.lastUpdated).toLocaleString('en-IN')}
                  {vercelData.isManual && ' (Manual)'}
                </div>
              )}

              {/* Notes Section */}
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: '10px',
                  padding: '16px'
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#374151' }}>
                  📝 Notes & Reminders
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about bandwidth usage, optimizations tried, or reminders..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {lastSaved && `Last saved: ${lastSaved}`}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    style={{
                      background: '#0891b2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    💾 Save Notes
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VercelMonitorModal;
