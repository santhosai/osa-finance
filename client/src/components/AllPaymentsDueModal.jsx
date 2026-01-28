import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AllPaymentsDueModal({ onClose, navigateTo }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [duePayments, setDuePayments] = useState({ weekly: [], monthly: [], daily: [], interest: [] });
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ weekly: true, monthly: true, daily: true, interest: true });
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  useEffect(() => {
    fetchDuePayments();
  }, [selectedDate]);

  const fetchDuePayments = async () => {
    setLoading(true);
    try {
      // Fetch both regular customers and monthly finance customers in parallel
      const [customersResponse, monthlyCustomersResponse] = await Promise.all([
        fetch(`${API_URL}/customers`),
        fetch(`${API_URL}/monthly-finance/customers`)
      ]);

      const customers = await customersResponse.json();
      const monthlyCustomers = await monthlyCustomersResponse.json();

      const weekly = [];
      const monthly = [];
      const daily = [];
      const interest = [];

      const selectedDay = new Date(selectedDate);
      const dayOfWeek = selectedDay.getDay(); // 0 = Sunday
      const dayOfMonth = selectedDay.getDate();

      // Process regular loans (Weekly, Daily, Vaddi)
      for (const customer of customers) {
        if (!customer.loans || customer.loans.length === 0) continue;

        for (const loan of customer.loans) {
          // Skip closed/archived loans
          if (loan.balance <= 0 || loan.status === 'closed') continue;

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
            alreadyPaid: false,
            paidAmount: 0
          };

          // Weekly loans - due on Sundays
          if (loan.loan_type === 'Weekly' && dayOfWeek === 0 && loan.balance > 0) {
            weekly.push(loanInfo);
          }

          // Daily loans - due every day
          if (loan.loan_type === 'Daily' && loan.balance > 0) {
            daily.push(loanInfo);
          }

          // Interest/Vaddi loans - check interest payment date
          if (loan.loan_type === 'Vaddi' && loan.balance > 0) {
            // Calculate monthly interest and check if payment is due
            const loanStartDate = new Date(loan.start_date);
            const loanStartDay = loanStartDate.getDate();

            // Interest is due on the same day each month as the start date
            if (dayOfMonth === loanStartDay) {
              interest.push({
                ...loanInfo,
                interestRate: loan.interest_rate || 0,
                monthlyInterest: (loan.loan_amount * (loan.interest_rate || 0)) / 100
              });
            }
          }
        }
      }

      // Process Monthly Finance customers
      for (const customer of monthlyCustomers) {
        // Skip if no balance
        if (customer.balance <= 0) continue;

        // Get payment day from start_date
        const startDate = new Date(customer.start_date);
        const paymentDay = startDate.getDate();

        // Check if this date matches the payment day
        if (dayOfMonth === paymentDay) {
          monthly.push({
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            loanId: customer.id, // Use customer ID as loan ID for navigation
            loanName: 'Monthly Finance',
            loanAmount: customer.loan_amount,
            balance: customer.balance,
            monthlyAmount: customer.monthly_amount,
            alreadyPaid: false,
            paidAmount: 0
          });
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

  const handleThermalPrint = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      // ESC/POS commands
      const ESC = 0x1B;
      const GS = 0x1D;
      const INIT = [ESC, 0x40]; // Initialize
      const ALIGN_CENTER = [ESC, 0x61, 0x01];
      const ALIGN_LEFT = [ESC, 0x61, 0x00];
      const BOLD_ON = [ESC, 0x45, 0x01];
      const BOLD_OFF = [ESC, 0x45, 0x00];
      const CUT = [GS, 0x56, 0x00]; // Cut paper
      const FEED = [ESC, 0x64, 0x03]; // Feed 3 lines

      const encoder = new TextEncoder();
      const commands = [];

      // Helper function to pad text properly (32 char width)
      const padLine = (left, right) => {
        const totalWidth = 32;
        const rightStr = String(right);
        const leftStr = String(left).substring(0, totalWidth - rightStr.length - 1);
        const spaces = totalWidth - leftStr.length - rightStr.length;
        return leftStr + ' '.repeat(Math.max(0, spaces)) + rightStr;
      };

      // Initialize
      commands.push(new Uint8Array(INIT));
      commands.push(new Uint8Array(ALIGN_CENTER));

      // Header
      commands.push(new Uint8Array(BOLD_ON));
      commands.push(encoder.encode('OM SAI MURUGAN FINANCE\n'));
      commands.push(new Uint8Array(BOLD_OFF));
      commands.push(encoder.encode('All Payments Due\n'));
      commands.push(encoder.encode(`${new Date(selectedDate).toLocaleDateString('en-IN')}\n`));
      commands.push(encoder.encode('================================\n'));
      commands.push(new Uint8Array(ALIGN_LEFT));

      // Monthly Finance Section
      if (duePayments.monthly.filter(l => !l.alreadyPaid).length > 0) {
        commands.push(new Uint8Array(BOLD_ON));
        commands.push(encoder.encode('\nMONTHLY FINANCE\n'));
        commands.push(new Uint8Array(BOLD_OFF));
        commands.push(encoder.encode('--------------------------------\n'));
        let monthlyTotal = 0;
        duePayments.monthly.filter(l => !l.alreadyPaid).forEach((loan) => {
          const name = loan.customerName.substring(0, 18);
          const amt = formatCurrency(loan.monthlyAmount);
          commands.push(encoder.encode(padLine(name, amt) + '\n'));
          monthlyTotal += loan.monthlyAmount || 0;
        });
        commands.push(encoder.encode(padLine('Subtotal:', formatCurrency(monthlyTotal)) + '\n'));
      }

      // Weekly Finance Section
      if (duePayments.weekly.filter(l => !l.alreadyPaid).length > 0) {
        commands.push(new Uint8Array(BOLD_ON));
        commands.push(encoder.encode('\nWEEKLY FINANCE\n'));
        commands.push(new Uint8Array(BOLD_OFF));
        commands.push(encoder.encode('--------------------------------\n'));
        let weeklyTotal = 0;
        duePayments.weekly.filter(l => !l.alreadyPaid).forEach((loan) => {
          const name = loan.customerName.substring(0, 18);
          const amt = formatCurrency(loan.weeklyAmount);
          commands.push(encoder.encode(padLine(name, amt) + '\n'));
          weeklyTotal += loan.weeklyAmount || 0;
        });
        commands.push(encoder.encode(padLine('Subtotal:', formatCurrency(weeklyTotal)) + '\n'));
      }

      // Daily Finance Section
      if (duePayments.daily.filter(l => !l.alreadyPaid).length > 0) {
        commands.push(new Uint8Array(BOLD_ON));
        commands.push(encoder.encode('\nDAILY FINANCE\n'));
        commands.push(new Uint8Array(BOLD_OFF));
        commands.push(encoder.encode('--------------------------------\n'));
        let dailyTotal = 0;
        duePayments.daily.filter(l => !l.alreadyPaid).forEach((loan) => {
          const name = loan.customerName.substring(0, 18);
          const amt = formatCurrency(loan.dailyAmount);
          commands.push(encoder.encode(padLine(name, amt) + '\n'));
          dailyTotal += loan.dailyAmount || 0;
        });
        commands.push(encoder.encode(padLine('Subtotal:', formatCurrency(dailyTotal)) + '\n'));
      }

      // Interest/Vaddi Section
      if (duePayments.interest.filter(l => !l.alreadyPaid).length > 0) {
        commands.push(new Uint8Array(BOLD_ON));
        commands.push(encoder.encode('\nINTEREST LOANS\n'));
        commands.push(new Uint8Array(BOLD_OFF));
        commands.push(encoder.encode('--------------------------------\n'));
        let interestTotal = 0;
        duePayments.interest.filter(l => !l.alreadyPaid).forEach((loan) => {
          const name = loan.customerName.substring(0, 18);
          const amt = formatCurrency(loan.monthlyInterest);
          commands.push(encoder.encode(padLine(name, amt) + '\n'));
          interestTotal += loan.monthlyInterest || 0;
        });
        commands.push(encoder.encode(padLine('Subtotal:', formatCurrency(interestTotal)) + '\n'));
      }

      // Grand Total
      commands.push(encoder.encode('================================\n'));
      commands.push(new Uint8Array(BOLD_ON));
      commands.push(encoder.encode(padLine('GRAND TOTAL:', formatCurrency(getTotalDue())) + '\n'));
      commands.push(new Uint8Array(BOLD_OFF));
      commands.push(encoder.encode('================================\n'));

      // Footer
      commands.push(new Uint8Array(ALIGN_CENTER));
      commands.push(encoder.encode(`\n${new Date().toLocaleString('en-IN')}\n`));
      commands.push(encoder.encode('Thank you!\n'));

      // Feed and cut
      commands.push(new Uint8Array(FEED));
      commands.push(new Uint8Array(CUT));

      // Send to printer
      for (const command of commands) {
        await characteristic.writeValue(command);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      alert('Thermal print sent successfully!');
    } catch (error) {
      console.error('Thermal print error:', error);
      alert('Failed to print: ' + error.message);
    }
  };

  const handleFullPrint = () => {
    const printWindow = window.open('', '_blank');

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>All Payments Due - ${new Date(selectedDate).toLocaleDateString('en-IN')}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #000;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            color: #1e293b;
          }
          .header h2 {
            margin: 10px 0;
            font-size: 20px;
            color: #64748b;
          }
          .date {
            font-size: 16px;
            color: #475569;
            margin-top: 10px;
          }
          .section {
            margin: 30px 0;
            page-break-inside: avoid;
          }
          .section-header {
            padding: 12px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 15px;
            color: white;
          }
          .monthly { background-color: #8b5cf6; }
          .weekly { background-color: #3b82f6; }
          .daily { background-color: #f59e0b; }
          .interest { background-color: #10b981; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          th {
            background-color: #f8fafc;
            font-weight: 600;
            color: #1e293b;
          }
          .amount {
            text-align: right;
            font-weight: 600;
          }
          .subtotal {
            background-color: #f1f5f9;
            font-weight: bold;
          }
          .grand-total {
            margin-top: 30px;
            padding: 20px;
            background-color: #1e293b;
            color: white;
            border-radius: 8px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
            border-top: 2px solid #e5e7eb;
            padding-top: 20px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>OM SAI MURUGAN FINANCE</h1>
          <h2>All Payments Due Report</h2>
          <div class="date">Date: ${new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
    `;

    // Monthly Finance
    if (duePayments.monthly.filter(l => !l.alreadyPaid).length > 0) {
      html += `
        <div class="section">
          <div class="section-header monthly">💰 MONTHLY FINANCE</div>
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Loan Name</th>
                <th>Phone</th>
                <th class="amount">Amount</th>
                <th class="amount">Balance</th>
              </tr>
            </thead>
            <tbody>
      `;
      let monthlyTotal = 0;
      duePayments.monthly.filter(l => !l.alreadyPaid).forEach((loan) => {
        html += `
          <tr>
            <td>${loan.customerName}</td>
            <td>${loan.loanName}</td>
            <td>${loan.customerPhone || '-'}</td>
            <td class="amount">${formatCurrency(loan.monthlyAmount)}</td>
            <td class="amount">${formatCurrency(loan.balance)}</td>
          </tr>
        `;
        monthlyTotal += loan.monthlyAmount || 0;
      });
      html += `
              <tr class="subtotal">
                <td colspan="3">Subtotal</td>
                <td class="amount">${formatCurrency(monthlyTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Weekly Finance
    if (duePayments.weekly.filter(l => !l.alreadyPaid).length > 0) {
      html += `
        <div class="section">
          <div class="section-header weekly">📅 WEEKLY FINANCE</div>
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Loan Name</th>
                <th>Phone</th>
                <th class="amount">Amount</th>
                <th class="amount">Balance</th>
              </tr>
            </thead>
            <tbody>
      `;
      let weeklyTotal = 0;
      duePayments.weekly.filter(l => !l.alreadyPaid).forEach((loan) => {
        html += `
          <tr>
            <td>${loan.customerName}</td>
            <td>${loan.loanName}</td>
            <td>${loan.customerPhone || '-'}</td>
            <td class="amount">${formatCurrency(loan.weeklyAmount)}</td>
            <td class="amount">${formatCurrency(loan.balance)}</td>
          </tr>
        `;
        weeklyTotal += loan.weeklyAmount || 0;
      });
      html += `
              <tr class="subtotal">
                <td colspan="3">Subtotal</td>
                <td class="amount">${formatCurrency(weeklyTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Daily Finance
    if (duePayments.daily.filter(l => !l.alreadyPaid).length > 0) {
      html += `
        <div class="section">
          <div class="section-header daily">📆 DAILY FINANCE</div>
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Loan Name</th>
                <th>Phone</th>
                <th class="amount">Amount</th>
                <th class="amount">Balance</th>
              </tr>
            </thead>
            <tbody>
      `;
      let dailyTotal = 0;
      duePayments.daily.filter(l => !l.alreadyPaid).forEach((loan) => {
        html += `
          <tr>
            <td>${loan.customerName}</td>
            <td>${loan.loanName}</td>
            <td>${loan.customerPhone || '-'}</td>
            <td class="amount">${formatCurrency(loan.dailyAmount)}</td>
            <td class="amount">${formatCurrency(loan.balance)}</td>
          </tr>
        `;
        dailyTotal += loan.dailyAmount || 0;
      });
      html += `
              <tr class="subtotal">
                <td colspan="3">Subtotal</td>
                <td class="amount">${formatCurrency(dailyTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Interest/Vaddi
    if (duePayments.interest.filter(l => !l.alreadyPaid).length > 0) {
      html += `
        <div class="section">
          <div class="section-header interest">💵 INTEREST LOANS</div>
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Loan Name</th>
                <th>Phone</th>
                <th class="amount">Interest Amount</th>
                <th class="amount">Principal Balance</th>
              </tr>
            </thead>
            <tbody>
      `;
      let interestTotal = 0;
      duePayments.interest.filter(l => !l.alreadyPaid).forEach((loan) => {
        html += `
          <tr>
            <td>${loan.customerName}</td>
            <td>${loan.loanName}</td>
            <td>${loan.customerPhone || '-'}</td>
            <td class="amount">${formatCurrency(loan.monthlyInterest)}</td>
            <td class="amount">${formatCurrency(loan.balance)}</td>
          </tr>
        `;
        interestTotal += loan.monthlyInterest || 0;
      });
      html += `
              <tr class="subtotal">
                <td colspan="3">Subtotal</td>
                <td class="amount">${formatCurrency(interestTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Grand Total
    html += `
        <div class="grand-total">
          GRAND TOTAL: ${formatCurrency(getTotalDue())}
        </div>
        <div class="footer">
          <p>Printed on: ${new Date().toLocaleString('en-IN')}</p>
          <p>Om Sai Murugan Finance - All Rights Reserved</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleWhatsAppSend = () => {
    if (!whatsappPhone || whatsappPhone.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }

    let message = `*ALL PAYMENTS DUE*\n`;
    message += `Date: ${new Date(selectedDate).toLocaleDateString('en-IN')}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Monthly Finance
    if (duePayments.monthly.filter(l => !l.alreadyPaid).length > 0) {
      message += `💰 *MONTHLY FINANCE*\n`;
      let monthlyTotal = 0;
      duePayments.monthly.filter(l => !l.alreadyPaid).forEach((loan) => {
        message += `• ${loan.customerName}\n`;
        message += `  ${loan.loanName} - ${formatCurrency(loan.monthlyAmount)}\n`;
        message += `  Bal: ${formatCurrency(loan.balance)}\n\n`;
        monthlyTotal += loan.monthlyAmount || 0;
      });
      message += `Subtotal: *${formatCurrency(monthlyTotal)}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Weekly Finance
    if (duePayments.weekly.filter(l => !l.alreadyPaid).length > 0) {
      message += `📅 *WEEKLY FINANCE*\n`;
      let weeklyTotal = 0;
      duePayments.weekly.filter(l => !l.alreadyPaid).forEach((loan) => {
        message += `• ${loan.customerName}\n`;
        message += `  ${loan.loanName} - ${formatCurrency(loan.weeklyAmount)}\n`;
        message += `  Bal: ${formatCurrency(loan.balance)}\n\n`;
        weeklyTotal += loan.weeklyAmount || 0;
      });
      message += `Subtotal: *${formatCurrency(weeklyTotal)}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Daily Finance
    if (duePayments.daily.filter(l => !l.alreadyPaid).length > 0) {
      message += `📆 *DAILY FINANCE*\n`;
      let dailyTotal = 0;
      duePayments.daily.filter(l => !l.alreadyPaid).forEach((loan) => {
        message += `• ${loan.customerName}\n`;
        message += `  ${loan.loanName} - ${formatCurrency(loan.dailyAmount)}\n`;
        message += `  Bal: ${formatCurrency(loan.balance)}\n\n`;
        dailyTotal += loan.dailyAmount || 0;
      });
      message += `Subtotal: *${formatCurrency(dailyTotal)}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Interest/Vaddi
    if (duePayments.interest.filter(l => !l.alreadyPaid).length > 0) {
      message += `💵 *INTEREST LOANS*\n`;
      let interestTotal = 0;
      duePayments.interest.filter(l => !l.alreadyPaid).forEach((loan) => {
        message += `• ${loan.customerName}\n`;
        message += `  ${loan.loanName} - ${formatCurrency(loan.monthlyInterest)}\n`;
        message += `  Bal: ${formatCurrency(loan.balance)}\n\n`;
        interestTotal += loan.monthlyInterest || 0;
      });
      message += `Subtotal: *${formatCurrency(interestTotal)}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Grand Total
    message += `*GRAND TOTAL: ${formatCurrency(getTotalDue())}*\n\n`;
    message += `- Om Sai Murugan Finance`;

    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppModal(false);
    setWhatsappPhone('');
  };

  const renderLoanCard = (loan, type) => (
    <div
      key={loan.loanId}
      onClick={() => {
        onClose();
        // Navigate to appropriate page based on type
        if (type === 'monthly') {
          navigateTo('monthly-finance');
        } else {
          navigateTo(`loan/${loan.loanId}`);
        }
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

        {/* Footer - Action Buttons */}
        {!loading && totalCount > 0 && (
          <div style={{
            padding: '16px 20px',
            background: 'white',
            borderTop: '2px solid #e5e7eb',
            display: 'flex',
            gap: '12px',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={handleThermalPrint}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
              }}
            >
              <span style={{ fontSize: '20px' }}>🖨️</span>
              <span>Thermal Print</span>
            </button>

            <button
              onClick={handleFullPrint}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}
            >
              <span style={{ fontSize: '20px' }}>📄</span>
              <span>Full Print</span>
            </button>

            <button
              onClick={() => setShowWhatsAppModal(true)}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <span style={{ fontSize: '20px' }}>📱</span>
              <span>WhatsApp</span>
            </button>
          </div>
        )}

        {/* Info Footer */}
        <div style={{
          padding: '10px 20px',
          background: '#f8fafc',
          textAlign: 'center',
          fontSize: '11px',
          color: '#6b7280'
        }}>
          Tap on any customer to view loan details
        </div>
      </div>

      {/* WhatsApp Phone Input Modal */}
      {showWhatsAppModal && (
        <div
          onClick={() => setShowWhatsAppModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '350px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '18px',
              fontWeight: 700,
              color: '#1e293b'
            }}>
              📱 Send via WhatsApp
            </h3>

            <p style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              color: '#64748b'
            }}>
              Enter the phone number to send the payment list
            </p>

            <input
              type="tel"
              placeholder="Enter 10 digit mobile number"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              maxLength={10}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setWhatsappPhone('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleWhatsAppSend}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllPaymentsDueModal;
