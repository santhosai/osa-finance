import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import {
  PONGAL_TOTAL_MONTHS, pongalElapsedMonths, pongalConsecutiveMissedStreak,
  pongalBuildBatchMessage, pongalBuildReminderMessage, pongalSendWhatsApp
} from '../utils/pongalHelpers';

// ---- Design: a fresh harvest-gold theme (Pongal = rice harvest festival) on the
// same dark-admin-shell structure (sidebar + sticky topbar + cards) the rest of the
// app's admin screens use, so it reads as a sibling module rather than a re-skin of
// Festival Fund's navy/amber look.
const S = {
  page: { minHeight: '100vh', background: '#1b140f', color: '#f3e9dc', fontFamily: 'system-ui, sans-serif' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200 },
  // Off-canvas drawer on every screen size (not just mobile) — same pattern as the
  // rest of the app's admin modules, so the main content is never squeezed sideways.
  sidebar: (open) => ({
    position: 'fixed', top: 0, left: open ? 0 : '-260px', bottom: 0, width: 230,
    background: '#241a12', borderRight: '1px solid #3a2a1a', zIndex: 201,
    transition: 'left 0.3s ease', padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto'
  }),
  sidebarHeader: { padding: '4px 10px 18px', borderBottom: '1px solid #3a2a1a', marginBottom: 10 },
  navItem: (active) => ({
    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: active ? '#1b140f' : '#e8d5b7', background: active ? 'linear-gradient(135deg,#f2a93b,#d4841f)' : 'transparent',
    display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s'
  }),
  topbar: {
    position: 'sticky', top: 0, zIndex: 5, background: '#241a12e6', backdropFilter: 'blur(6px)',
    borderBottom: '2px solid #d4841f', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10
  },
  burger: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 },
  burgerLine: { display: 'block', width: 22, height: 2, background: '#f2a93b', borderRadius: 2 },
  body: { padding: '16px 16px 60px', maxWidth: 1100, boxSizing: 'border-box' },
  card: { background: '#241a12', border: '1px solid #3a2a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 },
  stat: { background: '#2c2015', border: '1px solid #3a2a1a', borderRadius: 10, padding: '12px 14px', textAlign: 'center' },
  statVal: { fontSize: 20, fontWeight: 800, color: '#f2a93b' },
  statLabel: { fontSize: 11, color: '#c9b491', marginTop: 4 },
  input: { background: '#1b140f', border: '1px solid #4a3624', borderRadius: 8, color: '#f3e9dc', padding: '9px 11px', fontSize: 13, width: '100%', boxSizing: 'border-box' },
  label: { fontSize: 11, color: '#c9b491', marginBottom: 4, display: 'block', fontWeight: 600 },
  btnPrimary: { background: 'linear-gradient(135deg,#f2a93b,#d4841f)', color: '#1b140f', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnGhost: { background: '#2c2015', color: '#f3e9dc', border: '1px solid #4a3624', borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSmall: { border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  badge: (kind) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
    background: kind === 'paid' ? '#14532d' : kind === 'overdue' ? '#7f1d1d' : kind === 'pending' ? '#78350f' : '#334155',
    color: kind === 'paid' ? '#86efac' : kind === 'overdue' ? '#fca5a5' : kind === 'pending' ? '#fcd34d' : '#cbd5e1'
  }),
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: '#2c2015', marginBottom: 6, gap: 10, flexWrap: 'wrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 },
  modalBox: { background: '#241a12', border: '1px solid #4a3624', borderRadius: 14, padding: 20, width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto' },
  monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 },
  monthCell: (state, selected) => ({
    borderRadius: 8, padding: '10px 6px', textAlign: 'center', cursor: state === 'unpaid' ? 'pointer' : 'default',
    border: selected ? '2px solid #f2a93b' : '1px solid #3a2a1a',
    background: state === 'paid' ? '#14532d' : state === 'pending' ? '#78350f' : '#2c2015',
    color: state === 'paid' ? '#86efac' : state === 'pending' ? '#fcd34d' : '#c9b491'
  })
};

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'customers', icon: '🌾', label: 'All Customers' },
  { id: 'add', icon: '➕', label: 'Add Customer' },
  { id: 'approvals', icon: '🧾', label: 'UPI Approvals' },
  { id: 'plans', icon: '📦', label: 'Scheme Plans' },
  { id: 'reports', icon: '📥', label: 'Reports' },
  { id: 'rules', icon: '📜', label: 'Rules & Settings' }
];

const monthName = (n) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][n - 1] || `M${n}`;

