import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const PHONE = '8667510724';

// Payout on completion = 10 months' contribution + bonus, plus a festival gift item (rule: gift given on the Wednesday of the festival)
const SCHEME_INFO = {
  1: { payout: 11000, gift: '1 கிலோ கோழி', giftEn: '1 kg Chicken' },
  2: { payout: 22000, gift: '1 கிலோ மட்டன்', giftEn: '1 kg Mutton' },
};

const FESTIVAL_RULES = [
  'ஒவ்வொரு மாதமும் 1ம் தேதி முதல் 10ம் தேதிக்குள் பணம் செலுத்த வேண்டும் (Online / நேரடியாக).',
  'திருவிழாவிற்கு முன் எந்த காரணத்திற்காகவும் செலுத்திய தொகை திரும்பப் பெற முடியாது.',
  'தொடர்ந்து 3 மாதங்கள் செலுத்தாவிட்டால் திட்டத்தில் இருந்து நீக்கப்படுவார்கள்.',
  'திருவிழா வரை பணம் பாதுகாப்பாக வைக்கப்படும்; பரிசுப் பொருள் திருவிழா புதன்கிழமையன்று வழங்கப்படும்.',
  '5 புதிய உறுப்பினர்களை அறிமுகப்படுத்தும் உறுப்பினருக்கு சிறப்பு பரிசு உண்டு.',
  'புதிதாக சேரும் ஒவ்வொரு உறுப்பினருக்கும் ஒரு சிறிய வரவேற்பு பரிசு வழங்கப்படும்.',
];

const REFERRAL_BADGE_THRESHOLD = 5;

