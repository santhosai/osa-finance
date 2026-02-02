import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function Reports({ onClose, language = 'en' }) {
  const [activeTab, setActiveTab] = useState('vaddi'); // 'vaddi' or 'monthly'
  const [reportType, setReportType] = useState('daywise'); // 'daywise' or 'monthly'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [vaddiEntries, setVaddiEntries] = useState([]);
  const [monthlyCustomers, setMonthlyCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState(null);

  const t = (key) => {
    const translations = {
      en: {
        reports: 'Reports',
        vaddiReports: 'Vaddi Reports',
        monthlyReports: 'Monthly Finance Reports',
        daywiseList: 'Day-wise List',
        monthlyStatus: 'Monthly Status',
        day: 'Day',
        name: 'Name',
        phone: 'Phone',
        principal: 'Principal',
        interest: 'Interest',
        emi: 'EMI',
        loanAmount: 'Loan Amount',
        status: 'Status',
        paid: 'Paid',
        pending: 'Pending',
        total: 'Total',
        entries: 'entries',
        customers: 'customers',
        collected: 'Collected',
        print: 'Print',
        thermal: 'Thermal (58mm)',
        pdf: 'PDF Download',
        a4Print: 'A4 Print',
        close: 'Close',
        selectMonth: 'Select Month',
        noData: 'No data available'
      },
      ta: {
        reports: 'அறிக்கைகள்',
        vaddiReports: 'வட்டி அறிக்கைகள்',
        monthlyReports: 'மாதாந்திர அறிக்கைகள்',
        daywiseList: 'நாள் பட்டியல்',
        monthlyStatus: 'மாத நிலை',
        day: 'நாள்',
        name: 'பெயர்',
        phone: 'தொலைபேசி',
        principal: 'அசல்',
        interest: 'வட்டி',
        emi: 'EMI',
        loanAmount: 'கடன் தொகை',
        status: 'நிலை',
        paid: 'செலுத்தியது',
        pending: 'நிலுவை',
        total: 'மொத்தம்',
        entries: 'பதிவுகள்',
        customers: 'வாடிக்கையாளர்கள்',
        collected: 'வசூல்',
        print: 'அச்சிடு',
        thermal: 'தெர்மல் (58mm)',
        pdf: 'PDF பதிவிறக்கம்',
        a4Print: 'A4 அச்சு',
        close: 'மூடு',
        selectMonth: 'மாதம் தேர்வு',
        noData: 'தரவு இல்லை'
      }
    };
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vaddiRes, monthlyRes] = await Promise.all([
        fetch(`${API_URL}/vaddi-entries`),
        fetch(`${API_URL}/monthly-finance/customers`)
      ]);

      const vaddiData = await vaddiRes.json();
      const monthlyData = await monthlyRes.json();

      setVaddiEntries(Array.isArray(vaddiData) ? vaddiData.filter(e => e.status !== 'settled' && !e.principal_returned) : []);
      setMonthlyCustomers(Array.isArray(monthlyData) ? monthlyData.filter(c => c.status === 'active') : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group vaddi entries by day
  const getVaddiByDay = () => {
    const grouped = {};
    vaddiEntries.forEach(entry => {
      const day = entry.day || 1;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(entry);
    });
    return Object.keys(grouped)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(day => ({ day: parseInt(day), entries: grouped[day] }));
  };

  // Group monthly finance by EMI day (from start_date)
  const getMonthlyByDay = () => {
    const grouped = {};
    monthlyCustomers.forEach(customer => {
      const day = customer.start_date ? new Date(customer.start_date).getDate() : 1;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({ ...customer, emiDay: day });
    });
    return Object.keys(grouped)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(day => ({ day: parseInt(day), customers: grouped[day] }));
  };

  // Check if vaddi interest was paid for selected month
  const isVaddiPaidForMonth = (entry) => {
    if (!entry.interest_payments) return false;
    const [year, month] = selectedMonth.split('-');
    return entry.interest_payments.some(p => {
      const paymentDate = new Date(p.date || p.payment_date);
      return paymentDate.getFullYear() === parseInt(year) &&
             (paymentDate.getMonth() + 1) === parseInt(month);
    });
  };

  // Check if monthly EMI was paid for selected month
  const isMonthlyPaidForMonth = (customer) => {
    if (!customer.payments) return false;
    const [year, month] = selectedMonth.split('-');
    return customer.payments.some(p => {
      const paymentDate = new Date(p.date || p.payment_date);
      return paymentDate.getFullYear() === parseInt(year) &&
             (paymentDate.getMonth() + 1) === parseInt(month);
    });
  };

  // Calculate monthly interest amount
  const calculateMonthlyInterest = (entry) => {
    const principal = entry.principal_amount || entry.amount || 0;
    const rate = entry.interest_rate || 2;
    return Math.round((principal * rate) / 100);
  };

  // Generate print content
  const generatePrintContent = (type) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (activeTab === 'vaddi') {
      if (reportType === 'daywise') {
        const data = getVaddiByDay();
        const totalEntries = vaddiEntries.length;
        const totalAmount = vaddiEntries.reduce((sum, e) => sum + (e.principal_amount || e.amount || 0), 0);
        return {
          title: 'VADDI DAY-WISE LIST',
          titleTamil: 'வட்டி நாள் பட்டியல்',
          date: dateStr,
          data,
          totalEntries,
          totalAmount,
          type: 'vaddi-daywise'
        };
      } else {
        const data = getVaddiByDay();
        const allEntries = vaddiEntries.map(e => ({
          ...e,
          paid: isVaddiPaidForMonth(e),
          interestAmount: calculateMonthlyInterest(e)
        }));
        const paidEntries = allEntries.filter(e => e.paid);
        const pendingEntries = allEntries.filter(e => !e.paid);
        const totalInterest = allEntries.reduce((sum, e) => sum + e.interestAmount, 0);
        const collectedInterest = paidEntries.reduce((sum, e) => sum + e.interestAmount, 0);
        const pendingInterest = pendingEntries.reduce((sum, e) => sum + e.interestAmount, 0);

        return {
          title: 'VADDI MONTHLY STATUS',
          titleTamil: 'வட்டி மாத நிலை',
          date: dateStr,
          month: selectedMonth,
          data: allEntries,
          paidCount: paidEntries.length,
          pendingCount: pendingEntries.length,
          totalEntries: allEntries.length,
          collectedAmount: collectedInterest,
          pendingAmount: pendingInterest,
          totalAmount: totalInterest,
          type: 'vaddi-monthly'
        };
      }
    } else {
      if (reportType === 'daywise') {
        const data = getMonthlyByDay();
        const totalCustomers = monthlyCustomers.length;
        const totalEMI = monthlyCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
        return {
          title: 'MONTHLY EMI DAY-WISE LIST',
          titleTamil: 'மாதாந்திர EMI நாள் பட்டியல்',
          date: dateStr,
          data,
          totalCustomers,
          totalEMI,
          type: 'monthly-daywise'
        };
      } else {
        const allCustomers = monthlyCustomers.map(c => ({
          ...c,
          paid: isMonthlyPaidForMonth(c),
          emiDay: c.start_date ? new Date(c.start_date).getDate() : 1
        }));
        const paidCustomers = allCustomers.filter(c => c.paid);
        const pendingCustomers = allCustomers.filter(c => !c.paid);
        const totalEMI = allCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
        const collectedEMI = paidCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);
        const pendingEMI = pendingCustomers.reduce((sum, c) => sum + (c.monthly_amount || 0), 0);

        return {
          title: 'MONTHLY EMI STATUS',
          titleTamil: 'மாதாந்திர EMI நிலை',
          date: dateStr,
          month: selectedMonth,
          data: allCustomers.sort((a, b) => a.emiDay - b.emiDay),
          paidCount: paidCustomers.length,
          pendingCount: pendingCustomers.length,
          totalCustomers: allCustomers.length,
          collectedAmount: collectedEMI,
          pendingAmount: pendingEMI,
          totalAmount: totalEMI,
          type: 'monthly-status'
        };
      }
    }
  };

  const handlePrint = (printType) => {
    const content = generatePrintContent();
    setPrintData({ ...content, printType });

    if (printType === 'thermal') {
      printThermal(content);
    } else if (printType === 'pdf') {
      downloadPDF(content);
    } else {
      printA4(content);
    }

    setShowPrintModal(false);
  };

  // Thermal print (58mm)
  const printThermal = (content) => {
    const printWindow = window.open('', '_blank');
    let html = `
      <html>
      <head>
        <title>Print</title>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            width: 58mm;
            margin: 0;
            padding: 2mm;
          }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
          .title { font-weight: bold; font-size: 11px; }
          .subtitle { font-size: 9px; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .day-header { font-weight: bold; background: #eee; padding: 2px; margin-top: 5px; }
          .entry { display: flex; justify-content: space-between; padding: 1px 0; }
          .name { flex: 1; }
          .amount { text-align: right; }
          .status-paid { color: green; }
          .status-pending { color: red; }
          .summary { border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; }
          .footer { text-align: center; margin-top: 10px; font-size: 9px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ஓம் சாய் முருகன் ஃபைனான்ஸ்</div>
          <div class="subtitle">OM SAI MURUGAN FINANCE</div>
          <div class="divider"></div>
          <div class="title">${content.title}</div>
          <div class="subtitle">${content.titleTamil}</div>
          <div>Date: ${content.date}</div>
          ${content.month ? `<div>Month: ${new Date(content.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>` : ''}
        </div>
    `;

    if (content.type === 'vaddi-daywise') {
      content.data.forEach(dayGroup => {
        html += `<div class="day-header">DAY ${String(dayGroup.day).padStart(2, '0')}:</div>`;
        dayGroup.entries.forEach(entry => {
          html += `<div class="entry"><span class="name">${entry.name}</span><span class="amount">${formatCurrency(entry.principal_amount || entry.amount)}</span></div>`;
        });
      });
      html += `
        <div class="summary">
          <div class="total-row"><span>TOTAL ENTRIES:</span><span>${content.totalEntries}</span></div>
          <div class="total-row"><span>TOTAL AMOUNT:</span><span>${formatCurrency(content.totalAmount)}</span></div>
        </div>
      `;
    } else if (content.type === 'vaddi-monthly') {
      content.data.sort((a, b) => (a.day || 1) - (b.day || 1)).forEach(entry => {
        html += `<div class="entry">
          <span>${String(entry.day || 1).padStart(2, '0')}</span>
          <span class="name" style="margin-left:5px">${entry.name.substring(0, 12)}</span>
          <span class="amount">${formatCurrency(entry.interestAmount)}</span>
          <span class="${entry.paid ? 'status-paid' : 'status-pending'}">${entry.paid ? '✓' : '⏳'}</span>
        </div>`;
      });
      html += `
        <div class="summary">
          <div class="total-row"><span>✓ COLLECTED:</span><span>${formatCurrency(content.collectedAmount)} (${content.paidCount})</span></div>
          <div class="total-row"><span>⏳ PENDING:</span><span>${formatCurrency(content.pendingAmount)} (${content.pendingCount})</span></div>
          <div class="divider"></div>
          <div class="total-row"><span>TOTAL:</span><span>${formatCurrency(content.totalAmount)} (${content.totalEntries})</span></div>
        </div>
      `;
    } else if (content.type === 'monthly-daywise') {
      content.data.forEach(dayGroup => {
        html += `<div class="day-header">DAY ${String(dayGroup.day).padStart(2, '0')}:</div>`;
        dayGroup.customers.forEach(customer => {
          html += `<div class="entry"><span class="name">${customer.name}</span><span class="amount">${formatCurrency(customer.monthly_amount)}</span></div>`;
        });
      });
      html += `
        <div class="summary">
          <div class="total-row"><span>TOTAL CUSTOMERS:</span><span>${content.totalCustomers}</span></div>
          <div class="total-row"><span>TOTAL EMI:</span><span>${formatCurrency(content.totalEMI)}</span></div>
        </div>
      `;
    } else if (content.type === 'monthly-status') {
      content.data.forEach(customer => {
        html += `<div class="entry">
          <span>${String(customer.emiDay).padStart(2, '0')}</span>
          <span class="name" style="margin-left:5px">${customer.name.substring(0, 12)}</span>
          <span class="amount">${formatCurrency(customer.monthly_amount)}</span>
          <span class="${customer.paid ? 'status-paid' : 'status-pending'}">${customer.paid ? '✓' : '⏳'}</span>
        </div>`;
      });
      html += `
        <div class="summary">
          <div class="total-row"><span>✓ COLLECTED:</span><span>${formatCurrency(content.collectedAmount)} (${content.paidCount})</span></div>
          <div class="total-row"><span>⏳ PENDING:</span><span>${formatCurrency(content.pendingAmount)} (${content.pendingCount})</span></div>
          <div class="divider"></div>
          <div class="total-row"><span>TOTAL:</span><span>${formatCurrency(content.totalAmount)} (${content.totalCustomers})</span></div>
        </div>
      `;
    }

    html += `
        <div class="footer">
          <div class="divider"></div>
          <div>📞 8667510724</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // A4 Print
  const printA4 = (content) => {
    const printWindow = window.open('', '_blank');
    let html = `
      <html>
      <head>
        <title>Print Report</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
            padding: 20px;
          }
          .header {
            text-align: center;
            border: 2px solid #1e293b;
            padding: 15px;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
          }
          .title { font-size: 18px; font-weight: bold; }
          .subtitle { font-size: 14px; margin-top: 5px; }
          .date-info { margin-top: 10px; font-size: 12px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background: #1e293b;
            color: white;
            padding: 10px;
            text-align: left;
            font-size: 11px;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
          }
          tr:nth-child(even) { background: #f8fafc; }
          .day-row {
            background: #fef3c7 !important;
            font-weight: bold;
          }
          .status-paid { color: #059669; font-weight: bold; }
          .status-pending { color: #dc2626; font-weight: bold; }
          .summary {
            margin-top: 20px;
            border: 2px solid #1e293b;
            padding: 15px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 13px;
          }
          .summary-row.total {
            border-top: 2px solid #1e293b;
            margin-top: 10px;
            padding-top: 10px;
            font-weight: bold;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ஓம் சாய் முருகன் ஃபைனான்ஸ்</div>
          <div class="title">OM SAI MURUGAN FINANCE</div>
          <div class="subtitle">${content.title}</div>
          <div class="subtitle">${content.titleTamil}</div>
          <div class="date-info">
            Generated: ${content.date}
            ${content.month ? ` | Month: ${new Date(content.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}` : ''}
          </div>
        </div>
    `;

    if (content.type === 'vaddi-daywise') {
      html += `<table><tr><th>DAY</th><th>NAME</th><th>PHONE</th><th>PRINCIPAL</th></tr>`;
      content.data.forEach(dayGroup => {
        dayGroup.entries.forEach((entry, idx) => {
          html += `<tr ${idx === 0 ? 'class="day-row"' : ''}>
            <td>${idx === 0 ? String(dayGroup.day).padStart(2, '0') : ''}</td>
            <td>${entry.name}</td>
            <td>${entry.phone || '-'}</td>
            <td>${formatCurrency(entry.principal_amount || entry.amount)}</td>
          </tr>`;
        });
      });
      html += `</table>
        <div class="summary">
          <div class="summary-row total"><span>TOTAL ENTRIES: ${content.totalEntries}</span><span>TOTAL AMOUNT: ${formatCurrency(content.totalAmount)}</span></div>
        </div>
      `;
    } else if (content.type === 'vaddi-monthly') {
      html += `<table><tr><th>DAY</th><th>NAME</th><th>PRINCIPAL</th><th>RATE</th><th>INTEREST</th><th>STATUS</th></tr>`;
      content.data.sort((a, b) => (a.day || 1) - (b.day || 1)).forEach(entry => {
        html += `<tr>
          <td>${String(entry.day || 1).padStart(2, '0')}</td>
          <td>${entry.name}</td>
          <td>${formatCurrency(entry.principal_amount || entry.amount)}</td>
          <td>${entry.interest_rate || 2}%</td>
          <td>${formatCurrency(entry.interestAmount)}</td>
          <td class="${entry.paid ? 'status-paid' : 'status-pending'}">${entry.paid ? '✓ PAID' : '⏳ PENDING'}</td>
        </tr>`;
      });
      html += `</table>
        <div class="summary">
          <div class="summary-row"><span>✓ COLLECTED:</span><span>${formatCurrency(content.collectedAmount)} (${content.paidCount} entries)</span></div>
          <div class="summary-row"><span>⏳ PENDING:</span><span>${formatCurrency(content.pendingAmount)} (${content.pendingCount} entries)</span></div>
          <div class="summary-row total"><span>TOTAL:</span><span>${formatCurrency(content.totalAmount)} (${content.totalEntries} entries)</span></div>
        </div>
      `;
    } else if (content.type === 'monthly-daywise') {
      html += `<table><tr><th>DAY</th><th>NAME</th><th>PHONE</th><th>LOAN AMOUNT</th><th>EMI</th></tr>`;
      content.data.forEach(dayGroup => {
        dayGroup.customers.forEach((customer, idx) => {
          html += `<tr ${idx === 0 ? 'class="day-row"' : ''}>
            <td>${idx === 0 ? String(dayGroup.day).padStart(2, '0') : ''}</td>
            <td>${customer.name}</td>
            <td>${customer.phone || '-'}</td>
            <td>${formatCurrency(customer.loan_amount)}</td>
            <td>${formatCurrency(customer.monthly_amount)}</td>
          </tr>`;
        });
      });
      html += `</table>
        <div class="summary">
          <div class="summary-row total"><span>TOTAL CUSTOMERS: ${content.totalCustomers}</span><span>TOTAL EMI: ${formatCurrency(content.totalEMI)}</span></div>
        </div>
      `;
    } else if (content.type === 'monthly-status') {
      html += `<table><tr><th>DAY</th><th>NAME</th><th>LOAN</th><th>EMI</th><th>BALANCE</th><th>STATUS</th></tr>`;
      content.data.forEach(customer => {
        html += `<tr>
          <td>${String(customer.emiDay).padStart(2, '0')}</td>
          <td>${customer.name}</td>
          <td>${formatCurrency(customer.loan_amount)}</td>
          <td>${formatCurrency(customer.monthly_amount)}</td>
          <td>${formatCurrency(customer.balance)}</td>
          <td class="${customer.paid ? 'status-paid' : 'status-pending'}">${customer.paid ? '✓ PAID' : '⏳ PENDING'}</td>
        </tr>`;
      });
      html += `</table>
        <div class="summary">
          <div class="summary-row"><span>✓ COLLECTED:</span><span>${formatCurrency(content.collectedAmount)} (${content.paidCount} customers)</span></div>
          <div class="summary-row"><span>⏳ PENDING:</span><span>${formatCurrency(content.pendingAmount)} (${content.pendingCount} customers)</span></div>
          <div class="summary-row total"><span>TOTAL:</span><span>${formatCurrency(content.totalAmount)} (${content.totalCustomers} customers)</span></div>
        </div>
      `;
    }

    html += `
        <div class="footer">
          <div>📞 8667510724 | OM SAI MURUGAN FINANCE</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Download PDF
  const downloadPDF = (content) => {
    // For PDF, we'll use the same print function but trigger save as PDF
    printA4(content);
    alert('In the print dialog, select "Save as PDF" as the printer to download PDF.');
  };

  const vaddiByDay = getVaddiByDay();
  const monthlyByDay = getMonthlyByDay();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
      zIndex: 1000,
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer'
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
          📊 {t('reports')}
        </h2>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Module Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        padding: '16px',
        background: 'rgba(255,255,255,0.1)'
      }}>
        <button
          onClick={() => setActiveTab('vaddi')}
          style={{
            flex: 1,
            padding: '12px',
            background: activeTab === 'vaddi'
              ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
              : 'rgba(255,255,255,0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          💰 {t('vaddiReports')}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          style={{
            flex: 1,
            padding: '12px',
            background: activeTab === 'monthly'
              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
              : 'rgba(255,255,255,0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📅 {t('monthlyReports')}
        </button>
      </div>

      {/* Report Type Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        padding: '0 16px 16px'
      }}>
        <button
          onClick={() => setReportType('daywise')}
          style={{
            flex: 1,
            padding: '10px',
            background: reportType === 'daywise' ? 'white' : 'rgba(255,255,255,0.2)',
            color: reportType === 'daywise' ? '#1e293b' : 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📋 {t('daywiseList')}
        </button>
        <button
          onClick={() => setReportType('monthly')}
          style={{
            flex: 1,
            padding: '10px',
            background: reportType === 'monthly' ? 'white' : 'rgba(255,255,255,0.2)',
            color: reportType === 'monthly' ? '#1e293b' : 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📆 {t('monthlyStatus')}
        </button>
      </div>

      {/* Month Selector (for monthly status) */}
      {reportType === 'monthly' && (
        <div style={{ padding: '0 16px 16px' }}>
          <label style={{ color: 'white', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            {t('selectMonth')}:
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px'
            }}
          />
        </div>
      )}

      {/* Print Button */}
      <div style={{ padding: '0 16px 16px' }}>
        <button
          onClick={() => setShowPrintModal(true)}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          🖨️ {t('print')}
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'white', padding: '40px' }}>
            Loading...
          </div>
        ) : (
          <>
            {/* VADDI REPORTS */}
            {activeTab === 'vaddi' && (
              <>
                {reportType === 'daywise' ? (
                  // Day-wise Vaddi List
                  vaddiByDay.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'white', padding: '40px' }}>
                      {t('noData')}
                    </div>
                  ) : (
                    vaddiByDay.map(dayGroup => (
                      <div key={dayGroup.day} style={{
                        background: 'white',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                          padding: '10px 14px',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '14px'
                        }}>
                          DAY {String(dayGroup.day).padStart(2, '0')}
                        </div>
                        {dayGroup.entries.map((entry, idx) => (
                          <div key={entry.id || idx} style={{
                            padding: '10px 14px',
                            borderBottom: idx < dayGroup.entries.length - 1 ? '1px solid #e5e7eb' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{entry.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{entry.phone}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#d97706' }}>
                              {formatCurrency(entry.principal_amount || entry.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )
                ) : (
                  // Monthly Vaddi Status
                  <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                      padding: '12px 14px',
                      color: 'white',
                      fontWeight: 700,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>{t('day')}</span>
                      <span>{t('name')}</span>
                      <span>{t('interest')}</span>
                      <span>{t('status')}</span>
                    </div>
                    {vaddiEntries.sort((a, b) => (a.day || 1) - (b.day || 1)).map((entry, idx) => {
                      const paid = isVaddiPaidForMonth(entry);
                      const interestAmt = calculateMonthlyInterest(entry);
                      return (
                        <div key={entry.id || idx} style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: idx % 2 === 0 ? 'white' : '#f8fafc'
                        }}>
                          <span style={{ width: '30px', fontWeight: 600 }}>{String(entry.day || 1).padStart(2, '0')}</span>
                          <span style={{ flex: 1, marginLeft: '10px' }}>{entry.name}</span>
                          <span style={{ width: '70px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(interestAmt)}</span>
                          <span style={{
                            width: '50px',
                            textAlign: 'center',
                            color: paid ? '#059669' : '#dc2626',
                            fontWeight: 700
                          }}>
                            {paid ? '✓' : '⏳'}
                          </span>
                        </div>
                      );
                    })}
                    {/* Summary */}
                    <div style={{ padding: '14px', background: '#f1f5f9', borderTop: '2px solid #e5e7eb' }}>
                      {(() => {
                        const allEntries = vaddiEntries.map(e => ({
                          ...e,
                          paid: isVaddiPaidForMonth(e),
                          interestAmount: calculateMonthlyInterest(e)
                        }));
                        const paidEntries = allEntries.filter(e => e.paid);
                        const pendingEntries = allEntries.filter(e => !e.paid);
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ color: '#059669', fontWeight: 600 }}>✓ {t('collected')}:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(paidEntries.reduce((s, e) => s + e.interestAmount, 0))} ({paidEntries.length})</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>⏳ {t('pending')}:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(pendingEntries.reduce((s, e) => s + e.interestAmount, 0))} ({pendingEntries.length})</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                              <span style={{ fontWeight: 700 }}>{t('total')}:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(allEntries.reduce((s, e) => s + e.interestAmount, 0))} ({allEntries.length})</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* MONTHLY FINANCE REPORTS */}
            {activeTab === 'monthly' && (
              <>
                {reportType === 'daywise' ? (
                  // Day-wise Monthly EMI List
                  monthlyByDay.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'white', padding: '40px' }}>
                      {t('noData')}
                    </div>
                  ) : (
                    monthlyByDay.map(dayGroup => (
                      <div key={dayGroup.day} style={{
                        background: 'white',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          padding: '10px 14px',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '14px'
                        }}>
                          DAY {String(dayGroup.day).padStart(2, '0')}
                        </div>
                        {dayGroup.customers.map((customer, idx) => (
                          <div key={customer.id || idx} style={{
                            padding: '10px 14px',
                            borderBottom: idx < dayGroup.customers.length - 1 ? '1px solid #e5e7eb' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{customer.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Loan: {formatCurrency(customer.loan_amount)}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#059669' }}>
                              {formatCurrency(customer.monthly_amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )
                ) : (
                  // Monthly EMI Status
                  <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      padding: '12px 14px',
                      color: 'white',
                      fontWeight: 700,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>{t('day')}</span>
                      <span>{t('name')}</span>
                      <span>{t('emi')}</span>
                      <span>{t('status')}</span>
                    </div>
                    {monthlyCustomers
                      .map(c => ({ ...c, emiDay: c.start_date ? new Date(c.start_date).getDate() : 1 }))
                      .sort((a, b) => a.emiDay - b.emiDay)
                      .map((customer, idx) => {
                        const paid = isMonthlyPaidForMonth(customer);
                        return (
                          <div key={customer.id || idx} style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: idx % 2 === 0 ? 'white' : '#f8fafc'
                          }}>
                            <span style={{ width: '30px', fontWeight: 600 }}>{String(customer.emiDay).padStart(2, '0')}</span>
                            <span style={{ flex: 1, marginLeft: '10px' }}>{customer.name}</span>
                            <span style={{ width: '70px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(customer.monthly_amount)}</span>
                            <span style={{
                              width: '50px',
                              textAlign: 'center',
                              color: paid ? '#059669' : '#dc2626',
                              fontWeight: 700
                            }}>
                              {paid ? '✓' : '⏳'}
                            </span>
                          </div>
                        );
                      })}
                    {/* Summary */}
                    <div style={{ padding: '14px', background: '#f1f5f9', borderTop: '2px solid #e5e7eb' }}>
                      {(() => {
                        const allCustomers = monthlyCustomers.map(c => ({
                          ...c,
                          paid: isMonthlyPaidForMonth(c)
                        }));
                        const paidCustomers = allCustomers.filter(c => c.paid);
                        const pendingCustomers = allCustomers.filter(c => !c.paid);
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ color: '#059669', fontWeight: 600 }}>✓ {t('collected')}:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(paidCustomers.reduce((s, c) => s + (c.monthly_amount || 0), 0))} ({paidCustomers.length})</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>⏳ {t('pending')}:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(pendingCustomers.reduce((s, c) => s + (c.monthly_amount || 0), 0))} ({pendingCustomers.length})</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                              <span style={{ fontWeight: 700 }}>{t('total')}:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(allCustomers.reduce((s, c) => s + (c.monthly_amount || 0), 0))} ({allCustomers.length})</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Print Modal */}
      {showPrintModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '320px'
          }}>
            <h3 style={{ margin: '0 0 20px', textAlign: 'center', color: '#1e293b' }}>
              🖨️ {t('print')}
            </h3>

            <button
              onClick={() => handlePrint('thermal')}
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '10px',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🖨️ {t('thermal')}
            </button>

            <button
              onClick={() => handlePrint('pdf')}
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '10px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              📄 {t('pdf')}
            </button>

            <button
              onClick={() => handlePrint('a4')}
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '16px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🖨️ {t('a4Print')}
            </button>

            <button
              onClick={() => setShowPrintModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
