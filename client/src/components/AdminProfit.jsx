import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { API_URL } from '../config';

const fetcher = (url) => fetch(url).then(res => res.json());

// Admin password - should match the admin password
const ADMIN_PASSWORD = 'SAnt@#21';

function AdminProfit({ navigateTo }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch all data
  const { data: customers = [] } = useSWR(`${API_URL}/customers`, fetcher);
  const { data: weeklyDiagnostic } = useSWR(`${API_URL}/weekly-diagnostic`, fetcher);
  const { data: dailySummary = {} } = useSWR(`${API_URL}/daily-summary`, fetcher);
  const { data: vaddiSummary = {} } = useSWR(`${API_URL}/vaddi-summary?month=${selectedMonth}`, fetcher);
  const { data: allPayments = [] } = useSWR(`${API_URL}/all-payments`, fetcher);
  const { data: monthlyFinanceCustomers = [] } = useSWR(`${API_URL}/monthly-finance/customers`, fetcher);

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
      // Store admin session
      sessionStorage.setItem('adminProfitAuth', 'true');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  // Check for existing session
  useEffect(() => {
    if (sessionStorage.getItem('adminProfitAuth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Calculate monthly profits from payments
  const calculateMonthlyProfits = () => {
    const monthlyData = {};

    // Process all payments to get monthly breakdown
    if (allPayments && allPayments.length > 0) {
      allPayments.forEach(payment => {
        if (!payment.payment_date) return;
        const month = payment.payment_date.substring(0, 7); // YYYY-MM

        if (!monthlyData[month]) {
          monthlyData[month] = {
            weeklyCollected: 0,
            weeklyProfit: 0,
            dailyCollected: 0,
            dailyProfit: 0,
            monthlyCollected: 0,
            monthlyProfit: 0,
            vaddiProfit: 0,
            totalProfit: 0
          };
        }

        // Add vaddi profit
        if (payment.my_profit) {
          monthlyData[month].vaddiProfit += Number(payment.my_profit) || 0;
        }
      });
    }

    // Process loans to calculate Weekly/Monthly/Daily profit
    if (customers && customers.length > 0) {
      customers.forEach(customer => {
        if (!customer.loans) return;
        customer.loans.forEach(loan => {
          if (loan.status !== 'active') return;

          const collected = loan.loan_amount - loan.balance;
          const startMonth = loan.start_date ? loan.start_date.substring(0, 7) : selectedMonth;

          // For simplicity, attribute all collected amount to current month
          // In a more complex system, we'd track per-payment
          if (!monthlyData[startMonth]) {
            monthlyData[startMonth] = {
              weeklyCollected: 0,
              weeklyProfit: 0,
              dailyCollected: 0,
              dailyProfit: 0,
              monthlyCollected: 0,
              monthlyProfit: 0,
              vaddiProfit: 0,
              totalProfit: 0
            };
          }

          if (loan.loan_type === 'Weekly') {
            monthlyData[startMonth].weeklyCollected += collected;
            monthlyData[startMonth].weeklyProfit += Math.round(collected * 0.10);
          } else if (loan.loan_type === 'Monthly') {
            monthlyData[startMonth].monthlyCollected += collected;
            monthlyData[startMonth].monthlyProfit += Math.round(collected * 0.20);
          } else if (loan.loan_type === 'Daily') {
            monthlyData[startMonth].dailyCollected += collected;
            monthlyData[startMonth].dailyProfit += Math.round(collected * 0.10);
          }
        });
      });
    }

    // Calculate total profit for each month
    Object.keys(monthlyData).forEach(month => {
      monthlyData[month].totalProfit =
        monthlyData[month].weeklyProfit +
        monthlyData[month].dailyProfit +
        monthlyData[month].monthlyProfit +
        monthlyData[month].vaddiProfit;
    });

    return monthlyData;
  };

  const monthlyProfits = calculateMonthlyProfits();

  // Calculate overall totals
  const calculateTotals = () => {
    // Weekly Finance (data is nested under summary)
    const weeklyTotal = weeklyDiagnostic?.summary?.totalLoanAmount || 0;
    // Calculate balance from all loans
    let weeklyBalance = 0;
    if (weeklyDiagnostic?.allLoans) {
      weeklyDiagnostic.allLoans.forEach(loan => {
        weeklyBalance += loan.balance || 0;
      });
    }
    const weeklyCollected = weeklyTotal - weeklyBalance;
    const weeklyCashGiven = Math.round(weeklyTotal * 0.90);
    const weeklyExpectedProfit = Math.round(weeklyTotal * 0.10);
    const weeklyEarnedProfit = Math.round(weeklyCollected * 0.10);

    // Daily Finance
    const dailyTotal = dailySummary.total_given || 0;
    const dailyOutstanding = dailySummary.total_outstanding || 0;
    const dailyCollected = dailyTotal - dailyOutstanding;
    const dailyCashGiven = Math.round(dailyTotal * 0.90);
    const dailyExpectedProfit = Math.round(dailyTotal * 0.10);
    const dailyEarnedProfit = Math.round(dailyCollected * 0.10);

    // Vaddi
    const vaddiProfit = vaddiSummary.myProfit || 0;

    // Monthly Finance (from separate monthly_finance_customers collection)
    let monthlyTotal = 0;
    let monthlyBalance = 0;
    if (monthlyFinanceCustomers && monthlyFinanceCustomers.length > 0) {
      monthlyFinanceCustomers.forEach(customer => {
        if (customer.status === 'active') {
          monthlyTotal += customer.loan_amount || 0;
          monthlyBalance += customer.balance || 0;
        }
      });
    }
    const monthlyCollected = monthlyTotal - monthlyBalance;
    const monthlyCashGiven = Math.round(monthlyTotal * 0.80);
    const monthlyExpectedProfit = Math.round(monthlyTotal * 0.20);
    const monthlyEarnedProfit = Math.round(monthlyCollected * 0.20);

    return {
      weekly: {
        loanAmount: weeklyTotal,
        cashGiven: weeklyCashGiven,
        collected: weeklyCollected,
        balance: weeklyBalance,
        expectedProfit: weeklyExpectedProfit,
        earnedProfit: weeklyEarnedProfit,
        margin: '10%'
      },
      daily: {
        loanAmount: dailyTotal,
        cashGiven: dailyCashGiven,
        collected: dailyCollected,
        balance: dailyOutstanding,
        expectedProfit: dailyExpectedProfit,
        earnedProfit: dailyEarnedProfit,
        margin: '10%'
      },
      monthly: {
        loanAmount: monthlyTotal,
        cashGiven: monthlyCashGiven,
        collected: monthlyCollected,
        balance: monthlyBalance,
        expectedProfit: monthlyExpectedProfit,
        earnedProfit: monthlyEarnedProfit,
        margin: '20%'
      },
      vaddi: {
        profit: vaddiProfit
      },
      grandTotal: {
        expectedProfit: weeklyExpectedProfit + dailyExpectedProfit + monthlyExpectedProfit + vaddiProfit,
        earnedProfit: weeklyEarnedProfit + dailyEarnedProfit + monthlyEarnedProfit + vaddiProfit
      }
    };
  };

  const totals = calculateTotals();

  // Password screen
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>
              Admin Profit Analysis
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
              Enter admin password to view profits
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '16px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              autoFocus
            />
            {passwordError && (
              <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
                {passwordError}
              </div>
            )}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
              }}
            >
              Unlock
            </button>
          </form>

          <button
            onClick={() => navigateTo('dashboard')}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '12px',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Main profit view
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
      padding: '0'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigateTo('dashboard')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
            💰 My Profit Analysis
          </h2>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem('adminProfitAuth');
            setIsAuthenticated(false);
            setPassword('');
          }}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔒 Lock
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Grand Total Card */}
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 8px 24px rgba(251, 191, 36, 0.3)',
          color: 'white'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', opacity: 0.9 }}>
            Total Profit Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>
                {formatCurrency(totals.grandTotal.expectedProfit)}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Expected Profit</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.25)', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>
                {formatCurrency(totals.grandTotal.earnedProfit)}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Earned So Far</div>
            </div>
          </div>
        </div>

        {/* Weekly Finance Profit */}
        <div style={{
          background: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          color: 'white'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
            📅 Weekly Finance (Give 90%, Collect 100%)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.weekly.loanAmount)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Total Loan</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.weekly.cashGiven)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Cash Given</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.weekly.collected)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Collected</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(52,211,153,0.2)', borderRadius: '6px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatCurrency(totals.weekly.expectedProfit)}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Expected Profit</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(52,211,153,0.4)', borderRadius: '6px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fef08a' }}>{formatCurrency(totals.weekly.earnedProfit)}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Earned</div>
            </div>
          </div>
        </div>

        {/* Daily Finance Profit */}
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          color: 'white'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
            📆 Daily Finance (Give 90%, Collect 100%)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.daily.loanAmount)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Total Loan</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.daily.cashGiven)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Cash Given</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.daily.collected)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Collected</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatCurrency(totals.daily.expectedProfit)}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Expected Profit</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.25)', borderRadius: '6px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fef08a' }}>{formatCurrency(totals.daily.earnedProfit)}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Earned</div>
            </div>
          </div>
        </div>

        {/* Monthly Finance Profit */}
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          color: 'white'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
            💰 Monthly Finance (Give 80%, Collect 100%)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.monthly.loanAmount)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Total Loan</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.monthly.cashGiven)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Cash Given</div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.monthly.collected)}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>Collected</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatCurrency(totals.monthly.expectedProfit)}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Expected Profit (20%)</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.25)', borderRadius: '6px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fef08a' }}>{formatCurrency(totals.monthly.earnedProfit)}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Earned</div>
            </div>
          </div>
        </div>

        {/* Vaddi Profit */}
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              📝 Vaddi Profit (This Month)
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.2)',
                color: 'white'
              }}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return <option key={value} value={value} style={{ color: '#1e293b' }}>{label}</option>;
              })}
            </select>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '16px',
            marginTop: '12px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#86efac' }}>
              {formatCurrency(totals.vaddi.profit)}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '4px' }}>
              My Profit from Vaddi
            </div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
            📊 Monthly Profit Breakdown
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700 }}>Month</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>Weekly</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>Daily</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>Monthly</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>Vaddi</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(monthlyProfits).sort().reverse().map(month => {
                  const data = monthlyProfits[month];
                  const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  return (
                    <tr key={month} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{monthLabel}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(data.weeklyProfit)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(data.dailyProfit)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(data.monthlyProfit)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(data.vaddiProfit)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(data.totalProfit)}</td>
                    </tr>
                  );
                })}
                {Object.keys(monthlyProfits).length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                      No profit data available yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Note */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
          color: 'white',
          fontSize: '11px',
          textAlign: 'center',
          opacity: 0.8
        }}>
          💡 Weekly & Daily: 10% profit margin | Monthly: 20% profit margin | Vaddi: Your manual "My Profit" entries
        </div>
      </div>
    </div>
  );
}

export default AdminProfit;
