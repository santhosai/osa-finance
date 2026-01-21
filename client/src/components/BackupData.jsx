import { useState } from 'react';
import ExcelJS from 'exceljs';
import { API_URL } from '../config';

// Month names for file naming
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function BackupData({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Current month by default
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchAllData = async () => {
    setLoading(true);
    setProgress('Fetching Weekly Finance...');

    try {
      const safeFetch = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return [];
          return await res.json();
        } catch (e) {
          console.error(`Failed to fetch ${url}:`, e);
          return [];
        }
      };

      // Fetch all data
      setProgress('Fetching Weekly Finance customers...');
      const weeklyCustomers = await safeFetch(`${API_URL}/customers`);

      setProgress('Fetching Monthly Finance customers...');
      const monthlyCustomers = await safeFetch(`${API_URL}/monthly-finance/customers`);

      setProgress('Fetching Daily Finance customers...');
      const dailyCustomers = await safeFetch(`${API_URL}/daily-customers`);

      setProgress('Fetching Vaddi entries...');
      const vaddiEntries = await safeFetch(`${API_URL}/vaddi-entries`);

      setProgress('Fetching Chit groups...');
      const chitGroups = await safeFetch(`${API_URL}/chit-groups`);

      // Fetch chit members for each group
      let allChitMembers = [];
      for (const group of chitGroups) {
        const members = await safeFetch(`${API_URL}/chit-groups/${group.id}/members`);
        allChitMembers.push(...members.map(m => ({ ...m, groupName: group.name })));
      }

      setProgress('Creating Excel file...');

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Om Sai Murugan Finance';
      workbook.created = new Date();

      // Style for headers
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      };

      // Currency format helper
      const currencyFormat = '₹#,##0';

      // 1. Weekly Finance Sheet
      const weeklySheet = workbook.addWorksheet('Weekly Finance');
      weeklySheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Customer Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Loan Name', key: 'loanName', width: 20 },
        { header: 'Loan Amount', key: 'loanAmount', width: 18 },
        { header: 'Weekly Amount', key: 'weeklyAmount', width: 15 },
        { header: 'Balance', key: 'balance', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Start Date', key: 'startDate', width: 15 }
      ];

      weeklySheet.getRow(1).eachCell(cell => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Set number format for currency columns
      weeklySheet.getColumn('loanAmount').numFmt = currencyFormat;
      weeklySheet.getColumn('weeklyAmount').numFmt = currencyFormat;
      weeklySheet.getColumn('balance').numFmt = currencyFormat;

      let weeklyCount = 0;
      weeklyCustomers.forEach(customer => {
        if (customer.loans) {
          customer.loans.forEach(loan => {
            weeklyCount++;
            weeklySheet.addRow({
              sno: weeklyCount,
              name: customer.name,
              phone: customer.phone ? String(customer.phone) : '-',
              loanName: loan.loan_name || '-',
              loanAmount: Number(loan.loan_amount) || 0,
              weeklyAmount: Number(loan.weekly_amount) || 0,
              balance: Number(loan.balance) || 0,
              status: loan.status,
              startDate: loan.start_date
            });
          });
        }
      });

      // 2. Monthly Finance Sheet
      const monthlySheet = workbook.addWorksheet('Monthly Finance');
      monthlySheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Customer Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Loan Amount', key: 'loanAmount', width: 18 },
        { header: 'Monthly Amount', key: 'monthlyAmount', width: 15 },
        { header: 'Total Months', key: 'totalMonths', width: 12 },
        { header: 'Balance', key: 'balance', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Start Date', key: 'startDate', width: 15 }
      ];

      monthlySheet.getRow(1).eachCell(cell => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Set number format for currency columns
      monthlySheet.getColumn('loanAmount').numFmt = currencyFormat;
      monthlySheet.getColumn('monthlyAmount').numFmt = currencyFormat;
      monthlySheet.getColumn('balance').numFmt = currencyFormat;

      let monthlyCount = 0;
      monthlyCustomers.forEach(c => {
        monthlyCount++;
        monthlySheet.addRow({
          sno: monthlyCount,
          name: c.name,
          phone: c.phone ? String(c.phone) : '-',
          loanAmount: Number(c.loan_amount) || 0,
          monthlyAmount: Number(c.monthly_amount) || 0,
          totalMonths: c.total_months,
          balance: Number(c.balance) || 0,
          status: c.status,
          startDate: c.start_date
        });
      });

      // 3. Daily Finance Sheet
      const dailySheet = workbook.addWorksheet('Daily Finance');
      dailySheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Customer Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Given Amount', key: 'givenAmount', width: 18 },
        { header: 'Asked Amount', key: 'askedAmount', width: 18 },
        { header: 'Daily Amount', key: 'dailyAmount', width: 15 },
        { header: 'Balance', key: 'balance', width: 18 },
        { header: 'Status', key: 'status', width: 12 }
      ];

      dailySheet.getRow(1).eachCell(cell => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Set number format for currency columns
      dailySheet.getColumn('givenAmount').numFmt = currencyFormat;
      dailySheet.getColumn('askedAmount').numFmt = currencyFormat;
      dailySheet.getColumn('dailyAmount').numFmt = currencyFormat;
      dailySheet.getColumn('balance').numFmt = currencyFormat;

      let dailyCount = 0;
      dailyCustomers.forEach(customer => {
        if (customer.loans) {
          customer.loans.forEach(loan => {
            dailyCount++;
            dailySheet.addRow({
              sno: dailyCount,
              name: customer.name,
              phone: customer.phone ? String(customer.phone) : '-',
              givenAmount: Number(loan.given_amount) || 0,
              askedAmount: Number(loan.asked_amount) || 0,
              dailyAmount: Number(loan.daily_amount) || 0,
              balance: Number(loan.balance) || 0,
              status: loan.status
            });
          });
        }
      });

      // 4. Vaddi Sheet
      const vaddiSheet = workbook.addWorksheet('Vaddi (Interest)');
      vaddiSheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Principal Amount', key: 'principal', width: 18 },
        { header: 'Interest Rate %', key: 'rate', width: 15 },
        { header: 'Loan Date', key: 'loanDate', width: 15 },
        { header: 'Status', key: 'status', width: 12 }
      ];

      vaddiSheet.getRow(1).eachCell(cell => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Set number format for currency columns
      vaddiSheet.getColumn('principal').numFmt = currencyFormat;

      let vaddiCount = 0;
      vaddiEntries.forEach(e => {
        vaddiCount++;
        vaddiSheet.addRow({
          sno: vaddiCount,
          name: e.name,
          phone: e.phone ? String(e.phone) : '-',
          principal: Number(e.principal_amount || e.amount) || 0,
          rate: e.interest_rate || 3,
          loanDate: e.loan_date,
          status: e.status
        });
      });

      // 5. Chit Fund Sheet
      const chitSheet = workbook.addWorksheet('Chit Fund');
      chitSheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Group Name', key: 'groupName', width: 25 },
        { header: 'Member Name', key: 'memberName', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Monthly Amount', key: 'monthlyAmount', width: 18 }
      ];

      chitSheet.getRow(1).eachCell(cell => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Set number format for currency columns
      chitSheet.getColumn('monthlyAmount').numFmt = currencyFormat;

      let chitCount = 0;
      allChitMembers.forEach(m => {
        chitCount++;
        chitSheet.addRow({
          sno: chitCount,
          groupName: m.groupName,
          memberName: m.name,
          phone: m.phone ? String(m.phone) : '-',
          monthlyAmount: Number(m.monthly_amount) || 0
        });
      });

      // 6. Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Category', key: 'category', width: 30 },
        { header: 'Count', key: 'count', width: 12 },
        { header: 'Total Amount', key: 'totalAmount', width: 20 }
      ];

      summarySheet.getRow(1).eachCell(cell => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Set number format for amount column
      summarySheet.getColumn('totalAmount').numFmt = currencyFormat;

      const weeklyTotal = weeklyCustomers.reduce((sum, c) => {
        return sum + (c.loans ? c.loans.reduce((s, l) => s + (Number(l.loan_amount) || 0), 0) : 0);
      }, 0);

      const monthlyTotal = monthlyCustomers.reduce((sum, c) => sum + (Number(c.loan_amount) || 0), 0);

      const dailyTotal = dailyCustomers.reduce((sum, c) => {
        return sum + (c.loans ? c.loans.reduce((s, l) => s + (Number(l.asked_amount) || 0), 0) : 0);
      }, 0);

      const vaddiTotal = vaddiEntries.reduce((sum, e) => sum + (Number(e.principal_amount || e.amount) || 0), 0);

      summarySheet.addRow({ sno: 1, category: 'Weekly Finance Loans', count: weeklyCount, totalAmount: weeklyTotal });
      summarySheet.addRow({ sno: 2, category: 'Monthly Finance Customers', count: monthlyCount, totalAmount: monthlyTotal });
      summarySheet.addRow({ sno: 3, category: 'Daily Finance Loans', count: dailyCount, totalAmount: dailyTotal });
      summarySheet.addRow({ sno: 4, category: 'Vaddi Entries', count: vaddiCount, totalAmount: vaddiTotal });
      summarySheet.addRow({ sno: 5, category: 'Chit Fund Members', count: chitCount, totalAmount: 0 });
      summarySheet.addRow({ sno: '', category: '', count: '', totalAmount: '' });
      summarySheet.addRow({ sno: '', category: 'GRAND TOTAL', count: weeklyCount + monthlyCount + dailyCount + vaddiCount, totalAmount: weeklyTotal + monthlyTotal + dailyTotal + vaddiTotal });

      // Make grand total row bold with background
      const lastRow = summarySheet.lastRow;
      lastRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      });

      setStats({
        weekly: weeklyCount,
        monthly: monthlyCount,
        daily: dailyCount,
        vaddi: vaddiCount,
        chit: chitCount
      });

      setProgress('Downloading...');

      // Generate and download with month-based filename
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Filename format: Jan_2026_OmSaiMurugan_Backup.xlsx (easy to organize in Google Drive by month)
      const monthName = MONTHS[selectedMonth];
      a.download = `${monthName}_${selectedYear}_OmSaiMurugan_Backup.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setProgress('Backup completed!');
    } catch (error) {
      console.error('Backup error:', error);
      setProgress('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>
              💾 Backup to Excel
            </h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
              Export all data for safety
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

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {!stats ? (
            <>
              {/* Month/Year Selector */}
              <div style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 100%)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '10px' }}>
                  Select Backup Month (for Google Drive organization):
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {FULL_MONTHS.map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    style={{
                      width: '100px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  File: <strong>{MONTHS[selectedMonth]}_{selectedYear}_OmSaiMurugan_Backup.xlsx</strong>
                </div>
              </div>

              <div style={{
                background: '#374151',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '12px' }}>
                  This will export all your data to an Excel file:
                </div>
                <ul style={{ color: 'white', fontSize: '13px', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Weekly Finance customers & loans</li>
                  <li>Monthly Finance customers</li>
                  <li>Daily Finance customers & loans</li>
                  <li>Vaddi (Interest) entries</li>
                  <li>Chit Fund groups & members</li>
                </ul>
              </div>

              {/* Google Drive Tip */}
              <div style={{
                background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <span style={{ fontSize: '20px' }}>☁️</span>
                <div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Google Drive Tip (FREE)
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', lineHeight: '1.5' }}>
                    Create folders: <strong>Jan_2026</strong>, <strong>Feb_2026</strong>...
                    Upload each month's backup to its folder for organized backups!
                  </div>
                </div>
              </div>

              {progress && (
                <div style={{
                  background: '#1e3a5f',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  color: '#93c5fd',
                  fontSize: '13px',
                  textAlign: 'center'
                }}>
                  {loading && <span style={{ marginRight: '8px' }}>⏳</span>}
                  {progress}
                </div>
              )}

              <button
                onClick={fetchAllData}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? '#4b5563' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? '⏳ Exporting...' : '📥 Download Backup'}
              </button>
            </>
          ) : (
            <>
              {/* Success Stats */}
              <div style={{
                background: '#065f46',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
                <div style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>
                  Backup Downloaded!
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginTop: '6px' }}>
                  {MONTHS[selectedMonth]}_{selectedYear}_OmSaiMurugan_Backup.xlsx
                </div>
              </div>

              {/* Google Drive Upload Reminder */}
              <div style={{
                background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '24px' }}>☁️</span>
                <div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                    Upload to Google Drive
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>
                    Folder: <strong>{FULL_MONTHS[selectedMonth]}_{selectedYear}</strong>
                  </div>
                </div>
              </div>

              <div style={{
                background: '#374151',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '10px' }}>
                  Records Exported:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ color: 'white', fontSize: '13px' }}>Weekly: <strong>{stats.weekly}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Monthly: <strong>{stats.monthly}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Daily: <strong>{stats.daily}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Vaddi: <strong>{stats.vaddi}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Chit: <strong>{stats.chit}</strong></div>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BackupData;
