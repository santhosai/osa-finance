import { useState } from 'react';
import { API_URL } from '../config';

function BackupWeeklyPDF({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount) =>
    `Rs.${(Number(amount) || 0).toLocaleString('en-IN')}`;

  const isSakkara = (name) =>
    (name || '').toLowerCase().includes('sakkara');

  const generatePDF = async () => {
    setLoading(true);
    setDone(false);
    setStats(null);
    setProgress('Loading all loan data...');

    try {
      // Single API call — server returns everything (loans + customers + payments)
      const res = await fetch(`${API_URL}/weekly-backup`);
      if (!res.ok) throw new Error('Failed to fetch backup data');
      const { loans: allLoans } = await res.json();

      // Sort helper — by loan_given_date ascending
      const byGivenDate = (a, b) => {
        const da = new Date(a.loan_given_date || a.start_date || 0);
        const db_date = new Date(b.loan_given_date || b.start_date || 0);
        return da - db_date;
      };

      const sundayLoans = allLoans
        .filter((l) => (l.collection_day || 'Sunday') === 'Sunday')
        .sort(byGivenDate);

      const thursdayLoans = allLoans
        .filter((l) => l.collection_day === 'Thursday')
        .sort(byGivenDate);

      const total = sundayLoans.length + thursdayLoans.length;

      setProgress('Building PDF...');

      // Build one customer block HTML
      const buildCustomerBlock = (loan, idx, theme) => {
        const payments = loan.payments || [];
        const sak = isSakkara(loan.customer_name);

        const accentColor = sak
          ? '#ea580c'
          : theme === 'sunday'
          ? '#2563eb'
          : '#7c3aed';

        const blockBg = sak ? '#fff7ed' : '#f8fafc';
        const borderColor = sak ? '#fed7aa' : '#e2e8f0';
        const evenRow = sak
          ? '#fff0e6'
          : theme === 'sunday'
          ? '#eff6ff'
          : '#f5f3ff';

        const paymentRows =
          payments.length === 0
            ? `<tr>
                <td colspan="3" style="text-align:center;color:#94a3b8;font-style:italic;padding:6px;">
                  No payments recorded yet
                </td>
               </tr>`
            : payments
                .map(
                  (p, pi) => `
                  <tr style="background:${pi % 2 === 0 ? 'white' : evenRow};">
                    <td>${formatDate(p.payment_date)}</td>
                    <td>${formatCurrency(p.amount)}</td>
                    <td>${formatCurrency(p.balance_after)}</td>
                  </tr>`
                )
                .join('');

        return `
          <div class="cblock" style="border:1px solid ${borderColor};border-left:4px solid ${accentColor};background:${blockBg};">
            <div class="cnum" style="color:${accentColor};">#${idx + 1}</div>
            <div class="cinfo">
              <div class="irow">
                <span class="lbl">Customer Name :</span>
                <span class="val" style="${sak ? `color:${accentColor};font-weight:bold;` : ''}">${loan.customer_name || '-'}</span>
              </div>
              <div class="irow">
                <span class="lbl">Phone :</span>
                <span class="val">${loan.customer_phone || '-'}</span>
              </div>
              <div class="irow">
                <span class="lbl">Loan Name :</span>
                <span class="val">${loan.loan_name || '-'}</span>
              </div>
              <div class="irow">
                <span class="lbl">Loan Amount :</span>
                <span class="val">${formatCurrency(loan.loan_amount)}</span>
              </div>
              <div class="irow">
                <span class="lbl">Weekly Amount :</span>
                <span class="val">${formatCurrency(loan.weekly_amount)}</span>
              </div>
              <div class="irow">
                <span class="lbl">Balance :</span>
                <span class="val">${formatCurrency(loan.balance)}</span>
              </div>
              <div class="irow">
                <span class="lbl">Status :</span>
                <span class="val">${loan.status || '-'}</span>
              </div>
              <div class="irow">
                <span class="lbl">Loan Given Date :</span>
                <span class="val">${formatDate(loan.loan_given_date || loan.start_date)}</span>
              </div>
            </div>
            <div class="psection">
              <div class="plabel">Payment Details :</div>
              <table>
                <thead>
                  <tr style="background:${accentColor};color:white;">
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>${paymentRows}</tbody>
              </table>
            </div>
          </div>`;
      };

      const sundayHTML = sundayLoans
        .map((loan, idx) => buildCustomerBlock(loan, idx, 'sunday'))
        .join('');

      const thursdayHTML = thursdayLoans
        .map((loan, idx) => buildCustomerBlock(loan, idx, 'thursday'))
        .join('');

      const generatedOn = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const html = `<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8">
  <title>Weekly Backup - ${generatedOn}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: Arial, 'Noto Sans Tamil', 'Latha', sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: white;
    }

    /* ── PAGE HEADER ── */
    .pdf-header {
      background: #1e293b;
      color: white;
      text-align: center;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 14px;
    }
    .pdf-header h1 { font-size: 15px; font-weight: bold; letter-spacing: 0.4px; }
    .pdf-header p  { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    /* ── SECTION HEADER ── */
    .sec-header {
      color: white;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: bold;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    /* ── SEPARATOR ── */
    .separator {
      background: #1e293b;
      color: #94a3b8;
      text-align: center;
      padding: 8px 12px;
      font-size: 11px;
      letter-spacing: 1px;
      margin: 18px 0 14px;
      border-radius: 4px;
      page-break-before: always;
    }

    /* ── CUSTOMER BLOCK ── */
    .cblock {
      border-radius: 4px;
      margin-bottom: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .cnum {
      font-weight: bold;
      font-size: 11px;
      padding: 6px 10px 2px;
    }
    .cinfo {
      padding: 4px 10px 6px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 16px;
    }
    .irow {
      display: flex;
      gap: 5px;
      font-size: 11px;
      align-items: flex-start;
      flex-wrap: nowrap;
    }
    .lbl {
      font-weight: bold;
      color: #475569;
      white-space: nowrap;
      min-width: 115px;
      flex-shrink: 0;
    }
    .val {
      color: #1e293b;
      word-break: break-word;
    }

    /* ── PAYMENT TABLE ── */
    .psection { padding: 2px 10px 8px; }
    .plabel {
      font-size: 10px;
      font-weight: bold;
      color: #64748b;
      margin-bottom: 4px;
      margin-top: 2px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td {
      padding: 4px 8px;
      text-align: left;
      border: 1px solid #e2e8f0;
    }
    th { font-weight: bold; }

    /* ── FOOTER ── */
    .footer {
      text-align: center;
      margin-top: 16px;
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <div class="pdf-header">
    <h1>OM SAI MURUGAN FINANCE &mdash; WEEKLY BACKUP</h1>
    <p>Generated: ${generatedOn} &nbsp;|&nbsp; Total Active Loans: ${total}</p>
  </div>

  <div class="sec-header" style="background:#2563eb;">
    &#128197; SUNDAY LOANS &nbsp;(${sundayLoans.length} customers)
  </div>

  ${sundayHTML || '<p style="color:#94a3b8;padding:10px;">No active Sunday loans found.</p>'}

  <div class="separator">
    &mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;
    &nbsp; THURSDAY LOANS &nbsp;
    &mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;
  </div>

  <div class="sec-header" style="background:#7c3aed;">
    &#128197; THURSDAY LOANS &nbsp;(${thursdayLoans.length} customers)
  </div>

  ${thursdayHTML || '<p style="color:#94a3b8;padding:10px;">No active Thursday loans found.</p>'}

  <div class="footer">
    Generated by OM SAI MURUGAN FINANCE &nbsp;|&nbsp; Ph: 8667510724
  </div>

</body>
</html>`;

      // Use hidden iframe — never blocked by popup blockers
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
      document.body.appendChild(iframe);

      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();

      // Wait for content to render, then print
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove iframe after print dialog closes
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (_) {}
        }, 2000);
      }, 900);

      setStats({ sunday: sundayLoans.length, thursday: thursdayLoans.length, total });
      setDone(true);
      setProgress('PDF ready!');
    } catch (err) {
      console.error('BackupWeeklyPDF error:', err);
      setProgress('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
              📄 Backup Weekly PDF
            </h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
              Person-wise weekly loan report
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              fontSize: '20px', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {done && stats ? (
            <>
              {/* Success */}
              <div style={{
                background: '#1e3a5f', borderRadius: '12px', padding: '16px',
                marginBottom: '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
                <div style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>
                  PDF Opened for Print!
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '6px' }}>
                  Use your browser&apos;s print dialog to save as PDF
                </div>
              </div>

              <div style={{
                background: '#374151', borderRadius: '12px', padding: '16px', marginBottom: '16px',
              }}>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '10px' }}>
                  Records Exported:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ color: 'white', fontSize: '13px' }}>
                    Sunday: <strong>{stats.sunday}</strong>
                  </div>
                  <div style={{ color: 'white', fontSize: '13px' }}>
                    Thursday: <strong>{stats.thursday}</strong>
                  </div>
                  <div style={{ color: 'white', fontSize: '13px', gridColumn: '1/-1' }}>
                    Total: <strong>{stats.total}</strong> active loans
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none', borderRadius: '8px', color: 'white',
                  fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              {/* Info box */}
              <div style={{
                background: '#1e3a5f', borderRadius: '12px', padding: '16px', marginBottom: '16px',
              }}>
                <div style={{ color: '#93c5fd', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  What this generates:
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', lineHeight: '1.6' }}>
                  📅 <strong>Sunday</strong> loans — sorted by Loan Given Date<br />
                  📅 <strong>Thursday</strong> loans — sorted by Loan Given Date<br />
                  👤 Each customer with full payment history<br />
                  🟠 Sakkara customers highlighted in orange
                </div>
              </div>

              {/* Progress */}
              {progress && (
                <div style={{
                  background: '#374151', borderRadius: '8px', padding: '12px',
                  marginBottom: '16px', color: '#93c5fd', fontSize: '13px', textAlign: 'center',
                }}>
                  {loading && <span style={{ marginRight: '8px' }}>⏳</span>}
                  {progress}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generatePDF}
                disabled={loading}
                style={{
                  width: '100%', padding: '14px',
                  background: loading
                    ? '#4b5563'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none', borderRadius: '8px', color: 'white',
                  fontSize: '15px', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '⏳ Generating...' : '📄 Generate PDF'}
              </button>

              <div style={{
                marginTop: '12px', padding: '10px', background: '#374151',
                borderRadius: '8px', color: '#9ca3af', fontSize: '11px', textAlign: 'center',
              }}>
                Active loans only &bull; Real data from app &bull; Tamil names supported
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BackupWeeklyPDF;
