import { useState } from 'react';
import { API_URL } from '../config';

function BalanceCheck() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [error, setError] = useState('');

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleCheckBalance = async (e) => {
    e.preventDefault();

    if (phoneNumber.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');
    setCustomerData(null);

    try {
      // Fetch regular customer loans (Weekly, Daily, Interest/Vaddi)
      const customersResponse = await fetch(`${API_URL}/customers`);
      const customers = await customersResponse.json();

      // Fetch Monthly Finance customers
      const monthlyResponse = await fetch(`${API_URL}/monthly-finance/customers`);
      const monthlyCustomers = await monthlyResponse.json();

      // Find customer by phone number
      const regularCustomer = customers.find(c => c.phone === phoneNumber);
      const monthlyCustomer = monthlyCustomers.find(c => c.phone === phoneNumber);

      if (!regularCustomer && !monthlyCustomer) {
        setError('No customer found with this phone number');
        setLoading(false);
        return;
      }

      // Prepare data structure
      const data = {
        name: regularCustomer?.name || monthlyCustomer?.name || 'Customer',
        phone: phoneNumber,
        weeklyLoans: [],
        dailyLoans: [],
        interestLoans: [],
        monthlyFinance: null
      };

      // Process regular customer loans
      if (regularCustomer && regularCustomer.loans) {
        for (const loan of regularCustomer.loans) {
          // Skip closed loans
          if (loan.balance <= 0 || loan.status === 'closed') continue;

          const loanInfo = {
            loanName: loan.loan_name || 'General Loan',
            loanAmount: loan.loan_amount,
            balance: loan.balance,
            startDate: loan.start_date,
            weeklyAmount: loan.weekly_amount,
            monthlyAmount: loan.monthly_amount,
            dailyAmount: loan.daily_amount,
            interestRate: loan.interest_rate
          };

          if (loan.loan_type === 'Weekly') {
            data.weeklyLoans.push(loanInfo);
          } else if (loan.loan_type === 'Daily') {
            data.dailyLoans.push(loanInfo);
          } else if (loan.loan_type === 'Vaddi') {
            loanInfo.monthlyInterest = (loan.loan_amount * (loan.interest_rate || 0)) / 100;
            data.interestLoans.push(loanInfo);
          }
        }
      }

      // Process Monthly Finance customer
      if (monthlyCustomer && monthlyCustomer.balance > 0) {
        data.monthlyFinance = {
          loanAmount: monthlyCustomer.loan_amount,
          balance: monthlyCustomer.balance,
          monthlyAmount: monthlyCustomer.monthly_amount,
          totalMonths: monthlyCustomer.total_months,
          startDate: monthlyCustomer.start_date,
          loanGivenDate: monthlyCustomer.loan_given_date,
          paymentDay: new Date(monthlyCustomer.start_date).getDate()
        };
      }

      setCustomerData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError('Failed to fetch balance. Please try again.');
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhoneNumber('');
    setCustomerData(null);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        color: 'white',
        marginBottom: '30px',
        paddingTop: '20px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          textShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          🏦 Om Sai Murugan Finance
        </h1>
        <p style={{
          fontSize: '16px',
          margin: 0,
          opacity: 0.95
        }}>
          Check Your Loan Balance
        </p>
      </div>

      {/* Main Container */}
      <div style={{
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        {!customerData ? (
          /* Phone Number Input Form */
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                margin: '0 auto 16px auto',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
              }}>
                📱
              </div>
              <h2 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#1e293b',
                margin: '0 0 8px 0'
              }}>
                Enter Your Phone Number
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                We'll show you all your loan details
              </p>
            </div>

            <form onSubmit={handleCheckBalance}>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setPhoneNumber(value);
                    setError('');
                  }
                }}
                maxLength={10}
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '18px',
                  textAlign: 'center',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                  marginBottom: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />

              {error && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phoneNumber.length !== 10}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: loading || phoneNumber.length !== 10
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: loading || phoneNumber.length !== 10 ? 'not-allowed' : 'pointer',
                  boxShadow: loading || phoneNumber.length !== 10
                    ? 'none'
                    : '0 4px 16px rgba(102, 126, 234, 0.4)',
                  transition: 'transform 0.2s'
                }}
                onMouseDown={(e) => {
                  if (!loading && phoneNumber.length === 10) {
                    e.target.style.transform = 'scale(0.98)';
                  }
                }}
                onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
              >
                {loading ? 'Checking...' : 'Check Balance'}
              </button>
            </form>

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#0369a1',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                🔒 Your information is secure and will only be used to display your loan details. We do not store any data.
              </p>
            </div>
          </div>
        ) : (
          /* Customer Data Display */
          <div>
            {/* Customer Info Header */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '8px'
              }}>
                👋 Welcome, {customerData.name}!
              </div>
              <div style={{
                fontSize: '16px',
                color: '#64748b',
                marginBottom: '16px'
              }}>
                📱 {customerData.phone}
              </div>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 24px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Check Another Number
              </button>
            </div>

            {/* Monthly Finance */}
            {customerData.monthlyFinance && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <div style={{
                    fontSize: '32px'
                  }}>💰</div>
                  <div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#1e293b'
                    }}>
                      Monthly Finance
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      Payment Day: {customerData.monthlyFinance.paymentDay} of every month
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}>
                  <div style={{
                    padding: '12px',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '4px' }}>
                      Loan Amount
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {formatCurrency(customerData.monthlyFinance.loanAmount)}
                    </div>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #fcd34d'
                  }}>
                    <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>
                      Balance Due
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {formatCurrency(customerData.monthlyFinance.balance)}
                    </div>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #86efac'
                  }}>
                    <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                      Monthly Payment
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {formatCurrency(customerData.monthlyFinance.monthlyAmount)}
                    </div>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#faf5ff',
                    borderRadius: '8px',
                    border: '1px solid #d8b4fe'
                  }}>
                    <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                      Total Months
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      {customerData.monthlyFinance.totalMonths} months
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#475569'
                }}>
                  <div>📅 Loan Given: {formatDate(customerData.monthlyFinance.loanGivenDate)}</div>
                  <div>🗓️ EMI Start: {formatDate(customerData.monthlyFinance.startDate)}</div>
                </div>
              </div>
            )}

            {/* Weekly Loans */}
            {customerData.weeklyLoans.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '32px' }}>📅</div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                      Weekly Loans
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {customerData.weeklyLoans.length} active loan(s)
                    </div>
                  </div>
                </div>

                {customerData.weeklyLoans.map((loan, index) => (
                  <div key={index} style={{
                    padding: '16px',
                    background: '#eff6ff',
                    borderRadius: '12px',
                    border: '1px solid #bfdbfe',
                    marginBottom: index < customerData.weeklyLoans.length - 1 ? '12px' : 0
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '12px'
                    }}>
                      {loan.loanName}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '13px'
                    }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Loan Amount:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.loanAmount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Balance:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.balance)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Weekly Payment:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.weeklyAmount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Start Date:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatDate(loan.startDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daily Loans */}
            {customerData.dailyLoans.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '32px' }}>📆</div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                      Daily Loans
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {customerData.dailyLoans.length} active loan(s)
                    </div>
                  </div>
                </div>

                {customerData.dailyLoans.map((loan, index) => (
                  <div key={index} style={{
                    padding: '16px',
                    background: '#fef3c7',
                    borderRadius: '12px',
                    border: '1px solid #fcd34d',
                    marginBottom: index < customerData.dailyLoans.length - 1 ? '12px' : 0
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '12px'
                    }}>
                      {loan.loanName}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '13px'
                    }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Loan Amount:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.loanAmount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Balance:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.balance)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Daily Payment:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.dailyAmount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Start Date:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatDate(loan.startDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Interest Loans */}
            {customerData.interestLoans.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '32px' }}>💵</div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                      Interest Loans
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {customerData.interestLoans.length} active loan(s)
                    </div>
                  </div>
                </div>

                {customerData.interestLoans.map((loan, index) => (
                  <div key={index} style={{
                    padding: '16px',
                    background: '#d1fae5',
                    borderRadius: '12px',
                    border: '1px solid #86efac',
                    marginBottom: index < customerData.interestLoans.length - 1 ? '12px' : 0
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '12px'
                    }}>
                      {loan.loanName}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '13px'
                    }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Principal Amount:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.loanAmount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Balance:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.balance)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Interest Rate:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {loan.interestRate}% per month
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Monthly Interest:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatCurrency(loan.monthlyInterest)}
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b' }}>Start Date:</span>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {formatDate(loan.startDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Loans Message */}
            {!customerData.monthlyFinance &&
             customerData.weeklyLoans.length === 0 &&
             customerData.dailyLoans.length === 0 &&
             customerData.interestLoans.length === 0 && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '40px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                  No Active Loans
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  You have no outstanding loans at this time.
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '16px',
              marginTop: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '8px'
              }}>
                For any queries, contact us:
              </div>
              <a
                href="tel:+918667510724"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                📞 +91 8667510724
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div style={{
        textAlign: 'center',
        color: 'white',
        marginTop: '40px',
        opacity: 0.9,
        fontSize: '12px'
      }}>
        <p style={{ margin: 0 }}>© 2026 Om Sai Murugan Finance. All rights reserved.</p>
      </div>
    </div>
  );
}

export default BalanceCheck;
