import { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { API_URL } from '../config';

// Month names for file naming
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = '169670892813-9dnhci0al56t9sb5qb8e3vcauho8j1oh.apps.googleusercontent.com';

function BackupData({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Current month by default
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [backupMode, setBackupMode] = useState('select'); // 'select', 'local', 'drive'
  const [googleUser, setGoogleUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState(false);
  const [driveFileLink, setDriveFileLink] = useState(null);

  // Check for saved Google user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('googleUser');
    if (savedUser) {
      setGoogleUser(JSON.parse(savedUser));
    }
  }, []);

  // Google Sign In
  const handleGoogleSignIn = () => {
    if (!window.google) {
      setProgress('Error: Google API not loaded. Please refresh.');
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.access_token) {
          setAccessToken(response.access_token);
          // Get user info
          fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
          })
            .then(res => res.json())
            .then(user => {
              setGoogleUser(user);
              localStorage.setItem('googleUser', JSON.stringify(user));
            });
        }
      },
    });
    client.requestAccessToken();
  };

  // Sign out from Google
  const handleGoogleSignOut = () => {
    setGoogleUser(null);
    setAccessToken(null);
    localStorage.removeItem('googleUser');
  };

  // Find or create folder in Google Drive
  const findOrCreateFolder = async (folderName, token) => {
    // Search for existing folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create new folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folder = await createRes.json();
    return folder.id;
  };

  // Upload file to Google Drive
  const uploadToGoogleDrive = async (fileBlob, fileName, folderId, token) => {
    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });

    return await res.json();
  };

  const fetchAllData = async (uploadToDrive = false) => {
    setLoading(true);
    setProgress('Fetching Weekly Finance...');

    // For Google Drive, we need a fresh access token
    let token = accessToken;
    if (uploadToDrive && !token) {
      setProgress('Error: Please connect Google account first');
      setLoading(false);
      return;
    }

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
            // Skip closed/settled loans with 0 balance
            if (loan.status === 'closed' || loan.balance <= 0) return;
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
        // Skip closed/settled with 0 balance
        if (c.status === 'closed' || c.balance <= 0) return;
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
            // Skip closed/settled loans with 0 balance
            if (loan.status === 'closed' || loan.balance <= 0) return;
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
      // Filter out settled/closed vaddi entries
      const activeVaddiEntries = vaddiEntries.filter(e => e.status !== 'settled' && e.status !== 'closed');
      activeVaddiEntries.forEach(e => {
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
        return sum + (c.loans ? c.loans.filter(l => l.status !== 'closed' && l.balance > 0).reduce((s, l) => s + (Number(l.loan_amount) || 0), 0) : 0);
      }, 0);

      const monthlyTotal = monthlyCustomers.filter(c => c.status !== 'closed' && c.balance > 0).reduce((sum, c) => sum + (Number(c.loan_amount) || 0), 0);

      const dailyTotal = dailyCustomers.reduce((sum, c) => {
        return sum + (c.loans ? c.loans.filter(l => l.status !== 'closed' && l.balance > 0).reduce((s, l) => s + (Number(l.asked_amount) || 0), 0) : 0);
      }, 0);

      const vaddiTotal = activeVaddiEntries.reduce((sum, e) => sum + (Number(e.principal_amount || e.amount) || 0), 0);

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

      const monthName = MONTHS[selectedMonth];
      const fileName = `${monthName}_${selectedYear}_OmSaiMurugan_Backup.xlsx`;
      const folderName = `${FULL_MONTHS[selectedMonth]}_${selectedYear}`;

      // Generate Excel buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      if (uploadToDrive && token) {
        // Upload to Google Drive
        setProgress('Creating folder in Google Drive...');

        try {
          // First, find or create the month folder
          const folderId = await findOrCreateFolder(folderName, token);

          setProgress('Uploading backup to Google Drive...');
          const uploadResult = await uploadToGoogleDrive(blob, fileName, folderId, token);

          if (uploadResult.id) {
            setDriveFileLink(uploadResult.webViewLink);
            setDriveUploadSuccess(true);
            setProgress('Backup uploaded to Google Drive!');
          } else {
            throw new Error(uploadResult.error?.message || 'Upload failed');
          }
        } catch (driveError) {
          console.error('Drive upload error:', driveError);
          setProgress('Drive upload failed: ' + driveError.message);
          // Fall back to local download
          setProgress('Falling back to local download...');
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      } else {
        // Local download
        setProgress('Downloading...');
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        setProgress('Backup completed!');
      }
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
          {driveUploadSuccess ? (
            <>
              {/* Google Drive Success */}
              <div style={{
                background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '50px', marginBottom: '8px' }}>☁️</div>
                <div style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>
                  Uploaded to Google Drive!
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', marginTop: '8px' }}>
                  Folder: <strong>{FULL_MONTHS[selectedMonth]}_{selectedYear}</strong>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginTop: '4px' }}>
                  {MONTHS[selectedMonth]}_{selectedYear}_OmSaiMurugan_Backup.xlsx
                </div>
              </div>

              {driveFileLink && (
                <a
                  href={driveFileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #4285f4 0%, #1d4ed8 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                    textDecoration: 'none',
                    marginBottom: '12px'
                  }}
                >
                  📂 Open in Google Drive
                </a>
              )}

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
                  <div style={{ color: 'white', fontSize: '13px' }}>Weekly: <strong>{stats?.weekly || 0}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Monthly: <strong>{stats?.monthly || 0}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Daily: <strong>{stats?.daily || 0}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Vaddi: <strong>{stats?.vaddi || 0}</strong></div>
                  <div style={{ color: 'white', fontSize: '13px' }}>Chit: <strong>{stats?.chit || 0}</strong></div>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#374151',
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
          ) : !stats ? (
            <>
              {/* Month/Year Selector */}
              <div style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 100%)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '10px' }}>
                  Select Backup Month:
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

              {/* Google Account Connection */}
              <div style={{
                background: accessToken ? 'linear-gradient(135deg, #34a853 0%, #059669 100%)' : 'linear-gradient(135deg, #4285f4 0%, #1d4ed8 100%)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '16px'
              }}>
                {accessToken ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#4285f4'
                      }}>
                        {googleUser?.name?.charAt(0) || 'G'}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                          {googleUser?.name || 'Google Connected'}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>
                          {googleUser?.email || 'Ready to backup'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleGoogleSignOut}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: 'white',
                        fontSize: '11px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#4285f4',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Connect Google Account
                  </button>
                )}
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

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {accessToken && (
                  <button
                    onClick={() => fetchAllData(true)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: loading ? '#4b5563' : 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
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
                    {loading ? '⏳ Uploading...' : '☁️ Backup to Google Drive'}
                  </button>
                )}

                <button
                  onClick={() => fetchAllData(false)}
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
                  {loading ? '⏳ Exporting...' : '📥 Download Excel'}
                </button>

                <button
                  onClick={async () => {
                    setLoading(true);
                    setProgress('Creating JSON backup...');
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

                      const weeklyCustomers = await safeFetch(`${API_URL}/customers`);
                      const monthlyCustomers = await safeFetch(`${API_URL}/monthly-finance/customers`);
                      const dailyCustomers = await safeFetch(`${API_URL}/daily-customers`);
                      const vaddiEntries = await safeFetch(`${API_URL}/vaddi-entries`);
                      const chitGroups = await safeFetch(`${API_URL}/chit-groups`);

                      let allChitMembers = [];
                      for (const group of chitGroups) {
                        const members = await safeFetch(`${API_URL}/chit-groups/${group.id}/members`);
                        allChitMembers.push(...members.map(m => ({ ...m, groupName: group.name })));
                      }

                      const fullBackup = {
                        exportDate: new Date().toISOString(),
                        exportMonth: FULL_MONTHS[selectedMonth],
                        exportYear: selectedYear,
                        data: {
                          weeklyFinance: weeklyCustomers,
                          monthlyFinance: monthlyCustomers,
                          dailyFinance: dailyCustomers,
                          vaddiEntries: vaddiEntries,
                          chitGroups: chitGroups,
                          chitMembers: allChitMembers
                        },
                        counts: {
                          weekly: weeklyCustomers.reduce((sum, c) => sum + (c.loans?.length || 0), 0),
                          monthly: monthlyCustomers.length,
                          daily: dailyCustomers.reduce((sum, c) => sum + (c.loans?.length || 0), 0),
                          vaddi: vaddiEntries.length,
                          chit: allChitMembers.length
                        }
                      };

                      const jsonStr = JSON.stringify(fullBackup, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${MONTHS[selectedMonth]}_${selectedYear}_OmSaiMurugan_FULL_Backup.json`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                      setProgress('JSON backup downloaded!');
                    } catch (error) {
                      console.error('JSON backup error:', error);
                      setProgress('Error: ' + error.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: loading ? '#4b5563' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
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
                  {loading ? '⏳ Exporting...' : '📋 Download JSON (Full Data)'}
                </button>
              </div>

              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: '#374151',
                borderRadius: '8px',
                color: '#9ca3af',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                {accessToken
                  ? `Drive folder: ${FULL_MONTHS[selectedMonth]}_${selectedYear}`
                  : 'JSON backup = Complete data for recovery. Excel = Readable reports.'}
              </div>
            </>
          ) : (
            <>
              {/* Local Download Success Stats */}
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