function fmt(month) {
  if (!month) return '';
  const [y, m] = month.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
function fmtFull(month) {
  if (!month) return '';
  const [y, m] = month.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
function monthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = -2; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return opts;
}

// The join month itself is month 1 — someone who joins in July and pays any day in
// July has made their first payment, not a "late" one.
function getFestivalPaymentMonths(joinMonth) {
  const [y, m] = joinMonth.split('-').map(Number);
  const months = [];
  for (let i = 0; i <= 9; i++) {
    const d = new Date(y, m - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return months;
}

// How many of the 10 scheduled months have already occurred, as of today
function monthsElapsed(paymentMonths) {
  if (!paymentMonths || paymentMonths.length === 0) return 0;
  const now = currentMonth();
  return paymentMonths.filter(m => m <= now).length;
}

// Rule: missing 3+ consecutive months' worth of payments results in removal from the scheme
function isOverdue(paymentMonths, paidCount) {
  return (monthsElapsed(paymentMonths) - paidCount) >= 3;
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  overlay: { position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:200 },
  sidebar: (open) => ({
    position:'fixed',top:0,left:open?0:'-270px',bottom:0,width:265,
    background:'#1e293b',zIndex:201,transition:'left .3s ease',
    display:'flex',flexDirection:'column',borderRight:'1px solid #334155'
  }),
  sideHead: {
    padding:'18px 16px 14px',
    background:'linear-gradient(135deg,#d97706,#b45309)',
    position:'relative'
  },
  closeBtn: {
    position:'absolute',top:12,right:12,
    background:'rgba(255,255,255,0.2)',border:'none',color:'white',
    fontSize:15,cursor:'pointer',padding:'2px 8px',borderRadius:6
  },
  navLabel: { fontSize:9,fontWeight:700,letterSpacing:1,color:'#475569',padding:'10px 16px 3px',textTransform:'uppercase' },
  navDivider: { height:1,background:'#334155',margin:'5px 16px' },
  navItem: (active) => ({
    display:'flex',alignItems:'center',gap:10,padding:'11px 16px',
    cursor:'pointer',fontSize:13,fontWeight:600,
    color: active ? '#f59e0b' : '#94a3b8',
    background: active ? '#0f172a' : 'transparent',
    borderLeft: `3px solid ${active ? '#f59e0b' : 'transparent'}`,
    transition:'all .15s'
  }),
  badge: (color='#dc2626') => ({
    marginLeft:'auto',background:color,color:'white',
    fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:700
  }),
  topbar: {
    background:'#1e293b',padding:'12px 14px',
    display:'flex',alignItems:'center',gap:10,
    borderBottom:'2px solid #f59e0b',position:'sticky',top:0,zIndex:50
  },
  burger: { background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',flexDirection:'column',gap:4 },
  burgerLine: { display:'block',width:22,height:2,background:'#f59e0b',borderRadius:2 },
  page: { padding:14 },
  card: { background:'#1e293b',borderRadius:12,padding:14,border:'1px solid #334155',marginBottom:12 },
  label: { fontSize:11,fontWeight:600,color:'#94a3b8',marginBottom:4,display:'block' },
  input: {
    width:'100%',background:'#0f172a',border:'1px solid #334155',
    borderRadius:8,padding:'9px 12px',color:'#f1f5f9',fontSize:13,
    marginBottom:11,outline:'none',boxSizing:'border-box'
  },
  row: { display:'flex',gap:8,alignItems:'center' },
  btn: (bg,color='white') => ({
    padding:'5px 8px',border:'none',borderRadius:6,
    background:bg,color,fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'
  }),
  primaryBtn: (bg) => ({
    width:'100%',padding:13,border:'none',borderRadius:9,
    background:bg,color:'white',fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:8
  }),
  summRow: { display:'flex',background:'#0f172a',borderRadius:10,border:'1px solid #334155',overflow:'hidden',marginBottom:12 },
  sumItem: { flex:1,padding:'10px 6px',textAlign:'center' },
  crow: (type) => ({
    background:'#1e293b',borderRadius:8,padding:'9px 10px',
    marginBottom:6,border:'1px solid #334155',
    borderLeft:`3px solid ${type==='paid'?'#4ade80':type==='unpaid'?'#f87171':'#f59e0b'}`,
    display:'flex',alignItems:'center',gap:8
  }),
  badge2: (bg,color) => ({ fontSize:9,padding:'2px 5px',borderRadius:4,fontWeight:600,background:bg,color,whiteSpace:'nowrap',flexShrink:0 }),
  chip: (type) => ({
    padding:'4px 9px',borderRadius:20,fontSize:10,fontWeight:600,border:'1px solid',
    background: type==='done'?'#14532d':type==='cur'?'#1c1400':'#0f172a',
    color:       type==='done'?'#4ade80':type==='cur'?'#f59e0b':'#64748b',
    borderColor: type==='done'?'#15803d':type==='cur'?'#f59e0b':'#334155',
  }),
  modal: {
    position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',
    display:'flex',alignItems:'center',justifyContent:'center',
    zIndex:300,padding:16
  },
  modalBox: { background:'#1e293b',borderRadius:16,width:'100%',maxWidth:400,maxHeight:'90vh',overflowY:'auto' },
};

// ── Main Component ───────────────────────────────────────────────────────────
export default function FestivalFund({ navigateTo }) {
  const [section, setSection]         = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customers, setCustomers]     = useState([]);
  const [payments, setPayments]       = useState([]);
  const [stats, setStats]             = useState(null);
  const [selMonth, setSelMonth]       = useState(currentMonth());
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');

  // Add-customer form
  const [form, setForm] = useState({ name:'', father_name:'', mobile:'', spouse_name:'', scheme:1, referred_by:'', join_month:currentMonth() });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [contactPickerSupported] = useState(typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window);

  // Record-payment
  const [payTarget, setPayTarget]   = useState(null); // customer object (Record Payment screen)
  const [payDate, setPayDate]       = useState(todayISO());
  const [payMode, setPayMode]       = useState('cash');
  const [custSearch, setCustSearch] = useState('');
  const [quickPay, setQuickPay]     = useState(null);
  const [quickDate, setQuickDate]   = useState(todayISO());
  const [quickMode, setQuickMode]   = useState('cash');
  const [payoutTarget, setPayoutTarget] = useState(null); // customer object for the payout (month 11) modal
  const [payoutDate, setPayoutDate]     = useState(todayISO());
  const [payoutMode, setPayoutMode]     = useState('cash');
  const [detailCust, setDetailCust] = useState(null); // customer for detail/history modal
  const [editCust, setEditCust]     = useState(null); // customer being edited
  const [editForm, setEditForm]     = useState({ name:'', father_name:'', mobile:'', spouse_name:'', referred_by:'' });
  const [custListSearch, setCustListSearch] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes, sRes] = await Promise.all([
        fetch(`${API_URL}/festival-fund/customers`),
        fetch(`${API_URL}/festival-fund/payments`),
        fetch(`${API_URL}/festival-fund/stats?month=${selMonth}`)
      ]);
      setCustomers(await cRes.json());
      setPayments(await pRes.json());
      setStats(await sRes.json());
    } catch (e) { flash('Error loading data: ' + e.message); }
    setLoading(false);
  }, [selMonth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const paymentMap = {};
  payments.forEach(p => {
    if (!paymentMap[p.customer_id]) paymentMap[p.customer_id] = {};
    paymentMap[p.customer_id][p.payment_month] = p;
  });

  // Removed (rule-3 defaulter) members are kept for history but excluded from active lists
  const activeCustomers  = customers.filter(c => c.status !== 'removed');
  const removedCustomers = customers.filter(c => c.status === 'removed');

  const dueThisMonth = activeCustomers.filter(c => (c.payment_months || []).includes(selMonth));
  const paidThisMonth   = dueThisMonth.filter(c =>  paymentMap[c.id]?.[selMonth]);
  const unpaidThisMonth = dueThisMonth.filter(c => !paymentMap[c.id]?.[selMonth]);

  // Referral tracking (rule: 5 referrals earns a special gift)
  const referralCounts = {};
  customers.forEach(c => {
    if (c.referred_by) referralCounts[c.referred_by] = (referralCounts[c.referred_by] || 0) + 1;
  });
  const referrers = customers
    .filter(c => (referralCounts[c.id] || 0) > 0)
    .sort((a, b) => (referralCounts[b.id] || 0) - (referralCounts[a.id] || 0));

  // Defaulters: 3+ months behind (rule 3 — grounds for removal)
  const defaulters = activeCustomers.filter(c => {
    const paidCount = (c.payment_months||[]).filter(m => paymentMap[c.id]?.[m]).length;
    return isOverdue(c.payment_months, paidCount);
  });

  // Completed 10/10 monthly payments but the festival payout (month 11) hasn't been recorded yet
  const payoutPending = activeCustomers.filter(c => {
    const paidCount = (c.payment_months||[]).filter(m => paymentMap[c.id]?.[m]).length;
    return paidCount >= 10 && !paymentMap[c.id]?.['payout'];
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addCustomer = async () => {
    if (!form.name.trim() || !form.father_name.trim() || !form.mobile.trim())
      return flash('Name, Father Name and Mobile are required');
    if (!/^\d{10}$/.test(form.mobile.trim()))
      return flash('Mobile must be 10 digits');
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/festival-fund/customers`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, scheme: Number(form.scheme) })
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || 'Failed');
      flash(`✅ ${data.name} registered!`);
      setForm({ name:'', father_name:'', mobile:'', spouse_name:'', scheme:1, referred_by:'', join_month:currentMonth() });
      fetchAll();
      setSection('monthly');
    } catch (e) { flash(e.message); }
    setSaving(false);
  };

  const recordPayment = async (customer) => {
    const monthIdx = (customer.payment_months || []).indexOf(selMonth);
    if (monthIdx === -1) return flash('This customer has no payment due for this month');
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/festival-fund/payments`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          customer_id: customer.id, payment_month: selMonth,
          month_number: monthIdx + 1, amount: customer.scheme_amount, payment_date: payDate, payment_mode: payMode
        })
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || 'Failed');
      flash(`✅ Payment recorded for ${customer.name}`);
      sendWhatsAppMsg(customer, data, 'received');
      setPayTarget(null);
      fetchAll();
    } catch (e) { flash(e.message); }
    setSaving(false);
  };

  const quickRecordPayment = async () => {
    if (!quickPay) return;
    const customer = quickPay.customer;
    const monthIdx = (customer.payment_months || []).indexOf(selMonth);
    if (monthIdx === -1) return flash('No payment due this month');
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/festival-fund/payments`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          customer_id: customer.id, payment_month: selMonth,
          month_number: monthIdx + 1, amount: customer.scheme_amount, payment_date: quickDate, payment_mode: quickMode
        })
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || 'Failed');
      flash(`✅ ${customer.name} — payment recorded`);
      sendWhatsAppMsg(customer, data, 'received');
      setQuickPay(null);
      fetchAll();
    } catch (e) { flash(e.message); }
    setSaving(false);
  };

  const deleteCustomer = async (customer) => {
    if (!window.confirm(`Delete "${customer.name}"? All their payment records will remain but customer will be removed.`)) return;
    try {
      const r = await fetch(`${API_URL}/festival-fund/customers/${customer.id}`, { method:'DELETE' });
      if (!r.ok) return flash('Failed to delete');
      flash(`Deleted: ${customer.name}`);
      setDetailCust(null);
      fetchAll();
    } catch (e) { flash(e.message); }
  };

  const openEdit = (customer) => {
    setEditCust(customer);
    setEditForm({ name:customer.name, father_name:customer.father_name, mobile:customer.mobile, spouse_name:customer.spouse_name||'', referred_by:customer.referred_by||'' });
  };

  const saveEdit = async () => {
    if (!editForm.name.trim() || !editForm.father_name.trim() || !editForm.mobile.trim())
      return flash('Name, Father Name and Mobile are required');
    if (!/^\d{10}$/.test(editForm.mobile.trim())) return flash('Mobile must be 10 digits');
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/festival-fund/customers/${editCust.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(editForm)
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || 'Failed');
      flash(`✅ ${data.name} updated`);
      setEditCust(null);
      setDetailCust(prev => prev ? { ...prev, ...editForm } : null);
      fetchAll();
    } catch (e) { flash(e.message); }
    setSaving(false);
  };

  const undoPayment = async (paymentId, customerName) => {
    if (!window.confirm(`Undo payment for ${customerName}?`)) return;
    try {
      await fetch(`${API_URL}/festival-fund/payments/${paymentId}`, { method:'DELETE' });
      flash(`Undone: ${customerName}`);
      fetchAll();
    } catch (e) { flash(e.message); }
  };

  // ── Remove from scheme (rule 3: 3+ missed months) / Reactivate ─────────────
  const setCustomerStatus = async (customer, status) => {
    try {
      const r = await fetch(`${API_URL}/festival-fund/customers/${customer.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          name: customer.name, father_name: customer.father_name, mobile: customer.mobile,
          spouse_name: customer.spouse_name || '', referred_by: customer.referred_by || '', status
        })
      });
      if (!r.ok) return flash('Failed to update status');
      flash(status === 'removed' ? `${customer.name} — திட்டத்தில் இருந்து நீக்கப்பட்டார்` : `${customer.name} — மீண்டும் செயலில்`);
      setDetailCust(null);
      fetchAll();
    } catch (e) { flash(e.message); }
  };

  const removeFromScheme = (customer) => {
    if (!window.confirm(`"${customer.name}" — 3+ மாதங்கள் நிலுவை உள்ளதால் திட்டத்தில் இருந்து நீக்கவா? (பணம் செலுத்திய வரலாறு பாதுகாக்கப்படும்)`)) return;
    setCustomerStatus(customer, 'removed');
  };

  const reactivateCustomer = (customer) => setCustomerStatus(customer, 'active');

  // ── Festival payout / gift handover (month_number 11 — a real payment record,
  // not a boolean flag, so it carries its own date/mode like the other 10 months) ──
  const recordPayout = async () => {
    if (!payoutTarget) return;
    const customer = payoutTarget;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/festival-fund/payments`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          customer_id: customer.id, month_number: 11,
          amount: SCHEME_INFO[customer.scheme]?.payout || 0,
          payment_date: payoutDate, payment_mode: payoutMode
        })
      });
      const data = await r.json();
      if (!r.ok) return flash(data.error || 'Failed');
      flash(`🎁 ${customer.name} — பரிசு வழங்கப்பட்டது`);
      sendWhatsAppMsg(customer, data, 'payout');
      setPayoutTarget(null);
      fetchAll();
    } catch (e) { flash(e.message); }
    setSaving(false);
  };

  // ── Contact picker (Android Chrome/PWA only) ────────────────────────────────
  const pickContact = async (target) => {
    if (!contactPickerSupported) {
      return flash('📇 இந்த சாதனத்தில் Contacts தேர்வு ஆதரிக்கப்படவில்லை (Android Chrome மட்டும்)');
    }
    try {
      const results = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!results.length) return;
      const contact = results[0];
      const name = contact.name?.[0] || '';
      let phone = (contact.tel?.[0] || '').replace(/\D/g, '');
      if (phone.length > 10) phone = phone.slice(-10);
      if (target === 'add') {
        setForm(f => ({ ...f, name: name || f.name, mobile: phone || f.mobile }));
      } else {
        setEditForm(f => ({ ...f, name: name || f.name, mobile: phone || f.mobile }));
      }
    } catch (err) {
      // AbortError = user cancelled the picker — not an error worth surfacing.
      // Anything else (NotAllowedError, SecurityError, etc.) means something's
      // actually broken, so show it instead of failing silently.
      if (err?.name !== 'AbortError') {
        flash(`📇 Contacts பிழை: ${err?.message || err?.name || 'Unknown error'}`);
      }
    }
  };

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const sendWhatsAppMsg = (customer, payment, type) => {
    const monthIdx = (customer.payment_months || []).indexOf(payment.payment_month);
    const mNum = monthIdx + 1;
    const remaining = 10 - mNum;
    const nextMonthIdx = monthIdx + 1;
    const nextMonth = customer.payment_months?.[nextMonthIdx];
    const schemeInfo = SCHEME_INFO[customer.scheme] || {};

    let text = '';
    if (type === 'payout') {
      text =
`🎉 *OM SAI MURUGAN FINANCE*
*Festival Fund – Payout*

வணக்கம் ${customer.name} அவர்களே,
உங்கள் Scheme ${customer.scheme} முடிந்தது!
தொகை ₹${(payment.amount||0).toLocaleString('en-IN')} மற்றும் ${schemeInfo.gift||''} வழங்கப்பட்டது.
முறை: ${(payment.payment_mode||'cash').toUpperCase()}
தேதி: ${fmtDate(payment.payment_date)}
திருவிழா வாழ்த்துக்கள்! 🎉

– *OM SAI MURUGAN FINANCE*
  📞 ${PHONE}`;
    } else if (type === 'received') {
      text =
`🎉 *OM SAI MURUGAN FINANCE*
*Festival Fund – Payment Received*

✅ பணம் பெறப்பட்டது

👤 பெயர்: ${customer.name}
👨 தந்தை பெயர்: ${customer.father_name}
📱 கைபேசி: ${customer.mobile}

💰 திட்டம்: Scheme ${customer.scheme} – ₹${customer.scheme_amount.toLocaleString('en-IN')}/மாதம்
📅 மாதம்: ${fmtFull(payment.payment_month)} (மாதம் ${mNum} / 10)
💵 செலுத்திய தொகை: ₹${(payment.amount||0).toLocaleString('en-IN')}
🧾 முறை: ${(payment.payment_mode||'cash').toUpperCase()}
📆 தேதி: ${fmtDate(payment.payment_date)}

📊 முன்னேற்றம்: ${mNum}/10 months ✓
${remaining > 0 ? `⏳ மீதமுள்ளது: ${remaining} months\n🙏 நன்றி! அடுத்த மாதம்: ${nextMonth ? fmtFull(nextMonth) : ''}` : `🎊 அனைத்து மாதங்களும் முடிந்தன! திருவிழா அன்று உங்கள் பரிசு வழங்கப்படும்.`}

– *OM SAI MURUGAN FINANCE*
  📞 ${PHONE}`;
    } else {
      text =
`🔔 *OM SAI MURUGAN FINANCE*
*Festival Fund – Payment Reminder*

⚠️ நினைவூட்டல்

👤 பெயர்: ${customer.name}
👨 தந்தை பெயர்: ${customer.father_name}
📱 கைபேசி: ${customer.mobile}

💰 திட்டம்: Scheme ${customer.scheme} – ₹${customer.scheme_amount.toLocaleString('en-IN')}/மாதம்
📅 நடப்பு மாதம்: ${fmtFull(selMonth)} (மாதம் ${mNum > 0 ? mNum : '?'} / 10)
💵 செலுத்த வேண்டியது: ₹${customer.scheme_amount.toLocaleString('en-IN')}

❌ இந்த மாதம் இன்னும் செலுத்தவில்லை

🙏 தயவுசெய்து இந்த மாதம் செலுத்துங்கள்.

– *OM SAI MURUGAN FINANCE*
  📞 ${PHONE}`;
    }
    window.open(`https://wa.me/91${customer.mobile}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const sendReminderWA = (customer) => sendWhatsAppMsg(customer, { payment_month: selMonth }, 'reminder');

  const sendAllReminders = () => {
    unpaidThisMonth.forEach((c, i) => {
      setTimeout(() => sendReminderWA(c), i * 800);
    });
  };

  // ── Print receipt ─────────────────────────────────────────────────────────
  const printReceipt = (customer, payment) => {
    const monthIdx = (customer.payment_months || []).indexOf(payment.payment_month);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:80mm auto;margin:4mm}
body{font-family:Arial,sans-serif;font-size:11px;color:#000;text-align:center;}
h2{font-size:13px;margin:4px 0;}
.line{border-top:1px dashed #000;margin:6px 0;}
.row{display:flex;justify-content:space-between;margin:3px 0;}
.bold{font-weight:700;}
</style></head><body>
<h2>OM SAI MURUGAN FINANCE</h2>
<div style="font-size:9px;">9, Kovil Street, Peddur, Alangayam | Ph: ${PHONE}</div>
<div class="line"></div>
<div class="bold" style="font-size:12px;">🎉 FESTIVAL FUND RECEIPT</div>
<div class="line"></div>
<div class="row"><span>Name:</span><span class="bold">${customer.name}</span></div>
<div class="row"><span>Father:</span><span>${customer.father_name}</span></div>
<div class="row"><span>Mobile:</span><span>${customer.mobile}</span></div>
<div class="row"><span>Scheme:</span><span>Scheme ${customer.scheme} (₹${customer.scheme_amount.toLocaleString('en-IN')}/month)</span></div>
<div class="row"><span>Month:</span><span>${fmtFull(payment.payment_month)} (${monthIdx+1}/10)</span></div>
<div class="row"><span>Amount Paid:</span><span class="bold">₹${(payment.amount||0).toLocaleString('en-IN')}</span></div>
<div class="row"><span>Date:</span><span>${fmtDate(payment.payment_date)}</span></div>
<div class="line"></div>
<div style="font-size:10px;">Thank you! 🙏</div>
</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { try { document.body.removeChild(iframe); } catch(_){} }, 2000);
    }, 600);
  };

  // ── Print monthly audit ───────────────────────────────────────────────────
  const printMonthlyAudit = () => {
    const paidRows = paidThisMonth.map((c, i) => {
      const pay = paymentMap[c.id]?.[selMonth];
      const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
      return `<tr style="background:${i%2===0?'#f0fdf4':'white'}">
        <td>${i+1}</td><td>${c.name}</td><td>S${c.scheme}</td>
        <td>M${mNum}/10</td><td>₹${c.scheme_amount.toLocaleString('en-IN')}</td>
        <td>${pay ? fmtDate(pay.payment_date) : '-'}</td>
        <td style="color:#15803d;font-weight:700;">✓ PAID</td>
      </tr>`;
    }).join('');
    const unpaidRows = unpaidThisMonth.map((c, i) => {
      const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
      return `<tr style="background:${i%2===0?'#fef2f2':'white'}">
        <td>${paidThisMonth.length+i+1}</td><td>${c.name}</td><td>S${c.scheme}</td>
        <td>M${mNum}/10</td><td>₹${c.scheme_amount.toLocaleString('en-IN')}</td>
        <td>-</td>
        <td style="color:#dc2626;font-weight:700;">✗ UNPAID</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:A4;margin:10mm}
body{font-family:Arial,sans-serif;font-size:11px;}
h2{text-align:center;font-size:14px;margin:0 0 4px;}
.sub{text-align:center;font-size:10px;color:#555;margin-bottom:10px;}
table{width:100%;border-collapse:collapse;font-size:10px;}
th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;}
th{background:#1e293b;color:white;}
.summary{display:flex;gap:20px;margin-bottom:10px;}
.sum{background:#f8fafc;border:1px solid #ddd;border-radius:6px;padding:8px 14px;text-align:center;}
.sum strong{display:block;font-size:16px;}
</style></head><body>
<h2>OM SAI MURUGAN FINANCE – Festival Fund</h2>
<div class="sub">Monthly Audit: ${fmtFull(selMonth)} | Generated: ${fmtDate(todayISO())}</div>
<div class="summary">
  <div class="sum"><strong>${dueThisMonth.length}</strong>Total Due</div>
  <div class="sum" style="color:#15803d"><strong>${paidThisMonth.length}</strong>Paid</div>
  <div class="sum" style="color:#dc2626"><strong>${unpaidThisMonth.length}</strong>Unpaid</div>
  <div class="sum"><strong>₹${(stats?.collected_amount||0).toLocaleString('en-IN')}</strong>Collected</div>
</div>
<table><thead><tr><th>#</th><th>Name</th><th>Scheme</th><th>Month</th><th>Amount</th><th>Paid On</th><th>Status</th></tr></thead>
<tbody>${paidRows}${unpaidRows}</tbody></table>
</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { try { document.body.removeChild(iframe); } catch(_){} }, 2000);
    }, 600);
  };

  // ── PDF export ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const paidRows = paidThisMonth.map((c, i) => {
      const pay = paymentMap[c.id]?.[selMonth];
      const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
      return `<tr style="background:${i%2===0?'#f0fdf4':'white'}">
        <td>${i+1}</td><td>${c.name}</td><td>${c.father_name}</td><td>${c.mobile}</td>
        <td>S${c.scheme}</td><td>M${mNum}/10</td>
        <td>₹${c.scheme_amount.toLocaleString('en-IN')}</td>
        <td>${pay ? fmtDate(pay.payment_date) : '-'}</td>
        <td style="color:#15803d;font-weight:700;">✓ PAID</td>
      </tr>`;
    }).join('');
    const unpaidRows = unpaidThisMonth.map((c, i) => {
      const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
      return `<tr style="background:${i%2===0?'#fef2f2':'white'}">
        <td>${paidThisMonth.length+i+1}</td><td>${c.name}</td><td>${c.father_name}</td><td>${c.mobile}</td>
        <td>S${c.scheme}</td><td>M${mNum}/10</td>
        <td>₹${c.scheme_amount.toLocaleString('en-IN')}</td>
        <td>-</td>
        <td style="color:#dc2626;font-weight:700;">✗ UNPAID</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:A4 landscape;margin:10mm}
body{font-family:Arial,sans-serif;font-size:10px;}
h2{text-align:center;font-size:14px;margin:0 0 3px;}
.sub{text-align:center;font-size:10px;color:#555;margin-bottom:10px;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;}
th{background:#1e293b;color:white;font-size:10px;}
.sum{display:inline-block;background:#f8fafc;border:1px solid #ddd;border-radius:6px;padding:6px 14px;text-align:center;margin:0 6px 10px;}
.sum strong{display:block;font-size:15px;}
</style></head><body>
<h2>OM SAI MURUGAN FINANCE — Festival Fund</h2>
<div class="sub">Monthly Report: ${fmtFull(selMonth)} &nbsp;|&nbsp; Generated: ${fmtDate(todayISO())}</div>
<div style="text-align:center;margin-bottom:10px;">
  <span class="sum"><strong>${dueThisMonth.length}</strong>Total Due</span>
  <span class="sum" style="color:#15803d"><strong>${paidThisMonth.length}</strong>Paid</span>
  <span class="sum" style="color:#dc2626"><strong>${unpaidThisMonth.length}</strong>Unpaid</span>
  <span class="sum"><strong>₹${(stats?.collected_amount||0).toLocaleString('en-IN')}</strong>Collected</span>
  <span class="sum" style="color:#dc2626"><strong>₹${(stats?.pending_amount||0).toLocaleString('en-IN')}</strong>Pending</span>
</div>
<table><thead><tr><th>#</th><th>Name</th><th>Father</th><th>Mobile</th><th>Scheme</th><th>Month</th><th>Amount</th><th>Paid On</th><th>Status</th></tr></thead>
<tbody>${paidRows}${unpaidRows}</tbody></table>
</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { try { document.body.removeChild(iframe); } catch(_){} }, 2000);
    }, 600);
  };

  // ── Nav helper ────────────────────────────────────────────────────────────
  const nav = (s) => { setSection(s); setSidebarOpen(false); };

  const completedCustomers = activeCustomers.filter(c =>
    (c.payment_months||[]).every(m => paymentMap[c.id]?.[m])
  );

  const NAV = [
    { id:'dashboard', icon:'📊', label:'Dashboard',        group:'Overview' },
    { id:'customers', icon:'👥', label:'All Customers',    group:'Customers', badge: completedCustomers.length > 0 ? completedCustomers.length : 0, badgeColor:'#15803d' },
    { id:'addcust',   icon:'➕', label:'Add Customer',     group:'Customers' },
    { id:'monthly',   icon:'📅', label:'Monthly Payments', badge:unpaidThisMonth.length, group:'Payments' },
    { id:'payment',   icon:'💰', label:'Record Payment',   group:'Payments' },
    { id:'reminder',  icon:'🔔', label:'Payment Reminder', badge:unpaidThisMonth.length, group:'Payments' },
    { id:'defaulters',icon:'🚨', label:'Defaulters',       badge:defaulters.length, group:'Payments' },
  ];

  const titles = { dashboard:'Dashboard', customers:'All Customers', addcust:'Add Customer', monthly:'Monthly Payments', payment:'Record Payment', reminder:'Payment Reminder', defaulters:'Defaulters' };

  // ── Month picker shared ───────────────────────────────────────────────────
  const MonthPicker = () => (
    <select
      value={selMonth}
      onChange={e => setSelMonth(e.target.value)}
      style={{ background:'#0f172a',border:'1px solid #334155',color:'#f1f5f9',padding:'6px 10px',borderRadius:8,fontSize:12 }}
    >
      {monthOptions().map(m => <option key={m} value={m}>{fmtFull(m)}</option>)}
    </select>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', color:'#f1f5f9' }}>

      {/* ── QUICK PAY MODAL ─────────────────────────────────────── */}
      {quickPay && (
        <div style={S.modal} onClick={() => setQuickPay(null)}>
          <div style={{ ...S.modalBox, maxWidth:340 }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:'16px 18px', background:'linear-gradient(135deg,#15803d,#166534)', borderRadius:'16px 16px 0 0' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'white' }}>💰 Quick Pay</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', marginTop:2 }}>{fmtFull(selMonth)}</div>
            </div>
            <div style={{ padding:'16px 18px' }}>
              {/* Customer info */}
              <div style={{ background:'#0f172a', borderRadius:10, padding:'10px 12px', marginBottom:14, border:'1px solid #334155' }}>
                <div style={{ fontSize:15, fontWeight:700 }}>{quickPay.customer.name}</div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>
                  Father: {quickPay.customer.father_name} &nbsp;|&nbsp; 📞 {quickPay.customer.mobile}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                  <span style={S.badge2(quickPay.customer.scheme===1?'#1e3a5f':'#3b1e5f', quickPay.customer.scheme===1?'#93c5fd':'#c4b5fd')}>
                    Scheme {quickPay.customer.scheme}
                  </span>
                  <span style={{ fontSize:16, fontWeight:800, color:'#f59e0b' }}>
                    ₹{quickPay.customer.scheme_amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Date picker */}
              <label style={S.label}>Payment Date</label>
              <input
                style={S.input}
                type="date"
                value={quickDate}
                onChange={e => setQuickDate(e.target.value)}
              />

              {/* Payment mode */}
              <label style={S.label}>Payment Mode</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                {['cash','upi','bank'].map(mode => (
                  <div key={mode}
                    onClick={() => setQuickMode(mode)}
                    style={{
                      padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', fontSize:11, fontWeight:700, textTransform:'uppercase',
                      border:`2px solid ${quickMode===mode?'#f59e0b':'#334155'}`,
                      background: quickMode===mode?'#1c1400':'#0f172a',
                      color: quickMode===mode?'#f59e0b':'#94a3b8'
                    }}>
                    {mode}
                  </div>
                ))}
              </div>

              {/* Confirm */}
              <button
                style={S.primaryBtn('linear-gradient(135deg,#15803d,#166534)')}
                disabled={saving}
                onClick={quickRecordPayment}
              >
                {saving ? '⏳ Recording...' : `✅ Confirm Payment — ₹${quickPay.customer.scheme_amount.toLocaleString('en-IN')}`}
              </button>
              <button
                onClick={() => setQuickPay(null)}
                style={{ width:'100%', padding:10, background:'none', border:'1px solid #334155', borderRadius:8, color:'#94a3b8', fontSize:12, cursor:'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYOUT MODAL (month 11 — festival payout + gift handover) ──────── */}
      {payoutTarget && (
        <div style={S.modal} onClick={() => setPayoutTarget(null)}>
          <div style={{ ...S.modalBox, maxWidth:340 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 18px', background:'linear-gradient(135deg,#d97706,#b45309)', borderRadius:'16px 16px 0 0' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'white' }}>🎁 திருவிழா பரிசு வழங்கல்</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', marginTop:2 }}>{payoutTarget.name}</div>
            </div>
            <div style={{ padding:'16px 18px' }}>
              <div style={{ background:'#0f172a', borderRadius:10, padding:'10px 12px', marginBottom:14, border:'1px solid #334155' }}>
                <div style={{ fontSize:15, fontWeight:700 }}>{payoutTarget.name}</div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Scheme {payoutTarget.scheme}</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#f59e0b', marginTop:6 }}>
                  ₹{(SCHEME_INFO[payoutTarget.scheme]?.payout||0).toLocaleString('en-IN')} + {SCHEME_INFO[payoutTarget.scheme]?.gift}
                </div>
              </div>

              <label style={S.label}>Date</label>
              <input style={S.input} type="date" value={payoutDate} onChange={e => setPayoutDate(e.target.value)} />

              <label style={S.label}>Payment Mode</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                {['cash','upi','bank'].map(mode => (
                  <div key={mode}
                    onClick={() => setPayoutMode(mode)}
                    style={{
                      padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', fontSize:11, fontWeight:700, textTransform:'uppercase',
                      border:`2px solid ${payoutMode===mode?'#f59e0b':'#334155'}`,
                      background: payoutMode===mode?'#1c1400':'#0f172a',
                      color: payoutMode===mode?'#f59e0b':'#94a3b8'
                    }}>
                    {mode}
                  </div>
                ))}
              </div>

              <button
                style={S.primaryBtn('linear-gradient(135deg,#d97706,#b45309)')}
                disabled={saving}
                onClick={recordPayout}
              >
                {saving ? '⏳ Recording...' : '🎁 பரிசு வழங்கியதை பதிவு செய்யவும்'}
              </button>
              <button
                onClick={() => setPayoutTarget(null)}
                style={{ width:'100%', padding:10, background:'none', border:'1px solid #334155', borderRadius:8, color:'#94a3b8', fontSize:12, cursor:'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flash message */}
      {msg && (
        <div style={{ position:'fixed',top:56,left:0,right:0,zIndex:400,padding:'10px 16px',background:'#1e3a5f',color:'#93c5fd',fontSize:13,textAlign:'center',borderBottom:'1px solid #334155' }}>
          {msg}
        </div>
      )}

      {/* Sidebar overlay */}
      {sidebarOpen && <div style={S.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div style={S.sidebar(sidebarOpen)}>
        <div style={S.sideHead}>
          <button style={S.closeBtn} onClick={() => setSidebarOpen(false)}>✕</button>
          <div style={{ fontSize:26, marginBottom:6 }}>🎉</div>
          <div style={{ fontSize:16, fontWeight:800, color:'white' }}>Festival Fund</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', marginTop:2 }}>10-Month Savings Scheme</div>
        </div>

        <div style={{ flex:1, overflowY:'auto', paddingBottom:8 }}>
          {['Overview','Customers','Payments'].map(group => {
            const items = NAV.filter(n => n.group === group);
            return (
              <div key={group}>
                <div style={S.navLabel}>{group}</div>
                {items.map(n => (
                  <div key={n.id} style={S.navItem(section === n.id)} onClick={() => nav(n.id)}>
                    <span style={{ width:18, textAlign:'center' }}>{n.icon}</span>
                    {n.label}
                    {n.badge > 0 && <span style={S.badge(n.badgeColor || '#dc2626')}>{n.badge}</span>}
                  </div>
                ))}
                {group !== 'Payments' && <div style={S.navDivider} />}
              </div>
            );
          })}
        </div>

        <div style={{ padding:'12px 16px', borderTop:'1px solid #334155', fontSize:10, color:'#475569', textAlign:'center' }}>
          OM SAI MURUGAN FINANCE
        </div>
      </div>

      {/* Top bar */}
      <div style={S.topbar}>
        <button style={S.burger} onClick={() => setSidebarOpen(true)}>
          <span style={S.burgerLine} /><span style={S.burgerLine} /><span style={S.burgerLine} />
        </button>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#f59e0b' }}>🎉 Festival Fund</div>
          <div style={{ fontSize:10, color:'#94a3b8' }}>{titles[section]}</div>
        </div>
        {navigateTo && (
          <button onClick={() => navigateTo('module-select')} style={{ marginLeft:'auto',background:'none',border:'1px solid #334155',color:'#94a3b8',padding:'5px 10px',borderRadius:7,fontSize:11,cursor:'pointer' }}>
            ← Back
          </button>
        )}
      </div>

      {/* ─── DASHBOARD ─────────────────────────────────────────── */}
      {section === 'dashboard' && (
        <div style={S.page}>
          {/* Rules card */}
          <div style={S.card}>
            <div
              onClick={() => setRulesOpen(o => !o)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
            >
              <span style={{ fontSize:13, fontWeight:700, color:'#f59e0b' }}>📜 விதிமுறைகள் (Scheme Rules)</span>
              <span style={{ fontSize:12, color:'#94a3b8' }}>{rulesOpen ? '▲' : '▼'}</span>
            </div>
            {rulesOpen && (
              <ol style={{ margin:'10px 0 0', paddingLeft:18, fontSize:12, color:'#cbd5e1', lineHeight:1.7 }}>
                {FESTIVAL_RULES.map((r, i) => <li key={i} style={{ marginBottom:6 }}>{r}</li>)}
              </ol>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
            {[
              { num: stats?.total_customers ?? '—', lbl:'Total Members', color:'#f59e0b' },
              { num: stats?.paid_this_month  ?? '—', lbl:'Paid This Month', color:'#4ade80' },
              { num: stats?.unpaid_this_month ?? '—', lbl:'Pending', color:'#f87171' },
            ].map((s,i) => (
              <div key={i} style={{ background:'#1e293b',borderRadius:10,padding:'12px 8px',textAlign:'center',border:'1px solid #334155' }}>
                <div style={{ fontSize:22,fontWeight:800,color:s.color }}>{loading?'…':s.num}</div>
                <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            {[
              { title:'Scheme 1 — ₹1,000', count:stats?.scheme1_count, bg:'linear-gradient(135deg,#1e3a5f,#1e293b)', tc:'#93c5fd', amt:`₹${((stats?.scheme1_count||0)*1000).toLocaleString('en-IN')}/month`, info:SCHEME_INFO[1] },
              { title:'Scheme 2 — ₹2,000', count:stats?.scheme2_count, bg:'linear-gradient(135deg,#3b1e5f,#1e293b)', tc:'#c4b5fd', amt:`₹${((stats?.scheme2_count||0)*2000).toLocaleString('en-IN')}/month`, info:SCHEME_INFO[2] },
            ].map((s,i) => (
              <div key={i} style={{ background:s.bg,borderRadius:10,padding:13,textAlign:'center',border:'1px solid #334155' }}>
                <div style={{ fontSize:11,fontWeight:700,color:s.tc,marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:22,fontWeight:800,color:'white' }}>{loading?'…':s.count}</div>
                <div style={{ fontSize:9,color:'#94a3b8' }}>members</div>
                <div style={{ fontSize:10,color:s.tc,marginTop:5 }}>{s.amt}</div>
                <div style={{ fontSize:9,color:'#fbbf24',marginTop:6,paddingTop:6,borderTop:'1px solid #334155' }}>
                  🎁 முடிவில்: ₹{s.info.payout.toLocaleString('en-IN')} + {s.info.gift}
                </div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700 }}>📅 Monthly Summary</span>
              <MonthPicker />
            </div>
            <div style={S.summRow}>
              <div style={S.sumItem}><div style={{ fontSize:14,fontWeight:700,color:'#4ade80' }}>₹{(stats?.collected_amount||0).toLocaleString('en-IN')}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Collected ({stats?.paid_this_month||0})</div></div>
              <div style={{ ...S.sumItem, borderLeft:'1px solid #334155' }}><div style={{ fontSize:14,fontWeight:700,color:'#f87171' }}>₹{(stats?.pending_amount||0).toLocaleString('en-IN')}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Pending ({stats?.unpaid_this_month||0})</div></div>
              <div style={{ ...S.sumItem, borderLeft:'1px solid #334155' }}><div style={{ fontSize:14,fontWeight:700,color:'#fbbf24' }}>₹{((stats?.collected_amount||0)+(stats?.pending_amount||0)).toLocaleString('en-IN')}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Total Due</div></div>
            </div>
            <button onClick={printMonthlyAudit} style={S.primaryBtn('linear-gradient(135deg,#7c3aed,#6d28d9)')}>🖨️ Print Monthly Audit</button>
            <button onClick={() => nav('addcust')} style={S.primaryBtn('linear-gradient(135deg,#d97706,#b45309)')}>➕ Add New Customer</button>
          </div>

          {/* Pending reminder banner */}
          {unpaidThisMonth.length > 0 && (
            <div
              onClick={() => nav('reminder')}
              style={{ ...S.card, cursor:'pointer', background:'linear-gradient(135deg,#78350f,#92400e)', border:'1px solid #b45309', display:'flex', alignItems:'center', gap:10 }}
            >
              <span style={{ fontSize:22 }}>🔔</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'white' }}>{unpaidThisMonth.length} பேர் இந்த மாதம் இன்னும் செலுத்தவில்லை</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:2 }}>நினைவூட்டல் அனுப்ப தட்டவும் →</div>
              </div>
            </div>
          )}

          {/* Payout pending list */}
          {payoutPending.length > 0 && (
            <div
              onClick={() => nav('customers')}
              style={{ ...S.card, cursor:'pointer', background:'linear-gradient(135deg,#14532d,#166534)', border:'1px solid #15803d', display:'flex', alignItems:'center', gap:10 }}
            >
              <span style={{ fontSize:22 }}>🎁</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'white' }}>{payoutPending.length} பேருக்கு 10/10 முடிந்தது — பரிசு இன்னும் வழங்கப்படவில்லை</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:2 }}>விவரங்களுக்கு தட்டவும் →</div>
              </div>
            </div>
          )}

          {/* This month's Paid / Unpaid — full list with actions, same as Monthly Payments */}
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700 }}>✅ {fmtFull(selMonth)} — Paid / Unpaid</span>
              <MonthPicker />
            </div>

            {dueThisMonth.length === 0 && !loading && (
              <div style={{ textAlign:'center',color:'#64748b',padding:'20px 0',fontSize:13 }}>No payments due for this month</div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>
              {/* PAID column */}
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'#4ade80',padding:'5px 0',marginBottom:5,borderBottom:'1px solid #334155' }}>
                  ✓ PAID ({paidThisMonth.length})
                </div>
                {paidThisMonth.map(c => {
                  const pay = paymentMap[c.id]?.[selMonth];
                  const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
                  return (
                    <div key={c.id} style={S.crow('paid')}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:700 }}>
                          {c.name}
                          <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f', c.scheme===1?'#93c5fd':'#c4b5fd'), marginLeft:5 }}>S{c.scheme} ₹{c.scheme_amount/1000}K</span>
                        </div>
                        <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>
                          {c.father_name} | {c.mobile} | M{mNum}/10 | Paid: {pay ? fmtDate(pay.payment_date) : ''} {pay?.payment_mode ? `(${pay.payment_mode.toUpperCase()})` : ''}
                        </div>
                      </div>
                      <div style={{ ...S.row, flexWrap:'wrap' }}>
                        <span style={{ background:'#14532d',color:'#4ade80',padding:'3px 6px',borderRadius:5,fontSize:9,fontWeight:700 }}>✓</span>
                        <button style={S.btn('#25d366')} onClick={() => sendWhatsAppMsg(c, pay, 'received')}>WA</button>
                        <button style={S.btn('#475569')} onClick={() => printReceipt(c, pay)}>🖨</button>
                        <button style={S.btn('#b45309')} onClick={() => undoPayment(pay.id, c.name)}>Undo</button>
                      </div>
                    </div>
                  );
                })}
                {paidThisMonth.length === 0 && !loading && (
                  <div style={{ textAlign:'center',color:'#64748b',padding:'12px 0',fontSize:12 }}>—</div>
                )}
              </div>

              {/* UNPAID column */}
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'#f87171',padding:'5px 0',marginBottom:5,borderBottom:'1px solid #334155' }}>
                  ✗ UNPAID ({unpaidThisMonth.length})
                </div>
                {unpaidThisMonth.map(c => {
                  const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
                  return (
                    <div key={c.id} style={S.crow('unpaid')}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:700 }}>
                          {c.name}
                          <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f', c.scheme===1?'#93c5fd':'#c4b5fd'), marginLeft:5 }}>S{c.scheme} ₹{c.scheme_amount/1000}K</span>
                        </div>
                        <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>
                          {c.father_name} | {c.mobile} | M{mNum}/10 | Due: ₹{c.scheme_amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div style={{ ...S.row, flexWrap:'wrap' }}>
                        <button style={S.btn('#15803d')} onClick={() => { setQuickDate(todayISO()); setQuickMode('cash'); setQuickPay({ customer: c }); }}>Pay</button>
                        <button style={S.btn('#25d366')} onClick={() => sendReminderWA(c)}>WA</button>
                      </div>
                    </div>
                  );
                })}
                {unpaidThisMonth.length === 0 && !loading && (
                  <div style={{ textAlign:'center',color:'#64748b',padding:'12px 0',fontSize:12 }}>—</div>
                )}
              </div>
            </div>
          </div>

          {/* Referral leaderboard */}
          {referrers.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize:13, fontWeight:700, color:'#f59e0b', marginBottom:10 }}>🎁 அறிமுக பட்டியல் (Referral Leaderboard)</div>
              {referrers.map(c => {
                const count = referralCounts[c.id] || 0;
                const qualifies = count >= REFERRAL_BADGE_THRESHOLD;
                return (
                  <div key={c.id} style={{ ...S.crow(qualifies ? 'paid' : 'pending'), borderLeft:`3px solid ${qualifies?'#4ade80':'#f59e0b'}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700 }}>
                        {c.name}
                        {qualifies && <span style={{ marginLeft:6 }}>🎁</span>}
                      </div>
                      <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>📞 {c.mobile}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:16, fontWeight:800, color: qualifies ? '#4ade80' : '#f59e0b' }}>{count}</div>
                      <div style={{ fontSize:8, color:'#94a3b8' }}>referrals</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MONTHLY PAYMENTS ──────────────────────────────────── */}
      {section === 'monthly' && (
        <div style={S.page}>
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700 }}>📅 Monthly Payments</span>
              <MonthPicker />
            </div>
            <div style={S.summRow}>
              <div style={S.sumItem}><div style={{ fontSize:16,fontWeight:700,color:'#4ade80' }}>{paidThisMonth.length}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Paid</div></div>
              <div style={{ ...S.sumItem,borderLeft:'1px solid #334155' }}><div style={{ fontSize:16,fontWeight:700,color:'#f87171' }}>{unpaidThisMonth.length}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Unpaid</div></div>
              <div style={{ ...S.sumItem,borderLeft:'1px solid #334155' }}><div style={{ fontSize:16,fontWeight:700,color:'#fbbf24' }}>{dueThisMonth.length}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Total</div></div>
            </div>
            <button onClick={printMonthlyAudit} style={S.primaryBtn('linear-gradient(135deg,#7c3aed,#6d28d9)')}>🖨️ Print Monthly Audit</button>

            {dueThisMonth.length === 0 && !loading && (
              <div style={{ textAlign:'center',color:'#64748b',padding:'20px 0',fontSize:13 }}>No payments due for this month</div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>
              {/* PAID column */}
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'#4ade80',padding:'5px 0',marginBottom:5,borderBottom:'1px solid #334155' }}>
                  ✓ PAID ({paidThisMonth.length})
                </div>
                {paidThisMonth.map(c => {
                  const pay = paymentMap[c.id]?.[selMonth];
                  const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
                  return (
                    <div key={c.id} style={S.crow('paid')}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:700 }}>
                          {c.name}
                          <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f', c.scheme===1?'#93c5fd':'#c4b5fd'), marginLeft:5 }}>S{c.scheme} ₹{c.scheme_amount/1000}K</span>
                        </div>
                        <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>
                          {c.father_name} | {c.mobile} | M{mNum}/10 | Paid: {pay ? fmtDate(pay.payment_date) : ''} {pay?.payment_mode ? `(${pay.payment_mode.toUpperCase()})` : ''}
                        </div>
                      </div>
                      <div style={{ ...S.row, flexWrap:'wrap' }}>
                        <span style={{ background:'#14532d',color:'#4ade80',padding:'3px 6px',borderRadius:5,fontSize:9,fontWeight:700 }}>✓</span>
                        <button style={S.btn('#25d366')} onClick={() => sendWhatsAppMsg(c, pay, 'received')}>WA</button>
                        <button style={S.btn('#475569')} onClick={() => printReceipt(c, pay)}>🖨</button>
                        <button style={S.btn('#b45309')} onClick={() => undoPayment(pay.id, c.name)}>Undo</button>
                      </div>
                    </div>
                  );
                })}
                {paidThisMonth.length === 0 && !loading && (
                  <div style={{ textAlign:'center',color:'#64748b',padding:'12px 0',fontSize:12 }}>—</div>
                )}
              </div>

              {/* UNPAID column */}
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'#f87171',padding:'5px 0',marginBottom:5,borderBottom:'1px solid #334155' }}>
                  ✗ UNPAID ({unpaidThisMonth.length})
                </div>
                {unpaidThisMonth.map(c => {
                  const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
                  return (
                    <div key={c.id} style={S.crow('unpaid')}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:700 }}>
                          {c.name}
                          <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f', c.scheme===1?'#93c5fd':'#c4b5fd'), marginLeft:5 }}>S{c.scheme} ₹{c.scheme_amount/1000}K</span>
                        </div>
                        <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>
                          {c.father_name} | {c.mobile} | M{mNum}/10 | Due: ₹{c.scheme_amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div style={{ ...S.row, flexWrap:'wrap' }}>
                        <button style={S.btn('#15803d')} onClick={() => { setQuickDate(todayISO()); setQuickMode('cash'); setQuickPay({ customer: c }); }}>Pay</button>
                        <button style={S.btn('#25d366')} onClick={() => sendReminderWA(c)}>WA</button>
                      </div>
                    </div>
                  );
                })}
                {unpaidThisMonth.length === 0 && !loading && (
                  <div style={{ textAlign:'center',color:'#64748b',padding:'12px 0',fontSize:12 }}>—</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD CUSTOMER ──────────────────────────────────────── */}
      {section === 'addcust' && (
        <div style={S.page}>
          <div style={S.card}>
            <div style={{ textAlign:'center',marginBottom:14 }}>
              <div style={{ fontSize:28 }}>🎉</div>
              <div style={{ fontSize:15,fontWeight:700,color:'#f59e0b',marginTop:4 }}>Register New Member</div>
              <div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>Festival Fund – 10 Month Scheme</div>
            </div>

            <button
              type="button"
              onClick={() => pickContact('add')}
              style={{ width:'100%', padding:10, marginBottom:14, background:'#0f172a', border:'1px dashed #f59e0b', borderRadius:8, color:'#f59e0b', fontSize:12, fontWeight:600, cursor:'pointer' }}
            >
              📇 Contacts-ல் இருந்து தேர்வு செய்யவும்
            </button>
            {!contactPickerSupported && (
              <div style={{ fontSize:9, color:'#64748b', marginTop:-10, marginBottom:14 }}>
                (Contacts picker Android Chrome-ல் மட்டும் வேலை செய்யும்)
              </div>
            )}

            <label style={S.label}>Customer Name <span style={{ color:'#f87171' }}>*</span></label>
            <input style={S.input} placeholder="Enter full name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />

            <label style={S.label}>Father Name <span style={{ color:'#f87171' }}>*</span></label>
            <input style={S.input} placeholder="Enter father's name" value={form.father_name}
              onChange={e => setForm(f => ({ ...f, father_name:e.target.value }))} />

            <label style={S.label}>Mobile Number <span style={{ color:'#f87171' }}>*</span></label>
            <input style={S.input} type="tel" maxLength={10} placeholder="10-digit mobile" value={form.mobile}
              onChange={e => setForm(f => ({ ...f, mobile:e.target.value.replace(/\D/,'') }))} />

            <label style={S.label}>Wife / Husband Name <span style={{ color:'#475569' }}>(Optional)</span></label>
            <input style={S.input} placeholder="Spouse name" value={form.spouse_name}
              onChange={e => setForm(f => ({ ...f, spouse_name:e.target.value }))} />

            <label style={S.label}>அறிமுகப்படுத்தியவர் <span style={{ color:'#475569' }}>(Referred By — Optional)</span></label>
            <select
              style={S.input}
              value={form.referred_by}
              onChange={e => setForm(f => ({ ...f, referred_by:e.target.value }))}
            >
              <option value="">— யாரும் இல்லை —</option>
              {activeCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.mobile})</option>
              ))}
            </select>

            <label style={S.label}>Select Scheme <span style={{ color:'#f87171' }}>*</span></label>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14 }}>
              {[1,2].map(s => (
                <div key={s}
                  onClick={() => setForm(f => ({ ...f, scheme:s }))}
                  style={{
                    padding:'14px 10px',borderRadius:10,cursor:'pointer',textAlign:'center',fontSize:12,fontWeight:600,
                    border:`2px solid ${form.scheme===s?'#f59e0b':'#334155'}`,
                    background: form.scheme===s?'#1c1400':'#0f172a',
                    color: form.scheme===s?'#f59e0b':'#94a3b8'
                  }}>
                  <div style={{ fontSize:20,fontWeight:800,marginBottom:2 }}>₹{s===1?'1,000':'2,000'}</div>
                  <div>Scheme {s}</div>
                  <div style={{ fontSize:9,opacity:.7 }}>10 months = ₹{s===1?'10,000':'20,000'}</div>
                  <div style={{ fontSize:9,opacity:.85,marginTop:3,color:'#fbbf24' }}>
                    🎁 ₹{SCHEME_INFO[s].payout.toLocaleString('en-IN')} + {SCHEME_INFO[s].gift}
                  </div>
                </div>
              ))}
            </div>

            <label style={S.label}>
              சேரும் மாதம் (Join Month) <span style={{ color:'#f87171' }}>*</span>
              <span style={{ color:'#475569', fontWeight:400 }}> — இதுவே மாதம் 1</span>
            </label>
            <select
              style={S.input}
              value={form.join_month}
              onChange={e => setForm(f => ({ ...f, join_month:e.target.value }))}
            >
              {monthOptions().map(m => <option key={m} value={m}>{fmtFull(m)}</option>)}
            </select>

            <div style={{ background:'#0f172a',borderRadius:8,padding:'10px 12px',marginBottom:14,border:'1px solid #334155' }}>
              <div style={{ fontSize:10,color:'#94a3b8' }}>Payment Schedule (Month 1 → 10)</div>
              <div style={{ fontSize:12,fontWeight:700,color:'#f59e0b',marginTop:3 }}>
                {fmtFull(form.join_month)} → {fmtFull(getFestivalPaymentMonths(form.join_month)[9])}
              </div>
            </div>

            <button style={S.primaryBtn('linear-gradient(135deg,#d97706,#b45309)')} disabled={saving} onClick={addCustomer}>
              {saving ? '⏳ Registering...' : '✅ Register Customer'}
            </button>
          </div>
        </div>
      )}

      {/* ─── RECORD PAYMENT ────────────────────────────────────── */}
      {section === 'payment' && (
        <div style={S.page}>
          <div style={S.card}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700 }}>💰 Record Payment</span>
              <MonthPicker />
            </div>

            {/* Search */}
            <label style={S.label}>Search Customer</label>
            <input style={S.input} placeholder="🔍 Type name or mobile..."
              value={custSearch} onChange={e => { setCustSearch(e.target.value); setPayTarget(null); }} />

            {/* Customer list */}
            {!payTarget && custSearch.length > 0 && (() => {
              const results = customers.filter(c =>
                c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                c.mobile.includes(custSearch)
              ).filter(c => (c.payment_months||[]).includes(selMonth) && !paymentMap[c.id]?.[selMonth]);
              return results.length === 0
                ? <div style={{ color:'#64748b',fontSize:12,padding:'8px 0' }}>No matching customers with pending payment</div>
                : results.map(c => (
                    <div key={c.id} onClick={() => setPayTarget(c)}
                      style={{ ...S.crow('unpaid'), cursor:'pointer', marginBottom:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12,fontWeight:700 }}>{c.name} <span style={S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f',c.scheme===1?'#93c5fd':'#c4b5fd')}>S{c.scheme}</span></div>
                        <div style={{ fontSize:9,color:'#94a3b8' }}>{c.father_name} | {c.mobile}</div>
                      </div>
                      <span style={{ color:'#f59e0b',fontSize:12 }}>›</span>
                    </div>
                  ));
            })()}

            {/* Selected customer detail */}
            {payTarget && (
              <>
                <div style={{ background:'#0f172a',borderRadius:10,padding:12,marginBottom:12,border:'1px solid #334155' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:15,fontWeight:700 }}>{payTarget.name}</div>
                      <div style={{ fontSize:10,color:'#94a3b8',marginTop:2 }}>Father: {payTarget.father_name} | 📞 {payTarget.mobile}</div>
                      <div style={{ fontSize:10,color:'#94a3b8',marginTop:2 }}>Scheme {payTarget.scheme} | ₹{payTarget.scheme_amount.toLocaleString('en-IN')}/month | Joined: {fmtFull(payTarget.join_month)}</div>
                    </div>
                    <span style={S.badge2(payTarget.scheme===1?'#1e3a5f':'#3b1e5f',payTarget.scheme===1?'#93c5fd':'#c4b5fd')}>S{payTarget.scheme}</span>
                  </div>
                  {/* Progress bar */}
                  {(() => {
                    const paid = (payTarget.payment_months||[]).filter(m => paymentMap[payTarget.id]?.[m]).length;
                    return (
                      <>
                        <div style={{ fontSize:9,color:'#94a3b8',marginTop:8 }}>Progress: {paid} of 10 months paid</div>
                        <div style={{ background:'#334155',borderRadius:4,height:5,marginTop:4 }}>
                          <div style={{ width:`${paid*10}%`,height:'100%',background:'#f59e0b',borderRadius:4 }} />
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Month chips */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10,fontWeight:600,color:'#94a3b8',marginBottom:6 }}>Payment Schedule:</div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                    {(payTarget.payment_months||[]).map((m,i) => {
                      const isPaid = !!paymentMap[payTarget.id]?.[m];
                      const isCur  = m === selMonth;
                      return (
                        <span key={m} style={S.chip(isPaid?'done':isCur?'cur':'todo')}>
                          {fmt(m)}{isPaid?' ✓':isCur?' ◀':''}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <label style={S.label}>Amount</label>
                <input style={{ ...S.input, color:'#f59e0b', fontWeight:700 }}
                  value={`₹${payTarget.scheme_amount.toLocaleString('en-IN')}`} readOnly />

                <label style={S.label}>Payment Date <span style={{ color:'#f87171' }}>*</span></label>
                <input style={S.input} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />

                <label style={S.label}>Payment Mode</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                  {['cash','upi','bank'].map(mode => (
                    <div key={mode}
                      onClick={() => setPayMode(mode)}
                      style={{
                        padding:'8px 4px', borderRadius:8, cursor:'pointer', textAlign:'center', fontSize:11, fontWeight:700, textTransform:'uppercase',
                        border:`2px solid ${payMode===mode?'#f59e0b':'#334155'}`,
                        background: payMode===mode?'#1c1400':'#0f172a',
                        color: payMode===mode?'#f59e0b':'#94a3b8'
                      }}>
                      {mode}
                    </div>
                  ))}
                </div>

                <button style={S.primaryBtn('linear-gradient(135deg,#15803d,#166534)')} disabled={saving}
                  onClick={() => recordPayment(payTarget)}>
                  {saving ? '⏳ Recording...' : `✅ Record Payment — ${fmtFull(selMonth)}`}
                </button>
                <button onClick={() => { setPayTarget(null); setCustSearch(''); }}
                  style={{ width:'100%',padding:10,background:'#1e293b',border:'1px solid #334155',borderRadius:8,color:'#94a3b8',fontSize:12,cursor:'pointer' }}>
                  ← Choose Different Customer
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── ALL CUSTOMERS ────────────────────────────────────── */}
      {section === 'customers' && (
        <div style={S.page}>
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700 }}>👥 All Members ({activeCustomers.length})</span>
              {completedCustomers.length > 0 && (
                <span style={{ background:'#14532d', color:'#4ade80', fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:700 }}>
                  {completedCustomers.length} Completed ✓
                </span>
              )}
            </div>

            <input
              style={S.input}
              placeholder="🔍 Search by name or mobile..."
              value={custListSearch}
              onChange={e => setCustListSearch(e.target.value)}
            />

            {loading && <div style={{ color:'#64748b', textAlign:'center', padding:20 }}>Loading...</div>}

            {/* Active customers */}
            {activeCustomers.filter(c => {
              const q = custListSearch.toLowerCase();
              return !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q);
            }).filter(c => !completedCustomers.some(cc => cc.id === c.id)).map(c => {
              const paidCount = (c.payment_months||[]).filter(m => paymentMap[c.id]?.[m]).length;
              const pct = Math.round(paidCount / 10 * 100);
              const overdue = isOverdue(c.payment_months, paidCount);
              const referralQualifies = (referralCounts[c.id] || 0) >= REFERRAL_BADGE_THRESHOLD;
              return (
                <div key={c.id}
                  onClick={() => setDetailCust(c)}
                  style={{ ...S.crow('pending'), cursor:'pointer', borderLeft:`3px solid ${overdue?'#dc2626':'#f59e0b'}`, flexDirection:'column', alignItems:'stretch', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>
                        {c.name}
                        <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f', c.scheme===1?'#93c5fd':'#c4b5fd'), marginLeft:6 }}>
                          S{c.scheme} ₹{c.scheme_amount/1000}K
                        </span>
                        {overdue && <span title="3+ மாதங்கள் நிலுவை" style={{ marginLeft:5 }}>⚠️</span>}
                        {referralQualifies && <span title="5+ referrals" style={{ marginLeft:4 }}>🎁</span>}
                      </div>
                      <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>
                        {c.father_name} &nbsp;|&nbsp; 📞 {c.mobile}
                        {c.spouse_name ? ` | 💑 ${c.spouse_name}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color: paidCount >= 10 ? '#4ade80' : '#f59e0b' }}>{paidCount}/10</div>
                      <div style={{ fontSize:8, color:'#94a3b8' }}>months</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:8, color:'#94a3b8' }}>Progress</span>
                      <span style={{ fontSize:8, color: pct >= 100 ? '#4ade80' : '#f59e0b' }}>{pct}%</span>
                    </div>
                    <div style={{ background:'#334155', borderRadius:4, height:4 }}>
                      <div style={{ width:`${pct}%`, height:'100%', background: pct >= 100 ? '#4ade80' : '#f59e0b', borderRadius:4, transition:'width .3s' }} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Completed customers */}
            {completedCustomers.filter(c => {
              const q = custListSearch.toLowerCase();
              return !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q);
            }).length > 0 && (
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'#4ade80', padding:'8px 0 5px', marginTop:8, borderBottom:'1px solid #334155' }}>
                  🎊 COMPLETED MEMBERS ({completedCustomers.length})
                </div>
                {completedCustomers.filter(c => {
                  const q = custListSearch.toLowerCase();
                  return !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q);
                }).map(c => (
                  <div key={c.id}
                    onClick={() => setDetailCust(c)}
                    style={{ ...S.crow('paid'), cursor:'pointer', borderLeft:'3px solid #4ade80' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>
                        {c.name}
                        <span style={{ ...S.badge2('#14532d','#4ade80'), marginLeft:6 }}>✓ Done</span>
                        <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f', c.scheme===1?'#93c5fd':'#c4b5fd'), marginLeft:4 }}>S{c.scheme}</span>
                      </div>
                      <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>
                        {c.father_name} &nbsp;|&nbsp; 📞 {c.mobile} &nbsp;|&nbsp; All 10 months paid
                      </div>
                    </div>
                    <span style={{ color:'#4ade80', fontSize:18 }}>🎊</span>
                  </div>
                ))}
              </>
            )}

            {activeCustomers.length === 0 && !loading && (
              <div style={{ textAlign:'center', color:'#64748b', padding:'30px 0', fontSize:13 }}>
                No members yet.<br />
                <button onClick={() => nav('addcust')} style={{ marginTop:10, ...S.btn('#d97706') }}>+ Add First Member</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CUSTOMER DETAIL MODAL ─────────────────────────────── */}
      {detailCust && (() => {
        const c = customers.find(x => x.id === detailCust.id) || detailCust;
        const paidCount = (c.payment_months||[]).filter(m => paymentMap[c.id]?.[m]).length;
        const isCompleted = paidCount >= 10;
        return (
          <div style={S.modal} onClick={() => setDetailCust(null)}>
            <div style={{ ...S.modalBox, maxWidth:440 }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding:'16px 18px', background: isCompleted ? 'linear-gradient(135deg,#14532d,#15803d)' : 'linear-gradient(135deg,#92400e,#b45309)', borderRadius:'16px 16px 0 0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:17, fontWeight:800, color:'white' }}>{c.name}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:3 }}>
                      Father: {c.father_name}
                      {c.spouse_name ? ` | Spouse: ${c.spouse_name}` : ''}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:1 }}>
                      📞 {c.mobile} &nbsp;|&nbsp; Scheme {c.scheme} — ₹{c.scheme_amount.toLocaleString('en-IN')}/mo
                    </div>
                    {c.referred_by && (
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:1 }}>
                        🙋 அறிமுகம்: {customers.find(x => x.id === c.referred_by)?.name || '—'}
                      </div>
                    )}
                    {(referralCounts[c.id] || 0) > 0 && (
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:1 }}>
                        🎁 அறிமுகப்படுத்தியது: {referralCounts[c.id]} பேர்{(referralCounts[c.id]||0) >= REFERRAL_BADGE_THRESHOLD ? ' — சிறப்பு பரிசு தகுதி!' : ''}
                      </div>
                    )}
                  </div>
                  {isCompleted && <span style={{ fontSize:22 }}>🎊</span>}
                </div>
                {isCompleted && (() => {
                  const payout = paymentMap[c.id]?.['payout'];
                  return (
                    <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(0,0,0,0.25)', borderRadius:8, fontSize:10, color:'#fde68a' }}>
                      <div>🎁 திருவிழா பரிசு: ₹{SCHEME_INFO[c.scheme]?.payout.toLocaleString('en-IN')} + {SCHEME_INFO[c.scheme]?.gift}</div>
                      {payout ? (
                        <div style={{ marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ color:'#4ade80', fontWeight:700 }}>✅ வழங்கப்பட்டது — {fmtDate(payout.payment_date)} ({(payout.payment_mode||'cash').toUpperCase()})</span>
                          <button style={S.btn('#b45309')} onClick={() => undoPayment(payout.id, c.name)}>Undo</button>
                        </div>
                      ) : (
                        <button
                          style={{ ...S.primaryBtn('linear-gradient(135deg,#d97706,#b45309)'), marginTop:6, marginBottom:0, padding:9, fontSize:12 }}
                          onClick={() => { setPayoutDate(todayISO()); setPayoutMode('cash'); setPayoutTarget(c); }}
                        >
                          🎁 பரிசு வழங்கியதை பதிவு செய்யவும்
                        </button>
                      )}
                    </div>
                  );
                })()}
                {/* Progress bar */}
                <div style={{ marginTop:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>Payment Progress</span>
                    <span style={{ fontSize:9, color:'white', fontWeight:700 }}>{paidCount}/10 months</span>
                  </div>
                  <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:4, height:6 }}>
                    <div style={{ width:`${paidCount*10}%`, height:'100%', background: isCompleted ? '#4ade80' : '#fbbf24', borderRadius:4 }} />
                  </div>
                </div>
              </div>

              <div style={{ padding:'14px 18px' }}>
                {/* Month chips */}
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', marginBottom:6 }}>Payment Timeline:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
                  {(c.payment_months||[]).map((m, i) => {
                    const pay = paymentMap[c.id]?.[m];
                    const isCur = m === selMonth;
                    return (
                      <div key={m} style={{ ...S.chip(pay ? 'done' : isCur ? 'cur' : 'todo'), display:'flex', flexDirection:'column', alignItems:'center', minWidth:56 }}>
                        <span style={{ fontSize:9, fontWeight:700 }}>M{i+1}</span>
                        <span style={{ fontSize:8 }}>{fmt(m)}</span>
                        {pay && <span style={{ fontSize:7, color:'#4ade80' }}>{fmtDate(pay.payment_date)}</span>}
                        {!pay && isCur && <span style={{ fontSize:7, color:'#f59e0b' }}>DUE</span>}
                      </div>
                    );
                  })}
                  {(() => {
                    const payout = paymentMap[c.id]?.['payout'];
                    const clickable = isCompleted && !payout;
                    return (
                      <div
                        onClick={() => {
                          if (!clickable) return;
                          setPayoutDate(todayISO());
                          setPayoutMode('cash');
                          setPayoutTarget(c);
                        }}
                        style={{
                          ...S.chip(payout ? 'done' : 'todo'),
                          display:'flex', flexDirection:'column', alignItems:'center', minWidth:56,
                          borderStyle:'dashed', cursor: clickable ? 'pointer' : 'default', opacity: isCompleted ? 1 : 0.4
                        }}
                      >
                        <span style={{ fontSize:9, fontWeight:700 }}>🎁 M11</span>
                        <span style={{ fontSize:8 }}>பரிசு</span>
                        {payout && <span style={{ fontSize:7, color:'#4ade80' }}>{fmtDate(payout.payment_date)}</span>}
                      </div>
                    );
                  })()}
                </div>

                {/* Paid history */}
                {(c.payment_months||[]).some(m => paymentMap[c.id]?.[m]) && (
                  <>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', marginBottom:5 }}>Payment History:</div>
                    {(c.payment_months||[]).map((m, i) => {
                      const pay = paymentMap[c.id]?.[m];
                      if (!pay) return null;
                      return (
                        <div key={m} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', background:'#0f172a', borderRadius:6, marginBottom:4, border:'1px solid #1a3b20' }}>
                          <span style={{ fontSize:11, color:'#4ade80', fontWeight:600 }}>M{i+1} — {fmtFull(m)}</span>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={{ fontSize:10, color:'#94a3b8' }}>{fmtDate(pay.payment_date)}</span>
                            {pay.payment_mode && <span style={S.badge2('#0f172a','#64748b')}>{pay.payment_mode.toUpperCase()}</span>}
                            <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>₹{(pay.amount||0).toLocaleString('en-IN')}</span>
                            <button style={S.btn('#475569')} onClick={() => printReceipt(c, pay)}>🖨</button>
                          </div>
                        </div>
                      );
                    })}
                    {paymentMap[c.id]?.['payout'] && (() => {
                      const payout = paymentMap[c.id]['payout'];
                      return (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', background:'#1c1400', borderRadius:6, marginBottom:4, border:'1px solid #92400e' }}>
                          <span style={{ fontSize:11, color:'#fbbf24', fontWeight:600 }}>🎁 திருவிழா பரிசு</span>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={{ fontSize:10, color:'#94a3b8' }}>{fmtDate(payout.payment_date)}</span>
                            <span style={S.badge2('#0f172a','#64748b')}>{(payout.payment_mode||'cash').toUpperCase()}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:'#fbbf24' }}>₹{(payout.amount||0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ marginTop:8, padding:'6px 10px', background:'#0f172a', borderRadius:8, border:'1px solid #334155', display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:11, color:'#94a3b8' }}>Total Paid (Months 1-10)</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#f59e0b' }}>
                        ₹{(c.payment_months||[]).reduce((sum,m) => sum + (paymentMap[c.id]?.[m]?.amount||0), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}

                {/* Action buttons */}
                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button
                    style={{ flex:1, ...S.btn('#1e40af'), padding:'9px 0', fontSize:12 }}
                    onClick={() => { openEdit(c); setDetailCust(null); }}
                  >✏️ Edit</button>
                  <button
                    style={{ flex:1, ...S.btn('#dc2626'), padding:'9px 0', fontSize:12 }}
                    onClick={() => deleteCustomer(c)}
                  >🗑️ Delete</button>
                  <button
                    style={{ flex:1, ...S.btn('#25d366'), padding:'9px 0', fontSize:12 }}
                    onClick={() => { window.open(`https://wa.me/91${c.mobile}`, '_blank'); }}
                  >💬 WA</button>
                </div>
                {c.status === 'removed' ? (
                  <button
                    style={{ width:'100%', padding:9, marginTop:8, ...S.btn('#15803d'), fontSize:12 }}
                    onClick={() => reactivateCustomer(c)}
                  >↩️ திட்டத்தில் மீண்டும் சேர்க்கவும் (Reactivate)</button>
                ) : isOverdue(c.payment_months, paidCount) && (
                  <button
                    style={{ width:'100%', padding:9, marginTop:8, ...S.btn('#dc2626'), fontSize:12 }}
                    onClick={() => removeFromScheme(c)}
                  >🚨 திட்டத்தில் இருந்து நீக்கவும் (Remove — Rule 3)</button>
                )}
                <button onClick={() => setDetailCust(null)}
                  style={{ width:'100%', padding:9, background:'none', border:'1px solid #334155', borderRadius:8, color:'#94a3b8', fontSize:12, cursor:'pointer', marginTop:8 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── EDIT CUSTOMER MODAL ───────────────────────────────── */}
      {editCust && (
        <div style={S.modal} onClick={() => setEditCust(null)}>
          <div style={{ ...S.modalBox, maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 18px', background:'linear-gradient(135deg,#1e40af,#1e3a8a)', borderRadius:'16px 16px 0 0' }}>
              <div style={{ fontSize:16, fontWeight:800, color:'white' }}>✏️ Edit Member</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:2 }}>{editCust.name}</div>
            </div>
            <div style={{ padding:'16px 18px' }}>
              <button
                type="button"
                onClick={() => pickContact('edit')}
                style={{ width:'100%', padding:10, marginBottom:14, background:'#0f172a', border:'1px dashed #f59e0b', borderRadius:8, color:'#f59e0b', fontSize:12, fontWeight:600, cursor:'pointer' }}
              >
                📇 Contacts-ல் இருந்து தேர்வு செய்யவும்
              </button>
              {!contactPickerSupported && (
                <div style={{ fontSize:9, color:'#64748b', marginTop:-10, marginBottom:14 }}>
                  (Contacts picker Android Chrome-ல் மட்டும் வேலை செய்யும்)
                </div>
              )}

              <label style={S.label}>Customer Name <span style={{ color:'#f87171' }}>*</span></label>
              <input style={S.input} value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name:e.target.value }))} />

              <label style={S.label}>Father Name <span style={{ color:'#f87171' }}>*</span></label>
              <input style={S.input} value={editForm.father_name}
                onChange={e => setEditForm(f => ({ ...f, father_name:e.target.value }))} />

              <label style={S.label}>Mobile Number <span style={{ color:'#f87171' }}>*</span></label>
              <input style={S.input} type="tel" maxLength={10} value={editForm.mobile}
                onChange={e => setEditForm(f => ({ ...f, mobile:e.target.value.replace(/\D/,'') }))} />

              <label style={S.label}>Spouse Name <span style={{ color:'#475569' }}>(Optional)</span></label>
              <input style={S.input} value={editForm.spouse_name}
                onChange={e => setEditForm(f => ({ ...f, spouse_name:e.target.value }))} />

              <label style={S.label}>அறிமுகப்படுத்தியவர் <span style={{ color:'#475569' }}>(Referred By — Optional)</span></label>
              <select
                style={S.input}
                value={editForm.referred_by}
                onChange={e => setEditForm(f => ({ ...f, referred_by:e.target.value }))}
              >
                <option value="">— யாரும் இல்லை —</option>
                {activeCustomers.filter(c => c.id !== editCust.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.mobile})</option>
                ))}
              </select>

              <button style={S.primaryBtn('linear-gradient(135deg,#1e40af,#1e3a8a)')} disabled={saving} onClick={saveEdit}>
                {saving ? '⏳ Saving...' : '✅ Save Changes'}
              </button>
              <button onClick={() => setEditCust(null)}
                style={{ width:'100%', padding:10, background:'none', border:'1px solid #334155', borderRadius:8, color:'#94a3b8', fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT REMINDER ──────────────────────────────────── */}
      {section === 'reminder' && (
        <div style={S.page}>
          <div style={S.card}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700 }}>🔔 Payment Reminders</span>
              <MonthPicker />
            </div>

            <div style={S.summRow}>
              <div style={S.sumItem}><div style={{ fontSize:16,fontWeight:700,color:'#f87171' }}>{unpaidThisMonth.length}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Pending</div></div>
              <div style={{ ...S.sumItem,borderLeft:'1px solid #334155' }}><div style={{ fontSize:14,fontWeight:700,color:'#fbbf24' }}>₹{(stats?.pending_amount||0).toLocaleString('en-IN')}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Amount Due</div></div>
              <div style={{ ...S.sumItem,borderLeft:'1px solid #334155' }}><div style={{ fontSize:16,fontWeight:700,color:'#4ade80' }}>{paidThisMonth.length}</div><div style={{ fontSize:9,color:'#94a3b8' }}>Paid</div></div>
            </div>

            {unpaidThisMonth.length > 0 && (
              <button style={S.primaryBtn('linear-gradient(135deg,#d97706,#b45309)')} onClick={sendAllReminders}>
                💬 Send Reminder to All {unpaidThisMonth.length} Pending
              </button>
            )}

            <div style={{ fontSize:10,fontWeight:700,color:'#f87171',padding:'5px 0',marginBottom:5,borderBottom:'1px solid #334155' }}>
              Pending Members — {fmtFull(selMonth)}
            </div>

            {unpaidThisMonth.length === 0 && !loading && (
              <div style={{ textAlign:'center',color:'#4ade80',padding:'20px 0',fontSize:13 }}>🎉 All members paid for this month!</div>
            )}

            {unpaidThisMonth.map(c => {
              const mNum = (c.payment_months||[]).indexOf(selMonth) + 1;
              return (
                <div key={c.id} style={{ ...S.crow('unpaid'), borderLeft:'3px solid #f59e0b' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:700 }}>
                      {c.name}
                      <span style={{ ...S.badge2(c.scheme===1?'#1e3a5f':'#3b1e5f',c.scheme===1?'#93c5fd':'#c4b5fd'),marginLeft:5 }}>S{c.scheme}</span>
                      <span style={{ ...S.badge2('#0f172a','#64748b'),marginLeft:4,border:'1px solid #334155' }}>M{mNum}/10</span>
                    </div>
                    <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>{c.father_name} | 📞 {c.mobile} | Due: ₹{c.scheme_amount.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={S.row}>
                    <button style={S.btn('#15803d')} onClick={() => { setQuickDate(todayISO()); setQuickMode('cash'); setQuickPay({ customer: c }); }}>Pay</button>
                    <button style={S.btn('#25d366')} onClick={() => sendReminderWA(c)}>WA</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── DEFAULTERS (rule 3: 3+ months behind) ─────────────── */}
      {section === 'defaulters' && (
        <div style={S.page}>
          <div style={S.card}>
            <div style={{ fontSize:13, fontWeight:700, color:'#f87171', marginBottom:4 }}>🚨 Defaulters</div>
            <div style={{ fontSize:10, color:'#94a3b8', marginBottom:12 }}>
              விதி 3: தொடர்ந்து 3 மாதங்கள் செலுத்தாதவர்கள் திட்டத்தில் இருந்து நீக்கப்படுவார்கள்.
            </div>

            {defaulters.length === 0 && !loading && (
              <div style={{ textAlign:'center',color:'#4ade80',padding:'20px 0',fontSize:13 }}>🎉 யாரும் 3+ மாதம் நிலுவையில் இல்லை!</div>
            )}

            {defaulters.map(c => {
              const paidCount = (c.payment_months||[]).filter(m => paymentMap[c.id]?.[m]).length;
              const behind = monthsElapsed(c.payment_months) - paidCount;
              return (
                <div key={c.id} style={{ ...S.crow('unpaid'), borderLeft:'3px solid #dc2626' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:700 }}>
                      {c.name}
                      <span style={{ ...S.badge2('#7f1d1d','#fca5a5'), marginLeft:5 }}>⚠️ {behind} மாதங்கள் நிலுவை</span>
                    </div>
                    <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>{c.father_name} | 📞 {c.mobile} | {paidCount}/10 paid</div>
                  </div>
                  <div style={S.row}>
                    <button style={S.btn('#25d366')} onClick={() => sendReminderWA(c)}>WA</button>
                    <button style={S.btn('#dc2626')} onClick={() => removeFromScheme(c)}>Remove</button>
                  </div>
                </div>
              );
            })}

            {removedCustomers.length > 0 && (
              <>
                <div style={{ fontSize:10,fontWeight:700,color:'#64748b',padding:'12px 0 5px',marginTop:10,borderTop:'1px solid #334155' }}>
                  நீக்கப்பட்டவர்கள் (Removed) — {removedCustomers.length}
                </div>
                {removedCustomers.map(c => (
                  <div key={c.id} style={{ ...S.crow('unpaid'), borderLeft:'3px solid #64748b', opacity:0.7 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:700 }}>{c.name}</div>
                      <div style={{ fontSize:9,color:'#94a3b8',marginTop:2 }}>{c.father_name} | 📞 {c.mobile}</div>
                    </div>
                    <button style={S.btn('#15803d')} onClick={() => reactivateCustomer(c)}>Reactivate</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