function PongalFund() {
  const currentYear = new Date().getFullYear();
  const [section, setSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [dashboard, setDashboard] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [cursorStack, setCursorStack] = useState([null]);
  const [nextCursor, setNextCursor] = useState(null);
  const [custLoading, setCustLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(null);

  const [plans, setPlans] = useState([]);
  const [planForm, setPlanForm] = useState({ year: currentYear, monthly_amount: '', package_items: '' });

  const [pendingBatches, setPendingBatches] = useState([]);

  const [addForm, setAddForm] = useState({ name: '', phone: '', village: '', scheme_year: currentYear, address: '', notes: '' });
  const [contactPickerSupported] = useState(typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState(new Set());
  const [payMode, setPayMode] = useState('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payTime, setPayTime] = useState(new Date().toTimeString().slice(0, 5));
  const [editModal, setEditModal] = useState(null);

  const [whatsappNote, setWhatsappNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  const adminName = localStorage.getItem('userName') || 'Admin';

  // ---------- Fetchers ----------
  const fetchDashboard = useCallback(async (y, m) => {
    setDashLoading(true);
    try {
      const res = await fetch(`${API_URL}/pongal-fund/dashboard?year=${y}&month=${m}`);
      setDashboard(res.ok ? await res.json() : null);
    } catch { setDashboard(null); }
    setDashLoading(false);
  }, []);

  const fetchCustomersPage = useCallback(async (y, cursor, searchTerm) => {
    setCustLoading(true);
    try {
      const params = new URLSearchParams({ year: y, limit: '50' });
      if (cursor) params.set('cursor', cursor);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`${API_URL}/pongal-fund/customers?${params.toString()}`);
      const data = res.ok ? await res.json() : { customers: [], nextCursor: null };
      setCustomers(data.customers || []);
      setNextCursor(data.nextCursor || null);
    } catch { setCustomers([]); setNextCursor(null); }
    setCustLoading(false);
  }, []);

  const fetchCount = useCallback(async (y) => {
    try {
      const res = await fetch(`${API_URL}/pongal-fund/customers-count?year=${y}`);
      setTotalCount(res.ok ? (await res.json()).count : null);
    } catch { setTotalCount(null); }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pongal-fund/plans`);
      setPlans(res.ok ? await res.json() : []);
    } catch { setPlans([]); }
  }, []);

  const fetchPendingBatches = useCallback(async (y) => {
    try {
      const res = await fetch(`${API_URL}/pongal-fund/pending-payments?year=${y}`);
      setPendingBatches(res.ok ? await res.json() : []);
    } catch { setPendingBatches([]); }
  }, []);

  const fetchCustomerDetail = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_URL}/pongal-fund/customers/${id}`);
      setCustomerDetail(res.ok ? await res.json() : null);
    } catch { setCustomerDetail(null); }
  }, []);

  const fetchWhatsappNote = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pongal-fund/whatsapp-settings`);
      const data = res.ok ? await res.json() : {};
      setWhatsappNote(data.quick_note || '');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchPlans(); fetchWhatsappNote(); }, [fetchPlans, fetchWhatsappNote]);
  useEffect(() => { if (section === 'dashboard') fetchDashboard(year, month); }, [section, year, month, fetchDashboard]);
  useEffect(() => {
    if (section === 'customers') { setCursorStack([null]); fetchCustomersPage(year, null, search); fetchCount(year); }
  }, [section, year, search, fetchCustomersPage, fetchCount]);
  useEffect(() => { if (section === 'approvals') fetchPendingBatches(year); }, [section, year, fetchPendingBatches]);
  useEffect(() => { if (selectedCustomerId) fetchCustomerDetail(selectedCustomerId); }, [selectedCustomerId, fetchCustomerDetail]);

  const currentPlan = plans.find(p => Number(p.year) === Number(year));

  // ---------- Actions ----------
  const goNextPage = () => {
    if (!nextCursor) return;
    setCursorStack(s => [...s, nextCursor]);
    fetchCustomersPage(year, nextCursor, search);
  };
  const goPrevPage = () => {
    if (cursorStack.length <= 1) return;
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    fetchCustomersPage(year, newStack[newStack.length - 1], search);
  };

  // Contact picker (Android Chrome/PWA only) — same feature-detected pattern Festival Fund uses.
  const pickContactForAdd = async () => {
    if (!contactPickerSupported) return;
    try {
      const results = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!results.length) return;
      const contact = results[0];
      const name = contact.name?.[0] || '';
      let phone = (contact.tel?.[0] || '').replace(/\D/g, '');
      if (phone.length > 10) phone = phone.slice(-10);
      setAddForm(f => ({ ...f, name: name || f.name, phone: phone || f.phone }));
    } catch (err) {
      // AbortError = user cancelled the picker — not worth surfacing as an error.
      if (err?.name !== 'AbortError') alert(`Contacts error: ${err?.message || err?.name || 'Unknown error'}`);
    }
  };

  const pickContactForEdit = async () => {
    if (!contactPickerSupported) return;
    try {
      const results = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!results.length) return;
      const contact = results[0];
      const name = contact.name?.[0] || '';
      let phone = (contact.tel?.[0] || '').replace(/\D/g, '');
      if (phone.length > 10) phone = phone.slice(-10);
      setEditModal(f => ({ ...f, name: name || f.name, phone: phone || f.phone }));
    } catch (err) {
      if (err?.name !== 'AbortError') alert(`Contacts error: ${err?.message || err?.name || 'Unknown error'}`);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.name || !addForm.phone || !addForm.village) { setAddError('Name, phone and village are required'); return; }
    setAddSaving(true);
    try {
      const res = await fetch(`${API_URL}/pongal-fund/customers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm)
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add customer'); setAddSaving(false); return; }
      setAddForm({ name: '', phone: '', village: '', scheme_year: currentYear, address: '', notes: '' });
      setAddSaving(false);
      setSection('customers');
    } catch { setAddError('Network error — please try again'); setAddSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    await fetch(`${API_URL}/pongal-fund/customers/${editModal.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editModal.name, phone: editModal.phone, village: editModal.village, address: editModal.address, notes: editModal.notes })
    });
    setEditModal(null);
    if (selectedCustomerId) fetchCustomerDetail(selectedCustomerId);
    fetchCustomersPage(year, cursorStack[cursorStack.length - 1], search);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const items = planForm.package_items.split(',').map(s => s.trim()).filter(Boolean);
    await fetch(`${API_URL}/pongal-fund/plans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: planForm.year, monthly_amount: Number(planForm.monthly_amount), package_items: items })
    });
    fetchPlans();
  };

  const recordPayment = async (customer, months) => {
    const res = await fetch(`${API_URL}/pongal-fund/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, months: [...months], mode: payMode, paid_date: payDate, paid_time: payTime, recorded_by: adminName })
    });
    if (!res.ok) { alert('Failed to record payment'); return; }
    const data = await res.json();
    const totalAmount = data.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const message = pongalBuildBatchMessage({
      customer: { ...customer, paid_months: [...(customer.paid_months || []), ...months] },
      months, totalAmount, paidDate: payDate, promoNote: whatsappNote
    });
    if (confirm(`Payment recorded for ${months.length} month(s). Send WhatsApp confirmation now?`)) {
      pongalSendWhatsApp(customer, message);
    }
    setSelectedMonths(new Set());
    if (selectedCustomerId) fetchCustomerDetail(selectedCustomerId);
    if (section === 'dashboard') fetchDashboard(year, month);
    fetchCustomersPage(year, cursorStack[cursorStack.length - 1], search);
  };

  const undoPayment = async (paymentId) => {
    if (!confirm('Undo this payment?')) return;
    await fetch(`${API_URL}/pongal-fund/payments/${paymentId}`, { method: 'DELETE' });
    if (selectedCustomerId) fetchCustomerDetail(selectedCustomerId);
    fetchDashboard(year, month);
  };

  const recordHandover = async (customer) => {
    if (!confirm(`Confirm the grocery package was handed over to ${customer.name}?`)) return;
    const res = await fetch(`${API_URL}/pongal-fund/customers/${customer.id}/handover`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handover_date: new Date().toISOString().slice(0, 10), handover_time: new Date().toTimeString().slice(0, 5), recorded_by: adminName })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed'); return; }
    const message = pongalBuildBatchMessage({ customer, months: [PONGAL_TOTAL_MONTHS + 1], totalAmount: 0, paidDate: new Date().toISOString().slice(0, 10), promoNote: whatsappNote });
    if (confirm('Handover recorded. Send WhatsApp confirmation?')) pongalSendWhatsApp(customer, message);
    fetchCustomerDetail(customer.id);
  };

  const approveBatch = async (batchId) => {
    await fetch(`${API_URL}/pongal-fund/pending-payments/${batchId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved_by: adminName })
    });
    fetchPendingBatches(year);
  };
  const rejectBatch = async (batchId) => {
    const reason = prompt('Reason for rejection (optional):') || '';
    await fetch(`${API_URL}/pongal-fund/pending-payments/${batchId}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejected_by: adminName, reason })
    });
    fetchPendingBatches(year);
  };

  const sendReminder = (customer, unpaidMonths) => {
    const msg = pongalBuildReminderMessage({ customer, unpaidMonths, monthlyAmount: currentPlan?.monthly_amount || 0, promoNote: whatsappNote });
    pongalSendWhatsApp(customer, msg);
  };

  const saveWhatsappNote = async () => {
    await fetch(`${API_URL}/pongal-fund/whatsapp-settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quick_note: whatsappNote })
    });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const downloadCSV = async (scope) => {
    const params = new URLSearchParams({ year });
    if (scope === 'month') params.set('month', month);
    const res = await fetch(`${API_URL}/pongal-fund/payments?${params.toString()}`);
    const payments = res.ok ? await res.json() : [];
    const header = 'Card Number,Customer,Month,Amount,Mode,Paid Date,Paid Time,Approved By\n';
    const idToCustomer = new Map(customers.map(c => [c.id, c]));
    const rows = payments.map(p => {
      const c = idToCustomer.get(p.customer_id);
      return [c?.card_number || p.customer_id, c?.name || '', p.month_number, p.amount, p.mode, p.paid_date, p.paid_time || '', p.approved_by || ''].join(',');
    });
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pongal-${scope}-${year}${scope === 'month' ? '-' + month : ''}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- UI ----------
  const goSection = (id) => { setSection(id); setSidebarOpen(false); };

  return (
    <div style={S.page}>
      {sidebarOpen && <div style={S.overlay} onClick={() => setSidebarOpen(false)} />}

      <div style={S.sidebar(sidebarOpen)}>
        <div style={S.sidebarHeader}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f2a93b' }}>🌾 Pongal Scheme</div>
          <div style={{ fontSize: 11, color: '#c9b491' }}>12-Month Grocery Savings</div>
        </div>
        {NAV.map(n => (
          <div key={n.id} style={S.navItem(section === n.id)} onClick={() => goSection(n.id)}>
            <span>{n.icon}</span><span>{n.label}</span>
          </div>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <div style={S.navItem(false)} onClick={() => { localStorage.removeItem('isLoggedIn'); window.location.reload(); }}>
            <span>🚪</span><span>Logout</span>
          </div>
        </div>
      </div>

      <div>
        <div style={S.topbar}>
          <button style={S.burger} onClick={() => setSidebarOpen(true)}>
            <span style={S.burgerLine} /><span style={S.burgerLine} /><span style={S.burgerLine} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{NAV.find(n => n.id === section)?.label}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...S.input, width: 'auto' }}>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={S.body}>
          {section === 'dashboard' && (
            <DashboardSection
              year={year} month={month} setMonth={setMonth} dashboard={dashboard} loading={dashLoading}
              onMarkPaid={(customer) => { setSelectedCustomerId(customer.id); setSelectedMonths(new Set([month])); }}
              onWhatsApp={(item) => {
                const msg = pongalBuildBatchMessage({ customer: item.customer, months: [item.payment.month_number], totalAmount: item.payment.amount, paidDate: item.payment.paid_date, promoNote: whatsappNote });
                pongalSendWhatsApp(item.customer, msg);
              }}
              onRemind={(customer) => sendReminder(customer, [month])}
              onUndo={(payment) => undoPayment(payment.id)}
              onOpenCustomer={(id) => { setSelectedCustomerId(id); setSection('customers'); }}
            />
          )}

          {section === 'customers' && !selectedCustomerId && (
            <CustomersSection
              customers={customers} loading={custLoading} search={search} setSearch={setSearch}
              totalCount={totalCount} hasPrev={cursorStack.length > 1} hasNext={!!nextCursor}
              onPrev={goPrevPage} onNext={goNextPage} year={year}
              onOpen={(id) => setSelectedCustomerId(id)}
            />
          )}

          {section === 'customers' && selectedCustomerId && (
            <CustomerDetailSection
              detail={customerDetail} plan={plans.find(p => Number(p.year) === Number(customerDetail?.scheme_year))}
              selectedMonths={selectedMonths} setSelectedMonths={setSelectedMonths}
              payMode={payMode} setPayMode={setPayMode} payDate={payDate} setPayDate={setPayDate} payTime={payTime} setPayTime={setPayTime}
              onBack={() => { setSelectedCustomerId(null); setCustomerDetail(null); setSelectedMonths(new Set()); }}
              onRecordPayment={() => recordPayment(customerDetail, selectedMonths)}
              onUndo={undoPayment}
              onHandover={() => recordHandover(customerDetail)}
              onEdit={() => setEditModal({ ...customerDetail })}
              onRemind={() => {
                const paid = new Set(customerDetail.paid_months || []);
                const unpaid = Array.from({ length: PONGAL_TOTAL_MONTHS }, (_, i) => i + 1).filter(m => !paid.has(m));
                sendReminder(customerDetail, unpaid);
              }}
            />
          )}

          {section === 'add' && (
            <AddCustomerSection form={addForm} setForm={setAddForm} onSubmit={handleAddCustomer} saving={addSaving} error={addError} currentYear={currentYear} onPickContact={pickContactForAdd} contactPickerSupported={contactPickerSupported} />
          )}

          {section === 'approvals' && (
            <ApprovalsSection batches={pendingBatches} onApprove={approveBatch} onReject={rejectBatch} />
          )}

          {section === 'plans' && (
            <PlansSection plans={plans} form={planForm} setForm={setPlanForm} onSave={handleSavePlan} />
          )}

          {section === 'reports' && (
            <ReportsSection year={year} month={month} setMonth={setMonth} onDownload={downloadCSV} />
          )}

          {section === 'rules' && (
            <RulesSection whatsappNote={whatsappNote} setWhatsappNote={setWhatsappNote} onSave={saveWhatsappNote} saved={noteSaved} />
          )}
        </div>
      </div>

      {editModal && (
        <div style={S.modalOverlay} onClick={() => setEditModal(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Customer</h3>
            {contactPickerSupported && (
              <button type="button" onClick={pickContactForEdit} style={{ width: '100%', padding: 10, marginBottom: 14, background: '#1b140f', border: '1px dashed #f2a93b', borderRadius: 8, color: '#f2a93b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                📇 Pick from Contacts
              </button>
            )}
            <label style={S.label}>Name</label>
            <input style={S.input} value={editModal.name} onChange={e => setEditModal({ ...editModal, name: e.target.value })} />
            <div style={{ height: 10 }} />
            <label style={S.label}>Phone</label>
            <input style={S.input} value={editModal.phone} onChange={e => setEditModal({ ...editModal, phone: e.target.value })} />
            <div style={{ height: 10 }} />
            <label style={S.label}>Village</label>
            <input style={S.input} value={editModal.village} onChange={e => setEditModal({ ...editModal, village: e.target.value })} />
            <div style={{ height: 10 }} />
            <label style={S.label}>Address (optional)</label>
            <input style={S.input} value={editModal.address || ''} onChange={e => setEditModal({ ...editModal, address: e.target.value })} />
            <div style={{ height: 10 }} />
            <label style={S.label}>Notes (optional)</label>
            <input style={S.input} value={editModal.notes || ''} onChange={e => setEditModal({ ...editModal, notes: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={S.btnPrimary} onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSection({ year, month, setMonth, dashboard, loading, onMarkPaid, onWhatsApp, onRemind, onUndo, onOpenCustomer }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {Array.from({ length: PONGAL_TOTAL_MONTHS }, (_, i) => i + 1).map(m => (
          <button key={m} onClick={() => setMonth(m)} style={{ ...S.btnSmall, background: month === m ? 'linear-gradient(135deg,#f2a93b,#d4841f)' : '#2c2015', color: month === m ? '#1b140f' : '#c9b491', padding: '8px 12px' }}>
            {monthName(m)}
          </button>
        ))}
      </div>

      {loading && <div style={S.card}>Loading...</div>}
      {!loading && !dashboard && <div style={S.card}>No data yet — set up a plan for {year} first.</div>}
      {!loading && dashboard && (
        <>
          <div style={S.statGrid}>
            <div style={S.stat}><div style={S.statVal}>{dashboard.totalCustomers}</div><div style={S.statLabel}>Total Customers</div></div>
            <div style={S.stat}><div style={{ ...S.statVal, color: '#86efac' }}>{dashboard.paidList.length}</div><div style={S.statLabel}>Paid ({monthName(month)})</div></div>
            <div style={S.stat}><div style={{ ...S.statVal, color: '#fca5a5' }}>{dashboard.unpaidList.length}</div><div style={S.statLabel}>Not Paid</div></div>
            <div style={S.stat}><div style={{ ...S.statVal, color: '#86efac' }}>₹{dashboard.collected.toLocaleString('en-IN')}</div><div style={S.statLabel}>Collected</div></div>
            <div style={S.stat}><div style={{ ...S.statVal, color: '#fcd34d' }}>₹{dashboard.pending.toLocaleString('en-IN')}</div><div style={S.statLabel}>To Collect</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={S.card}>
              <h4 style={{ marginTop: 0, color: '#86efac' }}>✓ Paid ({dashboard.paidList.length})</h4>
              {dashboard.paidList.map(({ customer, payment }) => (
                <div key={customer.id} style={S.row}>
                  <div style={{ cursor: 'pointer' }} onClick={() => onOpenCustomer(customer.id)}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{customer.name} <span style={{ color: '#c9b491', fontSize: 11 }}>• {customer.card_number}</span></div>
                    <div style={{ fontSize: 11, color: '#c9b491' }}>₹{payment.amount} • {payment.paid_date} {payment.paid_time} • {payment.mode}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...S.btnSmall, background: '#25D366', color: 'white' }} onClick={() => onWhatsApp({ customer, payment })}>WA</button>
                    <button style={{ ...S.btnSmall, background: '#7f1d1d', color: '#fca5a5' }} onClick={() => onUndo(payment)}>Undo</button>
                  </div>
                </div>
              ))}
              {dashboard.paidList.length === 0 && <div style={{ color: '#c9b491', fontSize: 12 }}>Nobody paid yet this month.</div>}
            </div>
            <div style={S.card}>
              <h4 style={{ marginTop: 0, color: '#fca5a5' }}>✗ Not Paid ({dashboard.unpaidList.length})</h4>
              {dashboard.unpaidList.map(({ customer }) => {
                const elapsed = pongalElapsedMonths(customer.scheme_year);
                const streak = pongalConsecutiveMissedStreak(customer.paid_months, elapsed);
                return (
                  <div key={customer.id} style={S.row}>
                    <div style={{ cursor: 'pointer' }} onClick={() => onOpenCustomer(customer.id)}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {customer.name} <span style={{ color: '#c9b491', fontSize: 11 }}>• {customer.card_number}</span>
                        {streak >= 3 && <span style={{ marginLeft: 6 }}><span style={S.badge('overdue')}>⚠ {streak} missed in a row</span></span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#c9b491' }}>{customer.village}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ ...S.btnSmall, background: 'linear-gradient(135deg,#f2a93b,#d4841f)', color: '#1b140f' }} onClick={() => onMarkPaid(customer)}>Mark Paid</button>
                      <button style={{ ...S.btnSmall, background: '#25D366', color: 'white' }} onClick={() => onRemind(customer)}>Remind</button>
                    </div>
                  </div>
                );
              })}
              {dashboard.unpaidList.length === 0 && <div style={{ color: '#c9b491', fontSize: 12 }}>Everyone's paid up! 🎉</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CustomersSection({ customers, loading, search, setSearch, totalCount, hasPrev, hasNext, onPrev, onNext, year, onOpen }) {
  return (
    <div>
      <div style={{ ...S.card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...S.input, flex: 1, minWidth: 180 }} placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ fontSize: 12, color: '#c9b491' }}>{totalCount !== null ? `${totalCount} customers in ${year}` : ''}</div>
      </div>
      <div style={S.card}>
        {loading && <div>Loading...</div>}
        {!loading && customers.map(c => {
          const elapsed = pongalElapsedMonths(c.scheme_year);
          const streak = pongalConsecutiveMissedStreak(c.paid_months, elapsed);
          return (
            <div key={c.id} style={S.row} onClick={() => onOpen(c.id)}>
              <div style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {c.name} <span style={{ color: '#c9b491', fontSize: 11 }}>• {c.card_number}</span>
                  {streak >= 3 && <span style={{ marginLeft: 6 }}><span style={S.badge('overdue')}>⚠ {streak} missed</span></span>}
                  {c.handover_done && <span style={{ marginLeft: 6 }}><span style={S.badge('paid')}>Handed over</span></span>}
                </div>
                <div style={{ fontSize: 11, color: '#c9b491' }}>{c.village} • {(c.paid_months || []).length}/{PONGAL_TOTAL_MONTHS} paid</div>
              </div>
            </div>
          );
        })}
        {!loading && customers.length === 0 && <div style={{ color: '#c9b491' }}>No customers found.</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <button style={S.btnGhost} disabled={!hasPrev} onClick={onPrev}>← Prev</button>
          <button style={S.btnGhost} disabled={!hasNext} onClick={onNext}>Next →</button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailSection({ detail, plan, selectedMonths, setSelectedMonths, payMode, setPayMode, payDate, setPayDate, payTime, setPayTime, onBack, onRecordPayment, onUndo, onHandover, onEdit, onRemind }) {
  if (!detail) return <div style={S.card}>Loading...</div>;
  const paymentsByMonth = new Map((detail.payments || []).map(p => [p.month_number, p]));
  const paidMonths = new Set(detail.paid_months || []);
  const elapsed = pongalElapsedMonths(detail.scheme_year);
  const streak = pongalConsecutiveMissedStreak(detail.paid_months, elapsed);
  const allPaid = paidMonths.size >= PONGAL_TOTAL_MONTHS;

  const toggleMonth = (m) => {
    if (paidMonths.has(m)) return;
    const next = new Set(selectedMonths);
    if (next.has(m)) next.delete(m); else next.add(m);
    setSelectedMonths(next);
  };
  const selectedTotal = selectedMonths.size * (plan?.monthly_amount || 0);

  return (
    <div>
      <button style={{ ...S.btnGhost, marginBottom: 12 }} onClick={onBack}>← Back to list</button>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f2a93b' }}>{detail.name}</div>
            <div style={{ fontSize: 12, color: '#c9b491' }}>{detail.card_number} • {detail.village} • Scheme year {detail.scheme_year}</div>
            <div style={{ fontSize: 12, color: '#c9b491' }}>📞 {detail.phone}</div>
            {streak >= 3 && <div style={{ marginTop: 6 }}><span style={S.badge('overdue')}>⚠ {streak} months missed in a row</span></div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={S.btnGhost} onClick={onEdit}>Edit</button>
            <button style={{ ...S.btnGhost, background: '#25D366', color: 'white', border: 'none' }} onClick={onRemind}>Remind</button>
            <a style={{ ...S.btnGhost, textDecoration: 'none', display: 'inline-block' }} href={`https://wa.me/91${detail.phone}`} target="_blank" rel="noreferrer">💬 Chat</a>
            <a style={{ ...S.btnGhost, textDecoration: 'none', display: 'inline-block' }} href={`tel:${detail.phone}`}>📞 Call</a>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: '#c9b491', marginBottom: 6 }}>{paidMonths.size}/{PONGAL_TOTAL_MONTHS} months paid</div>
          <div style={{ background: '#1b140f', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${(paidMonths.size / PONGAL_TOTAL_MONTHS) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#f2a93b,#d4841f)' }} />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h4 style={{ marginTop: 0 }}>12-Month Grid</h4>
        <div style={S.monthGrid}>
          {Array.from({ length: PONGAL_TOTAL_MONTHS }, (_, i) => i + 1).map(m => {
            const payment = paymentsByMonth.get(m);
            const state = payment ? 'paid' : 'unpaid';
            return (
              <div key={m} style={S.monthCell(state, selectedMonths.has(m))} onClick={() => toggleMonth(m)}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{monthName(m)}</div>
                {payment ? (
                  <div style={{ fontSize: 9, marginTop: 2 }}>{payment.paid_date}<br />{payment.paid_time}<br />{payment.mode === 'upi' ? 'Online' : 'Shop'}</div>
                ) : <div style={{ fontSize: 9, marginTop: 2 }}>Unpaid</div>}
              </div>
            );
          })}
        </div>

        {selectedMonths.size > 0 && (
          <div style={{ marginTop: 14, padding: 12, background: '#1b140f', borderRadius: 8 }}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Record payment for {selectedMonths.size} month(s) — ₹{selectedTotal.toLocaleString('en-IN')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select style={{ ...S.input, width: 'auto' }} value={payMode} onChange={e => setPayMode(e.target.value)}>
                <option value="cash">Cash (shop)</option>
                <option value="upi">UPI (online)</option>
              </select>
              <input type="date" style={{ ...S.input, width: 'auto' }} value={payDate} onChange={e => setPayDate(e.target.value)} />
              <input type="time" style={{ ...S.input, width: 'auto' }} value={payTime} onChange={e => setPayTime(e.target.value)} />
              <button style={S.btnPrimary} onClick={onRecordPayment}>Save Payment</button>
              <button style={S.btnGhost} onClick={() => setSelectedMonths(new Set())}>Clear</button>
            </div>
          </div>
        )}

        {Array.from(paidMonths).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: '#c9b491', marginBottom: 6 }}>Undo a recorded month:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[...paymentsByMonth.values()].filter(p => p.month_number <= PONGAL_TOTAL_MONTHS).map(p => (
                <button key={p.id} style={{ ...S.btnSmall, background: '#7f1d1d', color: '#fca5a5' }} onClick={() => onUndo(p.id)}>Undo {monthName(p.month_number)}</button>
              ))}
            </div>
          </div>
        )}

        {allPaid && !detail.handover_done && (
          <button style={{ ...S.btnPrimary, marginTop: 14, width: '100%' }} onClick={onHandover}>🎁 Record Package Handover</button>
        )}
        {detail.handover_done && (
          <div style={{ marginTop: 14 }}><span style={S.badge('paid')}>Package handed over</span></div>
        )}
      </div>
    </div>
  );
}

function AddCustomerSection({ form, setForm, onSubmit, saving, error, currentYear, onPickContact, contactPickerSupported }) {
  return (
    <form style={S.card} onSubmit={onSubmit}>
      <h3 style={{ marginTop: 0 }}>Add New Customer</h3>
      <button type="button" onClick={onPickContact} style={{ width: '100%', padding: 10, marginBottom: 6, background: '#1b140f', border: '1px dashed #f2a93b', borderRadius: 8, color: '#f2a93b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        📇 Pick from Contacts
      </button>
      {!contactPickerSupported && (
        <div style={{ fontSize: 10, color: '#8a7256', marginBottom: 14 }}>(Contacts picker only works in Chrome on Android)</div>
      )}
      {contactPickerSupported && <div style={{ marginBottom: 14 }} />}
      {error && <div style={{ color: '#fca5a5', marginBottom: 10, fontSize: 13 }}>{error}</div>}
      <label style={S.label}>Name *</label>
      <input style={S.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <div style={{ height: 10 }} />
      <label style={S.label}>Phone *</label>
      <input style={S.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
      <div style={{ height: 10 }} />
      <label style={S.label}>Village *</label>
      <input style={S.input} value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} />
      <div style={{ height: 10 }} />
      <label style={S.label}>Scheme Year *</label>
      <select style={S.input} value={form.scheme_year} onChange={e => setForm({ ...form, scheme_year: Number(e.target.value) })}>
        {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <div style={{ height: 10 }} />
      <label style={S.label}>Address (optional)</label>
      <input style={S.input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
      <div style={{ height: 10 }} />
      <label style={S.label}>Notes (optional)</label>
      <input style={S.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      <button type="submit" style={{ ...S.btnPrimary, marginTop: 16 }} disabled={saving}>{saving ? 'Saving...' : 'Add Customer'}</button>
    </form>
  );
}

function ApprovalsSection({ batches, onApprove, onReject }) {
  return (
    <div>
      {batches.length === 0 && <div style={S.card}>No UPI payments awaiting approval.</div>}
      {batches.map(b => (
        <div key={b.batch_id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{b.customer?.name || 'Unknown'} <span style={{ color: '#c9b491', fontSize: 11 }}>• {b.customer?.card_number}</span></div>
              <div style={{ fontSize: 12, color: '#c9b491' }}>
                Months: {b.payments.map(p => monthName(p.month_number)).join(', ')} • ₹{b.total_amount.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#c9b491' }}>UPI ref: {b.payments[0]?.upi_ref} • Submitted {b.payments[0]?.paid_date}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...S.btnSmall, background: '#14532d', color: '#86efac', padding: '8px 14px' }} onClick={() => onApprove(b.batch_id)}>Approve All</button>
              <button style={{ ...S.btnSmall, background: '#7f1d1d', color: '#fca5a5', padding: '8px 14px' }} onClick={() => onReject(b.batch_id)}>Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlansSection({ plans, form, setForm, onSave }) {
  return (
    <div>
      <form style={S.card} onSubmit={onSave}>
        <h3 style={{ marginTop: 0 }}>Create / Edit Yearly Plan</h3>
        <div style={{ fontSize: 12, color: '#c9b491', marginBottom: 10 }}>Changing the amount only affects unpaid months — already-recorded payments keep the amount they were paid at.</div>
        <label style={S.label}>Scheme Year</label>
        <input style={S.input} type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
        <div style={{ height: 10 }} />
        <label style={S.label}>Monthly Amount (₹)</label>
        <input style={S.input} type="number" value={form.monthly_amount} onChange={e => setForm({ ...form, monthly_amount: e.target.value })} />
        <div style={{ height: 10 }} />
        <label style={S.label}>Package Items (comma-separated)</label>
        <input style={S.input} value={form.package_items} onChange={e => setForm({ ...form, package_items: e.target.value })} placeholder="Rice 25kg, Oil 5L, Dal 2kg, Jaggery 1kg" />
        <button type="submit" style={{ ...S.btnPrimary, marginTop: 16 }}>Save Plan</button>
      </form>

      <div style={S.card}>
        <h4 style={{ marginTop: 0 }}>Existing Plans</h4>
        {plans.map(p => (
          <div key={p.id} style={S.row}>
            <div>
              <div style={{ fontWeight: 700 }}>{p.year} — ₹{p.monthly_amount}/month</div>
              <div style={{ fontSize: 11, color: '#c9b491' }}>{(p.package_items || []).join(', ') || 'No package items listed'}</div>
            </div>
            <button style={S.btnGhost} onClick={() => setForm({ year: p.year, monthly_amount: p.monthly_amount, package_items: (p.package_items || []).join(', ') })}>Edit</button>
          </div>
        ))}
        {plans.length === 0 && <div style={{ color: '#c9b491' }}>No plans created yet.</div>}
      </div>
    </div>
  );
}

function ReportsSection({ year, month, setMonth, onDownload }) {
  return (
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>Reports</h3>
      <div style={{ marginBottom: 14 }}>
        <label style={S.label}>Month (for monthly report)</label>
        <select style={{ ...S.input, width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {Array.from({ length: PONGAL_TOTAL_MONTHS }, (_, i) => i + 1).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button style={S.btnPrimary} onClick={() => onDownload('month')}>📥 Download {monthName(month)} {year} CSV</button>
        <button style={S.btnPrimary} onClick={() => onDownload('year')}>📥 Download Full {year} CSV</button>
      </div>
    </div>
  );
}

function RulesSection({ whatsappNote, setWhatsappNote, onSave, saved }) {
  return (
    <div>
      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>Scheme Rules</h3>
        <ul style={{ fontSize: 13, color: '#e8d5b7', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Pay 12 months continuously to receive the full grocery package at Pongal.</li>
          <li>Payment window: between the 5th and 20th of each month.</li>
          <li>Missing 3 months in a row puts the account at risk of removal from the scheme.</li>
          <li>No cash refunds — the scheme pays out in goods only.</li>
        </ul>
      </div>
      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>WhatsApp Quick Note</h3>
        <div style={{ fontSize: 12, color: '#c9b491', marginBottom: 8 }}>Appended to every payment/reminder message sent from this scheme.</div>
        <textarea style={{ ...S.input, minHeight: 80 }} value={whatsappNote} onChange={e => setWhatsappNote(e.target.value)} />
        <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={onSave}>Save Note</button>
        {saved && <span style={{ marginLeft: 10, color: '#86efac', fontSize: 12 }}>Saved!</span>}
      </div>
    </div>
  );
}

export default PongalFund;
