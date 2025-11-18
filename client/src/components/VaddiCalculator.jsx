import { useState } from 'react';

function VaddiCalculator({ onClose }) {
  const [loanAmount, setLoanAmount] = useState('');
  const [weeks, setWeeks] = useState('10');
  const [vaddiPercent, setVaddiPercent] = useState('20');

  const calculateResults = () => {
    if (!loanAmount || parseInt(loanAmount) <= 0) return null;

    const loan = parseInt(loanAmount);
    const weekCount = parseInt(weeks);
    const vaddi = parseInt(vaddiPercent);

    const weeklyAmount = Math.ceil(loan / weekCount);
    const totalCollection = weeklyAmount * weekCount;
    const totalVaddi = totalCollection - loan;
    const vaddiPercentActual = ((totalVaddi / loan) * 100).toFixed(2);

    return {
      loan,
      weekCount,
      weeklyAmount,
      totalCollection,
      totalVaddi,
      vaddiPercentActual
    };
  };

  const results = calculateResults();

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 className="modal-title">💰 Vaddi Calculator</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          <div className="form-group">
            <label className="form-label">Loan Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="Enter loan amount"
              min="1"
              step="1"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Number of Weeks</label>
            <input
              type="number"
              className="form-input"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              placeholder="Enter number of weeks"
              min="1"
              step="1"
            />
          </div>

          {results && (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '24px',
                color: 'white'
              }}>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>
                  Weekly Payment
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>
                  {formatCurrency(results.weeklyAmount)}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                  per week × {results.weekCount} weeks
                </div>
              </div>

              <div style={{
                background: '#f9fafb',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '16px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                  Calculation Summary
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Loan Amount:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                    {formatCurrency(results.loan)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Total Collection:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                    {formatCurrency(results.totalCollection)}
                  </span>
                </div>

                <div style={{
                  borderTop: '2px solid #10b981',
                  paddingTop: '8px',
                  marginTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ color: '#059669', fontSize: '15px', fontWeight: 600 }}>Total Vaddi:</span>
                  <span style={{ fontWeight: 700, color: '#059669', fontSize: '15px' }}>
                    {formatCurrency(results.totalVaddi)}
                  </span>
                </div>

                <div style={{
                  background: '#d1fae5',
                  borderRadius: '8px',
                  padding: '8px',
                  marginTop: '12px',
                  textAlign: 'center'
                }}>
                  <span style={{ color: '#065f46', fontSize: '13px', fontWeight: 600 }}>
                    📊 Vaddi Rate: {results.vaddiPercentActual}%
                  </span>
                </div>
              </div>

              <div style={{
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '16px'
              }}>
                <div style={{ fontSize: '12px', color: '#92400e' }}>
                  <strong>💡 Tip:</strong> Round up weekly amounts for easier collection.
                  Example: ₹{results.weeklyAmount} could be collected as ₹{Math.ceil(results.weeklyAmount / 10) * 10}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VaddiCalculator;
