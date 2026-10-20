// One-click full backup: every module's data (customers, loans, every payment, chit,
// auto finance, festival fund, pongal, savings schemes, settings) into one Excel file,
// one sheet per data collection plus a Summary sheet.
import { API_URL } from '../config';

// Friendly sheet names (Excel limit: 31 characters)
const SHEET_NAMES = {
  customers: 'Weekly Customers', loans: 'Weekly Loans', payments: 'Weekly Payments', archived_loans: 'Archived Loans',
  monthly_finance_customers: 'Monthly Customers', monthly_finance_payments: 'Monthly Payments',
  daily_customers: 'Daily Customers', daily_loans: 'Daily Loans', daily_payments: 'Daily Payments',
  vaddi_entries: 'Vaddi Entries', vaddi_payments: 'Vaddi Payments', investments: 'Investments',
  chit_groups: 'Chit Groups', chit_members: 'Chit Members', chit_payments: 'Chit Payments',
  chit_auctions: 'Chit Auctions', chit_settings: 'Chit Settings',
  auto_finance_customers: 'Auto Finance Customers', auto_finance_payments: 'Auto Finance Payments',
  festival_fund_customers: 'Festival Fund Customers', festival_fund_payments: 'Festival Fund Payments',
  pongal_plans: 'Pongal Plans', pongal_customers: 'Pongal Customers', pongal_payments: 'Pongal Payments',
  pongal_counters: 'Pongal Counters', schemes: 'Savings Schemes', scheme_members: 'Scheme Members',
  pending_payments: 'Pending Payments', user_transfers: 'User Transfers', app_users: 'App Users', app_settings: 'App Settings'
};

async function getJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Firestore timestamps arrive as {_seconds,_nanoseconds}; nested objects/arrays become JSON text
function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
    return JSON.stringify(v);
  }
  if (typeof v === 'string' && v.length > 32000) return v.slice(0, 32000); // Excel cell limit
  return v;
}

async function fetchCollection(name) {
  const docs = [];
  let after = null;
  do {
    const page = await getJSON(`${API_URL}/backup/collections/${name}?limit=1000${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    docs.push(...page.docs);
    after = page.next;
  } while (after);
  return docs;
}

// onProgress(text) is called as each collection is fetched
export async function downloadFullBackup(onProgress = () => {}) {
  const { default: ExcelJS } = await import('exceljs');
  const names = await getJSON(`${API_URL}/backup/collections`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Om Sai Murugan Finance';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Sheet', key: 'sheet', width: 28 },
    { header: 'Records', key: 'count', width: 12 },
    { header: 'Data name', key: 'name', width: 30 }
  ];
  const header = (ws) => ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });

  let total = 0;
  const failed = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const label = SHEET_NAMES[name] || name.slice(0, 31);
    onProgress(`Downloading ${label} (${i + 1}/${names.length})…`);
    let docs;
    try { docs = await fetchCollection(name); } catch (e) { failed.push(label); summary.addRow({ sheet: label, count: `FAILED: ${e.message}`, name }); continue; }
    total += docs.length;
    summary.addRow({ sheet: label, count: docs.length, name });

    const ws = workbook.addWorksheet(label);
    const keys = ['id', ...[...new Set(docs.flatMap(d => Object.keys(d)))].filter(k => k !== 'id').sort()];
    ws.columns = keys.map(k => ({ header: k, key: k, width: Math.min(Math.max(k.length + 2, 12), 40) }));
    docs.forEach(d => ws.addRow(Object.fromEntries(keys.map(k => [k, cellValue(d[k])]))));
    header(ws);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const stamp = new Date();
  summary.addRow({});
  summary.addRow({ sheet: 'Total records', count: total });
  summary.addRow({ sheet: 'Backup taken', count: stamp.toLocaleString('en-IN') });
  header(summary);

  onProgress('Creating Excel file…');
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  const pad = (n) => String(n).padStart(2, '0');
  a.href = url;
  a.download = `OSM-Full-Backup-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { total, sheets: names.length - failed.length, failed };
}
