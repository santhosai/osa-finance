import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { API_URL } from '../config';

function PrintReports({ onClose }) {
  const [selectedType, setSelectedType] = useState('all');
  const [printSize, setPrintSize] = useState('mobile'); // 'mobile' or 'a4'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=select, 2=preview

  const loanTypes = [
    { id: 'all', label: 'All Loans', icon: '📊' },
    { id: 'weekly', label: 'Weekly Finance', icon: '📅' },
    { id: 'monthly', label: 'Monthly Finance', icon: '📆' },
    { id: 'daily', label: 'Daily Finance', icon: '☀️' },
    { id: 'vaddi', label: 'Vaddi (Interest)', icon: '💰' }
  ];

  // Section order and config for grouping
  const sectionConfig = [
    { type: 'Weekly', label: 'WEEKLY FINANCE', icon: '📅', color: '#3b82f6', pdfColor: [59, 130, 246] },
    { type: 'Monthly', label: 'MONTHLY FINANCE', icon: '📆', color: '#8b5cf6', pdfColor: [139, 92, 246] },
    { type: 'Daily', label: 'DAILY FINANCE', icon: '☀️', color: '#f59e0b', pdfColor: [245, 158, 11] },
    { type: 'Vaddi', label: 'VADDI / INTEREST', icon: '💰', color: '#10b981', pdfColor: [16, 185, 129] }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      let allData = [];

      // Fetch based on selected type
      if (selectedType === 'all' || selectedType === 'weekly') {
        const res = await fetch(`${API_URL}/customers`);
        const customers = await res.json();
        customers.forEach(c => {
          if (c.loans) {
            c.loans.forEach(loan => {
              if (loan.loan_type === 'Weekly' && loan.status === 'active' && loan.balance > 0) {
                allData.push({
                  type: 'Weekly',
                  name: c.name,
                  phone: c.phone,
                  loanAmount: loan.loan_amount,
                  balance: loan.balance,
                  paid: loan.loan_amount - loan.balance,
                  emi: loan.weekly_amount,
                  remaining: Math.ceil(loan.balance / loan.weekly_amount),
                  emiType: 'weeks'
                });
              }
            });
          }
        });
      }

      if (selectedType === 'all' || selectedType === 'monthly') {
        const res = await fetch(`${API_URL}/monthly-finance/customers`);
        const customers = await res.json();
        customers.forEach(c => {
          if (c.status === 'active' && c.balance > 0) {
            const paid = c.loan_amount - c.balance;
            const monthsPaid = Math.floor(paid / c.monthly_amount);
            const monthsRemaining = c.total_months - monthsPaid;
            allData.push({
              type: 'Monthly',
              name: c.name,
              phone: c.phone,
              loanAmount: c.loan_amount,
              balance: c.balance,
              paid: paid,
              emi: c.monthly_amount,
              remaining: monthsRemaining > 0 ? monthsRemaining : 0,
              emiType: 'months'
            });
          }
        });
      }

      if (selectedType === 'all' || selectedType === 'daily') {
        const res = await fetch(`${API_URL}/daily-customers`);
        const customers = await res.json();
        customers.forEach(c => {
          if (c.loans) {
            c.loans.forEach(loan => {
              if (loan.status === 'active' && loan.balance > 0) {
                const daysRemaining = Math.ceil(loan.balance / loan.daily_amount);
                allData.push({
                  type: 'Daily',
                  name: c.name,
                  phone: c.phone,
                  loanAmount: loan.asked_amount,
                  balance: loan.balance,
                  paid: loan.asked_amount - loan.balance,
                  emi: loan.daily_amount,
                  remaining: daysRemaining > 0 ? daysRemaining : 0,
                  emiType: 'days'
                });
              }
            });
          }
        });
      }

      if (selectedType === 'all' || selectedType === 'vaddi') {
        const res = await fetch(`${API_URL}/vaddi-entries`);
        const entries = await res.json();
        entries.forEach(e => {
          const principal = e.principal_amount || e.amount || 0;
          const status = (e.status || '').toLowerCase().trim();
          if (status !== 'closed' && status !== 'settled' && !e.principalReturned && principal > 0) {
            allData.push({
              type: 'Vaddi',
              name: e.name,
              phone: e.phone,
              loanAmount: principal,
              balance: principal,
              paid: 0,
              emi: '-',
              remaining: '-',
              emiType: 'interest'
            });
          }
        });
      }

      // Sort each type by name
      allData.sort((a, b) => a.name.localeCompare(b.name));
      setData(allData);
    } catch (err) {
      console.error('Error fetching data:', err);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${(Number(amount) || 0).toLocaleString('en-IN')}`;
  // jsPDF cannot render ₹ (Unicode) with built-in fonts, so use Rs. for PDF output
  const formatCurrencyPDF = (amount) => `Rs.${(Number(amount) || 0).toLocaleString('en-IN')}`;

  // Group data by type
  const getGroupedData = () => {
    const groups = {};
    data.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const isMobile = printSize === 'mobile';
    const pageWidth = isMobile ? '80mm' : '210mm';
    const fontSize = isMobile ? '10px' : '12px';
    const headerSize = isMobile ? '14px' : '18px';

    const grouped = getGroupedData();
    const totalLoan = data.reduce((sum, d) => sum + (d.loanAmount || 0), 0);
    const totalPaid = data.reduce((sum, d) => sum + (d.paid || 0), 0);
    const totalBalance = data.reduce((sum, d) => sum + (d.balance || 0), 0);

    // Build section HTML for each type
    let sectionsHTML = '';
    for (const section of sectionConfig) {
      const items = grouped[section.type];
      if (!items || items.length === 0) continue;

      const sectionLoan = items.reduce((s, d) => s + (d.loanAmount || 0), 0);
      const sectionPaid = items.reduce((s, d) => s + (d.paid || 0), 0);
      const sectionBalance = items.reduce((s, d) => s + (d.balance || 0), 0);

      const rows = items.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.name}</td>
          <td style="text-align: right;">${formatCurrency(item.loanAmount)}</td>
          <td style="text-align: right;">${formatCurrency(item.paid)}</td>
          <td style="text-align: right;">${formatCurrency(item.balance)}</td>
          <td style="text-align: center;">${item.remaining !== '-' ? `${item.remaining} ${item.emiType}` : '-'}</td>
          <td>${item.phone || '-'}</td>
        </tr>
      `).join('');

      sectionsHTML += `
        <div class="section-header" style="background: ${section.color};">
          ${section.icon} ${section.label} (${items.length} customers)
          <span style="float: right;">Balance: ${formatCurrency(sectionBalance)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Loan Amt</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Left</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="section-summary">
          Loan: ${formatCurrency(sectionLoan)} | Paid: ${formatCurrency(sectionPaid)} | Balance: ${formatCurrency(sectionBalance)}
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report - ${selectedType === 'all' ? 'All Loans' : loanTypes.find(t => t.id === selectedType)?.label}</title>
        <style>
          @page { size: ${isMobile ? '80mm auto' : 'A4'}; margin: ${isMobile ? '5mm' : '15mm'}; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: ${isMobile ? "'Courier New', monospace" : "Arial, sans-serif"};
            font-size: ${fontSize};
            padding: ${isMobile ? '5px' : '20px'};
            max-width: ${pageWidth};
          }
          h1 { font-size: ${headerSize}; text-align: center; margin-bottom: 5px; }
          h2 { font-size: ${isMobile ? '12px' : '14px'}; text-align: center; color: #666; margin-bottom: 15px; font-weight: normal; }
          .section-header {
            color: white;
            padding: ${isMobile ? '4px 6px' : '8px 12px'};
            font-weight: bold;
            font-size: ${isMobile ? '10px' : '13px'};
            margin-top: 15px;
            border-radius: 4px 4px 0 0;
          }
          table { width: 100%; border-collapse: collapse; margin: 0 0 5px 0; }
          th, td {
            padding: ${isMobile ? '3px 2px' : '6px 5px'};
            border: 1px solid #ddd;
            font-size: ${isMobile ? '8px' : '11px'};
          }
          th { background: #1e293b; color: white; font-weight: bold; }
          tr:nth-child(even) { background: #f8fafc; }
          .section-summary {
            text-align: right;
            font-size: ${isMobile ? '8px' : '10px'};
            color: #555;
            padding: 4px 8px;
            background: #f0fdf4;
            border: 1px solid #ddd;
            border-top: none;
            margin-bottom: 10px;
          }
          .grand-summary {
            margin-top: 20px;
            padding: 12px;
            background: #1e293b;
            color: white;
            border-radius: 8px;
            text-align: center;
            font-size: ${isMobile ? '9px' : '12px'};
          }
          .footer { text-align: center; margin-top: 15px; font-size: ${isMobile ? '8px' : '10px'}; color: #666; }
        </style>
      </head>
      <body>
        <h1>OM SAI MURUGAN FINANCE</h1>
        <h2>${selectedType === 'all' ? 'All Active Loans' : loanTypes.find(t => t.id === selectedType)?.label} - ${new Date().toLocaleDateString('en-IN')}</h2>

        ${sectionsHTML}

        <div class="grand-summary">
          <strong>GRAND TOTAL</strong><br>
          ${data.length} Customers | Loan: ${formatCurrency(totalLoan)} | Paid: ${formatCurrency(totalPaid)} | Balance: ${formatCurrency(totalBalance)}
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleString('en-IN')} | Ph: 8667510724
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); }
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: printSize === 'mobile' ? [80, 297] : 'a4'
    });

    const isMobile = printSize === 'mobile';
    const pageWidth = isMobile ? 80 : 210;
    const margin = isMobile ? 3 : 15;
    const contentWidth = pageWidth - (margin * 2);

    const grouped = getGroupedData();
    const totalLoan = data.reduce((sum, d) => sum + (d.loanAmount || 0), 0);
    const totalPaid = data.reduce((sum, d) => sum + (d.paid || 0), 0);
    const totalBalance = data.reduce((sum, d) => sum + (d.balance || 0), 0);

    // Title
    doc.setFontSize(isMobile ? 12 : 16);
    doc.setFont('helvetica', 'bold');
    doc.text('OM SAI MURUGAN FINANCE', pageWidth / 2, margin + 5, { align: 'center' });

    // Subtitle
    doc.setFontSize(isMobile ? 8 : 10);
    doc.setFont('helvetica', 'normal');
    const subtitle = `${selectedType === 'all' ? 'All Active Loans' : loanTypes.find(t => t.id === selectedType)?.label} - ${new Date().toLocaleDateString('en-IN')}`;
    doc.text(subtitle, pageWidth / 2, margin + 10, { align: 'center' });

    // Grand summary
    doc.setFontSize(isMobile ? 6 : 8);
    doc.text(`${data.length} customers | Loan: ${formatCurrencyPDF(totalLoan)} | Paid: ${formatCurrencyPDF(totalPaid)} | Balance: ${formatCurrencyPDF(totalBalance)}`, pageWidth / 2, margin + 15, { align: 'center' });

    let y = margin + 20;

    // Helper: check if we need a new page
    const checkNewPage = (needed) => {
      if (y + needed > (isMobile ? 290 : 280)) {
        doc.addPage();
        y = margin;
      }
    };

    // Helper: draw section header
    const drawSectionHeader = (section, count, sectionBalance) => {
      checkNewPage(isMobile ? 14 : 18);

      // Section header bar
      doc.setFillColor(...section.pdfColor);
      doc.rect(margin, y, contentWidth, isMobile ? 5 : 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(isMobile ? 6 : 9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${section.label} (${count})`, margin + 2, y + (isMobile ? 3.5 : 5));
      doc.text(`Bal: ${formatCurrencyPDF(sectionBalance)}`, margin + contentWidth - 2, y + (isMobile ? 3.5 : 5), { align: 'right' });
      y += isMobile ? 5 : 7;

      // Column headers
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, contentWidth, isMobile ? 4 : 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(isMobile ? 5 : 7);

      if (isMobile) {
        doc.text('#', margin + 2, y + 3);
        doc.text('Name', margin + 7, y + 3);
        doc.text('Balance', margin + 50, y + 3, { align: 'right' });
        doc.text('Phone', margin + 62, y + 3);
      } else {
        doc.text('#', margin + 5, y + 4);
        doc.text('Name', margin + 15, y + 4);
        doc.text('Loan Amt', margin + 90, y + 4, { align: 'right' });
        doc.text('Paid', margin + 115, y + 4, { align: 'right' });
        doc.text('Balance', margin + 140, y + 4, { align: 'right' });
        doc.text('Left', margin + 155, y + 4);
        doc.text('Phone', margin + 170, y + 4);
      }
      y += isMobile ? 4 : 6;
    };

    // Render each section
    for (const section of sectionConfig) {
      const items = grouped[section.type];
      if (!items || items.length === 0) continue;

      const sectionBalance = items.reduce((s, d) => s + (d.balance || 0), 0);
      drawSectionHeader(section, items.length, sectionBalance);

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');

      items.forEach((item, idx) => {
        const rowHeight = isMobile ? 4 : 5;
        checkNewPage(rowHeight);

        // Alternate row background
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
        }

        doc.setFontSize(isMobile ? 5 : 7);
        const textY = y + (isMobile ? 3 : 3.5);

        if (isMobile) {
          doc.text(String(idx + 1), margin + 2, textY);
          doc.text(item.name.substring(0, 12), margin + 7, textY);
          doc.text(formatCurrencyPDF(item.balance), margin + 50, textY, { align: 'right' });
          doc.text((item.phone || '-').substring(0, 10), margin + 62, textY);
        } else {
          doc.text(String(idx + 1), margin + 5, textY);
          doc.text(item.name.substring(0, 20), margin + 15, textY);
          doc.text(formatCurrencyPDF(item.loanAmount), margin + 90, textY, { align: 'right' });
          doc.text(formatCurrencyPDF(item.paid), margin + 115, textY, { align: 'right' });
          doc.text(formatCurrencyPDF(item.balance), margin + 140, textY, { align: 'right' });
          const leftText = item.remaining !== '-' ? `${item.remaining} ${item.emiType.substring(0, 1)}` : '-';
          doc.text(leftText, margin + 155, textY);
          doc.text(item.phone || '-', margin + 170, textY);
        }

        y += rowHeight;
      });

      // Section subtotal line
      const sectionLoan = items.reduce((s, d) => s + (d.loanAmount || 0), 0);
      const sectionPaid = items.reduce((s, d) => s + (d.paid || 0), 0);
      checkNewPage(5);
      doc.setFillColor(240, 253, 244);
      doc.rect(margin, y, contentWidth, isMobile ? 4 : 5, 'F');
      doc.setFontSize(isMobile ? 5 : 7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      const subtotalText = `Subtotal: Loan ${formatCurrencyPDF(sectionLoan)} | Paid ${formatCurrencyPDF(sectionPaid)} | Balance ${formatCurrencyPDF(sectionBalance)}`;
      doc.text(subtotalText, margin + contentWidth - 2, y + (isMobile ? 3 : 3.5), { align: 'right' });
      y += isMobile ? 6 : 8;
    }

    // Grand total
    checkNewPage(10);
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, contentWidth, isMobile ? 6 : 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(isMobile ? 6 : 9);
    doc.setFont('helvetica', 'bold');
    doc.text(`GRAND TOTAL: ${data.length} customers | Loan: ${formatCurrencyPDF(totalLoan)} | Paid: ${formatCurrencyPDF(totalPaid)} | Balance: ${formatCurrencyPDF(totalBalance)}`, pageWidth / 2, y + (isMobile ? 4 : 5.5), { align: 'center' });
    y += isMobile ? 10 : 14;

    // Footer
    doc.setFontSize(isMobile ? 5 : 7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Ph: 8667510724`, pageWidth / 2, y, { align: 'center' });

    // Download
    const filename = `Report_${selectedType}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Group data for preview
  const grouped = getGroupedData();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '10px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #374151',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
              🖨️ Print Reports
            </h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
              {step === 1 ? 'Select options' : 'Preview & Print'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '6px'
            }}
          >
            ×
          </button>
        </div>

        {/* Step 1: Selection */}
        {step === 1 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {/* Loan Type Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '10px', fontWeight: 600 }}>
                Select Loan Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {loanTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    style={{
                      padding: '12px',
                      background: selectedType === type.id ? '#059669' : '#374151',
                      border: selectedType === type.id ? '2px solid #10b981' : '2px solid transparent',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Print Size Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', marginBottom: '10px', fontWeight: 600 }}>
                Print Size
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setPrintSize('mobile')}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: printSize === 'mobile' ? '#7c3aed' : '#374151',
                    border: printSize === 'mobile' ? '2px solid #a78bfa' : '2px solid transparent',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  📱 Mobile/Thermal<br />
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>80mm width</span>
                </button>
                <button
                  onClick={() => setPrintSize('a4')}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: printSize === 'a4' ? '#7c3aed' : '#374151',
                    border: printSize === 'a4' ? '2px solid #a78bfa' : '2px solid transparent',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  📄 A4 Paper<br />
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>Full page</span>
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={() => { fetchData(); setStep(2); }}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Generate Report →
            </button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Summary */}
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ color: '#a7f3d0', fontSize: '11px' }}>Customers</div>
                <div style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>{data.length}</div>
              </div>
              <div>
                <div style={{ color: '#a7f3d0', fontSize: '11px' }}>Total Loan</div>
                <div style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>
                  {formatCurrency(data.reduce((s, d) => s + (d.loanAmount || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ color: '#a7f3d0', fontSize: '11px' }}>Balance</div>
                <div style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>
                  {formatCurrency(data.reduce((s, d) => s + (d.balance || 0), 0))}
                </div>
              </div>
            </div>

            {/* Back Button */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #374151' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '8px 16px',
                  background: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
            </div>

            {/* Data List - Grouped by Type */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                  Loading...
                </div>
              ) : data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📭</div>
                  No active loans found
                </div>
              ) : (
                sectionConfig.map(section => {
                  const items = grouped[section.type];
                  if (!items || items.length === 0) return null;
                  const sectionBalance = items.reduce((s, d) => s + (d.balance || 0), 0);

                  return (
                    <div key={section.type} style={{ marginBottom: '12px' }}>
                      {/* Section Header */}
                      <div style={{
                        padding: '8px 12px',
                        background: section.color,
                        borderRadius: '8px 8px 0 0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>
                          {section.icon} {section.label} ({items.length})
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: 600 }}>
                          {formatCurrency(sectionBalance)}
                        </span>
                      </div>

                      {/* Section Items */}
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            background: idx % 2 === 0 ? '#374151' : '#2d3748',
                            borderRadius: idx === items.length - 1 ? '0 0 8px 8px' : 0
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>{idx + 1}. {item.name}</span>
                            <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '13px' }}>{formatCurrency(item.balance)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                            <span>Loan: {formatCurrency(item.loanAmount)}</span>
                            <span>Paid: {formatCurrency(item.paid)}</span>
                            <span>{item.remaining !== '-' ? `${item.remaining} ${item.emiType} left` : 'Interest'}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                            {item.phone || 'No phone'}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Print & Download Buttons */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #374151',
              background: '#111827',
              display: 'flex',
              gap: '10px'
            }}>
              <button
                onClick={handleDownloadPDF}
                disabled={data.length === 0}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: data.length === 0 ? '#4b5563' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: data.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                📥 PDF
              </button>
              <button
                onClick={handlePrint}
                disabled={data.length === 0}
                style={{
                  flex: 2,
                  padding: '14px',
                  background: data.length === 0 ? '#4b5563' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: data.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🖨️ Print {printSize === 'mobile' ? '(Mobile)' : '(A4)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PrintReports;
