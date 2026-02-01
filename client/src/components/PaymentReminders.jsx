import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function PaymentReminders({ onClose }) {
  const [reminders, setReminders] = useState({ monthly: [], interest: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchReminders();
  }, [selectedDate]);

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

  const formatDateTamil = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const monthNames = {
      0: 'ஜனவரி', 1: 'பிப்ரவரி', 2: 'மார்ச்', 3: 'ஏப்ரல்',
      4: 'மே', 5: 'ஜூன்', 6: 'ஜூலை', 7: 'ஆகஸ்ட்',
      8: 'செப்டம்பர்', 9: 'அக்டோபர்', 10: 'நவம்பர்', 11: 'டிசம்பர்'
    };
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  const fetchReminders = async () => {
    setLoading(true);
    try {
      // Fetch monthly finance customers and vaddi entries
      const [monthlyCustomersResponse, vaddiEntriesResponse] = await Promise.all([
        fetch(`${API_URL}/monthly-finance/customers`),
        fetch(`${API_URL}/vaddi-entries`)
      ]);

      const monthlyCustomers = await monthlyCustomersResponse.json();
      const vaddiEntries = await vaddiEntriesResponse.json();

      const monthly = [];
      const interest = [];

      const targetDate = new Date(selectedDate);
      const targetDay = targetDate.getDate();

      // Process Monthly Finance customers
      for (const customer of monthlyCustomers) {
        if (customer.balance <= 0) continue;

        const startDate = new Date(customer.start_date);
        const paymentDay = startDate.getDate();

        // Check if payment day matches target day
        if (paymentDay === targetDay) {
          monthly.push({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            monthlyAmount: customer.monthly_amount,
            balance: customer.balance,
            paymentDay: paymentDay,
            dueDate: selectedDate
          });
        }
      }

      // Process Interest/Vaddi entries (from vaddi_entries collection)
      for (const entry of vaddiEntries) {
        // Skip settled entries
        if (entry.settled || entry.paid) continue;

        const loanDay = entry.day || 1; // Day of month for this entry

        // Interest is due on the same day each month
        if (loanDay === targetDay) {
          const principalAmount = entry.principal_amount || entry.amount || 0;
          const interestRate = entry.interest_rate || 0;
          const monthlyInterest = Math.round((principalAmount * interestRate) / 100);

          interest.push({
            customerId: entry.id,
            customerName: entry.name,
            customerPhone: entry.phone,
            loanId: entry.id,
            loanName: entry.collateral_type || 'Interest Loan',
            loanAmount: principalAmount,
            balance: principalAmount,
            interestRate: interestRate,
            monthlyInterest: monthlyInterest,
            loanDate: entry.loan_date,
            dueDate: selectedDate,
            day: entry.day
          });
        }
      }

      // Sort interest entries by day
      interest.sort((a, b) => (a.day || 1) - (b.day || 1));

      setReminders({ monthly, interest });
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyReminderMessage = (customer) => {
    const message = `🔔 *கட்டண நினைவூட்டல்*

வணக்கம் ${customer.name},

உங்கள் மாதாந்திர நிதி கட்டணம் விரைவில் செலுத்த வேண்டும்!

💰 கட்டண விவரங்கள்:
• செலுத்த வேண்டிய தொகை: ${formatCurrency(customer.monthlyAmount)}
• கடைசி தேதி: ${formatDateTamil(customer.dueDate)}
• மீதமுள்ள தொகை: ${formatCurrency(customer.balance)}

தயவுசெய்து உங்கள் கட்டணத்தை சரியான நேரத்தில் செலுத்தவும்.

நன்றி!
- ஓம் சாய் முருகன் ஃபைனான்ஸ்
📞 +91 8667510724`;

    return message;
  };

  const generateInterestReminderMessage = (loan) => {
    // Calculate days remaining
    const today = new Date();
    const dueDate = new Date(loan.dueDate);
    const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    const message = `🔔 *வட்டி கட்டண நினைவூட்டல்*

வணக்கம் ${loan.customerName},

உங்கள் மாதாந்திர வட்டி கட்டணம் விரைவில் செலுத்த வேண்டும்!

💰 கடன் விவரங்கள்:
• அசல் தொகை: ${formatCurrency(loan.loanAmount)}
• கட்டண தேதி: ${formatDateTamil(loan.dueDate)} (Day ${loan.day || '-'})

⏰ இன்னும் ${daysRemaining} நாட்களில் உங்கள் வட்டி கட்டணம் வரும்!

தயவுசெய்து உங்கள் வட்டியை சரியான நேரத்தில் செலுத்தவும்.

நன்றி!
- ஓம் சாய் முருகன் ஃபைனான்ஸ்
📞 +91 8667510724`;

    return message;
  };

  const sendWhatsAppReminder = (phone, message) => {
    if (!phone) {
      alert('Phone number not available for this customer');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const sendAllMonthlyReminders = () => {
    if (reminders.monthly.length === 0) {
      alert('No monthly finance customers to send reminders to');
      return;
    }

    const confirmed = window.confirm(
      `Send reminders to ${reminders.monthly.length} monthly finance customer(s)?`
    );

    if (confirmed) {
      reminders.monthly.forEach((customer, index) => {
        if (customer.phone) {
          setTimeout(() => {
            const message = generateMonthlyReminderMessage(customer);
            sendWhatsAppReminder(customer.phone, message);
          }, index * 500); // Stagger by 500ms to avoid overwhelming the system
        }
      });
    }
  };

  const sendAllInterestReminders = () => {
    if (reminders.interest.length === 0) {
      alert('No interest loan customers to send reminders to');
      return;
    }

    const confirmed = window.confirm(
      `Send reminders to ${reminders.interest.length} interest loan customer(s)?`
    );

    if (confirmed) {
      reminders.interest.forEach((loan, index) => {
        if (loan.customerPhone) {
          setTimeout(() => {
            const message = generateInterestReminderMessage(loan);
            sendWhatsAppReminder(loan.customerPhone, message);
          }, index * 500);
        }
      });
    }
  };

  const totalReminders = reminders.monthly.length + reminders.interest.length;

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
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: 700,
              color: '#1e293b'
            }}>
              🔔 Payment Reminders
            </h2>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#64748b'
            }}>
              Send Tamil reminders to customers with upcoming payments
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Date Selector */}
        <div style={{
          padding: '16px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: '#475569',
            marginBottom: '8px'
          }}>
            Select Due Date (Next 2 Days Recommended)
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Summary Cards */}
        <div style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          background: '#f0f9ff',
          borderBottom: '1px solid #bae6fd'
        }}>
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
              {totalReminders}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Total Reminders
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #c084fc'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>
              {reminders.monthly.length}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Monthly Finance
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #86efac'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
              {reminders.interest.length}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Interest Loans
            </div>
          </div>
        </div>

        {/* Content - Scrollable List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#64748b'
            }}>
              Loading reminders...
            </div>
          ) : totalReminders === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                No Reminders for This Date
              </div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                Try selecting a different date
              </div>
            </div>
          ) : (
            <>
              {/* Monthly Finance Section */}
              {reminders.monthly.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      💰 Monthly Finance ({reminders.monthly.length})
                    </h3>
                    <button
                      onClick={sendAllMonthlyReminders}
                      style={{
                        padding: '6px 12px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Send All
                    </button>
                  </div>

                  {reminders.monthly.map((customer) => (
                    <div
                      key={customer.id}
                      style={{
                        background: '#faf5ff',
                        border: '1px solid #d8b4fe',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#1e293b',
                            marginBottom: '4px'
                          }}>
                            {customer.name}
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: '#64748b',
                            marginBottom: '8px'
                          }}>
                            📱 {customer.phone}
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            fontSize: '13px'
                          }}>
                            <div>
                              <span style={{ color: '#64748b' }}>Amount Due:</span>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {formatCurrency(customer.monthlyAmount)}
                              </div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Balance:</span>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {formatCurrency(customer.balance)}
                              </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: '#64748b' }}>Due Date:</span>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {formatDate(customer.dueDate)} (Day {customer.paymentDay})
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const message = generateMonthlyReminderMessage(customer);
                            sendWhatsAppReminder(customer.phone, message);
                          }}
                          style={{
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            minWidth: '60px'
                          }}
                        >
                          <span>📱</span>
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Interest Loans Section */}
              {reminders.interest.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      💵 Interest Loans ({reminders.interest.length})
                    </h3>
                    <button
                      onClick={sendAllInterestReminders}
                      style={{
                        padding: '6px 12px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Send All
                    </button>
                  </div>

                  {reminders.interest.map((loan) => (
                    <div
                      key={`${loan.customerId}-${loan.loanId}`}
                      style={{
                        background: '#d1fae5',
                        border: '1px solid #86efac',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#1e293b',
                            marginBottom: '4px'
                          }}>
                            {loan.customerName}
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: '#64748b',
                            marginBottom: '8px'
                          }}>
                            📱 {loan.customerPhone}
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
                              <span style={{ color: '#64748b' }}>Interest Rate:</span>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {loan.interestRate}% /month
                              </div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Monthly Interest:</span>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {formatCurrency(loan.monthlyInterest)}
                              </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: '#64748b' }}>Due Date:</span>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {formatDate(loan.dueDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const message = generateInterestReminderMessage(loan);
                            sendWhatsAppReminder(loan.customerPhone, message);
                          }}
                          style={{
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            minWidth: '60px'
                          }}
                        >
                          <span>📱</span>
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Info */}
        <div style={{
          padding: '12px 20px',
          background: '#f0f9ff',
          borderTop: '1px solid #bae6fd',
          fontSize: '11px',
          color: '#0369a1',
          textAlign: 'center'
        }}>
          ℹ️ Messages will open in WhatsApp. You can review before sending.
        </div>
      </div>
    </div>
  );
}

export default PaymentReminders;
