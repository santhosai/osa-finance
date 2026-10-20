import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_URL } from '../config';
import { THERMAL_COMMANDS, printViaBluetooth } from '../utils/thermalPrint';
import {
  EN_MONTHS, formatRs, todayISO, schemeYM, schemeMonthKey, schemeMonthLabel, monthKeyLabel,
  currentSchemeMonth, memberMonthStatus, paidMonths, missedMonths, isLatePayment,
  bonusEligible, isCompleted, whatsappLink, receiptMessage, reminderMessage, handoverMessage, downloadCSV
} from '../utils/schemeHelpers';

// Savings Schemes: one module for every goods-savings scheme (Diwali, Pongal, ...).
// Admin creates a scheme, enrols members, records monthly payments, sends WhatsApp
// receipts/reminders, hands over items at the end and downloads reports.

const CSS = `
.ss{min-height:100vh;background:#160f11;color:#f3e8e4;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px}
.ss *{box-sizing:border-box}
.ss-head{background:#5c0f1b;padding:12px 16px 0;position:sticky;top:0;z-index:20}
.ss-head-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.ss-title{font-size:18px;font-weight:800}
.ss-title small{display:block;font-size:12px;font-weight:600;color:#f0b23a}
.ss-facts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ss-fact{background:rgba(255,241,222,.12);border-radius:8px;padding:4px 10px;font-size:11px}
.ss-fact b{display:block;font-size:14px}
.ss-tabs{display:flex;gap:2px;overflow-x:auto;margin-top:10px;scrollbar-width:none}
.ss-tabs::-webkit-scrollbar{display:none}
.ss-tab{background:none;border:0;color:#fff1de;opacity:.75;padding:9px 13px;font-weight:700;font-size:13px;cursor:pointer;border-radius:10px 10px 0 0;white-space:nowrap}
.ss-tab.on{background:#160f11;opacity:1}
.ss-body{padding:14px 16px 60px;max-width:1150px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.ss-card{background:#1f1518;border:1px solid #3a2a2e;border-radius:12px;padding:14px;min-width:0}
.ss-card h3{margin:0 0 10px;font-size:15px}
.ss-hint{color:#b9a5a8;font-size:12px}
.ss-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ss-spread{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.ss-btn{border:1px solid #4a3439;background:#2a1d21;color:#f3e8e4;border-radius:8px;padding:7px 12px;font-weight:600;font-size:13px;cursor:pointer}
.ss-btn:disabled{opacity:.5;cursor:not-allowed}
.ss-btn.pri{background:#f0b23a;border-color:#f0b23a;color:#2b1a00}
.ss-btn.wa{background:#1f9d55;border-color:#1f9d55;color:#fff}
.ss-btn.red{background:#3a1a17;border-color:#5a2520;color:#f08a7c}
.ss-btn.sm{padding:4px 9px;font-size:12px}
.ss-select,.ss-input{background:#160f11;border:1px solid #4a3439;color:#f3e8e4;border-radius:8px;padding:8px 10px;font-size:13px;width:100%}
.ss-months{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:4px}
.ss-mo{border:1px solid #3a2a2e;background:#1f1518;color:#f3e8e4;border-radius:8px;padding:5px 2px;text-align:center;cursor:pointer}
.ss-mo small{display:block;font-size:10px;color:#b9a5a8}
.ss-mo b{font-size:12px}
.ss-mo .bar{height:4px;border-radius:2px;background:#2a1d21;margin:4px 4px 0;overflow:hidden}
.ss-mo .bar i{display:block;height:100%;background:#5fcf8c}
.ss-mo.on{border-color:#f0b23a;box-shadow:inset 0 0 0 1.5px #f0b23a}
.ss-mo.now small{color:#f0b23a;font-weight:700}
.ss-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.ss-stat{background:#1f1518;border:1px solid #3a2a2e;border-radius:12px;padding:10px 12px}
.ss-stat span{font-size:11px;color:#b9a5a8;display:block}
.ss-stat b{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.ss-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ss-list{display:flex;flex-direction:column;gap:6px}
.ss-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:#2a1d21;flex-wrap:wrap}
.ss-item.paid{background:#173323}
.ss-item.unpaid{background:#3a1a17}
.ss-item.off{opacity:.55}
.ss-who{min-width:0;cursor:pointer}
.ss-who b{font-size:13px}
.ss-who small{display:block;color:#b9a5a8;font-size:11px}
.ss-pill{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.ss-pill.good{background:#173323;color:#5fcf8c}
.ss-pill.bad{background:#3a1a17;color:#f08a7c}
.ss-pill.warn{background:#3a2a12;color:#f3b552}
.ss-pill.gold{background:#3a2a12;color:#ffd27a}
.ss-pill.grey{background:#2a1d21;color:#b9a5a8}
.ss mark{background:#f0b23a;color:#2b1a00;border-radius:2px;padding:0 1px}
.ss-dots{display:inline-flex;gap:3px;flex-wrap:wrap}
.ss-dots i{width:9px;height:9px;border-radius:2px;background:#3a2a2e}
.ss-dots i.paid{background:#5fcf8c}
.ss-dots i.missed{background:#f08a7c}
.ss-dots i.due{background:#f3b552}
.ss-table{overflow-x:auto}
.ss-table table{border-collapse:collapse;width:100%;font-size:13px}
.ss-table th,.ss-table td{text-align:left;padding:7px 9px;border-bottom:1px solid #3a2a2e;white-space:nowrap}
.ss-table th{font-size:11px;color:#b9a5a8;text-transform:uppercase;letter-spacing:.05em}
.ss-table .r{text-align:right}
.ss-table tr.click{cursor:pointer}
.ss-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ss-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.ss-field label{font-size:11px;font-weight:700;color:#b9a5a8}
.ss-full{grid-column:1/-1}
.ss-gifts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.ss-gift{background:#2a1d21;border-radius:10px;padding:10px}
.ss-gift .q{font-size:22px;font-weight:800;color:#ffd27a}
.ss-chips{display:flex;gap:6px;flex-wrap:wrap}
.ss-chip{display:inline-flex;gap:5px;align-items:center;font-size:12px;border:1px solid #4a3439;border-radius:999px;padding:3px 10px;cursor:pointer;background:#1f1518;color:#f3e8e4}
.ss-chip.on{background:#173323;border-color:#2c5a3d;color:#5fcf8c}
.ss-chip:disabled{opacity:.45;cursor:not-allowed}
.ss-grid12{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:6px}
.ss-cell{border-radius:8px;padding:7px 4px;text-align:center;border:1px solid #3a2a2e;background:#2a1d21;cursor:pointer;color:#f3e8e4}
.ss-cell.paid{background:#173323;border-color:transparent;color:#5fcf8c;cursor:default}
.ss-cell.missed{background:#3a1a17;border-color:transparent;color:#f08a7c}
.ss-cell.sel{box-shadow:inset 0 0 0 2px #f0b23a}
.ss-cell small{display:block;font-size:10px}
.ss-scrim{position:fixed;inset:0;background:rgba(10,4,6,.7);display:flex;align-items:center;justify-content:center;padding:14px;z-index:100}
.ss-dialog{background:#1f1518;border:1px solid #4a3439;border-radius:14px;width:100%;max-width:520px;max-height:90vh;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.ss-msg{white-space:pre-wrap;background:#e7f7ec;color:#16301f;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5}
.ss-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#f3e8e4;color:#160f11;padding:9px 16px;border-radius:999px;font-weight:600;z-index:200}
.ss-mcard{background:#2a1d21;border-radius:10px;padding:10px 12px;cursor:pointer;border-left:3px solid #f0b23a;display:flex;flex-direction:column;gap:6px}
.ss-mcard:hover{background:#33242a}
.ss-mcard.behind{border-left-color:#f08a7c}
.ss-mcard.done{border-left-color:#5fcf8c;background:#173323}
.ss-mcard.off{opacity:.55;border-left-color:#6b5a5e}
.ss-prog{background:#3a2a2e;border-radius:4px;height:5px;overflow:hidden}
.ss-prog i{display:block;height:100%;border-radius:4px}
.ss-section-label{font-size:11px;font-weight:700;color:#b9a5a8;letter-spacing:.05em;margin:14px 0 6px}
.ss-dhead{margin:-16px -16px 0;padding:16px;border-radius:14px 14px 0 0;color:#fff}
.ss-dsub{font-size:11px;color:rgba(255,255,255,.8);margin-top:3px}
.ss-dbox{margin-top:10px;padding:8px 10px;background:rgba(0,0,0,.25);border-radius:8px;font-size:12px;color:#fde68a}
.ss-tchip{display:flex;flex-direction:column;align-items:center;min-width:64px;padding:5px 6px;border-radius:8px;border:1px solid #3a2a2e;background:#2a1d21;cursor:pointer}
.ss-tchip b{font-size:10px}
.ss-tchip span{font-size:10px}
.ss-tchip small{font-size:9px;color:#b9a5a8}
.ss-tchip.paid{background:#173323;border-color:#2c5a3d;cursor:default}
.ss-tchip.paid small{color:#5fcf8c}
.ss-tchip.missed{background:#3a1a17;border-color:#5a2520}
.ss-tchip.missed small{color:#f08a7c}
.ss-tchip.due{border-color:#f0b23a}
.ss-tchip.due small{color:#f0b23a;font-weight:700}
.ss-tchip.sel{box-shadow:inset 0 0 0 2px #f0b23a;background:#3a2a12}
.ss-hist{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 9px;background:#160f11;border:1px solid #1f3b2a;border-radius:8px;font-size:12px;flex-wrap:wrap}
.ss-total{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:7px 10px;background:#160f11;border:1px solid #3a2a2e;border-radius:8px;font-size:12px;color:#b9a5a8}
.ss-total b{font-size:14px;color:#f3e8e4}
.ss-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px}
@media (max-width:760px){.ss-cols{grid-template-columns:1fr}.ss-form{grid-template-columns:1fr}}
`;

