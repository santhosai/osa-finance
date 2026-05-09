import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const PHONE = '8667510724';

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
  const [form, setForm] = useState({ name:'', father_name:'', mobile:'', spouse_name:'', scheme:1 });

  // Record-payment
  const [payTarget, setPayTarget]   = useState(null); // customer object
  const [payDate, setPayDate]       = useState(todayISO());
  const [custSearch, setCustSearch] = useState('');

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

  const dueThisMonth = customers.filter(c => (c.payment_months || []).includes(selMonth));
  const paidThisMonth   = dueThisMonth.filter(c =>  paymentMap[c.id]?.[selMonth]);
  const unpaidThisMonth = dueThisMonth.filter(c => !paymentMap[c.id]?.[selMonth]);

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
      setForm({ name:'', father_name:'', mobile:'', spouse_name:'', scheme:1 });
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
          customer_id: customer.id,
          payment_month: selMonth,
          month_number: monthIdx + 1,
          amount: customer.scheme_amount,
          payment_date: payDate
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

  const undoPayment = async (paymentId, customerName) => {
    if (!window.confirm(`Undo payment for ${customerName}?`)) return;
    try {
      await fetch(`${API_URL}/festival-fund/payments/${paymentId}`, { method:'DELETE' });
      flash(`Undone: ${customerName}`);
      fetchAll();
    } catch (e) { flash(e.message); }
  };

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const sendWhatsAppMsg = (customer, payment, type) => {
    const monthIdx = (customer.payment_months || []).indexOf(payment.payment_month);
    const mNum = monthIdx + 1;
    const remaining = 10 - mNum;
    const nextMonthIdx = monthIdx + 1;
    const nextMonth = customer.payment_months?.[nextMonthIdx];

    let text = '';
    if (type === 'received') {
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
📆 தேதி: ${fmtDate(payment.payment_date)}

📊 முன்னேற்றம்: ${mNum}/10 months ✓
${remaining > 0 ? `⏳ மீதமுள்ளது: ${remaining} months\n🙏 நன்றி! அடுத்த மாதம்: ${nextMonth ? fmtFull(nextMonth) : ''}` : '🎊 அனைத்து மாதங்களும் முடிந்தன! நன்றி!'}

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

  // ── Nav helper ────────────────────────────────────────────────────────────
  const nav = (s) => { setSection(s); setSidebarOpen(false); };

  const NAV = [
    { id:'dashboard', icon:'📊', label:'Dashboard', group:'Overview' },
    { id:'addcust',   icon:'➕', label:'Add Customer', group:'Customers' },
    { id:'monthly',   icon:'📅', label:'Monthly Payments', badge:unpaidThisMonth.length, group:'Payments' },
    { id:'payment',   icon:'💰', label:'Record Payment', group:'Payments' },
    { id:'reminder',  icon:'🔔', label:'Payment Reminder', badge:unpaidThisMonth.length, group:'Payments' },
  ];

  const titles = { dashboard:'Dashboard', addcust:'Add Customer', monthly:'Monthly Payments', payment:'Record Payment', reminder:'Payment Reminder' };

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
                    {n.badge > 0 && <span style={S.badge()}>{n.badge}</span>}
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
              { title:'Scheme 1 — ₹1,000', count:stats?.scheme1_count, bg:'linear-gradient(135deg,#1e3a5f,#1e293b)', tc:'#93c5fd', amt:`₹${((stats?.scheme1_count||0)*1000).toLocaleString('en-IN')}/month` },
              { title:'Scheme 2 — ₹2,000', count:stats?.scheme2_count, bg:'linear-gradient(135deg,#3b1e5f,#1e293b)', tc:'#c4b5fd', amt:`₹${((stats?.scheme2_count||0)*2000).toLocaleString('en-IN')}/month` },
            ].map((s,i) => (
              <div key={i} style={{ background:s.bg,borderRadius:10,padding:13,textAlign:'center',border:'1px solid #334155' }}>
                <div style={{ fontSize:11,fontWeight:700,color:s.tc,marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:22,fontWeight:800,color:'white' }}>{loading?'…':s.count}</div>
                <div style={{ fontSize:9,color:'#94a3b8' }}>members</div>
                <div style={{ fontSize:10,color:s.tc,marginTop:5 }}>{s.amt}</div>
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

            {/* PAID */}
            {paidThisMonth.length > 0 && (
              <>
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
                          {c.father_name} | {c.mobile} | M{mNum}/10 | Paid: {pay ? fmtDate(pay.payment_date) : ''}
                        </div>
                      </div>
                      <div style={S.row}>
                        <span style={{ background:'#14532d',color:'#4ade80',padding:'3px 6px',borderRadius:5,fontSize:9,fontWeight:700 }}>✓</span>
                        <button style={S.btn('#25d366')} onClick={() => sendWhatsAppMsg(c, pay, 'received')}>WA</button>
                        <button style={S.btn('#475569')} onClick={() => printReceipt(c, pay)}>🖨</button>
                        <button style={S.btn('#b45309')} onClick={() => undoPayment(pay.id, c.name)}>Undo</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* UNPAID */}
            {unpaidThisMonth.length > 0 && (
              <>
                <div style={{ fontSize:10,fontWeight:700,color:'#f87171',padding:'5px 0',marginTop:10,marginBottom:5,borderBottom:'1px solid #334155' }}>
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
                      <div style={S.row}>
                        <button style={S.btn('#15803d')} onClick={() => { setPayTarget(c); setSection('payment'); }}>Pay</button>
                        <button style={S.btn('#25d366')} onClick={() => sendReminderWA(c)}>WA</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {dueThisMonth.length === 0 && !loading && (
              <div style={{ textAlign:'center',color:'#64748b',padding:'20px 0',fontSize:13 }}>No payments due for this month</div>
            )}
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
                </div>
              ))}
            </div>

            <div style={{ background:'#0f172a',borderRadius:8,padding:'10px 12px',marginBottom:14,border:'1px solid #334155' }}>
              <div style={{ fontSize:10,color:'#94a3b8' }}>Join Month (auto)</div>
              <div style={{ fontSize:14,fontWeight:700,color:'#f59e0b' }}>{fmtFull(currentMonth())}</div>
              <div style={{ fontSize:10,color:'#64748b',marginTop:2 }}>
                Payments: {fmtFull((() => { const d=new Date(); d.setMonth(d.getMonth()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })())} → 10 months
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
                    <button style={S.btn('#15803d')} onClick={() => { setPayTarget(c); setSection('payment'); }}>Pay</button>
                    <button style={S.btn('#25d366')} onClick={() => sendReminderWA(c)}>WA</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
