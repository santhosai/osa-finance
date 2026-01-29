import { useState } from 'react';
import { API_URL } from '../config';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function BalanceCheck() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [error, setError] = useState('');
  const [expandedLoans, setExpandedLoans] = useState({});

  // UPI Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
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

      // Fetch all payments for regular loans
      const paymentsResponse = await fetch(`${API_URL}/all-payments`);
      const allPayments = await paymentsResponse.json();

      // Find customer by phone number
      const regularCustomer = customers.find(c => c.phone === phoneNumber);
      const monthlyCustomer = monthlyCustomers.find(c => c.phone === phoneNumber);

      if (!regularCustomer && !monthlyCustomer) {
        setError('No customer found with this phone number');
        setLoading(false);
        return;
      }

      // Build payments lookup: loan_id -> array of payments
      const paymentsByLoan = {};
      allPayments.forEach(payment => {
        if (!paymentsByLoan[payment.loan_id]) {
          paymentsByLoan[payment.loan_id] = [];
        }
        paymentsByLoan[payment.loan_id].push(payment);
      });

      // Sort payments by date (oldest first)
      Object.keys(paymentsByLoan).forEach(loanId => {
        paymentsByLoan[loanId].sort((a, b) =>
          new Date(a.payment_date) - new Date(b.payment_date)
        );
      });

      // Prepare data structure
      const data = {
        name: regularCustomer?.name || monthlyCustomer?.name || 'Customer',
        phone: phoneNumber,
        weeklyLoans: [],
        dailyLoans: [],
        interestLoans: [],
        monthlyFinanceLoans: []
      };

      // Process regular customer loans
      if (regularCustomer && regularCustomer.loans) {
        for (const loan of regularCustomer.loans) {
          // Skip closed loans
          if (loan.balance <= 0 || loan.status === 'closed') continue;

          const loanInfo = {
            loanId: loan.loan_id, // Include loan ID for payment lookup
            loanName: loan.loan_name || 'General Loan',
            loanAmount: loan.loan_amount,
            balance: loan.balance,
            startDate: loan.start_date,
            weeklyAmount: loan.weekly_amount,
            monthlyAmount: loan.monthly_amount,
            dailyAmount: loan.daily_amount,
            interestRate: loan.interest_rate,
            payments: paymentsByLoan[loan.loan_id] || [] // Include payment history
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

      // Process ALL Monthly Finance loans for this customer
      const monthlyFinanceLoans = monthlyCustomers.filter(
        mc => mc.phone === phoneNumber && mc.balance > 0
      );

      monthlyFinanceLoans.forEach(monthlyLoan => {
        data.monthlyFinanceLoans.push({
          id: monthlyLoan.id,
          name: monthlyLoan.name,
          loanAmount: monthlyLoan.loan_amount,
          balance: monthlyLoan.balance,
          monthlyAmount: monthlyLoan.monthly_amount,
          totalMonths: monthlyLoan.total_months,
          startDate: monthlyLoan.start_date,
          loanGivenDate: monthlyLoan.loan_given_date,
          paymentDay: new Date(monthlyLoan.start_date).getDate(),
          currentMonth: Math.ceil((new Date() - new Date(monthlyLoan.start_date)) / (1000 * 60 * 60 * 24 * 30)),
          payments: monthlyLoan.payments || [] // Include payment history
        });
      });

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
    setExpandedLoans({});
  };

  const toggleLoan = (loanType, loanIndex) => {
    const key = `${loanType}-${loanIndex}`;
    setExpandedLoans(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Open payment modal for a loan
  const handlePayNow = (loan, loanType) => {
    setSelectedLoan({ ...loan, loanType });
    setShowPaymentModal(true);
    setPaymentScreenshot(null);
  };

  // Handle screenshot file selection
  const handleScreenshotChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setPaymentScreenshot(file);
    }
  };

  // Submit payment request
  const handleSubmitPayment = async () => {
    if (!paymentScreenshot) {
      alert('Please upload payment screenshot');
      return;
    }

    if (!selectedLoan) {
      alert('Loan information missing');
      return;
    }

    setPaymentSubmitting(true);

    try {
      // Upload screenshot to Firebase Storage
      const timestamp = Date.now();
      const fileName = `payment-proofs/${selectedLoan.loanId}_${timestamp}.jpg`;
      const storageRef = ref(storage, fileName);

      setUploading(true);
      await uploadBytes(storageRef, paymentScreenshot);
      const downloadURL = await getDownloadURL(storageRef);
      setUploading(false);

      // Determine amount based on loan type
      let amount = 0;
      let loanType = selectedLoan.loanType;

      if (loanType === 'monthly') {
        amount = selectedLoan.monthlyAmount;
        loanType = 'Monthly';
      } else if (loanType === 'weekly') {
        amount = selectedLoan.weeklyAmount;
        loanType = 'Weekly';
      } else if (loanType === 'daily') {
        amount = selectedLoan.dailyAmount;
        loanType = 'Daily';
      } else if (loanType === 'interest') {
        amount = selectedLoan.monthlyInterest;
        loanType = 'Vaddi';
      }

      // Submit payment request to API
      const response = await fetch(`${API_URL}/pending-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerData.customerId || phoneNumber,
          customer_name: customerData.name,
          customer_phone: phoneNumber,
          loan_id: selectedLoan.loanId,
          loan_type: loanType,
          amount: amount,
          payment_proof_url: downloadURL
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit payment request');
      }

      const result = await response.json();

      // Success
      alert('Payment request submitted successfully! Please wait for admin approval.');
      setShowPaymentModal(false);
      setSelectedLoan(null);
      setPaymentScreenshot(null);
    } catch (error) {
      console.error('Error submitting payment:', error);
      alert('Failed to submit payment request. Please try again.');
    } finally {
      setPaymentSubmitting(false);
      setUploading(false);
    }
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

            {/* Monthly Finance Loans */}
            {customerData.monthlyFinanceLoans.length > 0 && customerData.monthlyFinanceLoans.map((monthlyLoan, index) => {
              const loanKey = `monthly-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = monthlyLoan.payments || [];
              const totalPaid = monthlyLoan.loanAmount - monthlyLoan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={monthlyLoan.id || index} style={{
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
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1e293b'
                      }}>
                        Monthly Finance {customerData.monthlyFinanceLoans.length > 1 ? `(Loan ${index + 1})` : ''}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>
                        Payment Day: {monthlyLoan.paymentDay} of every month
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
                        {formatCurrency(monthlyLoan.loanAmount)}
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
                        {formatCurrency(monthlyLoan.balance)}
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
                        {formatCurrency(monthlyLoan.monthlyAmount)}
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
                        {monthlyLoan.totalMonths} months
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
                    <div>📅 Loan Given: {formatDate(monthlyLoan.loanGivenDate)}</div>
                    <div>🗓️ EMI Start: {formatDate(monthlyLoan.startDate)}</div>
                    {monthlyLoan.currentMonth && (
                      <div>📊 Current Month: M{monthlyLoan.currentMonth} / {monthlyLoan.totalMonths}</div>
                    )}
                    <div>💵 Total Paid: {formatCurrency(totalPaid)} ({paymentsCompleted} payment{paymentsCompleted !== 1 ? 's' : ''})</div>
                  </div>

                  {/* Pay Now Button */}
                  {monthlyLoan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(monthlyLoan, 'monthly')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 Pay Now via UPI
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('monthly', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {isExpanded ? 'Hide' : 'View'} Payment History ({payments.length})
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 Payment Timeline
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ Payment #{payments.length - paymentIndex}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payment.payment_mode || 'cash'}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                Balance: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ No payments made yet
                    </div>
                  )}
                </div>
              );
            })}

            {/* Weekly Loans */}
            {customerData.weeklyLoans.length > 0 && customerData.weeklyLoans.map((loan, index) => {
              const loanKey = `weekly-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = loan.payments || [];
              const totalPaid = loan.loanAmount - loan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={index} style={{
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        Weekly Loan {customerData.weeklyLoans.length > 1 ? `(${index + 1})` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {loan.loanName}
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
                        {formatCurrency(loan.loanAmount)}
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
                        {formatCurrency(loan.balance)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                        Weekly Payment
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.weeklyAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#faf5ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                        Start Date
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatDate(loan.startDate)}
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
                    <div>💵 Total Paid: {formatCurrency(totalPaid)} ({paymentsCompleted} payment{paymentsCompleted !== 1 ? 's' : ''})</div>
                  </div>

                  {/* Pay Now Button */}
                  {loan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(loan, 'weekly')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 Pay Now via UPI
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('weekly', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {isExpanded ? 'Hide' : 'View'} Payment History ({payments.length})
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 Payment Timeline
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ Payment #{payments.length - paymentIndex}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payment.payment_mode || 'cash'}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                Balance: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ No payments made yet
                    </div>
                  )}
                </div>
              );
            })}

            {/* Daily Loans */}
            {customerData.dailyLoans.length > 0 && customerData.dailyLoans.map((loan, index) => {
              const loanKey = `daily-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = loan.payments || [];
              const totalPaid = loan.loanAmount - loan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={index} style={{
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        Daily Loan {customerData.dailyLoans.length > 1 ? `(${index + 1})` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {loan.loanName}
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
                        {formatCurrency(loan.loanAmount)}
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
                        {formatCurrency(loan.balance)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                        Daily Payment
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.dailyAmount)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#faf5ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                        Start Date
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatDate(loan.startDate)}
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
                    <div>💵 Total Paid: {formatCurrency(totalPaid)} ({paymentsCompleted} payment{paymentsCompleted !== 1 ? 's' : ''})</div>
                  </div>

                  {/* Pay Now Button */}
                  {loan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(loan, 'daily')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 Pay Now via UPI
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('daily', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {isExpanded ? 'Hide' : 'View'} Payment History ({payments.length})
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 Payment Timeline
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ Payment #{payments.length - paymentIndex}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payment.payment_mode || 'cash'}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                Balance: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ No payments made yet
                    </div>
                  )}
                </div>
              );
            })}

            {/* Interest Loans */}
            {customerData.interestLoans.length > 0 && customerData.interestLoans.map((loan, index) => {
              const loanKey = `interest-${index}`;
              const isExpanded = expandedLoans[loanKey];
              const payments = loan.payments || [];
              const totalPaid = loan.loanAmount - loan.balance;
              const paymentsCompleted = payments.length;

              return (
                <div key={index} style={{
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                        Interest Loan {customerData.interestLoans.length > 1 ? `(${index + 1})` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {loan.loanName}
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
                        Principal Amount
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.loanAmount)}
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
                        {formatCurrency(loan.balance)}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '4px' }}>
                        Interest Rate
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {loan.interestRate}% /month
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: '#faf5ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '4px' }}>
                        Monthly Interest
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                        {formatCurrency(loan.monthlyInterest)}
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
                    <div>📅 Start Date: {formatDate(loan.startDate)}</div>
                    <div>💵 Total Paid: {formatCurrency(totalPaid)} ({paymentsCompleted} payment{paymentsCompleted !== 1 ? 's' : ''})</div>
                  </div>

                  {/* Pay Now Button */}
                  {loan.balance > 0 && (
                    <button
                      onClick={() => handlePayNow(loan, 'interest')}
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      💳 Pay Interest via UPI
                    </button>
                  )}

                  {/* View Payment History Button */}
                  {payments.length > 0 && (
                    <button
                      onClick={() => toggleLoan('interest', index)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '12px',
                        background: isExpanded ? '#f1f5f9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: isExpanded ? '#475569' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} {isExpanded ? 'Hide' : 'View'} Payment History ({payments.length})
                    </button>
                  )}

                  {/* Payment History Section */}
                  {isExpanded && payments.length > 0 && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '12px'
                      }}>
                        📜 Payment Timeline
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {payments.map((payment, paymentIndex) => (
                          <div
                            key={payment.id || paymentIndex}
                            style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#1e293b'
                              }}>
                                ✅ Payment #{payments.length - paymentIndex}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                📅 {formatDate(payment.payment_date)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                💳 {payment.payment_mode || 'cash'}
                              </div>
                            </div>
                            <div style={{
                              textAlign: 'right'
                            }}>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#10b981'
                              }}>
                                {formatCurrency(payment.amount)}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#64748b',
                                marginTop: '2px'
                              }}>
                                Balance: {formatCurrency(payment.balance_after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Payment History Message */}
                  {payments.length === 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ℹ️ No payments made yet
                    </div>
                  )}
                </div>
              );
            })}

            {/* No Loans Message */}
            {customerData.monthlyFinanceLoans.length === 0 &&
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

      {/* UPI Payment Modal */}
      {showPaymentModal && selectedLoan && (
        <div
          onClick={() => !uploading && !paymentSubmitting && setShowPaymentModal(false)}
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
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '450px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: 700,
                color: '#1e293b'
              }}>
                Pay via UPI
              </h3>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {selectedLoan.loanName || 'Loan Payment'}
              </div>
            </div>

            {/* Payment Details */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Amount to Pay:</span>
                <span style={{ fontWeight: 700, fontSize: '18px', color: '#10b981' }}>
                  {selectedLoan.loanType === 'monthly' && formatCurrency(selectedLoan.monthlyAmount)}
                  {selectedLoan.loanType === 'weekly' && formatCurrency(selectedLoan.weeklyAmount)}
                  {selectedLoan.loanType === 'daily' && formatCurrency(selectedLoan.dailyAmount)}
                  {selectedLoan.loanType === 'interest' && formatCurrency(selectedLoan.monthlyInterest)}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Current Balance:</span>
                <span style={{ fontWeight: 600, fontSize: '16px', color: '#475569' }}>
                  {formatCurrency(selectedLoan.balance)}
                </span>
              </div>
            </div>

            {/* UPI Details */}
            <div style={{
              background: '#dcfce7',
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#166534', marginBottom: '12px' }}>
                📱 Pay to this UPI ID:
              </div>
              <div style={{
                background: 'white',
                padding: '12px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                8667510724@pthdfc
              </div>
              <button
                onClick={() => {
                  const amount = selectedLoan.loanType === 'monthly' ? selectedLoan.monthlyAmount :
                                selectedLoan.loanType === 'weekly' ? selectedLoan.weeklyAmount :
                                selectedLoan.loanType === 'daily' ? selectedLoan.dailyAmount :
                                selectedLoan.monthlyInterest;
                  const upiLink = `upi://pay?pa=8667510724@pthdfc&pn=Om%20Sai%20Murugan%20Finance&am=${amount}&cu=INR&tn=${selectedLoan.loanName}%20Payment`;
                  window.open(upiLink, '_blank');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Open UPI App to Pay
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#92400e'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>📋 Payment Instructions:</div>
              <ol style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Click "Open UPI App to Pay" above</li>
                <li>Complete the payment in your UPI app</li>
                <li>Take a screenshot of the payment success page</li>
                <li>Upload the screenshot below</li>
                <li>Click "Submit" to notify us</li>
              </ol>
            </div>

            {/* Screenshot Upload */}
            <div style={{
              marginBottom: '20px'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '8px'
              }}>
                Upload Payment Screenshot *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                disabled={uploading || paymentSubmitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              />
              {paymentScreenshot && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#dcfce7',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#166534'
                }}>
                  ✓ Screenshot selected: {paymentScreenshot.name}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentScreenshot(null);
                }}
                disabled={uploading || paymentSubmitting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: uploading || paymentSubmitting ? 'not-allowed' : 'pointer',
                  opacity: uploading || paymentSubmitting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={!paymentScreenshot || uploading || paymentSubmitting}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: !paymentScreenshot || uploading || paymentSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: !paymentScreenshot || uploading || paymentSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: !paymentScreenshot || uploading || paymentSubmitting ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                {uploading ? 'Uploading...' : paymentSubmitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>

            {/* Note */}
            <div style={{
              marginTop: '16px',
              fontSize: '11px',
              color: '#64748b',
              textAlign: 'center'
            }}>
              Your payment will be verified by our admin before updating your balance
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BalanceCheck;