const TABS = [
  ['dashboard', 'Dashboard'], ['collection', 'Monthly collection'], ['members', 'Members'],
  ['handover', 'Items & handover'], ['setup', 'Scheme setup'], ['reports', 'Reports']
];

const emptyScheme = () => ({
  name: '', name_ta: '', run_by: 'Om Sai Murugan Finance', amount: '', months: 12,
  start_month: todayISO().slice(0, 7), window_from: 1, window_to: 10, card_prefix: '',
  collectors: localStorage.getItem('userName') || 'Admin',
  items: [{ name: '', name_ta: '', per: 1, unit: '' }],
  bonus: { name: '', name_ta: '', join_month: '' }, whatsapp_note: '', status: 'open'
});

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function highlight(name, term) {
  if (term.length < 3) return name;
  const i = name.toLowerCase().indexOf(term);
  if (i < 0) return name;
  return <>{name.slice(0, i)}<mark>{name.slice(i, i + term.length)}</mark>{name.slice(i + term.length)}</>;
}

function SavingsSchemes() {
  const adminName = localStorage.getItem('userName') || 'Admin';
  const [schemes, setSchemes] = useState([]);
  const [schemeId, setSchemeId] = useState(() => localStorage.getItem('savingsSchemeId') || '');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [pickedMonth, setPickedMonth] = useState({});     // month chosen per scheme id
  const [search, setSearch] = useState({});
  const [toast, setToast] = useState('');
  const [payDialog, setPayDialog] = useState(null);       // { member, months:Set }
  const [msgDialog, setMsgDialog] = useState(null);       // { title, text, phone }
  const [memberId, setMemberId] = useState(null);         // member detail dialog
  const [memberSel, setMemberSel] = useState(new Set());  // months picked in member dialog
  const [memberEdit, setMemberEdit] = useState(null);     // member edit form
  const [remindQueue, setRemindQueue] = useState(null);   // { list, index }
  const [schemeForm, setSchemeForm] = useState(null);     // create/edit form
  const [saving, setSaving] = useState(false);

  const scheme = schemes.find(s => s.id === schemeId) || null;
  const currentMonth = scheme ? currentSchemeMonth(scheme) : 0;

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2200); };

  const loadSchemes = useCallback(async () => {
    try {
      const list = await api('/schemes');
      setSchemes(list);
      setSchemeId(prev => (list.some(s => s.id === prev) ? prev : (list[0]?.id || '')));
      if (!list.length) { setSchemeForm(emptyScheme()); setTab('setup'); }
    } catch (e) { showToast(e.message); }
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async (id) => {
    if (!id) { setMembers([]); return; }
    try { setMembers(await api(`/schemes/${id}/members`)); } catch (e) { showToast(e.message); }
  }, []);

  useEffect(() => { loadSchemes(); }, [loadSchemes]);
  useEffect(() => {
    if (!schemeId) return;
    localStorage.setItem('savingsSchemeId', schemeId);
    loadMembers(schemeId);
  }, [schemeId, loadMembers]);
  // Until a month is picked, show this month of the scheme (clamped to its range)
  const viewMonth = scheme
    ? Math.min(Math.max(pickedMonth[scheme.id] || currentMonth, 1), scheme.months)
    : 1;
  const setViewMonth = (i) => setPickedMonth(p => ({ ...p, [schemeId]: i }));

  const active = useMemo(() => members.filter(m => m.status !== 'withdrawn'), [members]);
  const replaceMember = (m) => setMembers(list => list.map(x => (x.id === m.id ? m : x)));

  const filterBy = (list, key) => {
    const term = (search[key] || '').trim().toLowerCase();
    if (term.length < 3) return list;
    return list.filter(m => m.name_lower?.includes(term) || m.name.toLowerCase().includes(term)
      || String(m.card_number).toLowerCase().includes(term) || String(m.phone).includes(term));
  };
  const searchBox = (key, placeholder = 'Search name, card or phone (3 letters)') => (
    <input className="ss-input" value={search[key] || ''} placeholder={placeholder}
      onChange={e => setSearch(s => ({ ...s, [key]: e.target.value }))} />
  );
  const termOf = (key) => (search[key] || '').trim().toLowerCase();

  // ---------- Actions ----------
  const openPay = (member, months) => setPayDialog({
    member, months: new Set(months), date: todayISO(), mode: 'Cash',
    collected_by: localStorage.getItem('schemeCollector') || scheme.collectors[0]
  });

  const savePayment = async () => {
    const { member, months, date, mode, collected_by } = payDialog;
    if (!months.size) { showToast('Choose at least one month'); return; }
    setSaving(true);
    try {
      const updated = await api(`/schemes/${scheme.id}/members/${member.id}/payments`, {
        method: 'POST', body: { months: [...months], date, mode, collected_by, recorded_by: adminName }
      });
      localStorage.setItem('schemeCollector', collected_by);
      replaceMember(updated);
      setPayDialog(null);
      setMsgDialog({ title: 'Payment saved · send receipt', text: receiptMessage(scheme, updated, [...months]), phone: updated.phone });
    } catch (e) { showToast(e.message); }
    setSaving(false);
  };

  const undoPayment = async (member, month) => {
    if (!window.confirm(`Undo ${schemeMonthLabel(scheme, month)} payment for ${member.name}?`)) return;
    try {
      await api(`/schemes/${scheme.id}/members/${member.id}/payments/${month}`, { method: 'DELETE' });
      const payments = { ...member.payments };
      delete payments[month];
      replaceMember({ ...member, payments });
      showToast('Payment removed');
    } catch (e) { showToast(e.message); }
  };

  // ---------- Receipts (same two options as Festival Fund: browser print / Bluetooth thermal) ----------
  const receiptRows = (member, i) => {
    const p = member.payments[i];
    return [
      ['Card', member.card_number], ['Name', member.name], ['Mobile', member.phone],
      ['Scheme', scheme.name], ['Month', `${schemeMonthLabel(scheme, i)} (${i}/${scheme.months})`],
      ['Amount', formatRs(p.amount)], ['Mode', p.mode], ['Date', p.date.split('-').reverse().join('/')],
      ['Paid so far', `${paidMonths(member).length}/${scheme.months} months`]
    ];
  };

  const printReceipt = (member, i) => {
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = receiptRows(member, i).map(([k, v]) => `<div class="row"><span>${esc(k)}:</span><span class="bold">${esc(v)}</span></div>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:80mm auto;margin:4mm}body{font-family:Arial,sans-serif;font-size:11px;color:#000;text-align:center}
h2{font-size:13px;margin:4px 0}.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:3px 0;text-align:left}.bold{font-weight:700;text-align:right}
</style></head><body><h2>${esc(scheme.run_by || 'OM SAI MURUGAN FINANCE')}</h2>
<div class="line"></div><div class="bold" style="text-align:center;font-size:12px">${esc(scheme.name_ta || scheme.name)}<br>PAYMENT RECEIPT</div><div class="line"></div>
${rows}<div class="line"></div>${scheme.whatsapp_note ? `<div style="font-size:10px">${esc(scheme.whatsapp_note)}</div>` : ''}<div style="font-size:10px">Thank you! 🙏</div></body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* already removed */ } }, 2000);
    }, 600);
  };

  // Thermal printers have no Tamil font, so only ASCII text goes to the printer
  const printReceiptBluetooth = (member, i) => {
    const ascii = (s) => String(s ?? '').replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E]/g, '').trim();
    const T = THERMAL_COMMANDS;
    let r = T.INIT + T.ALIGN_CENTER + T.BOLD_ON + T.DOUBLE_HEIGHT;
    r += `${ascii(scheme.run_by || 'OM SAI MURUGAN FINANCE').toUpperCase()}\n`;
    r += T.NORMAL_SIZE + T.BOLD_OFF + T.LINE + T.BOLD_ON + `** ${ascii(scheme.name).toUpperCase()} **\n` + T.BOLD_OFF + T.LINE + T.ALIGN_LEFT;
    receiptRows(member, i).forEach(([k, v]) => {
      r += k === 'Amount' ? T.BOLD_ON + `${k}: ${ascii(v)}\n` + T.BOLD_OFF : `${k}: ${ascii(v)}\n`;
    });
    r += T.LINE + T.ALIGN_CENTER + 'Thank you!\n' + T.FEED + T.PARTIAL_CUT;
    printViaBluetooth(r);
  };

  const setHandover = async (member, key, given) => {
    try {
      const date = todayISO();
      await api(`/schemes/${scheme.id}/members/${member.id}/handover`, { method: 'PUT', body: { key, given, date, given_by: adminName } });
      const handover = { ...(member.handover || {}) };
      if (given) handover[key] = { date, given_by: adminName }; else delete handover[key];
      replaceMember({ ...member, handover });
    } catch (e) { showToast(e.message); }
  };

  const updateMember = async (member, fields, okText) => {
    try {
      const updated = await api(`/schemes/${scheme.id}/members/${member.id}`, { method: 'PUT', body: fields });
      replaceMember(updated);
      if (okText) showToast(okText);
      return true;
    } catch (e) { showToast(e.message); return false; }
  };

  const openMember = (id) => { setMemberId(id); setMemberSel(new Set()); setMemberEdit(null); };

  const deleteMember = async (member) => {
    if (!window.confirm(`Delete ${member.name} (${member.card_number})? Use this only for a member added by mistake.`)) return;
    try {
      await api(`/schemes/${scheme.id}/members/${member.id}`, { method: 'DELETE' });
      setMembers(list => list.filter(x => x.id !== member.id));
      setMemberId(null);
      showToast('Member deleted');
    } catch (e) { showToast(e.message); }
  };

  const saveScheme = async (form) => {
    setSaving(true);
    try {
      const body = { ...form, items: form.items.filter(it => String(it.name || '').trim()), bonus: form.bonus?.name ? form.bonus : null };
      if (form.id) {
        await api(`/schemes/${form.id}`, { method: 'PUT', body });
        showToast('Scheme saved');
      } else {
        const created = await api('/schemes', { method: 'POST', body });
        setSchemeId(created.id);
        showToast('Scheme created');
      }
      setSchemeForm(null);
      await loadSchemes();
      setTab('dashboard');
    } catch (e) { showToast(e.message); }
    setSaving(false);
  };

  const deleteScheme = async () => {
    if (!window.confirm(`Delete "${scheme.name}"? This works only when it has no members.`)) return;
    try {
      await api(`/schemes/${scheme.id}`, { method: 'DELETE' });
      setSchemeId('');
      setSchemeForm(null);
      await loadSchemes();
      showToast('Scheme deleted');
    } catch (e) { showToast(e.message); }
  };

  // ---------- Render ----------
  if (loading) return <div className="ss"><style>{CSS}</style><div className="ss-body">Loading…</div></div>;

  const header = (
    <div className="ss-head">
      <div className="ss-head-top">
        <div className="ss-title">
          <small>{scheme ? (scheme.name_ta || 'Savings Scheme') : 'Savings Schemes'}</small>
          {scheme ? scheme.name : 'Create your first scheme'}
        </div>
        <div className="ss-row">
          {schemes.length > 0 && (
            <select className="ss-select" style={{ width: 'auto' }} value={schemeId} onChange={e => { setSchemeId(e.target.value); setSchemeForm(null); }}>
              {schemes.map(s => <option key={s.id} value={s.id}>{s.name}{s.status === 'closed' ? ' (closed)' : ''}</option>)}
            </select>
          )}
          <button className="ss-btn sm" onClick={() => { setSchemeForm(emptyScheme()); setTab('setup'); }}>+ New scheme</button>
          <button className="ss-btn sm" onClick={() => { localStorage.removeItem('selectedModule'); window.location.reload(); }}>Modules</button>
        </div>
      </div>
      {scheme && (
        <div className="ss-facts">
          <div className="ss-fact"><b>{formatRs(scheme.amount)}</b>per month</div>
          <div className="ss-fact"><b>{scheme.months}</b>months</div>
          <div className="ss-fact"><b>{schemeMonthLabel(scheme, 1)} – {schemeMonthLabel(scheme, scheme.months)}</b>period</div>
          <div className="ss-fact"><b>{scheme.window_from}–{scheme.window_to}</b>pay days</div>
          <div className="ss-fact"><b>{active.length}</b>members</div>
        </div>
      )}
      <div className="ss-tabs">
        {TABS.filter(([k]) => scheme || k === 'setup').map(([k, label]) => (
          <button key={k} className={`ss-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="ss">
      <style>{CSS}</style>
      {header}
      <div className="ss-body">
        {!scheme && !schemeForm && <div className="ss-card">No scheme yet. Tap <b>+ New scheme</b> to create one.</div>}
        {scheme && tab === 'dashboard' && renderDashboard()}
        {scheme && tab === 'collection' && renderCollection()}
        {scheme && tab === 'members' && renderMembers()}
        {scheme && tab === 'handover' && renderHandover()}
        {tab === 'setup' && renderSetup()}
        {scheme && tab === 'reports' && renderReports()}
      </div>
      {payDialog && renderPayDialog()}
      {msgDialog && renderMsgDialog()}
      {memberId && renderMemberDialog()}
      {remindQueue && renderRemindQueue()}
      {toast && <div className="ss-toast">{toast}</div>}
    </div>
  );

  // ---------- Sections ----------
  function monthStrip() {
    return (
      <div className="ss-months">
        {Array.from({ length: scheme.months }, (_, k) => k + 1).map(i => {
          const { y, m } = schemeYM(scheme, i);
          const paid = active.filter(mem => mem.payments?.[i]).length;
          const pct = active.length ? Math.round((paid / active.length) * 100) : 0;
          return (
            <button key={i} className={`ss-mo ${viewMonth === i ? 'on' : ''} ${currentMonth === i ? 'now' : ''}`} onClick={() => setViewMonth(i)} title={`${paid} of ${active.length} paid`}>
              <small>{currentMonth === i ? 'This month' : `${i}/${scheme.months}`}</small>
              <b>{EN_MONTHS[m - 1]} ’{String(y).slice(2)}</b>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderDashboard() {
    const paid = active.filter(m => m.payments?.[viewMonth]);
    const unpaid = active.filter(m => !m.payments?.[viewMonth]);
    const late = paid.filter(m => isLatePayment(scheme, viewMonth, m.payments[viewMonth]));
    const savedTotal = active.reduce((sum, m) => sum + Object.values(m.payments || {}).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
    const behind = active.filter(m => missedMonths(scheme, m, currentMonth).length >= 2);
    const eligible = active.filter(m => bonusEligible(scheme, m));
    const byCollector = {};
    paid.forEach(m => {
      const p = m.payments[viewMonth];
      const row = byCollector[p.collected_by] || (byCollector[p.collected_by] = { cash: 0, upi: 0 });
      if (p.mode === 'UPI') row.upi += Number(p.amount || 0); else row.cash += Number(p.amount || 0);
    });
    const statusLine = currentMonth < 1
      ? `Starts ${schemeMonthLabel(scheme, 1)}`
      : currentMonth > scheme.months ? 'All months are over' : `This month is ${currentMonth} of ${scheme.months}`;
    return (
      <>
        <div className="ss-card">
          <div className="ss-spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{schemeMonthLabel(scheme, viewMonth)} · month {viewMonth}</h3>
            <span className="ss-hint">{statusLine} · pay between {scheme.window_from}–{scheme.window_to}</span>
          </div>
          {monthStrip()}
        </div>
        <div className="ss-stats">
          <div className="ss-stat"><span>Active members</span><b>{active.length}</b></div>
          <div className="ss-stat"><span>Collected · {schemeMonthLabel(scheme, viewMonth)}</span><b style={{ color: '#5fcf8c' }}>{formatRs(paid.reduce((a, m) => a + Number(m.payments[viewMonth].amount || 0), 0))}</b></div>
          <div className="ss-stat"><span>Pending · {paid.length}/{active.length} paid</span><b style={{ color: '#f08a7c' }}>{formatRs(unpaid.length * scheme.amount)}</b></div>
          <div className="ss-stat"><span>Paid late (after {scheme.window_to}th)</span><b style={{ color: '#f3b552' }}>{late.length}</b></div>
          <div className="ss-stat"><span>Total saved so far</span><b>{formatRs(savedTotal)}</b></div>
        </div>
        <div className="ss-cols">
          <div className="ss-card">
            <h3>Needs attention ({behind.length})</h3>
            <div className="ss-list">
              {behind.map(m => (
                <div key={m.id} className="ss-item unpaid">
                  <div className="ss-who" onClick={() => openMember(m.id)}><b>{m.name}</b><small>{m.card_number} · {paidMonths(m).length}/{scheme.months} paid</small></div>
                  <span className="ss-pill bad">{missedMonths(scheme, m, currentMonth).length} months missed</span>
                </div>
              ))}
              {!behind.length && <div className="ss-hint">Nobody has missed 2 or more months.</div>}
            </div>
          </div>
          <div className="ss-card">
            <h3>Collected by · {schemeMonthLabel(scheme, viewMonth)}</h3>
            <div className="ss-table"><table>
              <thead><tr><th>Collector</th><th className="r">Cash</th><th className="r">UPI</th><th className="r">Total</th></tr></thead>
              <tbody>
                {Object.entries(byCollector).map(([who, r]) => (
                  <tr key={who}><td>{who}</td><td className="r">{formatRs(r.cash)}</td><td className="r">{formatRs(r.upi)}</td><td className="r"><b>{formatRs(r.cash + r.upi)}</b></td></tr>
                ))}
                {!Object.keys(byCollector).length && <tr><td colSpan="4" className="ss-hint">No payments for this month yet.</td></tr>}
              </tbody>
            </table></div>
            {scheme.bonus && (
              <p className="ss-hint" style={{ marginBottom: 0 }}>
                {scheme.bonus.name} offer: <b>{eligible.length}</b> eligible, <b>{eligible.filter(m => m.handover?.bonus).length}</b> given.
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderCollection() {
    const paid = active.filter(m => m.payments?.[viewMonth]);
    const unpaid = active.filter(m => !m.payments?.[viewMonth]);
    const pk = `${scheme.id}-${viewMonth}-paid`, uk = `${scheme.id}-${viewMonth}-unpaid`;
    const shownPaid = filterBy(paid, pk), shownUnpaid = filterBy(unpaid, uk);
    return (
      <>
        <div className="ss-card">
          <div className="ss-spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{schemeMonthLabel(scheme, viewMonth)} collection</h3>
            {viewMonth > currentMonth && <span className="ss-pill warn">Advance month</span>}
          </div>
          {monthStrip()}
        </div>
        <div className="ss-cols">
          <div className="ss-card">
            <h3 style={{ color: '#5fcf8c' }}>✓ Paid ({paid.length})</h3>
            {paid.length > 0 && searchBox(pk)}
            <div className="ss-list" style={{ marginTop: 8 }}>
              {shownPaid.map(m => {
                const p = m.payments[viewMonth];
                return (
                  <div key={m.id} className="ss-item paid">
                    <div className="ss-who" onClick={() => openMember(m.id)}>
                      <b>{highlight(m.name, termOf(pk))}</b>
                      <small>{m.card_number} · {p.date} · {p.mode} · {p.collected_by}</small>
                    </div>
                    <div className="ss-row">
                      {isLatePayment(scheme, viewMonth, p) && <span className="ss-pill warn">Late</span>}
                      <button className="ss-btn sm wa" onClick={() => setMsgDialog({ title: 'Receipt', text: receiptMessage(scheme, m, [viewMonth]), phone: m.phone })}>Receipt</button>
                      <button className="ss-btn sm red" onClick={() => undoPayment(m, viewMonth)}>Undo</button>
                    </div>
                  </div>
                );
              })}
              {paid.length > 0 && !shownPaid.length && <div className="ss-hint">No match.</div>}
              {!paid.length && <div className="ss-hint">No one has paid for this month yet.</div>}
            </div>
          </div>
          <div className="ss-card">
            <div className="ss-spread" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: '#f08a7c' }}>✗ Not paid ({unpaid.length})</h3>
              {unpaid.length > 0 && <button className="ss-btn sm wa" onClick={() => setRemindQueue({ list: shownUnpaid, index: 0 })}>Remind all ({shownUnpaid.length})</button>}
            </div>
            {unpaid.length > 0 && searchBox(uk)}
            <div className="ss-list" style={{ marginTop: 8 }}>
              {shownUnpaid.map(m => (
                <div key={m.id} className="ss-item unpaid">
                  <div className="ss-who" onClick={() => openMember(m.id)}>
                    <b>{highlight(m.name, termOf(uk))}</b>
                    <small>{m.card_number} · {m.village || m.phone} · {paidMonths(m).length}/{scheme.months} paid</small>
                  </div>
                  <div className="ss-row">
                    <button className="ss-btn sm" onClick={() => setMsgDialog({ title: 'Reminder', text: reminderMessage(scheme, m, [viewMonth]), phone: m.phone })}>Remind</button>
                    <button className="ss-btn sm pri" onClick={() => openPay(m, [viewMonth])}>Mark paid</button>
                  </div>
                </div>
              ))}
              {unpaid.length > 0 && !shownUnpaid.length && <div className="ss-hint">No match.</div>}
              {!unpaid.length && <div className="ss-hint">Everyone has paid. 🎉</div>}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Member card, same layout as Festival Fund: name + badges, phone, paid/total, progress bar
  function memberCard(m) {
    const paid = paidMonths(m).length;
    const pct = Math.round((paid / scheme.months) * 100);
    const missed = missedMonths(scheme, m, currentMonth).length;
    const done = paid >= scheme.months;
    const cls = m.status === 'withdrawn' ? 'off' : done ? 'done' : missed >= 2 ? 'behind' : '';
    return (
      <div key={m.id} className={`ss-mcard ${cls}`} onClick={() => openMember(m.id)}>
        <div className="ss-spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {highlight(m.name, termOf('members'))}
              <span className="ss-pill grey" style={{ marginLeft: 6 }}>{m.card_number}</span>
              {missed >= 2 && m.status !== 'withdrawn' && <span title={`${missed} months missed`} style={{ marginLeft: 5 }}>⚠️</span>}
              {bonusEligible(scheme, m) && <span title={`${scheme.bonus.name} ${m.handover?.bonus ? 'given' : 'due'}`} style={{ marginLeft: 4 }}>{m.handover?.bonus ? '🎁' : '🎀'}</span>}
              {m.status === 'withdrawn' && <span className="ss-pill grey" style={{ marginLeft: 6 }}>Withdrawn</span>}
            </div>
            <div className="ss-hint" style={{ fontSize: 11, marginTop: 2 }}>📞 {m.phone}{m.village ? ` | ${m.village}` : ''} | Joined {monthKeyLabel(m.join_month)}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: done ? '#5fcf8c' : '#f0b23a' }}>{paid}/{scheme.months}</div>
            <div className="ss-hint" style={{ fontSize: 10 }}>months</div>
          </div>
        </div>
        {!done && (
          <div>
            <div className="ss-spread" style={{ marginBottom: 3 }}>
              <span className="ss-hint" style={{ fontSize: 10 }}>{formatRs(paid * scheme.amount)} paid · {formatRs((scheme.months - paid) * scheme.amount)} left</span>
              <span style={{ fontSize: 10, color: '#f0b23a' }}>{pct}%</span>
            </div>
            <div className="ss-prog"><i style={{ width: `${pct}%`, background: missed >= 2 ? '#f08a7c' : '#f0b23a' }} /></div>
          </div>
        )}
      </div>
    );
  }

  function renderMembers() {
    const shown = filterBy(members, 'members');
    const inProgress = shown.filter(m => m.status !== 'withdrawn' && !isCompleted(scheme, m));
    const completed = shown.filter(m => m.status !== 'withdrawn' && isCompleted(scheme, m));
    const withdrawn = shown.filter(m => m.status === 'withdrawn');
    return (
      <>
        <AddMemberForm scheme={scheme} onAdded={(m) => { setMembers(list => [...list, m]); showToast(`Added ${m.name} · ${m.card_number}`); }} onError={showToast} />
        <div className="ss-card">
          <div className="ss-spread" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Members ({active.length})</h3>
            <div style={{ minWidth: 0, flex: '0 1 300px' }}>{searchBox('members')}</div>
          </div>
          <div className="ss-list">{inProgress.map(memberCard)}</div>
          {completed.length > 0 && (
            <>
              <div className="ss-section-label" style={{ color: '#5fcf8c' }}>🎊 COMPLETED MEMBERS ({completed.length})</div>
              <div className="ss-list">{completed.map(memberCard)}</div>
            </>
          )}
          {withdrawn.length > 0 && (
            <>
              <div className="ss-section-label">WITHDRAWN ({withdrawn.length})</div>
              <div className="ss-list">{withdrawn.map(memberCard)}</div>
            </>
          )}
          {!members.length && <div className="ss-hint" style={{ textAlign: 'center', padding: 24 }}>No members yet. Add the first one above.</div>}
          {members.length > 0 && !shown.length && <div className="ss-hint">No match.</div>}
        </div>
      </>
    );
  }

  function renderHandover() {
    const completed = active.filter(m => isCompleted(scheme, m));
    const eligible = active.filter(m => bonusEligible(scheme, m));
    const list = filterBy(active, 'handover').filter(m => isCompleted(scheme, m) || bonusEligible(scheme, m));
    return (
      <>
        <div className="ss-card">
          <div className="ss-spread" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Stock to arrange</h3>
            <span className="ss-hint">For {active.length} active members</span>
          </div>
          <div className="ss-gifts">
            {scheme.items.map(it => {
              const given = active.filter(m => m.handover?.[it.key]).length;
              return (
                <div key={it.key} className="ss-gift">
                  <div className="q">{it.per * active.length}</div>
                  <b>{it.name}</b>
                  <div className="ss-hint">{it.name_ta}{it.name_ta ? ' · ' : ''}{it.per} {it.unit} each · {given} given</div>
                </div>
              );
            })}
            {scheme.bonus && (
              <div className="ss-gift">
                <div className="q">{eligible.length}</div>
                <b>{scheme.bonus.name} (joining offer)</b>
                <div className="ss-hint">{scheme.bonus.join_month ? `Joined by ${monthKeyLabel(scheme.bonus.join_month)}` : 'All members'} · {eligible.filter(m => m.handover?.bonus).length} given</div>
              </div>
            )}
          </div>
        </div>
        <div className="ss-card">
          <div className="ss-spread" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Hand over ({completed.length} of {active.length} completed all {scheme.months} months)</h3>
            <div style={{ minWidth: 0, flex: '0 1 300px' }}>{searchBox('handover')}</div>
          </div>
          <p className="ss-hint" style={{ marginTop: 0 }}>Items unlock when all {scheme.months} months are paid.{scheme.bonus ? ` The ${scheme.bonus.name.toLowerCase()} can be given any time after joining.` : ''}</p>
          <div className="ss-list">
            {list.map(m => {
              const done = isCompleted(scheme, m);
              return (
                <div key={m.id} className="ss-item">
                  <div className="ss-who" onClick={() => openMember(m.id)}>
                    <b>{highlight(m.name, termOf('handover'))}</b>
                    <small>{m.card_number} · {paidMonths(m).length}/{scheme.months} paid</small>
                  </div>
                  <div className="ss-chips">
                    {scheme.items.map(it => (
                      <button key={it.key} className={`ss-chip ${m.handover?.[it.key] ? 'on' : ''}`} disabled={!done}
                        onClick={() => setHandover(m, it.key, !m.handover?.[it.key])}>
                        {m.handover?.[it.key] ? '✓' : '○'} {it.name}
                      </button>
                    ))}
                    {bonusEligible(scheme, m) && (
                      <button className={`ss-chip ${m.handover?.bonus ? 'on' : ''}`} onClick={() => setHandover(m, 'bonus', !m.handover?.bonus)}>
                        {m.handover?.bonus ? '✓' : '○'} {scheme.bonus.name}
                      </button>
                    )}
                    {done && scheme.items.every(it => m.handover?.[it.key]) && (
                      <button className="ss-btn sm wa" onClick={() => setMsgDialog({ title: 'Handover message', text: handoverMessage(scheme, m), phone: m.phone })}>WhatsApp</button>
                    )}
                  </div>
                </div>
              );
            })}
            {!list.length && <div className="ss-hint">No one has completed all months yet{scheme.bonus ? ' and no one is due the joining offer' : ''}.</div>}
          </div>
        </div>
      </>
    );
  }

  function renderSetup() {
    const f = schemeForm || (scheme ? {
      ...scheme, collectors: (scheme.collectors || []).join(', '),
      items: scheme.items?.length ? scheme.items : [{ name: '', name_ta: '', per: 1, unit: '' }],
      bonus: scheme.bonus || { name: '', name_ta: '', join_month: '' }
    } : emptyScheme());
    const set = (patch) => setSchemeForm({ ...f, ...patch });
    const setItem = (i, patch) => set({ items: f.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
    const field = (label, key, props = {}) => (
      <div className={`ss-field ${props.full ? 'ss-full' : ''}`}>
        <label>{label}</label>
        <input className="ss-input" value={f[key] ?? ''} onChange={e => set({ [key]: e.target.value })} {...props.input} />
      </div>
    );
    const lastMonth = f.start_month && Number(f.months) > 0
      ? schemeMonthLabel({ start_month: f.start_month }, Number(f.months)) : '';
    const isNew = !f.id;
    return (
      <>
        <div className="ss-card">
          <div className="ss-spread" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{isNew ? 'Create a scheme' : 'Scheme settings'}</h3>
            {!isNew && <span className="ss-hint">Changing the amount affects payments recorded from now on.</span>}
          </div>
          <div className="ss-form">
            {field('Scheme name (English) *', 'name', { input: { placeholder: 'Diwali Savings Scheme 2026–27' } })}
            {field('Scheme name (Tamil)', 'name_ta', { input: { placeholder: 'தீபாவளி சிறு சேமிப்பு திட்டம்' } })}
            {field('Run by (shown on WhatsApp messages)', 'run_by', { full: true })}
            {field('Monthly amount (₹) *', 'amount', { input: { type: 'number', min: 1 } })}
            {field('Number of months *', 'months', { input: { type: 'number', min: 1, max: 60 } })}
            {field('First month *', 'start_month', { input: { type: 'month' } })}
            <div className="ss-field"><label>Last month</label><input className="ss-input" value={lastMonth} readOnly /></div>
            {field('Pay from day', 'window_from', { input: { type: 'number', min: 1, max: 31 } })}
            {field('Pay until day', 'window_to', { input: { type: 'number', min: 1, max: 31 } })}
            {field('Card number prefix *', 'card_prefix', { input: { placeholder: 'DW-2627' } })}
            {field('Collectors (comma separated)', 'collectors', { input: { placeholder: 'Chakravarthy, Santhosh' } })}
          </div>
        </div>

        <div className="ss-card">
          <h3>Items given at the end</h3>
          <div className="ss-list">
            {f.items.map((it, i) => (
              <div key={i} className="ss-form" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', alignItems: 'end' }}>
                <div className="ss-field"><label>Item</label><input className="ss-input" value={it.name} placeholder="Ponni rice" onChange={e => setItem(i, { name: e.target.value })} /></div>
                <div className="ss-field"><label>Tamil</label><input className="ss-input" value={it.name_ta || ''} placeholder="பொன்னி அரிசி" onChange={e => setItem(i, { name_ta: e.target.value })} /></div>
                <div className="ss-field"><label>Per member</label><input className="ss-input" type="number" min="1" value={it.per} onChange={e => setItem(i, { per: e.target.value })} /></div>
                <div className="ss-field"><label>Unit</label><input className="ss-input" value={it.unit || ''} placeholder="bags" onChange={e => setItem(i, { unit: e.target.value })} /></div>
                <button className="ss-btn red sm" onClick={() => set({ items: f.items.filter((_, k) => k !== i) })}>Remove</button>
              </div>
            ))}
          </div>
          <button className="ss-btn sm" style={{ marginTop: 10 }} onClick={() => set({ items: [...f.items, { name: '', name_ta: '', per: 1, unit: '' }] })}>+ Add item</button>
        </div>

        <div className="ss-card">
          <h3>Joining offer (optional)</h3>
          <div className="ss-form">
            <div className="ss-field"><label>Gift</label><input className="ss-input" value={f.bonus?.name || ''} placeholder="Saree" onChange={e => set({ bonus: { ...f.bonus, name: e.target.value } })} /></div>
            <div className="ss-field"><label>Gift (Tamil)</label><input className="ss-input" value={f.bonus?.name_ta || ''} placeholder="புடவை" onChange={e => set({ bonus: { ...f.bonus, name_ta: e.target.value } })} /></div>
            <div className="ss-field ss-full"><label>For members who join in or before</label><input className="ss-input" type="month" value={f.bonus?.join_month || ''} onChange={e => set({ bonus: { ...f.bonus, join_month: e.target.value } })} /></div>
          </div>
        </div>

        <div className="ss-card">
          <h3>WhatsApp note</h3>
          <div className="ss-field"><label>Added to the end of every receipt and reminder</label>
            <textarea className="ss-input" style={{ minHeight: 70 }} value={f.whatsapp_note || ''} onChange={e => set({ whatsapp_note: e.target.value })} placeholder="தொடர்புக்கு: 9344641471 / 8667510724" />
          </div>
          {!isNew && (
            <div className="ss-field" style={{ marginTop: 10 }}><label>Status</label>
              <select className="ss-select" value={f.status} onChange={e => set({ status: e.target.value })}>
                <option value="open">Open: new members can join</option>
                <option value="closed">Closed: no new members</option>
              </select>
            </div>
          )}
          <div className="ss-row" style={{ marginTop: 14 }}>
            <button className="ss-btn pri" disabled={saving} onClick={() => saveScheme(f)}>{saving ? 'Saving…' : isNew ? 'Create scheme' : 'Save changes'}</button>
            {schemeForm && <button className="ss-btn" onClick={() => setSchemeForm(null)}>Cancel</button>}
            {!isNew && <button className="ss-btn red" onClick={deleteScheme}>Delete scheme</button>}
          </div>
        </div>
      </>
    );
  }

  function renderReports() {
    const label = schemeMonthLabel(scheme, viewMonth);
    const base = scheme.card_prefix.toLowerCase();
    const memberCols = (m) => [m.card_number, m.name, m.phone, m.village];
    const reports = [
      {
        title: `Monthly collection · ${label}`, desc: 'Everyone who paid this month with date, mode and collector.',
        run: () => downloadCSV(`${base}-collection-${schemeMonthKey(scheme, viewMonth)}.csv`, [
          ['Card', 'Name', 'Phone', 'Village', 'Month', 'Amount', 'Paid date', 'Mode', 'Collected by', 'Late'],
          ...active.filter(m => m.payments?.[viewMonth]).map(m => {
            const p = m.payments[viewMonth];
            return [...memberCols(m), label, p.amount, p.date, p.mode, p.collected_by, isLatePayment(scheme, viewMonth, p) ? 'Yes' : ''];
          })
        ])
      },
      {
        title: `Unpaid list · ${label}`, desc: 'Members who have not paid this month, with all months they are behind.',
        run: () => downloadCSV(`${base}-unpaid-${schemeMonthKey(scheme, viewMonth)}.csv`, [
          ['Card', 'Name', 'Phone', 'Village', 'Months not paid', 'Amount due'],
          ...active.filter(m => !m.payments?.[viewMonth]).map(m => {
            const owed = [...new Set([...missedMonths(scheme, m, currentMonth), viewMonth])].sort((a, b) => a - b);
            return [...memberCols(m), owed.map(i => schemeMonthLabel(scheme, i)).join('; '), owed.length * scheme.amount];
          })
        ])
      },
      {
        title: 'Collector settlement', desc: 'Cash and UPI collected by each person, month by month.',
        run: () => {
          const rows = [['Month', 'Collector', 'Cash', 'UPI', 'Total', 'Payments']];
          for (let i = 1; i <= scheme.months; i++) {
            const by = {};
            active.forEach(m => {
              const p = m.payments?.[i];
              if (!p) return;
              const r = by[p.collected_by] || (by[p.collected_by] = { cash: 0, upi: 0, n: 0 });
              r.n++;
              if (p.mode === 'UPI') r.upi += Number(p.amount || 0); else r.cash += Number(p.amount || 0);
            });
            Object.entries(by).forEach(([who, r]) => rows.push([schemeMonthLabel(scheme, i), who, r.cash, r.upi, r.cash + r.upi, r.n]));
          }
          downloadCSV(`${base}-collector-settlement.csv`, rows);
        }
      },
      {
        title: 'Member ledger', desc: `Every member with all ${scheme.months} months and total paid.`,
        run: () => downloadCSV(`${base}-ledger.csv`, [
          ['Card', 'Name', 'Phone', 'Village', 'Joined', 'Status',
            ...Array.from({ length: scheme.months }, (_, k) => schemeMonthLabel(scheme, k + 1)), 'Months paid', 'Total paid',
            ...(scheme.bonus ? [`${scheme.bonus.name} eligible`] : [])],
          ...members.map(m => [...memberCols(m), monthKeyLabel(m.join_month), m.status,
            ...Array.from({ length: scheme.months }, (_, k) => m.payments?.[k + 1]?.date || ''),
            paidMonths(m).length, Object.values(m.payments || {}).reduce((a, p) => a + Number(p.amount || 0), 0),
            ...(scheme.bonus ? [bonusEligible(scheme, m) ? 'Yes' : 'No'] : [])])
        ])
      },
      {
        title: 'Stock & handover', desc: 'Items each member gets and whether they have been given.',
        run: () => {
          const keys = [...scheme.items.map(it => [it.key, it.name]), ...(scheme.bonus ? [['bonus', scheme.bonus.name]] : [])];
          downloadCSV(`${base}-handover.csv`, [
            ['Card', 'Name', 'Phone', 'Village', 'Months paid', ...keys.map(([, n]) => `${n} given on`)],
            ...active.map(m => [...memberCols(m), paidMonths(m).length,
              ...keys.map(([k]) => (k === 'bonus' && !bonusEligible(scheme, m)) ? 'Not eligible' : (m.handover?.[k]?.date || ''))])
          ]);
        }
      }
    ];
    return (
      <div className="ss-card">
        <div className="ss-spread" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Downloads (open in Excel)</h3>
          <select className="ss-select" style={{ width: 'auto' }} value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}>
            {Array.from({ length: scheme.months }, (_, k) => <option key={k} value={k + 1}>{schemeMonthLabel(scheme, k + 1)}</option>)}
          </select>
        </div>
        <div className="ss-list">
          {reports.map(r => (
            <div key={r.title} className="ss-item">
              <div className="ss-who" style={{ cursor: 'default' }}><b>{r.title}</b><small>{r.desc}</small></div>
              <button className="ss-btn sm pri" onClick={r.run}>Download</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Dialogs ----------

  function renderPayDialog() {
    const { member, months } = payDialog;
    const toggle = (i) => {
      const next = new Set(months);
      if (next.has(i)) next.delete(i); else next.add(i);
      setPayDialog({ ...payDialog, months: next });
    };
    return (
      <Dialog onClose={() => setPayDialog(null)}>
        <h3 style={{ margin: 0 }}>Record payment</h3>
        <div><b>{member.name}</b> · {member.card_number}<div className="ss-hint">{member.phone} · {member.village}</div></div>
        <div className="ss-field"><label>Months ({months.size} × {formatRs(scheme.amount)} = {formatRs(months.size * scheme.amount)})</label>
          <div className="ss-chips">
            {Array.from({ length: scheme.months }, (_, k) => k + 1).filter(i => !member.payments?.[i]).map(i => (
              <button key={i} className={`ss-chip ${months.has(i) ? 'on' : ''}`} onClick={() => toggle(i)}>{schemeMonthLabel(scheme, i)}</button>
            ))}
          </div>
        </div>
        <div className="ss-form">
          <div className="ss-field"><label>Paid date</label><input className="ss-input" type="date" value={payDialog.date} onChange={e => setPayDialog({ ...payDialog, date: e.target.value })} /></div>
          <div className="ss-field"><label>Mode</label>
            <select className="ss-select" value={payDialog.mode} onChange={e => setPayDialog({ ...payDialog, mode: e.target.value })}><option>Cash</option><option>UPI</option></select>
          </div>
          <div className="ss-field ss-full"><label>Collected by</label>
            <select className="ss-select" value={payDialog.collected_by} onChange={e => setPayDialog({ ...payDialog, collected_by: e.target.value })}>
              {scheme.collectors.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="ss-row">
          <button className="ss-btn pri" disabled={saving || !months.size} onClick={savePayment}>{saving ? 'Saving…' : 'Save payment'}</button>
          <button className="ss-btn" onClick={() => setPayDialog(null)}>Cancel</button>
        </div>
      </Dialog>
    );
  }

  function renderMsgDialog() {
    const { title, text, phone } = msgDialog;
    return (
      <Dialog onClose={() => setMsgDialog(null)}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div className="ss-msg">{text}</div>
        <div className="ss-row">
          <a className="ss-btn wa" style={{ textDecoration: 'none' }} href={whatsappLink(phone, text)} target="_blank" rel="noreferrer" onClick={() => setMsgDialog(null)}>Send on WhatsApp</a>
          <button className="ss-btn" onClick={() => { navigator.clipboard?.writeText(text).then(() => showToast('Copied'), () => showToast('Copy failed')); }}>Copy</button>
          <button className="ss-btn" onClick={() => setMsgDialog(null)}>Close</button>
        </div>
      </Dialog>
    );
  }

  function renderRemindQueue() {
    const { list, index } = remindQueue;
    const done = index >= list.length;
    const m = list[index];
    const owed = m ? [...new Set([...missedMonths(scheme, m, currentMonth), viewMonth])].sort((a, b) => a - b) : [];
    const text = m ? reminderMessage(scheme, m, owed) : '';
    return (
      <Dialog onClose={() => setRemindQueue(null)}>
        <div className="ss-spread"><h3 style={{ margin: 0 }}>Remind unpaid members</h3><span className="ss-pill gold">{Math.min(index + 1, list.length)} / {list.length}</span></div>
        {done ? <div>All {list.length} reminders opened. ✅</div> : (
          <>
            <div><b>{m.name}</b> · {m.card_number} · {m.phone}</div>
            <div className="ss-msg">{text}</div>
            <div className="ss-hint">WhatsApp opens one chat at a time. Send it, come back here, and the next one is ready.</div>
          </>
        )}
        <div className="ss-row">
          {!done && <a className="ss-btn wa" style={{ textDecoration: 'none' }} href={whatsappLink(m.phone, text)} target="_blank" rel="noreferrer" onClick={() => setRemindQueue({ list, index: index + 1 })}>Send to {m.name}</a>}
          {!done && <button className="ss-btn" onClick={() => setRemindQueue({ list, index: index + 1 })}>Skip</button>}
          <button className="ss-btn" onClick={() => setRemindQueue(null)}>Close</button>
        </div>
      </Dialog>
    );
  }

  // Member detail: info, month grid (select unpaid months to pay), undo, edit, withdraw
  function renderMemberDialog() {
    const member = members.find(x => x.id === memberId);
    if (!member) return null;
    const sel = memberSel, setSel = setMemberSel, edit = memberEdit, setEdit = setMemberEdit;
    const toggle = (i) => { const n = new Set(sel); if (n.has(i)) n.delete(i); else n.add(i); setSel(n); };
    const owed = missedMonths(scheme, member, currentMonth);
    const paidList = paidMonths(member);
    const done = paidList.length >= scheme.months;
    const withdrawn = member.status === 'withdrawn';
    const totalPaid = Object.values(member.payments || {}).reduce((a, p) => a + Number(p.amount || 0), 0);
    const remaining = (scheme.months - paidList.length) * scheme.amount;
    const headBg = withdrawn ? 'linear-gradient(135deg,#3a2a2e,#2a1d21)'
      : done ? 'linear-gradient(135deg,#14532d,#15803d)' : 'linear-gradient(135deg,#92400e,#b45309)';
    return (
      <Dialog onClose={() => setMemberId(null)}>
        {/* Header: who, scheme, offer status and progress */}
        <div className="ss-dhead" style={{ background: headBg }}>
          <div className="ss-spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{member.name}</div>
              <div className="ss-dsub">🪪 {member.card_number} &nbsp;|&nbsp; 📞 {member.phone}{member.village ? ` | 📍 ${member.village}` : ''}</div>
              <div className="ss-dsub">{scheme.name} — {formatRs(scheme.amount)}/month · Joined {monthKeyLabel(member.join_month)}</div>
              {member.notes && <div className="ss-dsub">📝 {member.notes}</div>}
            </div>
            {done && <span style={{ fontSize: 24 }}>🎊</span>}
            {withdrawn && <span className="ss-pill grey">Withdrawn</span>}
          </div>
          {(bonusEligible(scheme, member) || done) && (
            <div className="ss-dbox">
              {bonusEligible(scheme, member) && (
                <div className="ss-spread">
                  <span>🎀 {scheme.bonus.name}{scheme.bonus.name_ta ? ` / ${scheme.bonus.name_ta}` : ''} (joining offer)</span>
                  {member.handover?.bonus
                    ? <span style={{ color: '#4ade80', fontWeight: 700 }}>✅ Given {member.handover.bonus.date}</span>
                    : <button className="ss-btn sm pri" onClick={() => setHandover(member, 'bonus', true)}>Mark given</button>}
                </div>
              )}
              {done && scheme.items.map(it => (
                <div key={it.key} className="ss-spread" style={{ marginTop: 4 }}>
                  <span>🎁 {it.name}{it.per > 1 ? ` × ${it.per} ${it.unit}` : ''}</span>
                  {member.handover?.[it.key]
                    ? <span style={{ color: '#4ade80', fontWeight: 700 }}>✅ Given {member.handover[it.key].date}</span>
                    : <button className="ss-btn sm pri" onClick={() => setHandover(member, it.key, true)}>Mark given</button>}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <div className="ss-spread" style={{ marginBottom: 3 }}>
              <span style={{ fontSize: 10, opacity: .8 }}>Payment progress</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{paidList.length}/{scheme.months} months</span>
            </div>
            <div className="ss-prog" style={{ background: 'rgba(0,0,0,.3)', height: 7 }}>
              <i style={{ width: `${(paidList.length / scheme.months) * 100}%`, background: done ? '#4ade80' : '#fbbf24' }} />
            </div>
          </div>
        </div>

        {!edit && (
          <>
            {/* Timeline: every month with paid date / due / missed; tap unpaid months to pay */}
            <div>
              <div className="ss-section-label" style={{ marginTop: 0 }}>PAYMENT TIMELINE {!withdrawn && <span style={{ fontWeight: 400 }}>· tap unpaid months to pay</span>}</div>
              <div className="ss-chips">
                {Array.from({ length: scheme.months }, (_, k) => k + 1).map(i => {
                  const p = member.payments?.[i];
                  const st = memberMonthStatus(member, i, currentMonth);
                  return (
                    <div key={i} className={`ss-tchip ${st} ${sel.has(i) ? 'sel' : ''}`}
                      onClick={() => { if (!p && !withdrawn) toggle(i); }}>
                      <b>M{i}</b>
                      <span>{schemeMonthLabel(scheme, i)}</span>
                      <small>{p ? p.date.split('-').reverse().join('/') : st === 'due' ? 'DUE' : st === 'missed' ? 'MISSED' : '—'}</small>
                    </div>
                  );
                })}
              </div>
              {sel.size > 0 && (
                <button className="ss-btn pri" style={{ width: '100%', marginTop: 10 }} onClick={() => { setMemberId(null); openPay(member, [...sel]); }}>
                  Record payment for {sel.size} month{sel.size > 1 ? 's' : ''} · {formatRs(sel.size * scheme.amount)}
                </button>
              )}
            </div>

            {/* History: one row per paid month */}
            {paidList.length > 0 && (
              <div>
                <div className="ss-section-label" style={{ marginTop: 0 }}>PAYMENT HISTORY</div>
                <div className="ss-list" style={{ gap: 4 }}>
                  {paidList.map(i => {
                    const p = member.payments[i];
                    return (
                      <div key={i} className="ss-hist">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#5fcf8c', fontWeight: 600 }}>M{i} — {schemeMonthLabel(scheme, i)}</div>
                          <div className="ss-hint" style={{ fontSize: 11 }}>
                            {p.date.split('-').reverse().join('/')} · {p.mode} · by {p.collected_by}
                            {isLatePayment(scheme, i, p) && <span className="ss-pill warn" style={{ marginLeft: 6 }}>Late</span>}
                          </div>
                        </div>
                        <div className="ss-row" style={{ flexWrap: 'nowrap' }}>
                          <b style={{ color: '#f0b23a' }}>{formatRs(p.amount)}</b>
                          <button className="ss-btn sm" title="Print receipt" onClick={() => printReceipt(member, i)}>🖨</button>
                          <button className="ss-btn sm" title="Bluetooth thermal print" onClick={() => printReceiptBluetooth(member, i)}>📶</button>
                          <button className="ss-btn sm wa" title="WhatsApp receipt" onClick={() => setMsgDialog({ title: 'Receipt', text: receiptMessage(scheme, member, [i]), phone: member.phone })}>WA</button>
                          <button className="ss-btn sm red" title="Undo this payment" onClick={() => undoPayment(member, i)}>↩</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="ss-total">
                  <span>Total paid</span><b style={{ color: '#f0b23a' }}>{formatRs(totalPaid)}</b>
                </div>
                {!done && <div className="ss-total" style={{ marginTop: 4 }}><span>Still to pay ({scheme.months - paidList.length} months)</span><b>{formatRs(remaining)}</b></div>}
              </div>
            )}
            {!paidList.length && <div className="ss-hint">No payments yet.</div>}

            {/* Actions */}
            <div className="ss-actions">
              <button className="ss-btn" onClick={() => setEdit({ name: member.name, phone: member.phone, village: member.village || '', notes: member.notes || '', join_month: member.join_month || '' })}>✏️ Edit</button>
              <a className="ss-btn wa" style={{ textDecoration: 'none', textAlign: 'center' }} href={whatsappLink(member.phone, '')} target="_blank" rel="noreferrer">💬 WA</a>
              {owed.length > 0 && !withdrawn && <button className="ss-btn" onClick={() => setMsgDialog({ title: 'Reminder', text: reminderMessage(scheme, member, owed), phone: member.phone })}>🔔 Remind ({owed.length})</button>}
              {!paidList.length && <button className="ss-btn red" onClick={() => deleteMember(member)}>🗑️ Delete</button>}
            </div>
            {withdrawn
              ? <button className="ss-btn" style={{ width: '100%', background: '#15803d', borderColor: '#15803d' }} onClick={() => updateMember(member, { status: 'active' }, 'Member is active again')}>↩️ Make active again</button>
              : <button className="ss-btn red" style={{ width: '100%' }} onClick={() => { if (window.confirm(`Mark ${member.name} as withdrawn? Their payments stay recorded.`)) updateMember(member, { status: 'withdrawn' }, 'Member withdrawn'); }}>🚫 Withdraw from scheme</button>}
            <button className="ss-btn" style={{ width: '100%', background: 'none' }} onClick={() => setMemberId(null)}>Close</button>
          </>
        )}

        {edit && (
          <>
            <div className="ss-form">
              {[['Name', 'name'], ['Phone', 'phone'], ['Village', 'village'], ['Notes', 'notes']].map(([l, k]) => (
                <div key={k} className="ss-field"><label>{l}</label><input className="ss-input" value={edit[k]} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></div>
              ))}
              <div className="ss-field ss-full"><label>Joined in</label><input className="ss-input" type="month" value={edit.join_month} onChange={e => setEdit({ ...edit, join_month: e.target.value })} /></div>
            </div>
            <div className="ss-row">
              <button className="ss-btn pri" onClick={async () => { if (await updateMember(member, edit, 'Saved')) setEdit(null); }}>Save</button>
              <button className="ss-btn" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </>
        )}
      </Dialog>
    );
  }
}

// Kept outside SavingsSchemes so it is not re-created (and its inputs re-mounted) on every render
function Dialog({ children, onClose }) {
  return (
    <div className="ss-scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ss-dialog" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

function AddMemberForm({ scheme, onAdded, onError }) {
  const blank = { name: '', phone: '', village: '', notes: '', join_month: todayISO().slice(0, 7) };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const contactsSupported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

  const pickContact = async () => {
    try {
      const [c] = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!c) return;
      setForm(f => ({ ...f, name: c.name?.[0] || f.name, phone: (c.tel?.[0] || '').replace(/\D/g, '').slice(-10) || f.phone }));
    } catch (err) { if (err?.name !== 'AbortError') onError('Could not open contacts'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.phone.replace(/\D/g, '').length < 10) { onError('Enter a name and a 10-digit phone number'); return; }
    setBusy(true);
    try {
      const member = await api(`/schemes/${scheme.id}/members`, { method: 'POST', body: form });
      onAdded(member);
      setForm(blank);
    } catch (err) { onError(err.message); }
    setBusy(false);
  };

  const getsBonus = scheme.bonus && (!scheme.bonus.join_month || form.join_month <= scheme.bonus.join_month);
  if (scheme.status === 'closed') return <div className="ss-card">This scheme is closed for new members. Reopen it in Scheme setup to add more.</div>;
  return (
    <form className="ss-card" onSubmit={submit}>
      <div className="ss-spread" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Add a member</h3>
        {contactsSupported && <button type="button" className="ss-btn sm" onClick={pickContact}>📇 Pick from contacts</button>}
      </div>
      <div className="ss-form">
        <div className="ss-field"><label>Name *</label><input className="ss-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="ss-field"><label>Phone *</label><input className="ss-input" inputMode="numeric" value={form.phone} placeholder="10-digit mobile" onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="ss-field"><label>Village</label><input className="ss-input" value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} /></div>
        <div className="ss-field"><label>Joined in</label><input className="ss-input" type="month" value={form.join_month} onChange={e => setForm({ ...form, join_month: e.target.value })} /></div>
        <div className="ss-field ss-full"><label>Notes</label><input className="ss-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <div className="ss-row" style={{ marginTop: 12 }}>
        <button className="ss-btn pri" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add member'}</button>
        {scheme.bonus && <span className="ss-hint">{getsBonus ? `Gets the ${scheme.bonus.name.toLowerCase()} (joining offer).` : `No ${scheme.bonus.name.toLowerCase()}: joined after ${monthKeyLabel(scheme.bonus.join_month)}.`}</span>}
      </div>
    </form>
  );
}

export default SavingsSchemes;
