import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AllPaymentsDueModal({ onClose, navigateTo }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [duePayments, setDuePayments] = useState({ weekly: [], monthly: [], daily: [], interest: [] });
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ weekly: true, monthly: true, daily: true, interest: true });

  useEffect(() => {
    fetchDuePayments();
  }, [selectedDate]);

  const fetchDuePayments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/customers`);
      const customers = await response.json();

      const weekly = [];
      const monthly = [];
      const daily = [];
      const interest = [];

      const selectedDay = new Date(selectedDate);
      const dayOfWeek = selectedDay.getDay(); // 0 = Sunday
      const dayOfMonth = selectedDay.getDate();

      for (const customer of customers) {
        if (!customer.loans || customer.loans.length === 0) continue;

        for (const loan of customer.loans) {
          // Skip closed/archived loans
          if (loan.balance <= 0 || loan.status === 'closed') continue;

          try {
            // Fetch full loan details to check payments
            const loanResponse = await fetch(`${API_URL}/loans/${loan.loan_id}`);
            const loanData = await loanResponse.json();

            // Check if payment already made on selected date
            const alreadyPaid = loanData.payments?.some(p =>
              p.payment_date?.split('T')[0] === selectedDate
            );

            const loanInfo = {
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              loanId: loan.loan_id,
              loanName: loan.loan_name || 'General Loan',
              loanAmount: loan.loan_amount,
              balance: loan.balance,
              weeklyAmount: loan.weekly_amount,
              monthlyAmount: loan.monthly_amount,
              dailyAmount: loan.daily_amount,
              alreadyPaid,
              paidAmount: alreadyPaid ? loanData.payments.find(p => p.payment_date?.split('T')[0] === selectedDate)?.amount : 0
            };

            // Weekly loans - due on Sundays
            if (loan.loan_type === 'Weekly' && dayOfWeek === 0 && loan.balance > 0) {
              weekly.push(loanInfo);
            }

            // Monthly loans - check payment_day
            if (loan.loan_type === 'Monthly' && loan.balance > 0) {
              const paymentDay = loan.payment_day || 1;
              if (dayOfMonth === paymentDay) {
                monthly.push(loanInfo);
              }
            }

            // Daily loans - due every day
            if (loan.loan_type === 'Daily' && loan.balance > 0) {
              daily.push(loanInfo);
            }

            // Interest/Vaddi loans - monthly interest payments (typically on specific day)
            if (loan.loan_type === 'Vaddi') {
              // Check if interest is due (first day of month or custom day)
              const interestDay = loan.interest_day || 1;
              if (dayOfMonth === interestDay) {
                interest.push({
                  ...loanInfo,
                  interestRate: loan.interest_rate || 0,
                  monthlyInterest: (loan.loan_amount * (loan.interest_rate || 0)) / 100
                });
              }
            }
          } catch (error) {
            console.error('Error fetching loan details:', error);
          }
        }
      }

      setDuePayments({ weekly, monthly, daily, interest });
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getTotalDue = () => {
    let total = 0;
    duePayments.weekly.filter(l => !l.alreadyPaid).forEach(l => total += l.weeklyAmount || 0);
    duePayments.monthly.filter(l => !l.alreadyPaid).forEach(l => total += l.monthlyAmount || 0);
    duePayments.daily.filter(l => !l.alreadyPaid).forEach(l => total += l.dailyAmount || 0);
    duePayments.interest.filter(l => !l.alreadyPaid).forEach(l => total += l.monthlyInterest || 0);
    return total;
  };

  const getTotalCollected = () => {
    let total = 0;
    [...duePayments.weekly, ...duePayments.monthly, ...duePayments.daily, ...duePayments.interest]
      .filter(l => l.alreadyPaid)
      .forEach(l => total += l.paidAmount || 0);
    return total;
  };

  const renderLoanCard = (loan, type) => (
    <div
      key={loan.loanId}
      onClick={() => {
        onClose();
        navigateTo(`loan/${loan.loanId}`);
      }}
      style={{
        background: loan.alreadyPaid ? '#dcfce7' : 'white',
        border: loan.alreadyPaid ? '1px solid #86efac' : '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
            {loan.customerName}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            {loan.loanName} • {loan.customerPhone}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {loan.alreadyPaid ? (
            <div style={{
              background: '#16a34a',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600
            }}>
              PAID {formatCurrency(loan.paidAmount)}
            </div>
          ) : (
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#dc2626' }}>
              {type === 'weekly' && formatCurrency(loan.weeklyAmount)}
              {type === 'monthly' && formatCurrency(loan.monthlyAmount)}
              {type === 'daily' && formatCurrency(loan.dailyAmount)}
              {type === 'interest' && formatCurrency(loan.monthlyInterest)}
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Balance: {formatCurrency(loan.balance)}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSection = (title, icon, loans, type, color) => {
    const unpaidCount = loans.filter(l => !l.alreadyPaid).length;
    const paidCount = loans.filter(l => l.alreadyPaid).length;

    if (loans.length === 0) return null;

    return (
      <div style={{ marginBottom: '16px' }}>
        <div
          onClick={() => toggleSection(type)}
          style={{
            background: color,
            padding: '12px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
            <span style={{ fontSize: '18px' }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{title}</span>
            <span style={{
              background: 'rgba(255,255,255,0.3)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {unpaidCount} due {paidCount > 0 && `• ${paidCount} paid`}
            </span>
          </div>
          <span style={{ color: 'white', fontSize: '18px' }}>
            {expandedSections[type] ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections[type] && (
          <div style={{ marginTop: '8px' }}>
            {loans.map(loan => renderLoanCard(loan, type))}
          </div>
        )}
      </div>
    );
  };

  const totalCount = duePayments.weekly.length + duePayments.monthly.length +
                     duePayments.daily.length + duePayments.interest.length;
  const unpaidCount = [...duePayments.weekly, ...duePayments.monthly, ...duePayments.daily, ...duePayments.interest]
    .filter(l => !l.alreadyPaid).length;

  return (
    <div
      onClick={onClose}
      style={{
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
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#f8fafc',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
          padding: '16px 20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                📋 All Payments Due
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.9 }}>
                Weekly • Monthly • Daily • Interest
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div style={{ padding: '16px 20px', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            📅 Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            }}
          />
        </div>

        {/* Summary Stats */}
        {!loading && totalCount > 0 && (
          <div style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>
                {formatCurrency(getTotalDue())}
              </div>
              <div style={{ fontSize: '11px', color: '#92400e' }}>Due ({unpaidCount})</div>
            </div>
            <div style={{ width: '1px', background: '#d97706', opacity: 0.3 }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(getTotalCollected())}
              </div>
              <div style={{ fontSize: '11px', color: '#92400e' }}>Collected</div>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: '14px' }}>Loading payments...</div>
            </div>
          ) : totalCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No payments due</div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>
                {new Date(selectedDate).getDay() !== 0
                  ? 'Note: Weekly payments are only on Sundays'
                  : 'No customers have payments scheduled for this date'}
              </div>
            </div>
          ) : (
            <>
              {renderSection('Weekly Loans', '📅', duePayments.weekly, 'weekly', '#3b82f6')}
              {renderSection('Monthly Loans', '💰', duePayments.monthly, 'monthly', '#8b5cf6')}
              {renderSection('Daily Loans', '📆', duePayments.daily, 'daily', '#f59e0b')}
              {renderSection('Interest Loans', '💵', duePayments.interest, 'interest', '#10b981')}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          background: 'white',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '11px',
          color: '#6b7280'
        }}>
          Tap on any customer to view loan details and record payment
        </div>
      </div>
    </div>
  );
}

export default AllPaymentsDueModal;
